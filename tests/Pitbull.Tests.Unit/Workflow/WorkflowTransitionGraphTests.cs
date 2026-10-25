using FluentAssertions;
using Moq;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Api.Features.Workflow;
using Pitbull.Bids.Domain;
using Pitbull.Billing.Domain;
using Pitbull.Billing.Services;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateChangeOrder;
using Pitbull.Contracts.Features.UpdateChangeOrder;
using Pitbull.Contracts.Services;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.ProjectManagement.Features;
using Pitbull.ProjectManagement.Services;
using Pitbull.RFIs.Domain;
using Pitbull.RFIs.Features.CreateRfi;
using Pitbull.RFIs.Features.UpdateRfi;
using Pitbull.RFIs.Services;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.UpdateTimeEntry;
using Pitbull.TimeTracking.Services;

namespace Pitbull.Tests.Unit.Workflow;

public class WorkflowTransitionGraphTests
{
    private static readonly Guid ProjectId = Guid.NewGuid();

    [Theory]
    [InlineData(ChangeOrderStatus.Pending, ChangeOrderStatus.Approved, false)]
    [InlineData(ChangeOrderStatus.Pending, ChangeOrderStatus.UnderReview, true)]
    [InlineData(ChangeOrderStatus.UnderReview, ChangeOrderStatus.Approved, true)]
    public void ChangeOrderTransitions_MatchErpStages(ChangeOrderStatus from, ChangeOrderStatus to, bool allowed)
    {
        ChangeOrderStatusTransitions.IsValid(from, to).Should().Be(allowed);
    }

    [Theory]
    [InlineData(RfiStatus.Open, RfiStatus.Closed, false)]
    [InlineData(RfiStatus.Open, RfiStatus.Answered, true)]
    [InlineData(RfiStatus.Answered, RfiStatus.Closed, true)]
    public void RfiTransitions_MatchErpStages(RfiStatus from, RfiStatus to, bool allowed)
    {
        RfiStatusTransitions.IsValid(from, to).Should().Be(allowed);
    }

    [Theory]
    [InlineData(BidStatus.Draft, BidStatus.Won, false)]
    [InlineData(BidStatus.Submitted, BidStatus.Won, true)]
    [InlineData(BidStatus.Won, BidStatus.Converted, false)]
    public void BidTransitions_MatchErpStages(BidStatus from, BidStatus to, bool allowed)
    {
        BidStatusTransitions.IsValid(from, to).Should().Be(allowed);
    }

    [Theory]
    [InlineData(DailyReportStatus.Draft, DailyReportStatus.Submitted, true)]
    [InlineData(DailyReportStatus.Draft, DailyReportStatus.Approved, false)]
    [InlineData(DailyReportStatus.Submitted, DailyReportStatus.Approved, true)]
    [InlineData(DailyReportStatus.Approved, DailyReportStatus.Locked, true)]
    [InlineData(DailyReportStatus.Draft, DailyReportStatus.Locked, false)]
    public void DailyReportTransitions_MatchErpStages(DailyReportStatus from, DailyReportStatus to, bool allowed)
    {
        DailyReportStatusTransitions.IsValid(from, to).Should().Be(allowed);
    }

    [Theory]
    [InlineData(DailyReportStatus.Draft, DailyReportStatus.Submitted, true)]
    [InlineData(DailyReportStatus.Draft, DailyReportStatus.Draft, false)]
    [InlineData(DailyReportStatus.Approved, DailyReportStatus.Locked, true)]
    [InlineData(DailyReportStatus.Locked, DailyReportStatus.Locked, false)]
    public void DailyReportCanTransition_RejectsNoOpAndInvalidJumps(DailyReportStatus from, DailyReportStatus to, bool allowed)
    {
        DailyReportStatusTransitions.CanTransition(from, to).Should().Be(allowed);
    }

    [Theory]
    [InlineData(SubmittalStatus.Draft, SubmittalStatus.Submitted, true)]
    [InlineData(SubmittalStatus.Draft, SubmittalStatus.Approved, false)]
    [InlineData(SubmittalStatus.InReview, SubmittalStatus.Approved, true)]
    [InlineData(SubmittalStatus.Rejected, SubmittalStatus.Draft, true)]
    public void SubmittalTransitions_MatchErpStages(SubmittalStatus from, SubmittalStatus to, bool allowed)
    {
        SubmittalStatusTransitions.IsValid(from, to).Should().Be(allowed);
    }

    [Theory]
    [InlineData(PaymentApplicationStatus.Draft, PaymentApplicationStatus.Submitted, true)]
    [InlineData(PaymentApplicationStatus.Draft, PaymentApplicationStatus.Approved, false)]
    [InlineData(PaymentApplicationStatus.Rejected, PaymentApplicationStatus.Draft, true)]
    [InlineData(PaymentApplicationStatus.Approved, PaymentApplicationStatus.Paid, true)]
    public void PaymentApplicationTransitions_MatchErpStages(PaymentApplicationStatus from, PaymentApplicationStatus to, bool allowed)
    {
        PaymentApplicationStatusTransitions.IsValid(from, to).Should().Be(allowed);
    }

