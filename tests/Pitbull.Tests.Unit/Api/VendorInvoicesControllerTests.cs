using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Api.Controllers;
using Pitbull.Billing.Features.PurchaseOrders;
using Pitbull.Billing.Features.VendorInvoices;
using Pitbull.Billing.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Tests.Unit.Api;

public class VendorInvoicesControllerTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();

    private readonly PitbullDbContext _db;
    private readonly PurchaseOrdersController _purchaseOrdersController;
    private readonly VendorInvoicesController _vendorInvoicesController;

    public VendorInvoicesControllerTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new();

        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);

        IPurchaseOrderService purchaseOrderService = new PurchaseOrderService(_db, NullLogger<PurchaseOrderService>.Instance);
        IVendorInvoiceService vendorInvoiceService = new VendorInvoiceService(_db, NullLogger<VendorInvoiceService>.Instance);

        _purchaseOrdersController = new PurchaseOrdersController(purchaseOrderService)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

        _vendorInvoicesController = new VendorInvoicesController(vendorInvoiceService)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    [Fact]
    public async Task Match_TwoWay_WithinTolerance_AutoApproves()
    {
        Guid vendorId = Guid.NewGuid();
        PurchaseOrderDto po = await CreatePurchaseOrderAsync(vendorId, 1000m);

        CreateVendorInvoiceRequest invoiceRequest = new(
            VendorId: vendorId,
            InvoiceNumber: "INV-100",
            InvoiceDate: DateOnly.FromDateTime(DateTime.UtcNow),
            DueDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
            TotalAmount: 1020m,
            PurchaseOrderId: po.Id);

        IActionResult createResult = await _vendorInvoicesController.Create(invoiceRequest);
        CreatedAtActionResult created = createResult.Should().BeOfType<CreatedAtActionResult>().Subject;
        VendorInvoiceDto invoice = created.Value.Should().BeOfType<VendorInvoiceDto>().Subject;

        IActionResult matchResult = await _vendorInvoicesController.Match(invoice.Id, new MatchVendorInvoiceRequest(5m));
        OkObjectResult ok = matchResult.Should().BeOfType<OkObjectResult>().Subject;
        InvoiceMatchResultDto match = ok.Value.Should().BeOfType<InvoiceMatchResultDto>().Subject;

        match.MatchType.Should().Be(InvoiceMatchType.TwoWay);
        match.VarianceAmount.Should().Be(20m);
        match.VariancePercent.Should().Be(2m);
        match.AutoApproved.Should().BeTrue();
    }

    [Fact]
    public async Task Match_ThreeWay_OverTolerance_MarksPartialMatch()
    {
        Guid vendorId = Guid.NewGuid();
        PurchaseOrderDto po = await CreatePurchaseOrderAsync(vendorId, 1000m);

        ReceivePurchaseOrderRequest receiveRequest = new(
        [
            new ReceivePurchaseOrderLineRequest(po.Lines[0].Id, 5m)
        ]);
        await _purchaseOrdersController.Receive(po.Id, receiveRequest);

        CreateVendorInvoiceRequest invoiceRequest = new(
            VendorId: vendorId,
            InvoiceNumber: "INV-200",
            InvoiceDate: DateOnly.FromDateTime(DateTime.UtcNow),
            DueDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
            TotalAmount: 700m,
            PurchaseOrderId: po.Id);

        IActionResult createResult = await _vendorInvoicesController.Create(invoiceRequest);
        CreatedAtActionResult created = createResult.Should().BeOfType<CreatedAtActionResult>().Subject;
        VendorInvoiceDto invoice = created.Value.Should().BeOfType<VendorInvoiceDto>().Subject;

        IActionResult matchResult = await _vendorInvoicesController.Match(invoice.Id, new MatchVendorInvoiceRequest(5m));
        OkObjectResult ok = matchResult.Should().BeOfType<OkObjectResult>().Subject;
        InvoiceMatchResultDto match = ok.Value.Should().BeOfType<InvoiceMatchResultDto>().Subject;

        match.MatchType.Should().Be(InvoiceMatchType.ThreeWay);
        match.VarianceAmount.Should().Be(200m);
        match.VariancePercent.Should().Be(40m);
        match.AutoApproved.Should().BeFalse();

        IActionResult getInvoiceResult = await _vendorInvoicesController.GetById(invoice.Id);
        OkObjectResult invoiceOk = getInvoiceResult.Should().BeOfType<OkObjectResult>().Subject;
        VendorInvoiceDto refreshed = invoiceOk.Value.Should().BeOfType<VendorInvoiceDto>().Subject;
        refreshed.Status.Should().Be(VendorInvoiceStatus.PartiallyMatched);
    }

    [Fact]
    public async Task Match_ToleranceThreshold_BoundaryValues_BehaveAsExpected()
    {
        Guid vendorId = Guid.NewGuid();
        PurchaseOrderDto po = await CreatePurchaseOrderAsync(vendorId, 1000m);

        CreateVendorInvoiceRequest atToleranceRequest = new(
            VendorId: vendorId,
            InvoiceNumber: "INV-300",
            InvoiceDate: DateOnly.FromDateTime(DateTime.UtcNow),
            DueDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
            TotalAmount: 1050m,
            PurchaseOrderId: po.Id);

        IActionResult createAtToleranceResult = await _vendorInvoicesController.Create(atToleranceRequest);
        VendorInvoiceDto atToleranceInvoice = ((CreatedAtActionResult)createAtToleranceResult).Value.Should().BeOfType<VendorInvoiceDto>().Subject;

        IActionResult atToleranceMatchResult = await _vendorInvoicesController.Match(atToleranceInvoice.Id, new MatchVendorInvoiceRequest(5m));
        InvoiceMatchResultDto atToleranceMatch = ((OkObjectResult)atToleranceMatchResult).Value.Should().BeOfType<InvoiceMatchResultDto>().Subject;
        atToleranceMatch.VariancePercent.Should().Be(5m);
        atToleranceMatch.AutoApproved.Should().BeTrue();

        CreateVendorInvoiceRequest overToleranceRequest = atToleranceRequest with
        {
            InvoiceNumber = "INV-301",
            TotalAmount = 1051m
        };

        IActionResult createOverToleranceResult = await _vendorInvoicesController.Create(overToleranceRequest);
        VendorInvoiceDto overToleranceInvoice = ((CreatedAtActionResult)createOverToleranceResult).Value.Should().BeOfType<VendorInvoiceDto>().Subject;

        IActionResult overToleranceMatchResult = await _vendorInvoicesController.Match(overToleranceInvoice.Id, new MatchVendorInvoiceRequest(5m));
        InvoiceMatchResultDto overToleranceMatch = ((OkObjectResult)overToleranceMatchResult).Value.Should().BeOfType<InvoiceMatchResultDto>().Subject;
        overToleranceMatch.VariancePercent.Should().Be(5.1m);
        overToleranceMatch.AutoApproved.Should().BeFalse();
    }

    private async Task<PurchaseOrderDto> CreatePurchaseOrderAsync(Guid vendorId, decimal totalAmount)
    {
        decimal quantity = 10m;
        decimal unitPrice = totalAmount / quantity;

        CreatePurchaseOrderRequest request = new(
            ProjectId: Guid.NewGuid(),
            VendorId: vendorId,
            Description: "PO for test",
            Lines: [new CreatePurchaseOrderLineRequest("Line 1", quantity, unitPrice)]);

        IActionResult result = await _purchaseOrdersController.Create(request);
        CreatedAtActionResult created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        return created.Value.Should().BeOfType<PurchaseOrderDto>().Subject;
    }
}
