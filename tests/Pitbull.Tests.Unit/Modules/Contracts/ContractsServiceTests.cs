using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Core.CQRS;
using Pitbull.Contracts.Features.CreateChangeOrder;
using Pitbull.Contracts.Features.CreatePaymentApplication;
using Pitbull.Contracts.Features.CreateSubcontract;
using Pitbull.Contracts.Features.UpdateChangeOrder;
using Pitbull.Contracts.Features.UpdatePaymentApplication;
using Pitbull.Contracts.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.Contracts;

public sealed class ContractsServiceTests
{
    private static readonly Guid ProjectId = Guid.NewGuid();

    private static ContractsService CreateService(Pitbull.Core.Data.PitbullDbContext db)
        => new(db);

    private static async Task<Result<ChangeOrderDto>> ApproveChangeOrderAsync(
        ContractsService service, ChangeOrderDto changeOrder)
    {
        await service.UpdateChangeOrderAsync(new UpdateChangeOrderCommand(
            changeOrder.Id, changeOrder.ChangeOrderNumber, changeOrder.Title, changeOrder.Description,
            changeOrder.Reason, changeOrder.Amount, changeOrder.DaysExtension, ChangeOrderStatus.UnderReview, null));

        return await service.UpdateChangeOrderAsync(new UpdateChangeOrderCommand(
            changeOrder.Id, changeOrder.ChangeOrderNumber, changeOrder.Title, changeOrder.Description,
            changeOrder.Reason, changeOrder.Amount, changeOrder.DaysExtension, ChangeOrderStatus.Approved, null));
    }

