using FluentAssertions;
using Pitbull.Billing.Services;
using Pitbull.Core.Domain;

namespace Pitbull.Tests.Unit.Billing;

public class CompanyOvertimePolicyTests
{
    [Fact]
    public void Resolve_NullCompany_ReturnsDefaultSettings()
    {
        OvertimeSettings result = CompanyOvertimePolicy.Resolve(null);

        result.Enabled.Should().BeTrue();
        result.DailyOtThreshold.Should().Be(8m);
        result.CaliforniaOtRules.Should().BeFalse();
    }

    [Fact]
    public void Resolve_CaliforniaReportPreset_UsesReportThresholdsAndEnablesCaliforniaRules()
    {
        Company company = new()
        {
            OvertimeSettings = new OvertimeSettings
            {
                Enabled = true,
                DailyOtThreshold = 10m,
                WeeklyOtThreshold = 40m,
                DailyDtThreshold = 14m
            },
            ReportSettings = new ReportSettings
            {
                OvertimeRules = "California",
                OvertimeEnabled = true,
                DailyOvertimeThreshold = 6m,
                DailyDoubletimeThreshold = 10m,
                WeeklyOvertimeThreshold = 38m
            }
        };

        OvertimeSettings result = CompanyOvertimePolicy.Resolve(company);

        result.Enabled.Should().BeTrue();
        result.CaliforniaOtRules.Should().BeTrue();
        result.DailyOtThreshold.Should().Be(6m);
        result.DailyDtThreshold.Should().Be(10m);
        result.WeeklyOtThreshold.Should().Be(38m);
    }

    [Fact]
    public void Resolve_CustomReportPreset_UsesReportThresholdsWithoutCaliforniaFlag()
    {
        Company company = new()
        {
            OvertimeSettings = new OvertimeSettings { Enabled = true, DailyOtThreshold = 8m },
            ReportSettings = new ReportSettings
            {
                OvertimeRules = "Custom",
                OvertimeEnabled = true,
                DailyOvertimeThreshold = 7m,
                DailyDoubletimeThreshold = 11m,
                WeeklyOvertimeThreshold = 42m
            }
        };

        OvertimeSettings result = CompanyOvertimePolicy.Resolve(company);

        result.CaliforniaOtRules.Should().BeFalse();
        result.DailyOtThreshold.Should().Be(7m);
        result.DailyDtThreshold.Should().Be(11m);
        result.WeeklyOtThreshold.Should().Be(42m);
    }

    [Fact]
    public void Resolve_FederalPreset_KeepsOvertimeSettingsThresholds()
    {
        Company company = new()
        {
            OvertimeSettings = new OvertimeSettings
            {
                Enabled = true,
                DailyOtThreshold = 9m,
                WeeklyOtThreshold = 40m,
                DailyDtThreshold = 12m,
                CaliforniaOtRules = false
            },
            ReportSettings = new ReportSettings
            {
                OvertimeRules = "Federal",
                OvertimeEnabled = true,
                DailyOvertimeThreshold = 6m
            }
        };

        OvertimeSettings result = CompanyOvertimePolicy.Resolve(company);

        result.DailyOtThreshold.Should().Be(9m);
        result.CaliforniaOtRules.Should().BeFalse();
    }

    [Fact]
    public void Resolve_ReportOvertimeDisabled_DisablesPolicy()
    {
        Company company = new()
        {
            OvertimeSettings = new OvertimeSettings { Enabled = true },
            ReportSettings = new ReportSettings { OvertimeEnabled = false }
        };

        OvertimeSettings result = CompanyOvertimePolicy.Resolve(company);

        result.Enabled.Should().BeFalse();
    }

    [Fact]
    public void Resolve_OvertimeSettingsCaliforniaFlag_EnablesCaliforniaWithoutReportPreset()
    {
        Company company = new()
        {
            OvertimeSettings = new OvertimeSettings
            {
                Enabled = true,
                CaliforniaOtRules = true,
                DailyOtThreshold = 8m
            },
            ReportSettings = new ReportSettings
            {
                OvertimeRules = "Federal",
                OvertimeEnabled = true,
                DailyOvertimeThreshold = 6m
            }
        };

        OvertimeSettings result = CompanyOvertimePolicy.Resolve(company);

        result.CaliforniaOtRules.Should().BeTrue();
        result.DailyOtThreshold.Should().Be(6m);
    }
}