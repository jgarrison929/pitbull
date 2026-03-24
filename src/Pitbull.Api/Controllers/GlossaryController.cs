using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Construction industry glossary terms — mirrors the client-side glossary-data.ts
/// so AI agents and server-side code can reference the same terminology.
/// </summary>
[ApiController]
[Route("api/glossary")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Glossary")]
public class GlossaryController : ControllerBase
{
    /// <summary>
    /// List glossary terms, optionally filtered by category or search query.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(GlossaryResponse), StatusCodes.Status200OK)]
    public IActionResult GetTerms(
        [FromQuery] string? category = null,
        [FromQuery] string? search = null)
    {
        var terms = GlossaryData.Terms.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(category))
            terms = terms.Where(t => t.Category.Equals(category, StringComparison.OrdinalIgnoreCase));

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLowerInvariant();
            terms = terms.Where(t =>
                t.Term.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                t.Definition.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                (t.Aliases != null && t.Aliases.Any(a => a.Contains(q, StringComparison.OrdinalIgnoreCase))));
        }

        var list = terms.ToList();
        return Ok(new GlossaryResponse(list, list.Count));
    }

    /// <summary>
    /// Get a single term by ID.
    /// </summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(GlossaryTerm), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult GetById(string id)
    {
        var term = GlossaryData.Terms.FirstOrDefault(t => t.Id.Equals(id, StringComparison.OrdinalIgnoreCase));
        if (term is null)
            return NotFound(new { error = $"Term '{id}' not found" });

        return Ok(term);
    }
}

public record GlossaryTerm(
    string Id,
    string Term,
    string Definition,
    string Category,
    string[]? Aliases = null,
    string[]? RelatedTerms = null);

public record GlossaryResponse(IEnumerable<GlossaryTerm> Items, int Total);

