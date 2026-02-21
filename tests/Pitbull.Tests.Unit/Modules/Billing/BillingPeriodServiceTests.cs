using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Billing.Features.AiaBilling;
using Pitbull.Billing.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.Billing;

public sealed class BillingPeriodServiceTests
{
    private static BillingPeriodService CreateService(PitbullDbContext db) =>
        new(db, NullLogger<BillingPeriodService>.Instance);

    [Fact]
    public async Task CreateAsync_ValidInput_TrimsNameAndReturnsOpenStatus()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        BillingPeriodService service = CreateService(db);

        var result = await service.CreateAsync(new CreateBillingPeriodCommand(
            Name: "  Jan 2026  ",
            PeriodStart: new DateOnly(2026, 1, 1),
            PeriodEnd: new DateOnly(2026, 1, 31),
            BillingDeadlineDay: 25));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Name.Should().Be("Jan 2026");
        result.Value.Status.Should().Be(BillingPeriodStatus.Open);
    }

    [Fact]
    public async Task CreateAsync_EndBeforeStart_ReturnsValidationError()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        BillingPeriodService service = CreateService(db);

        var result = await service.CreateAsync(new CreateBillingPeriodCommand(
            Name: "Backwards",
            PeriodStart: new DateOnly(2026, 2, 28),
            PeriodEnd: new DateOnly(2026, 2, 1),
            BillingDeadlineDay: 25));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task CreateAsync_EndEqualsStart_ReturnsValidationError()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        BillingPeriodService service = CreateService(db);

        var result = await service.CreateAsync(new CreateBillingPeriodCommand(
            Name: "Same Day",
            PeriodStart: new DateOnly(2026, 3, 1),
            PeriodEnd: new DateOnly(2026, 3, 1),
            BillingDeadlineDay: 25));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(32)]
    public async Task CreateAsync_InvalidDeadlineDay_ReturnsValidationError(int deadlineDay)
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        BillingPeriodService service = CreateService(db);

        var result = await service.CreateAsync(new CreateBillingPeriodCommand(
            Name: "Bad Deadline",
            PeriodStart: new DateOnly(2026, 4, 1),
            PeriodEnd: new DateOnly(2026, 4, 30),
            BillingDeadlineDay: deadlineDay));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(32)]
    public async Task UpdateAsync_InvalidDeadlineDay_ReturnsValidationError(int deadlineDay)
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        BillingPeriodService service = CreateService(db);
        Guid periodId = await SeedPeriodAsync(db, "Good Period");

        var result = await service.UpdateAsync(new UpdateBillingPeriodCommand(
            PeriodId: periodId,
            BillingDeadlineDay: deadlineDay));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task UpdateAsync_NonExistentPeriod_ReturnsNotFound()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        BillingPeriodService service = CreateService(db);

        var result = await service.UpdateAsync(new UpdateBillingPeriodCommand(
            PeriodId: Guid.NewGuid(),
            Name: "Ghost"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task DeleteAsync_NonExistentPeriod_ReturnsNotFound()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        BillingPeriodService service = CreateService(db);

        var result = await service.DeleteAsync(Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task CreateAsync_OverlappingPeriod_ReturnsOverlapError()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        BillingPeriodService service = CreateService(db);
        await service.CreateAsync(new CreateBillingPeriodCommand(
            "January", new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31), 25));

        var result = await service.CreateAsync(new CreateBillingPeriodCommand(
            "Overlap", new DateOnly(2026, 1, 15), new DateOnly(2026, 2, 15), 25));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("OVERLAP");
    }

    [Fact]
    public async Task UpdateAsync_EmptyName_ReturnsValidationError()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        BillingPeriodService service = CreateService(db);
        Guid periodId = await SeedPeriodAsync(db, "Initial");

        var result = await service.UpdateAsync(new UpdateBillingPeriodCommand(
            PeriodId: periodId,
            Name: "   "));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task UpdateAsync_StatusAndNotes_UpdatesPeriod()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        BillingPeriodService service = CreateService(db);
        Guid periodId = await SeedPeriodAsync(db, "To Close");

        var result = await service.UpdateAsync(new UpdateBillingPeriodCommand(
            PeriodId: periodId,
            Status: BillingPeriodStatus.Closed,
            Notes: "Finalized"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(BillingPeriodStatus.Closed);
        result.Value.Notes.Should().Be("Finalized");
    }

    [Fact]
    public async Task DeleteAsync_ExistingPeriod_SetsSoftDeleteFields()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        BillingPeriodService service = CreateService(db);
        Guid periodId = await SeedPeriodAsync(db, "To Delete");

        var deleteResult = await service.DeleteAsync(periodId);

        deleteResult.IsSuccess.Should().BeTrue();
        BillingPeriod persisted = await db.Set<BillingPeriod>()
            .IgnoreQueryFilters()
            .FirstAsync(p => p.Id == periodId);
        persisted.IsDeleted.Should().BeTrue();
        persisted.DeletedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task ListAsync_InvalidPageAndLargePageSize_AreClamped()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        BillingPeriodService service = CreateService(db);
        await SeedPeriodAsync(db, "Jan", new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31));
        await SeedPeriodAsync(db, "Feb", new DateOnly(2026, 2, 1), new DateOnly(2026, 2, 28));

        var result = await service.ListAsync(new ListBillingPeriodsQuery(
            Status: null,
            Page: 0,
            PageSize: 999));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Page.Should().Be(1);
        result.Value.PageSize.Should().Be(100);
        result.Value.Items.Should().HaveCount(2);
        result.Value.Items.First().Name.Should().Be("Feb");
    }

    private static async Task<Guid> SeedPeriodAsync(
        PitbullDbContext db,
        string name,
        DateOnly? start = null,
        DateOnly? end = null)
    {
        BillingPeriod period = new()
        {
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            Name = name,
            PeriodStart = start ?? new DateOnly(2026, 1, 1),
            PeriodEnd = end ?? new DateOnly(2026, 1, 31),
            BillingDeadlineDay = 25,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        db.Set<BillingPeriod>().Add(period);
        await db.SaveChangesAsync();
        return period.Id;
    }
}
