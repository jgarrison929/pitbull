using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Admin company settings management
/// NOTE: Database persistence pending EF migration. Returns defaults.
/// </summary>
[ApiController]
[Route("api/admin/company")]
[Authorize(Roles = "Admin")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Admin - Company Settings")]
public class AdminCompanyController : ControllerBase
{
    // In-memory storage until DB migration is done
    private static readonly Dictionary<Guid, CompanySettingsDto> _settings = new();

    /// <summary>
    /// Get company settings for current tenant
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(CompanySettingsDto), StatusCodes.Status200OK)]
    public IActionResult GetSettings()
    {
        var tenantId = GetTenantId();

        if (_settings.TryGetValue(tenantId, out var settings))
            return Ok(settings);

        // Return defaults if not configured yet
        return Ok(new CompanySettingsDto
        {
            CompanyName = "My Company",
            Timezone = "America/Los_Angeles",
            DateFormat = "MM/dd/yyyy",
            Currency = "USD",
            FiscalYearStartMonth = 1
        });
    }

    /// <summary>
    /// Update company settings
    /// </summary>
    [HttpPut]
    [ProducesResponseType(typeof(CompanySettingsDto), StatusCodes.Status200OK)]
    public IActionResult UpdateSettings([FromBody] UpdateCompanySettingsRequest request)
    {
        var tenantId = GetTenantId();

        var settings = new CompanySettingsDto
        {
            Id = Guid.NewGuid(),
            CompanyName = request.CompanyName,
            LogoUrl = request.LogoUrl,
            PrimaryColor = request.PrimaryColor,
            Address = request.Address,
            City = request.City,
            State = request.State,
            ZipCode = request.ZipCode,
            Phone = request.Phone,
            Website = request.Website,
            TaxId = request.TaxId,
            Timezone = request.Timezone ?? "America/Los_Angeles",
            DateFormat = request.DateFormat ?? "MM/dd/yyyy",
            Currency = request.Currency ?? "USD",
            FiscalYearStartMonth = request.FiscalYearStartMonth ?? 1
        };

        _settings[tenantId] = settings;
        return Ok(settings);
    }

    private Guid GetTenantId()
    {
        var tenantClaim = User.FindFirst("tenant_id")?.Value;
        return Guid.TryParse(tenantClaim, out var tid) ? tid : Guid.Empty;
    }
}

public record CompanySettingsDto
{
    public Guid? Id { get; init; }
    public string CompanyName { get; init; } = string.Empty;
    public string? LogoUrl { get; init; }
    public string? PrimaryColor { get; init; }
    public string? Address { get; init; }
    public string? City { get; init; }
    public string? State { get; init; }
    public string? ZipCode { get; init; }
    public string? Phone { get; init; }
    public string? Website { get; init; }
    public string? TaxId { get; init; }
    public string Timezone { get; init; } = "America/Los_Angeles";
    public string DateFormat { get; init; } = "MM/dd/yyyy";
    public string Currency { get; init; } = "USD";
    public int FiscalYearStartMonth { get; init; } = 1;
}

public record UpdateCompanySettingsRequest
{
    public string CompanyName { get; init; } = string.Empty;
    public string? LogoUrl { get; init; }
    public string? PrimaryColor { get; init; }
    public string? Address { get; init; }
    public string? City { get; init; }
    public string? State { get; init; }
    public string? ZipCode { get; init; }
    public string? Phone { get; init; }
    public string? Website { get; init; }
    public string? TaxId { get; init; }
    public string? Timezone { get; init; }
    public string? DateFormat { get; init; }
    public string? Currency { get; init; }
    public int? FiscalYearStartMonth { get; init; }
}
