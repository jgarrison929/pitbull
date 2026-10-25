using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Api.Features.CostPredictions;

public interface ICostToCompleteService
{
    Task<CostToCompleteResult> PredictAsync(Guid projectId, CancellationToken ct);
}

public sealed class CostToCompleteService(
    PitbullDbContext db,
    ICompanyContext companyContext,
    ILogger<CostToCompleteService> logger) : ICostToCompleteService
{
    private const decimal WarningThreshold = 1.05m; // 5% over budget

    public async Task<CostToCompleteResult> PredictAsync(Guid projectId, CancellationToken ct)
    {
        var project = await db.Set<Project>()
            .AsNoTracking()
            .Where(p => p.Id == projectId)
            .Select(p => new { p.Name, p.StartDate, p.EstimatedCompletionDate, p.CreatedAt })
            .FirstOrDefaultAsync(ct)
            ?? throw new ArgumentException("Project not found.");

        // Per-cost-code budgets
        var budgets = await db.Set<PmJobCostBudget>()
            .AsNoTracking()
            .Where(b => b.ProjectId == projectId && b.CompanyId == companyContext.CompanyId)
            .ToListAsync(ct);

        if (budgets.Count == 0)
            throw new InvalidOperationException("No job cost budgets found for this project. Set up budgets before generating predictions.");

        // All approved time entries for this project, grouped by cost code + date
        var timeEntries = await db.Set<TimeEntry>()
            .AsNoTracking()
            .Where(te => te.ProjectId == projectId && te.Status == TimeEntryStatus.Approved)
            .Select(te => new
            {
                te.CostCodeId,
                te.Date,
                te.RegularHours,
                te.OvertimeHours,
                te.DoubletimeHours,
                te.Employee.BaseHourlyRate
            })
            .ToListAsync(ct);

        // Cost code lookup
        var costCodeIds = budgets.Select(b => b.CostCodeId).Distinct().ToList();
        var costCodes = await db.Set<CostCode>()
            .AsNoTracking()
            .Where(cc => costCodeIds.Contains(cc.Id))
            .ToDictionaryAsync(cc => cc.Id, cc => cc, ct);

        var projectStart = project.StartDate ?? project.CreatedAt;
        var projectEnd = project.EstimatedCompletionDate ?? DateTime.UtcNow.AddDays(180);
        var totalProjectDays = Math.Max(1, (int)(projectEnd - projectStart).TotalDays);
        var daysElapsed = Math.Max(1, (int)(DateTime.UtcNow - projectStart).TotalDays);
        var daysRemaining = Math.Max(0, (int)(projectEnd - DateTime.UtcNow).TotalDays);

        // Group time entries by cost code → daily totals
        var entriesByCostCode = timeEntries
            .GroupBy(te => te.CostCodeId)
            .ToDictionary(
                g => g.Key,
                g => g.GroupBy(te => te.Date)
                    .Select(dg => new DailySpend(
                        dg.Key,
                        dg.Sum(te =>
                            te.RegularHours * te.BaseHourlyRate
                            + te.OvertimeHours * te.BaseHourlyRate * 1.5m
                            + te.DoubletimeHours * te.BaseHourlyRate * 2.0m)))
                    .OrderBy(ds => ds.Date)
                    .ToList());

        var costCodePredictions = new List<CostCodePredictionDto>();

        foreach (var budget in budgets)
        {
            var cc = costCodes.GetValueOrDefault(budget.CostCodeId);
            var dailySpends = entriesByCostCode.GetValueOrDefault(budget.CostCodeId, []);

            var prediction = PredictCostCode(
                budget,
                dailySpends,
                cc?.Code ?? "Unknown",
                cc?.Description ?? "Unknown",
                projectStart,
                totalProjectDays,
                daysRemaining);

            costCodePredictions.Add(prediction);
        }

        var totalBudget = costCodePredictions.Sum(p => p.Budget);
        var totalActual = costCodePredictions.Sum(p => p.ActualCost);
        var totalEac = costCodePredictions.Sum(p => p.PredictedEac);
        var overallVariance = totalEac - totalBudget;
        var warningCount = costCodePredictions.Count(p => p.IsWarning);

        // Weighted confidence by budget proportion
        var overallConfidence = totalBudget > 0
            ? costCodePredictions.Sum(p => p.Confidence * (p.Budget / totalBudget))
            : 0m;

        var health = DetermineHealth(overallVariance, totalBudget, warningCount, costCodePredictions.Count);

        logger.LogInformation(
            "Generated cost-to-complete for project {ProjectId}: EAC {EAC:C}, {Warnings} warnings, health {Health}",
            projectId, totalEac, warningCount, health);

        return new CostToCompleteResult(
            projectId,
            project.Name,
            health,
            Math.Round(totalBudget, 2),
            Math.Round(totalActual, 2),
            Math.Round(totalEac, 2),
            Math.Round(overallVariance, 2),
            Math.Round(overallConfidence, 4),
            warningCount,
            costCodePredictions.OrderByDescending(p => p.IsWarning)
                .ThenByDescending(p => Math.Abs(p.VariancePercent))
                .ToList(),
            DateTime.UtcNow);
    }

    internal static CostCodePredictionDto PredictCostCode(
        PmJobCostBudget budget,
        List<DailySpend> dailySpends,
        string costCodeCode,
        string costCodeDescription,
        DateTime projectStart,
        int totalProjectDays,
        int daysRemaining)
    {
        var currentBudget = budget.CurrentBudget;
        var actualCost = dailySpends.Sum(ds => ds.Amount);

        if (dailySpends.Count < 2)
        {
            // Not enough data for regression — use simple proportion
            var predictedEac = currentBudget > 0 ? currentBudget : actualCost;
            return new CostCodePredictionDto(
                budget.CostCodeId,
                costCodeCode,
                costCodeDescription,
                Math.Round(currentBudget, 2),
                Math.Round(actualCost, 2),
                Math.Round(predictedEac, 2),
                Math.Round(predictedEac - currentBudget, 2),
                currentBudget > 0 ? Math.Round((predictedEac - currentBudget) / currentBudget, 4) : 0m,
                0m, // No confidence with < 2 data points
                "flat",
                0m,
                null,
                false);
        }

        // Build cumulative spend series: x = days since project start, y = cumulative cost
        var cumulativeSeries = BuildCumulativeSeries(dailySpends, projectStart);
        var regression = LinearRegression(cumulativeSeries);

        // Project EAC = regression value at totalProjectDays
        var predictedEacReg = regression.Intercept + regression.Slope * totalProjectDays;

        // Clamp: EAC can't be less than actual cost already incurred
        predictedEacReg = Math.Max(predictedEacReg, actualCost);

        var variance = predictedEacReg - currentBudget;
        var variancePercent = currentBudget > 0
            ? (predictedEacReg - currentBudget) / currentBudget
            : 0m;

        var dailyBurnRate = regression.Slope;
        var trendDirection = dailyBurnRate > 0.01m ? "up" : dailyBurnRate < -0.01m ? "down" : "flat";

        int? daysUntilExhaustion = null;
        if (dailyBurnRate > 0 && currentBudget > actualCost)
        {
            daysUntilExhaustion = (int)((currentBudget - actualCost) / dailyBurnRate);
        }

        var isWarning = currentBudget > 0 && predictedEacReg > currentBudget * WarningThreshold;
        // Penalize confidence for small samples: scale by min(1, n/10)
        var samplePenalty = Math.Min(1m, (decimal)dailySpends.Count / 10m);
        var confidence = Math.Clamp(regression.RSquared * samplePenalty, 0m, 0.99m);

        return new CostCodePredictionDto(
            budget.CostCodeId,
            costCodeCode,
            costCodeDescription,
            Math.Round(currentBudget, 2),
            Math.Round(actualCost, 2),
            Math.Round(predictedEacReg, 2),
            Math.Round(variance, 2),
            Math.Round(variancePercent, 4),
            Math.Round(confidence, 4),
            trendDirection,
            Math.Round(dailyBurnRate, 2),
            daysUntilExhaustion,
            isWarning);
    }

    internal static List<(decimal X, decimal Y)> BuildCumulativeSeries(
        List<DailySpend> dailySpends, DateTime projectStart)
    {
        var result = new List<(decimal X, decimal Y)>();
        var cumulative = 0m;

        foreach (var ds in dailySpends.OrderBy(d => d.Date))
        {
            cumulative += ds.Amount;
            var dayIndex = (decimal)(ds.Date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc) - projectStart).TotalDays;
            result.Add((dayIndex, cumulative));
        }

        return result;
    }

    internal static RegressionResult LinearRegression(List<(decimal X, decimal Y)> points)
    {
        var n = points.Count;
        if (n < 2)
            return new RegressionResult(0m, 0m, 0m);

        var sumX = points.Sum(p => p.X);
        var sumY = points.Sum(p => p.Y);
        var sumXY = points.Sum(p => p.X * p.Y);
        var sumX2 = points.Sum(p => p.X * p.X);

        var denominator = n * sumX2 - sumX * sumX;
        if (denominator == 0)
            return new RegressionResult(0m, sumY / n, 0m);

        var slope = (n * sumXY - sumX * sumY) / denominator;
        var intercept = (sumY - slope * sumX) / n;

        // R² calculation
        var meanY = sumY / n;
        var ssTot = points.Sum(p => (p.Y - meanY) * (p.Y - meanY));
        var ssRes = points.Sum(p =>
        {
            var predicted = intercept + slope * p.X;
            return (p.Y - predicted) * (p.Y - predicted);
        });

        var rSquared = ssTot > 0 ? 1m - ssRes / ssTot : 0m;

        return new RegressionResult(slope, intercept, Math.Max(0m, rSquared));
    }

    internal static string DetermineHealth(decimal overallVariance, decimal totalBudget, int warningCount, int totalCostCodes)
    {
        // No budget set but money being spent = risk
        if (totalBudget == 0) return overallVariance > 0 ? "Yellow" : "Green";

        var variancePercent = Math.Abs(overallVariance) / totalBudget;
        var warningRatio = totalCostCodes > 0 ? (decimal)warningCount / totalCostCodes : 0m;

        if (overallVariance > 0 && (variancePercent > 0.10m || warningRatio > 0.50m))
            return "Red";
        if (overallVariance > 0 && (variancePercent > 0.03m || warningRatio > 0.20m))
            return "Yellow";
        return "Green";
    }

    internal sealed record DailySpend(DateOnly Date, decimal Amount);
    internal sealed record RegressionResult(decimal Slope, decimal Intercept, decimal RSquared);
}
