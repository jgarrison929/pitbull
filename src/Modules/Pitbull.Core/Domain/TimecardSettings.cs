namespace Pitbull.Core.Domain;

/// <summary>
/// Timecard entry mode for the company.
/// Determines whether crews enter time daily or weekly.
/// </summary>
public enum TimecardMode
{
    /// <summary>Daily timecard entry (default). One day at a time.</summary>
    Daily = 0,

    /// <summary>Weekly timecard entry. Entire week submitted at once.</summary>
    Weekly = 1
}

/// <summary>
/// Weekly entry sub-mode. Only applies when TimecardMode is Weekly.
/// </summary>
public enum WeeklyEntryMode
{
    /// <summary>Simple weekly totals per employee (Reg/OT/DT totals).</summary>
    Simple = 0,

    /// <summary>Day-by-day breakdown within the week (default). Compliance-ready.</summary>
    Detailed = 1
}

/// <summary>
/// Company-level timecard configuration. Owned by Company entity.
/// Controls crew timecard grid behavior including entry mode,
/// required fields, and default values.
/// </summary>
public class TimecardSettings
{
    /// <summary>
    /// Daily or Weekly entry mode.
    /// </summary>
    public TimecardMode TimecardMode { get; set; } = TimecardMode.Daily;

    /// <summary>
    /// Simple (totals) or Detailed (day-by-day) when in Weekly mode.
    /// </summary>
    public WeeklyEntryMode WeeklyEntryMode { get; set; } = WeeklyEntryMode.Detailed;

    /// <summary>
    /// Optional default project pre-filled on all crew timecard rows.
    /// Null means no default (user must pick). Can be overridden per row.
    /// </summary>
    public Guid? DefaultProjectId { get; set; }

    /// <summary>
    /// Whether Phase is required on crew timecard entries.
    /// </summary>
    public bool RequirePhase { get; set; } = false;

    /// <summary>
    /// Whether Equipment is required on crew timecard entries.
    /// </summary>
    public bool RequireEquipment { get; set; } = false;

    /// <summary>
    /// Day the work week starts. 0 = Sunday, 1 = Monday (default), 6 = Saturday.
    /// Used for week boundaries in time tracking, approval, and reporting.
    /// </summary>
    public int WeekStartDay { get; set; } = 1;
}
