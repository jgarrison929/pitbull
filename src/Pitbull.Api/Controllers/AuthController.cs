using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
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
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

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
    IValidator<LoginRequest> loginValidator) : ControllerBase
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

                // Ensure roles exist and auto-promote first user to Admin
                await roleSeeder.EnsureTenantHasAdminAsync(tenantId);

                // Get user's roles for JWT
                var roles = await roleSeeder.GetUserRolesAsync(user);

                await transaction.CommitAsync();

                var token = await GenerateJwtTokenAsync(user);
                actionResult = Created("", new AuthResponse(token, user.Id, user.FullName, user.Email!, roles.ToArray()));
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

        var token = await GenerateJwtTokenAsync(user);
        return Ok(new AuthResponse(token, user.Id, user.FullName, user.Email!, roles.ToArray()));
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

        return Ok(new { message = "Password changed successfully" });
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
            LastLoginAt: user.LastLoginAt
        ));
    }

    private async Task<string> GenerateJwtTokenAsync(AppUser user)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(configuration["Jwt:Key"]!));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var roles = await roleSeeder.GetUserRolesAsync(user);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email!),
            new("tenant_id", user.TenantId.ToString()),
            new("full_name", user.FullName),
            new("user_type", user.Type.ToString())
        };

        // Add role claims - use ClaimTypes.Role for ASP.NET Core authorization
        foreach (var role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
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
    DateTime? LastLoginAt);

/// <summary>
/// Registration request with user and optional company details
/// </summary>
/// <param name="Email">User's email address (must be unique)</param>
/// <param name="Password">Password (min 8 chars, requires uppercase, lowercase, and digit)</param>
/// <param name="FirstName">User's first name</param>
/// <param name="LastName">User's last name</param>
/// <param name="TenantId">Optional existing tenant ID to join. If omitted, a new tenant is created.</param>
/// <param name="CompanyName">Company name for the auto-created tenant. Defaults to "{FirstName}'s Company".</param>
public record RegisterRequest(
    string Email,
    string Password,
    string FirstName,
    string LastName,
    Guid TenantId = default,
    string? CompanyName = null);

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
public record AuthResponse(
    string Token,
    Guid UserId,
    string FullName,
    string Email,
    string[] Roles);
