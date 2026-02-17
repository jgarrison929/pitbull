namespace Pitbull.Core.Domain;

/// <summary>
/// Company-level reporting and payroll configuration. Owned by Company entity.
/// Controls overtime rules, report branding, and fiscal calendar.
/// </summary>
public class ReportSettings
{
    /// <summary>
    /// Overtime rules mode. "Federal" = weekly 40hr only; "California" = daily 8hr + weekly 40hr.
    /// </summary>
    public string OvertimeRules { get; set; } = "Federal";

    /// <summary>
    /// Company name displayed on report headers and exports.
    /// </summary>
    public string ReportBrandingName { get; set; } = string.Empty;

    /// <summary>
    /// URL to the company logo used in report headers.
    /// </summary>
    public string ReportLogoUrl { get; set; } = string.Empty;

    /// <summary>
    /// Month (1-12) when the fiscal year starts.
    /// 1 = January (calendar year), 7 = July, 10 = October, etc.
    /// </summary>
    public int FiscalYearStartMonth { get; set; } = 1;
}
