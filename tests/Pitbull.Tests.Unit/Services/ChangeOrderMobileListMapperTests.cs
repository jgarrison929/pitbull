using FluentAssertions;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features;
using Pitbull.Contracts.Features.CreateChangeOrder;
using Pitbull.Contracts.Features.OwnerChangeOrders;

namespace Pitbull.Tests.Unit.Services;

/// <summary>
/// Band 3.6 / 3.5.2: mobile change-order list contract — only allowed fields, no health/KPI.
/// </summary>
public class ChangeOrderMobileListMapperTests
{
    [Fact]
    public void ToMobileListItem_FromChangeOrderDto_MapsContractFieldsOnly()
    {
        var id = Guid.NewGuid();
        var subcontractId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var submitted = new DateTime(2026, 7, 1, 12, 0, 0, DateTimeKind.Utc);

        var dto = new ChangeOrderDto(
            id,
            subcontractId,
            ChangeOrderNumber: "CO-042",
            Title: "Extra footing",
            Description: "Heavy body that must not appear on mobile list",
            Reason: "Field condition",
            Amount: 15_000m,
            DaysExtension: 5,
            Status: ChangeOrderStatus.Pending,
            SubmittedDate: submitted,
            ApprovedDate: null,
            RejectedDate: null,
            ApprovedBy: "Should not leak",
            RejectedBy: null,
            RejectionReason: null,
            ReferenceNumber: "REF-1",
            Number: "CO-042",
            ScheduleImpactDays: 5,
            CostImpact: 15_000m,
            RequestedBy: "PM",
            RequestDate: submitted,
            CreatedAt: submitted
        );

        var slim = ChangeOrderListViewMapper.ToMobileListItem(dto, projectId);

        slim.Id.Should().Be(id);
        slim.Number.Should().Be("CO-042");
        slim.Title.Should().Be("Extra footing");
        slim.Status.Should().Be("Pending");
        slim.ProjectId.Should().Be(projectId);
        slim.Amount.Should().Be(15_000m);
        slim.DueDate.Should().Be(submitted);
        slim.SubcontractId.Should().Be(subcontractId);

        slim.GetType().GetProperty("Description").Should().BeNull();
        slim.GetType().GetProperty("ApprovedBy").Should().BeNull();
        slim.GetType().GetProperty("HealthScore").Should().BeNull();
        slim.GetType().GetProperty("Reason").Should().BeNull();
    }

    [Fact]
    public void ToMobileListItem_FromOwnerChangeOrderDto_UsesProjectId()
    {
        var id = Guid.NewGuid();
        var projectId = Guid.NewGuid();

        var dto = new OwnerChangeOrderDto(
            id,
            projectId,
            OwnerContractId: null,
            ChangeOrderNumber: "OCO-1",
            Title: "Owner scope",
            Description: "body",
            Reason: null,
            Amount: 1000m,
            DaysExtension: null,
            Status: ChangeOrderStatus.UnderReview,
            SubmittedDate: null,
            ApprovedDate: null,
            RejectedDate: null,
            ApprovedBy: null,
            RejectedBy: null,
            RejectionReason: null,
            ReferenceNumber: null
        );

        var slim = ChangeOrderListViewMapper.ToMobileListItem(dto);

        slim.ProjectId.Should().Be(projectId);
        slim.Number.Should().Be("OCO-1");
        slim.SubcontractId.Should().BeNull();
        slim.Status.Should().Be("UnderReview");
    }

    [Fact]
    public void ToMobileListItem_EmptyList_IsHonestEmpty()
    {
        var items = Array.Empty<ChangeOrderDto>();
        var slim = items.Select(d => ChangeOrderListViewMapper.ToMobileListItem(d)).ToArray();

        slim.Should().BeEmpty();
    }
}
