using System.Globalization;
using System.Text;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;
using Pitbull.TimeTracking.Features.BatchCreateTimeEntries;
using Pitbull.TimeTracking.Features.BulkSubmitTimeEntries;
using Pitbull.TimeTracking.Features.CreateTimeEntry;
using Pitbull.TimeTracking.Features.ExportVistaTimesheet;
using Pitbull.TimeTracking.Features.GetLaborCostReport;
using Pitbull.TimeTracking.Features.GetTimeEntriesByProject;
using Pitbull.TimeTracking.Features.ListTimeEntries;
using Pitbull.TimeTracking.Features.UpdateTimeEntry;
using Equipment = Pitbull.Core.Domain.Equipment;
using Phase = Pitbull.Projects.Domain.Phase;

namespace Pitbull.TimeTracking.Services;

/// <summary>
/// Service for managing time entry operations, replacing MediatR-based handlers.
/// Consolidates all time entry business logic into a single service.
/// </summary>
public class TimeEntryService : ITimeEntryService
{
    private readonly PitbullDbContext _db;
    private readonly IValidator<CreateTimeEntryCommand> _createValidator;
    private readonly IValidator<UpdateTimeEntryCommand> _updateValidator;
    private readonly IValidator<BatchCreateTimeEntriesCommand> _batchValidator;
    private readonly ILaborCostCalculator _costCalculator;
    private readonly ILogger<TimeEntryService> _logger;

    /// <summary>
    /// Vista standard CSV headers for timesheet import
    /// </summary>
    private static readonly string[] VistaHeaders =
    [
        "EmployeeNumber",
        "EmployeeName",
        "WorkDate",
        "ProjectNumber",
        "ProjectName",
        "PhaseCode",
        "PhaseName",
        "CostCode",
        "CostCodeDescription",
        "RegularHours",
        "OvertimeHours",
        "DoubletimeHours",
        "TotalHours",
        "HourlyRate",
        "RegularAmount",
        "OvertimeAmount",
        "DoubletimeAmount",
        "TotalAmount",
        "EquipmentCode",
        "EquipmentName",
        "EquipmentHours",
        "EquipmentRate",
        "EquipmentAmount",
        "ApprovalStatus",
        "ApprovedBy",
        "ApprovedDate"
    ];

    public TimeEntryService(
        PitbullDbContext db,
        IValidator<CreateTimeEntryCommand> createValidator,
        IValidator<UpdateTimeEntryCommand> updateValidator,
        IValidator<BatchCreateTimeEntriesCommand> batchValidator,
        ILaborCostCalculator costCalculator,
        ILogger<TimeEntryService> logger)
    {
        _db = db;
        _createValidator = createValidator;
        _updateValidator = updateValidator;
        _batchValidator = batchValidator;
        _costCalculator = costCalculator;
        _logger = logger;
    }

    #region Query Operations

    public async Task<Result<TimeEntryDto>> GetTimeEntryAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var timeEntry = await _db.Set<TimeEntry>()
            .Include(te => te.Employee)
            .Include(te => te.Phase)
            .Include(te => te.Equipment)
            .Include(te => te.SubmittedBy)
            .FirstOrDefaultAsync(te => te.Id == id && !te.IsDeleted, cancellationToken);

        if (timeEntry == null)
            return Result.Failure<TimeEntryDto>("Time entry not found", "NOT_FOUND");

