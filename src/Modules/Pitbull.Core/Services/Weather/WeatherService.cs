using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Pitbull.Core.CQRS;

namespace Pitbull.Core.Services.Weather;

public class WeatherService : IWeatherService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<WeatherService> _logger;

    public WeatherService(IHttpClientFactory httpClientFactory, ILogger<WeatherService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<Result<WeatherData>> GetWeatherAsync(
        decimal latitude,
        decimal longitude,
        DateTime? date = null,
        CancellationToken cancellationToken = default)
    {
        if (latitude < -90 || latitude > 90)
            return Result.Failure<WeatherData>("Latitude must be between -90 and 90", "VALIDATION_ERROR");
        if (longitude < -180 || longitude > 180)
            return Result.Failure<WeatherData>("Longitude must be between -180 and 180", "VALIDATION_ERROR");

        try
        {
            var client = _httpClientFactory.CreateClient("OpenMeteo");
            var url = FormattableString.Invariant($"v1/forecast?latitude={latitude}&longitude={longitude}") +
                      "&current=temperature_2m,weather_code,wind_speed_10m,precipitation" +
                      "&daily=temperature_2m_max,temperature_2m_min&timezone=auto";

            var response = await client.GetAsync(url, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Open-Meteo API returned {StatusCode}", response.StatusCode);
                return Result.Failure<WeatherData>("Weather service unavailable", "EXTERNAL_SERVICE_ERROR");
            }

            var json = await response.Content.ReadFromJsonAsync<OpenMeteoResponse>(cancellationToken: cancellationToken);
            if (json is null)
                return Result.Failure<WeatherData>("Invalid response from weather service", "EXTERNAL_SERVICE_ERROR");

            var targetDate = date?.Date ?? DateTime.UtcNow.Date;
            var dayIndex = FindDayIndex(json.Daily?.Time, targetDate);

            if (dayIndex < 0)
                return Result.Failure<WeatherData>("Requested date not available in forecast data", "DATE_NOT_FOUND");

            var maxTemps = json.Daily?.Temperature2mMax;
            var minTemps = json.Daily?.Temperature2mMin;

            var data = new WeatherData
            {
                CurrentTemperature = json.Current?.Temperature2m,
                WeatherSummary = MapWeatherCode(json.Current?.WeatherCode),
                Wind = json.Current?.WindSpeed10m is not null
                    ? $"{json.Current.WindSpeed10m:F0} km/h"
                    : null,
                Precipitation = json.Current?.Precipitation is not null
                    ? $"{json.Current.Precipitation:F1} mm"
                    : null,
                TemperatureHigh = maxTemps is not null && dayIndex < maxTemps.Count ? maxTemps[dayIndex] : null,
                TemperatureLow = minTemps is not null && dayIndex < minTemps.Count ? minTemps[dayIndex] : null,
            };

            return Result.Success(data);
        }
        catch (TaskCanceledException)
        {
            return Result.Failure<WeatherData>("Weather request timed out", "TIMEOUT");
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Failed to reach Open-Meteo API");
            return Result.Failure<WeatherData>("Weather service unavailable", "EXTERNAL_SERVICE_ERROR");
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Failed to parse Open-Meteo response");
            return Result.Failure<WeatherData>("Invalid response from weather service", "EXTERNAL_SERVICE_ERROR");
        }
    }

    private static int FindDayIndex(List<string>? dates, DateTime target)
    {
        if (dates is null) return -1;
        var targetStr = target.ToString("yyyy-MM-dd");
        return dates.IndexOf(targetStr);
    }

    public static string MapWeatherCode(int? code) => code switch
    {
        0 => "Clear sky",
        1 => "Mainly clear",
        2 => "Partly cloudy",
        3 => "Overcast",
        45 => "Fog",
        48 => "Depositing rime fog",
        51 => "Light drizzle",
        53 => "Moderate drizzle",
        55 => "Dense drizzle",
        56 => "Light freezing drizzle",
        57 => "Dense freezing drizzle",
        61 => "Light rain",
        63 => "Moderate rain",
        65 => "Heavy rain",
        66 => "Light freezing rain",
        67 => "Heavy freezing rain",
        71 => "Light snow",
        73 => "Moderate snow",
        75 => "Heavy snow",
        77 => "Snow grains",
        80 => "Light rain showers",
        81 => "Moderate rain showers",
        82 => "Violent rain showers",
        85 => "Light snow showers",
        86 => "Heavy snow showers",
        95 => "Thunderstorm",
        96 => "Thunderstorm with light hail",
        99 => "Thunderstorm with heavy hail",
        _ => "Unknown",
    };
}

// Open-Meteo JSON response models
internal class OpenMeteoResponse
{
    [JsonPropertyName("current")]
    public OpenMeteoCurrent? Current { get; set; }

    [JsonPropertyName("daily")]
    public OpenMeteoDaily? Daily { get; set; }
}

internal class OpenMeteoCurrent
{
    [JsonPropertyName("temperature_2m")]
    public decimal? Temperature2m { get; set; }

    [JsonPropertyName("weather_code")]
    public int? WeatherCode { get; set; }

    [JsonPropertyName("wind_speed_10m")]
    public decimal? WindSpeed10m { get; set; }

    [JsonPropertyName("precipitation")]
    public decimal? Precipitation { get; set; }
}

internal class OpenMeteoDaily
{
    [JsonPropertyName("time")]
    public List<string>? Time { get; set; }

    [JsonPropertyName("temperature_2m_max")]
    public List<decimal>? Temperature2mMax { get; set; }

    [JsonPropertyName("temperature_2m_min")]
    public List<decimal>? Temperature2mMin { get; set; }
}
