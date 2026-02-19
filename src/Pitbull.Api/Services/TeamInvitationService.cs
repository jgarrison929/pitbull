using System.Net.Mail;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Pitbull.Api.Infrastructure;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Services;

public interface ITeamInvitationService
{
    Task<CreateInvitationResult> CreateInvitationAsync(CreateInvitationRequest request, CancellationToken ct = default);
    Task<List<CreateInvitationResult>> CreateBulkInvitationsAsync(List<CreateInvitationRequest> requests, CancellationToken ct = default);
    Task<TeamInvitationDto?> GetInvitationByTokenAsync(string token, CancellationToken ct = default);
    Task<AcceptInvitationResult> AcceptInvitationAsync(string token, AcceptInvitationRequest request, CancellationToken ct = default);
    Task RevokeInvitationAsync(Guid invitationId, CancellationToken ct = default);
    Task<List<TeamInvitationDto>> ListInvitationsAsync(Guid companyId, CancellationToken ct = default);
    Task ResendInvitationAsync(Guid invitationId, CancellationToken ct = default);
}

public class TeamInvitationService(
    PitbullDbContext db,
    UserManager<AppUser> userManager,
    RoleSeeder roleSeeder,
    ITenantContext tenantContext,
    IServiceScopeFactory scopeFactory,
    ILogger<TeamInvitationService> logger) : ITeamInvitationService
{
    private static readonly HashSet<string> AllowedRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        RoleSeeder.Roles.Admin,
        RoleSeeder.Roles.Manager,
        RoleSeeder.Roles.Supervisor,
        RoleSeeder.Roles.Viewer,
        RoleSeeder.Roles.User,
    };

    public async Task<CreateInvitationResult> CreateInvitationAsync(CreateInvitationRequest request, CancellationToken ct = default)
    {
        // Validate email format
        if (!IsValidEmail(request.Email))
            throw new InvalidOperationException($"Invalid email address: {request.Email}");

        // Validate role
        if (!AllowedRoles.Contains(request.Role))
            throw new InvalidOperationException($"Invalid role: {request.Role}. Allowed: {string.Join(", ", AllowedRoles)}");

        // Validate message length
        if (request.Message is { Length: > 500 })
            throw new InvalidOperationException("Invitation message must be 500 characters or fewer");

        // Check if user already exists in this tenant
        var existingUser = await db.Users
            .FirstOrDefaultAsync(u => u.Email == request.Email && u.TenantId == tenantContext.TenantId, ct);

        if (existingUser is not null)
            throw new InvalidOperationException($"User with email {request.Email} already exists in this tenant");

        // Check for existing pending invitation (include soft-delete filter)
        var existingInvite = await db.Set<TeamInvitation>()
            .FirstOrDefaultAsync(i => i.Email == request.Email
                && i.CompanyId == request.CompanyId
                && i.Status == InvitationStatus.Pending, ct);

        if (existingInvite is not null)
            throw new InvalidOperationException($"A pending invitation already exists for {request.Email}");

        // Generate token: store hash, return plaintext for email link
        var (plaintextToken, tokenHash) = TeamInvitation.GenerateToken();

        var invitation = new TeamInvitation
        {
            TenantId = tenantContext.TenantId,
            Email = request.Email,
            Role = request.Role,
            CompanyId = request.CompanyId,
            TokenHash = tokenHash,
            Message = request.Message,
            InvitedBy = request.InvitedByName,
            CreatedBy = request.InvitedByUserId.ToString()
        };

        db.Set<TeamInvitation>().Add(invitation);
        await db.SaveChangesAsync(ct);

        // Send invitation email (with plaintext token for link)
        var company = await db.Set<Company>()
            .FirstOrDefaultAsync(c => c.Id == request.CompanyId && !c.IsDeleted, ct);

        _ = Task.Run(async () =>
        {
            using var scope = scopeFactory.CreateScope();
            var email = scope.ServiceProvider.GetRequiredService<IEmailService>();
            try
            {
                await email.SendInvitationEmailAsync(
                    request.Email,
                    request.InvitedByName,
                    company?.Name ?? "your company",
                    plaintextToken);
            }
            catch (Exception ex) { logger.LogError(ex, "Failed to send invitation email to {Email}", request.Email); }
        });

        logger.LogInformation("Created invitation {InvitationId} for {Email} to company {CompanyId}",
            invitation.Id, request.Email, request.CompanyId);

        return new CreateInvitationResult(invitation.Id, plaintextToken);
    }

    public async Task<List<CreateInvitationResult>> CreateBulkInvitationsAsync(List<CreateInvitationRequest> requests, CancellationToken ct = default)
    {
        var results = new List<CreateInvitationResult>();
        foreach (var request in requests)
        {
            try
            {
                var result = await CreateInvitationAsync(request, ct);
                results.Add(result);
            }
            catch (InvalidOperationException ex)
            {
                logger.LogWarning("Skipping invitation for {Email}: {Error}", request.Email, ex.Message);
            }
        }
        return results;
    }

    public async Task<TeamInvitationDto?> GetInvitationByTokenAsync(string token, CancellationToken ct = default)
    {
        var tokenHash = TeamInvitation.HashToken(token);

        var invitation = await db.Set<TeamInvitation>()
            .IgnoreQueryFilters()
            .Include(i => i.Company)
            .FirstOrDefaultAsync(i => i.TokenHash == tokenHash && !i.IsDeleted, ct);

        if (invitation is null) return null;

        // Get tenant name
        var tenant = await db.Set<Tenant>().FindAsync([invitation.TenantId], ct);

        return new TeamInvitationDto(
            Id: invitation.Id,
            Email: invitation.Email,
            Role: invitation.Role,
            CompanyId: invitation.CompanyId,
            CompanyName: invitation.Company?.Name ?? "",
            TenantName: tenant?.Name ?? "",
            TenantId: invitation.TenantId,
            Status: invitation.Status.ToString(),
            InvitedBy: invitation.InvitedBy,
            ExpiresAt: invitation.ExpiresAt,
            IsExpired: invitation.IsExpired,
            CanAccept: invitation.CanAccept,
            CreatedAt: invitation.CreatedAt);
    }

    public async Task<AcceptInvitationResult> AcceptInvitationAsync(string token, AcceptInvitationRequest request, CancellationToken ct = default)
    {
        var tokenHash = TeamInvitation.HashToken(token);

        var invitation = await db.Set<TeamInvitation>()
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(i => i.TokenHash == tokenHash && !i.IsDeleted, ct);

        if (invitation is null)
            return AcceptInvitationResult.Failed("Invitation not found", "NOT_FOUND");

        if (!invitation.CanAccept)
            return AcceptInvitationResult.Failed(
                invitation.IsExpired ? "Invitation has expired" : "Invitation is no longer valid",
                "INVALID_STATUS");

        // Normalize email from request inputs
        var normalizedFirstName = request.FirstName.Trim();
        var normalizedLastName = request.LastName.Trim();
        var normalizedEmail = invitation.Email.Trim().ToLowerInvariant();

        // Set tenant context for RLS
        await db.Database.ExecuteSqlRawAsync(
            "SELECT set_config('app.current_tenant', @p0, false)",
            invitation.TenantId.ToString());

        // Create user account
        var user = new AppUser
        {
            UserName = normalizedEmail,
            Email = normalizedEmail,
            FirstName = normalizedFirstName,
            LastName = normalizedLastName,
            TenantId = invitation.TenantId,
            EmailConfirmed = true, // Invitation implies email ownership
            Status = UserStatus.Active
        };

        var createResult = await userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
        {
            var errors = string.Join(", ", createResult.Errors.Select(e => e.Description));
            return AcceptInvitationResult.Failed($"Account creation failed: {errors}", "VALIDATION_ERROR");
        }

        // Assign role from invitation
        await roleSeeder.EnsureRolesForTenantAsync(invitation.TenantId, ct);
        await roleSeeder.AssignRoleToUserAsync(user, invitation.Role, ct);

        // Grant company access
        var access = new UserCompanyAccess
        {
            TenantId = invitation.TenantId,
            UserId = user.Id,
            CompanyId = invitation.CompanyId,
            CompanyRole = invitation.Role,
            IsDefault = true,
            CreatedBy = user.Id.ToString()
        };
        db.Set<UserCompanyAccess>().Add(access);

        // Generate refresh token so the new user can maintain their session
        var refreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);

        // Mark invitation as accepted
        invitation.Status = InvitationStatus.Accepted;
        invitation.AcceptedAt = DateTime.UtcNow;
        invitation.AcceptedByUserId = user.Id;

        await db.SaveChangesAsync(ct);

        // Get the assigned roles for the response
        var roles = await roleSeeder.GetUserRolesAsync(user);

        logger.LogInformation("Invitation {InvitationId} accepted by user {UserId} ({Email})",
            invitation.Id, user.Id, user.Email);

        return AcceptInvitationResult.Succeeded(new AcceptInvitationUserInfo(
            user.Id, user.FullName, user.Email!, invitation.TenantId,
            invitation.CompanyId, user.Type.ToString(), roles.ToArray()), refreshToken);
    }

    public async Task RevokeInvitationAsync(Guid invitationId, CancellationToken ct = default)
    {
        var invitation = await db.Set<TeamInvitation>()
            .FirstOrDefaultAsync(i => i.Id == invitationId, ct)
            ?? throw new InvalidOperationException("Invitation not found");

        if (invitation.Status != InvitationStatus.Pending)
            throw new InvalidOperationException("Only pending invitations can be revoked");

        invitation.Status = InvitationStatus.Revoked;
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Revoked invitation {InvitationId} for {Email}", invitationId, invitation.Email);
    }

    public async Task<List<TeamInvitationDto>> ListInvitationsAsync(Guid companyId, CancellationToken ct = default)
    {
        var invitations = await db.Set<TeamInvitation>()
            .Include(i => i.Company)
            .Where(i => i.CompanyId == companyId)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync(ct);

        return invitations.Select(i => new TeamInvitationDto(
            i.Id, i.Email, i.Role, i.CompanyId, i.Company?.Name ?? "",
            "", i.TenantId, i.Status.ToString(), i.InvitedBy,
            i.ExpiresAt, i.IsExpired, i.CanAccept, i.CreatedAt)).ToList();
    }

    public async Task ResendInvitationAsync(Guid invitationId, CancellationToken ct = default)
    {
        var invitation = await db.Set<TeamInvitation>()
            .Include(i => i.Company)
            .FirstOrDefaultAsync(i => i.Id == invitationId, ct)
            ?? throw new InvalidOperationException("Invitation not found");

        if (invitation.Status != InvitationStatus.Pending)
            throw new InvalidOperationException("Only pending invitations can be resent");

        // Generate new token, extend expiry
        var (plaintextToken, tokenHash) = TeamInvitation.GenerateToken();
        invitation.TokenHash = tokenHash;
        invitation.ExpiresAt = DateTime.UtcNow.AddDays(7);
        await db.SaveChangesAsync(ct);

        _ = Task.Run(async () =>
        {
            using var scope = scopeFactory.CreateScope();
            var email = scope.ServiceProvider.GetRequiredService<IEmailService>();
            try
            {
                await email.SendInvitationEmailAsync(
                    invitation.Email,
                    invitation.InvitedBy,
                    invitation.Company?.Name ?? "your company",
                    plaintextToken);
            }
            catch (Exception ex) { logger.LogError(ex, "Failed to resend invitation email to {Email}", invitation.Email); }
        });

        logger.LogInformation("Resent invitation {InvitationId} to {Email}", invitationId, invitation.Email);
    }

    private static bool IsValidEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email)) return false;
        return MailAddress.TryCreate(email.Trim(), out _);
    }
}