    [Theory]
    [InlineData(BillingApplicationStatus.Draft, BillingApplicationStatus.PmReview, true)]
    [InlineData(BillingApplicationStatus.SubmittedToOwner, BillingApplicationStatus.PaymentDue, false)]
    [InlineData(BillingApplicationStatus.ArchitectCertified, BillingApplicationStatus.PaymentDue, true)]
    [InlineData(BillingApplicationStatus.PmRejected, BillingApplicationStatus.Draft, true)]
    public void BillingApplicationTransitions_MatchErpStages(BillingApplicationStatus from, BillingApplicationStatus to, bool allowed)
    {
        BillingApplicationStatusTransitions.IsValid(from, to).Should().Be(allowed);
    }

    [Fact]
    public async Task ChangeOrderService_RejectsPendingToApproved_SucceedsUnderReviewPath()
    {
        using var db = TestDbContextFactory.Create();
        var service = new ContractsService(db);
        var subId = await SeedSubcontractAsync(db);

        var created = await service.CreateChangeOrderAsync(new CreateChangeOrderCommand(
            subId, "CO-001", "Test CO", "Description", "Reason", 5000m, null, null));
        created.IsSuccess.Should().BeTrue();

        var direct = await service.UpdateChangeOrderAsync(new UpdateChangeOrderCommand(
            created.Value!.Id, "CO-001", "Test CO", "Description", "Reason",
            5000m, null, ChangeOrderStatus.Approved, null));
        direct.IsSuccess.Should().BeFalse();
        direct.ErrorCode.Should().Be("INVALID_STATUS_TRANSITION");

        await service.UpdateChangeOrderAsync(new UpdateChangeOrderCommand(
            created.Value.Id, "CO-001", "Test CO", "Description", "Reason",
            5000m, null, ChangeOrderStatus.UnderReview, null));

        var approved = await service.UpdateChangeOrderAsync(new UpdateChangeOrderCommand(
            created.Value.Id, "CO-001", "Test CO", "Description", "Reason",
            5000m, null, ChangeOrderStatus.Approved, null));
        approved.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task BillingApplicationService_RecordsWorkflowTransition_OnSubmitForReview()
    {
        using var db = TestDbContextFactory.Create();
        var workflow = CreateWorkflowService(db);
        var service = new BillingApplicationService(db, NullLogger<BillingApplicationService>.Instance, workflow);

        var (contractId, sovId) = await SeedOwnerBillingAsync(db);
        var created = await service.CreateAsync(new Pitbull.Billing.Features.AiaBilling.CreateBillingApplicationCommand(
            contractId, sovId, new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31), new DateOnly(2026, 1, 25)));
        created.IsSuccess.Should().BeTrue();

        var submitted = await service.SubmitForReviewAsync(created.Value!.Id);
        submitted.IsSuccess.Should().BeTrue();
        submitted.Value!.Status.Should().Be(BillingApplicationStatus.PmReview);

        var transitions = await workflow.GetTransitionsAsync("BillingApplication", created.Value.Id, CancellationToken.None);
        transitions.Should().ContainSingle();
        transitions[0].FromStatus.Should().Be(nameof(BillingApplicationStatus.Draft));
        transitions[0].ToStatus.Should().Be(nameof(BillingApplicationStatus.PmReview));
    }

    [Fact]
    public async Task BillingApplicationService_RejectsInvalidPostSubmitJump()
    {
        using var db = TestDbContextFactory.Create();
        var service = new BillingApplicationService(db, NullLogger<BillingApplicationService>.Instance);

        var (contractId, sovId) = await SeedOwnerBillingAsync(db);
        var created = await service.CreateAsync(new Pitbull.Billing.Features.AiaBilling.CreateBillingApplicationCommand(
            contractId, sovId, new DateOnly(2026, 2, 1), new DateOnly(2026, 2, 28), new DateOnly(2026, 2, 25)));
        await service.SubmitForReviewAsync(created.Value!.Id);
        await service.ApproveReviewAsync(created.Value.Id);
        await service.SubmitToOwnerAsync(created.Value.Id);

        var invalid = await service.MarkPaidAsync(created.Value.Id);
        invalid.IsSuccess.Should().BeFalse();
        invalid.ErrorCode.Should().Be("INVALID_STATUS_TRANSITION");
    }

