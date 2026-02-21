using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features;
using Pitbull.Contracts.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.Contracts;

public sealed class PaymentApplicationServiceTests
{
    private static PaymentApplicationService CreateService(PitbullDbContext db) => new(db);

    [Fact]
    public async Task Submit_DraftWithSignedSubcontract_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, null);
        var subcontractId = await SeedSubcontractAsync(db, companyId, executionDate: DateTime.UtcNow);
        var payAppId = await SeedPaymentApplicationAsync(db, companyId, subcontractId, PaymentApplicationStatus.Draft);

        var result = await service.SubmitAsync(payAppId);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PaymentApplicationStatus.Submitted);
        result.Value.SubmittedDate.Should().NotBeNull();
    }

    [Fact]
    public async Task Submit_DraftWithUnsignedSubcontract_AndRequireSignedEnabled_Fails()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, new PaymentApplicationSettings { RequireSignedSubcontract = true });
        var subcontractId = await SeedSubcontractAsync(db, companyId, executionDate: null);
        var payAppId = await SeedPaymentApplicationAsync(db, companyId, subcontractId, PaymentApplicationStatus.Draft);

        var result = await service.SubmitAsync(payAppId);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("UNSIGNED_SUBCONTRACT");
    }

    [Fact]
    public async Task Submit_DraftWithUnsignedSubcontract_AndRequireSignedDisabled_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, new PaymentApplicationSettings { RequireSignedSubcontract = false });
        var subcontractId = await SeedSubcontractAsync(db, companyId, executionDate: null);
        var payAppId = await SeedPaymentApplicationAsync(db, companyId, subcontractId, PaymentApplicationStatus.Draft);

        var result = await service.SubmitAsync(payAppId);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PaymentApplicationStatus.Submitted);
    }

    [Fact]
    public async Task Review_Submitted_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, null);
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow);
        var payAppId = await SeedPaymentApplicationAsync(db, companyId, subcontractId, PaymentApplicationStatus.Submitted);

        var result = await service.ReviewAsync(payAppId, new ReviewPaymentApplicationRequest("pm@pitbull.local", "Reviewed"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PaymentApplicationStatus.Reviewed);
        result.Value.ReviewedBy.Should().Be("pm@pitbull.local");
    }

    [Fact]
    public async Task Approve_Reviewed_WhenWorkflowEnabled_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, new PaymentApplicationSettings { EnableApprovalWorkflow = true });
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow);
        var payAppId = await SeedPaymentApplicationAsync(db, companyId, subcontractId, PaymentApplicationStatus.Reviewed, currentPaymentDue: 1234m);

        var result = await service.ApproveAsync(payAppId, new ApprovePaymentApplicationRequest("controller@pitbull.local", null, null, "ok"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PaymentApplicationStatus.Approved);
        result.Value.ApprovedBy.Should().Be("controller@pitbull.local");
    }

    [Fact]
    public async Task Approve_Submitted_WhenWorkflowEnabled_FailsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, new PaymentApplicationSettings { EnableApprovalWorkflow = true });
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow);
        var payAppId = await SeedPaymentApplicationAsync(db, companyId, subcontractId, PaymentApplicationStatus.Submitted);

        var result = await service.ApproveAsync(payAppId, new ApprovePaymentApplicationRequest("controller@pitbull.local", null, null, null));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task Approve_Submitted_WhenWorkflowDisabled_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, new PaymentApplicationSettings { EnableApprovalWorkflow = false });
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow);
        var payAppId = await SeedPaymentApplicationAsync(db, companyId, subcontractId, PaymentApplicationStatus.Submitted, currentPaymentDue: 950m);

        var result = await service.ApproveAsync(payAppId, new ApprovePaymentApplicationRequest("controller@pitbull.local", null, null, null));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PaymentApplicationStatus.Approved);
        result.Value.CurrentPaymentDue.Should().Be(950m);
    }

    [Fact]
    public async Task Reject_Submitted_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, null);
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow);
        var payAppId = await SeedPaymentApplicationAsync(db, companyId, subcontractId, PaymentApplicationStatus.Submitted);

        var result = await service.RejectAsync(payAppId, new RejectPaymentApplicationRequest("approver@pitbull.local", "Missing backup"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PaymentApplicationStatus.Rejected);
        result.Value.RejectionReason.Should().Be("Missing backup");
    }

    [Fact]
    public async Task Reject_Draft_FailsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, null);
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow);
        var payAppId = await SeedPaymentApplicationAsync(db, companyId, subcontractId, PaymentApplicationStatus.Draft);

        var result = await service.RejectAsync(payAppId, new RejectPaymentApplicationRequest("approver@pitbull.local", "no"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task MarkPaid_Approved_UpdatesStatusAndSubcontractMoney()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, new PaymentApplicationSettings { RequireLienWaiverBeforePaid = false });
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow);
        var payAppId = await SeedPaymentApplicationAsync(
            db,
            companyId,
            subcontractId,
            PaymentApplicationStatus.Approved,
            currentPaymentDue: 1000m,
            totalRetainage: 125m);

        var paidAt = new DateTime(2026, 2, 21, 10, 30, 0, DateTimeKind.Utc);
        var result = await service.MarkPaidAsync(
            payAppId,
            new MarkPaymentApplicationPaidRequest(
                PaidAmount: 900m,
                PaidDate: paidAt,
                PaymentReference: "CHK-1001",
                CheckNumber: "1001",
                Notes: "Paid"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PaymentApplicationStatus.Paid);
        result.Value.PaidAmount.Should().Be(900m);
        result.Value.CheckNumber.Should().Be("1001");

        var subcontract = await db.Set<Subcontract>().FirstAsync(s => s.Id == subcontractId);
        subcontract.BilledToDate.Should().Be(1000m);
        subcontract.PaidToDate.Should().Be(900m);
        subcontract.RetainageHeld.Should().Be(125m);
    }

    [Fact]
    public async Task MarkPaid_Approved_WhenLienWaiverRequired_Fails()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, new PaymentApplicationSettings { RequireLienWaiverBeforePaid = true });
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow);
        var payAppId = await SeedPaymentApplicationAsync(db, companyId, subcontractId, PaymentApplicationStatus.Approved, currentPaymentDue: 1000m);

        var result = await service.MarkPaidAsync(
            payAppId,
            new MarkPaymentApplicationPaidRequest(1000m, DateTime.UtcNow, "CHK-1001", "1001", null));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("LIEN_WAIVER_REQUIRED");
    }

    [Fact]
    public async Task MarkPaid_Submitted_FailsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, null);
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow);
        var payAppId = await SeedPaymentApplicationAsync(db, companyId, subcontractId, PaymentApplicationStatus.Submitted);

        var result = await service.MarkPaidAsync(
            payAppId,
            new MarkPaymentApplicationPaidRequest(1000m, DateTime.UtcNow, "CHK-1001", "1001", null));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task UpdateLineItems_RecalculateTotals_UpdatesMonetaryFields()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, new PaymentApplicationSettings { LockSubmittedLineItems = true });
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow);
        var payAppId = await SeedPaymentApplicationAsync(
            db,
            companyId,
            subcontractId,
            PaymentApplicationStatus.Draft,
            currentPaymentDue: 0m,
            workCompletedPrevious: 50m,
            retainagePrevious: 3m,
            lessPreviousCertificates: 10m);

        var sov1 = Guid.NewGuid();
        var sov2 = Guid.NewGuid();
        await SeedLineItemAsync(db, payAppId, companyId, sov1, 100m, 20m, 0m, 5m, 0m, 10m, 1);
        await SeedLineItemAsync(db, payAppId, companyId, sov2, 200m, 0m, 0m, 0m, 0m, 5m, 2);

        var result = await service.UpdateLineItemsAsync(
            payAppId,
            new UpdatePaymentApplicationLineItemsRequest(
            [
                new PaymentApplicationLineItemInputDto(sov1, WorkCompletedThisPeriod: 10m, MaterialsStoredThisPeriod: 2m, RetainagePercentOverride: null),
                new PaymentApplicationLineItemInputDto(sov2, WorkCompletedThisPeriod: 40m, MaterialsStoredThisPeriod: 0m, RetainagePercentOverride: null)
            ],
            RecalculateTotals: true));

        result.IsSuccess.Should().BeTrue();

        var payApp = await db.Set<PaymentApplication>().FirstAsync(pa => pa.Id == payAppId);
        payApp.WorkCompletedThisPeriod.Should().Be(50m);
        payApp.StoredMaterials.Should().Be(2m);
        payApp.WorkCompletedToDate.Should().Be(100m);
        payApp.TotalCompletedAndStored.Should().Be(77m);
        payApp.RetainageThisPeriod.Should().Be(3.2m);
        payApp.TotalRetainage.Should().Be(6.2m);
        payApp.TotalEarnedLessRetainage.Should().Be(70.8m);
        payApp.CurrentPaymentDue.Should().Be(60.8m);
    }

    [Fact]
    public async Task UpdateLineItems_Submitted_WhenLockSubmittedTrue_Fails()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, new PaymentApplicationSettings { LockSubmittedLineItems = true });
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow);
        var payAppId = await SeedPaymentApplicationAsync(db, companyId, subcontractId, PaymentApplicationStatus.Submitted);
        var sovId = Guid.NewGuid();
        await SeedLineItemAsync(db, payAppId, companyId, sovId, 100m, 0m, 0m, 0m, 0m, 10m, 1);

        var result = await service.UpdateLineItemsAsync(
            payAppId,
            new UpdatePaymentApplicationLineItemsRequest(
            [
                new PaymentApplicationLineItemInputDto(sovId, 10m, 0m, null)
            ],
            RecalculateTotals: true));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task UpdateLineItems_Submitted_WhenLockSubmittedFalse_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, new PaymentApplicationSettings { LockSubmittedLineItems = false });
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow);
        var payAppId = await SeedPaymentApplicationAsync(db, companyId, subcontractId, PaymentApplicationStatus.Submitted);
        var sovId = Guid.NewGuid();
        await SeedLineItemAsync(db, payAppId, companyId, sovId, 100m, 0m, 0m, 0m, 0m, 10m, 1);

        var result = await service.UpdateLineItemsAsync(
            payAppId,
            new UpdatePaymentApplicationLineItemsRequest(
            [
                new PaymentApplicationLineItemInputDto(sovId, 10m, 1m, null)
            ],
            RecalculateTotals: true));

        result.IsSuccess.Should().BeTrue();
    }

    private static async Task<Guid> SeedCompanyAsync(PitbullDbContext db, PaymentApplicationSettings? settings)
    {
        var companyId = TestDbContextFactory.TestCompanyId;
        db.Companies.Add(new Company
        {
            Id = companyId,
            TenantId = TestDbContextFactory.TestTenantId,
            Name = "Test Company",
            Code = "01",
            IsDeleted = false,
            PaymentApplicationSettings = settings ?? new PaymentApplicationSettings()
        });
        await db.SaveChangesAsync();
        return companyId;
    }

    private static async Task<Guid> SeedSubcontractAsync(
        PitbullDbContext db,
        Guid companyId,
        DateTime? executionDate)
    {
        var subcontractId = Guid.NewGuid();
        db.Set<Subcontract>().Add(new Subcontract
        {
            Id = subcontractId,
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = companyId,
            ProjectId = Guid.NewGuid(),
            SubcontractNumber = "SC-001",
            SubcontractorName = "Sub A",
            ScopeOfWork = "Scope",
            OriginalValue = 10_000m,
            CurrentValue = 10_000m,
            ExecutionDate = executionDate,
            Status = SubcontractStatus.Executed,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        return subcontractId;
    }

    private static async Task<Guid> SeedPaymentApplicationAsync(
        PitbullDbContext db,
        Guid companyId,
        Guid subcontractId,
        PaymentApplicationStatus status,
        decimal currentPaymentDue = 500m,
        decimal totalRetainage = 0m,
        decimal workCompletedPrevious = 0m,
        decimal retainagePrevious = 0m,
        decimal lessPreviousCertificates = 0m)
    {
        var payAppId = Guid.NewGuid();
        db.Set<PaymentApplication>().Add(new PaymentApplication
        {
            Id = payAppId,
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = companyId,
            SubcontractId = subcontractId,
            ApplicationNumber = 1,
            PeriodStart = new DateTime(2026, 2, 1),
            PeriodEnd = new DateTime(2026, 2, 28),
            Status = status,
            CurrentPaymentDue = currentPaymentDue,
            TotalRetainage = totalRetainage,
            WorkCompletedPrevious = workCompletedPrevious,
            RetainagePrevious = retainagePrevious,
            LessPreviousCertificates = lessPreviousCertificates,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        return payAppId;
    }

    private static async Task SeedLineItemAsync(
        PitbullDbContext db,
        Guid payAppId,
        Guid companyId,
        Guid sovLineItemId,
        decimal scheduledValue,
        decimal workCompletedPrevious,
        decimal workCompletedThisPeriod,
        decimal materialsStoredPrevious,
        decimal materialsStoredThisPeriod,
        decimal retainagePercent,
        int sortOrder)
    {
        db.Set<PaymentApplicationLineItem>().Add(new PaymentApplicationLineItem
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = companyId,
            PaymentApplicationId = payAppId,
            SOVLineItemId = sovLineItemId,
            ItemNumber = $"I-{sortOrder}",
            Description = $"Item {sortOrder}",
            ScheduledValue = scheduledValue,
            WorkCompletedPrevious = workCompletedPrevious,
            WorkCompletedThisPeriod = workCompletedThisPeriod,
            MaterialsStoredPrevious = materialsStoredPrevious,
            MaterialsStoredThisPeriod = materialsStoredThisPeriod,
            MaterialsStoredToDate = materialsStoredPrevious + materialsStoredThisPeriod,
            TotalCompletedAndStoredToDate = workCompletedPrevious + workCompletedThisPeriod + materialsStoredPrevious + materialsStoredThisPeriod,
            PercentComplete = 0m,
            BalanceToFinish = scheduledValue,
            RetainagePercent = retainagePercent,
            RetainageAmount = 0m,
            SortOrder = sortOrder,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
    }
}
