using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Api.Features.Workflow;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Core.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Workflow;

public class WorkflowApprovalServiceTests
{
    [Fact]
    public void SelectBestDefinition_PrefersProjectScopedAndHigherThreshold()
    {
        var projectId = Guid.NewGuid();
        var definitions = new[]
        {
            new WorkflowDefinition
            {
                Id = Guid.NewGuid(),
                EntityType = "ChangeOrder",
                TriggerStatus = "UnderReview",
                IsActive = true,
                Priority = 0,
                ProjectId = null,
                AmountThreshold = null
            },
            new WorkflowDefinition
            {
                Id = Guid.NewGuid(),
                EntityType = "ChangeOrder",
                TriggerStatus = "UnderReview",
                IsActive = true,
                Priority = 1,
                ProjectId = projectId,
                AmountThreshold = 10_000m
            }
        };

        var selected = WorkflowApprovalService.SelectBestDefinition(
            definitions, "ChangeOrder", "UnderReview", projectId, 50_000m);

        selected.Should().NotBeNull();
        selected!.ProjectId.Should().Be(projectId);
        selected.AmountThreshold.Should().Be(10_000m);
    }

    [Fact]
    public async Task TryStartWorkflow_CreatesPendingActionForFirstStep()
    {
        await using var db = TestDbContextFactory.Create();
        var approverId = Guid.NewGuid();
        var definition = await SeedChangeOrderDefinitionAsync(db, approverId);

        var service = CreateService(db);
        var entityId = Guid.NewGuid();

        await service.TryStartWorkflowAsync(
            "ChangeOrder", entityId, "UnderReview", null, 25_000m);

        var actions = await db.WorkflowApprovalActions
            .Where(a => a.EntityId == entityId)
            .ToListAsync();

        actions.Should().HaveCount(1);
        actions[0].Status.Should().Be(ApprovalActionStatus.Pending);
        actions[0].AssignedToUserId.Should().Be(approverId);
        actions[0].WorkflowDefinitionId.Should().Be(definition.Id);
    }

    [Fact]
    public async Task Approve_CompletesWorkflowAndAppliesApprovedStatus()
    {
        await using var db = TestDbContextFactory.Create();
        var approverId = Guid.NewGuid();
        await SeedChangeOrderDefinitionAsync(db, approverId);

        var subcontractId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        db.Set<Pitbull.Contracts.Domain.Subcontract>().Add(new Pitbull.Contracts.Domain.Subcontract
        {
            Id = subcontractId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            ProjectId = projectId,
            SubcontractNumber = "SC-1",
            SubcontractorName = "Sub",
            ScopeOfWork = "Work",
            OriginalValue = 100_000m,
            CurrentValue = 100_000m,
            RetainagePercent = 10m,
            Status = Pitbull.Contracts.Domain.SubcontractStatus.Issued
        });

        var changeOrder = new Pitbull.Contracts.Domain.ChangeOrder
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            SubcontractId = subcontractId,
            ChangeOrderNumber = "CO-1",
            Title = "Test CO",
            Description = "Desc",
            Amount = 5_000m,
            Status = Pitbull.Contracts.Domain.ChangeOrderStatus.UnderReview
        };
        db.Set<Pitbull.Contracts.Domain.ChangeOrder>().Add(changeOrder);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        await service.TryStartWorkflowAsync(
            "ChangeOrder", changeOrder.Id, "UnderReview", projectId, changeOrder.Amount);

        var pending = (await service.GetMyPendingAsync(approverId)).Value!;
        pending.Should().HaveCount(1);

        var approve = await service.ApproveAsync(pending[0].Id, approverId, "Approver", "LGTM");
        approve.IsSuccess.Should().BeTrue();

