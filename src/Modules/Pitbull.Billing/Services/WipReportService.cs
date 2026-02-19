using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Billing.Features.Wip;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;

namespace Pitbull.Billing.Services;

public class WipReportService(
    PitbullDbContext db,
    IWipCalculationService wipCalculationService,
    ILogger<WipReportService> logger) : IWipReportService
{
    public async Task<Result<ListWipReportsResult>> ListWipReportsAsync(
        ListWipReportsQuery query,
        CancellationToken cancellationToken = default)
    {
        IQueryable<WipReport> dbQuery = db.Set<WipReport>()
            .AsNoTracking()
            .AsQueryable();

        if (query.Status.HasValue)
            dbQuery = dbQuery.Where(r => r.Status == query.Status.Value);

        int totalCount = await dbQuery.CountAsync(cancellationToken);
        int page = query.Page < 1 ? 1 : query.Page;
        int pageSize = query.PageSize < 1 ? 25 : query.PageSize;

        List<WipReportListItemDto> items = await dbQuery
            .OrderByDescending(r => r.ReportDate)
            .ThenByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new WipReportListItemDto(
                r.Id,
                r.ReportDate,
                r.FiscalYear,
                r.PeriodNumber,
                r.Status,
                r.Status.ToString(),
                r.Lines.Count,
                r.CreatedAt))
            .ToListAsync(cancellationToken);

        int totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
        return Result.Success(new ListWipReportsResult(items, totalCount, page, pageSize, totalPages));
    }

    public async Task<Result<WipReportDto>> GetWipReportAsync(Guid id, CancellationToken cancellationToken = default)
    {
        WipReport? report = await db.Set<WipReport>()
            .Include(r => r.Lines)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (report is null)
            return Result.Failure<WipReportDto>("WIP report not found", "NOT_FOUND");

        WipReportDto dto = await MapReportToDtoAsync(report, cancellationToken);
        return Result.Success(dto);
    }

    public async Task<Result<WipReportDto>> CreateWipReportAsync(
        CreateWipReportCommand command,
        string generatedById,
        CancellationToken cancellationToken = default)
    {
        WipReport report = new()
        {
            ReportDate = command.ReportDate,
            FiscalYear = command.FiscalYear,
            PeriodNumber = command.PeriodNumber,
            Status = command.Status,
            GeneratedById = generatedById
        };

        if (command.Lines != null)
        {
            foreach (CreateWipReportLineCommand line in command.Lines)
            {
                report.Lines.Add(new WipReportLine
                {
                    ProjectId = line.ProjectId,
                    ContractAmount = line.ContractAmount,
                    ApprovedChangeOrders = line.ApprovedChangeOrders,
                    RevisedContractAmount = line.RevisedContractAmount,
                    TotalCostToDate = line.TotalCostToDate,
                    EstimatedCostToComplete = line.EstimatedCostToComplete,
                    EstimatedTotalCost = line.EstimatedTotalCost,
                    PercentComplete = line.PercentComplete,
                    EarnedRevenue = line.EarnedRevenue,
                    BilledToDate = line.BilledToDate,
                    OverUnderBilling = line.OverUnderBilling
                });
            }
        }

        db.Set<WipReport>().Add(report);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            WipReportDto dto = await MapReportToDtoAsync(report, cancellationToken);
            return Result.Success(dto);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create WIP report for {FiscalYear}-{PeriodNumber}", command.FiscalYear, command.PeriodNumber);
            return Result.Failure<WipReportDto>("Failed to create WIP report", "DATABASE_ERROR");
        }
    }

    public async Task<Result<WipReportDto>> UpdateWipReportAsync(
        UpdateWipReportCommand command,
        CancellationToken cancellationToken = default)
    {
        WipReport? report = await db.Set<WipReport>()
            .Include(r => r.Lines)
            .FirstOrDefaultAsync(r => r.Id == command.WipReportId, cancellationToken);

        if (report is null)
            return Result.Failure<WipReportDto>("WIP report not found", "NOT_FOUND");

        if (command.Status.HasValue)
            report.Status = command.Status.Value;

        if (command.Lines != null)
        {
            Dictionary<Guid, UpdateWipReportLineCommand> updatesByLineId = command.Lines
                .ToDictionary(l => l.WipReportLineId, l => l);

            foreach (WipReportLine line in report.Lines)
            {
                if (!updatesByLineId.TryGetValue(line.Id, out UpdateWipReportLineCommand? lineUpdate))
                    continue;

                if (!lineUpdate.EstimatedCostToComplete.HasValue)
                    continue;

                Project? project = await db.Set<Project>()
                    .AsNoTracking()
                    .FirstOrDefaultAsync(p => p.Id == line.ProjectId, cancellationToken);

                if (project is null)
                    continue;

                var calcResult = await wipCalculationService.CalculateProjectLineAsync(
                    project,
                    lineUpdate.EstimatedCostToComplete.Value,
                    cancellationToken);

                if (!calcResult.IsSuccess || calcResult.Value is null)
                    continue;

                ApplyCalculatedValues(line, calcResult.Value);
            }
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            WipReportDto dto = await MapReportToDtoAsync(report, cancellationToken);
            return Result.Success(dto);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to update WIP report {WipReportId}", command.WipReportId);
            return Result.Failure<WipReportDto>("Failed to update WIP report", "DATABASE_ERROR");
        }
    }

    public async Task<Result> DeleteWipReportAsync(Guid id, CancellationToken cancellationToken = default)
    {
        WipReport? report = await db.Set<WipReport>()
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (report is null)
            return Result.Failure("WIP report not found", "NOT_FOUND");

        db.Set<WipReport>().Remove(report);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to delete WIP report {WipReportId}", id);
            return Result.Failure("Failed to delete WIP report", "DATABASE_ERROR");
        }
    }

    public async Task<Result<WipReportDto>> GenerateWipReportAsync(
        GenerateWipReportCommand command,
        string generatedById,
        CancellationToken cancellationToken = default)
    {
        Dictionary<Guid, decimal> estimateLookup = command.ProjectEstimates?
            .ToDictionary(x => x.ProjectId, x => x.EstimatedCostToComplete)
            ?? [];

        List<Project> projects = await db.Set<Project>()
            .AsNoTracking()
            .Where(p => p.Status == ProjectStatus.Active)
            .OrderBy(p => p.Number)
            .ToListAsync(cancellationToken);

        WipReport report = new()
        {
            ReportDate = command.ReportDate,
            FiscalYear = command.FiscalYear,
            PeriodNumber = command.PeriodNumber,
            Status = command.Status,
            GeneratedById = generatedById
        };

        foreach (Project project in projects)
        {
            decimal estimatedCostToComplete = estimateLookup.TryGetValue(project.Id, out decimal value)
                ? value
                : 0m;

            var calcResult = await wipCalculationService.CalculateProjectLineAsync(
                project,
                estimatedCostToComplete,
                cancellationToken);

            if (!calcResult.IsSuccess || calcResult.Value is null)
                continue;

            WipReportLine line = new() { ProjectId = project.Id };
            ApplyCalculatedValues(line, calcResult.Value);
            report.Lines.Add(line);
        }

        db.Set<WipReport>().Add(report);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            WipReportDto dto = await MapReportToDtoAsync(report, cancellationToken);
            return Result.Success(dto);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to generate WIP report for {FiscalYear}-{PeriodNumber}", command.FiscalYear, command.PeriodNumber);
            return Result.Failure<WipReportDto>("Failed to generate WIP report", "DATABASE_ERROR");
        }
    }

    private async Task<WipReportDto> MapReportToDtoAsync(WipReport report, CancellationToken cancellationToken)
    {
        List<Guid> projectIds = report.Lines.Select(l => l.ProjectId).Distinct().ToList();
        Dictionary<Guid, Project> projectsById = await db.Set<Project>()
            .AsNoTracking()
            .Where(p => projectIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, cancellationToken);

        List<WipReportLineDto> lineDtos = report.Lines
            .OrderBy(l => projectsById.TryGetValue(l.ProjectId, out Project? project) ? project.Number : string.Empty)
            .Select(line => MapLineToDto(line, projectsById))
            .ToList();

        return new WipReportDto(
            Id: report.Id,
            ReportDate: report.ReportDate,
            FiscalYear: report.FiscalYear,
            PeriodNumber: report.PeriodNumber,
            Status: report.Status,
            StatusName: report.Status.ToString(),
            GeneratedById: report.GeneratedById,
            CreatedAt: report.CreatedAt,
            UpdatedAt: report.UpdatedAt,
            Lines: lineDtos);
    }

    private static WipReportLineDto MapLineToDto(WipReportLine line, IReadOnlyDictionary<Guid, Project> projectsById)
    {
        string projectNumber = projectsById.TryGetValue(line.ProjectId, out Project? project)
            ? project.Number
            : "Unknown";

        string projectName = projectsById.TryGetValue(line.ProjectId, out Project? projectForName)
            ? projectForName.Name
            : "Unknown Project";

        return new WipReportLineDto(
            Id: line.Id,
            WipReportId: line.WipReportId,
            ProjectId: line.ProjectId,
            ProjectNumber: projectNumber,
            ProjectName: projectName,
            ContractAmount: line.ContractAmount,
            ApprovedChangeOrders: line.ApprovedChangeOrders,
            RevisedContractAmount: line.RevisedContractAmount,
            TotalCostToDate: line.TotalCostToDate,
            EstimatedCostToComplete: line.EstimatedCostToComplete,
            EstimatedTotalCost: line.EstimatedTotalCost,
            PercentComplete: line.PercentComplete,
            EarnedRevenue: line.EarnedRevenue,
            BilledToDate: line.BilledToDate,
            OverUnderBilling: line.OverUnderBilling,
            OverUnderClassification: WipMapper.ClassifyOverUnder(line.OverUnderBilling));
    }

    private static void ApplyCalculatedValues(WipReportLine line, WipReportLineCalculationResult result)
    {
        line.ContractAmount = result.ContractAmount;
        line.ApprovedChangeOrders = result.ApprovedChangeOrders;
        line.RevisedContractAmount = result.RevisedContractAmount;
        line.TotalCostToDate = result.TotalCostToDate;
        line.EstimatedCostToComplete = result.EstimatedCostToComplete;
        line.EstimatedTotalCost = result.EstimatedTotalCost;
        line.PercentComplete = result.PercentComplete;
        line.EarnedRevenue = result.EarnedRevenue;
        line.BilledToDate = result.BilledToDate;
        line.OverUnderBilling = result.OverUnderBilling;
    }
}
