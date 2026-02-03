using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using FluentValidation;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Authentication and user registration endpoints.
/// These endpoints are public (no JWT required) but rate-limited to 5 requests/minute.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("auth")]
[Produces("application/json")]
[ApiExplorerSettings(GroupName = "v1")]
public class AuthController(
    UserManager<AppUser> userManager,
    SignInManager<AppUser> signInManager,
    PitbullDbContext db,
    IConfiguration configuration,
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
    /// **Rate limited:** 5 requests per minute.
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
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        // Validate request
        var validationResult = await registerValidator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new { 
                errors = validationResult.Errors.Select(e => e.ErrorMessage).ToArray() 
            });
        }
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
                        actionResult = BadRequest(new { errors = new[] { "Invalid tenant ID" } });
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
                    actionResult = BadRequest(new { errors = result.Errors.Select(e => e.Description) });
                    return;
                }

                await transaction.CommitAsync();

                var token = GenerateJwtToken(user);
                actionResult = Ok(new AuthResponse(token, user.Id, user.FullName, user.Email!));
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
    /// **Rate limited:** 5 requests per minute.
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
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        // Validate request
        var validationResult = await loginValidator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new { 
                errors = validationResult.Errors.Select(e => e.ErrorMessage).ToArray() 
            });
        }
        var user = await userManager.FindByEmailAsync(request.Email);
        if (user is null)
            return Unauthorized(new { error = "Invalid credentials" });

        var result = await signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
        if (!result.Succeeded)
            return Unauthorized(new { error = "Invalid credentials" });

        user.LastLoginAt = DateTime.UtcNow;
        await userManager.UpdateAsync(user);

        var token = GenerateJwtToken(user);
        return Ok(new AuthResponse(token, user.Id, user.FullName, user.Email!));
    }

    private string GenerateJwtToken(AppUser user)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(configuration["Jwt:Key"]!));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email!),
            new("tenant_id", user.TenantId.ToString()),
            new("full_name", user.FullName),
            new("user_type", user.Type.ToString())
        };

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
public record AuthResponse(
    string Token,
    Guid UserId,
    string FullName,
    string Email);
