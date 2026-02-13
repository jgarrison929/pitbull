using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;
using Pitbull.TimeTracking.Features.CreateEmployee;
using Pitbull.TimeTracking.Features.GetEmployeeStats;
using Pitbull.TimeTracking.Features.ListEmployees;
using Pitbull.TimeTracking.Features.UpdateEmployee;

namespace Pitbull.TimeTracking.Services;

/// <summary>
/// Service for managing Employee operations, replacing MediatR-based handlers.
/// </summary>
public class EmployeeService : IEmployeeService
{
    private readonly PitbullDbContext _db;
    private readonly ILogger<EmployeeService> _logger;

    public EmployeeService(PitbullDbContext db, ILogger<EmployeeService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<Result<EmployeeDto>> GetEmployeeAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var employee = await _db.Set<Employee>()
            .Include(e => e.Supervisor)
            .FirstOrDefaultAsync(e => e.Id == id && !e.IsDeleted, cancellationToken);

        if (employee is null)
            return Result.Failure<EmployeeDto>("Employee not found", "NOT_FOUND");

        return Result.Success(EmployeeMapper.ToDto(employee));
    }

    public async Task<Result<PagedResult<EmployeeDto>>> GetEmployeesAsync(ListEmployeesQuery query, CancellationToken cancellationToken = default)
    {
        var dbQuery = _db.Set<Employee>()
            .Include(e => e.Supervisor)
            .Where(e => !e.IsDeleted)
            .AsQueryable();

        // Apply filters
        if (query.IsActive.HasValue)
            dbQuery = dbQuery.Where(e => e.IsActive == query.IsActive.Value);

        if (query.Classification.HasValue)
            dbQuery = dbQuery.Where(e => e.Classification == query.Classification.Value);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var searchTerm = query.Search.ToLower();
            dbQuery = dbQuery.Where(e =>
                e.EmployeeNumber.ToLower().Contains(searchTerm) ||
                e.FirstName.ToLower().Contains(searchTerm) ||
                e.LastName.ToLower().Contains(searchTerm) ||
                (e.Email != null && e.Email.ToLower().Contains(searchTerm)));
        }

        // Get total count before pagination
        var totalCount = await dbQuery.CountAsync(cancellationToken);

        // Apply ordering and pagination
        var items = await dbQuery
            .OrderBy(e => e.LastName)
            .ThenBy(e => e.FirstName)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(e => EmployeeMapper.ToDto(e))
            .ToListAsync(cancellationToken);

