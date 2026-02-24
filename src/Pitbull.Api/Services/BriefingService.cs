using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.Billing.Features.Aging;
using Pitbull.Contracts.Domain;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.Projects.Domain;
using Pitbull.RFIs.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Api.Services;

// ── DTOs ──

public sealed record MorningBriefingDto(
    string Greeting,
    string Role,
    DateTime GeneratedAtUtc,
    BriefingCoreSection Core,
    BriefingPmSection? Pm,
    BriefingControllerSection? Controller,
    BriefingForemanSection? Foreman,
    BriefingExecutiveSection? Executive);

public sealed record BriefingCoreSection(
    int ActiveProjectCount,
    int PendingApprovals,
    int UnreadNotifications);

public sealed record BriefingPmSection(
    int OpenRfiCount,
    int OverdueRfiCount,
    int PendingSubmittals,
    int TodaysMeetingCount);

public sealed record BriefingControllerSection(
    decimal ArOverdue,
    decimal ApDueThisWeek,
    decimal NetCashPosition,
    int PendingPayApps);

public sealed record BriefingForemanSection(
    int CrewSize,
    decimal PendingTimeEntryHours,
    int TodaysProjectCount);

public sealed record BriefingExecutiveSection(
    decimal TotalContractValue,
    int ProjectsOverBudget,
    int OpenChangeOrders);

// ── Interface ──

public interface IBriefingService
{
    Task<MorningBriefingDto> GetMorningBriefingAsync(
        Guid userId, string userName, IReadOnlyList<string> roles,
        CancellationToken ct = default);
}

// ── Implementation ──

