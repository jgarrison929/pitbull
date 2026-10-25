using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Pitbull.Api.Attributes;
using Pitbull.Api.Controllers;
using Pitbull.Api.Extensions;
using Pitbull.Api.Infrastructure;
using Pitbull.Api.Services;
using Pitbull.Core.Constants;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.Entities;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Company management and switching endpoints.
/// </summary>
[ApiController]
[Route("api/companies")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Companies")]
public class CompaniesController(
    PitbullDbContext db,
    ITenantContext tenantContext,
    ICompanyContext companyContext,
    UserManager<AppUser> userManager,
    RoleSeeder roleSeeder,
    IJwtTokenService jwtTokenService,
    ICacheService cacheService) : ControllerBase
{
    // Suppress unused parameter warning - tenantContext reserved for future use
    private readonly ITenantContext _tenantContext = tenantContext;

    /// <summary>
    /// List all companies accessible to the current user.
    /// Returns { items: [...] } so callers can use result.items consistently.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    public async Task<IActionResult> List()
    {
        var accessibleIds = companyContext.AccessibleCompanyIds;

        var companies = await db.Companies
            .Where(c => accessibleIds.Contains(c.Id) && c.IsActive)
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Code)
            .ToListAsync();

        var items = companies.Select(MapToResponse).ToList();
        return Ok(new { items, total = items.Count });
    }

    /// <summary>
    /// Get the currently active company
    /// </summary>
    [HttpGet("active")]
    [Cacheable(DurationSeconds = 300)]
    [ProducesResponseType(typeof(CompanyResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetActive()
    {
        if (!companyContext.IsResolved)
            return NotFound(new { error = "No active company" });

        var response = await cacheService.GetOrCreateAsync(
            CacheKeys.Companies,
            async () =>
            {
                var company = await db.Companies
                    .Where(c => c.Id == companyContext.CompanyId)
                    .FirstOrDefaultAsync();

                return company is not null ? MapToResponse(company) : null;
            },
            CacheDurations.ReferenceData);

        if (response is null)
            return NotFound(new { error = "Active company not found" });

        return Ok(response);
    }

    /// <summary>
    /// List all companies the current user can access
    /// </summary>
    [HttpGet("accessible")]
    [Cacheable(DurationSeconds = 300)]
    [ProducesResponseType(typeof(List<CompanyResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAccessible()
    {
        var accessibleIds = companyContext.AccessibleCompanyIds;

        var companies = await db.Companies
            .Where(c => accessibleIds.Contains(c.Id) && c.IsActive)
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Code)
            .ToListAsync();

        return Ok(companies.Select(MapToResponse));
    }

    /// <summary>
    /// Switch the active company. Returns a new JWT with the updated company_id claim.
    /// </summary>
    [HttpPost("switch/{companyId:guid}")]
    [ProducesResponseType(typeof(CompanySwitchResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SwitchCompany(Guid companyId)
    {
        // Validate user has access to this company
        if (!companyContext.AccessibleCompanyIds.Contains(companyId))
            return this.ForbiddenError("You do not have access to this company");

        var company = await db.Companies
            .Where(c => c.Id == companyId && c.IsActive)
            .FirstOrDefaultAsync();

        if (company is null)
            return NotFound(new { error = "Company not found" });

        // Get the current user
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                     ?? User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        if (string.IsNullOrEmpty(userId))
            return this.UnauthorizedError("User not found");

        var user = await userManager.FindByIdAsync(userId);
        if (user is null)
            return this.UnauthorizedError("User not found");

        // Deactivated / locked accounts must not reissue JWTs via company switch.
        if (user.Status != UserStatus.Active)
            return this.UnauthorizedError("User is not active");

        // Shared issuer — company switch must not drop demo / persona / permission claims.
        var roles = await roleSeeder.GetUserRolesAsync(user);
        var token = await jwtTokenService.CreateAccessTokenAsync(
            user,
            roles,
            activeCompanyId: companyId,
            companyIds: companyContext.AccessibleCompanyIds);

        return Ok(new CompanySwitchResponse(
            Token: token,
            Company: MapToResponse(company)));
    }

    private static CompanyResponse MapToResponse(Company c) => new(
        Id: c.Id,
        Code: c.Code,
        Name: c.Name,
        ShortName: c.ShortName,
        TaxId: MaskTaxId(c.TaxId),
        Address: c.Address,
        City: c.City,
        State: c.State,
        ZipCode: c.ZipCode,
        Phone: c.Phone,
        Website: c.Website,
        Email: c.Email,
        LogoUrl: c.LogoUrl,
        PrimaryColor: c.PrimaryColor,
        Currency: c.Currency,
        Timezone: c.Timezone,
        DateFormat: c.DateFormat,
        FiscalYearStartMonth: c.FiscalYearStartMonth,
        IsActive: c.IsActive,
        IsDefault: c.IsDefault,
        SortOrder: c.SortOrder);

    /// <summary>
    /// Masks TaxId (EIN) for non-admin endpoints, showing only the last 4 characters.
    /// </summary>
    private static string? MaskTaxId(string? taxId)
    {
        if (string.IsNullOrWhiteSpace(taxId) || taxId.Length <= 4)
            return taxId;
        return "***" + taxId[^4..];
    }
}

/// <summary>
/// Admin endpoints for company CRUD operations
/// </summary>
[ApiController]
[Route("api/admin/companies")]
[Authorize(Policy = "Admin.Companies")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Admin - Companies")]
public class AdminCompaniesController(
    PitbullDbContext db,
    ITenantContext tenantContext,
    ICacheService cacheService) : ControllerBase
{
    // Suppress unused parameter warning - tenantContext reserved for future use
    private readonly ITenantContext _tenantContext = tenantContext;
    /// <summary>
    /// List all companies in the tenant
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<CompanyResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List()
    {
        var companies = await db.Companies
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Code)
            .ToListAsync();

        return Ok(companies.Select(c => new CompanyResponse(
            c.Id, c.Code, c.Name, c.ShortName, c.TaxId,
            c.Address, c.City, c.State, c.ZipCode,
            c.Phone, c.Website, c.Email,
            c.LogoUrl, c.PrimaryColor,
            c.Currency, c.Timezone, c.DateFormat, c.FiscalYearStartMonth,
            c.IsActive, c.IsDefault, c.SortOrder)));
    }

    /// <summary>
    /// Get a company by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(CompanyResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var company = await db.Companies.FindAsync(id);
        if (company is null)
            return NotFound(new { error = "Company not found" });

        return Ok(new CompanyResponse(
            company.Id, company.Code, company.Name, company.ShortName, company.TaxId,
            company.Address, company.City, company.State, company.ZipCode,
            company.Phone, company.Website, company.Email,
            company.LogoUrl, company.PrimaryColor,
            company.Currency, company.Timezone, company.DateFormat, company.FiscalYearStartMonth,
            company.IsActive, company.IsDefault, company.SortOrder));
    }

    /// <summary>
    /// Create a new company
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(CompanyResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] CreateCompanyRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "Code and Name are required" });

        if (ValidateCompanyFields(
                request.Code, request.Name, request.ShortName, request.TaxId, request.Address,
                request.City, request.State, request.ZipCode, request.Phone, request.Website,
                request.Email, request.Currency, request.Timezone, request.DateFormat,
                request.FiscalYearStartMonth, logoUrl: null, primaryColor: null) is { } createErr)
            return BadRequest(new { error = createErr, code = "VALIDATION_ERROR" });

        // Check for duplicate code within tenant
        var code = request.Code.Trim();
        var exists = await db.Companies.AnyAsync(c => c.Code == code);
        if (exists)
            return Conflict(new { error = $"A company with code '{code}' already exists" });

        var company = new Company
        {
            Code = code,
            Name = request.Name.Trim(),
            ShortName = request.ShortName?.Trim(),
            TaxId = request.TaxId?.Trim(),
            Address = request.Address?.Trim(),
            City = request.City?.Trim(),
            State = request.State?.Trim(),
            ZipCode = request.ZipCode?.Trim(),
            Phone = request.Phone?.Trim(),
            Website = request.Website?.Trim(),
            Email = request.Email?.Trim(),
            Currency = request.Currency ?? "USD",
            Timezone = request.Timezone ?? "America/Los_Angeles",
            DateFormat = request.DateFormat ?? "MM/dd/yyyy",
            FiscalYearStartMonth = request.FiscalYearStartMonth ?? 1,
            SortOrder = request.SortOrder ?? 0,
            IsActive = true,
            IsDefault = false
        };

        db.Companies.Add(company);
        await db.SaveChangesAsync();

        cacheService.Remove(CacheKeys.Companies);
        return CreatedAtAction(nameof(GetById), new { id = company.Id }, new CompanyResponse(
            company.Id, company.Code, company.Name, company.ShortName, company.TaxId,
            company.Address, company.City, company.State, company.ZipCode,
            company.Phone, company.Website, company.Email,
            company.LogoUrl, company.PrimaryColor,
            company.Currency, company.Timezone, company.DateFormat, company.FiscalYearStartMonth,
            company.IsActive, company.IsDefault, company.SortOrder));
    }

    /// <summary>
    /// Update a company
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(CompanyResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCompanyRequest request)
    {
        var company = await db.Companies.FindAsync(id);
        if (company is null)
            return NotFound(new { error = "Company not found" });

        if (ValidateCompanyFields(
                request.Code, request.Name, request.ShortName, request.TaxId, request.Address,
                request.City, request.State, request.ZipCode, request.Phone, request.Website,
                request.Email, request.Currency, request.Timezone, request.DateFormat,
                request.FiscalYearStartMonth, request.LogoUrl, request.PrimaryColor) is { } updateErr)
            return BadRequest(new { error = updateErr, code = "VALIDATION_ERROR" });

        if (!string.IsNullOrWhiteSpace(request.Code)) company.Code = request.Code.Trim();
        if (!string.IsNullOrWhiteSpace(request.Name)) company.Name = request.Name.Trim();
        company.ShortName = request.ShortName?.Trim();
        company.TaxId = request.TaxId?.Trim();
        company.Address = request.Address?.Trim();
        company.City = request.City?.Trim();
        company.State = request.State?.Trim();
        company.ZipCode = request.ZipCode?.Trim();
        company.Phone = request.Phone?.Trim();
        company.Website = request.Website?.Trim();
        company.Email = request.Email?.Trim();
        company.LogoUrl = request.LogoUrl?.Trim();
        company.PrimaryColor = request.PrimaryColor?.Trim();
        if (request.Currency != null) company.Currency = request.Currency;
        if (request.Timezone != null) company.Timezone = request.Timezone;
        if (request.DateFormat != null) company.DateFormat = request.DateFormat;
        if (request.FiscalYearStartMonth.HasValue) company.FiscalYearStartMonth = request.FiscalYearStartMonth.Value;
        if (request.SortOrder.HasValue) company.SortOrder = request.SortOrder.Value;
        if (request.IsActive.HasValue) company.IsActive = request.IsActive.Value;

        await db.SaveChangesAsync();

        cacheService.Remove(CacheKeys.Companies);
        return Ok(new CompanyResponse(
            company.Id, company.Code, company.Name, company.ShortName, company.TaxId,
            company.Address, company.City, company.State, company.ZipCode,
            company.Phone, company.Website, company.Email,
            company.LogoUrl, company.PrimaryColor,
            company.Currency, company.Timezone, company.DateFormat, company.FiscalYearStartMonth,
            company.IsActive, company.IsDefault, company.SortOrder));
    }

    /// <summary>
    /// Deactivate a company (soft delete)
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var company = await db.Companies.FindAsync(id);
        if (company is null)
            return NotFound(new { error = "Company not found" });

        if (company.IsDefault)
            return BadRequest(new { error = "Cannot delete the default company" });

        company.IsActive = false;
        await db.SaveChangesAsync();

        cacheService.Remove(CacheKeys.Companies);
        return NoContent();
    }

    /// <summary>
    /// List users with access to a company
    /// </summary>
    [HttpGet("{companyId:guid}/users")]
    [ProducesResponseType(typeof(List<CompanyUserResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListUsers(Guid companyId)
    {
        var users = await db.UserCompanyAccess
            .Where(uca => uca.CompanyId == companyId)
            .Include(uca => uca.User)
            .Select(uca => new CompanyUserResponse(
                uca.UserId,
                uca.User.Email!,
                uca.User.FullName,
                uca.CompanyRole,
                uca.IsDefault))
            .ToListAsync();

        return Ok(users);
    }

    /// <summary>
    /// Grant a user access to a company
    /// </summary>
    [HttpPost("{companyId:guid}/users")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> GrantAccess(Guid companyId, [FromBody] GrantCompanyAccessRequest request)
    {
        var exists = await db.UserCompanyAccess
            .AnyAsync(uca => uca.CompanyId == companyId && uca.UserId == request.UserId);

        if (exists)
            return Conflict(new { error = "User already has access to this company" });

        var access = new UserCompanyAccess
        {
            UserId = request.UserId,
            CompanyId = companyId,
            CompanyRole = request.CompanyRole,
            IsDefault = request.IsDefault
        };

        db.UserCompanyAccess.Add(access);
        await db.SaveChangesAsync();

        return Created("", new { message = "Access granted" });
    }

    /// <summary>
    /// Revoke a user's access to a company
    /// </summary>
    [HttpDelete("{companyId:guid}/users/{userId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RevokeAccess(Guid companyId, Guid userId)
    {
        var access = await db.UserCompanyAccess
            .FirstOrDefaultAsync(uca => uca.CompanyId == companyId && uca.UserId == userId);

        if (access is null)
            return NotFound(new { error = "Access record not found" });

        db.UserCompanyAccess.Remove(access);
        await db.SaveChangesAsync();

        return NoContent();
    }

    /// <summary>
    /// Bound free-text company fields (create/update). Null optional fields skip max-length checks.
    /// </summary>
    internal static string? ValidateCompanyFields(
        string? code,
        string? name,
        string? shortName,
        string? taxId,
        string? address,
        string? city,
        string? state,
        string? zipCode,
        string? phone,
        string? website,
        string? email,
        string? currency,
        string? timezone,
        string? dateFormat,
        int? fiscalYearStartMonth,
        string? logoUrl,
        string? primaryColor)
    {
        if (code is { Length: > 50 }) return "Code cannot exceed 50 characters";
        if (name is { Length: > 200 }) return "Name cannot exceed 200 characters";
        if (shortName is { Length: > 100 }) return "ShortName cannot exceed 100 characters";
        if (taxId is { Length: > 50 }) return "TaxId cannot exceed 50 characters";
        if (address is { Length: > 500 }) return "Address cannot exceed 500 characters";
        if (city is { Length: > 100 }) return "City cannot exceed 100 characters";
        if (state is { Length: > 50 }) return "State cannot exceed 50 characters";
        if (zipCode is { Length: > 20 }) return "ZipCode cannot exceed 20 characters";
        if (phone is { Length: > 50 }) return "Phone cannot exceed 50 characters";
        if (website is { Length: > 200 }) return "Website cannot exceed 200 characters";
        if (email is { Length: > 254 }) return "Email cannot exceed 254 characters";
        if (currency is { Length: > 10 }) return "Currency cannot exceed 10 characters";
        if (timezone is { Length: > 100 }) return "Timezone cannot exceed 100 characters";
        if (dateFormat is { Length: > 50 }) return "DateFormat cannot exceed 50 characters";
        if (logoUrl is { Length: > 2000 }) return "LogoUrl cannot exceed 2000 characters";
        if (primaryColor is { Length: > 20 }) return "PrimaryColor cannot exceed 20 characters";
        if (fiscalYearStartMonth is < 1 or > 12) return "FiscalYearStartMonth must be 1-12";
        return null;
    }
}

// ==========================================
// DTOs
// ==========================================

public record CompanyResponse(
    Guid Id,
    string Code,
    string Name,
    string? ShortName,
    string? TaxId,
    string? Address,
    string? City,
    string? State,
    string? ZipCode,
    string? Phone,
    string? Website,
    string? Email,
    string? LogoUrl,
    string? PrimaryColor,
    string Currency,
    string Timezone,
    string DateFormat,
    int FiscalYearStartMonth,
    bool IsActive,
    bool IsDefault,
    int SortOrder);

public record CreateCompanyRequest
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? ShortName { get; init; }
    public string? TaxId { get; init; }
    public string? Address { get; init; }
    public string? City { get; init; }
    public string? State { get; init; }
    public string? ZipCode { get; init; }
    public string? Phone { get; init; }
    public string? Website { get; init; }
    public string? Email { get; init; }
    public string? Currency { get; init; }
    public string? Timezone { get; init; }
    public string? DateFormat { get; init; }
    public int? FiscalYearStartMonth { get; init; }
    public int? SortOrder { get; init; }
}

public record UpdateCompanyRequest
{
    public string? Code { get; init; }
    public string? Name { get; init; }
    public string? ShortName { get; init; }
    public string? TaxId { get; init; }
    public string? Address { get; init; }
    public string? City { get; init; }
    public string? State { get; init; }
    public string? ZipCode { get; init; }
    public string? Phone { get; init; }
    public string? Website { get; init; }
    public string? Email { get; init; }
    public string? LogoUrl { get; init; }
    public string? PrimaryColor { get; init; }
    public string? Currency { get; init; }
    public string? Timezone { get; init; }
    public string? DateFormat { get; init; }
    public int? FiscalYearStartMonth { get; init; }
    public int? SortOrder { get; init; }
    public bool? IsActive { get; init; }
}

public record CompanySwitchResponse(
    string Token,
    CompanyResponse Company);

public record CompanyUserResponse(
    Guid UserId,
    string Email,
    string FullName,
    string? CompanyRole,
    bool IsDefault);

public record GrantCompanyAccessRequest(
    Guid UserId,
    string? CompanyRole = null,
    bool IsDefault = false);
