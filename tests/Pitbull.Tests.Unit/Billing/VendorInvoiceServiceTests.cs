using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Pitbull.Billing.Features.VendorInvoices;
using Pitbull.Billing.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Tests.Unit.Billing;

public class VendorInvoiceServiceTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestCompanyId = Guid.NewGuid();
    private readonly PitbullDbContext _db;
    private readonly VendorInvoiceService _service;

    public VendorInvoiceServiceTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new() { CompanyId = TestCompanyId };

        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);
        Mock<IJournalEntryService> journalEntryServiceMock = new();
        _service = new VendorInvoiceService(
            _db,
            NullLogger<VendorInvoiceService>.Instance,
            journalEntryServiceMock.Object);
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    private CreateVendorInvoiceCommand ValidCreateCommand(decimal totalAmount = 5000m) =>
        new(VendorId: Guid.NewGuid(),
            InvoiceNumber: $"INV-{Guid.NewGuid().ToString()[..8]}",
            InvoiceDate: new DateOnly(2026, 2, 1),
            DueDate: new DateOnly(2026, 3, 1),
            TotalAmount: totalAmount,
            PurchaseOrderId: null);

    // ── HIGH #16: Non-positive total rejected ──

    [Fact]
    public async Task Create_ZeroAmount_ReturnsValidationError()
    {
        var result = await _service.CreateVendorInvoiceAsync(ValidCreateCommand(totalAmount: 0m));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("positive");
    }

    [Fact]
    public async Task Create_NegativeAmount_ReturnsValidationError()
    {
        var result = await _service.CreateVendorInvoiceAsync(ValidCreateCommand(totalAmount: -100m));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task Create_PositiveAmount_Succeeds()
    {
        var result = await _service.CreateVendorInvoiceAsync(ValidCreateCommand(totalAmount: 5000m));

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalAmount.Should().Be(5000m);
    }

    // ── HIGH #15: Status transition validation ──

    [Fact]
    public async Task Update_PendingToApproved_Succeeds()
    {
        var created = await _service.CreateVendorInvoiceAsync(ValidCreateCommand());
        created.IsSuccess.Should().BeTrue();

        var result = await _service.UpdateVendorInvoiceAsync(new UpdateVendorInvoiceCommand(
            VendorInvoiceId: created.Value!.Id,
            VendorId: null, InvoiceNumber: null, InvoiceDate: null, DueDate: null,
            TotalAmount: null, Status: VendorInvoiceStatus.Approved,
            PurchaseOrderId: null, ClearPurchaseOrderId: false));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(VendorInvoiceStatus.Approved);
    }

    [Fact]
    public async Task Update_PendingToPaid_ReturnsInvalidTransition()
    {
        var created = await _service.CreateVendorInvoiceAsync(ValidCreateCommand());
        created.IsSuccess.Should().BeTrue();

        // Try to jump from Pending straight to Paid (skipping Approved)
        var result = await _service.UpdateVendorInvoiceAsync(new UpdateVendorInvoiceCommand(
            VendorInvoiceId: created.Value!.Id,
            VendorId: null, InvoiceNumber: null, InvoiceDate: null, DueDate: null,
            TotalAmount: null, Status: VendorInvoiceStatus.Paid,
            PurchaseOrderId: null, ClearPurchaseOrderId: false));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS_TRANSITION");
    }

    [Fact]
    public async Task Update_ApprovedToPending_ReturnsInvalidTransition()
    {
        var created = await _service.CreateVendorInvoiceAsync(ValidCreateCommand());
        created.IsSuccess.Should().BeTrue();

        // Advance to Approved
        await _service.UpdateVendorInvoiceAsync(new UpdateVendorInvoiceCommand(
            VendorInvoiceId: created.Value!.Id,
            VendorId: null, InvoiceNumber: null, InvoiceDate: null, DueDate: null,
            TotalAmount: null, Status: VendorInvoiceStatus.Approved,
            PurchaseOrderId: null, ClearPurchaseOrderId: false));

        // Try to go backwards to Pending
        var result = await _service.UpdateVendorInvoiceAsync(new UpdateVendorInvoiceCommand(
            VendorInvoiceId: created.Value!.Id,
            VendorId: null, InvoiceNumber: null, InvoiceDate: null, DueDate: null,
            TotalAmount: null, Status: VendorInvoiceStatus.Pending,
            PurchaseOrderId: null, ClearPurchaseOrderId: false));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS_TRANSITION");
    }
}
