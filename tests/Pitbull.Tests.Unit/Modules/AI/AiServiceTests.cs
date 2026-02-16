using FluentAssertions;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Moq;
using Pitbull.AI.Domain;
using Pitbull.AI.Features;
using Pitbull.AI.Providers;
using Pitbull.AI.Services;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.AI;

public class AiServiceTests
{
    [Fact]
    public async Task CompleteAsync_UsesPreferredProvider_ForAnalysisCapability()
    {
        var anthropic = new TestAiProvider("anthropic", new HashSet<AiCapability> { AiCapability.Analysis, AiCapability.TextGeneration });
        var openAi = new TestAiProvider("openai", new HashSet<AiCapability> { AiCapability.Analysis, AiCapability.TextGeneration });

        var keyService = new Mock<IAiApiKeyService>();
        keyService
            .Setup(x => x.GetDecryptedKeyAsync(It.IsAny<Guid>(), "anthropic", It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success("tenant-anthropic-key"));

        var service = new AiService([openAi, anthropic], keyService.Object, new ConfigurationBuilder().Build());
        var request = new AiCompletionRequest("sys", "user", AiCapability.Analysis);

        var result = await service.CompleteAsync(Guid.NewGuid(), request);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Provider.Should().Be("anthropic");
        anthropic.LastApiKey.Should().Be("tenant-anthropic-key");
    }

    [Fact]
    public async Task CompleteAsync_ReturnsNoProvider_WhenOverrideLacksCapability()
    {
        var openAi = new TestAiProvider("openai", new HashSet<AiCapability> { AiCapability.TextGeneration });
        var keyService = new Mock<IAiApiKeyService>();
        var service = new AiService([openAi], keyService.Object, new ConfigurationBuilder().Build());

        var result = await service.CompleteAsync(
            Guid.NewGuid(),
            new AiCompletionRequest("sys", "user", AiCapability.Analysis),
            providerOverride: "openai");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NO_PROVIDER");
    }

    [Fact]
    public async Task CompleteAsync_UsesFallbackConfigKey_WhenTenantKeyMissing()
    {
        var openAi = new TestAiProvider("openai", new HashSet<AiCapability> { AiCapability.TextGeneration });
        var keyService = new Mock<IAiApiKeyService>();
        keyService
            .Setup(x => x.GetDecryptedKeyAsync(It.IsAny<Guid>(), "openai", It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure<string>("missing", "NOT_FOUND"));

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["OPENAI_API_KEY"] = "fallback-openai-key" })
            .Build();

        var service = new AiService([openAi], keyService.Object, config);
        var result = await service.CompleteAsync(
            Guid.NewGuid(),
            new AiCompletionRequest("sys", "user", AiCapability.TextGeneration));

        result.IsSuccess.Should().BeTrue();
        openAi.LastApiKey.Should().Be("fallback-openai-key");
    }

