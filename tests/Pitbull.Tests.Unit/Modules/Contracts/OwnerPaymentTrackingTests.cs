using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features;
using Pitbull.Contracts.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.Contracts;

public sealed class OwnerPaymentTrackingTests
{
    private static PaymentApplicationService CreateService(PitbullDbContext db) => new(db);

    // === ComputePaymentStatus ===

    [Fact]
    public void ComputePaymentStatus_NotSubmitted_ReturnsNotDue()
    {
        var pa = new PaymentApplication { SubmittedDate = null };
        PaymentApplicationService.ComputePaymentStatus(pa).Should().Be(OwnerPaymentStatus.NotDue);
    }

    [Fact]
    public void ComputePaymentStatus_PaidInFull_ReturnsReceived()
    {
        var pa = new PaymentApplication
        {
            SubmittedDate = DateTime.UtcNow.AddDays(-10),
            CurrentPaymentDue = 1000m,
            PaidAmount = 1000m,
            PaidDate = DateTime.UtcNow
        };
        PaymentApplicationService.ComputePaymentStatus(pa).Should().Be(OwnerPaymentStatus.Received);
    }

    [Fact]
    public void ComputePaymentStatus_PartialPayment_ReturnsPartial()
    {
        var pa = new PaymentApplication
        {
            SubmittedDate = DateTime.UtcNow.AddDays(-10),
            CurrentPaymentDue = 1000m,
            PaidAmount = 500m
        };
        PaymentApplicationService.ComputePaymentStatus(pa).Should().Be(OwnerPaymentStatus.Partial);
    }

    [Fact]
    public void ComputePaymentStatus_PastExpectedDate_ReturnsOverdue()
    {
        var pa = new PaymentApplication
        {
            SubmittedDate = DateTime.UtcNow.AddDays(-45),
            ExpectedPaymentDate = DateTime.UtcNow.AddDays(-15),
            CurrentPaymentDue = 1000m
        };
        PaymentApplicationService.ComputePaymentStatus(pa).Should().Be(OwnerPaymentStatus.Overdue);
    }

    [Fact]
    public void ComputePaymentStatus_SubmittedNotOverdue_ReturnsPending()
    {
        var pa = new PaymentApplication
        {
            SubmittedDate = DateTime.UtcNow.AddDays(-5),
            ExpectedPaymentDate = DateTime.UtcNow.AddDays(25),
            CurrentPaymentDue = 1000m
        };
        PaymentApplicationService.ComputePaymentStatus(pa).Should().Be(OwnerPaymentStatus.Pending);
    }

    [Fact]
    public void ComputePaymentStatus_OverpaidAmount_ReturnsReceived()
    {
        var pa = new PaymentApplication
        {
            SubmittedDate = DateTime.UtcNow.AddDays(-10),
            CurrentPaymentDue = 1000m,
            PaidAmount = 1200m,
            PaidDate = DateTime.UtcNow
        };
        PaymentApplicationService.ComputePaymentStatus(pa).Should().Be(OwnerPaymentStatus.Received);
    }

    // === ComputeDaysOutstanding ===

    [Fact]
    public void ComputeDaysOutstanding_NotSubmitted_ReturnsZero()
    {
        var pa = new PaymentApplication { SubmittedDate = null };
        PaymentApplicationService.ComputeDaysOutstanding(pa).Should().Be(0);
    }

    [Fact]
    public void ComputeDaysOutstanding_SubmittedAndPaid_ReturnsDaysBetween()
    {
        var pa = new PaymentApplication
        {
            SubmittedDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            PaidDate = new DateTime(2026, 1, 31, 0, 0, 0, DateTimeKind.Utc)
        };
        PaymentApplicationService.ComputeDaysOutstanding(pa).Should().Be(30);
    }

    [Fact]
    public void ComputeDaysOutstanding_SubmittedNotPaid_ReturnsDaysToNow()
    {
        var pa = new PaymentApplication
        {
            SubmittedDate = DateTime.UtcNow.AddDays(-15)
        };
        PaymentApplicationService.ComputeDaysOutstanding(pa).Should().BeGreaterThanOrEqualTo(14);
        PaymentApplicationService.ComputeDaysOutstanding(pa).Should().BeLessThanOrEqualTo(16);
    }

    // === MapToTrackingDto ===