        var result = new PagedResult<EmployeeDto>(items, totalCount, query.Page, query.PageSize);
        return Result.Success(result);
    }

    public async Task<Result<IEnumerable<ProjectAssignmentDto>>> GetEmployeeProjectsAsync(
        Guid employeeId, bool activeOnly = true, CancellationToken cancellationToken = default)
    {
        var query = _db.Set<ProjectAssignment>()
            .Include(pa => pa.Employee)
            .Include(pa => pa.Project)
            .Where(pa => pa.EmployeeId == employeeId && !pa.IsDeleted);

        if (activeOnly)
            query = query.Where(pa => pa.IsActive);

        var assignments = await query
            .OrderBy(pa => pa.Project.Name)
            .Select(pa => ProjectAssignmentMapper.ToDto(pa))
            .ToListAsync(cancellationToken);

        return Result.Success<IEnumerable<ProjectAssignmentDto>>(assignments);
    }

    public async Task<Result<EmployeeStatsResponse>> GetEmployeeStatsAsync(Guid id, CancellationToken cancellationToken = default)
    {
        try
        {
            // Verify employee exists and get basic info
            var employee = await _db.Set<Employee>()
                .Where(e => e.Id == id && !e.IsDeleted)
                .Select(e => new { e.Id, e.FirstName, e.LastName, e.EmployeeNumber, e.BaseHourlyRate })
                .FirstOrDefaultAsync(cancellationToken);

            if (employee == null)
                return Result.Failure<EmployeeStatsResponse>("Employee not found", "EMPLOYEE_NOT_FOUND");

            // Get time entry stats using raw SQL for aggregations
            var statsSql = $@"
                SELECT 
                    COALESCE(SUM(""RegularHours""), 0) as ""RegularHours"",
                    COALESCE(SUM(""OvertimeHours""), 0) as ""OvertimeHours"",
                    COALESCE(SUM(""DoubletimeHours""), 0) as ""DoubleTimeHours"",
                    COUNT(*) as ""EntryCount"",
                    COUNT(*) FILTER (WHERE ""Status"" = 1) as ""ApprovedCount"",
                    COUNT(*) FILTER (WHERE ""Status"" = 0) as ""PendingCount"",
                    COUNT(DISTINCT ""ProjectId"") as ""ProjectCount"",
                    MIN(""Date"") as ""FirstDate"",
                    MAX(""Date"") as ""LastDate""
                FROM time_entries
                WHERE ""EmployeeId"" = '{id}'
                  AND ""IsDeleted"" = false";

            var stats = await _db.Database.SqlQueryRaw<TimeEntryStatsRow>(statsSql)
                .FirstAsync(cancellationToken);

            var totalHours = stats.RegularHours + stats.OvertimeHours + stats.DoubleTimeHours;

            // Calculate earnings using employee's rate
            var totalEarnings =
                (stats.RegularHours * employee.BaseHourlyRate) +
                (stats.OvertimeHours * employee.BaseHourlyRate * 1.5m) +
                (stats.DoubleTimeHours * employee.BaseHourlyRate * 2.0m);

            return Result.Success(new EmployeeStatsResponse(
                EmployeeId: id,
                FullName: $"{employee.FirstName} {employee.LastName}",
                EmployeeNumber: employee.EmployeeNumber,
                TotalHours: totalHours,
                RegularHours: stats.RegularHours,
                OvertimeHours: stats.OvertimeHours,
                DoubleTimeHours: stats.DoubleTimeHours,
                TotalEarnings: totalEarnings,
                TimeEntryCount: stats.EntryCount,
                ApprovedEntryCount: stats.ApprovedCount,
                PendingEntryCount: stats.PendingCount,
                ProjectCount: stats.ProjectCount,
                FirstEntryDate: stats.FirstDate.HasValue ? DateOnly.FromDateTime(stats.FirstDate.Value) : null,
                LastEntryDate: stats.LastDate.HasValue ? DateOnly.FromDateTime(stats.LastDate.Value) : null
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve employee statistics for {EmployeeId}", id);
            return Result.Failure<EmployeeStatsResponse>($"Failed to retrieve employee statistics: {ex.Message}", "EMPLOYEE_STATS_ERROR");
        }
    }

    public async Task<Result<EmployeeDto>> CreateEmployeeAsync(CreateEmployeeCommand command, CancellationToken cancellationToken = default)
    {
        // Auto-generate employee number if not provided
        string employeeNumber;
        if (string.IsNullOrWhiteSpace(command.EmployeeNumber))
        {
            var maxNumbers = await _db.Set<Employee>()
                .Where(e => e.EmployeeNumber.StartsWith("EMP-"))
                .Select(e => e.EmployeeNumber)
                .ToListAsync(cancellationToken);

            var nextNum = 1;
            if (maxNumbers.Count > 0)
            {
                nextNum = maxNumbers
                    .Select(n => int.TryParse(n.Replace("EMP-", ""), out var num) ? num : 0)
                    .DefaultIfEmpty(0)
                    .Max() + 1;
            }
            employeeNumber = $"EMP-{nextNum:D5}";
        }
        else
        {
            employeeNumber = command.EmployeeNumber;

            // Check for duplicate only if user provided a custom number
            var exists = await _db.Set<Employee>()
                .AnyAsync(e => e.EmployeeNumber == employeeNumber && !e.IsDeleted, cancellationToken);

            if (exists)
                return Result.Failure<EmployeeDto>("Employee number already exists", "DUPLICATE");
        }

        // Validate supervisor exists if provided
        if (command.SupervisorId.HasValue)
        {
            var supervisorExists = await _db.Set<Employee>()
                .AnyAsync(e => e.Id == command.SupervisorId.Value && !e.IsDeleted, cancellationToken);

            if (!supervisorExists)
                return Result.Failure<EmployeeDto>("Supervisor not found", "INVALID_SUPERVISOR");
        }

        var employee = new Employee
        {
            EmployeeNumber = employeeNumber,
            FirstName = command.FirstName,
            LastName = command.LastName,
            Email = command.Email,
            Phone = command.Phone,
            Title = command.Title,
            Classification = command.Classification,
            BaseHourlyRate = command.BaseHourlyRate,
            HireDate = command.HireDate,
            SupervisorId = command.SupervisorId,
            Notes = command.Notes,
            IsActive = true
        };

        _db.Set<Employee>().Add(employee);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return Result.Success(EmployeeMapper.ToDto(employee));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create employee {EmployeeNumber}", employeeNumber);
            return Result.Failure<EmployeeDto>("Failed to create employee", "DATABASE_ERROR");
        }
    }

    public async Task<Result<EmployeeDto>> UpdateEmployeeAsync(UpdateEmployeeCommand command, CancellationToken cancellationToken = default)
    {
        var employee = await _db.Set<Employee>()
            .Include(e => e.Supervisor)
            .FirstOrDefaultAsync(e => e.Id == command.EmployeeId && !e.IsDeleted, cancellationToken);

        if (employee is null)
            return Result.Failure<EmployeeDto>("Employee not found", "NOT_FOUND");

        // Validate supervisor if provided
        if (command.SupervisorId.HasValue)
        {
            var supervisorExists = await _db.Set<Employee>()
                .AnyAsync(e => e.Id == command.SupervisorId.Value && !e.IsDeleted, cancellationToken);

            if (!supervisorExists)
                return Result.Failure<EmployeeDto>("Supervisor not found", "INVALID_SUPERVISOR");

            // Prevent self-reference
            if (command.SupervisorId.Value == command.EmployeeId)
                return Result.Failure<EmployeeDto>("Employee cannot be their own supervisor", "INVALID_SUPERVISOR");
        }

        // Update fields
        employee.FirstName = command.FirstName;
        employee.LastName = command.LastName;
        employee.Email = command.Email;
        employee.Phone = command.Phone;
        employee.Title = command.Title;
        employee.Classification = command.Classification;
        employee.BaseHourlyRate = command.BaseHourlyRate;
        employee.HireDate = command.HireDate;
        employee.TerminationDate = command.TerminationDate;
        employee.SupervisorId = command.SupervisorId;
        employee.IsActive = command.IsActive;
        employee.Notes = command.Notes;

        try
        {
            await _db.SaveChangesAsync(cancellationToken);

            // Reload with supervisor for DTO
            if (command.SupervisorId.HasValue && employee.Supervisor is null)
            {
                employee = await _db.Set<Employee>()
                    .Include(e => e.Supervisor)
                    .FirstAsync(e => e.Id == command.EmployeeId, cancellationToken);
            }

            return Result.Success(EmployeeMapper.ToDto(employee));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update employee {EmployeeId}", command.EmployeeId);
            return Result.Failure<EmployeeDto>("Failed to update employee", "DATABASE_ERROR");
        }
    }
}

// Helper DTO for raw SQL query (internal to this file)
internal record TimeEntryStatsRow(
    decimal RegularHours,
    decimal OvertimeHours,
    decimal DoubleTimeHours,
    int EntryCount,
    int ApprovedCount,
    int PendingCount,
    int ProjectCount,
    DateTime? FirstDate,
    DateTime? LastDate
);
