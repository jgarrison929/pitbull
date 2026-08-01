using Microsoft.EntityFrameworkCore;
using Pitbull.AI.Domain;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.AI.Services;

public class AiUsageService(
    PitbullDbContext db,
    ITenantContext tenantContext) : IAiUsageService
{
    /// <summary>Max inclusive calendar span for usage queries (avoids multi-year full-table scans).</summary>
    private const int MaxRangeDays = 366;

    private const int MaxProviderLength = 100;
    private const int MaxModelLength = 200;
    private const int MaxFeatureLength = 200;

    public async Task LogUsageAsync(Guid userId, string provider, string model, int tokensIn, int tokensOut,
                                    decimal estimatedCost, string? feature, int durationMs, decimal confidenceScore = 0m,
                                    CancellationToken ct = default, Guid? companyId = null)
    {
        var record = new AiUsageRecord
        {
            Id = Guid.NewGuid(),
            TenantId = tenantContext.TenantId,
            UserId = userId,
            CompanyId = companyId,
            Provider = Truncate(provider, MaxProviderLength),
            Model = Truncate(model, MaxModelLength),
            TokensIn = Math.Max(0, tokensIn),
            TokensOut = Math.Max(0, tokensOut),
            EstimatedCost = estimatedCost < 0 ? 0 : estimatedCost,
            Feature = feature is null ? null : Truncate(feature, MaxFeatureLength),
            DurationMs = Math.Max(0, durationMs),
            ConfidenceScore = confidenceScore < 0 ? 0 : confidenceScore > 1 ? 1 : confidenceScore,
            RequestedAt = DateTime.UtcNow
        };

        db.Set<AiUsageRecord>().Add(record);
        await db.SaveChangesAsync(ct);
    }

    public async Task<int> GetCompanyRequestCountAsync(Guid companyId, DateOnly from, DateOnly to, CancellationToken ct = default)
    {
        (from, to) = ClampRange(from, to);
        var fromDate = from.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var toDate = to.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        return await db.Set<AiUsageRecord>()
            .AsNoTracking()
            .CountAsync(
                r => r.CompanyId == companyId && r.RequestedAt >= fromDate && r.RequestedAt < toDate,
                ct);
    }

    public async Task<AiUsageSummaryDto> GetUsageSummaryAsync(DateOnly from, DateOnly to, CancellationToken ct = default)
    {
        (from, to) = ClampRange(from, to);
        var fromDate = from.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var toDate = to.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var summary = await db.Set<AiUsageRecord>()
            .AsNoTracking()
            .Where(r => r.RequestedAt >= fromDate && r.RequestedAt < toDate)
            .GroupBy(_ => 1)
            .Select(g => new AiUsageSummaryDto(
                g.Count(),
                g.Sum(r => r.TokensIn),
                g.Sum(r => r.TokensOut),
                g.Sum(r => r.EstimatedCost)))
            .FirstOrDefaultAsync(ct);

        return summary ?? new AiUsageSummaryDto(0, 0, 0, 0m);
    }

    public async Task<List<AiUsageByUserDto>> GetUsageByUserAsync(DateOnly from, DateOnly to, CancellationToken ct = default)
    {
        (from, to) = ClampRange(from, to);
        var fromDate = from.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var toDate = to.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var usageByUser = await db.Set<AiUsageRecord>()
            .AsNoTracking()
            .Where(r => r.RequestedAt >= fromDate && r.RequestedAt < toDate)
            .GroupBy(r => r.UserId)
            .Select(g => new
            {
                UserId = g.Key,
                RequestCount = g.Count(),
                TotalTokens = g.Sum(r => r.TokensIn + r.TokensOut),
                TotalCost = g.Sum(r => r.EstimatedCost)
            })
            .ToListAsync(ct);

        var userIds = usageByUser.Select(u => u.UserId).ToList();
        var users = await db.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.FirstName, u.LastName })
            .ToListAsync(ct);

        var userLookup = users.ToDictionary(u => u.Id, u => $"{u.FirstName} {u.LastName}".Trim());

        return usageByUser
            .Select(u => new AiUsageByUserDto(
                u.UserId,
                userLookup.GetValueOrDefault(u.UserId, "Unknown"),
                u.RequestCount,
                u.TotalTokens,
                u.TotalCost))
            .OrderByDescending(u => u.TotalCost)
            .ToList();
    }

    public async Task<List<AiUsageByProviderDto>> GetUsageByProviderAsync(DateOnly from, DateOnly to, CancellationToken ct = default)
    {
        (from, to) = ClampRange(from, to);
        var fromDate = from.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var toDate = to.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        return await db.Set<AiUsageRecord>()
            .AsNoTracking()
            .Where(r => r.RequestedAt >= fromDate && r.RequestedAt < toDate)
            .GroupBy(r => r.Provider)
            .Select(g => new AiUsageByProviderDto(
                g.Key,
                g.Count(),
                g.Sum(r => r.TokensIn),
                g.Sum(r => r.TokensOut),
                g.Sum(r => r.EstimatedCost)))
            .OrderByDescending(p => p.TotalCost)
            .ToListAsync(ct);
    }

    public async Task<List<AiDailyUsageDto>> GetDailyUsageAsync(DateOnly from, DateOnly to, CancellationToken ct = default)
    {
        (from, to) = ClampRange(from, to);
        var fromDate = from.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var toDate = to.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        return await db.Set<AiUsageRecord>()
            .AsNoTracking()
            .Where(r => r.RequestedAt >= fromDate && r.RequestedAt < toDate)
            .GroupBy(r => r.RequestedAt.Date)
            .Select(g => new AiDailyUsageDto(
                DateOnly.FromDateTime(g.Key),
                g.Count(),
                g.Sum(r => r.TokensIn + r.TokensOut),
                g.Sum(r => r.EstimatedCost)))
            .OrderBy(d => d.Date)
            .ToListAsync(ct);
    }

    /// <summary>
    /// Normalize inverted ranges and cap span to <see cref="MaxRangeDays"/> (from kept, to pulled in).
    /// </summary>
    public static (DateOnly From, DateOnly To) ClampRange(DateOnly from, DateOnly to)
    {
        if (to < from)
            (from, to) = (to, from);

        var maxTo = from.AddDays(MaxRangeDays - 1);
        if (to > maxTo)
            to = maxTo;

        return (from, to);
    }

    private static string Truncate(string value, int maxLength)
    {
        var trimmed = value.Trim();
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }
}