    private static async Task<Guid> SeedSubcontractAsync(
        Pitbull.Core.Data.PitbullDbContext db,
        decimal originalValue = 100_000m,
        decimal retainagePercent = 10m)
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
            OriginalValue = originalValue,
            CurrentValue = originalValue,
            RetainagePercent = retainagePercent,
            Status = SubcontractStatus.Executed,
            CreatedAt = DateTime.UtcNow
        };

        db.Set<Subcontract>().Add(subcontract);
        await db.SaveChangesAsync();
        return subcontract.Id;
    }

    // === Change Order Status Transition Tests ===

    [Fact]
    public async Task UpdateChangeOrder_PendingToApproved_Fails()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var subId = await SeedSubcontractAsync(db);

        var created = await service.CreateChangeOrderAsync(new CreateChangeOrderCommand(
            subId, "CO-001", "Test CO", "Description", "Reason", 5000m, null, null));
        created.IsSuccess.Should().BeTrue();

        var result = await service.UpdateChangeOrderAsync(new UpdateChangeOrderCommand(
            created.Value!.Id, "CO-001", "Test CO", "Description", "Reason",
            5000m, null, ChangeOrderStatus.Approved, null));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS_TRANSITION");
    }

    [Fact]
    public async Task UpdateChangeOrder_UnderReviewToApproved_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var subId = await SeedSubcontractAsync(db);

        var created = await service.CreateChangeOrderAsync(new CreateChangeOrderCommand(
            subId, "CO-001", "Test CO", "Description", "Reason", 5000m, null, null));
        created.IsSuccess.Should().BeTrue();

        var result = await ApproveChangeOrderAsync(service, created.Value!);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(ChangeOrderStatus.Approved);
    }

    [Fact]
    public async Task UpdateChangeOrder_PendingToRejected_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var subId = await SeedSubcontractAsync(db);

        var created = await service.CreateChangeOrderAsync(new CreateChangeOrderCommand(
            subId, "CO-001", "Test CO", "Description", "Reason", 5000m, null, null));

        var result = await service.UpdateChangeOrderAsync(new UpdateChangeOrderCommand(
            created.Value!.Id, "CO-001", "Test CO", "Description", "Reason",
            5000m, null, ChangeOrderStatus.Rejected, null));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(ChangeOrderStatus.Rejected);
    }

    [Fact]
    public async Task UpdateChangeOrder_RejectedToApproved_Fails()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var subId = await SeedSubcontractAsync(db);

        var created = await service.CreateChangeOrderAsync(new CreateChangeOrderCommand(
            subId, "CO-001", "Test CO", "Description", "Reason", 5000m, null, null));

        // First reject it
        await service.UpdateChangeOrderAsync(new UpdateChangeOrderCommand(
            created.Value!.Id, "CO-001", "Test CO", "Description", "Reason",
            5000m, null, ChangeOrderStatus.Rejected, null));

        // Try to approve a rejected CO
        var result = await service.UpdateChangeOrderAsync(new UpdateChangeOrderCommand(
            created.Value!.Id, "CO-001", "Test CO", "Description", "Reason",
            5000m, null, ChangeOrderStatus.Approved, null));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS_TRANSITION");
    }

    [Fact]
    public async Task UpdateChangeOrder_ApprovedToVoid_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var subId = await SeedSubcontractAsync(db);

        var created = await service.CreateChangeOrderAsync(new CreateChangeOrderCommand(
            subId, "CO-001", "Test CO", "Description", "Reason", 5000m, null, null));

        await ApproveChangeOrderAsync(service, created.Value!);

        var result = await service.UpdateChangeOrderAsync(new UpdateChangeOrderCommand(
            created.Value!.Id, "CO-001", "Test CO", "Description", "Reason",
            5000m, null, ChangeOrderStatus.Void, null));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(ChangeOrderStatus.Void);
    }

    [Fact]
    public async Task UpdateChangeOrder_ApprovedToPending_Fails()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var subId = await SeedSubcontractAsync(db);

        var created = await service.CreateChangeOrderAsync(new CreateChangeOrderCommand(
            subId, "CO-001", "Test CO", "Description", "Reason", 5000m, null, null));

        await ApproveChangeOrderAsync(service, created.Value!);

        var result = await service.UpdateChangeOrderAsync(new UpdateChangeOrderCommand(
            created.Value!.Id, "CO-001", "Test CO", "Description", "Reason",
            5000m, null, ChangeOrderStatus.Pending, null));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS_TRANSITION");
    }

    // === Change Order Cost Impact Tests ===

    [Fact]
    public async Task ApproveChangeOrder_UpdatesSubcontractCurrentValue()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var subId = await SeedSubcontractAsync(db, originalValue: 100_000m);

        var created = await service.CreateChangeOrderAsync(new CreateChangeOrderCommand(
            subId, "CO-001", "Add scope", "Extra work", "Owner request", 15_000m, null, null));

        await ApproveChangeOrderAsync(service, created.Value!);

        var sub = await db.Set<Subcontract>().FirstAsync(s => s.Id == subId);
        sub.CurrentValue.Should().Be(115_000m);
    }

    [Fact]
    public async Task ApproveChangeOrder_NegativeAmount_ReducesContractValue()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var subId = await SeedSubcontractAsync(db, originalValue: 100_000m);

        var created = await service.CreateChangeOrderAsync(new CreateChangeOrderCommand(
            subId, "CO-001", "Reduce scope", "Remove work", "VE", -10_000m, null, null));

        await ApproveChangeOrderAsync(service, created.Value!);

        var sub = await db.Set<Subcontract>().FirstAsync(s => s.Id == subId);
        sub.CurrentValue.Should().Be(90_000m);
    }

    [Fact]
    public async Task ApproveChangeOrder_WouldMakeContractNegative_Fails()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var subId = await SeedSubcontractAsync(db, originalValue: 50_000m);

        var created = await service.CreateChangeOrderAsync(new CreateChangeOrderCommand(
            subId, "CO-001", "Big deduct", "Remove everything", "VE", -60_000m, null, null));

        await service.UpdateChangeOrderAsync(new UpdateChangeOrderCommand(
            created.Value!.Id, "CO-001", "Big deduct", "Remove everything", "VE",
            -60_000m, null, ChangeOrderStatus.UnderReview, null));

        var result = await service.UpdateChangeOrderAsync(new UpdateChangeOrderCommand(
            created.Value!.Id, "CO-001", "Big deduct", "Remove everything", "VE",
            -60_000m, null, ChangeOrderStatus.Approved, null));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NEGATIVE_CONTRACT_SUM");
    }

    [Fact]
    public async Task CreateChangeOrder_AsApproved_Fails()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var subId = await SeedSubcontractAsync(db, originalValue: 100_000m);

        var result = await service.CreateChangeOrderAsync(new CreateChangeOrderCommand(
            subId, "CO-001", "Pre-approved", "Already approved", "Owner",
            25_000m, null, null, Status: ChangeOrderStatus.Approved));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task VoidApprovedChangeOrder_ReversesContractValue()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var subId = await SeedSubcontractAsync(db, originalValue: 100_000m);

        var created = await service.CreateChangeOrderAsync(new CreateChangeOrderCommand(
            subId, "CO-001", "Add scope", "Extra", "Owner", 20_000m, null, null));

        await ApproveChangeOrderAsync(service, created.Value!);

        var subAfterApproval = await db.Set<Subcontract>().FirstAsync(s => s.Id == subId);
        subAfterApproval.CurrentValue.Should().Be(120_000m);

        await service.UpdateChangeOrderAsync(new UpdateChangeOrderCommand(
            created.Value!.Id, "CO-001", "Add scope", "Extra", "Owner",
            20_000m, null, ChangeOrderStatus.Void, null));

        var subAfterVoid = await db.Set<Subcontract>().FirstAsync(s => s.Id == subId);
        subAfterVoid.CurrentValue.Should().Be(100_000m);
    }

    // === HIGH #7: Approved CO amount edit syncs subcontract ===

    [Fact]
    public async Task UpdateApprovedChangeOrder_AmountChange_SyncsSubcontract()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var subId = await SeedSubcontractAsync(db, originalValue: 100_000m);

        // Create and approve a CO for 15k
        var created = await service.CreateChangeOrderAsync(new CreateChangeOrderCommand(
            subId, "CO-001", "Add scope", "Extra work", "Owner", 15_000m, null, null));
        await ApproveChangeOrderAsync(service, created.Value!);

        var subAfterApproval = await db.Set<Subcontract>().FirstAsync(s => s.Id == subId);
        subAfterApproval.CurrentValue.Should().Be(115_000m);

        // Now edit the approved CO amount from 15k to 25k (keeping Approved status)
        var result = await service.UpdateChangeOrderAsync(new UpdateChangeOrderCommand(
            created.Value!.Id, "CO-001", "Add scope expanded", "More work", "Owner",
            25_000m, null, ChangeOrderStatus.Approved, null));

        result.IsSuccess.Should().BeTrue();
        var subAfterEdit = await db.Set<Subcontract>().FirstAsync(s => s.Id == subId);
        subAfterEdit.CurrentValue.Should().Be(125_000m, "the +10k delta should be applied to the subcontract");
    }

    // === Payment Application Retainage Tests ===

    [Fact]
    public async Task CreatePaymentApp_InvalidRetainage_Over50Percent_Fails()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var subId = await SeedSubcontractAsync(db, retainagePercent: 55m);

        var result = await service.CreatePaymentApplicationAsync(
            new CreatePaymentApplicationCommand(
                subId, DateTime.UtcNow.AddDays(-30), DateTime.UtcNow, 10_000m, 0m, null, null));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_RETAINAGE");
    }

    [Fact]
    public async Task CreatePaymentApp_NegativeRetainage_Fails()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var subId = await SeedSubcontractAsync(db, retainagePercent: -5m);

        var result = await service.CreatePaymentApplicationAsync(
            new CreatePaymentApplicationCommand(
                subId, DateTime.UtcNow.AddDays(-30), DateTime.UtcNow, 10_000m, 0m, null, null));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_RETAINAGE");
    }

    [Fact]
    public async Task CreatePaymentApp_ValidRetainage_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var subId = await SeedSubcontractAsync(db, retainagePercent: 10m);

        var result = await service.CreatePaymentApplicationAsync(
            new CreatePaymentApplicationCommand(
                subId, DateTime.UtcNow.AddDays(-30), DateTime.UtcNow, 10_000m, 0m, null, null));

        result.IsSuccess.Should().BeTrue();
    }

    // === Payment Application Math Tests ===

    [Fact]
    public async Task CreatePaymentApp_G702MathIsCorrect()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var subId = await SeedSubcontractAsync(db, originalValue: 200_000m, retainagePercent: 10m);

        var result = await service.CreatePaymentApplicationAsync(
            new CreatePaymentApplicationCommand(
                subId, DateTime.UtcNow.AddDays(-30), DateTime.UtcNow,
                50_000m, 5_000m, "INV-001", null));

        result.IsSuccess.Should().BeTrue();
        var payApp = result.Value!;

        // WorkCompletedToDate = Previous (0) + ThisPeriod (50,000) = 50,000
        payApp.WorkCompletedToDate.Should().Be(50_000m);

        // TotalCompletedAndStored = WorkCompletedToDate (50,000) + StoredMaterials (5,000) = 55,000
        payApp.TotalCompletedAndStored.Should().Be(55_000m);

        // RetainageThisPeriod = WorkCompletedThisPeriod (50,000) * 10% = 5,000
        payApp.RetainageThisPeriod.Should().Be(5_000m);

        // TotalRetainage = Previous (0) + ThisPeriod (5,000) = 5,000
        payApp.TotalRetainage.Should().Be(5_000m);

        // TotalEarnedLessRetainage = TotalCompletedAndStored (55,000) - TotalRetainage (5,000) = 50,000
        payApp.TotalEarnedLessRetainage.Should().Be(50_000m);

        // CurrentPaymentDue = TotalEarnedLessRetainage (50,000) - LessPreviousCertificates (0) = 50,000
        payApp.CurrentPaymentDue.Should().Be(50_000m);

        // Verify AIA G702 identity:
        // TotalCompletedAndStored - TotalRetainage - LessPreviousCertificates = CurrentPaymentDue
        var g702Check = payApp.TotalCompletedAndStored - payApp.TotalRetainage - payApp.LessPreviousCertificates;
        g702Check.Should().Be(payApp.CurrentPaymentDue);
    }

    [Fact]
    public async Task CreatePaymentApp_SecondApp_CarriesForwardCorrectly()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var subId = await SeedSubcontractAsync(db, originalValue: 200_000m, retainagePercent: 10m);

        // First pay app
        var first = await service.CreatePaymentApplicationAsync(
            new CreatePaymentApplicationCommand(
                subId, DateTime.UtcNow.AddDays(-60), DateTime.UtcNow.AddDays(-30),
                40_000m, 0m, "INV-001", null));
        first.IsSuccess.Should().BeTrue();

        // Second pay app
        var second = await service.CreatePaymentApplicationAsync(
            new CreatePaymentApplicationCommand(
                subId, DateTime.UtcNow.AddDays(-30), DateTime.UtcNow,
                30_000m, 2_000m, "INV-002", null));
        second.IsSuccess.Should().BeTrue();
        var payApp2 = second.Value!;

        payApp2.ApplicationNumber.Should().Be(2);
        payApp2.WorkCompletedPrevious.Should().Be(40_000m);
        payApp2.WorkCompletedToDate.Should().Be(70_000m);
        payApp2.TotalCompletedAndStored.Should().Be(72_000m);

        // Retainage: previous 4,000 + this period 3,000 = 7,000
        payApp2.RetainagePrevious.Should().Be(4_000m);
        payApp2.RetainageThisPeriod.Should().Be(3_000m);
        payApp2.TotalRetainage.Should().Be(7_000m);

        // TotalEarnedLessRetainage = 72,000 - 7,000 = 65,000
        payApp2.TotalEarnedLessRetainage.Should().Be(65_000m);

        // LessPreviousCertificates = first app's TotalEarnedLessRetainage = 40,000 - 4,000 = 36,000
        payApp2.LessPreviousCertificates.Should().Be(36_000m);

        // CurrentPaymentDue = 65,000 - 36,000 = 29,000
        payApp2.CurrentPaymentDue.Should().Be(29_000m);

        // G702 identity check
        var g702Check = payApp2.TotalCompletedAndStored - payApp2.TotalRetainage - payApp2.LessPreviousCertificates;
        g702Check.Should().Be(payApp2.CurrentPaymentDue);
    }

    [Fact]
    public async Task CreatePaymentApp_Overbilling_Fails()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var subId = await SeedSubcontractAsync(db, originalValue: 50_000m, retainagePercent: 10m);

        var result = await service.CreatePaymentApplicationAsync(
            new CreatePaymentApplicationCommand(
                subId, DateTime.UtcNow.AddDays(-30), DateTime.UtcNow,
                55_000m, 0m, null, null));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("OVERBILLING");
    }

    // === Payment Application Delta Logic (CRITICAL #2) ===

    [Fact]
    public async Task UpdatePaidPayApp_WorkChange_DeltaReflectsActualDifference()
    {
        // Regression test: oldCurrentPaymentDue must be captured BEFORE recalculation
        // so that subcontract.BilledToDate is adjusted by the true delta, not zero.
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var subId = await SeedSubcontractAsync(db, originalValue: 200_000m, retainagePercent: 10m);

        // Create and pay a first payment app (50,000 work)
        var created = await service.CreatePaymentApplicationAsync(
            new CreatePaymentApplicationCommand(
                subId, DateTime.UtcNow.AddDays(-60), DateTime.UtcNow.AddDays(-30),
                50_000m, 0m, "INV-001", null));
        created.IsSuccess.Should().BeTrue();
        var payAppId = created.Value!.Id;
        var originalPaymentDue = created.Value!.CurrentPaymentDue; // 45,000 (50k - 10% retainage)

        // Transition to Paid
        await service.UpdatePaymentApplicationAsync(new UpdatePaymentApplicationCommand(
            payAppId, 50_000m, 0m, PaymentApplicationStatus.Submitted,
            null, null, "INV-001", null, null));
        await service.UpdatePaymentApplicationAsync(new UpdatePaymentApplicationCommand(
            payAppId, 50_000m, 0m, PaymentApplicationStatus.Reviewed,
            null, null, "INV-001", null, null));
        await service.UpdatePaymentApplicationAsync(new UpdatePaymentApplicationCommand(
            payAppId, 50_000m, 0m, PaymentApplicationStatus.Approved,
            "Approver", 45_000m, "INV-001", null, null));
        await service.UpdatePaymentApplicationAsync(new UpdatePaymentApplicationCommand(
            payAppId, 50_000m, 0m, PaymentApplicationStatus.Paid,
            "Approver", 45_000m, "INV-001", "CHK-001", null));

        var subBeforeEdit = await db.Set<Subcontract>().FirstAsync(s => s.Id == subId);
        var billedBefore = subBeforeEdit.BilledToDate;

        // Now edit the Paid pay app: increase work from 50k to 60k
        var updated = await service.UpdatePaymentApplicationAsync(new UpdatePaymentApplicationCommand(
            payAppId, 60_000m, 0m, PaymentApplicationStatus.Paid,
            "Approver", 54_000m, "INV-001", "CHK-001", null));
        updated.IsSuccess.Should().BeTrue();

        var subAfterEdit = await db.Set<Subcontract>().FirstAsync(s => s.Id == subId);

        // The billed delta should be the difference between new and old CurrentPaymentDue
        // Old: 50k - 5k retainage = 45k. New: 60k - 6k retainage = 54k. Delta = 9k.
        var expectedDelta = updated.Value!.CurrentPaymentDue - originalPaymentDue;
        var actualDelta = subAfterEdit.BilledToDate - billedBefore;
        actualDelta.Should().Be(expectedDelta);
        actualDelta.Should().NotBe(0m, "delta should not be zero — the old bug captured oldCurrentPaymentDue after mutation");
    }
}
