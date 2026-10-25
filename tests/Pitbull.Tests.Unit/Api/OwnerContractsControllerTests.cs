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

public class OwnerContractsControllerTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestProjectId = Guid.NewGuid();

    private readonly PitbullDbContext _db;
    private readonly OwnerContractsController _controller;

    public OwnerContractsControllerTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new();

        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);
        IOwnerContractService service = new OwnerContractService(_db, NullLogger<OwnerContractService>.Instance);
        _controller = new OwnerContractsController(service)
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

    // ── Contract CRUD ──

    [Fact]
    public async Task CreateContract_ValidInput_ReturnsCreated()
    {
        CreateOwnerContractRequest request = new(
            ProjectId: TestProjectId,
            ContractNumber: "OC-001",
            ProjectName: "Test Tower",
            OriginalContractSum: 1_000_000m);

        IActionResult result = await _controller.CreateContract(request);
        CreatedAtActionResult created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        OwnerContractDto dto = created.Value.Should().BeOfType<OwnerContractDto>().Subject;

        dto.ContractNumber.Should().Be("OC-001");
        dto.ProjectName.Should().Be("Test Tower");
        dto.OriginalContractSum.Should().Be(1_000_000m);
        dto.ContractSumToDate.Should().Be(1_000_000m);
        dto.DefaultRetainagePercent.Should().Be(10m);
        dto.Status.Should().Be(OwnerContractStatus.Active);
    }

    [Fact]
    public async Task CreateContract_DuplicateNumber_ReturnsBadRequest()
    {
        CreateOwnerContractRequest request = new(TestProjectId, "OC-DUP", "Project A", 500_000m);
        await _controller.CreateContract(request);

        CreateOwnerContractRequest duplicate = new(TestProjectId, "OC-DUP", "Project B", 600_000m);
        IActionResult result = await _controller.CreateContract(duplicate);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task CreateContract_EmptyContractNumber_ReturnsBadRequest()
    {
        CreateOwnerContractRequest request = new(TestProjectId, "", "Test", 100_000m);
        IActionResult result = await _controller.CreateContract(request);
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task CreateContract_NegativeAmount_ReturnsBadRequest()
    {
        CreateOwnerContractRequest request = new(TestProjectId, "OC-NEG", "Test", -100m);
        IActionResult result = await _controller.CreateContract(request);
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task CreateContract_InvalidRetainage_ReturnsBadRequest()
    {
        CreateOwnerContractRequest request = new(TestProjectId, "OC-RET", "Test", 100_000m, DefaultRetainagePercent: 150m);
        IActionResult result = await _controller.CreateContract(request);
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task GetContract_Existing_ReturnsOk()
    {
        var created = await CreateTestContract("OC-GET");

        IActionResult result = await _controller.GetContract(created.Id);
        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        OwnerContractDto dto = ok.Value.Should().BeOfType<OwnerContractDto>().Subject;
        dto.ContractNumber.Should().Be("OC-GET");
    }

    [Fact]
    public async Task GetContract_NotFound_Returns404()
    {
        IActionResult result = await _controller.GetContract(Guid.NewGuid());
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task ListContracts_ReturnsPagedResults()
    {
        await CreateTestContract("OC-L1");
        await CreateTestContract("OC-L2");
        await CreateTestContract("OC-L3");

        IActionResult result = await _controller.ListContracts(null, null, 1, 2);
        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ListOwnerContractsResult list = ok.Value.Should().BeOfType<ListOwnerContractsResult>().Subject;
        list.Items.Should().HaveCount(2);
        list.TotalCount.Should().Be(3);
        list.TotalPages.Should().Be(2);
    }

    [Fact]
    public async Task UpdateContract_ChangeName_ReturnsUpdated()
    {
        var created = await CreateTestContract("OC-UPD");

        UpdateOwnerContractRequest request = new(ProjectName: "Updated Tower");
        IActionResult result = await _controller.UpdateContract(created.Id, request);
        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        OwnerContractDto dto = ok.Value.Should().BeOfType<OwnerContractDto>().Subject;
        dto.ProjectName.Should().Be("Updated Tower");
    }

    [Fact]
    public async Task UpdateContract_ChangeAmount_RecalculatesContractSumToDate()
    {
        var created = await CreateTestContract("OC-AMT");

        UpdateOwnerContractRequest request = new(OriginalContractSum: 2_000_000m);
        IActionResult result = await _controller.UpdateContract(created.Id, request);
        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        OwnerContractDto dto = ok.Value.Should().BeOfType<OwnerContractDto>().Subject;
        dto.OriginalContractSum.Should().Be(2_000_000m);
        dto.ContractSumToDate.Should().Be(2_000_000m);
    }

    [Fact]
    public async Task UpdateContract_NotFound_Returns404()
    {
        UpdateOwnerContractRequest request = new(ProjectName: "Not Found");
        IActionResult result = await _controller.UpdateContract(Guid.NewGuid(), request);
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task DeleteContract_NoApps_ReturnsNoContent()
    {
        var created = await CreateTestContract("OC-DEL");

        IActionResult result = await _controller.DeleteContract(created.Id);
        result.Should().BeOfType<NoContentResult>();
    }

    [Fact]
    public async Task DeleteContract_NotFound_Returns404()
    {
        IActionResult result = await _controller.DeleteContract(Guid.NewGuid());
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    // ── SOV ──

    [Fact]
    public async Task CreateSOV_ValidContract_ReturnsCreated()
    {
        var contract = await CreateTestContract("OC-SOV");

        CreateSOVRequest request = new(ProjectId: TestProjectId, Name: "Main SOV");
        IActionResult result = await _controller.CreateSOV(contract.Id, request);
        CreatedAtActionResult created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        OwnerSOVDto dto = created.Value.Should().BeOfType<OwnerSOVDto>().Subject;
        dto.Name.Should().Be("Main SOV");
        dto.OriginalContractAmount.Should().Be(1_000_000m);
        dto.Status.Should().Be(OwnerSOVStatus.Draft);
    }

    [Fact]
    public async Task CreateSOV_DuplicateForContract_ReturnsBadRequest()
    {
        var contract = await CreateTestContract("OC-SOVDUP");
        await _controller.CreateSOV(contract.Id, new(TestProjectId));
        IActionResult result = await _controller.CreateSOV(contract.Id, new(TestProjectId));
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task GetSOV_Existing_ReturnsOkWithLineItems()
    {
        var contract = await CreateTestContract("OC-GETSOV");
        await _controller.CreateSOV(contract.Id, new(TestProjectId));

        IActionResult result = await _controller.GetSOV(contract.Id);
        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        OwnerSOVDto dto = ok.Value.Should().BeOfType<OwnerSOVDto>().Subject;
        dto.LineItems.Should().NotBeNull();
    }

    // ── SOV Line Items ──

    [Fact]
    public async Task AddLineItem_ValidDraftSOV_ReturnsCreated()
    {
        (_, Guid sovId) = await CreateContractWithSOV("OC-LINE1");

        AddSOVLineItemRequest request = new("1", "General Conditions", 50_000m);
        IActionResult result = await _controller.AddLineItem(sovId, request);
        result.Should().BeAssignableTo<ObjectResult>().Which.StatusCode.Should().Be(201);
    }

    [Fact]
    public async Task AddLineItem_NegativeValue_ReturnsBadRequest()
    {
        (_, Guid sovId) = await CreateContractWithSOV("OC-LINE-NEG");

        AddSOVLineItemRequest request = new("1", "Bad Line", -100m);
        IActionResult result = await _controller.AddLineItem(sovId, request);
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task ActivateSOV_BalancedLines_ReturnsOk()
    {
        (_, Guid sovId) = await CreateContractWithSOV("OC-ACT");

        await _controller.AddLineItem(sovId, new("1", "General Conditions", 200_000m));
        await _controller.AddLineItem(sovId, new("2", "Concrete", 400_000m));
        await _controller.AddLineItem(sovId, new("3", "Steel", 400_000m));

        IActionResult result = await _controller.ActivateSOV(sovId);
        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        OwnerSOVDto dto = ok.Value.Should().BeOfType<OwnerSOVDto>().Subject;
        dto.Status.Should().Be(OwnerSOVStatus.Active);
        dto.TotalScheduledValue.Should().Be(1_000_000m);
    }

    [Fact]
    public async Task ActivateSOV_UnbalancedLines_ReturnsBadRequest()
    {
        (_, Guid sovId) = await CreateContractWithSOV("OC-UNBAL");

        await _controller.AddLineItem(sovId, new("1", "General Conditions", 50_000m));

        IActionResult result = await _controller.ActivateSOV(sovId);
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task ActivateSOV_NoLines_ReturnsBadRequest()
    {
        (_, Guid sovId) = await CreateContractWithSOV("OC-NOLINE");

        IActionResult result = await _controller.ActivateSOV(sovId);
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task UpdateLineItem_ChangesValue_ReturnsOk()
    {
        (_, Guid sovId) = await CreateContractWithSOV("OC-UPDLINE");

        var addResult = await _controller.AddLineItem(sovId, new("1", "General Conditions", 50_000m));
        var lineDto = ((ObjectResult)addResult).Value as OwnerSOVLineItemDto;

        UpdateSOVLineItemRequest request = new(Description: "Updated Description", ScheduledValue: 60_000m);
        IActionResult result = await _controller.UpdateLineItem(lineDto!.Id, request);
        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        OwnerSOVLineItemDto updated = ok.Value.Should().BeOfType<OwnerSOVLineItemDto>().Subject;
        updated.Description.Should().Be("Updated Description");
        updated.ScheduledValue.Should().Be(60_000m);
    }

    [Fact]
    public async Task DeleteLineItem_DraftSOV_ReturnsNoContent()
    {
        (_, Guid sovId) = await CreateContractWithSOV("OC-DELLINE");

        var addResult = await _controller.AddLineItem(sovId, new("1", "To Delete", 50_000m));
        var lineDto = ((ObjectResult)addResult).Value as OwnerSOVLineItemDto;

        IActionResult result = await _controller.DeleteLineItem(lineDto!.Id);
        result.Should().BeOfType<NoContentResult>();
    }

    // ── Helpers ──

    private async Task<OwnerContractDto> CreateTestContract(string contractNumber)
    {
        CreateOwnerContractRequest request = new(TestProjectId, contractNumber, "Test Project", 1_000_000m);
        var result = await _controller.CreateContract(request);
        return (OwnerContractDto)((CreatedAtActionResult)result).Value!;
    }

    private async Task<(Guid ContractId, Guid SovId)> CreateContractWithSOV(string contractNumber)
    {
        var contract = await CreateTestContract(contractNumber);
        var sovResult = await _controller.CreateSOV(contract.Id, new(TestProjectId));
        var sov = (OwnerSOVDto)((CreatedAtActionResult)sovResult).Value!;
        return (contract.Id, sov.Id);
    }
}
