using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Services;

/// <summary>
/// Single place for access-token claim sets (login, refresh, company switch, invitation accept).
/// Prevents claim drift (is_demo_user, job_title, role_profile, permissions).
/// </summary>
public interface IJwtTokenService
{
    /// <summary>
    /// Build a JWT for an authenticated user. When <paramref name="activeCompanyId"/> is null,
    /// company claims are resolved from UserCompanyAccess (default or first).
    /// </summary>
    Task<string> CreateAccessTokenAsync(
        AppUser user,
        IList<string> identityRoles,
        Guid? activeCompanyId = null,
        IReadOnlyList<Guid>? companyIds = null,
        CancellationToken ct = default);
}

public sealed class JwtTokenService(
    PitbullDbContext db,
    IConfiguration configuration) : IJwtTokenService
{
    public async Task<string> CreateAccessTokenAsync(
        AppUser user,
        IList<string> identityRoles,
        Guid? activeCompanyId = null,
        IReadOnlyList<Guid>? companyIds = null,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(user);
        identityRoles ??= Array.Empty<string>();

        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(configuration["Jwt:Key"]!));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        Guid resolvedCompanyId;
        IReadOnlyList<Guid> resolvedCompanyIds;

        if (activeCompanyId.HasValue)
        {
            resolvedCompanyId = activeCompanyId.Value;
            resolvedCompanyIds = companyIds ?? Array.Empty<Guid>();
        }
        else
        {
            var companyAccess = await db.Set<UserCompanyAccess>()
                .IgnoreQueryFilters()
                .Where(uca => uca.TenantId == user.TenantId && uca.UserId == user.Id && !uca.IsDeleted)
                .Select(uca => new { uca.CompanyId, uca.IsDefault })
                .ToListAsync(ct);

            resolvedCompanyId = companyAccess.FirstOrDefault(c => c.IsDefault)?.CompanyId
                                ?? companyAccess.FirstOrDefault()?.CompanyId
                                ?? Guid.Empty;
            resolvedCompanyIds = companyAccess.Select(c => c.CompanyId).ToList();
        }

        var roleProfile = RoleProfileResolver.Detect(user.Title, identityRoles);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new("tenant_id", user.TenantId.ToString()),
            new("full_name", user.FullName),
            new("user_type", user.Type.ToString()),
            new("role_profile", RoleProfileResolver.ToApiName(roleProfile)),
        };

        if (!string.IsNullOrWhiteSpace(user.Title))
            claims.Add(new Claim("job_title", user.Title));

        if (user.IsDemoUser)
            claims.Add(new Claim("is_demo_user", "true"));

        if (resolvedCompanyId != Guid.Empty)
        {
            claims.Add(new Claim("company_id", resolvedCompanyId.ToString()));
            claims.Add(new Claim("company_ids", string.Join(",", resolvedCompanyIds)));
        }

        foreach (var role in identityRoles)
            claims.Add(new Claim(ClaimTypes.Role, role));

        foreach (var perm in await RbacJwtPermissionResolver.ResolveAsync(db, user, identityRoles, ct))
            claims.Add(new Claim("permissions", perm));

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
