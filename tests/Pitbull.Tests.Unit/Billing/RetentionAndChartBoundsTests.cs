using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Billing.Features.Retention;
using Pitbull.Billing.Services;
using Pitbull.Core.Domain;
using Pitbull.Core.Features.ChartOfAccounts;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Billing;

public sealed class RetentionAndChartBoundsTests
{
    [Fact]
    public async Task CreateRetentionPolicy_RejectsOversizedName()
    {
        using var db = TestDbContextFactory.Create();
        var service = new RetentionService(db, NullLogger<RetentionService>.Instance);

        var result = await service.CreatePolicyAsync(new CreateRetentionPolicyCommand(
            Name: new string('N', 201),
            PercentageRate: 10m));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("200");
    }

    [Fact]
    public async Task CreateRetentionHold_RejectsAmountOverMax()
    {
        using var db = TestDbContextFactory.Create();
        var service = new RetentionService(db, NullLogger<RetentionService>.Instance);

        var result = await service.CreateHoldAsync(new CreateRetentionHoldCommand(
            ProjectId: Guid.NewGuid(),
            ContractId: null,
            OriginalAmount: 1_000_000_000.01m,
            RetainagePercent: 10m));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("1,000,000,000");
    }

    [Fact]
    public async Task CreateChartOfAccount_RejectsOversizedNumber()
    {
        using var db = TestDbContextFactory.Create();
        var service = new ChartOfAccountService(db, NullLogger<ChartOfAccountService>.Instance);

        var result = await service.CreateChartOfAccountAsync(new CreateChartOfAccountCommand(
            AccountNumber: new string('1', 51),
            AccountName: "Cash",
            AccountType: AccountType.Asset));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("50");
    }

    [Fact]
    public async Task ListChartOfAccounts_ClampsPageSize()
    {
        using var db = TestDbContextFactory.Create();
        var service = new ChartOfAccountService(db, NullLogger<ChartOfAccountService>.Instance);

        var result = await service.ListChartOfAccountsAsync(new ListChartOfAccountsQuery(
            Page: 1,
            PageSize: 500));

        result.IsSuccess.Should().BeTrue();
        result.Value!.PageSize.Should().Be(100);
    }
}
