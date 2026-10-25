using System.Net;
using System.Text.Json;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Core.Services.Weather;

namespace Pitbull.Tests.Unit.Services;

public sealed class WeatherServiceTests
{
    #region GetWeatherAsync Tests

    [Fact]
    public async Task GetWeatherAsync_WithValidResponse_ReturnsWeatherData()
    {
        // Arrange
        var json = CreateSampleResponse(
            temperature: 22.5m, weatherCode: 0, wind: 15.3m, precipitation: 0m,
            tempMax: 28.0m, tempMin: 18.0m);
        var service = CreateService(json, HttpStatusCode.OK);

        // Act
        var result = await service.GetWeatherAsync(40.7128m, -74.0060m);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.CurrentTemperature.Should().Be(22.5m);
        result.Value.WeatherSummary.Should().Be("Clear sky");
        result.Value.Wind.Should().Be("15 km/h");
        result.Value.Precipitation.Should().Be("0.0 mm");
        result.Value.TemperatureHigh.Should().Be(28.0m);
        result.Value.TemperatureLow.Should().Be(18.0m);
    }

    [Fact]
    public async Task GetWeatherAsync_WithRainCode_ReturnCorrectSummary()
    {
        // Arrange
        var json = CreateSampleResponse(
            temperature: 15m, weatherCode: 61, wind: 20m, precipitation: 2.5m,
            tempMax: 18m, tempMin: 12m);
        var service = CreateService(json, HttpStatusCode.OK);

        // Act
        var result = await service.GetWeatherAsync(34.0522m, -118.2437m);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.WeatherSummary.Should().Be("Light rain");
    }

    [Fact]
    public async Task GetWeatherAsync_WithSnowCode_ReturnsCorrectSummary()
    {
        var json = CreateSampleResponse(
            temperature: -5m, weatherCode: 73, wind: 10m, precipitation: 0m,
            tempMax: -2m, tempMin: -8m);
        var service = CreateService(json, HttpStatusCode.OK);

        var result = await service.GetWeatherAsync(41.8781m, -87.6298m);

        result.IsSuccess.Should().BeTrue();
        result.Value!.WeatherSummary.Should().Be("Moderate snow");
    }

    [Fact]
    public async Task GetWeatherAsync_WithThunderstormCode_ReturnsCorrectSummary()
    {
        var json = CreateSampleResponse(
            temperature: 30m, weatherCode: 95, wind: 40m, precipitation: 12m,
            tempMax: 35m, tempMin: 25m);
        var service = CreateService(json, HttpStatusCode.OK);

        var result = await service.GetWeatherAsync(29.7604m, -95.3698m);

        result.IsSuccess.Should().BeTrue();
        result.Value!.WeatherSummary.Should().Be("Thunderstorm");
    }

    [Fact]
    public async Task GetWeatherAsync_WithSpecificDate_FindsCorrectDayIndex()
    {
        // Arrange — response has 2 days of data, target is the second day
        var json = JsonSerializer.Serialize(new
        {
            current = new { temperature_2m = 20m, weather_code = 2, wind_speed_10m = 12m, precipitation = 0m },
            daily = new
            {
                time = new[] { "2026-02-24", "2026-02-25" },
                temperature_2m_max = new[] { 22m, 26m },
                temperature_2m_min = new[] { 10m, 14m },
            }
        });
        var service = CreateService(json, HttpStatusCode.OK);

        // Act
        var result = await service.GetWeatherAsync(40m, -74m, new DateTime(2026, 2, 25, 0, 0, 0, DateTimeKind.Utc));

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TemperatureHigh.Should().Be(26m);
        result.Value.TemperatureLow.Should().Be(14m);
    }

