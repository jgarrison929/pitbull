using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Billing.Features.Wip;
using Pitbull.Billing.Services;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Projects.Domain;

namespace Pitbull.Tests.Unit.Billing;

public class WipReportDuplicateTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestCompanyId = Guid.NewGuid();
    private readonly PitbullDbContext _db;
    private readonly WipReportService _service;

    public WipReportDuplicateTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new() { CompanyId = TestCompanyId };

        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);

        var wipCalcService = new WipCalculationService(_db);
        _service = new WipReportService(_db, wipCalcService, NullLogger<WipReportService>.Instance);
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    [Fact]
    public async Task CreateWipReport_FirstForPeriod_Succeeds()
    {
        CreateWipReportCommand command = new(
            ReportDate: new DateOnly(2026, 1, 31),
            FiscalYear: 2026,
            PeriodNumber: 1);

        var result = await _service.CreateWipReportAsync(command, "test-user");

        result.IsSuccess.Should().BeTrue();
        result.Value!.FiscalYear.Should().Be(2026);
        result.Value!.PeriodNumber.Should().Be(1);
    }

    [Fact]
    public async Task CreateWipReport_DuplicatePeriod_ReturnsDuplicateError()
    {
        CreateWipReportCommand command = new(
            ReportDate: new DateOnly(2026, 1, 31),
            FiscalYear: 2026,
            PeriodNumber: 1);

        // First creation succeeds
        var first = await _service.CreateWipReportAsync(command, "test-user");
        first.IsSuccess.Should().BeTrue();

        // Second creation for same period fails
        var second = await _service.CreateWipReportAsync(command, "test-user");
        second.IsSuccess.Should().BeFalse();
        second.ErrorCode.Should().Be("DUPLICATE_PERIOD");
    }

    [Fact]
    public async Task CreateWipReport_DifferentPeriods_BothSucceed()
    {
        var r1 = await _service.CreateWipReportAsync(new CreateWipReportCommand(
            ReportDate: new DateOnly(2026, 1, 31),
            FiscalYear: 2026,
            PeriodNumber: 1), "test-user");

        var r2 = await _service.CreateWipReportAsync(new CreateWipReportCommand(
            ReportDate: new DateOnly(2026, 2, 28),
            FiscalYear: 2026,
            PeriodNumber: 2), "test-user");

        r1.IsSuccess.Should().BeTrue();
        r2.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task CreateWipReport_SamePeriodDifferentYear_BothSucceed()
    {
        var r1 = await _service.CreateWipReportAsync(new CreateWipReportCommand(
            ReportDate: new DateOnly(2025, 1, 31),
            FiscalYear: 2025,
            PeriodNumber: 1), "test-user");

        var r2 = await _service.CreateWipReportAsync(new CreateWipReportCommand(
            ReportDate: new DateOnly(2026, 1, 31),
            FiscalYear: 2026,
            PeriodNumber: 1), "test-user");

        r1.IsSuccess.Should().BeTrue();
        r2.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task GenerateWipReport_DuplicatePeriod_ReturnsDuplicateError()
    {
        // Create first report manually
        var first = await _service.CreateWipReportAsync(new CreateWipReportCommand(
            ReportDate: new DateOnly(2026, 1, 31),
            FiscalYear: 2026,
            PeriodNumber: 1), "test-user");
        first.IsSuccess.Should().BeTrue();

        // Generate a report for the same period should fail
        var second = await _service.GenerateWipReportAsync(new GenerateWipReportCommand(
            ReportDate: new DateOnly(2026, 1, 31),
            FiscalYear: 2026,
            PeriodNumber: 1), "test-user");

        second.IsSuccess.Should().BeFalse();
        second.ErrorCode.Should().Be("DUPLICATE_PERIOD");
    }

    [Fact]
    public async Task CreateWipReport_AfterDeletion_CanCreateNewReport()
    {
        // Create and then delete
        var first = await _service.CreateWipReportAsync(new CreateWipReportCommand(
            ReportDate: new DateOnly(2026, 1, 31),
            FiscalYear: 2026,
            PeriodNumber: 1), "test-user");
        first.IsSuccess.Should().BeTrue();

        await _service.DeleteWipReportAsync(first.Value!.Id);

        // Should be able to create again for the same period
        var second = await _service.CreateWipReportAsync(new CreateWipReportCommand(
            ReportDate: new DateOnly(2026, 1, 31),
            FiscalYear: 2026,
            PeriodNumber: 1), "test-user");

        second.IsSuccess.Should().BeTrue();
    }
}