    [Fact]
    public async Task DailyReportService_RecordsWorkflowTransition_OnSubmit()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);

        var workflow = CreateWorkflowService(db);
        var service = new DailyReportService(db, new CompanyContext
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            CompanyCode = "01",
            CompanyName = "Test Company"
        }, workflowTransitions: workflow);

        var created = await service.CreateDailyReportAsync(ProjectId, new PmUpsertRequest(
            Data: new Dictionary<string, object?>
            {
                ["WeatherSummary"] = "Clear",
                ["WorkNarrative"] = "Foundation pour"
            }));
        created.IsSuccess.Should().BeTrue();

        var submitted = await service.SubmitDailyReportAsync(ProjectId, created.Value!.Id);
        submitted.IsSuccess.Should().BeTrue();

        var transitions = await workflow.GetTransitionsAsync("DailyReport", created.Value.Id, CancellationToken.None);
        transitions.Should().ContainSingle();
        transitions[0].FromStatus.Should().Be(nameof(DailyReportStatus.Draft));
        transitions[0].ToStatus.Should().Be(nameof(DailyReportStatus.Submitted));
    }

    [Fact]
    public async Task RfiService_RejectsOpenToClosedWithoutAnswer()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);

        var projectAccessMock = new Moq.Mock<Pitbull.Core.Services.IProjectAccessService>();
        projectAccessMock
            .Setup(s => s.HasProjectAccessAsync(It.IsAny<Guid>(), It.IsAny<System.Security.Claims.ClaimsPrincipal?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var rfiService = new RfiService(
            db,
            new Pitbull.RFIs.Features.CreateRfi.CreateRfiValidator(),
            new Pitbull.RFIs.Features.UpdateRfi.UpdateRfiValidator(),
            NullLogger<RfiService>.Instance,
            new Microsoft.AspNetCore.Http.HttpContextAccessor(),
            projectAccessMock.Object);

        var created = await rfiService.CreateRfiAsync(new CreateRfiCommand(
            ProjectId, "Clarify footing", "What depth?", RfiPriority.Normal, null, null, null, null, null, null));
        created.IsSuccess.Should().BeTrue();

        var closed = await rfiService.UpdateRfiAsync(new UpdateRfiCommand(
            created.Value!.Id, ProjectId, "Clarify footing", "What depth?", null, RfiStatus.Closed,
            RfiPriority.Normal, null, null, null, null, null));
        closed.IsSuccess.Should().BeFalse();
        closed.ErrorCode.Should().Be("INVALID_STATUS_TRANSITION");
    }

    private static WorkflowTransitionService CreateWorkflowService(Pitbull.Core.Data.PitbullDbContext db)
    {
        var tenant = new TenantContext { TenantId = TestDbContextFactory.TestTenantId, TenantName = "Test" };
        var company = new CompanyContext { CompanyId = TestDbContextFactory.TestCompanyId };
        return new WorkflowTransitionService(db, tenant, company, NullLogger<WorkflowTransitionService>.Instance);
    }

    private static async Task<Guid> SeedSubcontractAsync(Pitbull.Core.Data.PitbullDbContext db)
    {
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var subcontract = new Subcontract
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = ProjectId,
            SubcontractNumber = "SC-001",
            SubcontractorName = "Test Sub",
            ScopeOfWork = "Test scope",
            OriginalValue = 100_000m,
            CurrentValue = 100_000m,
            RetainagePercent = 10m,
            Status = SubcontractStatus.Executed,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<Subcontract>().Add(subcontract);
        await db.SaveChangesAsync();
        return subcontract.Id;
    }

    private static async Task<(Guid contractId, Guid sovId)> SeedOwnerBillingAsync(Pitbull.Core.Data.PitbullDbContext db)
    {
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var contract = new OwnerContract
        {
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = ProjectId,
            ContractNumber = "OC-001",
            ProjectName = "Test",
            OriginalContractSum = 500_000m,
            ContractSumToDate = 500_000m,
            DefaultRetainagePercent = 10m,
            RetainagePercentMaterials = 10m,
            Status = OwnerContractStatus.Active,
        };
        db.Set<OwnerContract>().Add(contract);

        var sov = new OwnerScheduleOfValues
        {
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = ProjectId,
            OwnerContractId = contract.Id,
            Name = "Main SOV",
            Status = OwnerSOVStatus.Active,
            OriginalContractAmount = 500_000m,
            TotalScheduledValue = 500_000m,
            RevisedContractAmount = 500_000m,
        };
        db.Set<OwnerScheduleOfValues>().Add(sov);
        db.Set<OwnerSOVLineItem>().Add(new OwnerSOVLineItem
        {
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            OwnerScheduleOfValuesId = sov.Id,
            ItemNumber = "1",
            Description = "Concrete",
            ScheduledValue = 500_000m,
            OriginalValue = 500_000m,
            SortOrder = 1,
        });
        await db.SaveChangesAsync();
        return (contract.Id, sov.Id);
    }
}