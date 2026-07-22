using FluentAssertions;
using Pitbull.ProjectManagement.Features;

namespace Pitbull.Tests.Unit.Services;

/// <summary>
/// Band 3.7 / 3.6.2: mobile activity list contract — no SPI/CPI invent.
/// </summary>
public class ActivityMobileListMapperTests
{
    [Fact]
    public void ToMobileListItem_FromPmEntityDto_MapsContractFields()
    {
        var id = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var start = new DateTime(2026, 7, 10, 0, 0, 0, DateTimeKind.Utc);
        var finish = new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc);

        var data = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
        {
            ["PlannedStart"] = start,
            ["PlannedFinish"] = finish,
            ["IsCritical"] = true,
            ["TotalFloatDays"] = 0d,
            ["FreeFloatDays"] = 0d,
            ["PercentComplete"] = 25,
            ["WbsCode"] = "1.2.3",
            ["ActivityType"] = "Task",
        };

        var dto = new PmEntityDto(
            id,
            projectId,
            Name: "Pour slab",
            Title: null,
            Status: "InProgress",
            CreatedAt: start,
            UpdatedAt: start,
            Data: data
        );

        var slim = ActivityListViewMapper.ToMobileListItem(dto);

        slim.Id.Should().Be(id);
        slim.Name.Should().Be("Pour slab");
        slim.Status.Should().Be("InProgress");
        slim.Start.Should().Be(start);
        slim.Finish.Should().Be(finish);
        slim.IsCritical.Should().BeTrue();
        slim.TotalFloatDays.Should().Be(0);
        slim.FreeFloatDays.Should().Be(0);
        slim.PercentComplete.Should().Be(25);

        slim.GetType().GetProperty("Spi").Should().BeNull();
        slim.GetType().GetProperty("Cpi").Should().BeNull();
        slim.GetType().GetProperty("HealthScore").Should().BeNull();
    }

    [Fact]
    public void ToMobileListItem_NullFloat_StaysNull()
    {
        var data = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        var dto = new PmEntityDto(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Name: "Unknown float",
            Title: null,
            Status: "NotStarted",
            CreatedAt: DateTime.UtcNow,
            UpdatedAt: null,
            Data: data
        );

        var slim = ActivityListViewMapper.ToMobileListItem(dto);

        slim.IsCritical.Should().BeNull();
        slim.TotalFloatDays.Should().BeNull();
        slim.FreeFloatDays.Should().BeNull();
    }

    [Fact]
    public void ToMobileListItem_EmptyList_IsHonestEmpty()
    {
        var items = Array.Empty<PmEntityDto>();
        var slim = items.Select(ActivityListViewMapper.ToMobileListItem).ToArray();
        slim.Should().BeEmpty();
    }
}
