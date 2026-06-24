# Accounts Receivable Clerk — Functional Role Reference

> **Audience:** AI agent teams building Pitbull Construction Solutions ERP
> **Last updated:** 2026-02-19

---

## 1. Role Description

The AR Clerk is the **revenue collection engine**. While the Project Manager creates the billing and the Controller recognizes the revenue, it's the AR Clerk who turns earned work into actual cash in the bank. In construction, accounts receivable is uniquely complex because:

- **Billing is not invoicing.** A construction company doesn't send simple invoices. It submits **payment applications** — highly structured, multi-page documents that show exactly what work was completed this period, cumulative to date, what retainage is held, and what's due. The industry-standard format is the **AIA G702/G703**, and deviating from it means delayed payment.
- **Progress billing against a Schedule of Values (SOV).** Each month, the PM updates percent complete on each line of the SOV. The AR Clerk assembles this into a formal payment application package — the G702 summary, G703 detail, supporting documentation (lien waivers from subs, daily reports, change order approvals), and a notarized cover letter.
- **Retention receivable is a massive asset.** On a $10M project at 10% retention, the company has $1M in retention receivable that won't be collected until project closeout. Tracking and billing retention at the right time is critical to cash flow.
- **Cash receipts require careful application.** When a $500K check arrives, it must be applied against the correct payment application, the correct project, and potentially split between current billing and past-due amounts. Misapplication corrupts the aging report and the WIP schedule.
- **Owner compliance requirements.** Many owners (especially public entities) have specific billing formats, required documentation, submission deadlines, and portal requirements. Miss the deadline = skip a billing cycle = 30+ days of delayed cash.

The AR Clerk ensures the company gets paid — accurately, completely, and on time.

### Design Principle

> **Predict what the user wants and offer it before they even know they want it.** When it's billing time, the system should present a pre-filled payment application based on PM-approved progress, with all supporting documents assembled. The AR Clerk reviews, adjusts, and submits — not builds from scratch.

---

## 2. Core Responsibilities

| Area | Description |
|------|-------------|
| **Payment Application Creation** | Assemble monthly payment applications (G702/G703 format) from PM-approved progress data. Calculate current billing, cumulative billing, retention, and amount due. |
| **Billing Package Assembly** | Compile the full billing package: G702, G703, conditional lien waivers (from the company), sub lien waivers, change order log, stored materials documentation. Different owners require different packages. |
| **Customer / Owner Setup** | Create and maintain customer master records: company name, billing address, contact information, payment terms, retention terms, billing format requirements, portal access. |
| **Cash Receipt Processing** | Apply incoming payments to the correct payment applications. Handle partial payments, retention payments, and discrepancies. |
| **AR Aging Management** | Monitor aging receivables, follow up on overdue billings, research payment discrepancies with owners, and escalate collection issues. |
| **Retention Billing** | Track retention receivable by project. At substantial completion, prepare retention billing — often a separate payment application with different documentation requirements (final lien waivers, closeout docs). |
| **Change Order Revenue Tracking** | Ensure approved change orders are incorporated into the SOV and reflected in the next payment application. Track pending change orders that have not yet been added to billings. |
| **Joint Check Processing** | In construction, owners sometimes issue joint checks (payable to GC and subcontractor). AR must track these and ensure proper endorsement and application. |
| **Backup Documentation** | Maintain billing support files: daily reports, inspection reports, material tickets, delivery receipts — anything the owner might request to substantiate the billing. |
| **Collections** | Follow up on unpaid billings, document collection efforts, support attorney/lien filings if necessary. |

---

## 3. Data Owned (Entities / Tables)