    [Fact]
    public void MapToTrackingDto_MapsAllFields()
    {
        var pa = new PaymentApplication
        {
            Id = Guid.NewGuid(),
            SubcontractId = Guid.NewGuid(),
            ApplicationNumber = 3,
            Status = PaymentApplicationStatus.Approved,
            CurrentPaymentDue = 5000m,
            SubmittedDate = DateTime.UtcNow.AddDays(-20),
            ExpectedPaymentDate = DateTime.UtcNow.AddDays(10),
            PaymentMethod = "ACH",
            CheckNumber = "12345"
        };

        var dto = PaymentApplicationService.MapToTrackingDto(pa, "Acme Concrete");

        dto.SubcontractorName.Should().Be("Acme Concrete");
        dto.ApplicationNumber.Should().Be(3);
        dto.WorkflowStatus.Should().Be(PaymentApplicationStatus.Approved);
        dto.CurrentPaymentDue.Should().Be(5000m);
        dto.PaymentMethod.Should().Be("ACH");
        dto.PaymentStatus.Should().Be(OwnerPaymentStatus.Pending);
    }

    // === Submit auto-calculates ExpectedPaymentDate ===

    [Fact]
    public async Task Submit_AutoCalculatesExpectedPaymentDate()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, new PaymentApplicationSettings
        {
            DefaultPaymentTermDays = 45,
            RequireSignedSubcontract = false
        });
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow);
        var payAppId = await SeedPaymentApplicationAsync(db, companyId, subcontractId, PaymentApplicationStatus.Draft);

        var result = await service.SubmitAsync(payAppId);

        result.IsSuccess.Should().BeTrue();
        result.Value!.ExpectedPaymentDate.Should().NotBeNull();
        result.Value.ExpectedPaymentDate!.Value.Should().BeCloseTo(
            DateTime.UtcNow.AddDays(45), TimeSpan.FromMinutes(5));
    }

    [Fact]
    public async Task Submit_DefaultPaymentTerms_Uses30Days()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, new PaymentApplicationSettings { RequireSignedSubcontract = false });
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow);
        var payAppId = await SeedPaymentApplicationAsync(db, companyId, subcontractId, PaymentApplicationStatus.Draft);

        var result = await service.SubmitAsync(payAppId);

        result.IsSuccess.Should().BeTrue();
        result.Value!.ExpectedPaymentDate.Should().NotBeNull();
        result.Value.ExpectedPaymentDate!.Value.Should().BeCloseTo(
            DateTime.UtcNow.AddDays(30), TimeSpan.FromMinutes(5));
    }

    // === RecordPayment ===

    [Fact]
    public async Task RecordPayment_Approved_TransitionsToPaidAndUpdatesSubcontract()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, new PaymentApplicationSettings { RequireLienWaiverBeforePaid = false });
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow);
        var payAppId = await SeedPaymentApplicationAsync(
            db, companyId, subcontractId, PaymentApplicationStatus.Approved,
            currentPaymentDue: 2000m, totalRetainage: 200m);

        var paidDate = new DateTime(2026, 2, 20, 0, 0, 0, DateTimeKind.Utc);
        var result = await service.RecordPaymentAsync(payAppId, new RecordOwnerPaymentRequest(
            PaymentAmount: 2000m,
            PaymentDate: paidDate,
            PaymentMethod: "Wire",
            CheckNumber: null,
            Notes: "Received wire transfer"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.PaymentStatus.Should().Be(OwnerPaymentStatus.Received);
        result.Value.PaymentMethod.Should().Be("Wire");
        result.Value.PaidAmount.Should().Be(2000m);

        var sub = await db.Set<Subcontract>().FirstAsync(s => s.Id == subcontractId);
        sub.BilledToDate.Should().Be(2000m);
        sub.PaidToDate.Should().Be(2000m);
    }

    [Fact]
    public async Task RecordPayment_Draft_FailsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, null);
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow);
        var payAppId = await SeedPaymentApplicationAsync(db, companyId, subcontractId, PaymentApplicationStatus.Draft);

        var result = await service.RecordPaymentAsync(payAppId,
            new RecordOwnerPaymentRequest(1000m, DateTime.UtcNow, "Check", "1001", null));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task RecordPayment_ZeroAmount_FailsValidation()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, null);
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow);
        var payAppId = await SeedPaymentApplicationAsync(db, companyId, subcontractId, PaymentApplicationStatus.Approved);

        var result = await service.RecordPaymentAsync(payAppId,
            new RecordOwnerPaymentRequest(0m, DateTime.UtcNow, "Check", null, null));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task RecordPayment_PartialPayment_ReturnsPartialStatus()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, null);
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow);
        var payAppId = await SeedPaymentApplicationAsync(
            db, companyId, subcontractId, PaymentApplicationStatus.Approved, currentPaymentDue: 5000m);

        var result = await service.RecordPaymentAsync(payAppId,
            new RecordOwnerPaymentRequest(2000m, DateTime.UtcNow, "ACH", null, null));

        result.IsSuccess.Should().BeTrue();
        result.Value!.PaymentStatus.Should().Be(OwnerPaymentStatus.Partial);
        result.Value.PaidAmount.Should().Be(2000m);
    }

    [Fact]
    public async Task RecordPayment_NotFound_Fails()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.RecordPaymentAsync(Guid.NewGuid(),
            new RecordOwnerPaymentRequest(1000m, DateTime.UtcNow, "Check", null, null));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task RecordPayment_PartialPayment_KeepsApprovedStatus()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, null);
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow);
        var payAppId = await SeedPaymentApplicationAsync(
            db, companyId, subcontractId, PaymentApplicationStatus.Approved, currentPaymentDue: 5000m);

        var result = await service.RecordPaymentAsync(payAppId,
            new RecordOwnerPaymentRequest(2000m, DateTime.UtcNow, "ACH", null, null));

        result.IsSuccess.Should().BeTrue();
        result.Value!.WorkflowStatus.Should().Be(PaymentApplicationStatus.Approved);
        result.Value.PaidAmount.Should().Be(2000m);
    }

    [Fact]
    public async Task RecordPayment_SecondPartialPayment_UpdatesSubcontractPaidToDate()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, null);
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow);
        var payAppId = await SeedPaymentApplicationAsync(
            db, companyId, subcontractId, PaymentApplicationStatus.Approved,
            currentPaymentDue: 5000m, totalRetainage: 500m);

        // First partial payment
        await service.RecordPaymentAsync(payAppId,
            new RecordOwnerPaymentRequest(2000m, DateTime.UtcNow, "ACH", null, null));

        // Second partial payment — completes the full amount
        var result = await service.RecordPaymentAsync(payAppId,
            new RecordOwnerPaymentRequest(3000m, DateTime.UtcNow, "Wire", null, null));

        result.IsSuccess.Should().BeTrue();
        result.Value!.PaidAmount.Should().Be(5000m);
        result.Value.WorkflowStatus.Should().Be(PaymentApplicationStatus.Paid);
        result.Value.PaymentStatus.Should().Be(OwnerPaymentStatus.Received);

        var sub = await db.Set<Subcontract>().FirstAsync(s => s.Id == subcontractId);
        sub.PaidToDate.Should().Be(5000m);
        sub.BilledToDate.Should().Be(5000m);
    }

    [Fact]
    public async Task RecordPayment_ExceedsBalance_FailsOverpayment()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, null);
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow);
        var payAppId = await SeedPaymentApplicationAsync(
            db, companyId, subcontractId, PaymentApplicationStatus.Approved, currentPaymentDue: 1000m);

        var result = await service.RecordPaymentAsync(payAppId,
            new RecordOwnerPaymentRequest(1500m, DateTime.UtcNow, "Check", "5001", null));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("OVERPAYMENT");
    }

    [Fact]
    public async Task RecordPayment_SecondPaymentExceedsRemaining_FailsOverpayment()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, null);
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow);
        var payAppId = await SeedPaymentApplicationAsync(
            db, companyId, subcontractId, PaymentApplicationStatus.Approved, currentPaymentDue: 5000m);

        // First payment OK
        await service.RecordPaymentAsync(payAppId,
            new RecordOwnerPaymentRequest(3000m, DateTime.UtcNow, "ACH", null, null));

        // Second payment exceeds remaining 2000
        var result = await service.RecordPaymentAsync(payAppId,
            new RecordOwnerPaymentRequest(2500m, DateTime.UtcNow, "Wire", null, null));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("OVERPAYMENT");
    }

    // === GetPaymentStatus ===

    [Fact]
    public async Task GetPaymentStatus_ReturnsTrackingDto()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, null);
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow);
        var payAppId = await SeedPaymentApplicationAsync(
            db, companyId, subcontractId, PaymentApplicationStatus.Submitted, currentPaymentDue: 3000m);

        var result = await service.GetPaymentStatusAsync(payAppId);

        result.IsSuccess.Should().BeTrue();
        result.Value!.CurrentPaymentDue.Should().Be(3000m);
        result.Value.PaymentStatus.Should().Be(OwnerPaymentStatus.Pending);
    }

    [Fact]
    public async Task GetPaymentStatus_NotFound_Fails()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.GetPaymentStatusAsync(Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    // === GetPaymentTracking ===

    [Fact]
    public async Task GetPaymentTracking_ReturnsPayAppsForProject()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, null);
        var projectId = Guid.NewGuid();
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow, projectId);
        await SeedPaymentApplicationAsync(db, companyId, subcontractId, PaymentApplicationStatus.Submitted, currentPaymentDue: 1000m);
        await SeedPaymentApplicationAsync(db, companyId, subcontractId, PaymentApplicationStatus.Approved, currentPaymentDue: 2000m, applicationNumber: 2);

        var result = await service.GetPaymentTrackingAsync(projectId);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetPaymentTracking_DifferentProject_Empty()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, null);
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow);
        await SeedPaymentApplicationAsync(db, companyId, subcontractId, PaymentApplicationStatus.Submitted);

        var result = await service.GetPaymentTrackingAsync(Guid.NewGuid());

        result.IsSuccess.Should().BeTrue();
        result.Value!.Should().BeEmpty();
    }

    // === GetPaymentAging ===

    [Fact]
    public async Task GetPaymentAging_BucketsCorrectly()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, null);
        var projectId = Guid.NewGuid();
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow, projectId);

        // 10 days old (0-30 bucket)
        await SeedPaymentApplicationAsync(db, companyId, subcontractId, PaymentApplicationStatus.Submitted,
            currentPaymentDue: 1000m, submittedDate: DateTime.UtcNow.AddDays(-10));
        // 50 days old (31-60 bucket)
        await SeedPaymentApplicationAsync(db, companyId, subcontractId, PaymentApplicationStatus.Approved,
            currentPaymentDue: 2000m, submittedDate: DateTime.UtcNow.AddDays(-50), applicationNumber: 2);

        var result = await service.GetPaymentAgingAsync(projectId);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Buckets.Should().HaveCount(4);

        var bucket0_30 = result.Value.Buckets[0];
        bucket0_30.Label.Should().Be("0-30 days");
        bucket0_30.Count.Should().Be(1);
        bucket0_30.TotalAmount.Should().Be(1000m);

        var bucket31_60 = result.Value.Buckets[1];
        bucket31_60.Label.Should().Be("31-60 days");
        bucket31_60.Count.Should().Be(1);
        bucket31_60.TotalAmount.Should().Be(2000m);

        result.Value.TotalOutstanding.Should().Be(3000m);
    }

    [Fact]
    public async Task GetPaymentAging_PaidAppsExcludedFromBuckets()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var companyId = await SeedCompanyAsync(db, null);
        var projectId = Guid.NewGuid();
        var subcontractId = await SeedSubcontractAsync(db, companyId, DateTime.UtcNow, projectId);

        // Submitted but paid in full
        await SeedPaymentApplicationAsync(db, companyId, subcontractId, PaymentApplicationStatus.Paid,
            currentPaymentDue: 5000m, submittedDate: DateTime.UtcNow.AddDays(-20), paidAmount: 5000m);

        var result = await service.GetPaymentAgingAsync(projectId);

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalOutstanding.Should().Be(0m);
    }

    // === Seed Helpers ===

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
        PitbullDbContext db, Guid companyId, DateTime? executionDate, Guid? projectId = null)
    {
        var subcontractId = Guid.NewGuid();
        db.Set<Subcontract>().Add(new Subcontract
        {
            Id = subcontractId,
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = companyId,
            ProjectId = projectId ?? Guid.NewGuid(),
            SubcontractNumber = $"SC-{Guid.NewGuid().ToString()[..8]}",
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
        DateTime? submittedDate = null,
        decimal? paidAmount = null,
        int applicationNumber = 1)
    {
        var payAppId = Guid.NewGuid();
        var isSubmitted = status != PaymentApplicationStatus.Draft;
        db.Set<PaymentApplication>().Add(new PaymentApplication
        {
            Id = payAppId,
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = companyId,
            SubcontractId = subcontractId,
            ApplicationNumber = applicationNumber,
            PeriodStart = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd = new DateTime(2026, 2, 28, 0, 0, 0, DateTimeKind.Utc),
            Status = status,
            CurrentPaymentDue = currentPaymentDue,
            TotalRetainage = totalRetainage,
            SubmittedDate = isSubmitted ? (submittedDate ?? DateTime.UtcNow) : null,
            PaidAmount = paidAmount,
            PaidDate = paidAmount.HasValue ? DateTime.UtcNow : null,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        return payAppId;
    }
}
