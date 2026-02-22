using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.SystemAdmin.Domain;
using Pitbull.SystemAdmin.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.SystemAdmin;

[Collection("SystemAdmin")]
public sealed class SecretVaultServiceTests
{
    private static SecretVaultService CreateService(out Pitbull.Core.Data.PitbullDbContext db)
    {
        db = TestDbContextFactory.Create();
        return new SecretVaultService(db);
    }

    [Fact]
    public async Task Create_ValidCommand_ReturnsSuccess()
    {
        var service = CreateService(out var db);
        using var _ = db;

        var result = await service.CreateAsync(new CreateSecretVaultCommand(
            Key: "RESEND_API_KEY",
            DisplayName: "Resend API Key",
            Value: "re_1234567890abcdef",
            Category: "API",
            Description: "Email service key"));

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Key.Should().Be("RESEND_API_KEY");
        result.Value.Category.Should().Be("API");
        result.Value.KeyFingerprint.Should().Be("re_1");
    }

    [Fact]
    public async Task Create_MissingKey_ReturnsValidationError()
    {
        var service = CreateService(out var db);
        using var _ = db;

        var result = await service.CreateAsync(new CreateSecretVaultCommand(
            Key: "  ",
            DisplayName: "Test",
            Value: "secret123",
            Category: "API",
            Description: null));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task Create_MissingValue_ReturnsValidationError()
    {
        var service = CreateService(out var db);
        using var _ = db;

        var result = await service.CreateAsync(new CreateSecretVaultCommand(
            Key: "MY_KEY",
            DisplayName: "Test",
            Value: "  ",
            Category: "API",
            Description: null));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task Create_DuplicateKey_ReturnsDuplicateError()
    {
        var service = CreateService(out var db);
        using var _ = db;

        var cmd = new CreateSecretVaultCommand("DUP_KEY", "First", "value1", "API", null);
        await service.CreateAsync(cmd);

        var result = await service.CreateAsync(new CreateSecretVaultCommand("DUP_KEY", "Second", "value2", "API", null));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("DUPLICATE_KEY");
    }

    [Fact]
    public async Task Create_InvalidCategory_ReturnsValidationError()
    {
        var service = CreateService(out var db);
        using var _ = db;

        var result = await service.CreateAsync(new CreateSecretVaultCommand(
            Key: "MY_KEY",
            DisplayName: "Test",
            Value: "secret123",
            Category: "InvalidCategory",
            Description: null));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task Update_WithNewValue_RotatesLastRotated()
    {
        var service = CreateService(out var db);
        using var _ = db;

        var created = await service.CreateAsync(new CreateSecretVaultCommand(
            "ROTATE_KEY", "Rotate Test", "old_value_12345678", "API", null));
        created.IsSuccess.Should().BeTrue();

        var originalRotated = created.Value!.LastRotated;

        // Small delay to ensure timestamp differs
        await Task.Delay(10);

        var updated = await service.UpdateAsync(created.Value.Id, new UpdateSecretVaultCommand(
            DisplayName: null, Value: "new_value_87654321", Category: null, Description: null));

        updated.IsSuccess.Should().BeTrue();
        updated.Value!.LastRotated.Should().BeAfter(originalRotated);
        updated.Value.KeyFingerprint.Should().Be("new_");
    }

    [Fact]
    public async Task Update_WithoutValue_PreservesLastRotated()
    {
        var service = CreateService(out var db);
        using var _ = db;

        var created = await service.CreateAsync(new CreateSecretVaultCommand(
            "PRESERVE_KEY", "Preserve Test", "keep_this_value_1234", "API", null));
        created.IsSuccess.Should().BeTrue();

        var originalRotated = created.Value!.LastRotated;

        var updated = await service.UpdateAsync(created.Value.Id, new UpdateSecretVaultCommand(
            DisplayName: "Updated Name", Value: null, Category: null, Description: "Updated desc"));

        updated.IsSuccess.Should().BeTrue();
        updated.Value!.DisplayName.Should().Be("Updated Name");
        updated.Value.LastRotated.Should().Be(originalRotated);
    }

    [Fact]
    public async Task Delete_ExistingSecret_SoftDeletes()
    {
        var service = CreateService(out var db);
        using var _ = db;

        var created = await service.CreateAsync(new CreateSecretVaultCommand(
            "DELETE_KEY", "Delete Test", "delete_me_123456", "Integration", null));

        var result = await service.DeleteAsync(created.Value!.Id);
        result.IsSuccess.Should().BeTrue();

        var entity = await db.Set<SecretVault>()
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.Id == created.Value.Id);
        entity.Should().NotBeNull();
        entity!.IsDeleted.Should().BeTrue();
        entity.DeletedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task Delete_NonExistent_ReturnsNotFound()
    {
        var service = CreateService(out var db);
        using var _ = db;

        var result = await service.DeleteAsync(Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task Resolve_ExistingKey_ReturnsValue()
    {
        var service = CreateService(out var db);
        using var _ = db;

        await service.CreateAsync(new CreateSecretVaultCommand(
            "RESOLVE_KEY", "Resolve Test", "my_secret_value_1234", "API", null));

        var resolved = await service.GetResolvedSecretAsync("RESOLVE_KEY");

        resolved.Should().Be("my_secret_value_1234");
    }

    [Fact]
    public async Task Resolve_MissingKey_ReturnsNull()
    {
        var service = CreateService(out var db);
        using var _ = db;

        var resolved = await service.GetResolvedSecretAsync("NONEXISTENT_KEY");

        resolved.Should().BeNull();
    }

    [Fact]
    public async Task List_WithCategoryFilter_ReturnsFilteredResults()
    {
        var service = CreateService(out var db);
        using var _ = db;

        await service.CreateAsync(new CreateSecretVaultCommand("API_KEY", "API Key", "value1_12345678", "API", null));
        await service.CreateAsync(new CreateSecretVaultCommand("SMTP_KEY", "SMTP Key", "value2_12345678", "SMTP", null));

        var result = await service.ListAsync(SecretCategory.API);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(1);
        result.Value.Items[0].Key.Should().Be("API_KEY");
    }

    [Fact]
    public async Task Create_ShortValue_MasksCompletely()
    {
        var service = CreateService(out var db);
        using var _ = db;

        var result = await service.CreateAsync(new CreateSecretVaultCommand(
            "SHORT_KEY", "Short Test", "abc", "API", null));

        result.IsSuccess.Should().BeTrue();
        result.Value!.MaskedValue.Should().Be("***");
        result.Value.KeyFingerprint.Should().Be("***");
    }
}
