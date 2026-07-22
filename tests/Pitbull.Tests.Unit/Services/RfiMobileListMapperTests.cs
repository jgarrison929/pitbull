using FluentAssertions;
using Pitbull.RFIs.Domain;
using Pitbull.RFIs.Features;

namespace Pitbull.Tests.Unit.Services;

/// <summary>
/// Band 3.5 / 3.4.2: mobile RFI list contract — only allowed fields, no health/KPI.
/// </summary>
public class RfiMobileListMapperTests
{
    [Fact]
    public void ToMobileListItem_FromDto_MapsContractFieldsOnly()
    {
        var id = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var created = new DateTime(2026, 7, 1, 12, 0, 0, DateTimeKind.Utc);
        var due = new DateTime(2026, 7, 10, 0, 0, 0, DateTimeKind.Utc);

        var dto = new RfiDto(
            id,
            Number: 42,
            Subject: "Slab edge detail",
            Question: "Heavy body that must not appear on mobile list",
            Answer: "Should not leak",
            Status: RfiStatus.Open,
            Priority: RfiPriority.High,
            DueDate: due,
            AnsweredAt: null,
            ClosedAt: null,
            ProjectId: projectId,
            BallInCourtUserId: Guid.NewGuid(),
            BallInCourtName: "Architect",
            AssignedToUserId: null,
            AssignedToName: null,
            CreatedByName: "PM",
            CreatedAt: created,
            SpecSection: "03 30 00",
            DrawingReferences: new List<string> { "S-101", "S-102" },
            HasCostImpact: true,
            EstimatedCostImpact: 50_000m,
            EstimatedDelayDays: 5
        );

        var slim = RfiListViewMapper.ToMobileListItem(dto);

        slim.Id.Should().Be(id);
        slim.Number.Should().Be(42);
        slim.Subject.Should().Be("Slab edge detail");
        slim.Status.Should().Be(RfiStatus.Open);
        slim.ProjectId.Should().Be(projectId);
        slim.DueDate.Should().Be(due);
        slim.UpdatedAt.Should().Be(created);

        // Explicit: no cost / drawing / question body on the mobile type
        slim.GetType().GetProperty("Question").Should().BeNull();
        slim.GetType().GetProperty("Answer").Should().BeNull();
        slim.GetType().GetProperty("HasCostImpact").Should().BeNull();
        slim.GetType().GetProperty("EstimatedCostImpact").Should().BeNull();
        slim.GetType().GetProperty("DrawingReferences").Should().BeNull();
        slim.GetType().GetProperty("HealthScore").Should().BeNull();
        slim.GetType().GetProperty("Priority").Should().BeNull();
    }

    [Fact]
    public void ToMobileListItem_FromEntity_UsesUpdatedAtWhenPresent()
    {
        var updated = new DateTime(2026, 7, 15, 8, 0, 0, DateTimeKind.Utc);
        var rfi = new Rfi
        {
            Id = Guid.NewGuid(),
            Number = 1,
            Subject = "Empty honesty row",
            Question = "body",
            Status = RfiStatus.Answered,
            ProjectId = Guid.NewGuid(),
            CreatedAt = new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc),
            UpdatedAt = updated,
            DueDate = null
        };

        var slim = RfiListViewMapper.ToMobileListItem(rfi);

        slim.UpdatedAt.Should().Be(updated);
        slim.DueDate.Should().BeNull();
        slim.Status.Should().Be(RfiStatus.Answered);
    }

    [Fact]
    public void ToMobileListItem_EmptyList_IsHonestEmpty()
    {
        var items = Array.Empty<RfiDto>();
        var slim = items.Select(RfiListViewMapper.ToMobileListItem).ToArray();

        slim.Should().BeEmpty();
        // Contract: empty ≠ health rollup — caller must show honest empty, not invent KPIs
        slim.Should().NotContain(x => x.Subject.Contains("health", StringComparison.OrdinalIgnoreCase));
    }
}
