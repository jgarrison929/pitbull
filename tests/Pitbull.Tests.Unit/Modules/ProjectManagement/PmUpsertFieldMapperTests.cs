using FluentAssertions;
using Pitbull.ProjectManagement.Domain;
using Pitbull.ProjectManagement.Features;

namespace Pitbull.Tests.Unit.Modules.ProjectManagement;

public sealed class PmUpsertFieldMapperTests
{
    [Fact]
    public void MapNonStatusScalars_Submittal_PersistsTitleDescriptionAndDataFields()
    {
        var entity = new PmSubmittal();
        var requiredBy = DateTime.UtcNow.AddDays(14);

        PmUpsertFieldMapper.MapNonStatusScalars(entity, new PmUpsertRequest(
            Title: "Shop Drawing 033000",
            Description: "Concrete mix design",
            Data: new Dictionary<string, object?>
            {
                ["SpecSectionCode"] = "033000",
                ["SubmittalType"] = "ShopDrawing",
                ["RequiredByDate"] = requiredBy,
                ["Status"] = "Approved"
            }));

        entity.Title.Should().Be("Shop Drawing 033000");
        entity.Description.Should().Be("Concrete mix design");
        entity.SpecSectionCode.Should().Be("033000");
        entity.SubmittalType.Should().Be(SubmittalType.ShopDrawing);
        entity.RequiredByDate.Should().NotBeNull();
        entity.Status.Should().Be(default(SubmittalStatus));
    }

    [Fact]
    public void MapNonStatusScalars_DailyReport_PersistsIntegrationPayloadScalars()
    {
        var entity = new PmDailyReport();
        var reportDate = new DateTime(2026, 6, 25, 0, 0, 0, DateTimeKind.Utc);
        var preparedBy = Guid.NewGuid();

        PmUpsertFieldMapper.MapNonStatusScalars(entity, new PmUpsertRequest(
            Name: "Daily Report - Field",
            Data: new Dictionary<string, object?>
            {
                ["ReportDate"] = reportDate,
                ["ReportType"] = "Foreman",
                ["WeatherSummary"] = "Clear skies",
                ["WorkNarrative"] = "Poured footings on north wing.",
                ["PreparedByUserId"] = preparedBy,
                ["Status"] = "Submitted"
            }));

        entity.ReportDate.Should().Be(reportDate);
        entity.ReportType.Should().Be(DailyReportType.Foreman);
        entity.WeatherSummary.Should().Be("Clear skies");
        entity.WorkNarrative.Should().Be("Poured footings on north wing.");
        entity.PreparedByUserId.Should().Be(preparedBy);
        entity.Status.Should().Be(default(DailyReportStatus));
    }
}