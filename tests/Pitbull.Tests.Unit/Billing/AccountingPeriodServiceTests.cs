using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Billing.Features.AccountingPeriods;
using Pitbull.Billing.Services;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Tests.Unit.Billing;

public class AccountingPeriodServiceTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestCompanyId = Guid.NewGuid();
    private readonly PitbullDbContext _db;
    private readonly AccountingPeriodService _service;

    public AccountingPeriodServiceTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new() { CompanyId = TestCompanyId };

        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);
        _service = new AccountingPeriodService(_db, NullLogger<AccountingPeriodService>.Instance);
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    // ── Create ──

    [Fact]
    public async Task Create_ValidPeriod_ReturnsSuccess()
    {
        CreateAccountingPeriodCommand cmd = new(
            PeriodNumber: 1,
            FiscalYear: 2026,
            PeriodName: "January 2026",
            StartDate: new DateOnly(2026, 1, 1),
            EndDate: new DateOnly(2026, 1, 31));

        var result = await _service.CreatePeriodAsync(cmd);

        result.IsSuccess.Should().BeTrue();
        result.Value!.PeriodNumber.Should().Be(1);
        result.Value!.Status.Should().Be(PeriodStatus.Open);
    }

    [Fact]
    public async Task Create_DuplicatePeriod_ReturnsDuplicateError()
    {
        CreateAccountingPeriodCommand cmd = new(1, 2026, "January 2026", new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31));
        await _service.CreatePeriodAsync(cmd);

        var result = await _service.CreatePeriodAsync(cmd);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("DUPLICATE_PERIOD");
    }

    [Fact]
    public async Task Create_EndBeforeStart_ReturnsValidationError()
    {
        CreateAccountingPeriodCommand cmd = new(1, 2026, "Bad dates", new DateOnly(2026, 1, 31), new DateOnly(2026, 1, 1));

        var result = await _service.CreatePeriodAsync(cmd);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task Create_EmptyName_ReturnsValidationError()
    {
        CreateAccountingPeriodCommand cmd = new(1, 2026, "", new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31));

        var result = await _service.CreatePeriodAsync(cmd);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    // ── Get ──

    [Fact]
    public async Task Get_Exists_ReturnsPeriod()
    {
        var created = (await _service.CreatePeriodAsync(
            new(1, 2026, "January 2026", new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31)))).Value!;

        var result = await _service.GetPeriodAsync(created.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.PeriodName.Should().Be("January 2026");
    }

    [Fact]
    public async Task Get_NotFound_ReturnsNotFound()
    {
        var result = await _service.GetPeriodAsync(Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    // ── List ──

    [Fact]
    public async Task List_FilterByYear_ReturnsCorrectResults()
    {
        await _service.SeedFiscalYearAsync(2025);
        await _service.SeedFiscalYearAsync(2026);

        var result = await _service.GetPeriodsAsync(new ListAccountingPeriodsQuery(FiscalYear: 2026));

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(12);
    }

    // ── Delete ──

    [Fact]
    public async Task Delete_OpenPeriod_Succeeds()
    {
        var created = (await _service.CreatePeriodAsync(
            new(1, 2026, "January 2026", new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31)))).Value!;

        var result = await _service.DeletePeriodAsync(created.Id);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task Delete_ClosedPeriod_ReturnsInvalidStatus()
    {
        var created = (await _service.CreatePeriodAsync(
            new(1, 2026, "January 2026", new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31)))).Value!;
        await _service.ClosePeriodAsync(created.Id, Guid.NewGuid());

        var result = await _service.DeletePeriodAsync(created.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    // ── Close ──

    [Fact]
    public async Task Close_OpenPeriod_SetsHardClosed()
    {
        var created = (await _service.CreatePeriodAsync(
            new(1, 2026, "January 2026", new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31)))).Value!;

        var result = await _service.ClosePeriodAsync(created.Id, Guid.NewGuid());

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PeriodStatus.HardClosed);
        result.Value!.ClosedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task Close_AlreadyClosed_ReturnsInvalidStatus()
    {
        var created = (await _service.CreatePeriodAsync(
            new(1, 2026, "January 2026", new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31)))).Value!;
        await _service.ClosePeriodAsync(created.Id, Guid.NewGuid());

        var result = await _service.ClosePeriodAsync(created.Id, Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    // ── Reopen ──

    [Fact]
    public async Task Reopen_ClosedPeriod_SetsOpen()
    {
        var created = (await _service.CreatePeriodAsync(
            new(1, 2026, "January 2026", new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31)))).Value!;
        await _service.ClosePeriodAsync(created.Id, Guid.NewGuid());

        var result = await _service.ReopenPeriodAsync(created.Id, "Year-end adjustment needed");

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PeriodStatus.Open);
        result.Value!.ReopenedCount.Should().Be(1);
        result.Value!.LastReopenReason.Should().Be("Year-end adjustment needed");
    }

    [Fact]
    public async Task Reopen_OpenPeriod_ReturnsInvalidStatus()
    {
        var created = (await _service.CreatePeriodAsync(
            new(1, 2026, "January 2026", new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31)))).Value!;

        var result = await _service.ReopenPeriodAsync(created.Id, "No reason");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task Reopen_EmptyReason_ReturnsValidationError()
    {
        var created = (await _service.CreatePeriodAsync(
            new(1, 2026, "January 2026", new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31)))).Value!;
        await _service.ClosePeriodAsync(created.Id, Guid.NewGuid());

        var result = await _service.ReopenPeriodAsync(created.Id, "");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    // ── Seed Fiscal Year ──

    [Fact]
    public async Task SeedFiscalYear_Creates12Periods()
    {
        var result = await _service.SeedFiscalYearAsync(2026);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Should().HaveCount(12);
        result.Value!.First().PeriodName.Should().Be("January 2026");
        result.Value!.Last().PeriodName.Should().Be("December 2026");
    }

    [Fact]
    public async Task SeedFiscalYear_Duplicate_ReturnsDuplicateError()
    {
        await _service.SeedFiscalYearAsync(2026);

        var result = await _service.SeedFiscalYearAsync(2026);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("DUPLICATE_PERIOD");
    }

    // ── HIGH #10: Overlapping date ranges ──

    [Fact]
    public async Task CreatePeriod_OverlappingDates_ReturnsOverlappingPeriod()
    {
        // Create period 1: Jan 1-31
        var cmd1 = new CreateAccountingPeriodCommand(
            FiscalYear: 2026, PeriodNumber: 1, PeriodName: "January 2026",
            StartDate: new DateOnly(2026, 1, 1), EndDate: new DateOnly(2026, 1, 31));
        var r1 = await _service.CreatePeriodAsync(cmd1);
        r1.IsSuccess.Should().BeTrue();

        // Create period 2 with overlapping dates: Jan 15 - Feb 15
        var cmd2 = new CreateAccountingPeriodCommand(
            FiscalYear: 2026, PeriodNumber: 2, PeriodName: "February 2026",
            StartDate: new DateOnly(2026, 1, 15), EndDate: new DateOnly(2026, 2, 15));
        var r2 = await _service.CreatePeriodAsync(cmd2);

        r2.IsSuccess.Should().BeFalse();
        r2.ErrorCode.Should().Be("OVERLAPPING_PERIOD");
    }
}
