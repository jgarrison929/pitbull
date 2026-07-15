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
using Pitbull.Core.MultiTenancy;
using Pitbull.Core.Logging;

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
    ITenantProvisioningService tenantProvisioning,
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
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"SELECT set_config('app.current_tenant', {tenantId.ToString()}, false)");

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

                // In demo mode, grant access to ALL companies (same as demo-register)
                // so users can explore the full multi-company experience.
                var isDemoEnvironment = configuration.GetValue<bool>("Demo:Enabled");
                if (isDemoEnvironment)
                {
                    var allCompanies = await db.Set<Pitbull.Core.Domain.Company>()
                        .IgnoreQueryFilters()
                        .Where(c => c.TenantId == tenantId && !c.IsDeleted)
                        .ToListAsync();
                    foreach (var comp in allCompanies)
                    {
                        db.Set<Pitbull.Core.Domain.UserCompanyAccess>().Add(new Pitbull.Core.Domain.UserCompanyAccess
                        {
                            TenantId = tenantId,
                            UserId = user.Id,
                            CompanyId = comp.Id,
                            IsDefault = comp.Id == defaultCompany.Id,
                            CreatedAt = DateTime.UtcNow,
                            CreatedBy = user.Id.ToString()
                        });
                    }
                }
                else
                {
                    // Standard: grant access to default company only
                    db.Set<Pitbull.Core.Domain.UserCompanyAccess>().Add(new Pitbull.Core.Domain.UserCompanyAccess
                    {
                        TenantId = tenantId,
                        UserId = user.Id,
                        CompanyId = defaultCompany.Id,
                        IsDefault = true,
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = user.Id.ToString()
                    });
                }
                await db.SaveChangesAsync();

                // Get user's roles for JWT
                var roles = await roleSeeder.GetUserRolesAsync(user);

                // Generate and store refresh token
                var refreshToken = GenerateRefreshToken();
                user.RefreshToken = refreshToken;
                user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(30);
                await userManager.UpdateAsync(user);

                // Seed defaults before commit — registration fails if provisioning fails
                await tenantProvisioning.ProvisionTenantAsync(tenantId, defaultCompany.Id);

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
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(30);
        await userManager.UpdateAsync(user);

        return Ok(new AuthResponse(token, user.Id, user.FullName, user.Email!, roles.ToArray(), refreshToken));
    }

    /// <summary>
    /// One-click demo persona login. Maps a role key to a seeded demo user and
    /// returns JWT tokens without exposing the shared demo password to the client.
    /// Only available when <c>Demo:Enabled=true</c>.
    /// </summary>
    /// <remarks>
    /// Sample request:
    ///
    ///     POST /api/auth/demo-role-login
    ///     { "role": "ceo" }
    ///
    /// Supported roles: ceo, cfo, pm, estimator, superintendent (alias: foreman)
    /// </remarks>
    [HttpPost("demo-role-login")]
    [EnableRateLimiting("demo-register")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> DemoRoleLogin([FromBody] DemoRoleLoginRequest request)
    {
        if (!demoOptions.Value.Enabled)
            return this.NotFoundError("Demo role login is not available");

        if (string.IsNullOrWhiteSpace(demoOptions.Value.UserPassword))
            return this.BadRequestError("Demo environment is not fully configured");

        if (string.IsNullOrWhiteSpace(request.Role) ||
            !DemoRolePersonas.TryGetValue(request.Role.Trim().ToLowerInvariant(), out var persona))
        {
            return this.BadRequestError(
                $"Unknown demo role. Supported: {string.Join(", ", DemoRolePersonas.Keys)}");
        }

        var user = await userManager.FindByEmailAsync(persona.Email);
        if (user is null)
            return this.BadRequestError("Demo persona is not ready. Seed may still be running — try again shortly.");

        var passwordOk = await signInManager.CheckPasswordSignInAsync(
            user, demoOptions.Value.UserPassword, lockoutOnFailure: false);
        if (!passwordOk.Succeeded)
            return this.UnauthorizedError("Demo persona credentials are invalid. Contact the operator.");

        // Ensure demo flag so JWT includes is_demo_user and admin APIs stay read-only
        user.LastLoginAt = DateTime.UtcNow;
        if (!user.IsDemoUser)
            user.IsDemoUser = true;

        var roles = await roleSeeder.GetUserRolesAsync(user);
        if (!roles.Any())
        {
            await roleSeeder.EnsureRolesForTenantAsync(user.TenantId);
            await roleSeeder.AssignRoleToUserAsync(user, persona.FallbackIdentityRole);
            roles = await roleSeeder.GetUserRolesAsync(user);
        }

        var refreshToken = GenerateRefreshToken();
        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        await userManager.UpdateAsync(user);

        var token = await GenerateJwtTokenAsync(user);

        logger.LogInformation("Demo role login: role={Role} email={Email} isDemoUser={IsDemo}",
            persona.Key, persona.Email, user.IsDemoUser);

        return Ok(new AuthResponse(token, user.Id, user.FullName, user.Email!, roles.ToArray(), refreshToken));
    }

    /// <summary>
    /// Lists one-click demo personas available on the login page when demo mode is on.
    /// </summary>
    [HttpGet("demo-roles")]
    [EnableRateLimiting("api")]
    [ProducesResponseType(typeof(IReadOnlyList<DemoRoleInfo>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult ListDemoRoles()
    {
        if (!demoOptions.Value.Enabled)
            return this.NotFoundError("Demo role login is not available");

        // Distinct by email so "foreman" alias does not duplicate the superintendent button
        var roles = DemoRolePersonas.Values
            .GroupBy(p => p.Email, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.First())
            .Select(p => new DemoRoleInfo(p.Key, p.Label, p.Description, p.Email))
            .ToList();
        return Ok(roles);
    }

    /// <summary>
    /// Seeded demo personas for one-click login (email + shared Demo:UserPassword).
    /// </summary>
    private static readonly Dictionary<string, DemoRolePersona> DemoRolePersonas = new(StringComparer.OrdinalIgnoreCase)
    {
        ["ceo"] = new("ceo", "CEO", "Executive portfolio — financials, risks, pipeline, people & safety",
            "ceo@demo.local", RoleSeeder.Roles.Manager),
        ["cfo"] = new("cfo", "CFO", "Financial leadership — WIP, AR/AP aging, accounting, cash position",
            "cfo@demo.local", RoleSeeder.Roles.Manager),
        ["pm"] = new("pm", "Project Manager", "Jobs in flight — schedules, RFIs, daily reports, time approval",
            "pm@demo.local", RoleSeeder.Roles.Supervisor),
        ["estimator"] = new("estimator", "Estimator", "Precon focus — bids, pipeline value, cost codes",
            "estimator@demo.local", RoleSeeder.Roles.User),
        // Field leadership — title resolves to role_profile=field (crew time, daily reports)
        ["superintendent"] = new("superintendent", "Superintendent",
            "Field leadership — crew time, daily reports, equipment, punch lists",
            "superintendent@demo.local", RoleSeeder.Roles.Supervisor),
        // Alias for the same seeded persona (login key only)
        ["foreman"] = new("foreman", "Foreman",
            "Field leadership — crew time, daily reports, equipment, punch lists",
            "superintendent@demo.local", RoleSeeder.Roles.Supervisor),
    };

    private sealed record DemoRolePersona(
        string Key,
        string Label,
        string Description,
        string Email,
        string FallbackIdentityRole);

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
            !CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(user.RefreshToken ?? ""),
                Encoding.UTF8.GetBytes(request.RefreshToken ?? "")) ||
            user.RefreshTokenExpiryTime <= DateTime.UtcNow)
        {
            return this.UnauthorizedError("Invalid or expired refresh token");
        }

        // Generate new token pair and rotate refresh token
        var newAccessToken = await GenerateJwtTokenAsync(user);
        var newRefreshToken = GenerateRefreshToken();

        user.RefreshToken = newRefreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(30);
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
    /// Logout — revokes the user's refresh token so it can't be used to mint new access tokens.
    /// </summary>
    [HttpPost("logout")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    [EnableRateLimiting("api")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Logout()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;

        if (!string.IsNullOrEmpty(userId))
        {
            var user = await userManager.FindByIdAsync(userId);
            if (user is not null)
            {
                user.RefreshToken = null;
                user.RefreshTokenExpiryTime = null;
                await userManager.UpdateAsync(user);
            }
        }

        return Ok(new { message = "Logged out successfully" });
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
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(30);
        await userManager.UpdateAsync(user);

        return Ok(new AuthResponse(token, user.Id, user.FullName, user.Email!, roles.ToArray(), refreshToken));
    }

    /// <summary>
    /// Self-service demo registration. Creates a demo user in the shared demo tenant.
    /// </summary>
    [HttpPost("demo-register")]
    [EnableRateLimiting("demo-register")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> DemoRegister([FromBody] DemoRegisterRequest request)
    {
        if (!demoOptions.Value.Enabled)
            return this.NotFoundError("Demo registration is not available");

        // Validate inputs
        if (string.IsNullOrWhiteSpace(request.FirstName) || string.IsNullOrWhiteSpace(request.LastName))
            return this.BadRequestError("First name and last name are required");
        if (string.IsNullOrWhiteSpace(request.Email))
            return this.BadRequestError("Email is required");
        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
            return this.BadRequestError("Password must be at least 8 characters");
        if (!request.Password.Any(char.IsUpper))
            return this.BadRequestError("Password must contain at least one uppercase letter");
        if (!request.Password.Any(char.IsLower))
            return this.BadRequestError("Password must contain at least one lowercase letter");
        if (!request.Password.Any(char.IsDigit))
            return this.BadRequestError("Password must contain at least one number");

        // Map role to Identity role + title.
        // Demo users get appropriate roles (NOT Admin). The frontend handles
        // workspace visibility for demo users separately (shows all workspaces).
        // DemoRestrictionMiddleware blocks dangerous endpoints regardless.
        var (identityRole, title) = request.Role?.ToLowerInvariant() switch
        {
            "ceo"            => (RoleSeeder.Roles.Manager, "Chief Executive Officer"),
            "cfo"            => (RoleSeeder.Roles.Manager, "Chief Financial Officer"),
            "pm"             => (RoleSeeder.Roles.Supervisor, "Project Manager"),
            "field-engineer" => (RoleSeeder.Roles.User, "Field Engineer"),
            "estimator"      => (RoleSeeder.Roles.User, "Estimator"),
            "ap-clerk"       => (RoleSeeder.Roles.User, "AP / AR Clerk"),
            "hr-manager"     => (RoleSeeder.Roles.Manager, "HR Manager"),
            "it-admin"       => (RoleSeeder.Roles.Manager, "IT Administrator"),
            _                => (RoleSeeder.Roles.User, "Demo User")
        };

        // Validate company code
        var validCodes = new[] { "01", "02", "03", "04" };
        var companyCode = validCodes.Contains(request.CompanyCode) ? request.CompanyCode : "01";

        // Find the demo tenant
        var demo = demoOptions.Value;
        var tenant = await db.Set<Tenant>().FirstOrDefaultAsync(t => t.Slug == demo.TenantSlug);
        if (tenant is null)
            return this.BadRequestError("Demo environment is not ready. Please try again later.");

        // Check if email already taken — if it's an existing demo user, just log them in
        var existingUser = await userManager.FindByEmailAsync(request.Email);
        if (existingUser is not null)
        {
            if (existingUser.IsDemoUser)
            {
                // Handle retry scenario: user was created but response was lost.
                // Generate a fresh JWT and log them in instead of showing an error.
                var existingRoles = await roleSeeder.GetUserRolesAsync(existingUser);
                var existingToken = await GenerateJwtTokenAsync(existingUser);
                var existingRefresh = GenerateRefreshToken();
                existingUser.RefreshToken = existingRefresh;
                existingUser.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
                await userManager.UpdateAsync(existingUser);

                logger.LogInformation("Demo user re-login via registration retry: {Email}", LogSafe.Email(request.Email));

                return Ok(new AuthResponse(existingToken, existingUser.Id, existingUser.FullName, existingUser.Email!, existingRoles.ToArray(), existingRefresh));
            }

            return this.BadRequestError("An account with this email already exists. Try logging in.");
        }

        // Find the company
        var company = await db.Set<Company>()
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TenantId == tenant.Id && c.Code == companyCode && !c.IsDeleted);
        if (company is null)
            return this.BadRequestError("Selected company not found in demo environment");

        // Create user
        var user = new AppUser
        {
            UserName = request.Email,
            Email = request.Email,
            EmailConfirmed = true,
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            Title = title,
            TenantId = tenant.Id,
            CompanyId = company.Id,
            Type = UserType.Internal,
            Status = UserStatus.Active,
            IsDemoUser = true
        };

        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            var errors = string.Join("; ", result.Errors.Select(e => e.Description));
            return this.BadRequestError(errors);
        }

        // Assign role
        await roleSeeder.EnsureRolesForTenantAsync(tenant.Id);
        await roleSeeder.AssignRoleToUserAsync(user, identityRole);

        // Grant access to ALL demo companies (same as pre-seeded accounts)
        // so users can use the company switcher and see the full demo experience.
        var allCompanies = await db.Set<Company>()
            .IgnoreQueryFilters()
            .Where(c => c.TenantId == tenant.Id && !c.IsDeleted)
            .ToListAsync();

        foreach (var comp in allCompanies)
        {
            db.Set<UserCompanyAccess>().Add(new UserCompanyAccess
            {
                TenantId = tenant.Id,
                UserId = user.Id,
                CompanyId = comp.Id,
                IsDefault = comp.Id == company.Id, // selected company is default
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "demo-register"
            });
        }
        await db.SaveChangesAsync();

        // Create Employee record inside RLS context
        tenantContext.TenantId = tenant.Id;
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT set_config('app.current_tenant', {tenant.Id.ToString()}, false)");
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT set_config('app.current_company', {company.Id.ToString()}, false)");

        // Skip Employee record for self-service demo users to avoid OnboardingStatus
        // type mismatch (string vs integer column). Demo users don't need employee records
        // to experience the platform — they can view all seed data through their role.

        // Generate JWT + refresh token (auto-login)
        var roles = await roleSeeder.GetUserRolesAsync(user);
        var token = await GenerateJwtTokenAsync(user);
        var refreshToken = GenerateRefreshToken();
        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(30);
        await userManager.UpdateAsync(user);

        logger.LogInformation("Demo user registered: {Email} as {Role} in company {CompanyCode}", LogSafe.Email(request.Email), LogSafe.Text(request.Role), LogSafe.Text(companyCode));

        return Created("", new AuthResponse(token, user.Id, user.FullName, user.Email!, roles.ToArray(), refreshToken));
    }

    /// <summary>
    /// Export demo user signups as CSV (admin-only, for sales pipeline).
    /// </summary>
    [HttpGet("demo-users/export")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
    [EnableRateLimiting("api")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ExportDemoUsers()
    {
        if (!demoOptions.Value.Enabled)
            return NotFound();

        var demoUsers = await db.Users
            .Where(u => u.IsDemoUser)
            .OrderByDescending(u => u.CreatedAt)
            .Select(u => new
            {
                u.Email,
                u.FirstName,
                u.LastName,
                u.Title,
                u.CreatedAt,
                u.LastLoginAt,
                CompanyId = u.CompanyId
            })
            .ToListAsync();

        // Resolve company codes
        var companyIds = demoUsers.Where(u => u.CompanyId.HasValue).Select(u => u.CompanyId!.Value).Distinct().ToList();
        var companies = await db.Set<Company>()
            .IgnoreQueryFilters()
            .Where(c => companyIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.Code);

        var csv = new System.Text.StringBuilder();
        csv.AppendLine("email,firstName,lastName,role,companyCode,createdAt,lastLoginAt");
        foreach (var u in demoUsers)
        {
            var code = u.CompanyId.HasValue && companies.TryGetValue(u.CompanyId.Value, out var c) ? c : "";
            csv.AppendLine($"{Escape(u.Email)},{Escape(u.FirstName)},{Escape(u.LastName)},{Escape(u.Title)},{code},{u.CreatedAt:O},{u.LastLoginAt?.ToString("O") ?? ""}");
        }

        return File(System.Text.Encoding.UTF8.GetBytes(csv.ToString()), "text/csv", "demo-users.csv");

        static string Escape(string? v)
        {
            if (string.IsNullOrEmpty(v)) return "";
            // Prevent CSV injection: prefix formula-starting chars with single quote
            var sanitized = v;
            if (sanitized.Length > 0 && "=+-@\t\r".Contains(sanitized[0]))
                sanitized = "'" + sanitized;
            // Escape quotes and wrap in quotes if needed
            if (sanitized.Contains(',') || sanitized.Contains('"') || sanitized.Contains('\n') || sanitized.Contains('\''))
                return $"\"{sanitized.Replace("\"", "\"\"")}\"";
            return sanitized;
        }
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
    [HttpGet("/api/users/me")] // alias: some callers use /api/users/me instead of /api/auth/me
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

        var permissions = await ResolveRbacPermissionClaimsAsync(user, roles);
        var roleProfile = RoleProfileResolver.Detect(user.Title, roles);

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
            EmployeeId: user.EmployeeId,
            ActiveCompany: activeCompanyId != null
                ? new CompanyBriefResponse(activeCompanyId.Id, activeCompanyId.Code, activeCompanyId.Name)
                : null,
            AccessibleCompanies: accessibleCompanies,
            Permissions: permissions,
            Title: user.Title,
            RoleProfile: RoleProfileResolver.ToApiName(roleProfile)
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

    /// <summary>
    /// Resolves RBAC permission claim values for JWT/profile.
    /// Uses IgnoreQueryFilters because login runs before tenant middleware sets context.
    /// </summary>
    private async Task<string[]> ResolveRbacPermissionClaimsAsync(AppUser user, IList<string> identityRoles)
    {
        var adminRoleId = await db.RbacRoles
            .AsNoTracking()
            .IgnoreQueryFilters()
            .Where(r => r.TenantId == user.TenantId && r.Name == PermissionConstants.RoleTemplates.Admin)
            .Select(r => r.Id)
            .FirstOrDefaultAsync();

        var isRbacAdmin = adminRoleId != Guid.Empty
            && await db.UserRolesMap
                .AsNoTracking()
                .IgnoreQueryFilters()
                .AnyAsync(ur => ur.UserId == user.Id && ur.TenantId == user.TenantId && ur.RoleId == adminRoleId);

        if (!isRbacAdmin)
            isRbacAdmin = identityRoles.Contains(RoleSeeder.Roles.Admin);

        if (user.IsDemoUser || isRbacAdmin)
            return [PermissionConstants.Wildcard];

        return await db.RolePermissions
            .AsNoTracking()
            .IgnoreQueryFilters()
            .Where(rp => rp.TenantId == user.TenantId
                && db.UserRolesMap
                    .IgnoreQueryFilters()
                    .Any(ur => ur.UserId == user.Id && ur.TenantId == user.TenantId && ur.RoleId == rp.RoleId))
            .Join(
                db.Permissions.AsNoTracking().IgnoreQueryFilters(),
                rp => rp.PermissionId,
                p => p.Id,
                (rp, p) => p.Name)
            .Distinct()
            .OrderBy(n => n)
            .ToArrayAsync();
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

        var roleProfile = RoleProfileResolver.Detect(user.Title, roles);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email!),
            new("tenant_id", user.TenantId.ToString()),
            new("full_name", user.FullName),
            new("user_type", user.Type.ToString()),
            new("role_profile", RoleProfileResolver.ToApiName(roleProfile)),
        };

        if (!string.IsNullOrWhiteSpace(user.Title))
            claims.Add(new Claim("job_title", user.Title));

        if (user.IsDemoUser)
            claims.Add(new Claim("is_demo_user", "true"));

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

        foreach (var perm in await ResolveRbacPermissionClaimsAsync(user, roles))
        {
            claims.Add(new Claim("permissions", perm));
        }

        var expiration = int.Parse(configuration["Jwt:ExpirationMinutes"] ?? "30");

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
    Guid? EmployeeId = null,
    CompanyBriefResponse? ActiveCompany = null,
    List<CompanyBriefResponse>? AccessibleCompanies = null,
    string[]? Permissions = null,
    string? Title = null,
    string? RoleProfile = null);

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

/// <summary>
/// Demo self-service registration request
/// </summary>
public record DemoRegisterRequest(
    string FirstName,
    string LastName,
    string Email,
    string Password,
    string? Role = "pm",
    string? CompanyCode = "01");

/// <summary>
/// One-click demo persona login (no password in the request).
/// </summary>
/// <param name="Role">Persona key: ceo, cfo, pm, or estimator</param>
public record DemoRoleLoginRequest(string Role);

/// <summary>
/// Public catalog entry for a demo persona button on the login page.
/// </summary>
public record DemoRoleInfo(string Key, string Label, string Description, string Email);
