export interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  category: GlossaryCategory;
  aliases?: string[];
  relatedTerms?: string[];
}

export type GlossaryCategory =
  | "financial"
  | "billing"
  | "contracts"
  | "project-management"
  | "compliance"
  | "field-operations";

export const CATEGORY_LABELS: Record<GlossaryCategory, string> = {
  financial: "Financial",
  billing: "Billing",
  contracts: "Contracts",
  "project-management": "Project Management",
  compliance: "Compliance",
  "field-operations": "Field Operations",
};

export const glossaryTerms: GlossaryTerm[] = [
  { id: "retainage", term: "Retainage", definition: "A percentage of the contract amount (typically 5-10%) withheld from each progress payment until the project reaches substantial completion. Protects the owner against incomplete or defective work.", category: "financial", aliases: ["Retention"], relatedTerms: ["progress-billing", "substantial-completion"] },
  { id: "wip", term: "Work in Progress (WIP)", definition: "An accounting schedule that compares the revenue earned on a project (based on percent complete) to the amount actually billed. Used to determine overbilling and underbilling positions for financial reporting.", category: "financial", aliases: ["WIP Schedule", "WIP Report"], relatedTerms: ["overbilling", "underbilling", "percent-complete"] },
  { id: "overbilling", term: "Overbilling", definition: "When billings to the owner exceed the revenue earned based on percent complete. Appears as a liability (billings in excess of costs) on the WIP schedule. Common and expected in construction.", category: "financial", aliases: ["Billings in Excess", "Front-loading"], relatedTerms: ["wip", "underbilling"] },
  { id: "underbilling", term: "Underbilling", definition: "When revenue earned exceeds the amount billed to the owner. Appears as an asset (costs in excess of billings) on the WIP schedule. Can indicate cash flow issues if persistent.", category: "financial", aliases: ["Costs in Excess"], relatedTerms: ["wip", "overbilling"] },
  { id: "percent-complete", term: "Percent Complete Method", definition: "Revenue recognition method that recognizes revenue proportional to the percentage of total estimated costs incurred. Required under ASC 606 for most construction contracts.", category: "financial", aliases: ["POC", "Percentage of Completion"], relatedTerms: ["wip", "estimated-cost-at-completion"] },
  { id: "estimated-cost-at-completion", term: "Estimated Cost at Completion (EAC)", definition: "The total projected cost to complete a project, including costs already incurred plus estimated remaining costs. Drives the percent-complete calculation for WIP reporting.", category: "financial", aliases: ["EAC", "Cost to Complete"], relatedTerms: ["percent-complete", "wip"] },
  { id: "job-cost", term: "Job Costing", definition: "Tracking all costs (labor, materials, equipment, subcontractor) against specific projects and cost codes. The foundation of construction financial management.", category: "financial", aliases: ["Project Costing"], relatedTerms: ["cost-code", "budget-variance"] },
  { id: "journal-entry", term: "Journal Entry", definition: "A record of a financial transaction in the general ledger. In construction, commonly used for allocations, accruals, WIP adjustments, and corrections.", category: "financial", relatedTerms: ["chart-of-accounts"] },
  { id: "chart-of-accounts", term: "Chart of Accounts", definition: "The organized list of all general ledger accounts used by the company. In construction, typically structured around revenue, direct costs (by trade), overhead, and balance sheet accounts.", category: "financial", relatedTerms: ["journal-entry", "job-cost"] },
  { id: "budget-variance", term: "Budget Variance", definition: "The difference between the budgeted cost and actual cost for a cost code or project. Negative variance means over budget.", category: "financial", relatedTerms: ["job-cost", "cost-code"] },
  { id: "aia-billing", term: "AIA Billing", definition: "A standardized billing format developed by the American Institute of Architects. Uses forms G702 and G703. The industry standard for progress billing on commercial projects.", category: "billing", aliases: ["AIA Pay Application"], relatedTerms: ["g702", "g703", "sov"] },
  { id: "g702", term: "AIA G702", definition: "Application and Certificate for Payment \u2014 the cover sheet of an AIA billing that summarizes the total contract value, previous billings, current billing, retainage, and net amount due.", category: "billing", relatedTerms: ["g703", "aia-billing"] },
  { id: "g703", term: "AIA G703", definition: "Continuation Sheet \u2014 the detailed breakdown attached to the G702 showing each line item from the Schedule of Values.", category: "billing", relatedTerms: ["g702", "sov"] },
  { id: "sov", term: "Schedule of Values (SOV)", definition: "A line-item breakdown of a contract into individual work items with assigned dollar values. Used as the basis for progress billing.", category: "billing", aliases: ["SOV"], relatedTerms: ["aia-billing", "g703", "progress-billing"] },
  { id: "progress-billing", term: "Progress Billing", definition: "Periodic billing (usually monthly) based on the percentage of work completed during the billing period. The standard billing method for commercial construction.", category: "billing", aliases: ["Progress Payment", "Draw Request"], relatedTerms: ["sov", "retainage", "aia-billing"] },
  { id: "stored-materials", term: "Stored Materials", definition: "Materials purchased and stored but not yet installed. Can be billed separately on AIA applications.", category: "billing", relatedTerms: ["g703", "progress-billing"] },
  { id: "pay-application", term: "Payment Application", definition: "A formal request for payment submitted by the contractor to the owner. Includes AIA G702/G703 forms, lien waivers, and supporting documentation.", category: "billing", aliases: ["Pay App"], relatedTerms: ["aia-billing", "lien-waiver"] },
  { id: "change-order", term: "Change Order", definition: "A formal modification to the original contract that changes the scope, price, or schedule. Must be documented, priced, and approved by both parties.", category: "contracts", aliases: ["CO", "Contract Modification"], relatedTerms: ["contract-value", "scope-change"] },
  { id: "contract-value", term: "Contract Value", definition: "The total agreed-upon price for the construction work, including the original contract amount plus all approved change orders.", category: "contracts", aliases: ["Contract Sum", "Gross Contract Sum"], relatedTerms: ["change-order", "sov"] },
  { id: "scope-change", term: "Scope Change", definition: "Any modification to the originally defined work in the contract. Scope changes that affect cost or schedule should be documented as change orders.", category: "contracts", relatedTerms: ["change-order"] },
  { id: "subcontract", term: "Subcontract", definition: "An agreement between the general contractor and a specialty trade contractor to perform a specific portion of the work.", category: "contracts", aliases: ["Sub Agreement"], relatedTerms: ["change-order", "lien-waiver"] },
  { id: "purchase-order", term: "Purchase Order (PO)", definition: "A formal document authorizing a vendor to supply materials or equipment at an agreed price. Creates committed costs.", category: "contracts", aliases: ["PO"], relatedTerms: ["committed-cost", "job-cost"] },
  { id: "committed-cost", term: "Committed Cost", definition: "Costs that have been contractually obligated (via subcontracts or purchase orders) but not yet incurred.", category: "contracts", relatedTerms: ["purchase-order", "subcontract", "estimated-cost-at-completion"] },
  { id: "rfi", term: "RFI (Request for Information)", definition: "A formal process for requesting clarification on plans, specifications, or contract documents. Creates a documented paper trail.", category: "project-management", aliases: ["Request for Information"], relatedTerms: ["submittal", "ball-in-court"] },
  { id: "submittal", term: "Submittal", definition: "Shop drawings, product data, samples, or other documents submitted by the contractor for review and approval before fabrication or installation.", category: "project-management", relatedTerms: ["rfi", "ball-in-court"] },
  { id: "ball-in-court", term: "Ball-in-Court", definition: "Indicates which party is currently responsible for action on an RFI, submittal, or other document.", category: "project-management", aliases: ["BIC"], relatedTerms: ["rfi", "submittal"] },
  { id: "daily-report", term: "Daily Report", definition: "A log of daily construction activities including weather, workforce counts, equipment used, work performed, visitors, and any delays or issues.", category: "project-management", aliases: ["Daily Log"], relatedTerms: [] },
  { id: "punch-list", term: "Punch List", definition: "A list of incomplete or defective work items that must be corrected before final payment.", category: "project-management", aliases: ["Snag List"], relatedTerms: ["substantial-completion"] },
  { id: "substantial-completion", term: "Substantial Completion", definition: "The stage when the work is sufficiently complete that the owner can occupy or use the building for its intended purpose.", category: "project-management", relatedTerms: ["retainage", "punch-list"] },
  { id: "cost-code", term: "Cost Code", definition: "A numerical code used to categorize and track costs by type of work (e.g., 03-Concrete, 09-Finishes). Based on CSI MasterFormat divisions.", category: "project-management", aliases: ["Phase Code"], relatedTerms: ["job-cost", "budget-variance"] },
  { id: "davis-bacon", term: "Davis-Bacon Act", definition: "Federal law requiring contractors on federally funded projects to pay prevailing wages set by the DOL.", category: "compliance", aliases: ["Prevailing Wage"], relatedTerms: ["certified-payroll", "wh-347", "wage-determination"] },
  { id: "certified-payroll", term: "Certified Payroll", definition: "A weekly payroll report (WH-347 form) required on Davis-Bacon projects. Lists each worker's name, classification, hours worked, rate of pay, and gross amount.", category: "compliance", aliases: ["WH-347"], relatedTerms: ["davis-bacon", "wh-347", "wage-determination"] },
  { id: "wh-347", term: "WH-347 Form", definition: "The Department of Labor's standard form for certified payroll reporting. Required weekly on all Davis-Bacon projects.", category: "compliance", relatedTerms: ["davis-bacon", "certified-payroll"] },
  { id: "wage-determination", term: "Wage Determination", definition: "A DOL document listing the minimum hourly wage rates and fringe benefits for each trade/classification in a specific geographic area.", category: "compliance", aliases: ["Wage Decision"], relatedTerms: ["davis-bacon", "certified-payroll"] },
  { id: "lien-waiver", term: "Lien Waiver", definition: "A legal document where a contractor, subcontractor, or supplier waives the right to file a mechanic's lien for payment received.", category: "compliance", aliases: ["Waiver of Lien"], relatedTerms: ["pay-application", "retainage"] },
  { id: "bonding", term: "Surety Bond", definition: "A three-party guarantee (principal, obligee, surety) that the contractor will perform the work and pay subcontractors/suppliers.", category: "compliance", aliases: ["Performance Bond", "Payment Bond"] },
  { id: "insurance-certificate", term: "Certificate of Insurance (COI)", definition: "A document proving that a contractor carries the required insurance coverage.", category: "compliance", aliases: ["COI"] },
  { id: "crew-time-entry", term: "Crew Time Entry", definition: "Batch time entry for an entire crew at once, typically done by the foreman or superintendent at the end of the day.", category: "field-operations", relatedTerms: ["cost-code", "job-cost"] },
  { id: "equipment-rate", term: "Equipment Rate", definition: "The hourly or daily charge rate for using a piece of equipment on a project.", category: "field-operations", aliases: ["Equipment Charge Rate"] },
  { id: "mobilization", term: "Mobilization", definition: "The process of moving personnel, equipment, and materials to a construction site to begin work.", category: "field-operations", aliases: ["Mob"] },
  { id: "field-order", term: "Field Order", definition: "A directive from the architect or owner's representative to the contractor to proceed with minor changes in the field.", category: "field-operations", aliases: ["Construction Directive"], relatedTerms: ["change-order"] },
  { id: "safety-toolbox-talk", term: "Toolbox Talk", definition: "A short, focused safety meeting held at the jobsite covering specific hazards, safe work practices, or incident reviews.", category: "field-operations", aliases: ["Safety Meeting", "Tailgate Meeting"] },
  { id: "as-built", term: "As-Built Drawings", definition: "Drawings revised during construction to show the actual installed conditions, including any deviations from the original design.", category: "field-operations", aliases: ["Record Drawings"], relatedTerms: ["substantial-completion"] },
];

