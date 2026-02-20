using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Api.Controllers;
using Pitbull.Api.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.Features.ChartOfAccounts;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Tests.Unit.Api;

public class ChartOfAccountsControllerTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private readonly PitbullDbContext _db;
    private readonly ChartOfAccountsController _controller;

    public ChartOfAccountsControllerTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new();

        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);
        IChartOfAccountService service = new ChartOfAccountService(_db, NullLogger<ChartOfAccountService>.Instance);
        ICacheService cacheService = new CacheService(new MemoryCache(new MemoryCacheOptions()), tenantContext, companyContext);
        _controller = new ChartOfAccountsController(service, cacheService)
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

    private async Task<ChartOfAccount> SeedAccount(
        string accountNumber = "1000",
        string accountName = "Cash",
        AccountType accountType = AccountType.Asset,
        NormalBalance normalBalance = NormalBalance.Debit,
        Guid? parentAccountId = null)
    {
        ChartOfAccount account = new()
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            CompanyId = Guid.NewGuid(),
            AccountNumber = accountNumber,
            AccountName = accountName,
            AccountType = accountType,
            ParentAccountId = parentAccountId,
            NormalBalance = normalBalance,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        _db.Set<ChartOfAccount>().Add(account);
        await _db.SaveChangesAsync();
        return account;
    }

    [Fact]
    public async Task List_ReturnsOk()
    {
        await SeedAccount();

        IActionResult result = await _controller.List(null, null);

        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ListChartOfAccountsResult payload = ok.Value.Should().BeOfType<ListChartOfAccountsResult>().Subject;
        payload.TotalCount.Should().Be(1);
        payload.Items.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetById_NotFound_Returns404()
    {
        IActionResult result = await _controller.GetById(Guid.NewGuid());

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Create_ValidRequest_Returns201()
    {
        CreateChartOfAccountRequest request = new(
            AccountNumber: "1100",
            AccountName: "Accounts Receivable",
            AccountType: AccountType.Asset,
            NormalBalance: NormalBalance.Debit);

        IActionResult result = await _controller.Create(request);

        CreatedAtActionResult created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        ChartOfAccountDto dto = created.Value.Should().BeOfType<ChartOfAccountDto>().Subject;
        dto.AccountNumber.Should().Be("1100");
        dto.AccountName.Should().Be("Accounts Receivable");
    }

    [Fact]
    public async Task Update_Found_ReturnsUpdatedAccount()
    {
        ChartOfAccount seeded = await SeedAccount();
        UpdateChartOfAccountRequest request = new(
            AccountName: "Operating Cash",
            Description: "Primary operating account",
            IsSubledgerControl: true);

        IActionResult result = await _controller.Update(seeded.Id, request);

        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ChartOfAccountDto dto = ok.Value.Should().BeOfType<ChartOfAccountDto>().Subject;
        dto.AccountName.Should().Be("Operating Cash");
        dto.Description.Should().Be("Primary operating account");
        dto.IsSubledgerControl.Should().BeTrue();
    }

    [Fact]
    public async Task Delete_SoftDeletesAccount()
    {
        ChartOfAccount seeded = await SeedAccount();

        IActionResult deleteResult = await _controller.Delete(seeded.Id);
        deleteResult.Should().BeOfType<NoContentResult>();

        IActionResult getResult = await _controller.GetById(seeded.Id);
        getResult.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetTree_ReturnsHierarchy()
    {
        ChartOfAccount parent = await SeedAccount(accountNumber: "4000", accountName: "Revenue", accountType: AccountType.Revenue, normalBalance: NormalBalance.Credit);
        await SeedAccount(accountNumber: "4100", accountName: "Service Revenue", accountType: AccountType.Revenue, normalBalance: NormalBalance.Credit, parentAccountId: parent.Id);

        IActionResult result = await _controller.GetTree();

        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        IReadOnlyList<ChartOfAccountTreeNodeDto> nodes = ok.Value.Should().BeAssignableTo<IReadOnlyList<ChartOfAccountTreeNodeDto>>().Subject;

        nodes.Should().HaveCount(1);
        nodes[0].AccountNumber.Should().Be("4000");
        nodes[0].Children.Should().HaveCount(1);
        nodes[0].Children[0].AccountNumber.Should().Be("4100");
    }
}
