using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Api.Controllers;
using Pitbull.Billing.Features.AiaBilling;
using Pitbull.Billing.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Tests.Unit.Api;

public class BillingPeriodsControllerTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();

    private readonly PitbullDbContext _db;
    private readonly BillingPeriodsController _controller;

    public BillingPeriodsControllerTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new();

        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);
        IBillingPeriodService service = new BillingPeriodService(_db, NullLogger<BillingPeriodService>.Instance);
        _controller = new BillingPeriodsController(service)
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
    public async Task CreatePeriod_ValidInput_ReturnsCreated()
    {
        CreateBillingPeriodRequest request = new("January 2026",
            new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31), 25);

        IActionResult result = await _controller.Create(request);
        CreatedAtActionResult created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        BillingPeriodDto dto = created.Value.Should().BeOfType<BillingPeriodDto>().Subject;

        dto.Name.Should().Be("January 2026");
        dto.PeriodStart.Should().Be(new DateOnly(2026, 1, 1));
        dto.PeriodEnd.Should().Be(new DateOnly(2026, 1, 31));
        dto.BillingDeadlineDay.Should().Be(25);
        dto.Status.Should().Be(BillingPeriodStatus.Open);
    }

    [Fact]
    public async Task CreatePeriod_EmptyName_ReturnsBadRequest()
    {
        CreateBillingPeriodRequest request = new("",
            new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31));

        IActionResult result = await _controller.Create(request);
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task CreatePeriod_EndBeforeStart_ReturnsBadRequest()
    {
        CreateBillingPeriodRequest request = new("Bad Period",
            new DateOnly(2026, 2, 1), new DateOnly(2026, 1, 31));

        IActionResult result = await _controller.Create(request);
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task CreatePeriod_InvalidDeadlineDay_ReturnsBadRequest()
    {
        CreateBillingPeriodRequest request = new("Bad Day",
            new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31), 32);

        IActionResult result = await _controller.Create(request);
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task CreatePeriod_OverlappingDates_ReturnsBadRequest()
    {
        await _controller.Create(new("January 2026",
            new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31)));

        CreateBillingPeriodRequest overlapping = new("Overlapping",
            new DateOnly(2026, 1, 15), new DateOnly(2026, 2, 15));

        IActionResult result = await _controller.Create(overlapping);
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task GetPeriod_Existing_ReturnsOk()
    {
        var created = await CreateTestPeriod("March 2026", new DateOnly(2026, 3, 1), new DateOnly(2026, 3, 31));

        IActionResult result = await _controller.Get(created.Id);
        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        BillingPeriodDto dto = ok.Value.Should().BeOfType<BillingPeriodDto>().Subject;
        dto.Name.Should().Be("March 2026");
    }

    [Fact]
    public async Task GetPeriod_NotFound_Returns404()
    {
        IActionResult result = await _controller.Get(Guid.NewGuid());
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task ListPeriods_ReturnsPagedResults()
    {
        await CreateTestPeriod("P1", new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31));
        await CreateTestPeriod("P2", new DateOnly(2026, 2, 1), new DateOnly(2026, 2, 28));
        await CreateTestPeriod("P3", new DateOnly(2026, 3, 1), new DateOnly(2026, 3, 31));

        IActionResult result = await _controller.List(null, 1, 25);
        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ListBillingPeriodsResult list = ok.Value.Should().BeOfType<ListBillingPeriodsResult>().Subject;
        list.Items.Should().HaveCount(3);
        list.TotalCount.Should().Be(3);
    }

    [Fact]
    public async Task UpdatePeriod_ChangeName_ReturnsUpdated()
    {
        var period = await CreateTestPeriod("Old Name", new DateOnly(2026, 4, 1), new DateOnly(2026, 4, 30));

        UpdateBillingPeriodRequest request = new(Name: "New Name");
        IActionResult result = await _controller.Update(period.Id, request);
        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        BillingPeriodDto dto = ok.Value.Should().BeOfType<BillingPeriodDto>().Subject;
        dto.Name.Should().Be("New Name");
    }

    [Fact]
    public async Task UpdatePeriod_CloseStatus_ReturnsUpdated()
    {
        var period = await CreateTestPeriod("To Close", new DateOnly(2026, 5, 1), new DateOnly(2026, 5, 31));

        UpdateBillingPeriodRequest request = new(Status: BillingPeriodStatus.Closed);
        IActionResult result = await _controller.Update(period.Id, request);
        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        BillingPeriodDto dto = ok.Value.Should().BeOfType<BillingPeriodDto>().Subject;
        dto.Status.Should().Be(BillingPeriodStatus.Closed);
    }

    [Fact]
    public async Task UpdatePeriod_NotFound_Returns404()
    {
        IActionResult result = await _controller.Update(Guid.NewGuid(), new(Name: "Nope"));
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task DeletePeriod_Existing_ReturnsNoContent()
    {
        var period = await CreateTestPeriod("To Delete", new DateOnly(2026, 6, 1), new DateOnly(2026, 6, 30));

        IActionResult result = await _controller.Delete(period.Id);
        result.Should().BeOfType<NoContentResult>();
    }

    [Fact]
    public async Task DeletePeriod_NotFound_Returns404()
    {
        IActionResult result = await _controller.Delete(Guid.NewGuid());
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    private async Task<BillingPeriodDto> CreateTestPeriod(string name, DateOnly start, DateOnly end)
    {
        var result = await _controller.Create(new(name, start, end));
        return (BillingPeriodDto)((CreatedAtActionResult)result).Value!;
    }
}
