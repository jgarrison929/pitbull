using FluentAssertions;
using Pitbull.Core.Domain;

namespace Pitbull.Tests.Unit.Domain;

public class TimecardSettingsTests
{
    [Fact]
    public void NewTimecardSettings_HasCorrectDefaults()
    {
        var settings = new TimecardSettings();

        settings.TimecardMode.Should().Be(TimecardMode.Daily);
        settings.WeeklyEntryMode.Should().Be(WeeklyEntryMode.Detailed);
        settings.DefaultProjectId.Should().BeNull();
        settings.RequirePhase.Should().BeFalse();
        settings.RequireEquipment.Should().BeFalse();
    }

    [Fact]
    public void TimecardMode_HasExpectedValues()
    {
        ((int)TimecardMode.Daily).Should().Be(0);
        ((int)TimecardMode.Weekly).Should().Be(1);
    }

    [Fact]
    public void WeeklyEntryMode_HasExpectedValues()
    {
        ((int)WeeklyEntryMode.Simple).Should().Be(0);
        ((int)WeeklyEntryMode.Detailed).Should().Be(1);
    }

    [Fact]
    public void NewCompany_HasTimecardSettings()
    {
        var company = new Company
        {
            Code = "TEST",
            Name = "Test Company"
        };

        company.TimecardSettings.Should().NotBeNull();
        company.TimecardSettings.TimecardMode.Should().Be(TimecardMode.Daily);
    }
}
