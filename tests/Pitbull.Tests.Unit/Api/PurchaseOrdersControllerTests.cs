using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Api.Controllers;
using Pitbull.Billing.Features.PurchaseOrders;
using Pitbull.Billing.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Tests.Unit.Api;

public class PurchaseOrdersControllerTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestUserId = Guid.NewGuid();

    private readonly PitbullDbContext _db;
    private readonly PurchaseOrdersController _controller;

    public PurchaseOrdersControllerTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new();

        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);
        IPurchaseOrderService service = new PurchaseOrderService(_db, NullLogger<PurchaseOrderService>.Instance);
        _controller = new PurchaseOrdersController(service)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

        _controller.ControllerContext.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
            new System.Security.Claims.ClaimsIdentity(
            [new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.NameIdentifier, TestUserId.ToString())], "test"));
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    [Fact]
    public async Task PurchaseOrder_Lifecycle_ApproveAndReceive_TransitionsStatuses()
    {
        CreatePurchaseOrderRequest createRequest = new(
            ProjectId: Guid.NewGuid(),
            VendorId: Guid.NewGuid(),
            Description: "Concrete package",
            Lines:
            [
                new CreatePurchaseOrderLineRequest("Concrete", 10m, 25m),
                new CreatePurchaseOrderLineRequest("Rebar", 5m, 30m)
            ]);

        IActionResult createResult = await _controller.Create(createRequest);
        CreatedAtActionResult created = createResult.Should().BeOfType<CreatedAtActionResult>().Subject;
        PurchaseOrderDto createdPo = created.Value.Should().BeOfType<PurchaseOrderDto>().Subject;
        createdPo.Status.Should().Be(PurchaseOrderStatus.Draft);

        IActionResult approveResult = await _controller.Approve(createdPo.Id);
        OkObjectResult approveOk = approveResult.Should().BeOfType<OkObjectResult>().Subject;
        PurchaseOrderDto approvedPo = approveOk.Value.Should().BeOfType<PurchaseOrderDto>().Subject;
        approvedPo.Status.Should().Be(PurchaseOrderStatus.Approved);
        approvedPo.ApprovedById.Should().Be(TestUserId);

        ReceivePurchaseOrderRequest receivePartial = new(
        [
            new ReceivePurchaseOrderLineRequest(approvedPo.Lines[0].Id, 5m)
        ]);

        IActionResult partialResult = await _controller.Receive(approvedPo.Id, receivePartial);
        OkObjectResult partialOk = partialResult.Should().BeOfType<OkObjectResult>().Subject;
        PurchaseOrderDto partialPo = partialOk.Value.Should().BeOfType<PurchaseOrderDto>().Subject;
        partialPo.Status.Should().Be(PurchaseOrderStatus.PartiallyReceived);

        ReceivePurchaseOrderRequest receiveRemaining = new(
        [
            new ReceivePurchaseOrderLineRequest(partialPo.Lines[0].Id, 5m),
            new ReceivePurchaseOrderLineRequest(partialPo.Lines[1].Id, 5m)
        ]);

        IActionResult fullResult = await _controller.Receive(partialPo.Id, receiveRemaining);
        OkObjectResult fullOk = fullResult.Should().BeOfType<OkObjectResult>().Subject;
        PurchaseOrderDto receivedPo = fullOk.Value.Should().BeOfType<PurchaseOrderDto>().Subject;
        receivedPo.Status.Should().Be(PurchaseOrderStatus.Received);
        receivedPo.Lines.All(line => line.ReceivedQuantity >= line.Quantity).Should().BeTrue();
    }
}
