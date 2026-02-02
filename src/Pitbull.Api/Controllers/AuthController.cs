using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(
    UserManager<AppUser> userManager,
    SignInManager<AppUser> signInManager,
    IConfiguration configuration) : ControllerBase
{
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var user = new AppUser
        {
            UserName = request.Email,
            Email = request.Email,
            FirstName = request.FirstName,
            LastName = request.LastName,
            TenantId = request.TenantId
        };

        var result = await userManager.CreateAsync(user, request.Password);

        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors.Select(e => e.Description) });

        var token = GenerateJwtToken(user);
        return Ok(new AuthResponse(token, user.Id, user.FullName, user.Email!));
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
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
    Guid TenantId);

public record LoginRequest(
    string Email,
    string Password);

public record AuthResponse(
    string Token,
    Guid UserId,
    string FullName,
    string Email);