| Entity | Description | Key Fields |
|--------|-------------|------------|
| `Customer` | Customer/owner master record | CustomerId, CompanyName, BillingAddress, ContactName, ContactEmail, ContactPhone, PaymentTerms, DefaultRetentionPercent, BillingFormat (AIA/Custom), PortalURL, Status |
| `CustomerContract` | Contract association to customer | CustomerId, ProjectId, ContractType, OriginalAmount, RetentionTerms, BillingDeadlineDay, SpecialRequirements |
| `PaymentApplication` | Monthly billing to owner (G702) | PayAppId, ProjectId, CustomerId, AppNumber, PeriodThrough, BillingDate, OriginalContract, ApprovedChangeOrders, ContractToDate, TotalCompletedAndStored, RetainageToDate, TotalEarnedLessRetainage, LessPreviousCertificates, CurrentPaymentDue, BalanceToFinish, Status (Draft/Submitted/Approved/Paid/Disputed) |
| `PayAppLineItem` | SOV billing detail (G703) | PayAppId, SOVLineId, ItemNumber, Description, ScheduledValue, PreviousApplications, ThisPeriod, MaterialsPresentlyStored, TotalCompletedAndStored, PercentComplete, BalanceToFinish, RetainageAmount |
| `CashReceipt` | Incoming payments | ReceiptId, CustomerId, ReceiptDate, Amount, PaymentMethod (Check/ACH/Wire), ReferenceNumber, BankAccountId, DepositDate |
| `CashReceiptApplication` | Receipt-to-pay-app mapping | ReceiptId, PayAppId, AppliedAmount, RetentionApplied, DiscountTaken |
| `RetentionReceivable` | Retention tracking | ProjectId, CustomerId, OriginalRetention, BilledRetention, CollectedRetention, Balance, ExpectedReleaseDate, Status |
| `BillingPackage` | Assembled billing documents | PayAppId, DocumentType (G702/G703/LienWaiver/COLog/Support), DocumentId, GeneratedDate |
| `CustomerPortal` | Owner billing portal credentials | CustomerId, PortalName, URL, LoginInfo (encrypted), SubmissionFormat, DeadlineDay |
| `CollectionNote` | Collection activity log | CustomerId, PayAppId, NoteDate, ContactMethod, ContactPerson, Notes, FollowUpDate, CreatedBy |

---

## 4. Modules Used Daily

| Module | Usage |
|--------|-------|
| **Accounts Receivable** | Primary workspace. Billing creation, cash receipt entry, aging review, collections. |
| **Billing / Payment Applications** | Create and manage G702/G703 payment applications. |
| **Cash Receipts** | Apply incoming payments against billings. |
| **Project Management** | Review PM-approved SOV progress for billing preparation. |
| **Job Cost** | Verify that billing aligns with cost-to-date for WIP accuracy. |
| **Document Management** | Assemble and store billing packages, lien waivers, supporting documents. |
| **Banking** | Track deposits, match bank transactions to cash receipts. |
| **Reporting** | AR aging, cash flow forecast, retention summary, billing status. |

---

## 5. Dependencies on Other Roles

| Role | Dependency |
|------|-----------|
| **Project Manager** | PM provides SOV progress percentages that drive the billing. Without PM-approved progress, the AR Clerk cannot create a payment application. PM also manages change orders that alter the contract value and SOV. |
| **Controller/CFO** | Controller reviews billings for over/under billing exposure before submission. Controller uses billing data for WIP schedule and revenue recognition. |
| **AP Clerk** | AP provides sub lien waivers that AR includes in billing packages to the owner. AP's retention payable is the mirror of AR's retention receivable. |
| **Payroll Manager** | Payroll posts labor costs that, combined with other costs, inform the PM's progress assessment and the Controller's over/under billing analysis. |
| **System Admin** | Billing format configuration, customer setup, portal integration, document templates. |

---

## 6. Workflows

### Monthly Billing Cycle

```
Billing Calendar (typical — 25th of each month):

Day 1-20: PM updates SOV progress on active projects
│
Day 20-22: AR Billing Preparation
├── 1. Review PM-approved SOV progress for each project
│   └── AI: Flag projects with no progress update this period
├── 2. Review change orders — any new approved COs to add to SOV?
│   └── AI: Auto-detect approved COs not yet reflected in SOV
├── 3. Generate draft payment applications (G702/G703)
│   └── AI: Pre-fill from PM progress data. Calculate all amounts.
├── 4. Review each billing:
│   ├── Does this period's billing make sense vs. cost incurred?
│   ├── Are we overbilling? (flags WIP exposure)
│   ├── Is retention calculated correctly per contract terms?
│   ├── Are materials stored properly documented?
│   └── Does the billing format match owner requirements?
│
Day 22-24: Billing Package Assembly
├── 5. Generate G702 (Application and Certificate for Payment)
├── 6. Generate G703 (Continuation Sheet — SOV detail)
├── 7. Collect company's conditional lien waiver for this billing
├── 8. Collect sub lien waivers (coordinate with AP)
├── 9. Attach change order log
├── 10. Attach any required supporting documentation
├── 11. Generate notarized certification page (if required)
│   └── AI: Auto-assemble package per owner's documented requirements
│
Day 25: Submission
├── 12. Submit billing package to owner
│   ├── Via owner portal (auto-upload if supported)
│   ├── Via email
│   └── Via mail (if required)
├── 13. Record submission date and method
└── 14. Set follow-up reminder based on payment terms

Day 55-60 (Net 30): Payment Expected
├── 15. Monitor for incoming payment
├── 16. Apply cash receipt when received
└── 17. If no payment by due date: initiate collections workflow
```