        return Result.Success(TimeEntryMapper.ToDto(timeEntry));
    }

    public async Task<Result<ListTimeEntriesResult>> ListTimeEntriesAsync(
        Guid? projectId,
        Guid? employeeId,
        DateOnly? startDate,
        DateOnly? endDate,
        TimeEntryStatus? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _db.Set<TimeEntry>()
            .Include(te => te.Employee)
            .Include(te => te.Phase)
            .Include(te => te.Equipment)
            .Include(te => te.SubmittedBy)
            .Where(te => !te.IsDeleted)
            .AsQueryable();

        // Apply filters
        if (projectId.HasValue)
            query = query.Where(te => te.ProjectId == projectId.Value);

        if (employeeId.HasValue)
            query = query.Where(te => te.EmployeeId == employeeId.Value);

        if (startDate.HasValue)
            query = query.Where(te => te.Date >= startDate.Value);

        if (endDate.HasValue)
            query = query.Where(te => te.Date <= endDate.Value);

        if (status.HasValue)
            query = query.Where(te => te.Status == status.Value);

        // Get total count before pagination
        var totalCount = await query.CountAsync(cancellationToken);

        // Apply ordering and pagination
        var items = await query
            .OrderByDescending(te => te.Date)
            .ThenBy(te => te.Employee.LastName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(te => TimeEntryMapper.ToDto(te))
            .ToListAsync(cancellationToken);

        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        return Result.Success(new ListTimeEntriesResult(
            items, totalCount, page, pageSize, totalPages));
    }

    public async Task<Result<ProjectTimeEntriesResult>> GetTimeEntriesByProjectAsync(
        Guid projectId,
        DateOnly? startDate,
        DateOnly? endDate,
        TimeEntryStatus? status,
        bool includeSummary,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        // Verify project exists
        var project = await _db.Set<Project>()
            .FirstOrDefaultAsync(p => p.Id == projectId, cancellationToken);

        if (project == null)
            return Result.Failure<ProjectTimeEntriesResult>("Project not found", "NOT_FOUND");

        var query = _db.Set<TimeEntry>()
            .Include(te => te.Employee)
            .Include(te => te.ApprovedBy)
            .Include(te => te.Phase)
            .Include(te => te.Equipment)
            .Include(te => te.SubmittedBy)
            .Where(te => te.ProjectId == projectId);

        // Apply filters
        if (startDate.HasValue)
            query = query.Where(te => te.Date >= startDate.Value);

        if (endDate.HasValue)
            query = query.Where(te => te.Date <= endDate.Value);

        if (status.HasValue)
            query = query.Where(te => te.Status == status.Value);

        // Get total count before pagination
        var totalCount = await query.CountAsync(cancellationToken);
        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        // Calculate summary if requested
        ProjectTimeSummary? summary = null;
        if (includeSummary)
        {
            var allEntries = await query.ToListAsync(cancellationToken);
            summary = new ProjectTimeSummary(
                TotalRegularHours: allEntries.Sum(te => te.RegularHours),
                TotalOvertimeHours: allEntries.Sum(te => te.OvertimeHours),
                TotalDoubletimeHours: allEntries.Sum(te => te.DoubletimeHours),
                TotalHours: allEntries.Sum(te => te.TotalHours),
                SubmittedCount: allEntries.Count(te => te.Status == TimeEntryStatus.Submitted),
                ApprovedCount: allEntries.Count(te => te.Status == TimeEntryStatus.Approved),
                RejectedCount: allEntries.Count(te => te.Status == TimeEntryStatus.Rejected),
                DraftCount: allEntries.Count(te => te.Status == TimeEntryStatus.Draft)
            );
        }

        // Apply ordering and pagination
        var items = await query
            .OrderByDescending(te => te.Date)
            .ThenBy(te => te.Employee.LastName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(te => TimeEntryMapper.ToDto(te))
            .ToListAsync(cancellationToken);

        return Result.Success(new ProjectTimeEntriesResult(
            ProjectId: project.Id,
            ProjectName: project.Name,
            ProjectNumber: project.Number,
            TimeEntries: items,
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize,
            TotalPages: totalPages,
            Summary: summary
        ));
    }

    public async Task<Result<LaborCostReportResponse>> GetLaborCostReportAsync(
        Guid? projectId,
        DateOnly? startDate,
        DateOnly? endDate,
        bool approvedOnly,
        CancellationToken cancellationToken = default)
    {
        // Build the base query
        var query = _db.Set<TimeEntry>()
            .Include(te => te.Employee)
            .Include(te => te.Project)
            .Include(te => te.CostCode)
            .Include(te => te.Phase)
            .Include(te => te.Equipment)
            .AsQueryable();

        // Apply filters
        if (projectId.HasValue)
        {
            // Verify project exists
            var projectExists = await _db.Set<Project>()
                .AnyAsync(p => p.Id == projectId.Value, cancellationToken);

            if (!projectExists)
                return Result.Failure<LaborCostReportResponse>("Project not found", "NOT_FOUND");

            query = query.Where(te => te.ProjectId == projectId.Value);
        }

        if (startDate.HasValue)
            query = query.Where(te => te.Date >= startDate.Value);

        if (endDate.HasValue)
            query = query.Where(te => te.Date <= endDate.Value);

        if (approvedOnly)
            query = query.Where(te => te.Status == TimeEntryStatus.Approved);

        // Execute query
        var timeEntries = await query.ToListAsync(cancellationToken);

        if (timeEntries.Count == 0)
        {
            return Result.Success(new LaborCostReportResponse
            {
                DateRange = new DateRangeInfo(startDate, endDate),
                ApprovedOnly = approvedOnly,
                TotalCost = CreateEmptyCostSummary(),
                ByProject = []
            });
        }

        // Group by project, cost code, and phase
        var projectGroups = timeEntries
            .GroupBy(te => new { te.ProjectId, te.Project.Name, te.Project.Number })
            .Select(projectGroup =>
            {
                var costCodeSummaries = projectGroup
                    .GroupBy(te => new { te.CostCodeId, te.CostCode.Code, te.CostCode.Description })
                    .Select(codeGroup =>
                    {
                        var codeEntries = codeGroup.ToList();
                        var codeCost = _costCalculator.CalculateTotalCost(codeEntries);

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

                // Group by phase within project
                var phaseSummaries = projectGroup
                    .GroupBy(te => new { te.PhaseId, PhaseName = te.Phase?.Name, PhaseCostCode = te.Phase?.CostCode })
                    .Select(phaseGroup =>
                    {
                        var phaseEntries = phaseGroup.ToList();
                        var phaseCost = _costCalculator.CalculateTotalCost(phaseEntries);
                        var equipmentHours = phaseEntries.Sum(te => te.EquipmentHours);
                        var equipmentCost = phaseEntries.Sum(te =>
                            te.Equipment != null ? te.EquipmentHours * te.Equipment.HourlyRate : 0);

                        return new PhaseCostSummary
                        {
                            PhaseId = phaseGroup.Key.PhaseId,
                            PhaseName = phaseGroup.Key.PhaseName ?? "(No Phase)",
                            PhaseCostCode = phaseGroup.Key.PhaseCostCode,
                            LaborCost = ToLaborCostSummary(phaseCost, phaseEntries),
                            EquipmentCost = new EquipmentCostSummary
                            {
                                TotalHours = equipmentHours,
                                TotalCost = equipmentCost
                            }
                        };
                    })
                    .OrderBy(p => p.PhaseName)
                    .ToList();

                var projectEntries = projectGroup.ToList();
                var projectCost = _costCalculator.CalculateTotalCost(projectEntries);

                return new ProjectCostSummary
                {
                    ProjectId = projectGroup.Key.ProjectId,
                    ProjectName = projectGroup.Key.Name,
                    ProjectNumber = projectGroup.Key.Number,
                    Cost = ToLaborCostSummary(projectCost, projectEntries),
                    ByCostCode = costCodeSummaries,
                    ByPhase = phaseSummaries
                };
            })
            .OrderBy(p => p.ProjectNumber)
            .ToList();

        // Calculate grand total
        var totalCost = _costCalculator.CalculateTotalCost(timeEntries);

        return Result.Success(new LaborCostReportResponse
        {
            DateRange = new DateRangeInfo(startDate, endDate),
            ApprovedOnly = approvedOnly,
            TotalCost = ToLaborCostSummary(totalCost, timeEntries),
            ByProject = projectGroups
        });
    }

    public async Task<Result<VistaExportResult>> ExportVistaTimesheetAsync(
        DateOnly startDate,
        DateOnly endDate,
        Guid? projectId,
        CancellationToken cancellationToken = default)
    {
        // Validate date range
        if (endDate < startDate)
        {
            return Result.Failure<VistaExportResult>(
                "End date must be greater than or equal to start date",
                "INVALID_DATE_RANGE");
        }

        // Prevent exports spanning more than one year
        var daysDiff = endDate.DayNumber - startDate.DayNumber;
        if (daysDiff > 366)
        {
            return Result.Failure<VistaExportResult>(
                "Export date range cannot exceed one year",
                "DATE_RANGE_TOO_LARGE");
        }

        // Build query for approved time entries only
        var query = _db.Set<TimeEntry>()
            .Include(te => te.Employee)
            .Include(te => te.Project)
            .Include(te => te.CostCode)
            .Include(te => te.ApprovedBy)
            .Include(te => te.Phase)
            .Include(te => te.Equipment)
            .Where(te => te.Status == TimeEntryStatus.Approved)
            .Where(te => te.Date >= startDate && te.Date <= endDate);

        // Apply optional project filter
        if (projectId.HasValue)
        {
            var projectExists = await _db.Set<Project>()
                .AnyAsync(p => p.Id == projectId.Value, cancellationToken);

            if (!projectExists)
            {
                return Result.Failure<VistaExportResult>("Project not found", "NOT_FOUND");
            }

            query = query.Where(te => te.ProjectId == projectId.Value);
        }

        // Order by employee, then date, then project for logical grouping
        var timeEntries = await query
            .OrderBy(te => te.Employee.EmployeeNumber)
            .ThenBy(te => te.Date)
            .ThenBy(te => te.Project.Number)
            .ThenBy(te => te.CostCode.Code)
            .ToListAsync(cancellationToken);

        // Generate CSV content
        var csvContent = GenerateVistaCsv(timeEntries);

        // Calculate summary statistics
        var totalHours = timeEntries.Sum(te => te.TotalHours);
        var employeeCount = timeEntries.Select(te => te.EmployeeId).Distinct().Count();
        var projectCount = timeEntries.Select(te => te.ProjectId).Distinct().Count();

        // Generate filename with date range
        var fileName = $"vista-timesheet-{startDate:yyyyMMdd}-{endDate:yyyyMMdd}.csv";

        return Result.Success(new VistaExportResult
        {
            CsvContent = csvContent,
            FileName = fileName,
            RowCount = timeEntries.Count,
            TotalHours = totalHours,
            StartDate = startDate,
            EndDate = endDate,
            EmployeeCount = employeeCount,
            ProjectCount = projectCount
        });
    }

    #endregion

    #region Command Operations

    public async Task<Result<TimeEntryDto>> CreateTimeEntryAsync(CreateTimeEntryCommand command, CancellationToken cancellationToken = default)
    {
        var validationResult = await _createValidator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            var errors = string.Join(", ", validationResult.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<TimeEntryDto>(errors, "VALIDATION_ERROR");
        }

        // Validate that employee exists and is active
        var employee = await _db.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == command.EmployeeId && e.IsActive, cancellationToken);

        if (employee == null)
            return Result.Failure<TimeEntryDto>("Employee not found or inactive", "EMPLOYEE_NOT_FOUND");

        // Validate that project exists and is accessible
        var project = await _db.Set<Project>()
            .FirstOrDefaultAsync(p => p.Id == command.ProjectId, cancellationToken);

        if (project == null)
            return Result.Failure<TimeEntryDto>("Project not found", "PROJECT_NOT_FOUND");

        // Validate project is in an active status (not closed/completed)
        if (project.Status == ProjectStatus.Completed || project.Status == ProjectStatus.Closed)
            return Result.Failure<TimeEntryDto>(
                "Cannot log time to a completed or closed project",
                "PROJECT_INACTIVE");

        // Validate employee is assigned to this project
        var hasAssignment = await _db.Set<ProjectAssignment>()
            .AnyAsync(pa => pa.EmployeeId == command.EmployeeId
                         && pa.ProjectId == command.ProjectId
                         && pa.IsActive
                         && pa.StartDate <= command.Date
                         && (pa.EndDate == null || pa.EndDate >= command.Date),
                      cancellationToken);

        if (!hasAssignment)
            return Result.Failure<TimeEntryDto>(
                "Employee is not assigned to this project",
                "NOT_ASSIGNED_TO_PROJECT");

        // Auto-assign cost code if not provided (crew timecard grid flow).
        // Look up the tenant's default labor cost code (Code="LAB").
        var effectiveCostCodeId = command.CostCodeId;
        if (effectiveCostCodeId == Guid.Empty)
        {
            var laborCostCode = await _db.Set<CostCode>()
                .FirstOrDefaultAsync(cc => cc.Code == "LAB" && cc.IsActive, cancellationToken);

            if (laborCostCode != null)
            {
                effectiveCostCodeId = laborCostCode.Id;
                _logger.LogInformation(
                    "Auto-assigned labor cost code {CostCodeId} (LAB) for employee {EmployeeId} on {Date}",
                    laborCostCode.Id, command.EmployeeId, command.Date);
            }
            else
            {
                _logger.LogWarning(
                    "No active LAB cost code found for tenant; cannot auto-assign cost code for employee {EmployeeId} on {Date}",
                    command.EmployeeId, command.Date);
                return Result.Failure<TimeEntryDto>(
                    "No cost code specified and no default labor cost code (LAB) found",
                    "COSTCODE_NOT_FOUND");
            }
        }

        // Validate that cost code exists and is active
        var costCode = await _db.Set<CostCode>()
            .FirstOrDefaultAsync(cc => cc.Id == effectiveCostCodeId && cc.IsActive, cancellationToken);

        if (costCode == null)
            return Result.Failure<TimeEntryDto>("Cost code not found or inactive", "COSTCODE_NOT_FOUND");

        // Validate PhaseId if provided - must belong to the same project
        if (command.PhaseId.HasValue)
        {
            var phase = await _db.Set<Phase>()
                .FirstOrDefaultAsync(p => p.Id == command.PhaseId.Value, cancellationToken);

            if (phase == null)
                return Result.Failure<TimeEntryDto>("Phase not found", "PHASE_NOT_FOUND");

            if (phase.ProjectId != command.ProjectId)
                return Result.Failure<TimeEntryDto>(
                    "Phase does not belong to the specified project",
                    "PHASE_PROJECT_MISMATCH");
        }

        // Validate EquipmentId if provided - must exist and be active
        if (command.EquipmentId.HasValue)
        {
            var equipment = await _db.Set<Equipment>()
                .FirstOrDefaultAsync(e => e.Id == command.EquipmentId.Value && e.IsActive, cancellationToken);

            if (equipment == null)
                return Result.Failure<TimeEntryDto>(
                    "Equipment not found or inactive",
                    "EQUIPMENT_NOT_FOUND");
        }

        // Check for duplicate time entry on the same date (now includes PhaseId)
        var existingEntry = await _db.Set<TimeEntry>()
            .AnyAsync(te => te.Date == command.Date
                         && te.EmployeeId == command.EmployeeId
                         && te.ProjectId == command.ProjectId
                         && te.CostCodeId == effectiveCostCodeId
                         && te.PhaseId == command.PhaseId,
                      cancellationToken);

        if (existingEntry)
            return Result.Failure<TimeEntryDto>(
                "Time entry already exists for this employee, project, cost code, and phase on this date",
                "DUPLICATE_ENTRY");

        var timeEntry = new TimeEntry
        {
            Date = command.Date,
            EmployeeId = command.EmployeeId,
            ProjectId = command.ProjectId,
            CostCodeId = effectiveCostCodeId,
            PhaseId = command.PhaseId,
            EquipmentId = command.EquipmentId,
            EquipmentHours = command.EquipmentHours,
            RegularHours = command.RegularHours,
            OvertimeHours = command.OvertimeHours,
            DoubletimeHours = command.DoubletimeHours,
            Description = command.Description,
            Status = TimeEntryStatus.Submitted
        };

        _db.Set<TimeEntry>().Add(timeEntry);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return Result.Success(TimeEntryMapper.ToDto(timeEntry));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create time entry for employee {EmployeeId} on {Date}",
                command.EmployeeId, command.Date);
            return Result.Failure<TimeEntryDto>("Failed to create time entry", "DATABASE_ERROR");
        }
    }

    public async Task<Result<BatchCreateTimeEntriesResult>> BatchCreateTimeEntriesAsync(
        BatchCreateTimeEntriesCommand command, CancellationToken cancellationToken = default)
    {
        var validationResult = await _batchValidator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            var errors = string.Join(", ", validationResult.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<BatchCreateTimeEntriesResult>(errors, "VALIDATION_ERROR");
        }

        var results = new List<BatchEntryResult>();
        var entriesToAdd = new List<TimeEntry>();

        for (var i = 0; i < command.Entries.Count; i++)
        {
            var item = command.Entries[i];
            var upsertResult = await ValidateAndBuildTimeEntry(item, command.IsDraft, cancellationToken);

            if (!upsertResult.IsSuccess)
            {
                results.Add(new BatchEntryResult(i, null, item.EmployeeId, "Unknown",
                    false, upsertResult.Error, upsertResult.ErrorCode));

                if (!command.AllowPartialSuccess)
                {
                    return Result.Failure<BatchCreateTimeEntriesResult>(
                        $"Entry {i}: {upsertResult.Error}", upsertResult.ErrorCode!);
                }
                continue;
            }

            var upsert = upsertResult.Value!;
            var timeEntry = upsert.TimeEntry;
            timeEntry.Status = command.IsDraft ? TimeEntryStatus.Draft : TimeEntryStatus.Submitted;

            if (!command.IsDraft)
            {
                timeEntry.SubmittedAt = DateTime.UtcNow;
                timeEntry.SubmittedById = command.SubmittedById;
            }
            else
            {
                timeEntry.SubmittedAt = null;
                timeEntry.SubmittedById = null;
            }

            if (upsert.IsNew)
                entriesToAdd.Add(timeEntry);

            results.Add(new BatchEntryResult(i, timeEntry.Id, item.EmployeeId,
                timeEntry.Employee?.FullName ?? "Unknown", true, null, null));
        }

        if (entriesToAdd.Count > 0)
            _db.Set<TimeEntry>().AddRange(entriesToAdd);

        if (results.Any(r => r.Success))
        {
            try
            {
                await _db.SaveChangesAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save batch time entries");
                return Result.Failure<BatchCreateTimeEntriesResult>(
                    "Failed to save time entries", "DATABASE_ERROR");
            }
        }

        return Result.Success(new BatchCreateTimeEntriesResult(
            command.Entries.Count,
            results.Count(r => r.Success),
            results.Count(r => !r.Success),
            results));
    }

    public async Task<Result<BulkSubmitTimeEntriesResult>> BulkSubmitTimeEntriesAsync(
        BulkSubmitTimeEntriesCommand command, CancellationToken cancellationToken = default)
    {
        if (command.TimeEntryIds.Count > 500)
            return Result.Failure<BulkSubmitTimeEntriesResult>(
                "Maximum 500 entries per bulk submit", "VALIDATION_ERROR");

        if (command.TimeEntryIds.Count == 0)
            return Result.Failure<BulkSubmitTimeEntriesResult>(
                "At least one time entry ID is required", "VALIDATION_ERROR");

        var entries = await _db.Set<TimeEntry>()
            .Include(te => te.Employee)
            .Include(te => te.Project)
            .Where(te => command.TimeEntryIds.Contains(te.Id))
            .ToListAsync(cancellationToken);

        var results = new List<BulkSubmitEntryResult>();

        foreach (var entryId in command.TimeEntryIds)
        {
            var entry = entries.FirstOrDefault(e => e.Id == entryId);

            if (entry == null || entry.IsDeleted)
            {
                results.Add(new BulkSubmitEntryResult(entryId, false,
                    "Time entry not found", "NOT_FOUND"));
                continue;
            }

            if (!IsValidTransition(entry.Status, TimeEntryStatus.Submitted) || entry.Status != TimeEntryStatus.Draft)
            {
                results.Add(new BulkSubmitEntryResult(entryId, false,
                    $"Cannot submit entry in {entry.Status} status", "INVALID_TRANSITION"));
                continue;
            }

            // Validate employee still active at submit time
            if (!entry.Employee.IsActive)
            {
                results.Add(new BulkSubmitEntryResult(entryId, false,
                    "Employee is no longer active", "EMPLOYEE_INACTIVE"));
                continue;
            }

            // Validate project not completed/closed at submit time
            if (entry.Project.Status == ProjectStatus.Completed || entry.Project.Status == ProjectStatus.Closed)
            {
                results.Add(new BulkSubmitEntryResult(entryId, false,
                    "Project is completed or closed", "PROJECT_INACTIVE"));
                continue;
            }

            entry.Status = TimeEntryStatus.Submitted;
            entry.SubmittedAt = DateTime.UtcNow;
            entry.SubmittedById = command.SubmittedById;

            results.Add(new BulkSubmitEntryResult(entryId, true, null, null));
        }

        if (results.Any(r => r.Success))
        {
            try
            {
                await _db.SaveChangesAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save bulk submit");
                return Result.Failure<BulkSubmitTimeEntriesResult>(
                    "Failed to save submissions", "DATABASE_ERROR");
            }
        }

        return Result.Success(new BulkSubmitTimeEntriesResult(
            command.TimeEntryIds.Count,
            results.Count(r => r.Success),
            results.Count(r => !r.Success),
            results));
    }

    public async Task<Result<TimeEntryDto>> UpdateTimeEntryAsync(UpdateTimeEntryCommand command, CancellationToken cancellationToken = default)
    {
        var validationResult = await _updateValidator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
        {
            var errors = string.Join(", ", validationResult.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<TimeEntryDto>(errors, "VALIDATION_ERROR");
        }

        // Fetch the time entry
        var timeEntry = await _db.Set<TimeEntry>()
            .Include(te => te.Employee)
            .Include(te => te.Phase)
            .Include(te => te.Equipment)
            .Include(te => te.SubmittedBy)
            .FirstOrDefaultAsync(te => te.Id == command.TimeEntryId, cancellationToken);

        if (timeEntry == null)
            return Result.Failure<TimeEntryDto>("Time entry not found", "NOT_FOUND");

        // Handle status transition if requested
        if (command.NewStatus.HasValue)
        {
            var transitionResult = await ValidateAndApplyStatusTransition(
                timeEntry, command, cancellationToken);

            if (!transitionResult.IsSuccess)
                return Result.Failure<TimeEntryDto>(transitionResult.Error!, transitionResult.ErrorCode);
        }

        // Update hours and fields only if entry is in Draft or Submitted status
        if (CanEditHours(timeEntry.Status))
        {
            if (command.RegularHours.HasValue)
                timeEntry.RegularHours = command.RegularHours.Value;

            if (command.OvertimeHours.HasValue)
                timeEntry.OvertimeHours = command.OvertimeHours.Value;

            if (command.DoubletimeHours.HasValue)
                timeEntry.DoubletimeHours = command.DoubletimeHours.Value;

            if (command.Description != null)
                timeEntry.Description = command.Description;

            // Phase update - validate belongs to project
            if (command.PhaseId.HasValue)
            {
                var phase = await _db.Set<Phase>()
                    .FirstOrDefaultAsync(p => p.Id == command.PhaseId.Value, cancellationToken);

                if (phase == null)
                    return Result.Failure<TimeEntryDto>("Phase not found", "PHASE_NOT_FOUND");

                if (phase.ProjectId != timeEntry.ProjectId)
                    return Result.Failure<TimeEntryDto>(
                        "Phase does not belong to the specified project",
                        "PHASE_PROJECT_MISMATCH");

                timeEntry.PhaseId = command.PhaseId.Value;
            }

            // Equipment update - validate exists and is active
            if (command.EquipmentId.HasValue)
            {
                var equipment = await _db.Set<Equipment>()
                    .FirstOrDefaultAsync(e => e.Id == command.EquipmentId.Value && e.IsActive, cancellationToken);

                if (equipment == null)
                    return Result.Failure<TimeEntryDto>(
                        "Equipment not found or inactive",
                        "EQUIPMENT_NOT_FOUND");

                timeEntry.EquipmentId = command.EquipmentId.Value;
            }

            if (command.EquipmentHours.HasValue)
                timeEntry.EquipmentHours = command.EquipmentHours.Value;
        }
        else if (command.RegularHours.HasValue || command.OvertimeHours.HasValue ||
                 command.DoubletimeHours.HasValue || command.PhaseId.HasValue ||
                 command.EquipmentId.HasValue || command.EquipmentHours.HasValue)
        {
            return Result.Failure<TimeEntryDto>(
                "Cannot modify hours, phase, or equipment on approved or rejected time entries",
                "INVALID_STATUS");
        }

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return Result.Success(TimeEntryMapper.ToDto(timeEntry));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure<TimeEntryDto>("Time entry was modified by another user", "CONFLICT");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update time entry {TimeEntryId}", command.TimeEntryId);
            return Result.Failure<TimeEntryDto>("Failed to update time entry", "DATABASE_ERROR");
        }
    }

    #endregion

    #region Private Helpers

    private sealed record BatchTimeEntryUpsert(TimeEntry TimeEntry, bool IsNew);

    private async Task<Result<BatchTimeEntryUpsert>> ValidateAndBuildTimeEntry(
        BatchTimeEntryItem item, bool isDraft, CancellationToken cancellationToken)
    {
        // Validate employee exists and is active
        var employee = await _db.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == item.EmployeeId && e.IsActive, cancellationToken);

        if (employee == null)
            return Result.Failure<BatchTimeEntryUpsert>("Employee not found or inactive", "EMPLOYEE_NOT_FOUND");

        // Validate project exists
        var project = await _db.Set<Project>()
            .FirstOrDefaultAsync(p => p.Id == item.ProjectId, cancellationToken);

        if (project == null)
            return Result.Failure<BatchTimeEntryUpsert>("Project not found", "PROJECT_NOT_FOUND");

        // For non-draft: validate project is not Completed/Closed
        if (!isDraft && (project.Status == ProjectStatus.Completed || project.Status == ProjectStatus.Closed))
            return Result.Failure<BatchTimeEntryUpsert>(
                "Cannot log time to a completed or closed project", "PROJECT_INACTIVE");

        // Validate employee is assigned to this project
        var hasAssignment = await _db.Set<ProjectAssignment>()
            .AnyAsync(pa => pa.EmployeeId == item.EmployeeId
                         && pa.ProjectId == item.ProjectId
                         && pa.IsActive
                         && pa.StartDate <= item.Date
                         && (pa.EndDate == null || pa.EndDate >= item.Date),
                      cancellationToken);

        if (!hasAssignment)
            return Result.Failure<BatchTimeEntryUpsert>(
                "Employee is not assigned to this project", "NOT_ASSIGNED_TO_PROJECT");

        // Auto-assign cost code if not provided
        var effectiveCostCodeId = item.CostCodeId;
        if (effectiveCostCodeId == Guid.Empty)
        {
            var laborCostCode = await _db.Set<CostCode>()
                .FirstOrDefaultAsync(cc => cc.Code == "LAB" && cc.IsActive, cancellationToken);

            if (laborCostCode != null)
            {
                effectiveCostCodeId = laborCostCode.Id;
            }
            else
            {
                return Result.Failure<BatchTimeEntryUpsert>(
                    "No cost code specified and no default labor cost code (LAB) found",
                    "COSTCODE_NOT_FOUND");
            }
        }

        // Validate cost code exists and is active
        var costCode = await _db.Set<CostCode>()
            .FirstOrDefaultAsync(cc => cc.Id == effectiveCostCodeId && cc.IsActive, cancellationToken);

        if (costCode == null)
            return Result.Failure<BatchTimeEntryUpsert>("Cost code not found or inactive", "COSTCODE_NOT_FOUND");

        // Validate PhaseId if provided
        if (item.PhaseId.HasValue)
        {
            var phase = await _db.Set<Phase>()
                .FirstOrDefaultAsync(p => p.Id == item.PhaseId.Value, cancellationToken);

            if (phase == null)
                return Result.Failure<BatchTimeEntryUpsert>("Phase not found", "PHASE_NOT_FOUND");

            if (phase.ProjectId != item.ProjectId)
                return Result.Failure<BatchTimeEntryUpsert>(
                    "Phase does not belong to the specified project", "PHASE_PROJECT_MISMATCH");
        }

        // Validate EquipmentId if provided
        if (item.EquipmentId.HasValue)
        {
            var equipment = await _db.Set<Equipment>()
                .FirstOrDefaultAsync(e => e.Id == item.EquipmentId.Value && e.IsActive, cancellationToken);

            if (equipment == null)
                return Result.Failure<BatchTimeEntryUpsert>("Equipment not found or inactive", "EQUIPMENT_NOT_FOUND");
        }

        // Resolve existing entry by explicit ID when provided, otherwise by unique key.
        var existingEntry = await _db.Set<TimeEntry>()
            .Include(te => te.Employee)
            .FirstOrDefaultAsync(te =>
                item.TimeEntryId.HasValue
                    ? te.Id == item.TimeEntryId.Value
                    : te.Date == item.Date
                      && te.EmployeeId == item.EmployeeId
                      && te.ProjectId == item.ProjectId
                      && te.CostCodeId == effectiveCostCodeId
                      && te.PhaseId == item.PhaseId,
                cancellationToken);

        if (existingEntry != null)
        {
            if (existingEntry.IsDeleted)
                return Result.Failure<BatchTimeEntryUpsert>("Time entry not found", "NOT_FOUND");

            if (item.TimeEntryId.HasValue && existingEntry.EmployeeId != item.EmployeeId)
                return Result.Failure<BatchTimeEntryUpsert>(
                    "TimeEntryId does not belong to the specified employee",
                    "EMPLOYEE_MISMATCH");

            if (existingEntry.Status != TimeEntryStatus.Draft)
                return Result.Failure<BatchTimeEntryUpsert>(
                    "Time entry already exists for this employee, project, cost code, and phase on this date",
                    "DUPLICATE_ENTRY");

            existingEntry.Date = item.Date;
            existingEntry.EmployeeId = item.EmployeeId;
            existingEntry.ProjectId = item.ProjectId;
            existingEntry.CostCodeId = effectiveCostCodeId;
            existingEntry.PhaseId = item.PhaseId;
            existingEntry.EquipmentId = item.EquipmentId;
            existingEntry.EquipmentHours = item.EquipmentHours;
            existingEntry.RegularHours = item.RegularHours;
            existingEntry.OvertimeHours = item.OvertimeHours;
            existingEntry.DoubletimeHours = item.DoubletimeHours;
            existingEntry.Description = item.Description;
            existingEntry.Employee = employee;

            return Result.Success(new BatchTimeEntryUpsert(existingEntry, IsNew: false));
        }

        var timeEntry = new TimeEntry
        {
            Date = item.Date,
            EmployeeId = item.EmployeeId,
            ProjectId = item.ProjectId,
            CostCodeId = effectiveCostCodeId,
            PhaseId = item.PhaseId,
            EquipmentId = item.EquipmentId,
            EquipmentHours = item.EquipmentHours,
            RegularHours = item.RegularHours,
            OvertimeHours = item.OvertimeHours,
            DoubletimeHours = item.DoubletimeHours,
            Description = item.Description,
            Employee = employee
        };

        return Result.Success(new BatchTimeEntryUpsert(timeEntry, IsNew: true));
    }

    private async Task<Result> ValidateAndApplyStatusTransition(
        TimeEntry timeEntry,
        UpdateTimeEntryCommand command,
        CancellationToken cancellationToken)
    {
        var currentStatus = timeEntry.Status;
        var newStatus = command.NewStatus!.Value;

        // Validate status transition is allowed
        if (!IsValidTransition(currentStatus, newStatus))
        {
            return Result.Failure(
                $"Cannot transition from {currentStatus} to {newStatus}",
                "INVALID_TRANSITION");
        }

        // For approval/rejection, validate approver has permission
        if (newStatus == TimeEntryStatus.Approved || newStatus == TimeEntryStatus.Rejected)
        {
            if (!command.ApproverId.HasValue)
            {
                return Result.Failure(
                    "Approver ID is required for approval/rejection",
                    "MISSING_APPROVER");
            }

            var hasPermission = await ValidateApproverPermission(
                command.ApproverId.Value,
                timeEntry.EmployeeId,
                cancellationToken);

            if (!hasPermission)
            {
                return Result.Failure(
                    "User does not have permission to approve/reject this time entry",
                    "UNAUTHORIZED");
            }

            // Set approval/rejection details
            timeEntry.ApprovedById = command.ApproverId.Value;
            timeEntry.ApprovedAt = DateTime.UtcNow;

            if (newStatus == TimeEntryStatus.Approved)
            {
                timeEntry.ApprovalComments = command.ApproverNotes;
                timeEntry.RejectionReason = null;
            }
            else if (newStatus == TimeEntryStatus.Rejected)
            {
                if (string.IsNullOrWhiteSpace(command.ApproverNotes))
                {
                    return Result.Failure(
                        "Rejection reason is required",
                        "MISSING_REJECTION_REASON");
                }
                timeEntry.RejectionReason = command.ApproverNotes;
                timeEntry.ApprovalComments = null;
            }
        }

        if (currentStatus == TimeEntryStatus.Draft && newStatus == TimeEntryStatus.Submitted)
        {
            timeEntry.SubmittedAt = DateTime.UtcNow;
            timeEntry.SubmittedById = command.SubmittedById;
        }

        timeEntry.Status = newStatus;
        return Result.Success();
    }

    private async Task<bool> ValidateApproverPermission(
        Guid approverId,
        Guid employeeId,
        CancellationToken cancellationToken)
    {
        // Get the approver
        var approver = await _db.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == approverId && e.IsActive, cancellationToken);

        if (approver == null)
            return false;

        // Supervisors can approve
        if (approver.Classification == EmployeeClassification.Supervisor)
            return true;

        // Salaried employees (typically managers) can approve
        if (approver.Classification == EmployeeClassification.Salaried)
            return true;

        // Check if approver is the employee's direct supervisor
        var employee = await _db.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == employeeId, cancellationToken);

        if (employee?.SupervisorId == approverId)
            return true;

        return false;
    }

    private static bool IsValidTransition(TimeEntryStatus from, TimeEntryStatus to)
    {
        return (from, to) switch
        {
            // Draft can go to Submitted
            (TimeEntryStatus.Draft, TimeEntryStatus.Submitted) => true,

            // Submitted can go to Approved, Rejected, or back to Draft
            (TimeEntryStatus.Submitted, TimeEntryStatus.Approved) => true,
            (TimeEntryStatus.Submitted, TimeEntryStatus.Rejected) => true,
            (TimeEntryStatus.Submitted, TimeEntryStatus.Draft) => true,

            // Rejected can go back to Draft (for corrections) or resubmitted
            (TimeEntryStatus.Rejected, TimeEntryStatus.Draft) => true,
            (TimeEntryStatus.Rejected, TimeEntryStatus.Submitted) => true,

            // Approved entries generally shouldn't change, but allow reverting if needed
            (TimeEntryStatus.Approved, TimeEntryStatus.Submitted) => true,

            // Same status is a no-op, allow it
            var (f, t) when f == t => true,

            _ => false
        };
    }

    private static bool CanEditHours(TimeEntryStatus status)
    {
        return status == TimeEntryStatus.Draft || status == TimeEntryStatus.Submitted;
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

    private static LaborCostSummary CreateEmptyCostSummary()
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

    private static string GenerateVistaCsv(List<TimeEntry> timeEntries)
    {
        var sb = new StringBuilder();

        // Write header row
        sb.AppendLine(string.Join(",", VistaHeaders.Select(EscapeCsvField)));

        // Write data rows
        foreach (var entry in timeEntries)
        {
            var row = FormatVistaRow(entry);
            sb.AppendLine(string.Join(",", row.Select(EscapeCsvField)));
        }

        return sb.ToString();
    }

    private static string[] FormatVistaRow(TimeEntry entry)
    {
        // Calculate amounts using Vista standard overtime multipliers
        const decimal overtimeMultiplier = 1.5m;
        const decimal doubletimeMultiplier = 2.0m;

        var hourlyRate = entry.Employee.BaseHourlyRate;
        var regularAmount = entry.RegularHours * hourlyRate;
        var overtimeAmount = entry.OvertimeHours * hourlyRate * overtimeMultiplier;
        var doubletimeAmount = entry.DoubletimeHours * hourlyRate * doubletimeMultiplier;
        var totalAmount = regularAmount + overtimeAmount + doubletimeAmount;

        // Equipment cost calculation
        var equipmentRate = entry.Equipment?.HourlyRate ?? 0;
        var equipmentAmount = entry.EquipmentHours * equipmentRate;

        return
        [
            entry.Employee.EmployeeNumber,
            entry.Employee.FullName,
            entry.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            entry.Project.Number ?? string.Empty,
            entry.Project.Name,
            entry.Phase?.CostCode ?? string.Empty,
            entry.Phase?.Name ?? string.Empty,
            entry.CostCode.Code,
            entry.CostCode.Description,
            entry.RegularHours.ToString("F2", CultureInfo.InvariantCulture),
            entry.OvertimeHours.ToString("F2", CultureInfo.InvariantCulture),
            entry.DoubletimeHours.ToString("F2", CultureInfo.InvariantCulture),
            entry.TotalHours.ToString("F2", CultureInfo.InvariantCulture),
            hourlyRate.ToString("F2", CultureInfo.InvariantCulture),
            regularAmount.ToString("F2", CultureInfo.InvariantCulture),
            overtimeAmount.ToString("F2", CultureInfo.InvariantCulture),
            doubletimeAmount.ToString("F2", CultureInfo.InvariantCulture),
            totalAmount.ToString("F2", CultureInfo.InvariantCulture),
            entry.Equipment?.Code ?? string.Empty,
            entry.Equipment?.Name ?? string.Empty,
            entry.EquipmentHours.ToString("F2", CultureInfo.InvariantCulture),
            equipmentRate.ToString("F2", CultureInfo.InvariantCulture),
            equipmentAmount.ToString("F2", CultureInfo.InvariantCulture),
            entry.Status.ToString(),
            entry.ApprovedBy?.FullName ?? string.Empty,
            entry.ApprovedAt?.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture) ?? string.Empty
        ];
    }

    /// <summary>
    /// Escape a field for CSV format (RFC 4180 compliant)
    /// </summary>
    private static string EscapeCsvField(string? field)
    {
        if (string.IsNullOrEmpty(field))
            return string.Empty;

        // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
        if (field.Contains(',') || field.Contains('"') || field.Contains('\n') || field.Contains('\r'))
        {
            return $"\"{field.Replace("\"", "\"\"")}\"";
        }

        return field;
    }

    #endregion
}
