using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Pitbull.Api.Services;
using Pitbull.Bids.Domain;
using Pitbull.Billing.Features.Aging;
using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Services;

/// <summary>
/// Drives real <see cref="RoleDashboardSummaryService.GetSummaryAsync"/> with seeded domain rows.
/// </summary>
public class RoleDashboardSummaryServiceTests : IDisposable
{
    private readonly Pitbull.Core.Data.PitbullDbContext _db;
    private readonly RoleDashboardSummaryService _service;
    private readonly Guid _companyId = TestDbContextFactory.TestCompanyId;
    private readonly Guid _tenantId = TestDbContextFactory.TestTenantId;

    public RoleDashboardSummaryServiceTests()
    {
        _db = TestDbContextFactory.Create();

        var aging = new Mock<IAgingReportService>();
        aging.Setup(a => a.GetAgingSummaryAsync(It.IsAny<DateOnly?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success(new AgingSummaryResult(
                AccountsPayable: new AgingBuckets(10_000, 2_000, 0, 0, 0, 12_000),
                AccountsReceivable: new AgingBuckets(20_000, 5_000, 3_000, 1_000, 500, 29_500),
                NetPosition: 17_500,
                AsOfDate: DateOnly.FromDateTime(DateTime.UtcNow))));

        _service = new RoleDashboardSummaryService(
            _db,
            aging.Object,
            NullLogger<RoleDashboardSummaryService>.Instance);
    }

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task GetSummaryAsync_ComputesPortfolioBilledBacklogAndAging()
    {
        var projectId = Guid.NewGuid();
        var contractId = Guid.NewGuid();

        _db.Set<Project>().Add(new Project
        {
            Id = projectId,
            TenantId = _tenantId,
            CompanyId = _companyId,
            Name = "Campus Reno",
            Number = "P-100",
            Status = ProjectStatus.Active,
            ContractAmount = 500_000m,
        });

        _db.Set<BillingApplication>().Add(new BillingApplication
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            CompanyId = _companyId,
            ProjectId = projectId,
            OwnerContractId = contractId,
            OwnerScheduleOfValuesId = Guid.NewGuid(),
            ApplicationNumber = 2,
            PeriodFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-1)),
            PeriodThrough = DateOnly.FromDateTime(DateTime.UtcNow),
            ApplicationDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Status = BillingApplicationStatus.SubmittedToOwner,
            TotalCompletedAndStoredToDate = 120_000m,
            ContractSumToDate = 500_000m,
        });

        // Older app with lower progress — must not double-count
        _db.Set<BillingApplication>().Add(new BillingApplication
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            CompanyId = _companyId,
            ProjectId = projectId,
            OwnerContractId = contractId,
            OwnerScheduleOfValuesId = Guid.NewGuid(),
            ApplicationNumber = 1,
            PeriodFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-2)),
            PeriodThrough = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-1)),
            ApplicationDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-1)),
            Status = BillingApplicationStatus.Paid,
            TotalCompletedAndStoredToDate = 50_000m,
            ContractSumToDate = 500_000m,
        });

        _db.Set<Bid>().Add(new Bid
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            CompanyId = _companyId,
            Name = "New Bid",
            Number = "BID-1",
            Status = BidStatus.Draft,
            EstimatedValue = 75_000m,
        });

        await _db.SaveChangesAsync();

        var summary = await _service.GetSummaryAsync();

        summary.ActiveProjectCount.Should().Be(1);
        summary.PortfolioContractValue.Should().Be(500_000m);
        summary.BilledToDate.Should().Be(120_000m, "latest application number per contract");
        summary.UnbilledContractValue.Should().Be(380_000m);
        summary.ArTotal.Should().Be(29_500m);
        summary.ApTotal.Should().Be(12_000m);
        summary.ArOverdue.Should().Be(4_500m); // 3000+1000+500
        summary.ArApNetPosition.Should().Be(17_500m);
        summary.BidPipelineValue.Should().Be(75_000m);
        summary.OpenBidCount.Should().Be(1);
        summary.BilledToDateLabel.Should().Contain("G702");
        summary.UnbilledContractValueLabel.Should().Contain("Unbilled");
        summary.ArApNetPositionLabel.Should().Contain("aging");
    }
}
