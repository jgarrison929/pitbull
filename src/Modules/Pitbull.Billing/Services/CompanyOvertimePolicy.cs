using Pitbull.Core.Domain;

namespace Pitbull.Billing.Services;

/// <summary>
/// Merges OvertimeSettings and ReportSettings into a single effective policy for payroll.
/// </summary>
public static class CompanyOvertimePolicy
{
    public static OvertimeSettings Resolve(Company? company)
    {
        if (company is null)
            return new OvertimeSettings();

        OvertimeSettings ot = company.OvertimeSettings;
        ReportSettings report = company.ReportSettings;

        bool california = ot.CaliforniaOtRules
            || string.Equals(report.OvertimeRules, "California", StringComparison.OrdinalIgnoreCase);

        bool useReportThresholds = california
            || string.Equals(report.OvertimeRules, "Custom", StringComparison.OrdinalIgnoreCase);

        return new OvertimeSettings
        {
            Enabled = ot.Enabled && report.OvertimeEnabled,
            DailyOtThreshold = useReportThresholds ? report.DailyOvertimeThreshold : ot.DailyOtThreshold,
            DailyDtThreshold = useReportThresholds ? report.DailyDoubletimeThreshold : ot.DailyDtThreshold,
            WeeklyOtThreshold = useReportThresholds ? report.WeeklyOvertimeThreshold : ot.WeeklyOtThreshold,
            CaliforniaOtRules = california
        };
    }
}