    [Fact]
    public async Task GetWeatherAsync_WithInvalidLatitude_ReturnsFailure()
    {
        var service = CreateService("{}", HttpStatusCode.OK);

        var result = await service.GetWeatherAsync(91m, 0m);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task GetWeatherAsync_WithInvalidLongitude_ReturnsFailure()
    {
        var service = CreateService("{}", HttpStatusCode.OK);

        var result = await service.GetWeatherAsync(0m, -181m);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task GetWeatherAsync_WhenApiReturns500_ReturnsFailure()
    {
        var service = CreateService("", HttpStatusCode.InternalServerError);

        var result = await service.GetWeatherAsync(40m, -74m);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("EXTERNAL_SERVICE_ERROR");
    }

    [Fact]
    public async Task GetWeatherAsync_WhenApiReturnsMalformedJson_ReturnsFailure()
    {
        var service = CreateService("not json at all", HttpStatusCode.OK);

        var result = await service.GetWeatherAsync(40m, -74m);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("EXTERNAL_SERVICE_ERROR");
    }

    [Fact]
    public async Task GetWeatherAsync_WithDateNotInForecast_ReturnsFailure()
    {
        var json = JsonSerializer.Serialize(new
        {
            current = new { temperature_2m = 20m, weather_code = 2, wind_speed_10m = 12m, precipitation = 0m },
            daily = new
            {
                time = new[] { "2026-02-24" },
                temperature_2m_max = new[] { 22m },
                temperature_2m_min = new[] { 10m },
            }
        });
        var service = CreateService(json, HttpStatusCode.OK);

        var result = await service.GetWeatherAsync(40m, -74m, new DateTime(2026, 3, 15, 0, 0, 0, DateTimeKind.Utc));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("DATE_NOT_FOUND");
    }

    #endregion

    #region MapWeatherCode Tests

    [Theory]
    [InlineData(0, "Clear sky")]
    [InlineData(1, "Mainly clear")]
    [InlineData(2, "Partly cloudy")]
    [InlineData(3, "Overcast")]
    [InlineData(45, "Fog")]
    [InlineData(51, "Light drizzle")]
    [InlineData(61, "Light rain")]
    [InlineData(63, "Moderate rain")]
    [InlineData(65, "Heavy rain")]
    [InlineData(71, "Light snow")]
    [InlineData(73, "Moderate snow")]
    [InlineData(75, "Heavy snow")]
    [InlineData(80, "Light rain showers")]
    [InlineData(95, "Thunderstorm")]
    [InlineData(99, "Thunderstorm with heavy hail")]
    [InlineData(999, "Unknown")]
    [InlineData(null, "Unknown")]
    public void MapWeatherCode_ReturnsExpectedDescription(int? code, string expected)
    {
        WeatherService.MapWeatherCode(code).Should().Be(expected);
    }

    #endregion

    #region Helpers

    private static string CreateSampleResponse(
        decimal temperature, int weatherCode, decimal wind, decimal precipitation,
        decimal tempMax, decimal tempMin)
    {
        return JsonSerializer.Serialize(new
        {
            current = new
            {
                temperature_2m = temperature,
                weather_code = weatherCode,
                wind_speed_10m = wind,
                precipitation = precipitation,
            },
            daily = new
            {
                time = new[] { DateTime.UtcNow.ToString("yyyy-MM-dd") },
                temperature_2m_max = new[] { tempMax },
                temperature_2m_min = new[] { tempMin },
            }
        });
    }

    private static WeatherService CreateService(string responseBody, HttpStatusCode statusCode)
    {
        var handler = new FakeHttpMessageHandler(responseBody, statusCode);
        var httpClient = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://api.open-meteo.com/"),
        };

        var factory = new FakeHttpClientFactory(httpClient);
        return new WeatherService(factory, NullLogger<WeatherService>.Instance);
    }

    private sealed class FakeHttpMessageHandler(string responseBody, HttpStatusCode statusCode) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var response = new HttpResponseMessage(statusCode)
            {
                Content = new StringContent(responseBody, System.Text.Encoding.UTF8, "application/json"),
            };
            return Task.FromResult(response);
        }
    }

    private sealed class FakeHttpClientFactory(HttpClient client) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => client;
    }

    #endregion
}
