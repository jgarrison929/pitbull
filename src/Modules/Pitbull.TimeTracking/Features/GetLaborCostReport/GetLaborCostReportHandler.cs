using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Services;

namespace Pitbull.TimeTracking.Features.GetLaborCostReport;

/// <summary>
/// Handler for generating labor cost reports with breakdowns by project and cost code.
/// Integrates the LaborCostCalculator to compute burdened costs.
/// </summary>
public sealed class GetLaborCostReportHandler(
    PitbullDbContext db,
    ILaborCostCalculator costCalculator)
    : IRequestHandler<GetLaborCostReportQuery, Result<LaborCostReportResponse>>
{
    public async Task<Result<LaborCostReportResponse>> Handle(
        GetLaborCostReportQuery request, CancellationToken cancellationToken)
    {
        // Build the base query
        var query = db.Set<TimeEntry>()
            .Include(te => te.Employee)
            .Include(te => te.Project)
            .Include(te => te.CostCode)
            .AsQueryable();

        // Apply filters
        if (request.ProjectId.HasValue)
        {
            // Verify project exists
            var projectExists = await db.Set<Project>()
                .AnyAsync(p => p.Id == request.ProjectId.Value, cancellationToken);

            if (!projectExists)
                return Result.Failure<LaborCostReportResponse>("Project not found", "NOT_FOUND");

            query = query.Where(te => te.ProjectId == request.ProjectId.Value);
        }

        if (request.StartDate.HasValue)
            query = query.Where(te => te.Date >= request.StartDate.Value);

        if (request.EndDate.HasValue)
            query = query.Where(te => te.Date <= request.EndDate.Value);

        if (request.ApprovedOnly)
            query = query.Where(te => te.Status == TimeEntryStatus.Approved);

        // Execute query
        var timeEntries = await query.ToListAsync(cancellationToken);

        if (timeEntries.Count == 0)
        {
            return Result.Success(new LaborCostReportResponse
            {
                DateRange = new DateRangeInfo(request.StartDate, request.EndDate),
                ApprovedOnly = request.ApprovedOnly,
                TotalCost = CreateEmptySummary(),
                ByProject = []
            });
        }

        // Group by project and cost code
        var projectGroups = timeEntries
            .GroupBy(te => new { te.ProjectId, te.Project.Name, te.Project.Number })
            .Select(projectGroup =>
            {
                var costCodeSummaries = projectGroup
                    .GroupBy(te => new { te.CostCodeId, te.CostCode.Code, te.CostCode.Description })
                    .Select(codeGroup =>
                    {
                        var codeEntries = codeGroup.ToList();
                        var codeCost = costCalculator.CalculateTotalCost(codeEntries);

                        return new CostCodeCostSummary
                        {
                            CostCodeId = codeGroup.Key.CostCodeId,
                            CostCodeNumber = codeGroup.Key.Code,
                            CostCodeName = codeGroup.Key.Description,
                            Cost = ToLaborCostSummary(codeCost, codeEntries)
                        };
                    })
                    .OrderBy(cc => cc.CostCodeNumber)
                    .ToList();

                var projectEntries = projectGroup.ToList();
                var projectCost = costCalculator.CalculateTotalCost(projectEntries);

                return new ProjectCostSummary
                {
                    ProjectId = projectGroup.Key.ProjectId,
                    ProjectName = projectGroup.Key.Name,
                    ProjectNumber = projectGroup.Key.Number,
                    Cost = ToLaborCostSummary(projectCost, projectEntries),
                    ByCostCode = costCodeSummaries
                };
            })
            .OrderBy(p => p.ProjectNumber)
            .ToList();

        // Calculate grand total
        var totalCost = costCalculator.CalculateTotalCost(timeEntries);

        return Result.Success(new LaborCostReportResponse
        {
            DateRange = new DateRangeInfo(request.StartDate, request.EndDate),
            ApprovedOnly = request.ApprovedOnly,
            TotalCost = ToLaborCostSummary(totalCost, timeEntries),
            ByProject = projectGroups
        });
    }

    private static LaborCostSummary ToLaborCostSummary(LaborCostResult costResult, List<TimeEntry> entries)
    {
        return new LaborCostSummary
        {
            TotalHours = entries.Sum(e => e.TotalHours),
            RegularHours = costResult.HoursBreakdown.RegularHours,
            OvertimeHours = costResult.HoursBreakdown.OvertimeHours,
            DoubletimeHours = costResult.HoursBreakdown.DoubletimeHours,
            BaseWageCost = costResult.BaseWageCost,
            BurdenCost = costResult.BurdenCost,
            TotalCost = costResult.TotalCost,
            BurdenRateApplied = costResult.BurdenRateApplied
        };
    }

    private static LaborCostSummary CreateEmptySummary()
    {
        return new LaborCostSummary
        {
            TotalHours = 0,
            RegularHours = 0,
            OvertimeHours = 0,
            DoubletimeHours = 0,
            BaseWageCost = 0,
            BurdenCost = 0,
            TotalCost = 0,
            BurdenRateApplied = LaborCostCalculator.DefaultBurdenRate
        };
    }
}