    [Fact]
    public async Task CompleteAsync_ReturnsNotConfigured_WhenNoTenantOrFallbackKey()
    {
        var openAi = new TestAiProvider("openai", new HashSet<AiCapability> { AiCapability.TextGeneration });
        var keyService = new Mock<IAiApiKeyService>();
        keyService
            .Setup(x => x.GetDecryptedKeyAsync(It.IsAny<Guid>(), "openai", It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure<string>("missing", "NOT_FOUND"));

        var service = new AiService([openAi], keyService.Object, new ConfigurationBuilder().Build());

        var prior = Environment.GetEnvironmentVariable("OPENAI_API_KEY");
        Environment.SetEnvironmentVariable("OPENAI_API_KEY", null);
        try
        {
            var result = await service.CompleteAsync(
                Guid.NewGuid(),
                new AiCompletionRequest("sys", "user", AiCapability.TextGeneration));
            result.IsSuccess.Should().BeFalse();
            result.ErrorCode.Should().Be("AI_NOT_CONFIGURED");
        }
        finally
        {
            Environment.SetEnvironmentVariable("OPENAI_API_KEY", prior);
        }
    }

    [Fact]
    public async Task CompleteAsync_FallsBackToAnyCapableProvider_WhenPreferredMissing()
    {
        var openAi = new TestAiProvider("openai", new HashSet<AiCapability> { AiCapability.Analysis });
        var keyService = new Mock<IAiApiKeyService>();
        keyService
            .Setup(x => x.GetDecryptedKeyAsync(It.IsAny<Guid>(), "openai", It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success("tenant-openai-key"));

        var service = new AiService([openAi], keyService.Object, new ConfigurationBuilder().Build());
        var result = await service.CompleteAsync(
            Guid.NewGuid(),
            new AiCompletionRequest("sys", "user", AiCapability.Analysis));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Provider.Should().Be("openai");
    }

    private sealed class TestAiProvider(string name, IReadOnlySet<AiCapability> capabilities) : IAiProvider
    {
        public string Name { get; } = name;
        public IReadOnlySet<AiCapability> Capabilities { get; } = capabilities;
        public string? LastApiKey { get; private set; }

        public Task<Result<AiCompletionResult>> CompleteAsync(
            AiCompletionRequest request,
            string apiKey,
            CancellationToken ct = default)
        {
            LastApiKey = apiKey;
            return Task.FromResult(Result.Success(new AiCompletionResult(
                Content: "ok",
                InputTokens: 10,
                OutputTokens: 5,
                Model: "test-model",
                Provider: Name,
                Latency: TimeSpan.FromMilliseconds(5))));
        }
    }
}

public class AiApiKeyServiceTests
{
    static AiApiKeyServiceTests()
    {
        PitbullDbContext.RegisterModuleAssembly(typeof(CreateAiModuleCommand).Assembly);
    }

    [Fact]
    public async Task StoreAndGetKey_EncryptsAtRest_AndDecryptsForSameTenant()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var tenantId = TestDbContextFactory.TestTenantId;

        var store = await service.StoreKeyAsync(tenantId, " OpenAI ", "sk-test-123456");
        var stored = await db.Set<AiApiKey>().SingleAsync(x => x.TenantId == tenantId && x.Provider == "openai");
        var get = await service.GetDecryptedKeyAsync(tenantId, "OPENAI");

        store.IsSuccess.Should().BeTrue();
        stored.EncryptedApiKey.Should().NotBe("sk-test-123456");
        stored.KeyFingerprint.Should().Be("***3456");
        get.IsSuccess.Should().BeTrue();
        get.Value.Should().Be("sk-test-123456");
    }

    [Fact]
    public async Task GetDecryptedKeyAsync_IsTenantScoped()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        using var db = TestDbContextFactory.Create(tenantA);
        var service = CreateService(db);

        await service.StoreKeyAsync(tenantA, "openai", "sk-tenant-a");

        var result = await service.GetDecryptedKeyAsync(tenantB, "openai");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task RevokeKeyAsync_DeactivatesKey_AndSubsequentGetFails()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var tenantId = TestDbContextFactory.TestTenantId;

        await service.StoreKeyAsync(tenantId, "anthropic", "anthropic-secret");

        var revoke = await service.RevokeKeyAsync(tenantId, "anthropic");
        var get = await service.GetDecryptedKeyAsync(tenantId, "anthropic");

        revoke.IsSuccess.Should().BeTrue();
        get.IsSuccess.Should().BeFalse();
        get.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task GetDecryptedKeyAsync_ExpiredKey_ReturnsNotFound()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var tenantId = TestDbContextFactory.TestTenantId;

        await service.StoreKeyAsync(tenantId, "openai", "expired-secret", DateTime.UtcNow.AddMinutes(-5));

        var result = await service.GetDecryptedKeyAsync(tenantId, "openai");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task StoreKeyAsync_ValidatesRequiredInputs()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var missingTenant = await service.StoreKeyAsync(Guid.Empty, "openai", "key");
        var missingProvider = await service.StoreKeyAsync(Guid.NewGuid(), "", "key");
        var missingKey = await service.StoreKeyAsync(Guid.NewGuid(), "openai", "");

        missingTenant.IsSuccess.Should().BeFalse();
        missingTenant.ErrorCode.Should().Be("VALIDATION_ERROR");
        missingProvider.IsSuccess.Should().BeFalse();
        missingProvider.ErrorCode.Should().Be("VALIDATION_ERROR");
        missingKey.IsSuccess.Should().BeFalse();
        missingKey.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    private static AiApiKeyService CreateService(PitbullDbContext db)
    {
        var keysPath = Path.Combine(Path.GetTempPath(), "pitbull-ai-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(keysPath);
        var protectionProvider = DataProtectionProvider.Create(new DirectoryInfo(keysPath));
        return new AiApiKeyService(db, protectionProvider);
    }
}
