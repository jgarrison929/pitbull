using Pitbull.Billing.Features.LienWaivers;
using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Services;

public interface IVendorPortalService
{
    // Admin operations (authorized)
    Task<Result<VendorPortalTokenDto>> GenerateTokenAsync(Guid vendorId, Guid projectId, int expirationDays, CancellationToken ct = default);
    Task<Result<List<VendorPortalTokenSummaryDto>>> GetTokensForVendorAsync(Guid vendorId, CancellationToken ct = default);
    Task<Result> RevokeTokenAsync(Guid tokenId, CancellationToken ct = default);

    // Portal operations (public, token-based)
    Task<Result<VendorPortalContextDto>> ValidateTokenAsync(string token, CancellationToken ct = default);
    Task<Result<List<VendorPortalLienWaiverDto>>> GetLienWaiversAsync(string token, CancellationToken ct = default);
    Task<Result<VendorPortalLienWaiverDto>> SubmitLienWaiverAsync(string token, SubmitLienWaiverDto dto, CancellationToken ct = default);
    Task<Result<List<PaymentHistoryDto>>> GetPaymentHistoryAsync(string token, CancellationToken ct = default);
}

/// <summary>
/// Full token DTO returned only at generation time (the only time the full token is shown).
/// </summary>
public record VendorPortalTokenDto(
    Guid Id,
    Guid VendorId,
    string VendorName,
    Guid ProjectId,
    string Token,
    DateTime ExpiresAt,
    bool IsRevoked,
    DateTime? LastAccessedAt,
    int AccessCount,
    DateTime CreatedAt);

/// <summary>
/// Summary DTO for token listing — full token is masked to prevent exposure.
/// </summary>
public record VendorPortalTokenSummaryDto(
    Guid Id,
    Guid VendorId,
    string VendorName,
    Guid ProjectId,
    string TokenHint,
    DateTime ExpiresAt,
    bool IsRevoked,
    DateTime? LastAccessedAt,
    int AccessCount,
    DateTime CreatedAt);

public record VendorPortalContextDto(
    Guid VendorId,
    string VendorName,
    Guid ProjectId,
    string ProjectName,
    string CompanyName);

public record SubmitLienWaiverDto(
    LienWaiverType WaiverType,
    decimal Amount,
    DateOnly ThroughDate,
    string? Description);

public record PaymentHistoryDto(
    Guid Id,
    decimal Amount,
    DateOnly ThroughDate,
    LienWaiverStatus Status,
    DateTime CreatedAt);

/// <summary>
/// Lien waiver DTO for the public vendor portal — omits internal review details.
/// </summary>
public record VendorPortalLienWaiverDto(
    Guid Id,
    Guid ProjectId,
    LienWaiverType WaiverType,
    decimal Amount,
    DateOnly ThroughDate,
    LienWaiverStatus Status,
    string? Description,
    DateTime CreatedAt,
    DateTime? UpdatedAt);