### Cash Receipt Processing

```
Payment Received (check, ACH, wire)
│
├── 1. Identify customer and project
│   └── AI: Match by check remittance info, ACH reference, or amount
│
├── 2. Match to payment application(s)
│   ├── AI: Auto-match by amount to outstanding pay apps
│   ├── If exact match to one pay app → auto-apply
│   ├── If partial payment → route to AR Clerk for allocation
│   └── If overpayment or unidentifiable → hold in unapplied cash
│
├── 3. Handle retention
│   ├── If payment includes retention release → apply to retention receivable
│   └── If payment excludes retention → verify retainage matches contract terms
│
├── 4. Post cash receipt
│   ├── Debit: Cash (bank account)
│   ├── Credit: Accounts Receivable
│   └── If retention: Credit Retention Receivable
│
├── 5. Deposit to bank
│   └── Record deposit date, bank reference
│
└── 6. Update AR aging
```

### Retention Billing (Project Closeout)

```
Project Reaches Substantial Completion
│
├── 1. PM confirms substantial completion date
├── 2. Verify punch list is complete (or substantially complete)
├── 3. Collect all required closeout documents:
│   ├── Final lien waivers from all subcontractors (via AP)
│   ├── Warranty letters
│   ├── As-built drawings
│   ├── O&M manuals
│   └── Certificate of substantial completion
│
├── 4. Prepare retention billing
│   ├── Calculate total retention held
│   ├── Less any backcharges or disputed amounts
│   ├── Generate final payment application
│   └── Include all closeout documentation
│
├── 5. Submit retention billing to owner
│
├── 6. Track payment (retention is often slow — 60-90 days)
│   └── AI: Auto-generate follow-up reminders based on contract terms
│
└── 7. When collected: apply to retention receivable, close project AR
```

### Collections Workflow

```
Invoice Past Due
│
├── Day 1 past due: Automated reminder email to owner contact
├── Day 15 past due: AR Clerk phone call, document conversation
├── Day 30 past due: Escalate to PM for owner relationship follow-up
├── Day 45 past due: Escalate to Controller for management action
├── Day 60 past due: Formal demand letter
├── Day 90 past due: Evaluate lien rights and attorney referral
│   └── CRITICAL: Construction lien deadlines vary by state
│       (some as short as 60 days from last work)
│       AI: Track lien filing deadlines per state and project
│
└── Document every contact, promise-to-pay, and action taken
```

---

## 7. Key Reports

| Report | Frequency | Description |
|--------|-----------|-------------|
| **AR Aging** | Weekly | Outstanding receivables by customer and project, by aging bucket (Current, 30, 60, 90+). The primary collections tool. |
| **Billing Status Report** | Monthly | Every active project: last billing date, amount billed this period, total billed to date, remaining to bill, percent billed vs. percent complete. |
| **Cash Receipts Journal** | Daily/Weekly | All cash received, by customer and project, with application detail. |
| **Retention Receivable Summary** | Monthly | Total retention held by project, expected release date, closeout requirements status. Huge asset — often hundreds of thousands or millions. |
| **Cash Flow Forecast** | Weekly | Expected collections based on outstanding billings and historical payment patterns. Combined with AP cash requirements for net cash position. |
| **Over/Under Billing by Project** | Monthly | Percent billed vs. percent complete for each project. Overbilled projects are WIP liabilities; underbilled are WIP assets. Feeds Controller's WIP schedule. |
| **Billing Package Checklist** | Per billing | Status of each required document in the billing package, by project. What's complete, what's missing. |
| **Unapplied Cash** | Weekly | Cash received but not yet applied to specific payment applications. Should be zero — if not, investigate. |
| **Collections Activity Log** | Weekly | All collection contacts, promises to pay, escalations. Used for management review and legal support. |
| **Revenue by Project** | Monthly | Contract value, billed to date, collected to date, outstanding balance, retention — by project. |
| **Customer Payment History** | On demand | Full payment history by customer: billing dates, amounts, payment dates, days to pay. Shows payment patterns. |
| **AIA G702 Summary** | Per billing | The official payment application — the document submitted to the owner. |
| **AIA G703 Detail** | Per billing | The SOV continuation sheet showing every line item's progress. |

