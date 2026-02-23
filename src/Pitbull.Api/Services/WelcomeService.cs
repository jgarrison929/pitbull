using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Services;

/// <summary>
/// Manages the welcome/guided tour experience for new users.
/// Returns role-adaptive tour steps based on the user's Identity role and job title.
/// Tracks which tour steps have been seen and provides tour content.
/// </summary>
public interface IWelcomeService
{
    Task<WelcomeTourDto> GetTourAsync(Guid userId, CancellationToken ct = default);
    Task MarkStepSeenAsync(Guid userId, string stepId, CancellationToken ct = default);
    Task CompleteTourAsync(Guid userId, CancellationToken ct = default);
    Task ResetTourAsync(Guid userId, CancellationToken ct = default);
}

public class WelcomeService(
    PitbullDbContext db,
    UserManager<AppUser> userManager,
    ILogger<WelcomeService> logger) : IWelcomeService
{
    public async Task<WelcomeTourDto> GetTourAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
            return new WelcomeTourDto(false, [], [], false);

        var steps = await GetStepsForUserAsync(user);
        var seenSteps = await GetSeenStepsAsync(userId, ct);
        var isComplete = steps.All(s => seenSteps.Contains(s.Id));

        var stepDtos = steps.Select(s => new WelcomeTourStepDto(
            Id: s.Id,
            Title: s.Title,
            Description: s.Description,
            TargetPage: s.TargetPage,
            Order: s.Order,
            IsSeen: seenSteps.Contains(s.Id)
        )).ToList();

        return new WelcomeTourDto(
            IsNewUser: !isComplete && user.CreatedAt > DateTime.UtcNow.AddDays(-7),
            Steps: stepDtos,
            SeenStepIds: seenSteps,
            IsComplete: isComplete);
    }

    public async Task MarkStepSeenAsync(Guid userId, string stepId, CancellationToken ct = default)
    {
        var seenSteps = await GetSeenStepsAsync(userId, ct);
        if (seenSteps.Contains(stepId)) return;

        seenSteps.Add(stepId);
        await SaveSeenStepsAsync(userId, seenSteps, ct);
        logger.LogDebug("User {UserId} completed tour step {StepId}", userId, stepId);
    }

    public async Task CompleteTourAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return;

        var steps = await GetStepsForUserAsync(user);
        var allStepIds = steps.Select(s => s.Id).ToList();
        await SaveSeenStepsAsync(userId, allStepIds, ct);
        logger.LogInformation("User {UserId} completed the welcome tour", userId);
    }

    public async Task ResetTourAsync(Guid userId, CancellationToken ct = default)
    {
        await SaveSeenStepsAsync(userId, [], ct);
        logger.LogInformation("User {UserId} reset the welcome tour", userId);
    }

    // ── Role-adaptive step selection ──

    private async Task<WelcomeTourStep[]> GetStepsForUserAsync(AppUser user)
    {
        var roles = await userManager.GetRolesAsync(user);
        var logicalRoles = roles
            .Where(r => r.StartsWith($"{user.TenantId}:"))
            .Select(r => r[($"{user.TenantId}:".Length)..])
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var profile = DetectTourProfile(user.Title, logicalRoles);
        return GetStepsForProfile(profile);
    }

    /// <summary>
    /// Determines the tour profile from the user's title and roles.
    /// Title keywords take priority over roles because they're more specific —
    /// a "CFO" with Admin role needs finance steps, not generic executive steps.
    /// </summary>
    internal static TourProfile DetectTourProfile(string? title, ISet<string> roles)
    {
        var t = title?.Trim() ?? "";

        // Title-based detection (first match wins, most specific first)
        // Full-title forms are needed because acronyms (CIO, CTO) aren't substrings of "Chief Information Officer" etc.
        if (MatchesAny(t, "CIO", "CTO", "CISO", "Information Officer", "Technology Officer", "Information Security",
            "IT Manager", "IT Director", "VP of IT", "Director of IT"))
            return TourProfile.ItAdmin;

        if (MatchesAny(t, "HR", "Human Resources", "People Officer", "People Manager", "HR Coordinator", "HR Director"))
            return TourProfile.Hr;

        if (MatchesAny(t, "Estimator", "Estimating", "Chief Estimator", "Takeoff"))
            return TourProfile.Estimator;

        if (MatchesAny(t, "CFO", "Controller", "Accounting", "Financial Officer", "Financial", "VP of Accounting", "VP Controller"))
            return TourProfile.Cfo;

        if (MatchesAny(t, "AP Clerk", "AR Clerk", "Payroll Clerk", "Accounts Payable", "Accounts Receivable", "Staff Accountant"))
            return TourProfile.Clerk;

        if (MatchesAny(t, "Field Engineer", "Field Superintendent", "Foreman", "Commissioning"))
            return TourProfile.Field;

        if (MatchesAny(t, "Project Manager", "Sr Project Manager", "Project Engineer", "Sr Project Engineer", "Project Coordinator", "PM"))
            return TourProfile.ProjectManager;

        if (MatchesAny(t, "CEO", "COO", "President", "Executive", "Chief", "VP", "Director", "Officer"))
            return TourProfile.Executive;

        // Role-based fallback
        if (roles.Contains("Admin"))
            return TourProfile.Executive;

        if (roles.Contains("Supervisor") || roles.Contains("Manager"))
            return TourProfile.ProjectManager;

        return TourProfile.General;
    }

    private static bool MatchesAny(string title, params string[] keywords) =>
        keywords.Any(k => k.Length <= 4
            ? MatchesWholeWord(title, k)
            : title.Contains(k, StringComparison.OrdinalIgnoreCase));

    /// <summary>
    /// Matches a short keyword only at word boundaries to avoid false positives
    /// (e.g. "CTO" inside "Director", "HR" inside "Chrome").
    /// </summary>
    private static bool MatchesWholeWord(string title, string word)
    {
        var idx = title.IndexOf(word, StringComparison.OrdinalIgnoreCase);
        while (idx >= 0)
        {
            var before = idx == 0 || !char.IsLetterOrDigit(title[idx - 1]);
            var after = idx + word.Length >= title.Length || !char.IsLetterOrDigit(title[idx + word.Length]);
            if (before && after) return true;
            idx = title.IndexOf(word, idx + 1, StringComparison.OrdinalIgnoreCase);
        }
        return false;
    }

    private static WelcomeTourStep[] GetStepsForProfile(TourProfile profile) => profile switch
    {
        TourProfile.Executive => ExecutiveSteps,
        TourProfile.Cfo => CfoSteps,
        TourProfile.ProjectManager => ProjectManagerSteps,
        TourProfile.Field => FieldSteps,
        TourProfile.Clerk => ClerkSteps,
        TourProfile.Hr => HrSteps,
        TourProfile.Estimator => EstimatorSteps,
        TourProfile.ItAdmin => ItAdminSteps,
        _ => GeneralSteps,
    };

    // ── Step definitions by profile ──

    private static readonly WelcomeTourStep[] ExecutiveSteps =
    [
        new("exec-welcome", "Executive Dashboard", "Your command center. Switch to the Executive view for portfolio-level KPIs — revenue, backlog, margin trends — across all projects and companies.", "dashboard", 1),
        new("exec-briefing", "AI Morning Briefing", "Start your day with an AI-generated summary of what happened overnight — new change orders, overdue RFIs, and budget alerts that need your attention.", "dashboard", 2),
        new("exec-projects", "Projects Overview", "See every active project at a glance. Sort by budget health, schedule status, or contract value to quickly spot which jobs need executive attention.", "projects", 3),
        new("exec-reports", "Reports & Analytics", "Export profitability reports, labor cost trends, and WIP schedules. These are the numbers your bonding company and bank ask for.", "reports", 4),
        new("exec-companies", "Company Switcher", "Manage multiple entities (GC, mechanical sub, civil division) from one login. Switch companies or view consolidated data across all of them.", "admin/companies", 5),
        new("exec-admin", "System Administration", "Control who sees what. Manage users, roles, API keys, and system health from one place.", "admin/users", 6),
    ];

    private static readonly WelcomeTourStep[] CfoSteps =
    [
        new("cfo-welcome", "Financial Dashboard", "Switch to the Controller view for financial KPIs — AR aging, cash position, overbilling/underbilling, and margin analysis at a glance.", "dashboard", 1),
        new("cfo-wip", "WIP Schedule", "The cost-to-cost WIP calculation your auditors need. See projected gains/losses and over/under billing per project, updated in real time.", "accounting/wip", 2),
        new("cfo-aging", "AR Aging Report", "Track outstanding receivables by aging bucket (30/60/90+ days). Know exactly which owners owe you money and how long it's been.", "reports", 3),
        new("cfo-gl", "General Ledger & Journal Entries", "Post journal entries, close accounting periods, and review the full GL. Double-entry enforced — debits always equal credits.", "accounting/journal-entries", 4),
        new("cfo-bank", "Bank Reconciliation", "Match cleared transactions against your GL. Catch discrepancies before month-end close and keep your auditors happy.", "accounting/bank-reconciliation", 5),
        new("cfo-reports", "Financial Reports", "Generate the reports your bonding company needs: income statements, balance sheets, cash flow, and WIP schedules — exportable to CSV and PDF.", "reports", 6),
    ];

    private static readonly WelcomeTourStep[] ProjectManagerSteps =
    [
        new("pm-welcome", "Project Dashboard", "Your home base. Switch to the PM view for a project-centric dashboard — schedule variance, open RFIs, pending submittals, and upcoming deadlines.", "dashboard", 1),
        new("pm-schedule", "Project Schedule", "View and manage your project schedule. Track milestones, critical path items, and percent complete to keep the job on track.", "project-management", 2),
        new("pm-rfis", "RFIs & Submittals", "Track every question to the architect and every product submittal. Ball-in-court tracking shows you who's holding things up right now.", "rfis", 3),
        new("pm-dailies", "Daily Reports", "Document weather, manpower, activities, and safety observations. These are your first line of defense if a claim or dispute arises.", "daily-reports", 4),
        new("pm-time", "Time Tracking", "Review and approve crew time entries. Hours flow directly into job cost reports — \"labor hits job cost\" is the most important workflow in construction.", "time-tracking", 5),
        new("pm-costs", "Cost Tracking", "Monitor committed costs, budget vs. actual, and cost-to-complete projections. Catch budget overruns before they become margin killers.", "projects", 6),
    ];

    private static readonly WelcomeTourStep[] FieldSteps =
    [
        new("field-daily", "Daily Report", "Your most important daily task. Document weather, crew counts, equipment usage, and activities. This protects the company in disputes.", "daily-reports", 1),
        new("field-time", "Time Entry", "Log hours for yourself and your crew. Crew entry mode lets you enter time for everyone in under 30 seconds — pick the crew, pick the cost code, done.", "time-tracking", 2),
        new("field-punch", "Punch List", "Track close-out deficiencies by location. Walk the building, document issues, assign to the responsible sub, and track to completion.", "project-management", 3),
        new("field-projects", "Your Projects", "See the projects you're assigned to, check schedules, and review cost codes for accurate time entry.", "projects", 4),
    ];

    private static readonly WelcomeTourStep[] ClerkSteps =
    [
        new("clerk-invoices", "Invoice Queue", "Process vendor invoices — enter, match to POs, route for approval, and schedule payment. AI can auto-extract invoice data from uploaded PDFs.", "invoices", 1),
        new("clerk-po", "Purchase Orders", "Create and manage POs. When invoices arrive, match them to POs for three-way matching (PO → receipt → invoice).", "procurement", 2),
        new("clerk-payments", "Payment Applications", "Process AIA G702/G703 billing applications. Review subcontractor pay apps, verify completion percentages, and manage retention.", "payment-applications", 3),
        new("clerk-vendors", "Vendors & Customers", "Manage your vendor and customer records. Track contact info, insurance certificates, and payment terms in one place.", "vendors", 4),
        new("clerk-reports", "Reports", "Run AP aging, AR aging, and cash disbursement reports. Export to CSV for your accounting system or PDF for management.", "reports", 5),
    ];

    private static readonly WelcomeTourStep[] HrSteps =
    [
        new("hr-employees", "Employee List", "Your workforce at a glance. Add employees, track certifications, manage pay rates, and see who's active on which projects.", "employees", 1),
        new("hr-onboarding", "Employee Onboarding", "Set up new hire workflows — required documents, safety training, equipment checkout, and project assignments.", "settings/employee-onboarding", 2),
        new("hr-payroll", "Payroll & Certified Payroll", "Review timesheets, process payroll runs, and generate certified payroll reports (WH-347) for prevailing wage projects.", "payroll", 3),
        new("hr-time", "Time Tracking Oversight", "Monitor time entries across all projects. Approve or reject submissions, flag anomalies, and ensure labor compliance.", "time-tracking", 4),
        new("hr-compliance", "Compliance Documents", "Track employee certifications, licenses, and safety training. Get alerts before certifications expire.", "admin/compliance", 5),
    ];

    private static readonly WelcomeTourStep[] EstimatorSteps =
    [
        new("est-bids", "Bid Pipeline", "Track every bid from invitation through award or loss. See your win rate, pending bids, and upcoming due dates at a glance.", "bids", 1),
        new("est-projects", "Cost History", "Review completed project costs to improve future estimates. Actual cost data by cost code is the best estimating reference you have.", "projects", 2),
        new("est-costcodes", "Cost Codes", "Browse the CSI MasterFormat cost code library. These codes structure every estimate and tie directly into job cost tracking.", "cost-codes", 3),
        new("est-reports", "Estimating Reports", "Run bid-hit ratios, estimate vs. actual comparisons, and pipeline value reports to track your estimating department's performance.", "reports", 4),
    ];

    private static readonly WelcomeTourStep[] ItAdminSteps =
    [
        new("it-admin", "System Administration", "Your control panel. Manage users, roles, and permissions. The RBAC system supports fine-grained permissions per module.", "admin/users", 1),
        new("it-roles", "RBAC & Permissions", "Define what each role can access. Admin, Manager, Supervisor, User, and Viewer roles come pre-configured but are fully customizable.", "admin/roles", 2),
        new("it-health", "Health Dashboard", "Monitor API performance, database health, error rates, and request metrics. Catch problems before users report them.", "admin/system-health", 3),
        new("it-secrets", "Secrets Vault", "Manage API keys, integration credentials, and sensitive configuration values with full audit logging.", "admin/secrets", 4),
        new("it-ai", "AI Usage & Settings", "Monitor AI token usage, configure providers (Anthropic, OpenAI), and manage AI features across the platform.", "admin/ai-usage", 5),
    ];

    private static readonly WelcomeTourStep[] GeneralSteps =
    [
        new("welcome", "Welcome to Pitbull!", "Your construction management platform is ready. Let's take a quick tour of the key features.", "dashboard", 1),
        new("projects", "Projects", "Manage all your construction projects in one place. Track budgets, schedules, and team assignments.", "projects", 2),
        new("bids", "Bid Management", "Create and track bids with cost estimation, line items, and bid-to-project conversion.", "bids", 3),
        new("contracts", "Contracts", "Manage subcontracts, change orders, and payment applications.", "contracts", 4),
        new("employees", "Team Management", "Add employees, track time, and manage certifications.", "employees", 5),
        new("reports", "Reports", "Generate certified payroll, cost reports, and project summaries.", "reports", 6),
        new("settings", "Settings", "Configure your modules, company profile, and user preferences.", "settings", 7),
    ];

    // ── Tour progress persistence (user claims) ──

    private async Task<List<string>> GetSeenStepsAsync(Guid userId, CancellationToken ct)
    {
        var claim = await db.UserClaims
            .FirstOrDefaultAsync(c => c.UserId == userId && c.ClaimType == "tour_seen_steps", ct);

        if (claim?.ClaimValue is null) return [];
        return claim.ClaimValue.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();
    }

    private async Task SaveSeenStepsAsync(Guid userId, List<string> seenSteps, CancellationToken ct)
    {
        var claim = await db.UserClaims
            .FirstOrDefaultAsync(c => c.UserId == userId && c.ClaimType == "tour_seen_steps", ct);

        var value = string.Join(",", seenSteps);

        if (claim is null)
        {
            db.UserClaims.Add(new Microsoft.AspNetCore.Identity.IdentityUserClaim<Guid>
            {
                UserId = userId,
                ClaimType = "tour_seen_steps",
                ClaimValue = value
            });
        }
        else
        {
            claim.ClaimValue = value;
        }

        await db.SaveChangesAsync(ct);
    }
}

// ── Enums and DTOs ──

internal enum TourProfile
{
    Executive,
    Cfo,
    ProjectManager,
    Field,
    Clerk,
    Hr,
    Estimator,
    ItAdmin,
    General,
}

public record WelcomeTourStep(string Id, string Title, string Description, string TargetPage, int Order);

public record WelcomeTourStepDto(
    string Id,
    string Title,
    string Description,
    string TargetPage,
    int Order,
    bool IsSeen);

public record WelcomeTourDto(
    bool IsNewUser,
    List<WelcomeTourStepDto> Steps,
    List<string> SeenStepIds,
    bool IsComplete);
