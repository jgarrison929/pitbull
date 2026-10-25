namespace Pitbull.Core.Domain;

/// <summary>
/// Company-level overtime calculation configuration. Owned by Company entity.
/// Controls how regular, overtime, and double-time hours are classified.
/// </summary>
public class OvertimeSettings
{
    /// <summary>
    /// Whether overtime calculation is enabled. When false, all hours are regular.
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Daily hours before overtime kicks in (e.g., 8 for California rules).
    /// </summary>
    public decimal DailyOtThreshold { get; set; } = 8;

    /// <summary>
    /// Weekly hours before overtime kicks in (e.g., 40 per federal law).
    /// </summary>
    public decimal WeeklyOtThreshold { get; set; } = 40;

    /// <summary>
    /// Daily hours before double-time kicks in (e.g., 12 for California rules).
    /// </summary>
    public decimal DailyDtThreshold { get; set; } = 12;

    /// <summary>
    /// Enables California-style overtime rules:
    /// - Daily OT after 8 hours
    /// - Daily DT after 12 hours
    /// - 7th consecutive day rules
    /// When false, only weekly OT threshold applies (federal rules).
    /// </summary>
    public bool CaliforniaOtRules { get; set; } = false;
}