/// <summary>
/// Static construction glossary — single source of truth for both API and client.
/// </summary>
internal static class GlossaryData
{
    public static readonly IReadOnlyList<GlossaryTerm> Terms = new[]
    {
        // Financial
        new GlossaryTerm("retainage", "Retainage", "A percentage of the contract amount (typically 5-10%) withheld from each progress payment until the project reaches substantial completion. Protects the owner against incomplete or defective work.", "financial", new[] { "Retention" }, new[] { "progress-billing", "substantial-completion" }),
        new GlossaryTerm("wip", "Work in Progress (WIP)", "An accounting schedule that compares the revenue earned on a project (based on percent complete) to the amount actually billed. Used to determine overbilling and underbilling positions for financial reporting.", "financial", new[] { "WIP Schedule", "WIP Report" }, new[] { "overbilling", "underbilling", "percent-complete" }),
        new GlossaryTerm("overbilling", "Overbilling", "When billings to the owner exceed the revenue earned based on percent complete. Appears as a liability (billings in excess of costs) on the WIP schedule.", "financial", new[] { "Billings in Excess", "Front-loading" }, new[] { "wip", "underbilling" }),
        new GlossaryTerm("underbilling", "Underbilling", "When revenue earned exceeds the amount billed to the owner. Appears as an asset (costs in excess of billings) on the WIP schedule.", "financial", new[] { "Costs in Excess" }, new[] { "wip", "overbilling" }),
        new GlossaryTerm("percent-complete", "Percent Complete Method", "Revenue recognition method that recognizes revenue proportional to the percentage of total estimated costs incurred. Required under ASC 606 for most construction contracts.", "financial", new[] { "POC", "Percentage of Completion" }, new[] { "wip", "estimated-cost-at-completion" }),
        new GlossaryTerm("estimated-cost-at-completion", "Estimated Cost at Completion (EAC)", "The total projected cost to complete a project, including costs already incurred plus estimated remaining costs.", "financial", new[] { "EAC", "Cost to Complete" }, new[] { "percent-complete", "wip" }),
        new GlossaryTerm("job-cost", "Job Costing", "Tracking all costs (labor, materials, equipment, subcontractor) against specific projects and cost codes.", "financial", new[] { "Project Costing" }, new[] { "cost-code", "budget-variance" }),
        new GlossaryTerm("journal-entry", "Journal Entry", "A record of a financial transaction in the general ledger.", "financial", null, new[] { "chart-of-accounts", "bank-reconciliation" }),
        new GlossaryTerm("bank-reconciliation", "Bank Reconciliation", "The process of matching transactions on a bank statement to journal entries in the general ledger.", "financial", new[] { "Bank Rec", "Statement Reconciliation" }, new[] { "journal-entry", "chart-of-accounts" }),
        new GlossaryTerm("chart-of-accounts", "Chart of Accounts", "The organized list of all general ledger accounts used by the company.", "financial", null, new[] { "journal-entry", "job-cost" }),
        new GlossaryTerm("budget-variance", "Budget Variance", "The difference between the budgeted cost and actual cost for a cost code or project.", "financial", null, new[] { "job-cost", "cost-code" }),
        // Billing
        new GlossaryTerm("aia-billing", "AIA Billing", "A standardized billing format using AIA forms G702 and G703. The industry standard for progress billing on commercial projects.", "billing", new[] { "AIA Pay Application" }, new[] { "g702", "g703", "sov" }),
        new GlossaryTerm("g702", "AIA G702", "Application and Certificate for Payment — the cover sheet summarizing total contract value, previous billings, current billing, retainage, and net amount due.", "billing", null, new[] { "g703", "aia-billing" }),
        new GlossaryTerm("g703", "AIA G703", "Continuation Sheet — the detailed line-item breakdown attached to the G702 showing each SOV item.", "billing", null, new[] { "g702", "sov" }),
        new GlossaryTerm("sov", "Schedule of Values (SOV)", "A line-item breakdown of a contract into individual work items with assigned dollar values. Used as the basis for progress billing.", "billing", new[] { "SOV" }, new[] { "aia-billing", "g703", "progress-billing" }),
        new GlossaryTerm("progress-billing", "Progress Billing", "Periodic billing (usually monthly) based on the percentage of work completed during the billing period.", "billing", new[] { "Progress Payment", "Draw Request" }, new[] { "sov", "retainage", "aia-billing" }),
        new GlossaryTerm("stored-materials", "Stored Materials", "Materials purchased and stored but not yet installed. Can be billed separately on AIA applications.", "billing", null, new[] { "g703", "progress-billing" }),
        new GlossaryTerm("pay-application", "Payment Application", "A formal request for payment submitted by the contractor to the owner.", "billing", new[] { "Pay App" }, new[] { "aia-billing", "lien-waiver" }),
        // Contracts
        new GlossaryTerm("change-order", "Change Order", "A formal modification to the original contract that changes the scope, price, or schedule.", "contracts", new[] { "CO", "Contract Modification" }, new[] { "contract-value", "scope-change" }),
        new GlossaryTerm("contract-value", "Contract Value", "The total agreed-upon price including the original contract amount plus all approved change orders.", "contracts", new[] { "Contract Sum", "Gross Contract Sum" }, new[] { "change-order", "sov" }),
        new GlossaryTerm("scope-change", "Scope Change", "Any modification to the originally defined work in the contract.", "contracts", null, new[] { "change-order" }),
        new GlossaryTerm("subcontract", "Subcontract", "An agreement between the general contractor and a specialty trade contractor to perform a specific portion of the work.", "contracts", new[] { "Sub Agreement" }, new[] { "change-order", "lien-waiver" }),
        new GlossaryTerm("purchase-order", "Purchase Order (PO)", "A formal document authorizing a vendor to supply materials or equipment at an agreed price.", "contracts", new[] { "PO" }, new[] { "committed-cost", "job-cost" }),
        new GlossaryTerm("committed-cost", "Committed Cost", "Costs that have been contractually obligated but not yet incurred.", "contracts", null, new[] { "purchase-order", "subcontract", "estimated-cost-at-completion" }),
        // Project Management
        new GlossaryTerm("rfi", "RFI (Request for Information)", "A formal process for requesting clarification on plans, specifications, or contract documents.", "project-management", new[] { "Request for Information" }, new[] { "submittal", "ball-in-court" }),
        new GlossaryTerm("submittal", "Submittal", "Shop drawings, product data, samples, or other documents submitted by the contractor for review and approval.", "project-management", null, new[] { "rfi", "ball-in-court" }),
        new GlossaryTerm("ball-in-court", "Ball-in-Court", "Indicates which party is currently responsible for action on an RFI, submittal, or other document.", "project-management", new[] { "BIC" }, new[] { "rfi", "submittal" }),
        new GlossaryTerm("daily-report", "Daily Report", "A log of daily construction activities including weather, workforce counts, equipment used, and work performed.", "project-management", new[] { "Daily Log" }, null),
        new GlossaryTerm("punch-list", "Punch List", "A list of incomplete or defective work items that must be corrected before final payment.", "project-management", new[] { "Snag List" }, new[] { "substantial-completion" }),
        new GlossaryTerm("substantial-completion", "Substantial Completion", "The stage when the work is sufficiently complete that the owner can occupy or use the building for its intended purpose.", "project-management", null, new[] { "retainage", "punch-list" }),
        new GlossaryTerm("cost-code", "Cost Code", "A numerical code used to categorize and track costs by type of work (e.g., 03-Concrete). Based on CSI MasterFormat divisions.", "project-management", new[] { "Phase Code" }, new[] { "job-cost", "budget-variance" }),
        // Compliance
        new GlossaryTerm("davis-bacon", "Davis-Bacon Act", "Federal law requiring contractors on federally funded projects to pay prevailing wages set by the DOL.", "compliance", new[] { "Prevailing Wage" }, new[] { "certified-payroll", "wh-347", "wage-determination" }),
        new GlossaryTerm("certified-payroll", "Certified Payroll", "A weekly payroll report (WH-347 form) required on Davis-Bacon projects.", "compliance", new[] { "WH-347" }, new[] { "davis-bacon", "wh-347", "wage-determination" }),
        new GlossaryTerm("wh-347", "WH-347 Form", "The Department of Labor's standard form for certified payroll reporting.", "compliance", null, new[] { "davis-bacon", "certified-payroll" }),
        new GlossaryTerm("wage-determination", "Wage Determination", "A DOL document listing minimum hourly wage rates and fringe benefits for each trade in a specific geographic area.", "compliance", new[] { "Wage Decision" }, new[] { "davis-bacon", "certified-payroll" }),
        new GlossaryTerm("lien-waiver", "Lien Waiver", "A legal document where a contractor, subcontractor, or supplier waives the right to file a mechanic's lien.", "compliance", new[] { "Waiver of Lien" }, new[] { "pay-application", "retainage" }),
        new GlossaryTerm("bonding", "Surety Bond", "A three-party guarantee that the contractor will perform the work and pay subcontractors/suppliers.", "compliance", new[] { "Performance Bond", "Payment Bond" }, null),
        new GlossaryTerm("insurance-certificate", "Certificate of Insurance (COI)", "A document proving that a contractor carries the required insurance coverage.", "compliance", new[] { "COI" }, null),
        // Field Operations
        new GlossaryTerm("crew-time-entry", "Crew Time Entry", "Batch time entry for an entire crew at once, typically done by the foreman at the end of the day.", "field-operations", null, new[] { "cost-code", "job-cost" }),
        new GlossaryTerm("equipment-rate", "Equipment Rate", "The hourly or daily charge rate for using a piece of equipment on a project.", "field-operations", new[] { "Equipment Charge Rate" }, null),
        new GlossaryTerm("mobilization", "Mobilization", "The process of moving personnel, equipment, and materials to a construction site to begin work.", "field-operations", new[] { "Mob" }, null),
        new GlossaryTerm("field-order", "Field Order", "A directive from the architect or owner's representative to proceed with minor changes in the field.", "field-operations", new[] { "Construction Directive" }, new[] { "change-order" }),
        new GlossaryTerm("safety-toolbox-talk", "Toolbox Talk", "A short, focused safety meeting held at the jobsite covering specific hazards or safe work practices.", "field-operations", new[] { "Safety Meeting", "Tailgate Meeting" }, null),
        new GlossaryTerm("as-built", "As-Built Drawings", "Drawings revised during construction to show the actual installed conditions.", "field-operations", new[] { "Record Drawings" }, new[] { "substantial-completion" }),
    };
}
