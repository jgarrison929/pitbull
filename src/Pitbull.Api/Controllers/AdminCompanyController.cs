using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Admin company settings management.
/// Reads and writes from the Company entity via PitbullDbContext.
/// </summary>
[ApiController]
[Route("api/admin/company")]
[Authorize(Policy = "Admin.Settings")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Admin - Company Settings")]
public class AdminCompanyController : ControllerBase
{
    private readonly PitbullDbContext _db;
    private readonly ICompanyContext _companyContext;

    public AdminCompanyController(PitbullDbContext db, ICompanyContext companyContext)
    {
        _db = db;
        _companyContext = companyContext;
    }

    /// <summary>
    /// Get company settings for current company
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(CompanySettingsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSettings(CancellationToken ct)
    {
        var company = await _db.Set<Company>()
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == _companyContext.CompanyId, ct);

        if (company is null)
            return NotFound(new { error = "Company not found", code = "NOT_FOUND" });

        return Ok(MapToDto(company));
    }

    /// <summary>
    /// Create or update tenant settings
    /// </summary>
    [HttpPut]
    [ProducesResponseType(typeof(CompanySettingsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateSettings(
        [FromBody] UpdateCompanySettingsRequest request,
        CancellationToken ct)
    {
        var company = await _db.Set<Company>()
            .FirstOrDefaultAsync(c => c.Id == _companyContext.CompanyId, ct);

        if (company is null)
            return NotFound(new { error = "Company not found", code = "NOT_FOUND" });

        // Basic info
        if (request.Name is not null) company.Name = request.Name;
        if (request.LogoUrl is not null) company.LogoUrl = request.LogoUrl;
        if (request.PrimaryColor is not null) company.PrimaryColor = request.PrimaryColor;
        if (request.TaxId is not null) company.TaxId = request.TaxId;

        // Address
        if (request.Address is not null) company.Address = request.Address;
        if (request.City is not null) company.City = request.City;
        if (request.State is not null) company.State = request.State;
        if (request.ZipCode is not null) company.ZipCode = request.ZipCode;

        // Contact
        if (request.Phone is not null) company.Phone = request.Phone;
        if (request.Website is not null) company.Website = request.Website;

        // Financial
        if (request.Timezone is not null) company.Timezone = request.Timezone;
        if (request.DateFormat is not null) company.DateFormat = request.DateFormat;
        if (request.Currency is not null) company.Currency = request.Currency;
        if (request.FiscalYearStartMonth.HasValue)
            company.FiscalYearStartMonth = request.FiscalYearStartMonth.Value;
        if (request.PayPeriodType is not null)
            company.PayPeriodType = request.PayPeriodType;
        if (request.DefaultWorkWeekDays is not null)
            company.DefaultWorkWeekDays = request.DefaultWorkWeekDays;

        // Overtime settings
        if (request.OvertimeEnabled.HasValue)
            company.OvertimeSettings.Enabled = request.OvertimeEnabled.Value;
        if (request.DailyOtThreshold.HasValue)
            company.OvertimeSettings.DailyOtThreshold = request.DailyOtThreshold.Value;
        if (request.WeeklyOtThreshold.HasValue)
            company.OvertimeSettings.WeeklyOtThreshold = request.WeeklyOtThreshold.Value;
        if (request.DailyDtThreshold.HasValue)
            company.OvertimeSettings.DailyDtThreshold = request.DailyDtThreshold.Value;
        if (request.CaliforniaOtRules.HasValue)
            company.OvertimeSettings.CaliforniaOtRules = request.CaliforniaOtRules.Value;

        await _db.SaveChangesAsync(ct);

        return Ok(MapToDto(company));
    }

    private static CompanySettingsDto MapToDto(Company company)
    {
        return new CompanySettingsDto
        {
            Id = company.Id,
            Name = company.Name,
            LogoUrl = company.LogoUrl,
            PrimaryColor = company.PrimaryColor,
            Address = company.Address,
            City = company.City,
            State = company.State,
            ZipCode = company.ZipCode,
            Phone = company.Phone,
            Website = company.Website,
            TaxId = company.TaxId,
            Timezone = company.Timezone,
            DateFormat = company.DateFormat,
            Currency = company.Currency,
            FiscalYearStartMonth = company.FiscalYearStartMonth,
            PayPeriodType = company.PayPeriodType.ToString(),
            DefaultWorkWeekDays = company.DefaultWorkWeekDays,
            OvertimeEnabled = company.OvertimeSettings.Enabled,
            DailyOtThreshold = company.OvertimeSettings.DailyOtThreshold,
            WeeklyOtThreshold = company.OvertimeSettings.WeeklyOtThreshold,
            DailyDtThreshold = company.OvertimeSettings.DailyDtThreshold,
            CaliforniaOtRules = company.OvertimeSettings.CaliforniaOtRules,
        };
    }
}

public record CompanySettingsDto
{
    public Guid? Id { get; init; }
    public string Name { get; init; } = string.Empty;
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

    // Pay period & work week
    public string PayPeriodType { get; init; } = "Weekly";
    public string DefaultWorkWeekDays { get; init; } = "Mon,Tue,Wed,Thu,Fri";

    // Overtime settings
    public bool OvertimeEnabled { get; init; } = true;
    public decimal DailyOtThreshold { get; init; } = 8;
    public decimal WeeklyOtThreshold { get; init; } = 40;
    public decimal DailyDtThreshold { get; init; } = 12;
    public bool CaliforniaOtRules { get; init; } = false;
}

public record UpdateCompanySettingsRequest
{
    public string? Name { get; init; }
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

    // Pay period & work week
    public string? PayPeriodType { get; init; }
    public string? DefaultWorkWeekDays { get; init; }

    // Overtime settings
    public bool? OvertimeEnabled { get; init; }
    public decimal? DailyOtThreshold { get; init; }
    public decimal? WeeklyOtThreshold { get; init; }
    public decimal? DailyDtThreshold { get; init; }
    public bool? CaliforniaOtRules { get; init; }
}