        var updated = await db.Set<Pitbull.Contracts.Domain.ChangeOrder>()
            .FirstAsync(co => co.Id == changeOrder.Id);
        updated.Status.Should().Be(Pitbull.Contracts.Domain.ChangeOrderStatus.Approved);
    }

    [Fact]
    public async Task BlocksTransition_BlocksWithdrawWhilePending()
    {
        await using var db = TestDbContextFactory.Create();
        var approverId = Guid.NewGuid();
        await SeedChangeOrderDefinitionAsync(db, approverId);

        var changeOrder = new Pitbull.Contracts.Domain.ChangeOrder
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            SubcontractId = Guid.NewGuid(),
            ChangeOrderNumber = "CO-WD",
            Title = "Withdraw Test",
            Description = "Desc",
            Amount = 1_000m,
            Status = Pitbull.Contracts.Domain.ChangeOrderStatus.UnderReview
        };
        db.Set<Pitbull.Contracts.Domain.ChangeOrder>().Add(changeOrder);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        await service.TryStartWorkflowAsync(
            "ChangeOrder", changeOrder.Id, "UnderReview", null, changeOrder.Amount);

        var blocksWithdraw = await service.BlocksTransitionAsync(
            "ChangeOrder", changeOrder.Id,
            "UnderReview", "Withdrawn");

        blocksWithdraw.Should().BeTrue();
    }

    [Fact]
    public async Task Approve_DoesNotPersistApprovedWhenCompleterFails()
    {
        await using var db = TestDbContextFactory.Create();
        var approverId = Guid.NewGuid();
        var subcontractId = Guid.NewGuid();
        var projectId = Guid.NewGuid();

        db.Set<Pitbull.Contracts.Domain.Subcontract>().Add(new Pitbull.Contracts.Domain.Subcontract
        {
            Id = subcontractId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            ProjectId = projectId,
            SubcontractNumber = "SC-AT",
            SubcontractorName = "Sub",
            ScopeOfWork = "Work",
            OriginalValue = 100_000m,
            CurrentValue = 100_000m,
            RetainagePercent = 10m,
            Status = Pitbull.Contracts.Domain.SubcontractStatus.Issued
        });

        // Void is not a valid transition from UnderReview — completer fails on real trigger path.
        await SeedChangeOrderDefinitionAsync(db, approverId, approvedStatus: "Void");

        var changeOrder = new Pitbull.Contracts.Domain.ChangeOrder
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            SubcontractId = subcontractId,
            ChangeOrderNumber = "CO-AT",
            Title = "Atomic Test",
            Description = "Desc",
            Amount = 1_000m,
            Status = Pitbull.Contracts.Domain.ChangeOrderStatus.UnderReview
        };
        db.Set<Pitbull.Contracts.Domain.ChangeOrder>().Add(changeOrder);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        await service.TryStartWorkflowAsync(
            "ChangeOrder", changeOrder.Id, "UnderReview", projectId, changeOrder.Amount);

        var pending = (await service.GetMyPendingAsync(approverId)).Value!;
        pending.Should().HaveCount(1);

        var approve = await service.ApproveAsync(pending[0].Id, approverId, "Approver", "LGTM");
        approve.IsSuccess.Should().BeFalse();
        approve.ErrorCode.Should().Be("INVALID_STATUS_TRANSITION");

        var action = await db.WorkflowApprovalActions.FirstAsync(a => a.Id == pending[0].Id);
        action.Status.Should().Be(ApprovalActionStatus.Pending);

        var updated = await db.Set<Pitbull.Contracts.Domain.ChangeOrder>()
            .FirstAsync(co => co.Id == changeOrder.Id);
        updated.Status.Should().Be(Pitbull.Contracts.Domain.ChangeOrderStatus.UnderReview);
    }

    [Fact]
    public async Task Reject_CompletesWorkflowAndAppliesRejectedStatus()
    {
        await using var db = TestDbContextFactory.Create();
        var approverId = Guid.NewGuid();
        await SeedChangeOrderDefinitionAsync(db, approverId);

        var changeOrder = new Pitbull.Contracts.Domain.ChangeOrder
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            SubcontractId = Guid.NewGuid(),
            ChangeOrderNumber = "CO-2",
            Title = "Reject CO",
            Description = "Desc",
            Amount = 1_000m,
            Status = Pitbull.Contracts.Domain.ChangeOrderStatus.UnderReview
        };
        db.Set<Pitbull.Contracts.Domain.ChangeOrder>().Add(changeOrder);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        await service.TryStartWorkflowAsync(
            "ChangeOrder", changeOrder.Id, "UnderReview", null, changeOrder.Amount);

        var pending = (await service.GetMyPendingAsync(approverId)).Value!;
        var reject = await service.RejectAsync(pending[0].Id, approverId, "Approver", "Too expensive");
        reject.IsSuccess.Should().BeTrue();

        var updated = await db.Set<Pitbull.Contracts.Domain.ChangeOrder>()
            .FirstAsync(co => co.Id == changeOrder.Id);
        updated.Status.Should().Be(Pitbull.Contracts.Domain.ChangeOrderStatus.Rejected);
    }

    private static WorkflowApprovalService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        var tenantContext = new TenantContext
        {
            TenantId = TestDbContextFactory.TestTenantId,
            TenantName = "Test"
        };
        var companyContext = new CompanyContext
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            CompanyCode = "01",
            CompanyName = "Test Co"
        };

        IWorkflowEntityCompleter[] completers =
        [
            new ChangeOrderWorkflowCompleter(db),
            new BillingApplicationWorkflowCompleter(db)
        ];

        var transitions = new WorkflowTransitionService(
            db, tenantContext, companyContext, NullLogger<WorkflowTransitionService>.Instance);

        return new WorkflowApprovalService(
            db,
            tenantContext,
            companyContext,
            completers,
            transitions,
            NullLogger<WorkflowApprovalService>.Instance);
    }

    private static async Task<WorkflowDefinition> SeedChangeOrderDefinitionAsync(
        Pitbull.Core.Data.PitbullDbContext db,
        Guid approverId,
        string approvedStatus = "Approved",
        string rejectedStatus = "Rejected")
    {
        var definition = new WorkflowDefinition
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            EntityType = "ChangeOrder",
            TriggerStatus = "UnderReview",
            ApprovedStatus = approvedStatus,
            RejectedStatus = rejectedStatus,
            Name = "CO Approval",
            IsActive = true,
            Mode = ApprovalMode.Sequential,
            Steps =
            [
                new WorkflowApprovalStep
                {
                    CompanyId = TestDbContextFactory.TestCompanyId,
                    TenantId = TestDbContextFactory.TestTenantId,
                    StepOrder = 1,
                    Name = "PM Review",
                    ApproverType = ApproverType.User,
                    ApproverUserId = approverId
                }
            ]
        };

        db.WorkflowDefinitions.Add(definition);
        await db.SaveChangesAsync();
        return definition;
    }
}