---

## 8. AI Agent Assistance Opportunities

### Billing Automation

- **Pre-filled payment applications:** AI takes PM-approved SOV progress, approved change orders, and stored materials data to generate a complete draft payment application. AR Clerk reviews and adjusts rather than building from scratch. Target: 80% of pay apps require no changes.
- **Billing package auto-assembly:** AI knows each owner's documentation requirements and automatically assembles the complete package — G702, G703, company lien waiver, sub lien waivers, CO log, support docs. Missing items are flagged with links to request them.
- **Overbilling detection:** AI compares billing progress to cost-to-date ratio and flags potential overbilling that could create WIP exposure. "Project 2024-015 is 85% billed but only 70% cost-to-date — review before submitting."
- **Billing deadline management:** AI tracks every project's billing deadline and owner submission requirements. Creates a billing calendar with automated reminders and escalations. "5 projects billing due in 3 days — 3 are complete, 2 need PM progress approval."
- **Change order incorporation:** When a CO is approved, AI automatically adds it to the SOV and adjusts the G702 contract amounts. AR Clerk verifies rather than manually updating.

### Cash Flow Intelligence

- **Payment prediction:** AI analyzes each customer's historical payment patterns (average days to pay, typical deductions, seasonal patterns) and predicts when each outstanding billing will be collected. "Owner XYZ typically pays in 42 days — expect $285K collection around March 15."
- **Cash flow forecasting:** Combines billing schedule, predicted collections, AP obligations, and payroll to project daily cash position 30/60/90 days out. Alerts Controller if cash shortfall is predicted.
- **Collection priority scoring:** AI ranks overdue accounts by: amount, days outstanding, lien deadline proximity, customer payment history, and project relationship value. AR Clerk focuses on the highest-impact collections first.
- **Retention release forecasting:** AI projects when retention will become billable based on project schedules and closeout status. "3 projects expected to reach substantial completion in Q2 — $780K in retention will become billable."

### Cash Receipt Automation

- **Auto-match incoming payments:** AI matches bank deposits to outstanding payment applications by amount, customer, and reference number. Exact matches are auto-applied; partial matches are presented with suggested allocations.
- **Remittance processing:** AI reads remittance advices (from email, portal, or bank lockbox) and applies payments to the correct pay apps line by line. Handles deductions for retention, backcharges, and disputed items.
- **Unapplied cash resolution:** When cash can't be matched, AI suggests likely applications based on customer, amount, and timing patterns. Escalates truly unidentifiable payments.

### Document Intelligence

- **G702/G703 generation:** AI generates print-ready AIA-format payment applications directly from system data. Handles the complex math: original contract + change orders = contract to date, prior billing + this period = cumulative, cumulative × retention % = retainage.
- **Owner portal integration:** For owners with billing portals, AI auto-formats and uploads billing packages in the required format. Tracks submission confirmation.
- **Lien waiver coordination:** AI generates the company's conditional lien waiver for each billing period and coordinates with AP to collect sub lien waivers. Builds the complete waiver package for the billing submission.

---

## 9. Pain Points in Vista / Legacy Systems That Pitbull Solves

