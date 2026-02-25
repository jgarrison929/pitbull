using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Pitbull.Api.Jobs;
using Pitbull.Core.CQRS;
using Pitbull.Core.Jobs;
using Pitbull.Core.MultiTenancy;
using Pitbull.Core.Services.Weather;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Jobs;

public class WeatherUpdateJobTests
{
    private static JobContext CreateSystemJobContext() => new()
    {
        TenantId = Guid.Empty,
        CompanyId = Guid.Empty,
        UserId = "system"
    };

    [Fact]
    public async Task ExecuteAsync_NoProjectsWithCoordinates_SucceedsWithNoApiCalls()
    {
        using var db = TestDbContextFactory.Create();
        var mockWeather = new Mock<IWeatherService>();

        var job = new WeatherUpdateJob(
            new TenantContext(), new CompanyContext(),
            db, mockWeather.Object, NullLogger<WeatherUpdateJob>.Instance);

        var result = await job.ExecuteAsync(CreateSystemJobContext(), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        mockWeather.Verify(
            s => s.GetWeatherAsync(It.IsAny<decimal>(), It.IsAny<decimal>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ExecuteAsync_ProjectWithCoordinates_FetchesWeather()
    {
        using var db = TestDbContextFactory.Create();

        db.Set<Project>().Add(new Project
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            Name = "Weather Test Project",
            Number = "PRJ-WX-001",
            Status = ProjectStatus.Active,
            Latitude = 33.749m,
            Longitude = -84.388m,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var mockWeather = new Mock<IWeatherService>();
        mockWeather.Setup(s => s.GetWeatherAsync(
                33.749m, -84.388m, It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success(new WeatherData
            {
                CurrentTemperature = 22.5m,
                WeatherSummary = "Clear sky"
            }));

        var job = new WeatherUpdateJob(
            new TenantContext(), new CompanyContext(),
            db, mockWeather.Object, NullLogger<WeatherUpdateJob>.Instance);

        var result = await job.ExecuteAsync(CreateSystemJobContext(), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        mockWeather.Verify(
            s => s.GetWeatherAsync(33.749m, -84.388m, It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ExecuteAsync_WeatherApiFails_StillSucceeds()
    {
        using var db = TestDbContextFactory.Create();

        db.Set<Project>().Add(new Project
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            Name = "Failing Weather Project",
            Number = "PRJ-WX-002",
            Status = ProjectStatus.Active,
            Latitude = 40.712m,
            Longitude = -74.006m,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var mockWeather = new Mock<IWeatherService>();
        mockWeather.Setup(s => s.GetWeatherAsync(
                It.IsAny<decimal>(), It.IsAny<decimal>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure<WeatherData>("Service unavailable", "EXTERNAL_SERVICE_ERROR"));

        var job = new WeatherUpdateJob(
            new TenantContext(), new CompanyContext(),
            db, mockWeather.Object, NullLogger<WeatherUpdateJob>.Instance);

        var result = await job.ExecuteAsync(CreateSystemJobContext(), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task ExecuteAsync_SkipsDeletedAndInactiveProjects()
    {
        using var db = TestDbContextFactory.Create();

        db.Set<Project>().Add(new Project
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            Name = "Completed Project",
            Number = "PRJ-WX-003",
            Status = ProjectStatus.Completed,
            Latitude = 51.507m,
            Longitude = -0.127m,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var mockWeather = new Mock<IWeatherService>();

        var job = new WeatherUpdateJob(
            new TenantContext(), new CompanyContext(),
            db, mockWeather.Object, NullLogger<WeatherUpdateJob>.Instance);

        var result = await job.ExecuteAsync(CreateSystemJobContext(), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        mockWeather.Verify(
            s => s.GetWeatherAsync(It.IsAny<decimal>(), It.IsAny<decimal>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public void InheritsFromBackgroundJobBase()
    {
        typeof(WeatherUpdateJob).BaseType.Should().Be(typeof(BackgroundJobBase));
    }
}
