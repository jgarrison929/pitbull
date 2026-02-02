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

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("auth")]
public class AuthController(
    UserManager<AppUser> userManager,
    SignInManager<AppUser> signInManager,
    PitbullDbContext db,
    IConfiguration configuration,
    IValidator<RegisterRequest> registerValidator,
    IValidator<LoginRequest> loginValidator) : ControllerBase
{
    [HttpPost("register")]
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

    [HttpPost("login")]
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

public record RegisterRequest(
    string Email,
    string Password,
    string FirstName,
    string LastName,
    Guid TenantId = default,
    string? CompanyName = null);

public record LoginRequest(
    string Email,
    string Password);

public record AuthResponse(
    string Token,
    Guid UserId,
    string FullName,
    string Email);