| Vista / Legacy Pain | Pitbull Solution |
|---------------------|-----------------|
| **G702/G703 is created in Excel.** Even in Vista, most AR clerks export SOV data, build the pay app in Excel, submit the Excel/PDF to the owner, then manually enter the billing back into Vista. Double work. | **Native G702/G703 generation** from live SOV data. One workflow: review progress → generate pay app → submit to owner → post to AR. No Excel. No double entry. |
| **Billing package assembly is manual.** Collecting lien waivers, CO logs, support docs, and assembling them into a PDF package takes hours per project. | **Automated package assembly.** System knows owner's requirements, collects documents from the document vault, flags missing items, and generates the complete package. |
| **Cash receipt application is tedious.** Vista's cash receipt entry requires manual lookup of the customer, the pay app, and line-by-line application. | **Smart cash receipt matching.** AI matches incoming payments to pay apps automatically. AR Clerk confirms matches instead of building them. |
| **Retention tracking is a spreadsheet.** Vista tracks retention in the system but the reporting is inadequate. Most AR departments maintain a separate retention tracker. | **First-class retention management.** Retention receivable by project, with expected release dates, closeout requirements tracking, and automated billing at substantial completion. |
| **No billing calendar.** AR clerks maintain their own calendars/spreadsheets for billing deadlines by project. Miss a deadline = miss a billing cycle = cash flow hit. | **System-managed billing calendar** with automated reminders, deadline tracking, and escalation. |
| **Collections are informal.** Collection calls and notes are tracked in email threads, spreadsheets, or memory. No systematic follow-up. | **Integrated collections workflow** with automated reminders, activity logging, escalation rules, and lien deadline tracking. |
| **Cash flow forecasting requires Excel.** Getting a cash flow projection from Vista requires exporting AR aging, AP aging, and payroll data and building a model manually. | **Real-time cash flow forecast** combining AR, AP, payroll, and historical patterns. Updated automatically as transactions post. |
| **Over/under billing is a manual calculation.** The over/under billing that feeds the WIP schedule requires comparing AR billing data against job cost data — usually done in Excel. | **Automatic over/under billing calculation.** System compares billing progress to cost progress in real time. Feeds WIP schedule directly. |
| **No owner portal support.** Each owner has their own billing portal (Textura, GCPay, Procore). AR clerks log in to each portal separately and re-enter billing data. | **Portal integration layer.** Submit billings to major owner portals directly from the system. Long-term: API integrations. Short-term: formatted export matching portal requirements. |

---

## 10. AIA G702/G703 Structure

The AIA G702 (Application and Certificate for Payment) and G703 (Continuation Sheet) are the industry-standard billing documents. Understanding their structure is essential for building the billing module.

```
G702 — Application and Certificate for Payment (Summary Page)

┌──────────────────────────────────────────────────────────────────┐
│ TO OWNER:           │ APPLICATION NO:     │ PERIOD TO:           │
│ [Owner Name]        │ [Sequential #]      │ [Month/Year]         │
├─────────────────────┤ PROJECT NO:         │ APPLICATION DATE:    │
│ FROM CONTRACTOR:    │ [Project #]         │ [Date]               │
│ [Company Name]      │                     │                      │
├─────────────────────┴─────────────────────┴──────────────────────┤
│ CONTRACTOR'S APPLICATION FOR PAYMENT                             │
│                                                                  │
│ 1. ORIGINAL CONTRACT SUM                          $X,XXX,XXX.XX │
│ 2. Net change by Change Orders                    $    XXX,XXX.XX│
│ 3. CONTRACT SUM TO DATE (1 + 2)                   $X,XXX,XXX.XX │
│ 4. TOTAL COMPLETED & STORED TO DATE               $X,XXX,XXX.XX │
│    (Column G on G703)                                            │
│ 5. RETAINAGE:                                                    │
│    a. ___% of Completed Work                      $    XXX,XXX.XX│
│    b. ___% of Stored Material                     $      X,XXX.XX│
│    Total Retainage (5a + 5b)                      $    XXX,XXX.XX│
│ 6. TOTAL EARNED LESS RETAINAGE (4 - 5)            $X,XXX,XXX.XX │
│ 7. LESS PREVIOUS CERTIFICATES FOR PAYMENT         $X,XXX,XXX.XX │
│ 8. CURRENT PAYMENT DUE                            $    XXX,XXX.XX│
│ 9. BALANCE TO FINISH, INCLUDING RETAINAGE         $    XXX,XXX.XX│
│    (3 - 6)                                                       │
└──────────────────────────────────────────────────────────────────┘

G703 — Continuation Sheet (SOV Detail)

┌───┬──────────────┬───────────┬──────────────────────────────┬─────────┬───────────┬───────────┐
│   │              │           │    WORK COMPLETED            │         │           │           │
│ A │      B       │     C     ├───────────┬────────┬─────────┤    G    │     H     │     I     │
│   │              │           │     D     │   E    │    F    │ TOTAL   │     %     │ BALANCE   │
│ # │ DESCRIPTION  │ SCHEDULED │ FROM PREV │  THIS  │ MATLS   │ C+D+E+F │ (G÷C)    │ TO FINISH │
│   │ OF WORK      │ VALUE     │ APPS      │ PERIOD │ STORED  │         │          │ (C - G)   │
├───┼──────────────┼───────────┼───────────┼────────┼─────────┼─────────┼──────────┼───────────┤
│ 1 │ Gen Cond     │  350,000  │  280,000  │ 35,000 │    0    │ 315,000 │   90%    │   35,000  │
│ 2 │ Site Work    │  280,000  │  280,000  │    0   │    0    │ 280,000 │  100%    │        0  │
│ 3 │ Concrete     │  420,000  │  378,000  │ 42,000 │    0    │ 420,000 │  100%    │        0  │
│...│ ...          │   ...     │    ...    │  ...   │  ...    │   ...   │   ...    │    ...    │
├───┴──────────────┼───────────┼───────────┼────────┼─────────┼─────────┼──────────┼───────────┤
│     GRAND TOTALS │5,000,000  │3,200,000  │285,000 │ 45,000  │3,530,000│   70.6%  │1,470,000  │
└──────────────────┴───────────┴───────────┴────────┴─────────┴─────────┴──────────┴───────────┘
```

