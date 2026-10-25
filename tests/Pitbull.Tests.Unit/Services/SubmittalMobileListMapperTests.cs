using FluentAssertions;
using Pitbull.ProjectManagement.Domain;
using Pitbull.ProjectManagement.Features;

namespace Pitbull.Tests.Unit.Services;

/// <summary>
/// Band 3.5 / 3.4.3: mobile submittal list contract — slim fields, honest status enum, no KPI.
/// </summary>
public class SubmittalMobileListMapperTests
{
    [Fact]
    public void ToMobileListItem_FromEntity_MapsContractFields()
    {
        var id = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var due = new DateTime(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc);
        var entity = new PmSubmittal
        {
            Id = id,
            ProjectId = projectId,
            SubmittalNumber = 12,
            Title = "Structural steel shop drawings",
            Description = "Heavy description that must not appear on list DTO",
            Status = SubmittalStatus.InReview,
            SubmittalType = SubmittalType.ShopDrawing,
            RequiredByDate = due,
            CreatedAt = new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc),
            UpdatedAt = new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            IsSubstitutionRequest = true,
            RevisionNumber = 2
        };

        var slim = SubmittalListViewMapper.ToMobileListItem(entity);

        slim.Id.Should().Be(id);
        slim.Number.Should().Be(12);
        slim.Title.Should().Be("Structural steel shop drawings");
        slim.Status.Should().Be("InReview"); // honest enum ToString
        slim.ProjectId.Should().Be(projectId);
        slim.DueDate.Should().Be(due);
        slim.UpdatedAt.Should().Be(entity.UpdatedAt);
        slim.Type.Should().Be("ShopDrawing");

        slim.GetType().GetProperty("Description").Should().BeNull();
        slim.GetType().GetProperty("HealthScore").Should().BeNull();
        slim.GetType().GetProperty("RegisterCompletePercent").Should().BeNull();
        slim.GetType().GetProperty("Data").Should().BeNull();
    }

    [Fact]
    public void ToMobileListItem_FromEntity_PrefersRequiredByOverFinalDue()
    {
        var entity = new PmSubmittal
        {
            Id = Guid.NewGuid(),
            ProjectId = Guid.NewGuid(),
            SubmittalNumber = 1,
            Title = "Product data",
            Status = SubmittalStatus.Submitted,
            RequiredByDate = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc),
            FinalDueDate = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc),
            CreatedAt = DateTime.UtcNow
        };

        SubmittalListViewMapper.ToMobileListItem(entity).DueDate.Should().Be(entity.RequiredByDate);
    }

    [Fact]
    public void ToMobileListItem_FromPmEntityDto_ReadsDataBag()
    {
        var id = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var data = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
        {
            ["SubmittalNumber"] = 5,
            ["RequiredByDate"] = new DateTime(2026, 7, 30, 0, 0, 0, DateTimeKind.Utc),
            ["Description"] = "must not map to list type"
        };
        var dto = new PmEntityDto(
            id,
            projectId,
            Name: null,
            Title: "Firestopping",
            Status: "Submitted",
            CreatedAt: DateTime.UtcNow,
            UpdatedAt: null,
            Data: data);

        var slim = SubmittalListViewMapper.ToMobileListItem(dto);

        slim.Id.Should().Be(id);
        slim.Number.Should().Be(5);
        slim.Title.Should().Be("Firestopping");
        slim.Status.Should().Be("Submitted");
        slim.ProjectId.Should().Be(projectId);
        slim.DueDate.Should().Be(new DateTime(2026, 7, 30, 0, 0, 0, DateTimeKind.Utc));
        slim.UpdatedAt.Should().Be(dto.CreatedAt);
    }

    [Fact]
    public void ToMobileListItem_EmptyList_IsHonestEmpty()
    {
        var slim = Array.Empty<PmEntityDto>()
            .Select(SubmittalListViewMapper.ToMobileListItem)
            .ToArray();

        slim.Should().BeEmpty();
    }
}
