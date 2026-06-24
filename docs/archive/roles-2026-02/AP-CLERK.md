# Accounts Payable Clerk — Functional Role Reference

> **Audience:** AI agent teams building Pitbull Construction Solutions ERP
> **Last updated:** 2026-02-19

---

## 1. Role Description

The AP Clerk is the **gatekeeper of outbound cash**. Every dollar that leaves the company — to vendors, subcontractors, material suppliers, equipment lessors — flows through Accounts Payable. In construction, this role carries extraordinary complexity because:

- **Subcontractor payments are not simple invoices.** They are progress billings (pay applications) against committed contracts, with retention withheld, compliance documents required, and lien waivers exchanged. A single subcontractor payment may require verifying insurance certificates, processing a pay app through PM approval, calculating retention, obtaining a conditional lien waiver, and checking for stop notices — all before cutting the check.
- **Compliance gates payments.** You cannot pay a subcontractor whose general liability insurance has expired. You cannot pay without a valid W-9 on file. You cannot release retention without a final lien waiver. These aren't suggestions — they're legal requirements that protect the company from double payment and mechanic's liens.
- **Volume is high and seasonal.** A mid-size GC might process 500-1,000 invoices per month across 20+ active projects. During peak construction season, AP is drowning.
- **Coding accuracy drives job cost.** Every invoice must be coded to the correct project, phase, and cost code. A miscoded invoice means the PM's cost report is wrong, which means the WIP schedule is wrong, which means the financial statements are wrong.
- **1099 reporting** requires tracking every payment to every non-corporate vendor throughout the year. Miss one, and the IRS comes calling.

The AP Clerk is the **vendor master data owner** — they control who gets paid, how they get paid, and whether the company has the documentation to defend every payment.

### Design Principle

> **Predict what the user wants and offer it before they even know they want it.** When an invoice arrives, the system should already know which PO it matches, which cost code it belongs to, and whether the vendor's compliance documents are current. The AP Clerk reviews and approves — not hunts and assembles.

---

## 2. Core Responsibilities