### Key G702/G703 Calculation Rules

1. **Column C (Scheduled Value)** = Original SOV line amount + approved change orders allocated to that line
2. **Column G (Total Completed)** = Previous Applications (D) + This Period (E) + Materials Stored (F)
3. **Column H (% Complete)** = G ÷ C (must never exceed 100%)
4. **Column I (Balance to Finish)** = C - G
5. **G702 Line 4** = Sum of Column G across all lines
6. **Retainage** = typically a flat percentage of line 4 (but can vary by line, by threshold, or by contract)
7. **Current Payment Due (Line 8)** = Total Earned Less Retainage (Line 6) - Previous Certificates (Line 7)
8. **Grand Total of Column C** must equal G702 Line 3 (Contract Sum to Date)

---

## 11. Key Business Rules

1. **Billing cannot exceed contract value.** Total billed to date (including change orders) cannot exceed the contract sum to date. System must hard-stop this.
2. **Retention is calculated per contract terms.** Different contracts have different retention rates, and some have step-downs (10% to 50% complete, then 5%). The system must support per-contract retention schedules.
3. **Cash receipts must be applied, not just deposited.** Every dollar received must be applied to a specific payment application. Unapplied cash must be resolved within 48 hours.
4. **Billing progress should reasonably correlate with cost progress.** If a project is 80% billed but only 50% cost-to-date, it's overbilled. The system must surface this for Controller review. This directly affects the WIP schedule and revenue recognition.
5. **Change orders must be approved before they appear on a billing.** Pending COs are tracked separately as potential revenue but cannot be billed until the owner approves.
6. **Lien waiver requirements are contract-specific.** Some owners require the GC's waiver only; others require waivers from every sub who was paid in the prior period. The system must know each owner's requirements.
7. **Retention billing requires closeout documentation.** The system should not allow retention billing without confirming that closeout requirements are tracked (even if not yet complete — the billing can go out with a note).
8. **Materials stored must be documented.** If the billing includes materials stored on-site or off-site, supporting documentation (inventory list, photos, storage location) must be attached.
9. **Payment applications are sequential.** App #7 must reference the totals from App #6. The system must enforce sequential numbering and carry-forward accuracy.
10. **AR posts to GL in the billing period.** The billing hits the GL in the period of the billing date, establishing the receivable and (depending on accounting method) revenue.

---

## 12. Connection to Long-Term Vision

Pitbull's future is **Design → Build → Operate → Maintain** — a full lifecycle platform with digital twins, BIM integration, and CAD tools, all web-native on one platform.

For Accounts Receivable, this evolution means:

- **BIM-driven progress billing:** Instead of PMs manually estimating percent complete on SOV lines, the BIM model and digital twin reflect actual installation progress. AI compares the model's current state to the SOV and suggests billing percentages with visual proof. Billing disputes drop dramatically when you can show the owner a 3D model of exactly what's installed.
- **Digital twin as billing documentation:** The digital twin becomes the ultimate backup documentation for billing — timestamped visual records of work in place, materials stored, and progress by trade.
- **Operate & Maintain phase billing:** After construction, the building enters operations. AR transitions from progress billing to maintenance contract billing, service invoicing, and warranty claim tracking. The same customer records and billing workflows extend into the long-term relationship.
- **Predictive revenue management:** AI uses BIM model progress, project schedules, and historical data to forecast monthly billing amounts 3-6 months ahead. Controller can plan cash flow before the billing even happens.

The AR Clerk's workflow today — billing, collections, cash application — becomes the foundation for an AI-augmented revenue lifecycle system that spans design through building operations.

---

*This document is a living reference for AI agent teams. When building any feature that touches billing, receivables, or cash collection, consult this document to understand the AR Clerk's perspective and constraints.*
