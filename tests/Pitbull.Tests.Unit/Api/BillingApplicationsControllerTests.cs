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

public class BillingApplicationsControllerTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestProjectId = Guid.NewGuid();

    private readonly PitbullDbContext _db;
    private readonly OwnerContractsController _contractController;
    private readonly BillingApplicationsController _billingController;

    public BillingApplicationsControllerTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new();

        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);

        IOwnerContractService contractService = new OwnerContractService(_db, NullLogger<OwnerContractService>.Instance);
        IBillingApplicationService billingService = new BillingApplicationService(_db, NullLogger<BillingApplicationService>.Instance);

        _contractController = new OwnerContractsController(contractService)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        _billingController = new BillingApplicationsController(billingService)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    // ── Creation ──

    [Fact]
    public async Task CreateBillingApplication_ActiveSOV_ReturnsCreated()
    {
        var (contractId, sovId) = await SetupActiveContract();

        CreateBillingApplicationRequest request = new(contractId, sovId,
            new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31), new DateOnly(2026, 1, 31));

        IActionResult result = await _billingController.Create(request);
        CreatedAtActionResult created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        BillingApplicationDto dto = created.Value.Should().BeOfType<BillingApplicationDto>().Subject;

        dto.ApplicationNumber.Should().Be(1);
        dto.Status.Should().Be(BillingApplicationStatus.Draft);
        dto.OriginalContractSum.Should().Be(500_000m);
        dto.ContractSumToDate.Should().Be(500_000m);
        dto.LineItems.Should().HaveCount(2);
    }

    [Fact]
    public async Task CreateBillingApplication_SequentialNumbering_IncrementsCorrectly()
    {
        var (contractId, sovId) = await SetupActiveContract();

        await _billingController.Create(new(contractId, sovId,
            new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31), new DateOnly(2026, 1, 31)));

        var result2 = await _billingController.Create(new(contractId, sovId,
            new DateOnly(2026, 2, 1), new DateOnly(2026, 2, 28), new DateOnly(2026, 2, 28)));

        var created = (CreatedAtActionResult)result2;
        var dto = (BillingApplicationDto)created.Value!;
        dto.ApplicationNumber.Should().Be(2);
    }

    [Fact]
    public async Task CreateBillingApplication_CarriesForward_PreviousTotals()
    {
        var (contractId, sovId) = await SetupActiveContract();

        // App #1: do some work
        var app1Result = await _billingController.Create(new(contractId, sovId,
            new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31), new DateOnly(2026, 1, 31)));
        var app1 = (BillingApplicationDto)((CreatedAtActionResult)app1Result).Value!;

        // Update line items on app #1
        var line1 = app1.LineItems![0];
        await _billingController.UpdateLine(app1.Id, line1.Id, new(50_000m, 10_000m));

        // App #2: should carry forward
        var app2Result = await _billingController.Create(new(contractId, sovId,
            new DateOnly(2026, 2, 1), new DateOnly(2026, 2, 28), new DateOnly(2026, 2, 28)));
        var app2 = (BillingApplicationDto)((CreatedAtActionResult)app2Result).Value!;

        var carryForwardLine = app2.LineItems!.First(l => l.ItemNumber == "1");
        carryForwardLine.WorkCompletedPrevious.Should().Be(50_000m);
        carryForwardLine.MaterialsStoredToDate.Should().Be(10_000m);
    }

    [Fact]
    public async Task CreateBillingApplication_InactiveSOV_ReturnsBadRequest()
    {
        var contract = await CreateContract("OC-INACT");
        var sovResult = await _contractController.CreateSOV(contract.Id, new(TestProjectId));
        var sov = (OwnerSOVDto)((CreatedAtActionResult)sovResult).Value!;

        // SOV is Draft, not Active
        IActionResult result = await _billingController.Create(new(contract.Id, sov.Id,
            new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31), new DateOnly(2026, 1, 31)));
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    // ── Line Updates ──

    [Fact]
    public async Task UpdateLine_ValidInput_CalculatesG703Correctly()
    {
        var (contractId, sovId) = await SetupActiveContract();
        var app = await CreateBillingApp(contractId, sovId);
        var line = app.LineItems![0]; // ScheduledValue = 300_000

        var result = await _billingController.UpdateLine(app.Id, line.Id, new(100_000m, 20_000m));
        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        BillingApplicationLineItemDto dto = ok.Value.Should().BeOfType<BillingApplicationLineItemDto>().Subject;

        dto.WorkCompletedThisPeriod.Should().Be(100_000m);
        dto.MaterialsStoredToDate.Should().Be(20_000m);
        dto.TotalCompletedAndStored.Should().Be(120_000m); // 0 + 100k + 20k
        dto.PercentComplete.Should().Be(40m); // 120k / 300k = 40%
        dto.BalanceToFinish.Should().Be(180_000m); // 300k - 120k
    }

    [Fact]
    public async Task UpdateLine_ExceedsScheduledValue_ReturnsBadRequest()
    {
        var (contractId, sovId) = await SetupActiveContract();
        var app = await CreateBillingApp(contractId, sovId);
        var line = app.LineItems![0]; // ScheduledValue = 300_000

        var result = await _billingController.UpdateLine(app.Id, line.Id, new(250_000m, 100_000m));
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task UpdateLine_NegativeWork_ReturnsBadRequest()
    {
        var (contractId, sovId) = await SetupActiveContract();
        var app = await CreateBillingApp(contractId, sovId);
        var line = app.LineItems![0];

        var result = await _billingController.UpdateLine(app.Id, line.Id, new(-100m, 0m));
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task UpdateLine_NonDraftApp_ReturnsBadRequest()
    {
        var (contractId, sovId) = await SetupActiveContract();
        var app = await CreateBillingApp(contractId, sovId);

        // Submit for review → no longer Draft
        await _billingController.SubmitForReview(app.Id);

        var line = app.LineItems![0];
        var result = await _billingController.UpdateLine(app.Id, line.Id, new(10_000m, 0m));
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    // ── Bulk Update ──

    [Fact]
    public async Task BulkUpdateLines_CalculatesG702Correctly()
    {
        var (contractId, sovId) = await SetupActiveContract();
        var app = await CreateBillingApp(contractId, sovId);

        BulkUpdateBillingLinesRequest request = new([
            new BulkLineUpdateRequest(app.LineItems![0].Id, 100_000m, 0m),
            new BulkLineUpdateRequest(app.LineItems![1].Id, 50_000m, 10_000m)
        ]);

        var result = await _billingController.BulkUpdateLines(app.Id, request);
        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        BillingApplicationDto dto = ok.Value.Should().BeOfType<BillingApplicationDto>().Subject;

        // Total completed = 100k + 50k + 10k = 160k
        dto.TotalCompletedAndStoredToDate.Should().Be(160_000m);
        // Retainage: 10% of completed work (150k) + 10% of stored materials (10k)
        dto.RetainageOnCompletedWork.Should().Be(15_000m);
        dto.RetainageOnStoredMaterials.Should().Be(1_000m);
        dto.TotalRetainage.Should().Be(16_000m);
        // Line 6: 160k - 16k = 144k
        dto.TotalEarnedLessRetainage.Should().Be(144_000m);
        // Line 8: 144k - 0 (no prior) = 144k
        dto.CurrentPaymentDue.Should().Be(144_000m);
    }

    [Fact]
    public async Task BulkUpdateLines_ExceedsScheduled_ReturnsBadRequest()
    {
        var (contractId, sovId) = await SetupActiveContract();
        var app = await CreateBillingApp(contractId, sovId);

        BulkUpdateBillingLinesRequest request = new([
            new BulkLineUpdateRequest(app.LineItems![0].Id, 400_000m, 0m) // 400k > 300k scheduled
        ]);

        var result = await _billingController.BulkUpdateLines(app.Id, request);
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    // ── Retainage ──

    [Fact]
    public async Task Retainage_PerLineOverride_CalculatesCorrectly()
    {
        var contract = await CreateContract("OC-RETOVER");
        await _contractController.CreateSOV(contract.Id, new(TestProjectId));
        var sovResult = await _contractController.GetSOV(contract.Id);
        var sov = (OwnerSOVDto)((OkObjectResult)sovResult).Value!;

        // Add line with 5% retainage override (contract default is 10%)
        await _contractController.AddLineItem(sov.Id, new("1", "Custom Retainage", 500_000m, RetainagePercent: 5m));
        await _contractController.ActivateSOV(sov.Id);

        var appResult = await _billingController.Create(new(contract.Id, sov.Id,
            new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31), new DateOnly(2026, 1, 31)));
        var app = (BillingApplicationDto)((CreatedAtActionResult)appResult).Value!;

        // Update line with work
        var line = app.LineItems![0];
        await _billingController.UpdateLine(app.Id, line.Id, new(100_000m, 0m));

        var getResult = await _billingController.Get(app.Id);
        var updatedApp = (BillingApplicationDto)((OkObjectResult)getResult).Value!;
        var updatedLine = updatedApp.LineItems![0];

        // Should use 5% override, not 10% default
        updatedLine.RetainageAmount.Should().Be(5_000m); // 100k * 5%
    }

    // ── Recalculate ──

    [Fact]
    public async Task Recalculate_DraftApp_RecalculatesAllLines()
    {
        var (contractId, sovId) = await SetupActiveContract();
        var app = await CreateBillingApp(contractId, sovId);

        // Update line
        await _billingController.UpdateLine(app.Id, app.LineItems![0].Id, new(100_000m, 0m));

        // Recalculate
        var result = await _billingController.Recalculate(app.Id);
        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        BillingApplicationDto dto = ok.Value.Should().BeOfType<BillingApplicationDto>().Subject;
        dto.TotalCompletedAndStoredToDate.Should().Be(100_000m);
    }

    [Fact]
    public async Task Recalculate_NonDraftApp_ReturnsBadRequest()
    {
        var (contractId, sovId) = await SetupActiveContract();
        var app = await CreateBillingApp(contractId, sovId);
        await _billingController.SubmitForReview(app.Id);

        var result = await _billingController.Recalculate(app.Id);
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    // ── Workflow ──

    [Fact]
    public async Task Workflow_DraftToSubmitted_TransitionsCorrectly()
    {
        var (contractId, sovId) = await SetupActiveContract();
        var app = await CreateBillingApp(contractId, sovId);

        // Draft → PmReview
        var submitResult = await _billingController.SubmitForReview(app.Id);
        var submitted = (BillingApplicationDto)((OkObjectResult)submitResult).Value!;
        submitted.Status.Should().Be(BillingApplicationStatus.PmReview);

        // PmReview → ReadyToSubmit
        var approveResult = await _billingController.Approve(app.Id);
        var approved = (BillingApplicationDto)((OkObjectResult)approveResult).Value!;
        approved.Status.Should().Be(BillingApplicationStatus.ReadyToSubmit);

        // ReadyToSubmit → SubmittedToOwner
        var ownerResult = await _billingController.SubmitToOwner(app.Id);
        var ownerSubmitted = (BillingApplicationDto)((OkObjectResult)ownerResult).Value!;
        ownerSubmitted.Status.Should().Be(BillingApplicationStatus.SubmittedToOwner);
    }

    [Fact]
    public async Task Workflow_RejectWithComments_RecordsNotes()
    {
        var (contractId, sovId) = await SetupActiveContract();
        var app = await CreateBillingApp(contractId, sovId);

        await _billingController.SubmitForReview(app.Id);
        await _billingController.Reject(app.Id, new("Missing lien waivers"));

        var getResult = await _billingController.Get(app.Id);
        var dto = (BillingApplicationDto)((OkObjectResult)getResult).Value!;
        dto.Status.Should().Be(BillingApplicationStatus.PmRejected);
        dto.InternalNotes.Should().Contain("Missing lien waivers");
    }

    [Fact]
    public async Task Workflow_InvalidTransition_ReturnsBadRequest()
    {
        var (contractId, sovId) = await SetupActiveContract();
        var app = await CreateBillingApp(contractId, sovId);

        // Draft → cannot approve (must submit first)
        var result = await _billingController.Approve(app.Id);
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Void_DraftApp_Succeeds()
    {
        var (contractId, sovId) = await SetupActiveContract();
        var app = await CreateBillingApp(contractId, sovId);

        var result = await _billingController.Void(app.Id);
        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = ok.Value.Should().BeOfType<BillingApplicationDto>().Subject;
        dto.Status.Should().Be(BillingApplicationStatus.Void);
    }

    [Fact]
    public async Task Void_PaidApp_ReturnsBadRequest()
    {
        var (contractId, sovId) = await SetupActiveContract();
        var app = await CreateBillingApp(contractId, sovId);

        // Manually set status to Paid to test void rejection
        var entity = await _db.Set<BillingApplication>().FirstAsync(a => a.Id == app.Id);
        entity.Status = BillingApplicationStatus.Paid;
        await _db.SaveChangesAsync();

        var result = await _billingController.Void(app.Id);
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    // ── List / Get ──

    [Fact]
    public async Task List_FilterByContract_ReturnsFiltered()
    {
        var (contractId, sovId) = await SetupActiveContract();
        await CreateBillingApp(contractId, sovId);

        var result = await _billingController.List(null, contractId, null, 1, 25);
        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ListBillingApplicationsResult list = ok.Value.Should().BeOfType<ListBillingApplicationsResult>().Subject;
        list.Items.Should().HaveCount(1);
    }

    [Fact]
    public async Task Get_IncludesLineItems()
    {
        var (contractId, sovId) = await SetupActiveContract();
        var app = await CreateBillingApp(contractId, sovId);

        var result = await _billingController.Get(app.Id);
        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        BillingApplicationDto dto = ok.Value.Should().BeOfType<BillingApplicationDto>().Subject;
        dto.LineItems.Should().NotBeNull();
        dto.LineItems.Should().HaveCount(2);
    }

    [Fact]
    public async Task Get_NotFound_Returns404()
    {
        var result = await _billingController.Get(Guid.NewGuid());
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    // ── G702 Calculation ──

    [Fact]
    public async Task G702_PreviousCertificates_DeductedFromCurrentPayment()
    {
        var (contractId, sovId) = await SetupActiveContract();

        // App #1: bill 100k
        var app1Result = await _billingController.Create(new(contractId, sovId,
            new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31), new DateOnly(2026, 1, 31)));
        var app1 = (BillingApplicationDto)((CreatedAtActionResult)app1Result).Value!;

        await _billingController.BulkUpdateLines(app1.Id, new([
            new BulkLineUpdateRequest(app1.LineItems![0].Id, 50_000m, 0m),
            new BulkLineUpdateRequest(app1.LineItems![1].Id, 50_000m, 0m)
        ]));

        // App #2: bill another 50k
        var app2Result = await _billingController.Create(new(contractId, sovId,
            new DateOnly(2026, 2, 1), new DateOnly(2026, 2, 28), new DateOnly(2026, 2, 28)));
        var app2 = (BillingApplicationDto)((CreatedAtActionResult)app2Result).Value!;

        // App #2 should have previous certificates from app #1
        app2.LessPreviousCertificates.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task G702_BalanceToFinish_CalculatedCorrectly()
    {
        var (contractId, sovId) = await SetupActiveContract();
        var app = await CreateBillingApp(contractId, sovId);

        await _billingController.BulkUpdateLines(app.Id, new([
            new BulkLineUpdateRequest(app.LineItems![0].Id, 100_000m, 0m),
            new BulkLineUpdateRequest(app.LineItems![1].Id, 0m, 0m)
        ]));

        var getResult = await _billingController.Get(app.Id);
        var dto = (BillingApplicationDto)((OkObjectResult)getResult).Value!;

        // Balance = ContractSumToDate - TotalEarnedLessRetainage
        dto.BalanceToFinishIncludingRetainage.Should().Be(dto.ContractSumToDate - dto.TotalEarnedLessRetainage);
    }

    // ── Helpers ──

    private async Task<OwnerContractDto> CreateContract(string number)
    {
        var result = await _contractController.CreateContract(
            new(TestProjectId, number, "Test Project", 500_000m));
        return (OwnerContractDto)((CreatedAtActionResult)result).Value!;
    }

    private async Task<(Guid ContractId, Guid SovId)> SetupActiveContract()
    {
        var contract = await CreateContract($"OC-{Guid.NewGuid():N}".Substring(0, 12));
        await _contractController.CreateSOV(contract.Id, new(TestProjectId));
        var sovResult = await _contractController.GetSOV(contract.Id);
        var sov = (OwnerSOVDto)((OkObjectResult)sovResult).Value!;

        await _contractController.AddLineItem(sov.Id, new("1", "Concrete", 300_000m));
        await _contractController.AddLineItem(sov.Id, new("2", "Steel", 200_000m));
        await _contractController.ActivateSOV(sov.Id);

        return (contract.Id, sov.Id);
    }

    private async Task<BillingApplicationDto> CreateBillingApp(Guid contractId, Guid sovId)
    {
        var result = await _billingController.Create(new(contractId, sovId,
            new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31), new DateOnly(2026, 1, 31)));
        return (BillingApplicationDto)((CreatedAtActionResult)result).Value!;
    }
}
