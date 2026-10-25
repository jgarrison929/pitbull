using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.Api.Attributes;
using Pitbull.Api.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.Features.CostCode;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Cost codes for job cost accounting and labor tracking.
/// Cost codes categorize labor by type of work (concrete, framing, electrical, etc.)
/// and are used to track costs against project budgets.
/// </summary>
[ApiController]
[Route("api/cost-codes")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Cost Codes")]
public class CostCodesController(ICostCodeService costCodeService, PitbullDbContext db, ICacheService cacheService) : ControllerBase
{
    /// <summary>
    /// List cost codes with optional filtering
    /// </summary>
    [HttpGet]
    [Cacheable(DurationSeconds = 300)]
    [ProducesResponseType(typeof(ListCostCodesResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> List(
        [FromQuery] CostType? costType,
        [FromQuery] bool? isActive,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100)
    {
        // Cache only unfiltered default queries (dropdown-style "get all")
        var isDefaultQuery = costType is null && isActive is null
            && string.IsNullOrEmpty(search) && page == 1 && pageSize == 100;

        if (isDefaultQuery)
        {
            var cached = await cacheService.GetOrCreateAsync(
                CacheKeys.CostCodes,
                async () =>
                {
                    var q = new ListCostCodesQuery(null, null, null, 1, 100);
                    return await costCodeService.ListCostCodesAsync(q);
                },
                CacheDurations.ReferenceData);

            if (!cached.IsSuccess)
                return BadRequest(new { error = cached.Error });

            return Ok(cached.Value);
        }

        var query = new ListCostCodesQuery(costType, isActive, search, page, pageSize);
        var result = await costCodeService.ListCostCodesAsync(query);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    /// <summary>
    /// Get a specific cost code by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(CostCodeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await costCodeService.GetCostCodeAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    /// <summary>
    /// Create a new cost code
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(CostCodeDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Create([FromBody] CreateCostCodeRequest request)
    {
        var command = new CreateCostCodeCommand(
            Code: request.Code,
            Description: request.Description,
            Division: request.Division,
            CostType: request.CostType,
            IsActive: request.IsActive
        );

        var result = await costCodeService.CreateCostCodeAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        cacheService.Remove(CacheKeys.CostCodes);
        return CreatedAtAction(nameof(GetById),
            new { id = result.Value!.Id }, result.Value);
    }

    /// <summary>
    /// Update an existing cost code
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(CostCodeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCostCodeRequest request)
    {
        var command = new UpdateCostCodeCommand(
            CostCodeId: id,
            Code: request.Code,
            Description: request.Description,
            Division: request.Division,
            CostType: request.CostType,
            IsActive: request.IsActive
        );

        var result = await costCodeService.UpdateCostCodeAsync(command);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error }),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }

        cacheService.Remove(CacheKeys.CostCodes);
        return Ok(result.Value);
    }

    /// <summary>
    /// Delete (soft delete) a cost code
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await costCodeService.DeleteCostCodeAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });

        cacheService.Remove(CacheKeys.CostCodes);
        return NoContent();
    }
    /// <summary>
    /// Seed standard CSI MasterFormat division codes (Admin only).
    /// Creates 16 divisions with common sub-codes for new tenants.
    /// </summary>
    [HttpPost("seed-csi")]
    [Authorize(Policy = "Admin.DataImport")]
    [ProducesResponseType(typeof(object), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SeedCsi()
    {
        var existingCount = await db.Set<CostCode>()
            .CountAsync();

        if (existingCount > 0)
            return Conflict(new { error = "Cost codes already exist. Delete existing codes first or use CSV import to merge.", code = "ALREADY_EXISTS" });

        var codes = CsiCostCodeData.GetStandardCodes();
        db.Set<CostCode>().AddRange(codes);
        await db.SaveChangesAsync();

        cacheService.Remove(CacheKeys.CostCodes);
        return StatusCode(StatusCodes.Status201Created, new { seeded = codes.Count });
    }
}

/// <summary>
/// Standard CSI MasterFormat 16-division cost code template
/// </summary>
public static class CsiCostCodeData
{
    public static List<CostCode> GetStandardCodes()
    {
        var codes = new List<CostCode>();

        void Add(string code, string description, string division, CostType costType)
        {
            codes.Add(new CostCode
            {
                Code = code,
                Description = description,
                Division = division,
                CostType = costType,
                IsActive = true,
                IsCompanyStandard = true,
            });
        }

        // Division 01 — General Requirements
        const string d01 = "01 - General Requirements";
        Add("01100", "Summary of Work", d01, CostType.Other);
        Add("01200", "Price & Payment Procedures", d01, CostType.Other);
        Add("01300", "Administrative Requirements", d01, CostType.Other);
        Add("01400", "Quality Requirements", d01, CostType.Other);
        Add("01500", "Temporary Facilities & Controls", d01, CostType.Other);
        Add("01600", "General Conditions / Overhead", d01, CostType.Overhead);

        // Division 02 — Site Construction
        const string d02 = "02 - Site Construction";
        Add("02100", "Site Remediation", d02, CostType.SubThirdParty);
        Add("02200", "Site Preparation", d02, CostType.Labor);
        Add("02300", "Earthwork", d02, CostType.Equipment);
        Add("02500", "Utility Services", d02, CostType.SubLabor);
        Add("02700", "Sewerage & Drainage", d02, CostType.SubLabor);

        // Division 03 — Concrete
        const string d03 = "03 - Concrete";
        Add("03100", "Concrete Forms & Accessories", d03, CostType.SubMaterial);
        Add("03200", "Concrete Reinforcement", d03, CostType.Material);
        Add("03300", "Cast-in-Place Concrete", d03, CostType.Labor);
        Add("03400", "Precast Concrete", d03, CostType.SubLabor);

        // Division 04 — Masonry
        const string d04 = "04 - Masonry";
        Add("04200", "Unit Masonry", d04, CostType.SubLabor);
        Add("04400", "Stone Assemblies", d04, CostType.SubLabor);
        Add("04500", "Refractories", d04, CostType.Material);

        // Division 05 — Metals
        const string d05 = "05 - Metals";
        Add("05100", "Structural Metal Framing", d05, CostType.SubLabor);
        Add("05200", "Metal Joists", d05, CostType.Material);
        Add("05300", "Metal Deck", d05, CostType.Material);
        Add("05500", "Metal Fabrications", d05, CostType.Subcontract);

        // Division 06 — Wood & Plastics
        const string d06 = "06 - Wood & Plastics";
        Add("06100", "Rough Carpentry", d06, CostType.Labor);
        Add("06200", "Finish Carpentry", d06, CostType.Labor);
        Add("06400", "Architectural Woodwork", d06, CostType.SubLabor);

        // Division 07 — Thermal & Moisture Protection
        const string d07 = "07 - Thermal & Moisture Protection";
        Add("07100", "Damproofing & Waterproofing", d07, CostType.SubLabor);
        Add("07200", "Thermal Insulation", d07, CostType.Material);
        Add("07300", "Shingles, Roof Tiles & Coverings", d07, CostType.SubLabor);
        Add("07400", "Roofing & Siding Panels", d07, CostType.SubLabor);
        Add("07900", "Joint Sealants", d07, CostType.Material);

        // Division 08 — Doors & Windows
        const string d08 = "08 - Doors & Windows";
        Add("08100", "Metal Doors & Frames", d08, CostType.Material);
        Add("08200", "Wood & Plastic Doors", d08, CostType.Material);
        Add("08400", "Entrances & Storefronts", d08, CostType.SubLabor);
        Add("08500", "Windows", d08, CostType.Material);
        Add("08700", "Hardware", d08, CostType.Material);

        // Division 09 — Finishes
        const string d09 = "09 - Finishes";
        Add("09200", "Plaster & Gypsum Board", d09, CostType.SubLabor);
        Add("09300", "Tile", d09, CostType.SubLabor);
        Add("09500", "Ceilings", d09, CostType.SubLabor);
        Add("09600", "Flooring", d09, CostType.SubLabor);
        Add("09900", "Paints & Coatings", d09, CostType.SubLabor);

        // Division 10 — Specialties
        const string d10 = "10 - Specialties";
        Add("10100", "Visual Display Boards", d10, CostType.Material);
        Add("10200", "Louvers & Vents", d10, CostType.Material);
        Add("10400", "Identification Devices", d10, CostType.Material);
        Add("10500", "Lockers", d10, CostType.Material);

        // Division 11 — Equipment
        const string d11 = "11 - Equipment";
        Add("11100", "Maintenance Equipment", d11, CostType.Equipment);
        Add("11400", "Foodservice Equipment", d11, CostType.Equipment);
        Add("11600", "Laboratory Equipment", d11, CostType.Equipment);

        // Division 12 — Furnishings
        const string d12 = "12 - Furnishings";
        Add("12300", "Manufactured Casework", d12, CostType.SubLabor);
        Add("12500", "Furniture", d12, CostType.Material);
        Add("12600", "Multiple Seating", d12, CostType.Material);

        // Division 13 — Special Construction
        const string d13 = "13 - Special Construction";
        Add("13100", "Lightning Protection", d13, CostType.SubLabor);
        Add("13200", "Pre-Engineered Structures", d13, CostType.SubLabor);
        Add("13800", "Building Automation & Control", d13, CostType.SubLabor);

        // Division 14 — Conveying Systems
        const string d14 = "14 - Conveying Systems";
        Add("14100", "Dumbwaiters", d14, CostType.SubLabor);
        Add("14200", "Elevators", d14, CostType.SubLabor);
        Add("14300", "Escalators & Moving Walks", d14, CostType.SubLabor);

        // Division 15 — Mechanical
        const string d15 = "15 - Mechanical";
        Add("15100", "Building Services Piping", d15, CostType.SubLabor);
        Add("15300", "Fire Protection", d15, CostType.SubLabor);
        Add("15400", "Plumbing", d15, CostType.SubLabor);
        Add("15500", "HVAC", d15, CostType.SubLabor);
        Add("15800", "HVAC Air Distribution", d15, CostType.SubLabor);

        // Division 16 — Electrical
        const string d16 = "16 - Electrical";
        Add("16100", "Wiring Methods", d16, CostType.SubLabor);
        Add("16200", "Electrical Power", d16, CostType.SubLabor);
        Add("16400", "Low-Voltage Distribution", d16, CostType.SubLabor);
        Add("16500", "Lighting", d16, CostType.SubLabor);
        Add("16700", "Communications", d16, CostType.SubLabor);

        return codes;
    }
}

public record CreateCostCodeRequest(
    string Code,
    string Description,
    string? Division = null,
    CostType CostType = CostType.Labor,
    bool IsActive = true
);

public record UpdateCostCodeRequest(
    string? Code = null,
    string? Description = null,
    string? Division = null,
    CostType? CostType = null,
    bool? IsActive = null
);
