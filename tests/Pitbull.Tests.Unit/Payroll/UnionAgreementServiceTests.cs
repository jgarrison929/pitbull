using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;
using Pitbull.Payroll.Domain;
using Pitbull.Payroll.Features.UnionAgreements;
using Pitbull.Payroll.Services;

namespace Pitbull.Tests.Unit.Payroll;

public class UnionAgreementServiceTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestCompanyId = Guid.NewGuid();
    private readonly PitbullDbContext _db;
    private readonly UnionAgreementService _service;

    public UnionAgreementServiceTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new() { CompanyId = TestCompanyId };
        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new PitbullDbContext(options, tenantContext, companyContext);
        _service = new UnionAgreementService(_db, NullLogger<UnionAgreementService>.Instance);
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    [Fact]
    public async Task Create_ValidCommand_Succeeds()
    {
        var result = await _service.CreateAsync(new CreateUnionAgreementCommand(
            UnionName: "IBEW",
            LocalNumber: "11",
            Name: "Inside Agreement 2026",
            EffectiveDate: new DateOnly(2026, 1, 1),
            Jurisdiction: "Los Angeles",
            State: "CA"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.UnionName.Should().Be("IBEW");
        result.Value.LocalNumber.Should().Be("11");
        result.Value.Status.Should().Be(UnionAgreementStatus.Active);
        result.Value.StatusName.Should().Be("Active");
    }

    [Fact]
    public async Task Create_MissingUnionName_ReturnsValidationError()
    {
        var result = await _service.CreateAsync(new CreateUnionAgreementCommand(
            " ", "11", "Agreement", new DateOnly(2026, 1, 1)));
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task List_FiltersByStatusAndSearch()
    {
        await _service.CreateAsync(new CreateUnionAgreementCommand("IBEW", "11", "Inside", new DateOnly(2026, 1, 1)));
        await _service.CreateAsync(new CreateUnionAgreementCommand(
            "LIUNA", "210", "Laborers", new DateOnly(2025, 1, 1), Status: UnionAgreementStatus.Expired));

        var all = await _service.ListAsync(new ListUnionAgreementsQuery());
        all.Value!.TotalCount.Should().Be(2);

        var active = await _service.ListAsync(new ListUnionAgreementsQuery(Status: UnionAgreementStatus.Active));
        active.Value!.TotalCount.Should().Be(1);
        active.Value.Items[0].UnionName.Should().Be("IBEW");

        var search = await _service.ListAsync(new ListUnionAgreementsQuery(Search: "210"));
        search.Value!.TotalCount.Should().Be(1);
        search.Value.Items[0].UnionName.Should().Be("LIUNA");
    }

    [Fact]
    public async Task Get_Update_Delete_Lifecycle()
    {
        var created = await _service.CreateAsync(new CreateUnionAgreementCommand(
            "UA", "78", "Plumbers", new DateOnly(2026, 1, 1)));
        Guid id = created.Value!.Id;

        var got = await _service.GetAsync(id);
        got.IsSuccess.Should().BeTrue();
        got.Value!.Name.Should().Be("Plumbers");

        var updated = await _service.UpdateAsync(new UpdateUnionAgreementCommand(id, Name: "Plumbers & Pipefitters", State: "CA"));
        updated.IsSuccess.Should().BeTrue();
        updated.Value!.Name.Should().Be("Plumbers & Pipefitters");
        updated.Value.State.Should().Be("CA");

        var deleted = await _service.DeleteAsync(id);
        deleted.IsSuccess.Should().BeTrue();

        var missing = await _service.GetAsync(id);
        missing.IsSuccess.Should().BeFalse();
        missing.ErrorCode.Should().Be("NOT_FOUND");
    }
}