export const PAGE_GLOSSARY_MAP: Record<string, string[]> = {
  "/": ["job-cost", "wip", "rfi", "budget-variance"],
  "/projects": ["job-cost", "cost-code", "budget-variance", "substantial-completion"],
  "/time-tracking": ["crew-time-entry", "cost-code", "job-cost"],
  "/time-tracking/crew-entry": ["crew-time-entry", "cost-code", "daily-report"],
  "/time-tracking/approval": ["crew-time-entry"],
  "/employees": ["davis-bacon", "wage-determination", "certified-payroll"],
  "/cost-codes": ["cost-code", "job-cost"],
  "/equipment": ["equipment-rate", "mobilization"],
  "/accounting/journal-entries": ["journal-entry", "chart-of-accounts"],
  "/accounting/periods": ["wip", "percent-complete"],
  "/accounting/wip": ["wip", "overbilling", "underbilling", "percent-complete", "estimated-cost-at-completion"],
  "/accounting/retention": ["retainage", "substantial-completion"],
  "/accounting/lien-waivers": ["lien-waiver", "pay-application"],
  "/chart-of-accounts": ["chart-of-accounts", "journal-entry"],
  "/billing/contracts": ["contract-value", "sov", "change-order"],
  "/billing/applications": ["aia-billing", "g702", "g703", "progress-billing", "stored-materials"],
  "/billing/aging": ["pay-application", "retainage"],
  "/payment-applications": ["pay-application", "aia-billing", "g702", "g703", "lien-waiver"],
  "/bids": ["bonding"],
  "/contracts": ["subcontract", "change-order", "contract-value"],
  "/change-orders": ["change-order", "scope-change", "contract-value"],
  "/payroll/runs": ["davis-bacon", "certified-payroll", "wage-determination"],
  "/payroll/certified": ["certified-payroll", "wh-347", "davis-bacon"],
  "/payroll/wage-determinations": ["wage-determination", "davis-bacon"],
  "/procurement/purchase-orders": ["purchase-order", "committed-cost"],
  "/procurement/invoices": ["purchase-order", "committed-cost"],
  "/vendors": ["subcontract", "lien-waiver", "insurance-certificate"],
};

