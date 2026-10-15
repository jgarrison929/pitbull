using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;
using Pitbull.Payroll.Features.WorkClassifications;
using Pitbull.Payroll.Services;

namespace Pitbull.Tests.Unit.Payroll;

public class WorkClassificationServiceTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestCompanyId = Guid.NewGuid();
    private readonly PitbullDbContext _db;
    private readonly WorkClassificationService _service;

    public WorkClassificationServiceTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new() { CompanyId = TestCompanyId };
        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new PitbullDbContext(options, tenantContext, companyContext);
        _service = new WorkClassificationService(_db, NullLogger<WorkClassificationService>.Instance);
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    [Fact]
    public async Task Create_ValidCommand_Succeeds()
    {
        var result = await _service.CreateAsync(new CreateWorkClassificationCommand(
            "LABR", "Laborer", "General labor", IsActive: true, Craft: "Laborer", ClassName: "Journeyman", Apprenticeable: true));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Code.Should().Be("LABR");
        result.Value.Name.Should().Be("Laborer");
        result.Value.Craft.Should().Be("Laborer");
        result.Value.Apprenticeable.Should().BeTrue();
    }

    [Fact]
    public async Task Create_DuplicateCode_ReturnsDuplicateCode()
    {
        await _service.CreateAsync(new CreateWorkClassificationCommand("LABR", "Laborer", null));
        var result = await _service.CreateAsync(new CreateWorkClassificationCommand("LABR", "Laborer 2", null));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("DUPLICATE_CODE");
    }

    [Fact]
    public async Task Create_MissingCode_ReturnsValidationError()
    {
        var result = await _service.CreateAsync(new CreateWorkClassificationCommand(" ", "Laborer", null));
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task List_ReturnsCreatedItems()
    {
        await _service.CreateAsync(new CreateWorkClassificationCommand("CARP", "Carpenter", null));
        await _service.CreateAsync(new CreateWorkClassificationCommand("OPER", "Operator", null, IsActive: false));

        var result = await _service.ListAsync(new ListWorkClassificationsQuery());
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(2);

        var active = await _service.ListAsync(new ListWorkClassificationsQuery(IsActive: true));
        active.Value!.TotalCount.Should().Be(1);
        active.Value.Items[0].Code.Should().Be("CARP");
    }

    [Fact]
    public async Task Get_Update_Delete_Lifecycle()
    {
        var created = await _service.CreateAsync(new CreateWorkClassificationCommand("ELEC", "Electrician", null));
        Guid id = created.Value!.Id;

        var got = await _service.GetAsync(id);
        got.IsSuccess.Should().BeTrue();
        got.Value!.Name.Should().Be("Electrician");

        var updated = await _service.UpdateAsync(new UpdateWorkClassificationCommand(id, Name: "Inside Wireman", Craft: "Electrical"));
        updated.IsSuccess.Should().BeTrue();
        updated.Value!.Name.Should().Be("Inside Wireman");
        updated.Value.Craft.Should().Be("Electrical");

        var deleted = await _service.DeleteAsync(id);
        deleted.IsSuccess.Should().BeTrue();

        var missing = await _service.GetAsync(id);
        missing.IsSuccess.Should().BeFalse();
        missing.ErrorCode.Should().Be("NOT_FOUND");
    }
}