public sealed class BriefingService(
    PitbullDbContext db,
    ICompanyContext companyContext,
    IAgingReportService agingReportService,
    ILogger<BriefingService> logger) : IBriefingService
{
    public async Task<MorningBriefingDto> GetMorningBriefingAsync(
        Guid userId, string userName, IReadOnlyList<string> roles,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var primaryRole = ResolvePrimaryRole(roles);
        var timezone = await ResolveTimezoneAsync(ct);
        var greeting = BuildGreeting(userName, now, timezone);

        // Core section (universal for all roles)
        var core = await BuildCoreSectionAsync(userId, ct);

        // Role-specific sections — only populate the matching one
        BriefingPmSection? pm = null;
        BriefingControllerSection? controller = null;
        BriefingForemanSection? foreman = null;
        BriefingExecutiveSection? executive = null;

        switch (primaryRole)
        {
            case "Executive":
                executive = await BuildExecutiveSectionAsync(ct);
                break;
            case "Controller":
                controller = await BuildControllerSectionAsync(ct);
                break;
            case "Foreman":
                foreman = await BuildForemanSectionAsync(ct);
                break;
            default: // PM is the fallback
                pm = await BuildPmSectionAsync(ct);
                break;
        }

        return new MorningBriefingDto(
            Greeting: greeting,
            Role: primaryRole,
            GeneratedAtUtc: now,
            Core: core,
            Pm: pm,
            Controller: controller,
            Foreman: foreman,
            Executive: executive);
    }

    private async Task<BriefingCoreSection> BuildCoreSectionAsync(Guid userId, CancellationToken ct)
    {
        var activeProjects = await SafeAsync("ActiveProjects",
            () => db.Set<Project>().AsNoTracking()
                .CountAsync(p => p.Status != ProjectStatus.Completed, ct), 0);

        var pendingApprovals = await SafeAsync("PendingApprovals",
            () => db.Set<TimeEntry>().AsNoTracking()
                .CountAsync(te => te.Status == TimeEntryStatus.Submitted, ct), 0);

        var unreadNotifications = await SafeAsync("UnreadNotifications",
            () => db.Set<Pitbull.Notifications.Domain.Notification>().AsNoTracking()
                .CountAsync(n => !n.IsRead && n.UserId == userId, ct), 0);

        return new BriefingCoreSection(activeProjects, pendingApprovals, unreadNotifications);
    }

    private async Task<BriefingPmSection> BuildPmSectionAsync(CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;

        var openRfis = await SafeAsync("OpenRFIs",
            () => db.Set<Rfi>().AsNoTracking()
                .CountAsync(r => r.Status == RfiStatus.Open, ct), 0);

        var overdueRfis = await SafeAsync("OverdueRFIs",
            () => db.Set<Rfi>().AsNoTracking()
                .CountAsync(r => r.Status == RfiStatus.Open
                    && r.DueDate.HasValue && r.DueDate.Value < today, ct), 0);

        var pendingSubmittals = await SafeAsync("PendingSubmittals",
            () => db.Set<PmSubmittal>().AsNoTracking()
                .CountAsync(s => s.Status == SubmittalStatus.Submitted
                    || s.Status == SubmittalStatus.InReview, ct), 0);

        var todaysMeetings = await SafeAsync("TodaysMeetings",
            () => db.Set<PmMeeting>().AsNoTracking()
                .CountAsync(m => m.ScheduledStart.Date == today, ct), 0);

        return new BriefingPmSection(openRfis, overdueRfis, pendingSubmittals, todaysMeetings);
    }

    private async Task<BriefingControllerSection> BuildControllerSectionAsync(CancellationToken ct)
    {
        decimal arOverdue = 0m;
        decimal apDueThisWeek = 0m;
        decimal netCashPosition = 0m;

        var agingResult = await SafeAsync("AgingSummary",
            async () =>
            {
                var result = await agingReportService.GetAgingSummaryAsync(ct: ct);
                return result.IsSuccess ? result.Value : null;
            },
            (AgingSummaryResult?)null);

        if (agingResult != null)
        {
            arOverdue = agingResult.AccountsReceivable.Days31To60
                + agingResult.AccountsReceivable.Days61To90
                + agingResult.AccountsReceivable.Days90Plus;
            apDueThisWeek = agingResult.AccountsPayable.Current
                + agingResult.AccountsPayable.Days1To30;
            netCashPosition = agingResult.NetPosition;
        }

        var pendingPayApps = await SafeAsync("PendingPayApps",
            () => db.Set<PaymentApplication>().AsNoTracking()
                .CountAsync(pa => pa.Status == PaymentApplicationStatus.Submitted
                    || pa.Status == PaymentApplicationStatus.Reviewed, ct), 0);

        return new BriefingControllerSection(arOverdue, apDueThisWeek, netCashPosition, pendingPayApps);
    }

    private async Task<BriefingForemanSection> BuildForemanSectionAsync(CancellationToken ct)
    {
        var crewSize = await SafeAsync("CrewSize",
            () => db.Set<Employee>().AsNoTracking()
                .CountAsync(e => e.IsActive, ct), 0);

        var pendingHours = await SafeAsync("PendingHours",
            () => db.Set<TimeEntry>().AsNoTracking()
                .Where(te => te.Status == TimeEntryStatus.Draft)
                .SumAsync(te => (decimal?)(te.RegularHours + te.OvertimeHours + te.DoubletimeHours), ct), 0m);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var todaysProjects = await SafeAsync("TodaysProjects",
            () => db.Set<TimeEntry>().AsNoTracking()
                .Where(te => te.Date == today)
                .Select(te => te.ProjectId)
                .Distinct()
                .CountAsync(ct), 0);

        return new BriefingForemanSection(crewSize, pendingHours ?? 0m, todaysProjects);
    }

    private async Task<BriefingExecutiveSection> BuildExecutiveSectionAsync(CancellationToken ct)
    {
        var totalContractValue = await SafeAsync("TotalContractValue",
            () => db.Set<Project>().AsNoTracking()
                .Where(p => p.Status != ProjectStatus.Completed)
                .SumAsync(p => (decimal?)p.ContractAmount, ct), 0m);

        // Projects over budget: compare approved time cost to contract amount
        var overBudget = await SafeAsync("OverBudget", async () =>
        {
            var projects = await db.Set<Project>().AsNoTracking()
                .Where(p => p.Status != ProjectStatus.Completed && p.ContractAmount > 0)
                .Select(p => new { p.Id, p.ContractAmount })
                .ToListAsync(ct);

            var costsByProject = await db.Set<TimeEntry>().AsNoTracking()
                .Where(te => te.Status == TimeEntryStatus.Approved)
                .GroupBy(te => te.ProjectId)
                .Select(g => new
                {
                    ProjectId = g.Key,
                    Cost = g.Sum(te =>
                        (te.RegularHours * (te.Employee != null ? te.Employee.BaseHourlyRate : 0m))
                        + (te.OvertimeHours * (te.Employee != null ? te.Employee.BaseHourlyRate : 0m) * 1.5m)
                        + (te.DoubletimeHours * (te.Employee != null ? te.Employee.BaseHourlyRate : 0m) * 2.0m))
                })
                .ToDictionaryAsync(x => x.ProjectId, x => x.Cost, ct);

            return projects.Count(p =>
                costsByProject.TryGetValue(p.Id, out var cost) && cost > p.ContractAmount);
        }, 0);

        var openChangeOrders = await SafeAsync("OpenChangeOrders",
            () => db.Set<ChangeOrder>().AsNoTracking()
                .CountAsync(co => co.Status == ChangeOrderStatus.Pending
                    || co.Status == ChangeOrderStatus.UnderReview, ct), 0);

        return new BriefingExecutiveSection(totalContractValue ?? 0m, overBudget, openChangeOrders);
    }

    private static string ResolvePrimaryRole(IReadOnlyList<string> roles)
    {
        // Priority: Executive > Controller > PM > Foreman (fallback = PM)
        if (roles.Any(r => r.Equals("Executive", StringComparison.OrdinalIgnoreCase)
            || r.Equals("Admin", StringComparison.OrdinalIgnoreCase))) return "Executive";
        if (roles.Any(r => r.Equals("Controller", StringComparison.OrdinalIgnoreCase)
            || r.Equals("CFO", StringComparison.OrdinalIgnoreCase))) return "Controller";
        if (roles.Any(r => r.Equals("Foreman", StringComparison.OrdinalIgnoreCase)
            || r.Equals("Superintendent", StringComparison.OrdinalIgnoreCase)
            || r.Equals("FieldSupervisor", StringComparison.OrdinalIgnoreCase))) return "Foreman";
        return "PM";
    }

    /// <summary>
    /// Resolves the timezone for the current company from the database.
    /// Falls back to "America/Los_Angeles" if not found or not resolved.
    /// </summary>
    private async Task<string> ResolveTimezoneAsync(CancellationToken ct)
    {
        const string fallback = "America/Los_Angeles";
        if (!companyContext.IsResolved) return fallback;

        try
        {
            var tz = await db.Set<Company>()
                .Where(c => c.Id == companyContext.CompanyId)
                .Select(c => c.Timezone)
                .FirstOrDefaultAsync(ct);
            return string.IsNullOrWhiteSpace(tz) ? fallback : tz;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to resolve company timezone; using fallback");
            return fallback;
        }
    }

    internal static string BuildGreeting(string userName, DateTime utcNow, string timezoneId = "America/Los_Angeles")
    {
        var firstName = userName.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? userName;
        try
        {
            var zone = TimeZoneInfo.FindSystemTimeZoneById(timezoneId);
            var localTime = TimeZoneInfo.ConvertTimeFromUtc(utcNow, zone);
            var hour = localTime.Hour;
            var timeOfDay = hour switch
            {
                < 12 => "Good morning",
                < 17 => "Good afternoon",
                _ => "Good evening"
            };
            return $"{timeOfDay}, {firstName}";
        }
        catch
        {
            // Fallback if timezone conversion fails (invalid IANA id, etc.)
            return $"Welcome back, {firstName}";
        }
    }

    private async Task<T> SafeAsync<T>(string name, Func<Task<T>> factory, T fallback)
    {
        try
        {
            return await factory();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Briefing sub-task '{SubTask}' failed — returning default", name);
            return fallback;
        }
    }
}
