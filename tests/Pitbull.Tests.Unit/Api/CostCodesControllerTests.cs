using FluentAssertions;
using FluentValidation;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Api.Controllers;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.Features.CostCode;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Tests.Unit.Api;

public class CostCodesControllerTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private readonly PitbullDbContext _db;
    private readonly CostCodesController _controller;

    public CostCodesControllerTests()
    {
        var tenantContext = new TenantContext { TenantId = TestTenantId, TenantName = "Test" };
        var companyContext = new CompanyContext();

        var options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);
        var service = new CostCodeService(
            _db,
            new CreateCostCodeValidator(),
            new UpdateCostCodeValidator(),
            NullLogger<CostCodeService>.Instance);
        _controller = new CostCodesController(service);
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    /// <summary>
    /// Add a CostCode directly to the DbContext (bypassing SaveChangesAsync audit logic
    /// which tries to set PostgreSQL session vars). We set TenantId manually.
    /// </summary>
    private async Task<CostCode> SeedCostCode(
        string code = "01-100",
        string description = "Concrete Work",
        string? division = "03 - Concrete",
        CostType costType = CostType.Labor,
        bool isActive = true,
        Guid? id = null)
    {
        var costCode = new CostCode
        {
            Id = id ?? Guid.NewGuid(),
            Code = code,
            Description = description,
            Division = division,
            CostType = costType,
            IsActive = isActive,
            TenantId = TestTenantId,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        _db.Set<CostCode>().Add(costCode);
        await _db.SaveChangesAsync();
        return costCode;
    }

    #region List

    [Fact]
    public async Task List_ReturnsOk_WithPaginatedResult()
    {
        await SeedCostCode("01-100", "Concrete Work");
        await SeedCostCode("02-200", "Framing");

        var result = await _controller.List(null, null, null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task List_DefaultsToActiveOnly()
    {
        await SeedCostCode("01-100", "Active Code", isActive: true);
        await SeedCostCode("01-200", "Inactive Code", isActive: false);

        var result = await _controller.List(null, null, null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var payload = GetAnonymousPayload(ok.Value!);
        payload.totalCount.Should().Be(1);
        payload.items.Should().HaveCount(1);
    }

    [Fact]
    public async Task List_IsActiveFalse_ReturnsInactiveOnly()
    {
        await SeedCostCode("01-100", "Active Code", isActive: true);
        await SeedCostCode("01-200", "Inactive Code", isActive: false);

        var result = await _controller.List(null, isActive: false, null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var payload = GetAnonymousPayload(ok.Value!);
        // isActive=false filters to inactive only
        payload.totalCount.Should().Be(1);
        payload.items.First().Code.Should().Be("01-200");
    }

    [Fact]
    public async Task List_FilterByCostType_ReturnsMatching()
    {
        await SeedCostCode("01-100", "Labor Code", costType: CostType.Labor);
        await SeedCostCode("02-200", "Material Code", costType: CostType.Material);
        await SeedCostCode("03-300", "Equipment Code", costType: CostType.Equipment);

        var result = await _controller.List(CostType.Material, isActive: null, null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var payload = GetAnonymousPayload(ok.Value!);
        payload.totalCount.Should().Be(1);
    }

    [Fact]
    public async Task List_SearchByCode_ReturnsMatching()
    {
        await SeedCostCode("01-100", "Concrete Work");
        await SeedCostCode("02-200", "Framing");
        await SeedCostCode("03-300", "Electrical");

        var result = await _controller.List(null, isActive: null, search: "01-100");

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var payload = GetAnonymousPayload(ok.Value!);
        payload.totalCount.Should().Be(1);
    }

    [Fact]
    public async Task List_SearchByDescription_ReturnsMatching()
    {
        await SeedCostCode("01-100", "Concrete Work");
        await SeedCostCode("02-200", "Steel Framing");
        await SeedCostCode("03-300", "Electrical Wiring");

        var result = await _controller.List(null, isActive: null, search: "framing");

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var payload = GetAnonymousPayload(ok.Value!);
        payload.totalCount.Should().Be(1);
    }

    [Fact]
    public async Task List_SearchIsCaseInsensitive()
    {
        await SeedCostCode("01-100", "Concrete Work");

        var result = await _controller.List(null, isActive: null, search: "CONCRETE");

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var payload = GetAnonymousPayload(ok.Value!);
        payload.totalCount.Should().Be(1);
    }

    [Fact]
    public async Task List_Pagination_ReturnsCorrectPage()
    {
        // Seed 5 items, request page 2 with pageSize 2
        for (int i = 1; i <= 5; i++)
            await SeedCostCode($"{i:D2}-100", $"Code {i}");

        var result = await _controller.List(null, isActive: null, null, page: 2, pageSize: 2);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var payload = GetAnonymousPayload(ok.Value!);
        payload.totalCount.Should().Be(5);
        payload.page.Should().Be(2);
        payload.pageSize.Should().Be(2);
        payload.totalPages.Should().Be(3);
        payload.items.Should().HaveCount(2);
    }

    [Fact]
    public async Task List_DefaultPagination_Page1Size100()
    {
        await SeedCostCode("01-100", "Test Code");

        var result = await _controller.List(null, null, null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var payload = GetAnonymousPayload(ok.Value!);
        payload.page.Should().Be(1);
        payload.pageSize.Should().Be(100);
    }

    [Fact]
    public async Task List_EmptyDatabase_ReturnsEmptyList()
    {
        var result = await _controller.List(null, null, null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var payload = GetAnonymousPayload(ok.Value!);
        payload.totalCount.Should().Be(0);
        payload.items.Should().BeEmpty();
    }

    [Fact]
    public async Task List_OrdersByCode()
    {
        await SeedCostCode("03-300", "Electrical");
        await SeedCostCode("01-100", "Concrete");
        await SeedCostCode("02-200", "Framing");

        var result = await _controller.List(null, isActive: null, null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var payload = GetAnonymousPayload(ok.Value!);
        var codes = payload.items.Select(item => item.Code).ToList();
        codes.Should().BeInAscendingOrder();
    }

    [Fact]
    public async Task List_ReturnsCorrectDtoShape()
    {
        var seeded = await SeedCostCode("01-100", "Concrete Work", "03 - Concrete", CostType.Material);

        var result = await _controller.List(null, null, null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var payload = GetAnonymousPayload(ok.Value!);
        var item = payload.items.First();

        item.Id.Should().Be(seeded.Id);
        item.Code.Should().Be("01-100");
        item.Description.Should().Be("Concrete Work");
        item.Division.Should().Be("03 - Concrete");
        item.CostType.Should().Be(CostType.Material);
        item.IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task List_TotalPages_CalculatedCorrectly()
    {
        // 3 items, pageSize 2 => 2 total pages
        await SeedCostCode("01-100", "Code 1");
        await SeedCostCode("02-200", "Code 2");
        await SeedCostCode("03-300", "Code 3");

        var result = await _controller.List(null, isActive: null, null, page: 1, pageSize: 2);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var payload = GetAnonymousPayload(ok.Value!);
        payload.totalPages.Should().Be(2);
    }

    [Fact]
    public async Task List_SoftDeletedRecords_AreExcluded()
    {
        var costCode = await SeedCostCode("01-100", "Active Code");
        var deletedCode = await SeedCostCode("02-200", "Deleted Code");

        // Soft delete: set IsDeleted directly (bypassing DbContext override)
        deletedCode.IsDeleted = true;
        deletedCode.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var result = await _controller.List(null, isActive: null, null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var payload = GetAnonymousPayload(ok.Value!);
        payload.totalCount.Should().Be(1);
    }

    [Fact]
    public async Task List_CombinesCostTypeAndSearchFilter()
    {
        await SeedCostCode("01-100", "Concrete Labor", costType: CostType.Labor);
        await SeedCostCode("02-200", "Concrete Material", costType: CostType.Material);
        await SeedCostCode("03-300", "Steel Material", costType: CostType.Material);

        var result = await _controller.List(CostType.Material, isActive: null, search: "concrete");

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var payload = GetAnonymousPayload(ok.Value!);
        payload.totalCount.Should().Be(1);
    }

    #endregion

    #region GetById

    [Fact]
    public async Task GetById_Found_ReturnsOkWithDto()
    {
        var seeded = await SeedCostCode("01-100", "Concrete Work");

        var result = await _controller.GetById(seeded.Id);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.StatusCode.Should().Be(200);
        var dto = ok.Value.Should().BeOfType<CostCodeDto>().Subject;
        dto.Id.Should().Be(seeded.Id);
        dto.Code.Should().Be("01-100");
        dto.Description.Should().Be("Concrete Work");
    }

    [Fact]
    public async Task GetById_NotFound_Returns404()
    {
        var result = await _controller.GetById(Guid.NewGuid());

        var notFound = result.Should().BeOfType<NotFoundObjectResult>().Subject;
        notFound.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetById_ReturnsAllDtoFields()
    {
        var seeded = await SeedCostCode(
            code: "03-100",
            description: "Electrical Rough-In",
            division: "16 - Electrical",
            costType: CostType.Equipment,
            isActive: true);

        var result = await _controller.GetById(seeded.Id);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = ok.Value.Should().BeOfType<CostCodeDto>().Subject;
        dto.Id.Should().Be(seeded.Id);
        dto.Code.Should().Be("03-100");
        dto.Description.Should().Be("Electrical Rough-In");
        dto.Division.Should().Be("16 - Electrical");
        dto.CostType.Should().Be(CostType.Equipment);
        dto.IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task GetById_NullDivision_ReturnsNullInDto()
    {
        var seeded = await SeedCostCode("01-100", "No Division Code", division: null);

        var result = await _controller.GetById(seeded.Id);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = ok.Value.Should().BeOfType<CostCodeDto>().Subject;
        dto.Division.Should().BeNull();
    }

    [Fact]
    public async Task GetById_InactiveCode_StillReturnsOk()
    {
        var seeded = await SeedCostCode("01-100", "Inactive Code", isActive: false);

        var result = await _controller.GetById(seeded.Id);

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task GetById_SoftDeletedCode_Returns404()
    {
        var seeded = await SeedCostCode("01-100", "Deleted Code");

        // Soft delete
        seeded.IsDeleted = true;
        seeded.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var result = await _controller.GetById(seeded.Id);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetById_NotFoundResponse_ContainsErrorMessage()
    {
        var result = await _controller.GetById(Guid.NewGuid());

        var notFound = result.Should().BeOfType<NotFoundObjectResult>().Subject;
        notFound.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task GetById_EachCostType_PassesThrough()
    {
        foreach (var costType in Enum.GetValues<CostType>())
        {
            var seeded = await SeedCostCode($"CC-{(int)costType}", $"Type {costType}", costType: costType);

            var result = await _controller.GetById(seeded.Id);

            var ok = result.Should().BeOfType<OkObjectResult>().Subject;
            var dto = ok.Value.Should().BeOfType<CostCodeDto>().Subject;
            dto.CostType.Should().Be(costType);
        }
    }

    #endregion

    // Note: Tenant isolation is enforced via global query filters in PitbullDbContext
    // using Expression.Field references to _tenantContext. The InMemory provider does
    // evaluate these filters, but the expression-tree-based approach doesn't reliably
    // enforce tenant boundaries with InMemory. Tenant isolation is best covered by
    // integration tests using a real database provider.

    #region Helpers

    private record PaginatedPayload(
        List<CostCodeDto> items,
        int totalCount,
        int page,
        int pageSize,
        int totalPages);

    /// <summary>
    /// Extract fields from the paginated response object.
    /// The controller returns ListCostCodesResult (PascalCase properties).
    /// </summary>
    private static PaginatedPayload GetAnonymousPayload(object value)
    {
        var result = (ListCostCodesResult)value;
        return new PaginatedPayload(
            items: result.Items.ToList(),
            totalCount: result.TotalCount,
            page: result.Page,
            pageSize: result.PageSize,
            totalPages: result.TotalPages
        );
    }

    #endregion
}
