namespace Pitbull.Core.Domain;

/// <summary>
/// Company-level reporting and payroll configuration. Owned by Company entity.
/// Controls overtime rules, report branding, and fiscal calendar.
/// </summary>
public class ReportSettings
{
    /// <summary>
    /// Overtime rules preset. "Federal" = weekly 40hr only; "California" = daily 8hr + weekly 40hr; "Custom" = user-defined thresholds.
    /// </summary>
    public string OvertimeRules { get; set; } = "Federal";

    /// <summary>
    /// Whether overtime calculation is enabled at all.
    /// </summary>
    public bool OvertimeEnabled { get; set; } = true;

    /// <summary>
    /// Hours per day before overtime rate applies (e.g., 8 for California rules).
    /// </summary>
    public decimal DailyOvertimeThreshold { get; set; } = 8m;

    /// <summary>
    /// Hours per day before double-time rate applies (e.g., 12 for California rules).
    /// </summary>
    public decimal DailyDoubletimeThreshold { get; set; } = 12m;

    /// <summary>
    /// Hours per week before overtime rate applies (e.g., 40 for Federal rules).
    /// </summary>
    public decimal WeeklyOvertimeThreshold { get; set; } = 40m;

    /// <summary>
    /// Pay classification for Saturday hours: "regular", "overtime", or "doubletime".
    /// </summary>
    public string SaturdayRule { get; set; } = "overtime";

    /// <summary>
    /// Pay classification for Sunday hours: "regular", "overtime", or "doubletime".
    /// </summary>
    public string SundayRule { get; set; } = "doubletime";

    /// <summary>
    /// Pay classification for holiday hours: "overtime" or "doubletime".
    /// </summary>
    public string HolidayRule { get; set; } = "doubletime";

    /// <summary>
    /// JSON array of holiday objects with id, name, date (MM-DD), and recurring flag.
    /// </summary>
    public string HolidaysJson { get; set; } = "[]";

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
