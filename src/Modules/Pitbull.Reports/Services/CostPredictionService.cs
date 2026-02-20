using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Projects.Domain;
using Pitbull.Reports.DTOs;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Reports.Services;

public interface ICostPredictionService
{
    Task<CostPredictionDto?> GetLatestPredictionAsync(Guid projectId, CancellationToken ct);
    Task<List<CostPredictionDto>> GetPredictionHistoryAsync(Guid projectId, CancellationToken ct);
    Task<CostPredictionDto> GeneratePredictionAsync(Guid projectId, CancellationToken ct);
}

public sealed class CostPredictionService(
    PitbullDbContext db,
    ITenantContext tenantContext,
    ICompanyContext companyContext,
    ILogger<CostPredictionService> logger) : ICostPredictionService
{
    public async Task<CostPredictionDto?> GetLatestPredictionAsync(Guid projectId, CancellationToken ct)
    {
        var prediction = await db.CostPredictions
            .AsNoTracking()
            .Where(cp => cp.ProjectId == projectId && cp.CompanyId == companyContext.CompanyId)
            .OrderByDescending(cp => cp.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (prediction is null)
            return null;

        var projectName = await db.Set<Project>()
            .AsNoTracking()
            .Where(p => p.Id == projectId)
            .Select(p => p.Name)
            .FirstOrDefaultAsync(ct) ?? "Unknown";

        return MapToDto(prediction, projectName);
    }

    public async Task<List<CostPredictionDto>> GetPredictionHistoryAsync(Guid projectId, CancellationToken ct)
    {
        var projectName = await db.Set<Project>()
            .AsNoTracking()
            .Where(p => p.Id == projectId)
            .Select(p => p.Name)
            .FirstOrDefaultAsync(ct) ?? "Unknown";

        var predictions = await db.CostPredictions
            .AsNoTracking()
            .Where(cp => cp.ProjectId == projectId && cp.CompanyId == companyContext.CompanyId)
            .OrderByDescending(cp => cp.CreatedAt)
            .ToListAsync(ct);

        return predictions.Select(p => MapToDto(p, projectName)).ToList();
    }

    public async Task<CostPredictionDto> GeneratePredictionAsync(Guid projectId, CancellationToken ct)
    {
        var project = await db.Set<Project>()
            .AsNoTracking()
            .Where(p => p.Id == projectId)
            .FirstOrDefaultAsync(ct)
            ?? throw new ArgumentException("Project not found.");

        var budgetAtCompletion = project.OriginalBudget ?? project.ContractAmount;

        // Get approved time entries to calculate labor cost to date
        var timeEntryData = await db.Set<TimeEntry>()
            .AsNoTracking()
            .Where(te => te.ProjectId == projectId && te.Status == TimeEntryStatus.Approved)
            .Select(te => new
            {
                te.RegularHours,
                te.OvertimeHours,
                te.DoubletimeHours,
                te.Employee.BaseHourlyRate,
                te.Date
            })
            .ToListAsync(ct);

        var laborCostToDate = timeEntryData.Sum(te =>
            te.RegularHours * te.BaseHourlyRate
            + te.OvertimeHours * te.BaseHourlyRate * 1.5m
            + te.DoubletimeHours * te.BaseHourlyRate * 2.0m);

        var costToDate = laborCostToDate;

        // Calculate days elapsed from project start or first time entry
        var projectStartDate = project.StartDate ?? project.CreatedAt;
        var firstEntryDate = timeEntryData.Count > 0
            ? timeEntryData.Min(te => te.Date).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc)
            : projectStartDate;
        var effectiveStart = firstEntryDate < projectStartDate ? firstEntryDate : projectStartDate;
        var daysElapsed = Math.Max(1, (int)(DateTime.UtcNow - effectiveStart).TotalDays);

        // Days remaining from estimated completion or fallback
        var estimatedCompletion = project.EstimatedCompletionDate ?? DateTime.UtcNow.AddDays(180);
        var daysRemaining = Math.Max(0, (int)(estimatedCompletion - DateTime.UtcNow).TotalDays);

        // Burn rate: cost per day
        var burnRate = costToDate / daysElapsed;

        // Check WIP data for percent complete
        var wipLine = await db.WipReportLines
            .AsNoTracking()
            .Where(wl => wl.ProjectId == projectId && wl.CompanyId == companyContext.CompanyId)
            .OrderByDescending(wl => wl.CreatedAt)
            .FirstOrDefaultAsync(ct);

        // Method 1: Linear regression (project burn rate forward)
        var linearPrediction = costToDate + burnRate * daysRemaining;

        // Method 2: Earned value (use % complete from WIP if available)
        decimal earnedValuePrediction;
        if (wipLine is not null && wipLine.PercentComplete > 0)
        {
            // EAC = actual cost / % complete
            earnedValuePrediction = costToDate / wipLine.PercentComplete;
        }
        else if (budgetAtCompletion > 0 && costToDate > 0)
        {
            // Fallback: use cost-to-budget ratio
            var pctByBudget = costToDate / budgetAtCompletion;
            earnedValuePrediction = pctByBudget > 0 ? costToDate / pctByBudget : budgetAtCompletion;
        }
        else
        {
            earnedValuePrediction = linearPrediction;
        }

        // Weighted average of the two methods
        var hasWipData = wipLine is not null && wipLine.PercentComplete > 0;
        var linearWeight = hasWipData ? 0.4m : 0.6m;
        var evWeight = hasWipData ? 0.6m : 0.4m;
        var predictedFinalCost = linearPrediction * linearWeight + earnedValuePrediction * evWeight;

        var estimatedCostToComplete = Math.Max(0, predictedFinalCost - costToDate);

        // Variance
        var varianceToBudget = predictedFinalCost - budgetAtCompletion;
        var variancePercent = budgetAtCompletion != 0
            ? varianceToBudget / budgetAtCompletion
            : 0m;

        // Confidence scoring
        var confidence = CalculateConfidence(daysElapsed, timeEntryData.Count, hasWipData);

        var predictionMethod = hasWipData
            ? PredictionMethod.WeightedAverage
            : (timeEntryData.Count >= 10 ? PredictionMethod.LinearRegression : PredictionMethod.Historical);

        var prediction = new CostPrediction
        {
            ProjectId = projectId,
            CompanyId = companyContext.CompanyId,
            TenantId = tenantContext.TenantId,
            PredictedFinalCost = Math.Round(predictedFinalCost, 2),
            ConfidenceLevel = Math.Round(confidence, 4),
            PredictionMethod = predictionMethod,
            VarianceToBudget = Math.Round(varianceToBudget, 2),
            VariancePercent = Math.Round(variancePercent, 4),
            BudgetAtCompletion = Math.Round(budgetAtCompletion, 2),
            CostToDate = Math.Round(costToDate, 2),
            EstimatedCostToComplete = Math.Round(estimatedCostToComplete, 2),
            BurnRate = Math.Round(burnRate, 4),
            DaysRemaining = daysRemaining
        };

        db.CostPredictions.Add(prediction);
        await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "Generated cost prediction for project {ProjectId}: predicted {PredictedCost:C}, confidence {Confidence:P1}",
            projectId, prediction.PredictedFinalCost, prediction.ConfidenceLevel);

        return MapToDto(prediction, project.Name);
    }

    public static decimal CalculateConfidence(int daysElapsed, int entryCount, bool hasWipData)
    {
        // Base confidence from data volume
        var daysFactor = Math.Min(1.0m, daysElapsed / 90.0m);
        var entriesFactor = Math.Min(1.0m, entryCount / 50.0m);
        var wipBonus = hasWipData ? 0.15m : 0m;

        var confidence = daysFactor * 0.4m + entriesFactor * 0.4m + wipBonus + 0.05m;

        // Low data = low confidence (< 30 days = cap at 0.5)
        if (daysElapsed < 30)
            confidence = Math.Min(confidence, 0.5m);

        return Math.Clamp(confidence, 0.05m, 0.99m);
    }

    private static CostPredictionDto MapToDto(CostPrediction prediction, string projectName)
    {
        return new CostPredictionDto(
            prediction.Id,
            prediction.ProjectId,
            projectName,
            prediction.PredictedFinalCost,
            prediction.ConfidenceLevel,
            prediction.PredictionMethod.ToString(),
            prediction.VarianceToBudget,
            prediction.VariancePercent,
            prediction.BudgetAtCompletion,
            prediction.CostToDate,
            prediction.EstimatedCostToComplete,
            prediction.BurnRate,
            prediction.DaysRemaining,
            prediction.Notes,
            prediction.CreatedAt);
    }
}
