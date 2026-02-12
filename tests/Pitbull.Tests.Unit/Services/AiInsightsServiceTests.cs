using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Pitbull.Api.Services;
using Pitbull.Core.Data;
using Xunit;

namespace Pitbull.Tests.Unit.Services;

public class AiInsightsServiceTests
{
    [Fact]
    public async Task GetProjectSummaryAsync_ReturnsError_WhenApiKeyNotConfigured()
    {
        // Arrange
        var mockDb = new Mock<PitbullDbContext>(
            new Microsoft.EntityFrameworkCore.DbContextOptions<PitbullDbContext>(),
            Mock.Of<Pitbull.Core.MultiTenancy.ITenantContext>(),
            null!, null!);

        var emptyConfig = new ConfigurationBuilder().Build();
        var mockLogger = Mock.Of<ILogger<AiInsightsService>>();
        var mockHttpClientFactory = new Mock<IHttpClientFactory>();
        mockHttpClientFactory.Setup(x => x.CreateClient("Anthropic")).Returns(new HttpClient());

        // Clear any environment variable that might be set
        Environment.SetEnvironmentVariable("ANTHROPIC_API_KEY", null);

        var service = new AiInsightsService(
            mockDb.Object,
            emptyConfig,
            mockLogger,
            mockHttpClientFactory.Object);

        // Act
        var result = await service.GetProjectSummaryAsync(Guid.NewGuid());

        // Assert
        Assert.False(result.Success);
        Assert.Contains("not configured", result.Error, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void AiProjectSummaryResult_HasCorrectDefaults()
    {
        // Arrange & Act
        var result = new AiProjectSummaryResult();

        // Assert
        Assert.False(result.Success);
        Assert.Null(result.Error);
        Assert.Null(result.Summary);
        Assert.Equal(0, result.HealthScore);
        Assert.Empty(result.Highlights);
        Assert.Empty(result.Concerns);
        Assert.Empty(result.Recommendations);
        Assert.Null(result.Metrics);
    }

    [Fact]
    public void ProjectMetrics_InitializesCorrectly()
    {
        // Arrange & Act
        var metrics = new ProjectMetrics
        {
            TotalHoursLogged = 100.5m,
            TotalLaborCost = 5000.00m,
            TotalTimeEntries = 50,
            PendingApprovals = 5,
            AssignedEmployees = 8,
            DaysUntilDeadline = 30,
            BudgetUtilization = 25.5m,
            DailyAverageHours = 10.5m
        };

        // Assert
        Assert.Equal(100.5m, metrics.TotalHoursLogged);
        Assert.Equal(5000.00m, metrics.TotalLaborCost);
        Assert.Equal(50, metrics.TotalTimeEntries);
        Assert.Equal(5, metrics.PendingApprovals);
        Assert.Equal(8, metrics.AssignedEmployees);
        Assert.Equal(30, metrics.DaysUntilDeadline);
        Assert.Equal(25.5m, metrics.BudgetUtilization);
        Assert.Equal(10.5m, metrics.DailyAverageHours);
    }
}
