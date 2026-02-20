using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Pitbull.AI.Providers;
using Pitbull.AI.Services;
using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Tests.Unit.Services;

public class DataEntryServiceTests
{
    private static readonly Guid ProjectId = Guid.NewGuid();
    private static readonly Guid EmployeeId = Guid.NewGuid();
    private static readonly Guid CostCodeId = Guid.NewGuid();

    [Fact]
    public async Task ParseAsync_TimeEntryInput_ReturnsTimeEntryParsed()
    {
        using var db = TestDbContextFactory.Create();
        var (service, mockAi) = CreateService(db);

        await SeedEntities(db);

        SetupAiResponse(mockAi, new
        {
            entityType = "TimeEntry",
            fields = new { employeeName = "John", projectName = "Downtown", costCodeCode = "01-100", regularHours = 8 },
            summary = "Log 8 hours for John on Downtown project"
        });

        var result = await service.ParseAsync("log 8 hours for John on Downtown project, cost code 01-100", CancellationToken.None);

        result.EntityType.Should().Be("TimeEntry");
        result.Summary.Should().Contain("8 hours");
        result.Fields.Should().ContainKey("employeeId");
        result.Fields.Should().ContainKey("projectId");
        result.Fields.Should().ContainKey("costCodeId");
        result.ConfidenceScore.Should().BeGreaterThan(0);
        result.RequiresConfirmation.Should().BeTrue();
    }

    [Fact]
    public async Task ParseAsync_DailyReportInput_ReturnsDailyReportParsed()
    {
        using var db = TestDbContextFactory.Create();
        var (service, mockAi) = CreateService(db);

        await SeedEntities(db);

        SetupAiResponse(mockAi, new
        {
            entityType = "DailyReport",
            fields = new { projectName = "Downtown", weatherSummary = "Sunny", temperatureHigh = 75, workNarrative = "Poured concrete" },
            summary = "Daily report for Downtown"
        });

        var result = await service.ParseAsync("daily report for Downtown: sunny 75F, poured concrete", CancellationToken.None);

        result.EntityType.Should().Be("DailyReport");
        result.Fields.Should().ContainKey("projectId");
        result.ConfidenceScore.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task ParseAsync_AmbiguousEmployee_LowersConfidence()
    {
        using var db = TestDbContextFactory.Create();
        var (service, mockAi) = CreateService(db);

        // Seed two employees with same first name
        db.Set<Employee>().Add(new Employee
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeNumber = "EMP-001",
            FirstName = "John",
            LastName = "Smith",
            BaseHourlyRate = 50m,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        });
        db.Set<Employee>().Add(new Employee
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeNumber = "EMP-002",
            FirstName = "John",
            LastName = "Doe",
            BaseHourlyRate = 45m,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        });
        db.Set<Project>().Add(new Project
        {
            Id = ProjectId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            Name = "Downtown Tower",
            Number = "PRJ-001",
            Status = ProjectStatus.Active,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        });
        await db.SaveChangesAsync();

        SetupAiResponse(mockAi, new
        {
            entityType = "TimeEntry",
            fields = new { employeeName = "John", projectName = "Downtown", costCodeCode = "100", regularHours = 8 },
            summary = "Log 8 hours for John"
        });

        var result = await service.ParseAsync("log 8 hours for John on Downtown", CancellationToken.None);

