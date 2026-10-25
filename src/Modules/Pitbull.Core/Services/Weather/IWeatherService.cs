using Pitbull.Core.CQRS;

namespace Pitbull.Core.Services.Weather;

public class WeatherData
{
    public decimal? TemperatureHigh { get; set; }
    public decimal? TemperatureLow { get; set; }
    public decimal? CurrentTemperature { get; set; }
    public string? WeatherSummary { get; set; }
    public string? Precipitation { get; set; }
    public string? Wind { get; set; }
}

public interface IWeatherService
{
    Task<Result<WeatherData>> GetWeatherAsync(
        decimal latitude,
        decimal longitude,
        DateTime? date = null,
        CancellationToken cancellationToken = default);
}
