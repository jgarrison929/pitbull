using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("api")]
public class TenantsController(PitbullDbContext db) : ControllerBase
{
    /// <summary>
    /// Create a new tenant (organization).
    /// This is the first thing that happens when a company sets up Pitbull.
    /// </summary>
    [HttpPost]
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

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var tenant = await db.Tenants.FindAsync(id);
        if (tenant is null) return NotFound();

        return Ok(new TenantResponse(
            tenant.Id,
            tenant.Name,
            tenant.Slug,
            tenant.Status.ToString(),
            tenant.Plan.ToString()));
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var tenants = await db.Tenants
            .Where(t => t.Status == TenantStatus.Active)
            .Select(t => new TenantResponse(
                t.Id, t.Name, t.Slug, t.Status.ToString(), t.Plan.ToString()))
            .ToListAsync();

        return Ok(tenants);
    }
}

public record CreateTenantRequest(string Name);

public record TenantResponse(
    Guid Id,
    string Name,
    string Slug,
    string Status,
    string Plan);