| Area | Description |
|------|-------------|
| **Vendor Setup & Maintenance** | Create and maintain vendor master records: legal name, remit-to address, payment terms, default GL/cost code, tax classification (corporation, LLC, sole proprietor), W-9 on file, 1099 eligibility, insurance certificates, minority/disadvantaged status. |
| **Purchase Order Matching** | Match vendor invoices against approved POs. Three-way match: PO → receiving/delivery confirmation → invoice. Flag discrepancies in quantity, price, or description. |
| **Invoice Processing** | Enter (or auto-capture) vendor invoices: vendor, date, amount, GL/job coding, PO reference, payment terms. Route for approval if required. |
| **Subcontractor Pay Application Processing** | Receive sub pay apps, route to PM for approval, verify against subcontract SOV, calculate retention, verify compliance (insurance, lien waivers), and queue for payment. |
| **Payment Runs** | Execute weekly (or as-needed) check/ACH payment runs. Select invoices by due date, project, or priority. Generate checks, ACH files, remittance advices. |
| **Retention Tracking** | Track retention withheld on every subcontract. Manage retention release when milestones are met or at project closeout. Ensure final lien waivers are received before releasing retention. |
| **Lien Waiver Management** | Collect conditional lien waivers before payment and unconditional waivers after payment clears. Track compliance by sub by project. |
| **Insurance Certificate Tracking** | Monitor subcontractor and vendor insurance certificates (GL, auto, workers' comp, umbrella). Block payments to non-compliant vendors. |
| **1099 Reporting** | Track all payments to 1099-eligible vendors throughout the year. Generate 1099-NEC/MISC forms annually. Reconcile against AP payments. |
| **AP Aging Management** | Monitor AP aging, manage payment timing for cash flow, identify past-due invoices, resolve vendor disputes. |
| **Sales Tax Compliance** | Track sales/use tax on materials. Construction has complex tax rules — some materials are taxable, some are exempt based on project type (public vs. private). |

---

## 3. Data Owned (Entities / Tables)

| Entity | Description | Key Fields |
|--------|-------------|------------|
| `Vendor` | Vendor master record | VendorId, LegalName, DBA, TaxId (encrypted), TaxClassification, Is1099Eligible, RemitToAddress, PaymentTerms, DefaultGLAccount, DefaultCostCode, MinorityStatus, Status (Active/Inactive/Hold) |
| `VendorContact` | Vendor contacts | VendorId, ContactName, Title, Email, Phone, IsPrimary |
| `VendorInsurance` | Insurance certificate tracking | VendorId, PolicyType (GL/Auto/WC/Umbrella), CarrierName, PolicyNumber, EffectiveDate, ExpirationDate, CoverageAmount, DocumentId, AdditionalInsuredVerified |
| `VendorW9` | W-9 tracking | VendorId, TaxId (encrypted), TaxClassification, DateReceived, DocumentId |
| `PurchaseOrder` | Purchase orders | PONumber, ProjectId, VendorId, Description, Amount, TaxAmount, CostCodeId, Status (Draft/Approved/Partial/Complete/Void), ApprovedBy, ApprovedDate |
| `POLineItem` | PO detail lines | POId, LineNumber, Description, Quantity, UnitPrice, Amount, CostCodeId, Received, Invoiced |
| `APInvoice` | Vendor invoices | InvoiceId, VendorId, InvoiceNumber, InvoiceDate, DueDate, Amount, TaxAmount, Status (Entered/Approved/Scheduled/Paid/Void), POId, ProjectId, CostCodeId, ApprovedBy |
| `APInvoiceLine` | Invoice line items | InvoiceId, LineNumber, Description, Quantity, UnitPrice, Amount, GLAccountId, ProjectId, CostCodeId, PhaseId |
| `APPayment` | Payment records | PaymentId, PaymentDate, PaymentMethod (Check/ACH/Wire), CheckNumber, BankAccountId, TotalAmount, Status (Printed/Transmitted/Cleared/Void) |
| `APPaymentDetail` | Payment-to-invoice mapping | PaymentId, InvoiceId, Amount, DiscountTaken |
| `SubPayApp` | Subcontractor pay applications | SubPayAppId, SubcontractId, AppNumber, PeriodThrough, WorkCompletedThisPeriod, MaterialsStored, TotalCompleted, RetentionAmount, AmountDue, PMApprovedBy, PMApprovedDate, Status |
| `RetentionPayable` | Retention tracking | SubcontractId, ProjectId, OriginalRetention, ReleasedAmount, Balance, LastReleaseDate, FinalLienWaiverReceived |
| `LienWaiver` | Lien waiver tracking | ProjectId, VendorId, PaymentId, WaiverType (ConditionalProgress/UnconditionalProgress/ConditionalFinal/UnconditionalFinal), ThroughDate, Amount, ReceivedDate, DocumentId |
| `Form1099` | 1099 tracking | VendorId, TaxYear, FormType (NEC/MISC), TotalPayments, ReportedAmount, Status (Pending/Filed), FiledDate |

---

## 4. Modules Used Daily

| Module | Usage |
|--------|-------|
| **Accounts Payable** | Primary workspace. Invoice entry, approval, payment processing, vendor inquiries. |
| **Vendor Management** | Setup and maintain vendors, track insurance, W-9s, compliance. |
| **Purchase Orders** | Match invoices to POs, review PO status, check remaining balances. |
| **Subcontract Management** | Process sub pay apps, track retention, manage lien waivers. |
| **Job Cost** | Verify cost code accuracy, review committed costs against budget. |
| **Banking** | Manage payment runs, check printing, ACH transmission, positive pay files. |
| **Document Management** | Store and retrieve invoices, lien waivers, insurance certs, W-9s. |
| **Reporting** | AP aging, cash requirements, 1099 preparation, vendor analysis. |

---

## 5. Dependencies on Other Roles

| Role | Dependency |
|------|-----------|
| **Project Manager** | PM approves subcontractor pay apps before AP processes payment. PM approves purchase orders that AP matches invoices against. PM may code or approve invoices for their projects. |
| **Controller/CFO** | Controller approves payment runs, sets payment timing for cash flow, reviews AP aging. Controller closes periods that AP must post invoices within. |
| **Payroll Manager** | Union fringe benefit remittances calculated by Payroll may be paid through AP. Some companies process payroll tax deposits through AP. |
| **HR Director** | HR may own initial vendor compliance (insurance, W-9) for subcontractors who are also managed as quasi-employees. HR provides minority/disadvantaged business certifications for compliance reporting. |
| **AR Clerk** | Cash receipts from AR inform the Controller's cash position, which determines how aggressively AP can pay. In construction: AP and AR retention are two sides of the same coin — the company withholds from subs (AP) and the owner withholds from them (AR). |
| **System Admin** | Vendor setup configuration, approval workflow setup, payment method configuration, bank account setup. |

---

## 6. Workflows

### Vendor Setup

```
New Vendor Request
├── 1. Collect vendor information (name, address, contact, tax classification)
├── 2. Obtain W-9 — REQUIRED before first payment
├── 3. Determine 1099 eligibility based on tax classification
│   ├── Corporation → NOT 1099 eligible (usually)
│   ├── LLC (taxed as S-Corp/C-Corp) → NOT 1099 eligible
│   ├── LLC (single-member/partnership) → 1099 eligible
│   ├── Sole proprietor → 1099 eligible
│   └── Partnership → 1099 eligible
├── 4. If subcontractor: collect insurance certificates
│   ├── General Liability (verify additional insured)
│   ├── Workers' Compensation
│   ├── Auto Liability
│   └── Umbrella/Excess (if required by contract)
├── 5. Set payment terms (Net 30, Net 45, etc.)
├── 6. Set default GL account and cost code (if applicable)
├── 7. Check for duplicate vendor (AI: match on TaxId, name, address)
├── 8. Activate vendor
└── 9. Notify requestor that vendor is ready for POs/invoices
```

### Invoice Processing (Standard)

```
Invoice Received (email, mail, portal upload)
│
├── AI Pre-Processing
│   ├── OCR/extract: vendor, invoice number, date, amount, line items
│   ├── Match to vendor master (by name, TaxId, or historical pattern)
│   ├── Match to PO (by PO number reference, vendor + amount, or line items)
│   └── Suggest GL/cost code based on vendor history and PO coding
│
├── AP Clerk Review
│   ├── Verify vendor match is correct
│   ├── Verify PO match (if applicable)
│   │   ├── Three-way match: PO amount ≥ invoice amount? Quantities match?
│   │   └── Flag variances for PM review
│   ├── Verify/adjust GL coding
│   ├── Verify payment terms and due date
│   ├── Check for duplicate invoice (AI: same vendor + invoice number + amount)
│   └── Approve or route for approval
│
├── Approval Routing (based on amount and project)
│   ├── Under $X: AP Clerk approves
│   ├── $X - $Y: PM approves
│   └── Over $Y: PM + Controller approve
│
└── Post to AP subledger → hits GL and Job Cost
```

### Subcontractor Pay Application Processing

```
Sub Pay App Received
│
├── 1. Match to subcontract and verify sub is active
├── 2. COMPLIANCE CHECK (gates everything)
│   ├── Insurance certificates current? → if expired, STOP. Notify sub.
│   ├── W-9 on file? → if missing, STOP.
│   ├── Conditional lien waiver for this payment included?
│   │   └── If not, request from sub before processing
│   └── Unconditional lien waiver for PREVIOUS payment received?
│       └── If not, hold current payment until received
│
├── 3. Route to PM for approval
│   ├── PM verifies work completed matches billing
│   ├── PM verifies SOV line percentages are accurate
│   ├── PM verifies stored materials are on-site
│   └── PM approves or returns with comments
│
├── 4. Calculate payment
│   ├── Work completed this period
│   ├── + Materials stored
│   ├── = Total completed and stored
│   ├── - Retention (per contract terms, e.g., 10%)
│   ├── = Net earned to date
│   ├── - Previously paid
│   ├── = Current payment due
│   └── Verify total doesn't exceed subcontract amount + approved COs
│
├── 5. Queue for payment run
└── 6. After payment clears: request unconditional lien waiver
```

### Payment Run (Weekly)

```
Payment Run Process
│
├── 1. Select invoices for payment
│   ├── All invoices due by [date]
│   ├── Specific vendor payments (priority or relationship)
│   ├── Specific project payments (close-out, urgent)
│   └── Exclude vendors on hold (compliance, dispute)
│
├── 2. Cash requirements summary → Controller reviews
│   ├── Total cash required
│   ├── Available bank balance
│   └── Upcoming AR collections expected
│
├── 3. Controller approves payment run
│
├── 4. Generate payments
│   ├── Checks: print, match signatures, stuff envelopes (or outsource)
│   ├── ACH: generate file, transmit to bank
│   └── Wire: process individual wires for urgent/large payments
│
├── 5. Generate positive pay file (send to bank for fraud prevention)
│
├── 6. Post payments to AP subledger → GL
│   ├── Debit AP (reduces liability)
│   └── Credit Cash (reduces bank balance)
│
└── 7. Generate remittance advices for vendors
```

### 1099 Year-End Process

```
1099 Annual Process (January)
│
├── 1. Run 1099 preliminary report: all payments to 1099-eligible vendors
├── 2. Verify vendor tax information (TaxId, name matches W-9)
├── 3. Review threshold: only vendors paid ≥ $600 get a 1099
├── 4. Exclude non-reportable payments (materials from corporations, rent to corps, etc.)
├── 5. Reconcile 1099 amounts against AP payment totals
├── 6. Generate 1099-NEC (for services) and 1099-MISC (for rent, etc.)
├── 7. Mail/e-file to vendors by January 31
├── 8. E-file with IRS by March 31 (or January 31 if paper filing)
└── 9. Retain copies for records
```

---

## 7. Key Reports

| Report | Frequency | Description |
|--------|-----------|-------------|
| **AP Aging** | Weekly | Open invoices by vendor by aging bucket (Current, 30, 60, 90+). The cash flow planning tool. |
| **Cash Requirements Forecast** | Weekly | What's due this week, next week, next 30 days. Matched against expected AR collections. |
| **Payment Register** | Per payment run | All payments issued: check number, vendor, amount, invoices paid. |
| **Invoice Approval Status** | Daily | Invoices pending approval, by approver and days pending. Chase list. |
| **PO vs. Invoice Variance** | Per invoice | PO amount vs. invoiced amount, by line item. Flags overages. |
| **Subcontractor Compliance** | Weekly | Insurance status, lien waiver status, W-9 status for all active subs. Red/yellow/green. |
| **Retention Payable Summary** | Monthly | Total retention held by sub, by project. Expected release dates. |
| **Lien Waiver Tracker** | Per payment | Conditional and unconditional waivers: collected vs. outstanding, by project and vendor. |
| **1099 Preparation Report** | Quarterly/Annual | Year-to-date payments by vendor, 1099 eligibility, missing W-9s. |
| **Vendor Payment History** | On demand | Full payment history for a vendor: invoices, payments, dates, check numbers. |
| **Duplicate Invoice Report** | Per batch | Potential duplicate invoices flagged by AI: same vendor + similar amount + similar date. |
| **Committed Cost Report** | Monthly | POs and subcontracts by project: original amount, invoiced to date, remaining commitment. |
| **Sales/Use Tax Report** | Monthly | Tax collected/owed by jurisdiction, for filing. |
| **AP GL Distribution** | Per posting | Every AP posting mapped to GL accounts and job cost codes. For Controller review. |

---

## 8. AI Agent Assistance Opportunities

### Invoice Intelligence

- **OCR + auto-extraction:** Invoices arrive as PDFs or images. AI extracts vendor name, invoice number, date, amount, line items, PO reference. No manual data entry.
- **Auto-match to PO:** AI matches invoices to POs by: (1) explicit PO number on invoice, (2) vendor + amount within tolerance, (3) line item matching. Three-way match happens automatically — AP reviews exceptions.
- **Duplicate detection:** AI flags potential duplicates in real time during entry: same vendor + invoice number, same vendor + amount + date range, same vendor + similar description.
- **Coding prediction:** Based on vendor history, PO data, and invoice description, AI suggests GL account, project, phase, and cost code. Accuracy improves over time. Target: 90%+ auto-coded.
- **Payment timing prediction:** AI analyzes vendor payment patterns and suggests optimal payment timing — pay early for discount capture, or hold to maximize float. "This vendor offers 2% 10 Net 30 — paying today saves $450."

### Compliance Automation

- **Insurance expiration monitoring:** AI tracks all vendor insurance certificates and sends automated renewal requests 60/30/15 days before expiration. Auto-places vendor on payment hold if expired.
- **Lien waiver workflow:** AI generates lien waiver requests with pre-filled amounts, sends to subcontractors electronically, tracks responses, and blocks payment release until received.
- **W-9 validation:** AI validates W-9 data against IRS TIN matching database. Flags mismatches before 1099 filing.
- **Compliance gap dashboard:** Real-time view of all vendors with any compliance deficiency — expired insurance, missing W-9, outstanding lien waivers. One screen shows everything that needs attention.

### Payment Optimization

- **Cash flow-aware payment scheduling:** AI considers AR collections, payroll obligations, and bank balances to recommend which invoices to pay in which payment run. Maximize float without damaging vendor relationships.
- **Early payment discount capture:** AI identifies invoices with early payment discounts and calculates the annualized return of taking the discount vs. holding cash. "Taking this 2/10 Net 30 discount on $50K = 36.7% annualized return."
- **Vendor payment term negotiation data:** AI provides analysis of payment patterns per vendor to support term negotiations. "We consistently pay Vendor X in 18 days — they offer Net 30. We could negotiate 2% 10 Net 30."

### 1099 Intelligence

- **Continuous 1099 tracking:** Don't wait until January. AI flags 1099 issues throughout the year: vendor approaching $600 threshold without W-9, vendor classification changed, payments that look like they should be 1099-reportable but aren't flagged.
- **1099 reconciliation:** AI reconciles 1099 amounts against AP payment totals and flags discrepancies. Catches voided checks, credit memos, and vendor reclassifications that affect reporting.
- **IRS TIN matching:** Before filing, AI submits TIN/name combinations to IRS for bulk verification, catching mismatches that would generate B-notices.

### Subcontractor Pay App Processing

- **Pay app math verification:** AI verifies all calculations on incoming sub pay apps: SOV percentages × scheduled values, retention calculations, totals. Catches math errors before PM review.
- **Progress tracking anomalies:** AI flags unusual billing patterns: sudden jumps in percent complete, billing that doesn't match PM's reported progress, materials stored without corresponding work.
- **Retention release workflow:** When project reaches substantial completion, AI initiates the retention release workflow: verify punch list completion, collect final lien waivers, route for PM and Controller approval.

---

## 9. Pain Points in Vista / Legacy Systems That Pitbull Solves

| Vista / Legacy Pain | Pitbull Solution |
|---------------------|-----------------|
| **Invoice entry is manual.** Even with scanning, Vista requires keying vendor, amount, coding, etc. from the scanned image. | **AI-powered invoice capture.** Email, upload, or scan → AI extracts all data and matches to PO. AP reviews, not enters. |
| **PO matching is tedious.** Vista's PO match requires manual lookup and comparison. Multi-line POs with partial deliveries are especially painful. | **Automatic three-way matching** with tolerance rules. AP sees a match score and a list of discrepancies, not raw data to compare. |
| **Insurance tracking is a spreadsheet.** Vista doesn't track vendor insurance certificates. Most AP departments maintain a separate spreadsheet or use a third-party service. | **Integrated compliance management.** Insurance certs, W-9s, and lien waivers are part of the vendor record with automated expiration tracking and payment gating. |
| **Lien waiver tracking is manual.** Which subs owe us waivers? For which payments? Most companies track this in Excel. | **Automated lien waiver workflow.** System generates requests, tracks collection, and gates future payments on receipt. Full audit trail. |
| **1099 year-end is a fire drill.** Missing W-9s, incorrect TINs, and unclear vendor classifications create chaos every January. | **Year-round 1099 readiness.** AI continuously validates vendor data and flags issues in real time, not at year-end. |
| **Payment approval is paper-based.** Many Vista shops still print checks for physical signature. | **Electronic approval workflows** with digital signatures. Mobile approval for urgent payments. |
| **Retention tracking requires custom reports.** Vista doesn't have a built-in retention payable dashboard. | **First-class retention module.** Retention by sub, by project, with expected release dates and conditional requirements. |
| **No vendor portal.** Vendors call or email to check payment status. AP spends hours answering "where's my check?" | **Vendor self-service portal.** Vendors check payment status, submit invoices, upload insurance certs, and download remittance advices. Eliminates 80% of vendor phone calls. |
| **Subcontractor pay apps arrive as paper or PDF.** AP manually re-enters the billing data. | **Sub portal with digital pay app submission.** Subs enter their pay app against the SOV electronically. System validates math and compliance before AP even touches it. |
| **Cash requirements reporting is clunky.** Getting a useful cash forecast from Vista requires multiple reports and Excel manipulation. | **Real-time cash requirements dashboard.** AP due, payroll upcoming, AR expected — all on one screen with AI-powered cash flow prediction. |

---

## 10. Lien Waiver Flow

Construction lien law is state-specific, but the general flow is universal. Lien waivers protect the property owner (and the GC) from double payment claims.

```
Payment Cycle:
                                                                    
Sub Submits        PM Approves      AP Prepares       Sub Receives
Pay App      →     Pay App     →    Payment      →    Check/ACH
                                         │
                                         ├── Collect CONDITIONAL lien waiver
                                         │   (waives lien rights for this payment
                                         │    IF the check clears)
                                         │
                                         └── After check clears:
                                             Collect UNCONDITIONAL lien waiver
                                             (permanently waives lien rights
                                              for this payment amount)

Types of Lien Waivers:
┌────────────────────┬──────────────────────────────────────────────┐
│ Conditional        │ Waives rights IF payment is received.       │
│ Progress           │ For progress payments (not final).          │
├────────────────────┼──────────────────────────────────────────────┤
│ Unconditional      │ Permanently waives rights. Used AFTER       │
│ Progress           │ payment has cleared the bank.               │
├────────────────────┼──────────────────────────────────────────────┤
│ Conditional Final  │ Waives ALL rights IF final payment received.│
│                    │ Used with final retention release.          │
├────────────────────┼──────────────────────────────────────────────┤
│ Unconditional      │ Permanently waives ALL rights. Final        │
│ Final              │ document in the payment chain.              │
└────────────────────┴──────────────────────────────────────────────┘

States with statutory lien waiver forms (must use exact form):
California, Texas, Georgia, Michigan, Mississippi, Missouri,
Nevada, Wyoming, and others — system must support state-specific forms.
```

---

## 11. Key Business Rules

1. **No payment without a W-9.** First payment to any vendor requires a valid W-9 on file. System must enforce this — not warn, enforce.
2. **Insurance compliance gates payment.** If a subcontractor's GL, WC, or auto insurance has expired, their payments are automatically held. No override without Controller approval with documented reason.
3. **Lien waivers are required per contract.** If the subcontract requires lien waivers, the system must track collection and can be configured to hold payments if prior-period unconditional waivers are outstanding.
4. **Retention is withheld automatically.** When processing a sub pay app, the system calculates and withholds retention per the subcontract terms. AP cannot override retention without PM and Controller approval.
5. **Duplicate invoices are blocked.** Same vendor + same invoice number = hard stop. Same vendor + same amount + within 30 days = soft warning.
6. **PO overages require approval.** If an invoice exceeds the PO amount (or any line item), it must be routed for PM approval before posting.
7. **1099 eligibility is determined at vendor setup** based on tax classification from the W-9 and cannot be changed without AP supervisor approval and documentation.
8. **Void checks are tracked, never deleted.** A voided check creates a reversal record. The original payment and the void are both permanent records.
9. **Positive pay files are mandatory.** Every check run generates a positive pay file sent to the bank. Checks not on the file will not be honored by the bank.
10. **AP invoices post to the GL in the period of the invoice date,** not the entry date. If an invoice dated January 15 is entered on February 3, it hits January's GL (if the period is still open) or is flagged as a prior-period item.

---

## 12. Integration Points

```
                     ┌─────────────────────┐
                     │     AP Clerk         │
                     │   (Payment Hub)      │
                     └──────────┬──────────┘
                                │
        ┌───────────┬───────────┼───────────┬───────────┐
        │           │           │           │           │
   ┌────▼────┐ ┌────▼────┐ ┌───▼────┐ ┌────▼────┐ ┌───▼────┐
   │   PM    │ │ Banking │ │   GL   │ │ Job Cost│ │ Vendor │
   │Approval │ │  Module │ │Posting │ │ Module  │ │ Portal │
   └─────────┘ └─────────┘ └────────┘ └─────────┘ └────────┘
        │                       │           │
        │                  ┌────▼────┐      │
        │                  │  WIP /  │      │
        └──────────────────► Revenue │◄─────┘
                           │  Recog  │
                           └─────────┘
```

### Subledger → GL Posting Rules
- Invoice posted → Debit expense/job cost account, Credit AP liability
- Payment issued → Debit AP liability, Credit Cash
- Retention withheld → Debit expense/job cost, Credit Retention Payable (NOT AP)
- Retention released → Debit Retention Payable, Credit Cash
- Discount taken → Debit AP, Credit Cash (net), Credit Discount Earned (difference)
- Invoice voided → Reverse original entry exactly

---

## 13. Connection to Long-Term Vision

Pitbull's future is **Design → Build → Operate → Maintain** — a full lifecycle platform with digital twins, BIM integration, and CAD tools, all web-native on one platform.

For Accounts Payable, this evolution means:

- **BIM-linked purchase orders:** When the BIM model specifies a material, the PO is auto-generated with quantities from the model. Invoice matching verifies material deliveries against BIM specifications.
- **Digital twin cost tracking:** As the digital twin is updated with installed components, AP can verify that invoiced materials and labor correspond to actual installation progress — visible in the model.
- **Operate & Maintain phase:** AP transitions from construction payments to facility management vendor payments. The same vendor records, compliance tracking, and payment workflows extend into long-term operations.
- **Predictive procurement:** AI uses BIM model data and project schedule to predict when materials will be needed, automatically generating POs and negotiating pricing with preferred vendors.

The AP Clerk's workflow today — vendor management, compliance, payment processing — becomes the foundation for an AI-augmented supply chain management system that spans the entire building lifecycle.

---

*This document is a living reference for AI agent teams. When building any feature that touches vendor management, purchasing, or payments, consult this document to understand the AP Clerk's perspective and constraints.*
