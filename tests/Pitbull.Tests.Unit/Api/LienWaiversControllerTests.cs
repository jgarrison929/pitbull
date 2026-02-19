using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Api.Controllers;
using Pitbull.Billing.Features.LienWaivers;
using Pitbull.Billing.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Tests.Unit.Api;

public class LienWaiversControllerTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestUserId = Guid.NewGuid();
    private readonly PitbullDbContext _db;
    private readonly LienWaiversController _controller;

    public LienWaiversControllerTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new();

        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);
        ILienWaiverService service = new LienWaiverService(_db, NullLogger<LienWaiverService>.Instance);

        var claims = new[] { new Claim(ClaimTypes.NameIdentifier, TestUserId.ToString()) };
        var identity = new ClaimsIdentity(claims, "Test");

        _controller = new LienWaiversController(service)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
            }
        };
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    private async Task<LienWaiver> SeedWaiver(
        LienWaiverStatus status = LienWaiverStatus.Requested,
        LienWaiverType waiverType = LienWaiverType.Conditional,
        decimal amount = 50_000m)
    {
        LienWaiver waiver = new()
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            CompanyId = Guid.NewGuid(),
            ProjectId = Guid.NewGuid(),
            VendorId = Guid.NewGuid(),
            WaiverType = waiverType,
            Amount = amount,
            ThroughDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Status = status,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        _db.Set<LienWaiver>().Add(waiver);
        await _db.SaveChangesAsync();
        return waiver;
    }

    // ── CRUD Tests ──

    [Fact]
    public async Task List_ReturnsOk()
    {
        await SeedWaiver();

        IActionResult result = await _controller.List(null, null, null, null);

        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ListLienWaiversResult payload = ok.Value.Should().BeOfType<ListLienWaiversResult>().Subject;
        payload.TotalCount.Should().Be(1);
        payload.Items.Should().HaveCount(1);
    }

    [Fact]
    public async Task List_FilterByStatus_ReturnsFiltered()
    {
        await SeedWaiver(status: LienWaiverStatus.Requested);
        await SeedWaiver(status: LienWaiverStatus.Approved);

        IActionResult result = await _controller.List(null, null, null, LienWaiverStatus.Requested);

        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ListLienWaiversResult payload = ok.Value.Should().BeOfType<ListLienWaiversResult>().Subject;
        payload.TotalCount.Should().Be(1);
        payload.Items.First().Status.Should().Be(LienWaiverStatus.Requested);
    }

    [Fact]
    public async Task GetById_NotFound_Returns404()
    {
        IActionResult result = await _controller.GetById(Guid.NewGuid());

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetById_Found_ReturnsWaiver()
    {
        LienWaiver seeded = await SeedWaiver();

        IActionResult result = await _controller.GetById(seeded.Id);

        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        LienWaiverDto dto = ok.Value.Should().BeOfType<LienWaiverDto>().Subject;
        dto.Id.Should().Be(seeded.Id);
        dto.Amount.Should().Be(50_000m);
    }

    [Fact]
    public async Task Create_ValidRequest_Returns201()
    {
        CreateLienWaiverRequest request = new(
            ProjectId: Guid.NewGuid(),
            VendorId: Guid.NewGuid(),
            WaiverType: LienWaiverType.Conditional,
            Amount: 75_000m,
            ThroughDate: DateOnly.FromDateTime(DateTime.UtcNow),
            Description: "Pay app #3");

        IActionResult result = await _controller.Create(request);

        CreatedAtActionResult created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        LienWaiverDto dto = created.Value.Should().BeOfType<LienWaiverDto>().Subject;
        dto.Amount.Should().Be(75_000m);
        dto.WaiverType.Should().Be(LienWaiverType.Conditional);
        dto.Status.Should().Be(LienWaiverStatus.Requested);
    }

    [Fact]
    public async Task Create_ZeroAmount_ReturnsBadRequest()
    {
        CreateLienWaiverRequest request = new(
            ProjectId: Guid.NewGuid(),
            VendorId: null,
            WaiverType: LienWaiverType.Progress,
            Amount: 0m,
            ThroughDate: DateOnly.FromDateTime(DateTime.UtcNow));

        IActionResult result = await _controller.Create(request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Update_Found_ReturnsUpdated()
    {
        LienWaiver seeded = await SeedWaiver();
        UpdateLienWaiverRequest request = new(Amount: 60_000m, Description: "Revised amount");

        IActionResult result = await _controller.Update(seeded.Id, request);

        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        LienWaiverDto dto = ok.Value.Should().BeOfType<LienWaiverDto>().Subject;
        dto.Amount.Should().Be(60_000m);
        dto.Description.Should().Be("Revised amount");
    }

    [Fact]
    public async Task Update_ApprovedWaiver_ReturnsBadRequest()
    {
        LienWaiver seeded = await SeedWaiver(status: LienWaiverStatus.Approved);
        UpdateLienWaiverRequest request = new(Amount: 99_000m);

        IActionResult result = await _controller.Update(seeded.Id, request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Delete_SoftDeletes()
    {
        LienWaiver seeded = await SeedWaiver();

        IActionResult deleteResult = await _controller.Delete(seeded.Id);
        deleteResult.Should().BeOfType<NoContentResult>();

        IActionResult getResult = await _controller.GetById(seeded.Id);
        getResult.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Delete_ApprovedWaiver_ReturnsBadRequest()
    {
        LienWaiver seeded = await SeedWaiver(status: LienWaiverStatus.Approved);

        IActionResult result = await _controller.Delete(seeded.Id);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    // ── Status Transition Tests ──

    [Fact]
    public async Task MarkReceived_FromRequested_UpdatesStatus()
    {
        LienWaiver seeded = await SeedWaiver(status: LienWaiverStatus.Requested);

        IActionResult result = await _controller.MarkReceived(seeded.Id, new MarkReceivedRequest("/docs/signed.pdf"));

        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        LienWaiverDto dto = ok.Value.Should().BeOfType<LienWaiverDto>().Subject;
        dto.Status.Should().Be(LienWaiverStatus.Received);
        dto.DocumentPath.Should().Be("/docs/signed.pdf");
    }

    [Fact]
    public async Task MarkReceived_NotRequested_ReturnsBadRequest()
    {
        LienWaiver seeded = await SeedWaiver(status: LienWaiverStatus.Approved);

        IActionResult result = await _controller.MarkReceived(seeded.Id);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Approve_FromReceived_UpdatesStatus()
    {
        LienWaiver seeded = await SeedWaiver(status: LienWaiverStatus.Received);

        IActionResult result = await _controller.Approve(seeded.Id);

        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        LienWaiverDto dto = ok.Value.Should().BeOfType<LienWaiverDto>().Subject;
        dto.Status.Should().Be(LienWaiverStatus.Approved);
        dto.ReviewedByUserId.Should().Be(TestUserId);
    }

    [Fact]
    public async Task Approve_NotReceived_ReturnsBadRequest()
    {
        LienWaiver seeded = await SeedWaiver(status: LienWaiverStatus.Requested);

        IActionResult result = await _controller.Approve(seeded.Id);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Reject_FromReceived_WithReason_UpdatesStatus()
    {
        LienWaiver seeded = await SeedWaiver(status: LienWaiverStatus.Received);

        IActionResult result = await _controller.Reject(seeded.Id, new RejectLienWaiverRequest("Wrong amount on waiver"));

        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        LienWaiverDto dto = ok.Value.Should().BeOfType<LienWaiverDto>().Subject;
        dto.Status.Should().Be(LienWaiverStatus.Rejected);
        dto.RejectionReason.Should().Be("Wrong amount on waiver");
        dto.ReviewedByUserId.Should().Be(TestUserId);
    }

    [Fact]
    public async Task Reject_WithoutReason_ReturnsBadRequest()
    {
        LienWaiver seeded = await SeedWaiver(status: LienWaiverStatus.Received);

        IActionResult result = await _controller.Reject(seeded.Id, new RejectLienWaiverRequest("   "));

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Reject_NotReceived_ReturnsBadRequest()
    {
        LienWaiver seeded = await SeedWaiver(status: LienWaiverStatus.Requested);

        IActionResult result = await _controller.Reject(seeded.Id, new RejectLienWaiverRequest("Some reason"));

        result.Should().BeOfType<BadRequestObjectResult>();
    }
}
