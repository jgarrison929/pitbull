using System.Security.Cryptography;
using System.Text;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.SystemAdmin.Domain;
using Pitbull.SystemAdmin.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.SystemAdmin;

[Collection("SystemAdmin")]
public sealed class ApiKeyServiceTests
{
    [Fact]
    public async Task CreateKey_GeneratesExpectedKeyFormat_AndPrefix()
    {
        using var db = TestDbContextFactory.Create();
        var service = new ApiKeyService(db);

        var result = await service.CreateKeyAsync(new CreateApiKeyCommand(
            Name: "Integration Key",
            Description: "Used by ERP sync",
            Scopes: "read,write",
            ExpiresInDays: 30));

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.PlainTextKey.Should().StartWith("pb_");
        result.Value.PlainTextKey.Length.Should().Be(43);
        result.Value.KeyPrefix.Should().Be(result.Value.PlainTextKey[..8]);
    }

    [Fact]
    public async Task CreateKey_StoresHash_NeverStoresPlainText()
    {
        using var db = TestDbContextFactory.Create();
        var service = new ApiKeyService(db);

        var result = await service.CreateKeyAsync(new CreateApiKeyCommand(
            Name: "Hash Test Key",
            Description: null,
            Scopes: "read",
            ExpiresInDays: null));

        result.IsSuccess.Should().BeTrue();
        var created = result.Value!;

        var entity = await db.Set<ApiKey>().SingleAsync(k => k.Id == created.Id);
        entity.KeyHash.Should().NotBeNullOrWhiteSpace();
        entity.KeyHash.Should().HaveLength(64);
        entity.KeyHash.Should().MatchRegex("^[0-9a-f]{64}$");
        entity.KeyHash.Should().NotBe(created.PlainTextKey);
        entity.KeyHash.Should().NotContain(created.PlainTextKey);

        var expectedHash = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(created.PlainTextKey)));
        entity.KeyHash.Should().Be(expectedHash);
    }

    [Fact]
    public async Task RevokeKey_FirstCallSucceeds_SecondCallReturnsAlreadyRevoked()
    {
        using var db = TestDbContextFactory.Create();
        var service = new ApiKeyService(db);
        var created = await service.CreateKeyAsync(new CreateApiKeyCommand("Revoke Key", null, null, null));
        created.IsSuccess.Should().BeTrue();

        var first = await service.RevokeKeyAsync(created.Value!.Id, "admin@pitbull.local");
        var second = await service.RevokeKeyAsync(created.Value.Id, "admin@pitbull.local");

        first.IsSuccess.Should().BeTrue();
        second.IsSuccess.Should().BeFalse();
        second.ErrorCode.Should().Be("ALREADY_REVOKED");

        var entity = await db.Set<ApiKey>()
            .IgnoreQueryFilters()
            .SingleAsync(k => k.Id == created.Value.Id);
        entity.Status.Should().Be(ApiKeyStatus.Revoked);
        entity.RevokedBy.Should().Be("admin@pitbull.local");
        entity.RevokedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task DeleteKey_FirstCallSucceeds_SecondCallReturnsNotFound()
    {
        using var db = TestDbContextFactory.Create();
        var service = new ApiKeyService(db);
        var created = await service.CreateKeyAsync(new CreateApiKeyCommand("Delete Key", null, null, null));
        created.IsSuccess.Should().BeTrue();

        var first = await service.DeleteKeyAsync(created.Value!.Id);
        var second = await service.DeleteKeyAsync(created.Value.Id);

        first.IsSuccess.Should().BeTrue();
        second.IsSuccess.Should().BeFalse();
        second.ErrorCode.Should().Be("NOT_FOUND");

        var entity = await db.Set<ApiKey>()
            .IgnoreQueryFilters()
            .SingleAsync(k => k.Id == created.Value.Id);
        entity.IsDeleted.Should().BeTrue();
        entity.DeletedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task CreateKey_MissingName_ReturnsValidationError()
    {
        using var db = TestDbContextFactory.Create();
        var service = new ApiKeyService(db);

        var result = await service.CreateKeyAsync(new CreateApiKeyCommand(
            Name: "   ",
            Description: null,
            Scopes: null,
            ExpiresInDays: null));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }
}
