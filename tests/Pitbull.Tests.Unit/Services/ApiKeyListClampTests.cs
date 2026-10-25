using FluentAssertions;
using Pitbull.SystemAdmin.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Services;

public sealed class ApiKeyListClampTests
{
    [Fact]
    public async Task List_ClampsPageSizeTo100()
    {
        using var db = TestDbContextFactory.Create();
        var service = new ApiKeyService(db);

        var result = await service.ListKeysAsync(page: 1, pageSize: 500);

        result.IsSuccess.Should().BeTrue();
        result.Value!.PageSize.Should().Be(100);
        result.Value.Page.Should().Be(1);
    }

    [Fact]
    public async Task List_ClampsInvalidPageToOne()
    {
        using var db = TestDbContextFactory.Create();
        var service = new ApiKeyService(db);

        var result = await service.ListKeysAsync(page: 0, pageSize: 25);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Page.Should().Be(1);
    }
}
