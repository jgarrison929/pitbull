using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Pitbull.Api.Extensions;
using Pitbull.Api.Infrastructure;
using Pitbull.Api.Services;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Team invitation management: send, accept, revoke, list invitations.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
public class InvitationController(
    ITeamInvitationService invitationService,
    IOnboardingService onboardingService,
    ICompanyContext companyContext,
    IConfiguration configuration) : ControllerBase
{
    private static readonly HashSet<string> AllowedRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        RoleSeeder.Roles.Admin,
        RoleSeeder.Roles.Manager,
        RoleSeeder.Roles.Supervisor,
        RoleSeeder.Roles.Viewer,
        RoleSeeder.Roles.User,
    };

    /// <summary>
    /// Send a team invitation to an email address.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(typeof(TeamInvitationDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SendInvitation([FromBody] SendInvitationRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null) return this.UnauthorizedError();
        if (!companyContext.IsResolved) return this.BadRequestError("Company context required");

        if (string.IsNullOrWhiteSpace(request.Email))
            return this.BadRequestError("Email is required");

        // Validate email format
        if (!System.Net.Mail.MailAddress.TryCreate(request.Email.Trim(), out _))
            return this.BadRequestError("Invalid email format");

        // Validate role if provided
        if (request.Role is not null && !AllowedRoles.Contains(request.Role))
            return this.BadRequestError($"Invalid role. Allowed: {string.Join(", ", AllowedRoles)}");

        // Validate message length
        if (request.Message is { Length: > 500 })
            return this.BadRequestError("Message must be 500 characters or fewer");

        var userName = User.FindFirst("full_name")?.Value ?? "A team member";

        try
        {
            var result = await invitationService.CreateInvitationAsync(new CreateInvitationRequest(
                Email: request.Email.Trim().ToLowerInvariant(),
                Role: request.Role ?? RoleSeeder.Roles.Viewer,
                CompanyId: companyContext.CompanyId,
                Message: request.Message,
                InvitedByName: userName,
                InvitedByUserId: userId.Value), ct);

            var dto = await invitationService.GetInvitationByTokenAsync(result.PlaintextToken, ct);
            return Created($"/api/invitation/{result.Id}", dto);
        }
        catch (InvalidOperationException ex)
        {
            return this.BadRequestError(ex.Message);
        }
    }

    /// <summary>
    /// Send multiple invitations at once.
    /// </summary>
    [HttpPost("bulk")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(typeof(BulkInvitationResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> SendBulkInvitations([FromBody] BulkInvitationRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null) return this.UnauthorizedError();
        if (!companyContext.IsResolved) return this.BadRequestError("Company context required");

        if (request.Invitations.Count == 0)
            return this.BadRequestError("At least one invitation is required");

        if (request.Invitations.Count > 20)
            return this.BadRequestError("Maximum 20 invitations per batch");

        // Validate message length
        if (request.Message is { Length: > 500 })
            return this.BadRequestError("Message must be 500 characters or fewer");

        // Validate all emails and roles up front
        foreach (var inv in request.Invitations)
        {
            if (string.IsNullOrWhiteSpace(inv.Email) || !System.Net.Mail.MailAddress.TryCreate(inv.Email.Trim(), out _))
                return this.BadRequestError($"Invalid email format: {inv.Email}");
            if (inv.Role is not null && !AllowedRoles.Contains(inv.Role))
                return this.BadRequestError($"Invalid role: {inv.Role}. Allowed: {string.Join(", ", AllowedRoles)}");
        }

        var userName = User.FindFirst("full_name")?.Value ?? "A team member";

        var requests = request.Invitations.Select(i => new CreateInvitationRequest(
            Email: i.Email.Trim().ToLowerInvariant(),
            Role: i.Role ?? RoleSeeder.Roles.Viewer,
            CompanyId: companyContext.CompanyId,
            Message: request.Message,
            InvitedByName: userName,
            InvitedByUserId: userId.Value)).ToList();

        var created = await invitationService.CreateBulkInvitationsAsync(requests, ct);

        // Mark team invited in onboarding checklist
        try
        {
            await onboardingService.UpdateChecklistItemAsync(userId.Value, companyContext.CompanyId, "team_invited", true, ct);
        }
        catch
        {
            // Non-critical — don't fail the invitation if checklist update fails
        }

        return Ok(new BulkInvitationResponse(
            Sent: created.Count,
            Total: request.Invitations.Count));
    }

    /// <summary>
    /// List all invitations for the current company.
    /// </summary>
    [HttpGet]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(typeof(List<TeamInvitationDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListInvitations(CancellationToken ct)
    {
        if (!companyContext.IsResolved) return this.BadRequestError("Company context required");

        var invitations = await invitationService.ListInvitationsAsync(companyContext.CompanyId, ct);
        return Ok(invitations);
    }

    /// <summary>
    /// Revoke a pending invitation.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> RevokeInvitation(Guid id, CancellationToken ct)
    {
        try
        {
            await invitationService.RevokeInvitationAsync(id, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return this.BadRequestError(ex.Message);
        }
    }

    /// <summary>
    /// Resend a pending invitation (extends expiry and generates new token).
    /// </summary>
    [HttpPost("{id:guid}/resend")]
    [Authorize(Roles = "Admin,Manager")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ResendInvitation(Guid id, CancellationToken ct)
    {
        try
        {
            await invitationService.ResendInvitationAsync(id, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return this.BadRequestError(ex.Message);
        }
    }

    // ── Public endpoints (invited user accepts) ──

    /// <summary>
    /// Get invitation details by token (public — used on the accept invitation page).
    /// </summary>
    [HttpGet("token/{token}")]
    [AllowAnonymous]
    [EnableRateLimiting("api")]
    [ProducesResponseType(typeof(TeamInvitationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetInvitationByToken(string token, CancellationToken ct)
    {
        var invitation = await invitationService.GetInvitationByTokenAsync(token, ct);
        if (invitation is null)
            return this.NotFoundError("Invitation not found");

        return Ok(invitation);
    }

    /// <summary>
    /// Accept an invitation by creating an account and joining the company.
    /// Returns a JWT token for immediate login.
    /// </summary>
    [HttpPost("token/{token}/accept")]
    [AllowAnonymous]
    [EnableRateLimiting("register")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AcceptInvitation(string token, [FromBody] AcceptInvitationRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.FirstName) || string.IsNullOrWhiteSpace(request.LastName))
            return this.BadRequestError("First name and last name are required");

        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
            return this.BadRequestError("Password must be at least 8 characters");

        var result = await invitationService.AcceptInvitationAsync(token, request, ct);

        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => this.NotFoundError(result.Error!),
                _ => this.BadRequestError(result.Error!)
            };
        }

        var user = result.UserInfo!;
        var jwtToken = GenerateJwtToken(user);

        return Ok(new AuthResponse(jwtToken, user.UserId, user.FullName, user.Email, user.Roles, result.RefreshToken));
    }

    private string GenerateJwtToken(AcceptInvitationUserInfo user)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(configuration["Jwt:Key"]!));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.UserId.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new("tenant_id", user.TenantId.ToString()),
            new("full_name", user.FullName),
            new("user_type", user.UserType),
        };

        foreach (var role in user.Roles)
            claims.Add(new Claim(ClaimTypes.Role, role));

        var expiration = int.Parse(configuration["Jwt:ExpirationMinutes"] ?? "60");

        var token = new JwtSecurityToken(
            issuer: configuration["Jwt:Issuer"],
            audience: configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiration),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private Guid? GetUserId()
    {
        var id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        return Guid.TryParse(id, out var guid) ? guid : null;
    }
}

// Request DTOs

public record SendInvitationRequest(
    string Email,
    string? Role = null,
    string? Message = null);

public record BulkInvitationRequest(
    List<InvitationItem> Invitations,
    string? Message = null);

public record InvitationItem(
    string Email,
    string? Role = null);

public record BulkInvitationResponse(
    int Sent,
    int Total);
