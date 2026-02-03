using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Manage tenants (organizations). Each tenant is an isolated workspace
/// with its own projects, bids, and users. All endpoints require authentication.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Tenants")]
public class TenantsController(PitbullDbContext db, ITenantContext tenantContext) : ControllerBase
{
    /// <summary>
    /// Create a new tenant (organization)
    /// </summary>
    /// <remarks>
    /// Creates a new tenant/organization. A URL-friendly slug is auto-generated from the name.
    /// This is typically the first step when a new company onboards to Pitbull.
    ///
    /// Sample request:
    ///
    ///     POST /api/tenants
    ///     {
    ///         "name": "Acme Construction LLC"
    ///     }
    ///
    /// </remarks>
    /// <param name="request">Tenant name</param>
    /// <returns>The newly created tenant</returns>
    /// <response code="201">Tenant created successfully</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="409">A tenant with this name already exists</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpPost]
    [ProducesResponseType(typeof(TenantResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Create([FromBody] CreateTenantRequest request)
    {
        var slug = request.Name.ToLowerInvariant()
            .Replace(" ", "-")
            .Replace("'", "");

        if (await db.Tenants.AnyAsync(t => t.Slug == slug))
            return Conflict(new { error = "A tenant with this name already exists" });

        var tenant = new Tenant
        {
            Name = request.Name,
            Slug = slug,
            Plan = TenantPlan.Standard
        };

        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = tenant.Id }, new TenantResponse(
            tenant.Id,
            tenant.Name,
            tenant.Slug,
            tenant.Status.ToString(),
            tenant.Plan.ToString()));
    }

    /// <summary>
    /// Get a tenant by ID (must be user's own tenant)
    /// </summary>
    /// <param name="id">Tenant unique identifier</param>
    /// <returns>Tenant details if accessible to current user</returns>
    /// <response code="200">Tenant found</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Tenant not found or access denied</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(TenantResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetById(Guid id)
    {
        // Security: Only allow access to user's own tenant
        if (id != tenantContext.TenantId)
            return NotFound(new { error = "Tenant not found" }); // Don't reveal it exists

        var tenant = await db.Tenants
            .Where(t => t.Id == id && t.Status == TenantStatus.Active)
            .FirstOrDefaultAsync();

        if (tenant is null) 
            return NotFound(new { error = "Tenant not found" });

        return Ok(new TenantResponse(
            tenant.Id,
            tenant.Name,
            tenant.Slug,
            tenant.Status.ToString(),
            tenant.Plan.ToString()));
    }

    /// <summary>
    /// Get current user's tenant information
    /// </summary>
    /// <remarks>
    /// Returns the tenant information for the authenticated user's organization.
    /// Each user can only see their own tenant details for security/isolation.
    /// </remarks>
    /// <returns>Current user's tenant information</returns>
    /// <response code="200">Returns current tenant</response>
    /// <response code="401">Not authenticated</response>
    /// <response code="404">Tenant not found</response>
    /// <response code="429">Rate limit exceeded</response>
    [HttpGet]
    [ProducesResponseType(typeof(TenantResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetCurrent()
    {
        // Only return the current user's tenant for security/isolation
        var tenant = await db.Tenants
            .Where(t => t.Id == tenantContext.TenantId && t.Status == TenantStatus.Active)
            .FirstOrDefaultAsync();

        if (tenant is null) 
            return NotFound(new { error = "Tenant not found or inactive" });

        return Ok(new TenantResponse(
            tenant.Id,
            tenant.Name,
            tenant.Slug,
            tenant.Status.ToString(),
            tenant.Plan.ToString()));
    }
}

/// <summary>
/// Request to create a new tenant
/// </summary>
/// <param name="Name">Organization/company name</param>
public record CreateTenantRequest(string Name);

/// <summary>
/// Tenant details response
/// </summary>
/// <param name="Id">Tenant unique identifier</param>
/// <param name="Name">Organization name</param>
/// <param name="Slug">URL-friendly identifier</param>
/// <param name="Status">Tenant status (Active, Suspended, Deactivated)</param>
/// <param name="Plan">Subscription plan (Trial, Standard, Professional, Enterprise)</param>
public record TenantResponse(
    Guid Id,
    string Name,
    string Slug,
    string Status,
    string Plan);
