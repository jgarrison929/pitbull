using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Billing.Features.LienWaivers;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Services;

public class VendorPortalService(PitbullDbContext db, ILogger<VendorPortalService> logger) : IVendorPortalService
{
    public async Task<Result<VendorPortalTokenDto>> GenerateTokenAsync(Guid vendorId, Guid projectId, int expirationDays, CancellationToken ct = default)
    {
        if (expirationDays < 1 || expirationDays > 365)
            return Result.Failure<VendorPortalTokenDto>("Expiration must be between 1 and 365 days", "VALIDATION_ERROR");

        var vendor = await db.Vendors.AsNoTracking()
            .FirstOrDefaultAsync(v => v.Id == vendorId, ct);
        if (vendor is null)
            return Result.Failure<VendorPortalTokenDto>("Vendor not found", "NOT_FOUND");

        var tokenBytes = RandomNumberGenerator.GetBytes(32);
        var tokenString = Convert.ToBase64String(tokenBytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');

        var portalToken = new VendorPortalToken
        {
            VendorId = vendorId,
            ProjectId = projectId,
            Token = tokenString,
            ExpiresAt = DateTime.UtcNow.AddDays(expirationDays),
            IsRevoked = false,
            AccessCount = 0
        };

        db.VendorPortalTokens.Add(portalToken);

        try
        {
            await db.SaveChangesAsync(ct);
            return Result.Success(MapToDto(portalToken, vendor.Name));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to generate vendor portal token for vendor {VendorId}", vendorId);
            return Result.Failure<VendorPortalTokenDto>("Failed to generate portal token", "DATABASE_ERROR");
        }
    }

    public async Task<Result<List<VendorPortalTokenSummaryDto>>> GetTokensForVendorAsync(Guid vendorId, CancellationToken ct = default)
    {
        var tokens = await db.VendorPortalTokens
            .AsNoTracking()
            .Include(t => t.Vendor)
            .Where(t => t.VendorId == vendorId)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(ct);

        return Result.Success(tokens.Select(t => MapToSummaryDto(t, t.Vendor?.Name ?? "")).ToList());
    }

    public async Task<Result> RevokeTokenAsync(Guid tokenId, CancellationToken ct = default)
    {
        var token = await db.VendorPortalTokens
            .FirstOrDefaultAsync(t => t.Id == tokenId, ct);

        if (token is null)
            return Result.Failure("Portal token not found", "NOT_FOUND");

        if (token.IsRevoked)
            return Result.Failure("Token is already revoked", "INVALID_STATUS");

        token.IsRevoked = true;

        try
        {
            await db.SaveChangesAsync(ct);
            return Result.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to revoke portal token {TokenId}", tokenId);
            return Result.Failure("Failed to revoke token", "DATABASE_ERROR");
        }
    }

    public async Task<Result<VendorPortalContextDto>> ValidateTokenAsync(string token, CancellationToken ct = default)
    {
        var portalToken = await db.VendorPortalTokens
            .Include(t => t.Vendor)
            .FirstOrDefaultAsync(t => t.Token == token, ct);

        if (portalToken is null)
            return Result.Failure<VendorPortalContextDto>("Invalid token", "INVALID_TOKEN");

        if (portalToken.IsRevoked)
            return Result.Failure<VendorPortalContextDto>("Token has been revoked", "TOKEN_REVOKED");

        if (portalToken.ExpiresAt < DateTime.UtcNow)
            return Result.Failure<VendorPortalContextDto>("Token has expired", "TOKEN_EXPIRED");

        // Update access tracking
        portalToken.LastAccessedAt = DateTime.UtcNow;
        portalToken.AccessCount++;
        await db.SaveChangesAsync(ct);

        var projectName = await db.Set<Pitbull.Projects.Domain.Project>()
            .AsNoTracking()
            .Where(p => p.Id == portalToken.ProjectId)
            .Select(p => p.Name)
            .FirstOrDefaultAsync(ct) ?? "Unknown Project";

        var companyName = await db.Companies
            .AsNoTracking()
            .Where(c => c.Id == portalToken.CompanyId)
            .Select(c => c.Name)
            .FirstOrDefaultAsync(ct) ?? "Unknown Company";

        return Result.Success(new VendorPortalContextDto(
            VendorId: portalToken.VendorId,
            VendorName: portalToken.Vendor?.Name ?? "",
            ProjectId: portalToken.ProjectId,
            ProjectName: projectName,
            CompanyName: companyName));
    }

    public async Task<Result<List<VendorPortalLienWaiverDto>>> GetLienWaiversAsync(string token, CancellationToken ct = default)
    {
        var validation = await ValidateTokenInternalAsync(token, ct);
        if (!validation.IsSuccess)
            return Result.Failure<List<VendorPortalLienWaiverDto>>(validation.Error!, validation.ErrorCode);

        var portalToken = validation.Value!;

        var waivers = await db.LienWaivers
            .AsNoTracking()
            .Where(w => w.VendorId == portalToken.VendorId && w.ProjectId == portalToken.ProjectId)
            .OrderByDescending(w => w.ThroughDate)
            .ThenByDescending(w => w.CreatedAt)
            .ToListAsync(ct);

        return Result.Success(waivers.Select(MapToPortalLienWaiverDto).ToList());
    }

    public async Task<Result<VendorPortalLienWaiverDto>> SubmitLienWaiverAsync(string token, SubmitLienWaiverDto dto, CancellationToken ct = default)
    {
        var validation = await ValidateTokenInternalAsync(token, ct);
        if (!validation.IsSuccess)
            return Result.Failure<VendorPortalLienWaiverDto>(validation.Error!, validation.ErrorCode);

        var portalToken = validation.Value!;

        if (dto.Amount <= 0)
            return Result.Failure<VendorPortalLienWaiverDto>("Amount must be positive", "VALIDATION_ERROR");

        var waiver = new LienWaiver
        {
            ProjectId = portalToken.ProjectId,
            VendorId = portalToken.VendorId,
            CompanyId = portalToken.CompanyId,
            WaiverType = dto.WaiverType,
            Amount = dto.Amount,
            ThroughDate = dto.ThroughDate,
            Description = dto.Description,
            Status = LienWaiverStatus.Received
        };

        db.LienWaivers.Add(waiver);

        try
        {
            await db.SaveChangesAsync(ct);
            return Result.Success(MapToPortalLienWaiverDto(waiver));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to submit lien waiver via portal for vendor {VendorId}", portalToken.VendorId);
            return Result.Failure<VendorPortalLienWaiverDto>("Failed to submit lien waiver", "DATABASE_ERROR");
        }
    }

    public async Task<Result<List<PaymentHistoryDto>>> GetPaymentHistoryAsync(string token, CancellationToken ct = default)
    {
        var validation = await ValidateTokenInternalAsync(token, ct);
        if (!validation.IsSuccess)
            return Result.Failure<List<PaymentHistoryDto>>(validation.Error!, validation.ErrorCode);

        var portalToken = validation.Value!;

        var waivers = await db.LienWaivers
            .AsNoTracking()
            .Where(w => w.VendorId == portalToken.VendorId
                     && w.ProjectId == portalToken.ProjectId
                     && w.Status == LienWaiverStatus.Approved)
            .OrderByDescending(w => w.ThroughDate)
            .ToListAsync(ct);

        return Result.Success(waivers.Select(w => new PaymentHistoryDto(
            Id: w.Id,
            Amount: w.Amount,
            ThroughDate: w.ThroughDate,
            Status: w.Status,
            CreatedAt: w.CreatedAt)).ToList());
    }

    private async Task<Result<VendorPortalToken>> ValidateTokenInternalAsync(string token, CancellationToken ct)
    {
        var portalToken = await db.VendorPortalTokens
            .FirstOrDefaultAsync(t => t.Token == token, ct);

        if (portalToken is null)
            return Result.Failure<VendorPortalToken>("Invalid token", "INVALID_TOKEN");

        if (portalToken.IsRevoked)
            return Result.Failure<VendorPortalToken>("Token has been revoked", "TOKEN_REVOKED");

        if (portalToken.ExpiresAt < DateTime.UtcNow)
            return Result.Failure<VendorPortalToken>("Token has expired", "TOKEN_EXPIRED");

        // Update access tracking
        portalToken.LastAccessedAt = DateTime.UtcNow;
        portalToken.AccessCount++;
        await db.SaveChangesAsync(ct);

        return Result.Success(portalToken);
    }

    private static VendorPortalTokenDto MapToDto(VendorPortalToken t, string vendorName) => new(
        Id: t.Id,
        VendorId: t.VendorId,
        VendorName: vendorName,
        ProjectId: t.ProjectId,
        Token: t.Token,
        ExpiresAt: t.ExpiresAt,
        IsRevoked: t.IsRevoked,
        LastAccessedAt: t.LastAccessedAt,
        AccessCount: t.AccessCount,
        CreatedAt: t.CreatedAt);

    private static VendorPortalTokenSummaryDto MapToSummaryDto(VendorPortalToken t, string vendorName) => new(
        Id: t.Id,
        VendorId: t.VendorId,
        VendorName: vendorName,
        ProjectId: t.ProjectId,
        TokenHint: t.Token.Length > 4 ? $"***{t.Token[^4..]}" : "***",
        ExpiresAt: t.ExpiresAt,
        IsRevoked: t.IsRevoked,
        LastAccessedAt: t.LastAccessedAt,
        AccessCount: t.AccessCount,
        CreatedAt: t.CreatedAt);

    private static VendorPortalLienWaiverDto MapToPortalLienWaiverDto(LienWaiver w) => new(
        Id: w.Id,
        ProjectId: w.ProjectId,
        WaiverType: w.WaiverType,
        Amount: w.Amount,
        ThroughDate: w.ThroughDate,
        Status: w.Status,
        Description: w.Description,
        CreatedAt: w.CreatedAt,
        UpdatedAt: w.UpdatedAt);
}