// DTOs and request/result records

public record CreateInvitationRequest(
    string Email,
    string Role,
    Guid CompanyId,
    string? Message,
    string InvitedByName,
    Guid InvitedByUserId);

public record CreateInvitationResult(Guid Id, string PlaintextToken);

public record AcceptInvitationRequest(
    string FirstName,
    string LastName,
    string Password);

/// <summary>
/// Returned after accepting an invitation, including the newly created user details.
/// </summary>
public record AcceptInvitationUserInfo(
    Guid UserId,
    string FullName,
    string Email,
    Guid TenantId,
    Guid CompanyId,
    string UserType,
    string[] Roles);

public record TeamInvitationDto(
    Guid Id,
    string Email,
    string Role,
    Guid CompanyId,
    string CompanyName,
    string TenantName,
    Guid TenantId,
    string Status,
    string InvitedBy,
    DateTime ExpiresAt,
    bool IsExpired,
    bool CanAccept,
    DateTime CreatedAt);

public class AcceptInvitationResult
{
    public bool IsSuccess { get; init; }
    public string? Error { get; init; }
    public string? ErrorCode { get; init; }
    public AcceptInvitationUserInfo? UserInfo { get; init; }
    public string? RefreshToken { get; init; }

    public static AcceptInvitationResult Succeeded(AcceptInvitationUserInfo userInfo, string refreshToken)
        => new() { IsSuccess = true, UserInfo = userInfo, RefreshToken = refreshToken };

    public static AcceptInvitationResult Failed(string error, string code)
        => new() { IsSuccess = false, Error = error, ErrorCode = code };
}
