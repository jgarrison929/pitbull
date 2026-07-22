using FluentAssertions;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features;
using Pitbull.Contracts.Features.CreateSubcontract;

namespace Pitbull.Tests.Unit.Services;

/// <summary>
/// Band 3.6 / 3.5.6: mobile subcontract list — no health/KPI, no SOV line bags.
/// </summary>
public class SubcontractMobileListMapperTests
{
    [Fact]
    public void ToMobileListItem_MapsContractFieldsOnly()
    {
        var id = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var created = new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc);

        var dto = new SubcontractDto(
            id,
            projectId,
            SubcontractNumber: "SC-001",
            SubcontractorName: "ABC Concrete",
            SubcontractorContact: "Jane",
            SubcontractorEmail: "jane@example.com",
            SubcontractorPhone: "555",
            SubcontractorAddress: "1 Main",
            ScopeOfWork: "Heavy scope body must not appear on mobile list",
            TradeCode: "03",
            OriginalValue: 100_000m,
            CurrentValue: 110_000m,
            BilledToDate: 20_000m,
            PaidToDate: 15_000m,
            RetainagePercent: 10m,
            RetainageHeld: 2_000m,
            ExecutionDate: null,
            StartDate: null,
            CompletionDate: null,
            ActualCompletionDate: null,
            Status: SubcontractStatus.InProgress,
            InsuranceExpirationDate: null,
            InsuranceCurrent: true,
            LicenseNumber: "LIC",
            Notes: "secret notes",
            CreatedAt: created
        );

        var slim = SubcontractListViewMapper.ToMobileListItem(dto);

        slim.Id.Should().Be(id);
        slim.Number.Should().Be("SC-001");
        slim.Title.Should().Be("ABC Concrete");
        slim.Status.Should().Be("InProgress");
        slim.ProjectId.Should().Be(projectId);
        slim.Amount.Should().Be(110_000m);
        slim.BilledToDate.Should().Be(20_000m);
        slim.PaidToDate.Should().Be(15_000m);
        slim.TradeCode.Should().Be("03");

        slim.GetType().GetProperty("ScopeOfWork").Should().BeNull();
        slim.GetType().GetProperty("Notes").Should().BeNull();
        slim.GetType().GetProperty("HealthScore").Should().BeNull();
        slim.GetType().GetProperty("LineItems").Should().BeNull();
    }

    [Fact]
    public void ToMobileListItem_IncludesPaidToDateFromServer()
    {
        var dto = new SubcontractDto(
            Guid.NewGuid(),
            Guid.NewGuid(),
            SubcontractNumber: "SC-PAID",
            SubcontractorName: "Paid Sub",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "scope",
            TradeCode: null,
            OriginalValue: 50_000m,
            CurrentValue: 50_000m,
            BilledToDate: 10_000m,
            PaidToDate: 8_000m,
            RetainagePercent: 10m,
            RetainageHeld: 1_000m,
            ExecutionDate: null,
            StartDate: null,
            CompletionDate: null,
            ActualCompletionDate: null,
            Status: SubcontractStatus.InProgress,
            InsuranceExpirationDate: null,
            InsuranceCurrent: true,
            LicenseNumber: null,
            Notes: null,
            CreatedAt: DateTime.UtcNow
        );

        var slim = SubcontractListViewMapper.ToMobileListItem(dto);
        slim.PaidToDate.Should().Be(8_000m);
    }

    [Fact]
    public void ToMobileListItem_EmptyList_IsHonestEmpty()
    {
        var items = Array.Empty<SubcontractDto>();
        var slim = items.Select(SubcontractListViewMapper.ToMobileListItem).ToArray();
        slim.Should().BeEmpty();
    }
}
