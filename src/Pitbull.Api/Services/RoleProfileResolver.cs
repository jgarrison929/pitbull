namespace Pitbull.Api.Services;

/// <summary>
/// Single source of truth for persona detection from job title + Identity roles.
/// Used by morning briefing, dashboard layout defaults, and welcome tour.
/// </summary>
/// <remarks>
/// JWT Identity roles are coarse (Admin/Manager/Supervisor/User). RBAC template
/// names (Executive, ProjectManager) are NOT on the role claim — title keywords
/// are the primary signal for seeded demo personas.
/// </remarks>
public static class RoleProfileResolver
{
    /// <summary>
    /// Title-first profile detection. Same rules as the welcome tour.
    /// </summary>
    public static TourProfile Detect(string? title, IEnumerable<string>? roles)
    {
        var roleSet = roles is ISet<string> set
            ? set
            : new HashSet<string>(roles ?? Array.Empty<string>(), StringComparer.OrdinalIgnoreCase);

        // Normalize tenant-scoped roles ("{tenantId}:Manager" → "Manager")
        var logical = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var r in roleSet)
        {
            if (string.IsNullOrWhiteSpace(r)) continue;
            var colon = r.LastIndexOf(':');
            logical.Add(colon >= 0 && colon < r.Length - 1 ? r[(colon + 1)..] : r);
        }

        var t = title?.Trim() ?? "";

        // Title-based detection (first match wins, most specific first)
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

        if (logical.Contains("Admin"))
            return TourProfile.Executive;

        if (logical.Contains("Supervisor") || logical.Contains("Manager"))
            return TourProfile.ProjectManager;

        return TourProfile.General;
    }

    /// <summary>
    /// Briefing section key shown in UI ("Here's your {Role} briefing").
    /// Maps to BriefingService switch cases.
    /// </summary>
    public static string ToBriefingRole(TourProfile profile) => profile switch
    {
        TourProfile.Executive => "Executive",
        TourProfile.Cfo => "Controller",
        TourProfile.Clerk => "Controller",
        TourProfile.Field => "Foreman",
        TourProfile.Estimator => "Estimator",
        TourProfile.Hr => "HR",
        TourProfile.ItAdmin => "Admin",
        TourProfile.ProjectManager => "PM",
        _ => "PM",
    };

    /// <summary>
    /// Dashboard layout preference key (ValidLayouts in DashboardPreferencesService).
    /// </summary>
    public static string ToDashboardLayout(TourProfile profile) => profile switch
    {
        TourProfile.Executive => "executive",
        TourProfile.Cfo => "controller",
        TourProfile.ProjectManager => "pm",
        TourProfile.Field => "field",
        TourProfile.Estimator => "estimator",
        TourProfile.Clerk => "controller",
        _ => "default",
    };

    /// <summary>
    /// Stable string for JWT / API clients (camelCase-friendly).
    /// </summary>
    public static string ToApiName(TourProfile profile) => profile switch
    {
        TourProfile.Executive => "executive",
        TourProfile.Cfo => "cfo",
        TourProfile.ProjectManager => "projectManager",
        TourProfile.Field => "field",
        TourProfile.Clerk => "clerk",
        TourProfile.Hr => "hr",
        TourProfile.Estimator => "estimator",
        TourProfile.ItAdmin => "itAdmin",
        _ => "general",
    };

    private static bool MatchesAny(string title, params string[] keywords) =>
        keywords.Any(k => k.Length <= 4
            ? MatchesWholeWord(title, k)
            : title.Contains(k, StringComparison.OrdinalIgnoreCase));

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
}
