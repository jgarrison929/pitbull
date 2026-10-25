using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Billing.Features.AccountingPeriods;
using Pitbull.Billing.Features.AiaBilling;
using Pitbull.Billing.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Billing;

public sealed class AccountingAndPaymentBoundsTests
{
    [Fact]
    public async Task CreateAccountingPeriod_RejectsOversizedName()
    {
        using var db = TestDbContextFactory.Create();
        var service = new AccountingPeriodService(db, NullLogger<AccountingPeriodService>.Instance);

        var result = await service.CreatePeriodAsync(new CreateAccountingPeriodCommand(
            PeriodNumber: 1,
            FiscalYear: 2026,
            PeriodName: new string('P', 101),
            StartDate: new DateOnly(2026, 1, 1),
            EndDate: new DateOnly(2026, 1, 31)));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("100");
    }

    [Fact]
    public async Task CreateAccountingPeriod_RejectsInvalidPeriodNumber()
    {
        using var db = TestDbContextFactory.Create();
        var service = new AccountingPeriodService(db, NullLogger<AccountingPeriodService>.Instance);

        var result = await service.CreatePeriodAsync(new CreateAccountingPeriodCommand(
            PeriodNumber: 0,
            FiscalYear: 2026,
            PeriodName: "Jan 2026",
            StartDate: new DateOnly(2026, 1, 1),
            EndDate: new DateOnly(2026, 1, 31)));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("1 and 13");
    }

    [Fact]
    public async Task CreateBillingPeriod_RejectsOversizedName()
    {
        using var db = TestDbContextFactory.Create();
        var service = new BillingPeriodService(db, NullLogger<BillingPeriodService>.Instance);

        var result = await service.CreateAsync(new CreateBillingPeriodCommand(
            Name: new string('B', 201),
            PeriodStart: new DateOnly(2026, 1, 1),
            PeriodEnd: new DateOnly(2026, 1, 31),
            BillingDeadlineDay: 25));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("200");
    }
}

