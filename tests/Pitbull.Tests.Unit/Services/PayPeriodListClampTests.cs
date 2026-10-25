using FluentAssertions;
using Moq;
using Pitbull.Core.MultiTenancy;
using Pitbull.TimeTracking.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Services;

public sealed class PayPeriodListClampTests
{
    [Fact]
    public async Task List_ClampsPageSizeTo100()
    {
        using var db = TestDbContextFactory.Create();
        var service = new PayPeriodService(
            db,
            Mock.Of<ITenantContext>(t => t.TenantId == TestDbContextFactory.TestTenantId),
            Mock.Of<ICompanyContext>(c => c.IsResolved == true && c.CompanyId == TestDbContextFactory.TestCompanyId));

        var result = await service.ListPayPeriodsAsync(status: null, page: 1, pageSize: 500);

        result.IsSuccess.Should().BeTrue();
        result.Value!.PageSize.Should().Be(100);
        result.Value.Page.Should().Be(1);
    }

    [Fact]
    public async Task List_ClampsInvalidPageToOne()
    {
        using var db = TestDbContextFactory.Create();
        var service = new PayPeriodService(
            db,
            Mock.Of<ITenantContext>(t => t.TenantId == TestDbContextFactory.TestTenantId),
            Mock.Of<ICompanyContext>(c => c.IsResolved == true && c.CompanyId == TestDbContextFactory.TestCompanyId));

        var result = await service.ListPayPeriodsAsync(status: null, page: 0, pageSize: 25);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Page.Should().Be(1);
        result.Value.PageSize.Should().Be(25);
    }
}
