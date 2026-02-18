using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.Projects.Domain;
using Pitbull.RFIs.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Api.Services;

public interface IDashboardAnalyticsService
{
    Task<DashboardAnalyticsDto> GetAnalyticsAsync(CancellationToken cancellationToken = default);
}

public sealed class DashboardAnalyticsService(
    PitbullDbContext db,
    ITenantContext tenantContext,
    ILogger<DashboardAnalyticsService> logger) : IDashboardAnalyticsService
{
    public async Task<DashboardAnalyticsDto> GetAnalyticsAsync(CancellationToken cancellationToken = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var thisWeekStart = StartOfWeekMonday(today);
        var thisWeekEnd = thisWeekStart.AddDays(6);
        var lastWeekStart = thisWeekStart.AddDays(-7);
        var lastWeekEnd = thisWeekStart.AddDays(-1);

        // Each sub-task is wrapped in SafeAsync so a single failure
        // returns a sensible default instead of crashing the whole dashboard.
        var activeProjectsTask = SafeAsync("ActiveProjects",
            () => db.Set<Project>().AsNoTracking()
                .CountAsync(p => p.Status != ProjectStatus.Completed, cancellationToken), 0);

        var totalEmployeesTask = SafeAsync("TotalEmployees",
            () => db.Set<Employee>().AsNoTracking()
                .CountAsync(e => e.IsActive, cancellationToken), 0);

        var hoursThisWeekTask = SafeAsync("HoursThisWeek",
            () => SumHoursInRange(thisWeekStart, thisWeekEnd, cancellationToken), 0m);

        var hoursLastWeekTask = SafeAsync("HoursLastWeek",
            () => SumHoursInRange(lastWeekStart, lastWeekEnd, cancellationToken), 0m);

        var pendingApprovalsTask = SafeAsync("PendingApprovals",
            () => db.Set<TimeEntry>().AsNoTracking()
                .CountAsync(te => te.Status == TimeEntryStatus.Submitted, cancellationToken), 0);

        var openRfisTask = SafeAsync("OpenRFIs",
            () => db.Set<Rfi>().AsNoTracking()
                .CountAsync(r => r.Status != RfiStatus.Closed, cancellationToken), 0);

        var recentActivityTask = SafeAsync("RecentActivity",
            () => GetRecentActivityAsync(cancellationToken),
            (IReadOnlyList<RecentActivityDto>)Array.Empty<RecentActivityDto>());

        var budgetHealthTask = SafeAsync("BudgetHealth",
            () => GetProjectBudgetHealthAsync(cancellationToken),
            (IReadOnlyList<ProjectBudgetHealthDto>)Array.Empty<ProjectBudgetHealthDto>());

        var laborHoursTrendTask = SafeAsync("LaborHoursTrend",
            () => GetLaborHoursTrendAsync(thisWeekStart, cancellationToken),
            (IReadOnlyList<LaborHoursTrendDto>)Array.Empty<LaborHoursTrendDto>());

        var deadlinesTask = SafeAsync("UpcomingDeadlines",
            () => GetUpcomingDeadlinesAsync(cancellationToken),
            (IReadOnlyList<UpcomingDeadlineDto>)Array.Empty<UpcomingDeadlineDto>());

        await Task.WhenAll(
            activeProjectsTask,
            totalEmployeesTask,
            hoursThisWeekTask,
            hoursLastWeekTask,
            pendingApprovalsTask,
            openRfisTask,
            recentActivityTask,
            budgetHealthTask,
            laborHoursTrendTask,
            deadlinesTask);

        return new DashboardAnalyticsDto(
            ActiveProjects: activeProjectsTask.Result,
            TotalEmployees: totalEmployeesTask.Result,
            HoursThisWeek: hoursThisWeekTask.Result,
            HoursLastWeek: hoursLastWeekTask.Result,
            PendingApprovals: pendingApprovalsTask.Result,
            OpenRFIs: openRfisTask.Result,
            UpcomingDeadlines: deadlinesTask.Result,
            RecentActivity: recentActivityTask.Result,
            ProjectBudgetHealth: budgetHealthTask.Result,
            LaborHoursTrend: laborHoursTrendTask.Result);
    }

    private async Task<T> SafeAsync<T>(string name, Func<Task<T>> factory, T fallback)
    {
        try
        {
            return await factory();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Dashboard analytics sub-task '{SubTask}' failed — returning default", name);
            return fallback;
        }
    }

    private async Task<decimal> SumHoursInRange(DateOnly start, DateOnly end, CancellationToken cancellationToken)
    {
        var sum = await db.Set<TimeEntry>()
            .AsNoTracking()
            .Where(te => te.Date >= start && te.Date <= end)
            .SumAsync(te => (decimal?)te.RegularHours + te.OvertimeHours + te.DoubletimeHours, cancellationToken);

        return sum ?? 0m;
    }

    private async Task<IReadOnlyList<UpcomingDeadlineDto>> GetUpcomingDeadlinesAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow.Date;

        var milestoneCandidates = await db.Set<PmScheduleActivity>()
            .AsNoTracking()
            .Where(a => a.ActivityType == ScheduleActivityType.Milestone)
            .Where(a => a.Status != ScheduleActivityStatus.Completed)
            .Where(a => a.PlannedFinish.HasValue && a.PlannedFinish.Value.Date >= now)
            .Join(
                db.Set<Project>().AsNoTracking(),
                a => a.ProjectId,
                p => p.Id,
                (a, p) => new
                {
                    ProjectName = p.Name,
                    Milestone = a.Name,
                    Date = a.PlannedFinish!.Value.Date
                })
            .ToListAsync(cancellationToken);

        var projectDeadlineCandidates = await db.Set<Project>()
            .AsNoTracking()
            .Where(p => p.Status != ProjectStatus.Completed)
            .Where(p => p.EstimatedCompletionDate.HasValue && p.EstimatedCompletionDate.Value.Date >= now)
            .Select(p => new
            {
                p.Name,
                Milestone = "Estimated Completion",
                Date = p.EstimatedCompletionDate!.Value.Date
            })
            .ToListAsync(cancellationToken);

        var combined = milestoneCandidates
            .Select(m => new UpcomingDeadlineDto(
                Date: m.Date,
                ProjectName: m.ProjectName,
                Milestone: m.Milestone,
                DaysRemaining: (m.Date - now).Days))
            .Concat(projectDeadlineCandidates.Select(d => new UpcomingDeadlineDto(
                Date: d.Date,
                ProjectName: d.Name,
                Milestone: d.Milestone,
                DaysRemaining: (d.Date - now).Days)))
            .OrderBy(d => d.Date)
            .ThenBy(d => d.ProjectName)
            .Take(5)
            .ToList();

        return combined;
    }

    private async Task<IReadOnlyList<RecentActivityDto>> GetRecentActivityAsync(CancellationToken cancellationToken)
    {
        var tenantId = tenantContext.TenantId;
        return await db.Set<AuditLog>()
            .AsNoTracking()
            .Where(a => a.TenantId == tenantId)
            .OrderByDescending(a => a.Timestamp)
            .Take(10)
            .Select(a => new RecentActivityDto(
                string.IsNullOrWhiteSpace(a.UserName) ? (a.UserEmail ?? "System") : a.UserName!,
                a.Action.ToString(),
                a.ResourceType,
                a.Timestamp))
            .ToListAsync(cancellationToken);
    }

    private async Task<IReadOnlyList<ProjectBudgetHealthDto>> GetProjectBudgetHealthAsync(CancellationToken cancellationToken)
    {
        var activeProjects = await db.Set<Project>()
            .AsNoTracking()
            .Where(p => p.Status != ProjectStatus.Completed)
            .Select(p => new { p.Id, p.Name, Budget = p.ContractAmount })
            .ToListAsync(cancellationToken);

        // Use a simpler hours-based calculation that avoids navigation property issues.
        // Employee.BaseHourlyRate access in GroupBy can fail if employees are deleted or have
        // null navigation, so we compute hours and join rates in memory.
        var hoursByProject = await db.Set<TimeEntry>()
            .AsNoTracking()
            .Where(te => te.Status == TimeEntryStatus.Approved)
            .GroupBy(te => te.ProjectId)
            .Select(g => new
            {
                ProjectId = g.Key,
                Spent = g.Sum(te =>
                    (te.RegularHours * (te.Employee != null ? te.Employee.BaseHourlyRate : 0m))
                    + (te.OvertimeHours * (te.Employee != null ? te.Employee.BaseHourlyRate : 0m) * 1.5m)
                    + (te.DoubletimeHours * (te.Employee != null ? te.Employee.BaseHourlyRate : 0m) * 2.0m)
                    + (te.EquipmentId.HasValue ? te.EquipmentHours * (te.Equipment != null ? te.Equipment.HourlyRate : 0m) : 0m))
            })
            .ToDictionaryAsync(x => x.ProjectId, x => x.Spent, cancellationToken);

        var rows = activeProjects
            .Select(p =>
            {
                hoursByProject.TryGetValue(p.Id, out var spent);
                var percentUsed = p.Budget <= 0 ? 0m : (spent / p.Budget) * 100m;
                return new ProjectBudgetHealthDto(p.Name, p.Budget, spent, percentUsed);
            })
            .OrderByDescending(r => r.PercentUsed)
            .Take(8)
            .ToList();

        return rows;
    }

    private async Task<IReadOnlyList<LaborHoursTrendDto>> GetLaborHoursTrendAsync(
        DateOnly currentWeekStart,
        CancellationToken cancellationToken)
    {
        var firstWeekStart = currentWeekStart.AddDays(-21);
        var endDate = currentWeekStart.AddDays(6);

        var entries = await db.Set<TimeEntry>()
            .AsNoTracking()
            .Where(te => te.Date >= firstWeekStart && te.Date <= endDate)
            .Select(g => new
            {
                Date = g.Date,
                Hours = g.RegularHours + g.OvertimeHours + g.DoubletimeHours
            })
            .ToListAsync(cancellationToken);

        var grouped = entries
            .GroupBy(te => StartOfWeekMonday(te.Date))
            .Select(g => new
            {
                WeekStart = g.Key,
                TotalHours = g.Sum(x => x.Hours)
            })
            .ToList();

        var map = grouped.ToDictionary(x => x.WeekStart, x => x.TotalHours);

        var trend = Enumerable.Range(0, 4)
            .Select(i =>
            {
                var weekStart = firstWeekStart.AddDays(i * 7);
                map.TryGetValue(weekStart, out var totalHours);
                return new LaborHoursTrendDto(weekStart, totalHours);
            })
            .ToList();

        return trend;
    }

    private static DateOnly StartOfWeekMonday(DateOnly date)
    {
        var offset = (7 + (int)date.DayOfWeek - (int)DayOfWeek.Monday) % 7;
        return date.AddDays(-offset);
    }
}

public sealed record DashboardAnalyticsDto(
    int ActiveProjects,
    int TotalEmployees,
    decimal HoursThisWeek,
    decimal HoursLastWeek,
    int PendingApprovals,
    int OpenRFIs,
    IReadOnlyList<UpcomingDeadlineDto> UpcomingDeadlines,
    IReadOnlyList<RecentActivityDto> RecentActivity,
    IReadOnlyList<ProjectBudgetHealthDto> ProjectBudgetHealth,
    IReadOnlyList<LaborHoursTrendDto> LaborHoursTrend);

public sealed record UpcomingDeadlineDto(
    DateTime Date,
    string ProjectName,
    string Milestone,
    int DaysRemaining);

public sealed record RecentActivityDto(
    string User,
    string Action,
    string Entity,
    DateTime Timestamp);

public sealed record ProjectBudgetHealthDto(
    string Name,
    decimal Budget,
    decimal Spent,
    decimal PercentUsed);

public sealed record LaborHoursTrendDto(
    DateOnly WeekStart,
    decimal TotalHours);
