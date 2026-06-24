# PDF Report Engine — Design Spec (HISTORICAL)

> **Status:** Core reports implemented in 0.15.0 (WIP Schedule, AR Aging, Project Cost, Submittal Log, Punch List, plus others)
> **Note:** This is historical design spec. QuestPDF + specific reports (WIP, AR, etc.) delivered per CHANGELOG 0.15.0. Some reports listed here match shipped functionality (e.g. certified payroll WH-347). Refer to PdfReportService.cs and actual endpoints for current state. Design decisions around QuestPDF vs Puppeteer are reflected in the implementation.

**Implemented as of June 2026 (verified):**
- IPdfReportService / PdfReportService (src/Pitbull.Api/Services/PdfReportService.cs) using QuestPDF (Community license in Program.cs).
- Reports: GenerateWipSchedulePdfAsync, GenerateAgedArPdfAsync, GenerateProjectCostSummaryPdfAsync, GenerateRetentionSummaryPdfAsync, GenerateWh347PdfAsync (certified), GenerateSubmittalLogPdfAsync, GeneratePunchListPdfAsync.
- Matches doc priorities 1-5 + extras (Submittal, Punch).
- Endpoints in JobsController? or ReportsController for PDF (e.g. /reports/.../pdf ; also in ProjectManagementControllers for punch).
- Data assembly for WIP from WipReport/WipReportLine.
- CHANGELOG 0.15: "PDF reports — WIP Schedule, AR Aging, Project Cost, Submittal Log, Punch List".
- Also delivery tickets, etc. QuestPDF chosen (no Puppeteer).
Core + listed reports shipped. (Verify controller routes + any PDF tests; some like certified in Payroll features.)

## Context
The Sales VP identified PDF exports as the #2 priority. Construction controllers print 5-6 reports for Monday morning meetings. Banks and sureties request these documents. They're "leave-behind" docs that keep conversations going after demos.

## Reports to Build (Priority Order)

### 1. WIP Schedule Report
- Cost-to-cost method: Earned Revenue = (Costs-to-Date / Estimated-Total-Cost) × Contract-Value
- Columns: Project, Contract Value, Costs to Date, Est Total Cost, % Complete, Earned Revenue, Billings to Date, Over/Under Billing
- Summary totals at bottom
- Company header with logo placeholder

### 2. Aged Receivables (AR Aging)
- Buckets: Current, 1-30, 31-60, 61-90, 91-120, 120+
- Group by customer
- Show invoice number, date, amount, aging bucket
- Summary totals per bucket
- This is THE report every controller opens their day with

### 3. Project Cost Summary
- Per-project breakdown: Budget vs Actual vs Remaining by cost code
- Show % complete, variance, forecast at completion
- Include change orders impact
- Suitable for PM weekly review meetings

### 4. Retention Summary
- All projects with retention held/released
- Show: Project, Contract Value, Retention %, Retained Amount, Released, Balance
- Status indicators (Held/Partial/Released)
- Used by sureties and bonding companies

### 5. Certified Payroll (WH-347 Format)
- DOL-compliant format
- Employee name, classification, hours worked (ST/OT/DT), rate, gross pay, deductions, net pay
- Prevailing wage rate comparison
- Project/contractor header info
- THIS IS A LEGAL DOCUMENT — format matters

## Technical Approach

### Option A: QuestPDF (Recommended)
- MIT licensed, .NET native, fluent API
- No external dependencies (no Chrome/Puppeteer)
- Fast — generates PDFs in memory
- Good for structured reports with tables
- NuGet: `QuestPDF`

### Option B: Puppeteer/Playwright HTML-to-PDF
- More flexible for complex layouts
- Heavier dependency (headless browser)
- Slower generation

### Architecture
```
ReportController (per report type)
  → IReportService (generates data model)
    → IPdfGenerator (renders PDF from model)
      → QuestPDF document definition
        → byte[] PDF stream
```

### Endpoints
```
GET /api/reports/wip-schedule/pdf?companyId=...&asOfDate=...
GET /api/reports/ar-aging/pdf?companyId=...&asOfDate=...
GET /api/reports/project-cost/{projectId}/pdf
GET /api/reports/retention-summary/pdf?companyId=...
GET /api/reports/certified-payroll/{payrollRunId}/pdf
```

### Response
- Content-Type: application/pdf
- Content-Disposition: attachment; filename="WIP-Schedule-2026-02-21.pdf"
- Stream directly, don't save to disk

## Rules
- Every report needs a service that assembles the data model (reuse existing services where possible)
- PDF generation is a separate concern from data assembly
- Include company name, report date, page numbers
- Professional formatting — these go to banks and bonding companies
- Tests for the data assembly layer (not the PDF rendering)
- Mobile-friendly: reports should also have an on-screen HTML preview endpoint

## Phase 1 (This Sprint)
Build reports 1-3 (WIP, AR Aging, Project Cost). These are the highest-impact for demos.

## Phase 2 (Next Sprint)  
Build reports 4-5 (Retention, Certified Payroll). These are compliance-critical.