        result.Warnings.Should().Contain(w => w.Contains("Ambiguous employee"));
        result.ConfidenceScore.Should().BeLessThan(0.8m);
    }

    [Fact]
    public async Task ParseAsync_UnknownProject_LowersConfidence()
    {
        using var db = TestDbContextFactory.Create();
        var (service, mockAi) = CreateService(db);

        SetupAiResponse(mockAi, new
        {
            entityType = "TimeEntry",
            fields = new { employeeName = "John", projectName = "Nonexistent", regularHours = 8 },
            summary = "Log 8 hours"
        });

        var result = await service.ParseAsync("log 8 hours for John on Nonexistent project", CancellationToken.None);

        result.Warnings.Should().Contain(w => w.Contains("not found"));
        result.ConfidenceScore.Should().BeLessThan(0.5m);
    }

    [Fact]
    public async Task ParseAsync_AiServiceFails_ReturnsUnknownWithError()
    {
        using var db = TestDbContextFactory.Create();
        var (service, mockAi) = CreateService(db);

        mockAi.Setup(ai => ai.CompleteAsync(
                It.IsAny<Guid>(),
                It.IsAny<AiCompletionRequest>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure<AiCompletionResult>("Service unavailable", "AI_UNAVAILABLE"));

        var result = await service.ParseAsync("anything", CancellationToken.None);

        result.EntityType.Should().Be("Unknown");
        result.ConfidenceScore.Should().Be(0);
        result.Warnings.Should().NotBeEmpty();
    }

    [Fact]
    public async Task ExecuteAsync_TimeEntry_CreatesEntityInDatabase()
    {
        using var db = TestDbContextFactory.Create();
        var (service, _) = CreateService(db);

        await SeedEntities(db);

        var fields = new Dictionary<string, JsonElement>
        {
            ["employeeId"] = JsonDocument.Parse($"\"{EmployeeId}\"").RootElement.Clone(),
            ["projectId"] = JsonDocument.Parse($"\"{ProjectId}\"").RootElement.Clone(),
            ["costCodeId"] = JsonDocument.Parse($"\"{CostCodeId}\"").RootElement.Clone(),
            ["regularHours"] = JsonDocument.Parse("8").RootElement.Clone(),
            ["overtimeHours"] = JsonDocument.Parse("2").RootElement.Clone()
        };

        var result = await service.ExecuteAsync(
            new DataEntryExecuteRequest("TimeEntry", fields), CancellationToken.None);

        result.EntityType.Should().Be("TimeEntry");
        result.EntityId.Should().NotBeEmpty();
        result.Summary.Should().Contain("8h regular");
        result.Summary.Should().Contain("2h OT");

        var created = await db.Set<TimeEntry>().FindAsync(result.EntityId);
        created.Should().NotBeNull();
        created!.Status.Should().Be(TimeEntryStatus.Draft);
        created.RegularHours.Should().Be(8m);
        created.OvertimeHours.Should().Be(2m);
    }

    [Fact]
    public async Task ExecuteAsync_TimeEntry_MissingEmployee_ThrowsArgumentException()
    {
        using var db = TestDbContextFactory.Create();
        var (service, _) = CreateService(db);

        var fields = new Dictionary<string, JsonElement>
        {
            ["projectId"] = JsonDocument.Parse($"\"{ProjectId}\"").RootElement.Clone(),
            ["costCodeId"] = JsonDocument.Parse($"\"{CostCodeId}\"").RootElement.Clone(),
            ["regularHours"] = JsonDocument.Parse("8").RootElement.Clone()
        };

        var act = () => service.ExecuteAsync(
            new DataEntryExecuteRequest("TimeEntry", fields), CancellationToken.None);

        await act.Should().ThrowAsync<ArgumentException>().WithMessage("*Employee not resolved*");
    }

    [Fact]
    public async Task ExecuteAsync_UnsupportedEntityType_ThrowsArgumentException()
    {
        using var db = TestDbContextFactory.Create();
        var (service, _) = CreateService(db);

        var act = () => service.ExecuteAsync(
            new DataEntryExecuteRequest("Unknown", new Dictionary<string, JsonElement>()), CancellationToken.None);

        await act.Should().ThrowAsync<ArgumentException>().WithMessage("*Unsupported entity type*");
    }

    // --- Helpers ---

    private static (DataEntryService service, Mock<IAiService> mockAi) CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        var tenantContext = new TenantContext
        {
            TenantId = TestDbContextFactory.TestTenantId,
            TenantName = "Test Tenant"
        };
        var companyContext = new CompanyContext
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            CompanyCode = "01",
            CompanyName = "Test Company"
        };
        var mockAi = new Mock<IAiService>();
        var mockHttp = new Mock<IHttpContextAccessor>();

        var service = new DataEntryService(
            db, mockAi.Object, tenantContext, companyContext,
            mockHttp.Object, NullLogger<DataEntryService>.Instance);

        return (service, mockAi);
    }

    private static void SetupAiResponse(Mock<IAiService> mockAi, object responseBody)
    {
        var json = JsonSerializer.Serialize(responseBody);
        mockAi.Setup(ai => ai.CompleteAsync(
                It.IsAny<Guid>(),
                It.IsAny<AiCompletionRequest>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success(new AiCompletionResult(
                Content: json,
                InputTokens: 100,
                OutputTokens: 50,
                Model: "test-model",
                Provider: "test",
                Latency: TimeSpan.FromMilliseconds(200),
                ConfidenceScore: 0.9m)));
    }

    private static async Task SeedEntities(Pitbull.Core.Data.PitbullDbContext db)
    {
        db.Set<Project>().Add(new Project
        {
            Id = ProjectId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            Name = "Downtown Tower",
            Number = "PRJ-001",
            ContractAmount = 500_000m,
            Status = ProjectStatus.Active,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        });

        db.Set<Employee>().Add(new Employee
        {
            Id = EmployeeId,
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeNumber = "EMP-001",
            FirstName = "John",
            LastName = "Smith",
            BaseHourlyRate = 50m,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        });

        db.Set<CostCode>().Add(new CostCode
        {
            Id = CostCodeId,
            TenantId = TestDbContextFactory.TestTenantId,
            Code = "01-100",
            Description = "General Labor",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        });

        await db.SaveChangesAsync();
    }
}
