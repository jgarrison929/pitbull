using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.Bids.Domain;
using Pitbull.Contracts.Domain;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.RFIs.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Unified search across all entity types.
/// Global query filters handle tenant isolation and soft deletes automatically.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Search")]
public class SearchController(PitbullDbContext db) : ControllerBase
{
    /// <summary>
    /// Search across projects, employees, contracts, bids, RFIs, and cost codes
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(SearchResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Search([FromQuery] string? q, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
            return Ok(new SearchResponse([], 0));

        var term = q.Trim();
        var results = new List<SearchResultItem>();

        // Run all searches in parallel
        var projectsTask = SearchProjects(term, ct);
        var employeesTask = SearchEmployees(term, ct);
        var contractsTask = SearchContracts(term, ct);
        var bidsTask = SearchBids(term, ct);
        var rfisTask = SearchRfis(term, ct);
        var costCodesTask = SearchCostCodes(term, ct);

        await Task.WhenAll(projectsTask, employeesTask, contractsTask, bidsTask, rfisTask, costCodesTask);

        results.AddRange(await projectsTask);
        results.AddRange(await employeesTask);
        results.AddRange(await contractsTask);
        results.AddRange(await bidsTask);
        results.AddRange(await rfisTask);
        results.AddRange(await costCodesTask);

        var totalCount = results.Count;
        var limited = results.Take(50).ToList();

        return Ok(new SearchResponse(limited, totalCount));
    }

    private async Task<List<SearchResultItem>> SearchProjects(string term, CancellationToken ct)
    {
        return await db.Set<Project>()
            .AsNoTracking()
            .Where(p => p.Name.Contains(term) || p.Number.Contains(term))
            .OrderByDescending(p => p.CreatedAt)
            .Take(20)
            .Select(p => new SearchResultItem("project", p.Id, p.Name, p.Number, $"/projects/{p.Id}"))
            .ToListAsync(ct);
    }

    private async Task<List<SearchResultItem>> SearchEmployees(string term, CancellationToken ct)
    {
        return await db.Set<Employee>()
            .AsNoTracking()
            .Where(e => e.FirstName.Contains(term) || e.LastName.Contains(term)
                        || e.EmployeeNumber.Contains(term))
            .OrderByDescending(e => e.CreatedAt)
            .Take(20)
            .Select(e => new SearchResultItem("employee", e.Id, e.FirstName + " " + e.LastName, e.Title ?? e.EmployeeNumber, $"/employees/{e.Id}"))
            .ToListAsync(ct);
    }

    private async Task<List<SearchResultItem>> SearchContracts(string term, CancellationToken ct)
    {
        return await db.Set<Subcontract>()
            .AsNoTracking()
            .Where(c => c.SubcontractorName.Contains(term) || c.SubcontractNumber.Contains(term))
            .OrderByDescending(c => c.CreatedAt)
            .Take(20)
            .Select(c => new SearchResultItem("contract", c.Id, c.SubcontractorName, c.SubcontractNumber, $"/contracts/{c.Id}"))
            .ToListAsync(ct);
    }

    private async Task<List<SearchResultItem>> SearchBids(string term, CancellationToken ct)
    {
        return await db.Set<Bid>()
            .AsNoTracking()
            .Where(b => b.Name.Contains(term) || b.Number.Contains(term))
            .OrderByDescending(b => b.CreatedAt)
            .Take(20)
            .Select(b => new SearchResultItem("bid", b.Id, b.Name, b.Number, $"/bids/{b.Id}"))
            .ToListAsync(ct);
    }

    private async Task<List<SearchResultItem>> SearchRfis(string term, CancellationToken ct)
    {
        var rfis = await db.Set<Rfi>()
            .AsNoTracking()
            .Where(r => r.Subject.Contains(term))
            .OrderByDescending(r => r.CreatedAt)
            .Take(20)
            .Select(r => new { r.Id, r.Subject, r.Number })
            .ToListAsync(ct);

        return rfis.Select(r =>
            new SearchResultItem("rfi", r.Id, r.Subject, $"RFI #{r.Number:D3}", $"/rfis/{r.Id}")
        ).ToList();
    }

    private async Task<List<SearchResultItem>> SearchCostCodes(string term, CancellationToken ct)
    {
        return await db.Set<CostCode>()
            .AsNoTracking()
            .Where(c => c.Code.Contains(term) || c.Description.Contains(term))
            .OrderByDescending(c => c.CreatedAt)
            .Take(20)
            .Select(c => new SearchResultItem("costcode", c.Id, c.Code, c.Description, $"/cost-codes/{c.Id}"))
            .ToListAsync(ct);
    }
}

public record SearchResultItem(
    string Type,
    Guid Id,
    string Title,
    string Subtitle,
    string Url);

public record SearchResponse(
    List<SearchResultItem> Results,
    int TotalCount);