export function getTermsForRoute(pathname: string): GlossaryTerm[] {
  const termIds = PAGE_GLOSSARY_MAP[pathname];
  if (termIds) {
    return termIds.map((id) => glossaryTerms.find((t) => t.id === id)).filter((t): t is GlossaryTerm => t !== undefined);
  }
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length >= 3 && segments[0] === "projects") {
    const suffix = "/" + segments.slice(2).join("/");
    const routeKey = Object.keys(PAGE_GLOSSARY_MAP).find((k) => k.endsWith(suffix));
    if (routeKey) {
      return PAGE_GLOSSARY_MAP[routeKey].map((id) => glossaryTerms.find((t) => t.id === id)).filter((t): t is GlossaryTerm => t !== undefined);
    }
  }
  return [];
}

export function searchGlossaryTerms(query: string): GlossaryTerm[] {
  const q = query.toLowerCase().trim();
  if (!q) return glossaryTerms;
  return glossaryTerms.filter(
    (t) => t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q) || t.aliases?.some((a) => a.toLowerCase().includes(q)) || t.id.includes(q)
  );
}

export function getTermById(id: string): GlossaryTerm | undefined {
  return glossaryTerms.find((t) => t.id === id);
}

export function getTermsByCategory(category: GlossaryCategory): GlossaryTerm[] {
  return glossaryTerms.filter((t) => t.category === category);
}
