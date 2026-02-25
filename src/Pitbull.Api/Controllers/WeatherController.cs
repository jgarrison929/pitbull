using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Core.Services.Weather;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Weather data from Open-Meteo for construction site conditions.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Weather")]
public class WeatherController(IWeatherService weatherService) : ControllerBase
{
    /// <summary>
    /// Gets current weather data for a location.
    /// </summary>
    /// <param name="latitude">Site latitude (WGS 84).</param>
    /// <param name="longitude">Site longitude (WGS 84).</param>
    /// <param name="date">Optional date (defaults to today).</param>
    /// <returns>Weather conditions including temperature, precipitation, wind.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(WeatherData), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Get(
        [FromQuery] decimal latitude,
        [FromQuery] decimal longitude,
        [FromQuery] DateTime? date = null)
    {
        var result = await weatherService.GetWeatherAsync(latitude, longitude, date);

        if (!result.IsSuccess)
        {
            var body = new { error = result.Error, code = result.ErrorCode };
            return result.ErrorCode switch
            {
                "EXTERNAL_SERVICE_ERROR" => StatusCode(StatusCodes.Status502BadGateway, body),
                "TIMEOUT" => StatusCode(StatusCodes.Status503ServiceUnavailable, body),
                _ => BadRequest(body),
            };
        }

        return Ok(result.Value);
    }
}
