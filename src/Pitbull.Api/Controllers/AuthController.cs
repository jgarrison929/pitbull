using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using FluentValidation;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Pitbull.Api.Demo;
using Pitbull.Api.Extensions;
using Pitbull.Api.Infrastructure;
using Pitbull.Core.Constants;
using Pitbull.Core.Data;
using Pitbull.Api.Services;
using Pitbull.Core.Domain;
using Pitbull.Core.Entities;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Authentication and user registration endpoints.
/// These endpoints are public (no JWT required) but rate-limited per endpoint.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
[ApiExplorerSettings(GroupName = "v1")]
public class AuthController(
    UserManager<AppUser> userManager,
    SignInManager<AppUser> signInManager,
    RoleSeeder roleSeeder,
    PitbullDbContext db,
    IConfiguration configuration,
    IOptions<DemoOptions> demoOptions,
    IValidator<RegisterRequest> registerValidator,
    IValidator<LoginRequest> loginValidator,
    Pitbull.Core.MultiTenancy.TenantContext tenantContext,
    IServiceScopeFactory scopeFactory,
    ILogger<AuthController> logger) : ControllerBase
{
    /// <summary>
    /// Register a new user account
    /// </summary>
    /// <remarks>
    /// Creates a new user and optionally a new tenant (organization). If no TenantId is provided,
    /// a new tenant is automatically created using the CompanyName or the user's first name.
    ///
    /// **Required fields:** email, password, firstName, lastName
    /// 
    /// **Note:** This endpoint requires separate firstName and lastName fields, not a combined fullName field.
    ///
    /// **Rate limited:** 5 requests per hour per IP.
    ///
    /// Sample request:
    ///
    ///     POST /api/auth/register
    ///     {
    ///         "email": "john@acmeconstruction.com",
    ///         "password": "SecurePass123",
    ///         "firstName": "John",
    ///         "lastName": "Doe",
    ///         "companyName": "Acme Construction"
    ///     }
    ///
    /// </remarks>
    /// <param name="request">Registration details including email, password, and company info</param>
    /// <returns>JWT token and user details</returns>
    /// <response code="200">Registration successful, returns JWT token</response>
    /// <response code="400">Validation failed or user creation error</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPost("register")]
    [EnableRateLimiting("register")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        // Public demo should not allow self-service signups
        if (demoOptions.Value.Enabled && demoOptions.Value.DisableRegistration)
            return this.NotFoundError("Registration is disabled in demo mode");

        // Validate request
        var validationResult = await registerValidator.ValidateAsync(request);
        if (!validationResult.IsValid)
            return this.ValidationError(validationResult);
        // Use explicit transaction so tenant + user creation are atomic.
        // The execution strategy requires us to wrap the whole transaction block.
        var strategy = db.Database.CreateExecutionStrategy();

        IActionResult? actionResult = null;

        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync();

            try
            {
                // Auto-create tenant if none provided
                Guid tenantId;
                if (request.TenantId == Guid.Empty || request.TenantId == default)
                {
                    var companyName = request.CompanyName ?? $"{request.FirstName}'s Company";
                    var slug = companyName.ToLowerInvariant().Replace(" ", "-").Replace("'", "");

                    // Check for slug collision
                    var existingSlug = await db.Set<Tenant>().AnyAsync(t => t.Slug == slug);
                    if (existingSlug)
                        slug = $"{slug}-{Guid.NewGuid().ToString()[..8]}";

                    var tenant = new Tenant
                    {
                        Id = Guid.NewGuid(),
                        Name = companyName,
                        Slug = slug,
                        Status = TenantStatus.Active,
                        Plan = TenantPlan.Trial,
                        CreatedAt = DateTime.UtcNow
                    };
                    db.Set<Tenant>().Add(tenant);
                    await db.SaveChangesAsync();
                    tenantId = tenant.Id;
                }
                else
                {
                    var tenantExists = await db.Set<Tenant>().AnyAsync(t => t.Id == request.TenantId);
                    if (!tenantExists)
                    {
                        await transaction.RollbackAsync();
                        actionResult = this.BadRequestError("Invalid tenant ID");
                        return;
                    }
                    tenantId = request.TenantId;
                }

                // Set the tenant context for this request scope so that:
                // 1. The TenantConnectionInterceptor sets app.current_tenant on new connections
                // 2. EF Core query filters match the new tenant
                // 3. RLS policies allow inserts into companies/user_company_access
                tenantContext.TenantId = tenantId;

                // Also set on the current connection for immediate RLS compliance
                await db.Database.ExecuteSqlRawAsync(
                    "SELECT set_config('app.current_tenant', @p0, false)",
                    tenantId.ToString());

                var user = new AppUser
                {
                    UserName = request.Email,
                    Email = request.Email,
                    FirstName = request.FirstName,
                    LastName = request.LastName,
                    TenantId = tenantId
                };

                var result = await userManager.CreateAsync(user, request.Password);

                if (!result.Succeeded)
                {
                    await transaction.RollbackAsync();
                    var errors = result.Errors.ToDictionary(
                        e => e.Code,
                        e => new[] { e.Description }
                    );
                    actionResult = this.ValidationError(errors, "User creation failed");
                    return;
                }

                // Ensure roles exist for this tenant
                await roleSeeder.EnsureRolesForTenantAsync(tenantId);

                // Auto-assign role: first user in tenant gets Admin, others get Viewer
                var tenantUserCount = await db.Users.CountAsync(u => u.TenantId == tenantId);
                if (tenantUserCount <= 1)
                    await roleSeeder.AssignRoleToUserAsync(user, RoleSeeder.Roles.Admin);
                else
                    await roleSeeder.AssignRoleToUserAsync(user, RoleSeeder.Roles.Viewer);

                // Ensure a default company exists for this tenant
                var defaultCompany = await db.Set<Pitbull.Core.Domain.Company>()
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.IsDefault && !c.IsDeleted);

                if (defaultCompany is null)
                {
                    var companyName = request.CompanyName ?? $"{request.FirstName}'s Company";
                    defaultCompany = new Pitbull.Core.Domain.Company
                    {
                        TenantId = tenantId,
                        Code = "01",
                        Name = companyName,
                        IndustryType = request.IndustryType,
                        EmployeeRange = request.EmployeeRange,
                        IsDefault = true,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = user.Id.ToString()
                    };
                    db.Set<Pitbull.Core.Domain.Company>().Add(defaultCompany);
                    await db.SaveChangesAsync();
                }

                // Grant user access to the default company
                var access = new Pitbull.Core.Domain.UserCompanyAccess
                {
                    TenantId = tenantId,
                    UserId = user.Id,
                    CompanyId = defaultCompany.Id,
                    IsDefault = true,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = user.Id.ToString()
                };
                db.Set<Pitbull.Core.Domain.UserCompanyAccess>().Add(access);
                await db.SaveChangesAsync();

                // Get user's roles for JWT
                var roles = await roleSeeder.GetUserRolesAsync(user);

                // Generate and store refresh token
                var refreshToken = GenerateRefreshToken();
                user.RefreshToken = refreshToken;
                user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
                await userManager.UpdateAsync(user);

                await transaction.CommitAsync();

                var token = await GenerateJwtTokenAsync(user);
                actionResult = Created("", new AuthResponse(token, user.Id, user.FullName, user.Email!, roles.ToArray(), refreshToken));
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        });

        return actionResult!;
    }

    /// <summary>
    /// Log in with email and password
    /// </summary>
    /// <remarks>
    /// Authenticates a user and returns a JWT token for subsequent API calls.
    /// The token includes tenant_id, user_type, and full_name claims.
    /// Token expiration is configurable (default: 60 minutes).
    ///
    /// **Rate limited:** 10 requests per minute per IP.
    ///
    /// Sample request:
    ///
    ///     POST /api/auth/login
    ///     {
    ///         "email": "john@acmeconstruction.com",
    ///         "password": "SecurePass123"
    ///     }
    ///
    /// </remarks>
    /// <param name="request">Login credentials</param>
    /// <returns>JWT token and user details</returns>
    /// <response code="200">Login successful, returns JWT token</response>
    /// <response code="400">Validation failed</response>
    /// <response code="401">Invalid credentials</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPost("login")]
    [EnableRateLimiting("login")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        // Validate request
        var validationResult = await loginValidator.ValidateAsync(request);
        if (!validationResult.IsValid)
            return this.ValidationError(validationResult);
        var user = await userManager.FindByEmailAsync(request.Email);
        if (user is null)
            return this.UnauthorizedError("Invalid credentials");

        var result = await signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
        if (!result.Succeeded)
            return this.UnauthorizedError("Invalid credentials");

        user.LastLoginAt = DateTime.UtcNow;
        await userManager.UpdateAsync(user);

        // Get user's roles for JWT and response
        var roles = await roleSeeder.GetUserRolesAsync(user);

        // Backfill: if user has no roles, assign one now
        if (!roles.Any())
        {
            await roleSeeder.EnsureRolesForTenantAsync(user.TenantId);

            // First/only user in tenant gets Admin, others get Viewer
            var userCount = await db.Users.CountAsync(u => u.TenantId == user.TenantId);
            if (userCount <= 1)
                await roleSeeder.AssignRoleToUserAsync(user, RoleSeeder.Roles.Admin);
            else
                await roleSeeder.AssignRoleToUserAsync(user, RoleSeeder.Roles.Viewer);

            // Re-fetch roles for JWT
            roles = await roleSeeder.GetUserRolesAsync(user);
        }

        var token = await GenerateJwtTokenAsync(user);

        // Generate and store refresh token
        var refreshToken = GenerateRefreshToken();
        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        await userManager.UpdateAsync(user);

        return Ok(new AuthResponse(token, user.Id, user.FullName, user.Email!, roles.ToArray(), refreshToken));
    }

    /// <summary>
    /// Refresh an expired access token using a refresh token
    /// </summary>
    /// <remarks>
    /// Accepts an expired access token and a valid refresh token, then returns
    /// a new access token and rotated refresh token. The old refresh token is
    /// invalidated after use.
    ///
    /// **Rate limited:** Standard API rate limit.
    ///
    /// Sample request:
    ///
    ///     POST /api/auth/refresh
    ///     {
    ///         "token": "expired-jwt-token",
    ///         "refreshToken": "valid-refresh-token"
    ///     }
    ///
    /// </remarks>
    /// <param name="request">Expired access token and refresh token</param>
    /// <returns>New JWT token and rotated refresh token</returns>
    /// <response code="200">Token refreshed successfully</response>
    /// <response code="401">Invalid or expired refresh token</response>
    [HttpPost("refresh")]
    [EnableRateLimiting("api")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Token) || string.IsNullOrWhiteSpace(request.RefreshToken))
            return this.UnauthorizedError("Token and refresh token are required");

        // Extract user identity from the expired access token
        var principal = GetPrincipalFromExpiredToken(request.Token);
        if (principal is null)
            return this.UnauthorizedError("Invalid access token");

        var userId = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        if (string.IsNullOrEmpty(userId))
            return this.UnauthorizedError("Invalid access token");

        var user = await userManager.FindByIdAsync(userId);
        if (user is null ||
            user.RefreshToken != request.RefreshToken ||
            user.RefreshTokenExpiryTime <= DateTime.UtcNow)
        {
            return this.UnauthorizedError("Invalid or expired refresh token");
        }

        // Generate new token pair and rotate refresh token
        var newAccessToken = await GenerateJwtTokenAsync(user);
        var newRefreshToken = GenerateRefreshToken();

        user.RefreshToken = newRefreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        var updateResult = await userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
            return StatusCode(500, new { error = "Failed to persist token rotation", code = "INTERNAL_ERROR" });

        var roles = await roleSeeder.GetUserRolesAsync(user);

        return Ok(new AuthResponse(newAccessToken, user.Id, user.FullName, user.Email!, roles.ToArray(), newRefreshToken));
    }

    /// <summary>
    /// Change the current user's password
    /// </summary>
    /// <remarks>
    /// Changes the password for the currently authenticated user.
    /// Requires the current password for verification.
    ///
    /// **Rate limited:** Standard API rate limit.
    ///
    /// Sample request:
    ///
    ///     POST /api/auth/change-password
    ///     {
    ///         "currentPassword": "OldPass123",
    ///         "newPassword": "NewPass456"
    ///     }
    ///
    /// </remarks>
    /// <param name="request">Current and new password</param>
    /// <returns>Success message</returns>
    /// <response code="200">Password changed successfully</response>
    /// <response code="400">Validation failed or password change error</response>
    /// <response code="401">Not authenticated or current password incorrect</response>
    [HttpPost("change-password")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    [EnableRateLimiting("api")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CurrentPassword) || string.IsNullOrWhiteSpace(request.NewPassword))
            return this.BadRequestError("Current password and new password are required");

        if (request.NewPassword.Length < 8)
            return this.BadRequestError("New password must be at least 8 characters");

        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;

        if (string.IsNullOrEmpty(userId))
            return this.UnauthorizedError("User not found");

        var user = await userManager.FindByIdAsync(userId);
        if (user is null)
            return this.UnauthorizedError("User not found");

        var result = await userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            var errors = result.Errors.ToDictionary(
                e => e.Code,
                e => new[] { e.Description }
            );
            return this.ValidationError(errors, "Password change failed");
        }

        // Revoke refresh token so stolen tokens can't mint new access tokens
        user.RefreshToken = null;
        user.RefreshTokenExpiryTime = null;
        await userManager.UpdateAsync(user);

        return Ok(new { message = "Password changed successfully" });
    }

    /// <summary>
    /// Bootstrap admin role for demo user (temporary endpoint)
    /// </summary>
    /// <remarks>
    /// This endpoint is only available in demo mode and allows the demo user
    /// to self-assign Admin role. This is needed when the demo user was created
    /// before role assignment logic was added.
    /// 
    /// **Demo mode only.** Returns 404 otherwise.
    /// </remarks>
    /// <returns>Updated auth response with new token containing Admin role</returns>
    /// <response code="200">Admin role assigned, returns new JWT token</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="403">Not the demo user or demo mode disabled</response>
    /// <response code="404">Demo mode not enabled</response>
    [HttpPost("bootstrap-admin")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    [EnableRateLimiting("api")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> BootstrapAdmin()
    {
        // Only available in demo mode
        if (!demoOptions.Value.Enabled)
            return NotFound();

        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;

        if (string.IsNullOrEmpty(userId))
            return this.UnauthorizedError("User not found");

        var user = await userManager.FindByIdAsync(userId);
        if (user is null)
            return this.UnauthorizedError("User not found");

        // Only allow for demo user email (if configured)
        if (!string.IsNullOrWhiteSpace(demoOptions.Value.UserEmail) && 
            !string.Equals(user.Email, demoOptions.Value.UserEmail, StringComparison.OrdinalIgnoreCase))
        {
            return this.ForbiddenError("This endpoint is only available for the demo user");
        }

        // Ensure roles exist and assign Admin
        await roleSeeder.EnsureRolesForTenantAsync(user.TenantId);
        await roleSeeder.AssignRoleToUserAsync(user, RoleSeeder.Roles.Admin);

        // Generate new token with updated roles
        var roles = await roleSeeder.GetUserRolesAsync(user);
        var token = await GenerateJwtTokenAsync(user);

        var refreshToken = GenerateRefreshToken();
        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        await userManager.UpdateAsync(user);

        return Ok(new AuthResponse(token, user.Id, user.FullName, user.Email!, roles.ToArray(), refreshToken));
    }

    /// <summary>
    /// Get the current user's profile
    /// </summary>
    /// <remarks>
    /// Returns the profile information for the currently authenticated user.
    /// </remarks>
    /// <returns>User profile</returns>
    /// <response code="200">Returns user profile</response>
    /// <response code="401">Not authenticated</response>
    [HttpGet("me")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    [EnableRateLimiting("api")]
    [ProducesResponseType(typeof(UserProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetProfile()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;

        if (string.IsNullOrEmpty(userId))
            return this.UnauthorizedError("User not found");

        var user = await userManager.FindByIdAsync(userId);
        if (user is null)
            return this.UnauthorizedError("User not found");

        var roles = await roleSeeder.GetUserRolesAsync(user);

        // Get tenant info
        var tenant = await db.Set<Tenant>().FindAsync(user.TenantId);

        // Get company info
        var companyAccess = await db.Set<Pitbull.Core.Domain.UserCompanyAccess>()
            .IgnoreQueryFilters()
            .Where(uca => uca.TenantId == user.TenantId && uca.UserId == user.Id && !uca.IsDeleted)
            .Join(db.Set<Pitbull.Core.Domain.Company>().IgnoreQueryFilters().Where(c => !c.IsDeleted),
                uca => uca.CompanyId,
                c => c.Id,
                (uca, c) => new { uca, c })
            .ToListAsync();

        var activeCompanyId = companyAccess.FirstOrDefault(x => x.uca.IsDefault)?.c
                              ?? companyAccess.FirstOrDefault()?.c;

        var accessibleCompanies = companyAccess
            .Select(x => new CompanyBriefResponse(x.c.Id, x.c.Code, x.c.Name))
            .ToList();

        // Get RBAC permissions for profile response
        var isRbacAdmin = await db.Set<UserRole>()
            .AsNoTracking()
            .AnyAsync(ur => ur.UserId == user.Id && ur.TenantId == user.TenantId
                && ur.Role.Name == PermissionConstants.RoleTemplates.Admin);

        // Backward compatibility: check Identity Admin role as fallback
        // Existing users may only have roles in AspNetUserRoles (not yet migrated to RBAC UserRole table)
        if (!isRbacAdmin)
            isRbacAdmin = roles.Contains("Admin");

        string[] permissions;
        if (isRbacAdmin)
        {
            permissions = new[] { PermissionConstants.Wildcard };
        }
        else
        {
            permissions = await db.Set<RolePermission>()
                .AsNoTracking()
                .Where(rp => rp.TenantId == user.TenantId
                    && db.Set<UserRole>()
                        .Any(ur => ur.UserId == user.Id && ur.TenantId == user.TenantId && ur.RoleId == rp.RoleId))
                .Select(rp => rp.Permission.Name)
                .Distinct()
                .OrderBy(p => p)
                .ToArrayAsync();
        }

        return Ok(new UserProfileResponse(
            Id: user.Id,
            Email: user.Email!,
            FirstName: user.FirstName,
            LastName: user.LastName,
            FullName: user.FullName,
            Roles: roles.ToArray(),
            TenantId: user.TenantId,
            TenantName: tenant?.Name ?? "Unknown",
            CreatedAt: user.CreatedAt,
            LastLoginAt: user.LastLoginAt,
            ActiveCompany: activeCompanyId != null
                ? new CompanyBriefResponse(activeCompanyId.Id, activeCompanyId.Code, activeCompanyId.Name)
                : null,
            AccessibleCompanies: accessibleCompanies,
            Permissions: permissions
        ));
    }

    /// <summary>
    /// Update the current user's profile (display name)
    /// </summary>
    [HttpPut("profile")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    [EnableRateLimiting("api")]
    [ProducesResponseType(typeof(UserProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;

        if (string.IsNullOrEmpty(userId))
            return this.UnauthorizedError("User not found");

        var user = await userManager.FindByIdAsync(userId);
        if (user is null)
            return this.UnauthorizedError("User not found");

        if (string.IsNullOrWhiteSpace(request.FirstName) || string.IsNullOrWhiteSpace(request.LastName))
            return this.BadRequestError("First name and last name are required");

        if (request.FirstName.Trim().Length > 100 || request.LastName.Trim().Length > 100)
            return this.BadRequestError("Name cannot exceed 100 characters");

        user.FirstName = request.FirstName.Trim();
        user.LastName = request.LastName.Trim();

        var result = await userManager.UpdateAsync(user);
        if (!result.Succeeded)
            return this.BadRequestError("Failed to update profile");

        // Return updated profile via the existing GetProfile logic
        return await GetProfile();
    }

    /// <summary>
    /// Request a password reset email
    /// </summary>
    /// <remarks>
    /// Always returns 200 regardless of whether the email exists,
    /// to prevent user enumeration attacks. Uses constant-time work
    /// to prevent timing side-channel enumeration.
    /// </remarks>
    [HttpPost("forgot-password")]
    [Microsoft.AspNetCore.Authorization.AllowAnonymous]
    [EnableRateLimiting("register")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        const string successMessage = "If an account exists with that email, a reset link has been sent.";

        if (string.IsNullOrWhiteSpace(request.Email))
            return Ok(new { message = successMessage });

        // Always generate a token to equalize CPU work regardless of email validity
        var (plaintext, hash) = PasswordResetToken.GenerateToken();

        var user = await userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null)
        {
            // Simulate roughly the same latency as the real path
            await Task.Delay(Random.Shared.Next(50, 150));
            return Ok(new { message = successMessage });
        }

        // Delete expired/used tokens, invalidate remaining unused ones
        await db.PasswordResetTokens
            .Where(t => t.UserId == user.Id && (t.IsUsed || t.ExpiresAt < DateTime.UtcNow))
            .ExecuteDeleteAsync();

        await db.PasswordResetTokens
            .Where(t => t.UserId == user.Id && !t.IsUsed)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.IsUsed, true));

        var resetToken = new PasswordResetToken
        {
            UserId = user.Id,
            TokenHash = hash,
            ExpiresAt = DateTime.UtcNow.AddHours(1),
        };
        db.PasswordResetTokens.Add(resetToken);
        await db.SaveChangesAsync();

        _ = Task.Run(async () =>
        {
            using var scope = scopeFactory.CreateScope();
            var email = scope.ServiceProvider.GetRequiredService<IEmailService>();
            try { await email.SendPasswordResetAsync(user.Email!, user.FullName, plaintext); }
            catch (Exception ex) { logger.LogError(ex, "Failed to send password reset email to {Email}", user.Email); }
        });

        return Ok(new { message = successMessage });
    }

    /// <summary>
    /// Reset password using a token from the forgot-password email
    /// </summary>
    [HttpPost("reset-password")]
    [Microsoft.AspNetCore.Authorization.AllowAnonymous]
    [EnableRateLimiting("register")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Token) || string.IsNullOrWhiteSpace(request.NewPassword))
            return this.BadRequestError("Token and new password are required");

        if (request.NewPassword.Length < 8)
            return this.BadRequestError("Password must be at least 8 characters");

        var hash = PasswordResetToken.HashToken(request.Token);

        // Atomic claim: mark the token as used in a single UPDATE WHERE.
        // If two requests race, only one gets rowsAffected == 1.
        var rowsAffected = await db.PasswordResetTokens
            .Where(t => t.TokenHash == hash && !t.IsUsed && t.ExpiresAt > DateTime.UtcNow)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.IsUsed, true));

        if (rowsAffected == 0)
            return this.BadRequestError("Invalid or expired reset token");

        var resetToken = await db.PasswordResetTokens
            .AsNoTracking()
            .FirstAsync(t => t.TokenHash == hash);

        var user = await userManager.FindByIdAsync(resetToken.UserId.ToString());
        if (user is null)
            return this.BadRequestError("Invalid or expired reset token");

        // Reset the password using Identity's token-based flow
        var identityToken = await userManager.GeneratePasswordResetTokenAsync(user);
        var result = await userManager.ResetPasswordAsync(user, identityToken, request.NewPassword);

        if (!result.Succeeded)
        {
            var errors = string.Join("; ", result.Errors.Select(e => e.Description));
            return this.BadRequestError(errors);
        }

        // Revoke refresh token so stolen tokens can't mint new access tokens
        user.RefreshToken = null;
        user.RefreshTokenExpiryTime = null;
        await userManager.UpdateAsync(user);

        return Ok(new { message = "Password has been reset successfully" });
    }

    private static string GenerateRefreshToken()
    {
        var randomBytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(randomBytes);
    }

    private ClaimsPrincipal? GetPrincipalFromExpiredToken(string token)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(configuration["Jwt:Key"]!));
        var validationParameters = new TokenValidationParameters
        {
            ValidateAudience = true,
            ValidateIssuer = true,
            ValidIssuer = configuration["Jwt:Issuer"],
            ValidAudience = configuration["Jwt:Audience"],
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = key,
            ValidateLifetime = false // Allow expired tokens
        };

        try
        {
            var principal = new JwtSecurityTokenHandler()
                .ValidateToken(token, validationParameters, out var securityToken);
            if (securityToken is not JwtSecurityToken jwtToken ||
                !jwtToken.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.InvariantCultureIgnoreCase))
                return null;
            return principal;
        }
        catch
        {
            return null;
        }
    }

    private async Task<string> GenerateJwtTokenAsync(AppUser user)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(configuration["Jwt:Key"]!));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var roles = await roleSeeder.GetUserRolesAsync(user);

        // Get user's company access
        var companyAccess = await db.Set<Pitbull.Core.Domain.UserCompanyAccess>()
            .IgnoreQueryFilters()
            .Where(uca => uca.TenantId == user.TenantId && uca.UserId == user.Id && !uca.IsDeleted)
            .Select(uca => new { uca.CompanyId, uca.IsDefault })
            .ToListAsync();

        // Determine active company: default company, or first available
        var defaultCompanyId = companyAccess.FirstOrDefault(c => c.IsDefault)?.CompanyId
                               ?? companyAccess.FirstOrDefault()?.CompanyId
                               ?? Guid.Empty;

        var companyIds = companyAccess.Select(c => c.CompanyId).ToList();

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email!),
            new("tenant_id", user.TenantId.ToString()),
            new("full_name", user.FullName),
            new("user_type", user.Type.ToString()),
        };

        // Add company claims if available
        if (defaultCompanyId != Guid.Empty)
        {
            claims.Add(new Claim("company_id", defaultCompanyId.ToString()));
            claims.Add(new Claim("company_ids", string.Join(",", companyIds)));
        }

        // Add role claims - use ClaimTypes.Role for ASP.NET Core authorization
        foreach (var role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        // Add RBAC permission claims from the granular permission system
        var isRbacAdmin = await db.Set<UserRole>()
            .AsNoTracking()
            .AnyAsync(ur => ur.UserId == user.Id && ur.TenantId == user.TenantId
                && ur.Role.Name == PermissionConstants.RoleTemplates.Admin);

        // Backward compatibility: check Identity Admin role as fallback
        // Existing users may only have roles in AspNetUserRoles (not yet migrated to RBAC UserRole table)
        if (!isRbacAdmin)
            isRbacAdmin = roles.Contains("Admin");

        if (isRbacAdmin)
        {
            claims.Add(new Claim("permissions", PermissionConstants.Wildcard));
        }
        else
        {
            var userPermissions = await db.Set<RolePermission>()
                .AsNoTracking()
                .Where(rp => rp.TenantId == user.TenantId
                    && db.Set<UserRole>()
                        .Any(ur => ur.UserId == user.Id && ur.TenantId == user.TenantId && ur.RoleId == rp.RoleId))
                .Select(rp => rp.Permission.Name)
                .Distinct()
                .ToListAsync();

            foreach (var perm in userPermissions)
            {
                claims.Add(new Claim("permissions", perm));
            }
        }

        var expiration = int.Parse(configuration["Jwt:ExpirationMinutes"] ?? "60");

        var token = new JwtSecurityToken(
            issuer: configuration["Jwt:Issuer"],
            audience: configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiration),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

/// <summary>
/// Change password request
/// </summary>
/// <param name="CurrentPassword">Current password for verification</param>
/// <param name="NewPassword">New password (min 8 chars)</param>
public record ChangePasswordRequest(
    string CurrentPassword,
    string NewPassword);

/// <summary>
/// User profile response
/// </summary>
public record UserProfileResponse(
    Guid Id,
    string Email,
    string FirstName,
    string LastName,
    string FullName,
    string[] Roles,
    Guid TenantId,
    string TenantName,
    DateTime CreatedAt,
    DateTime? LastLoginAt,
    CompanyBriefResponse? ActiveCompany = null,
    List<CompanyBriefResponse>? AccessibleCompanies = null,
    string[]? Permissions = null);

public record CompanyBriefResponse(
    Guid Id,
    string Code,
    string Name);

/// <summary>
/// Registration request with user and optional company details
/// </summary>
/// <param name="Email">User's email address (must be unique)</param>
/// <param name="Password">Password (min 8 chars, requires uppercase, lowercase, and digit)</param>
/// <param name="FirstName">User's first name</param>
/// <param name="LastName">User's last name</param>
/// <param name="TenantId">Optional existing tenant ID to join. If omitted, a new tenant is created.</param>
/// <param name="CompanyName">Company name for the auto-created tenant. Defaults to "{FirstName}'s Company".</param>
/// <param name="IndustryType">Optional industry type slug (e.g., "general-contractor", "specialty-contractor").</param>
/// <param name="EmployeeRange">Optional employee range label (e.g., "1-10", "11-50", "500+").</param>
public record RegisterRequest(
    string Email,
    string Password,
    string FirstName,
    string LastName,
    Guid TenantId = default,
    string? CompanyName = null,
    string? IndustryType = null,
    string? EmployeeRange = null);

/// <summary>
/// Login credentials
/// </summary>
/// <param name="Email">Registered email address</param>
/// <param name="Password">Account password</param>
public record LoginRequest(
    string Email,
    string Password);

/// <summary>
/// Authentication response containing the JWT token and user info
/// </summary>
/// <param name="Token">JWT bearer token for API authentication</param>
/// <param name="UserId">Unique user identifier</param>
/// <param name="FullName">User's display name</param>
/// <param name="Email">User's email address</param>
/// <param name="Roles">User's assigned roles (e.g., Admin, Manager, User)</param>
/// <param name="RefreshToken">Refresh token for obtaining new access tokens</param>
public record AuthResponse(
    string Token,
    Guid UserId,
    string FullName,
    string Email,
    string[] Roles,
    string? RefreshToken = null);

public record UpdateProfileRequest(
    string FirstName,
    string LastName);

public record ForgotPasswordRequest(
    string Email);

public record ResetPasswordRequest(
    string Token,
    string NewPassword);

/// <summary>
/// Refresh token request containing the expired access token and valid refresh token
/// </summary>
/// <param name="Token">The expired JWT access token</param>
/// <param name="RefreshToken">The refresh token issued at login</param>
public record RefreshTokenRequest(
    string Token,
    string RefreshToken);
