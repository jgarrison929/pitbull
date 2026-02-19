# Vista/Sage Migration Accelerator — Design Specification

> **Status:** Draft
> **Module:** `Pitbull.Migration` (new) — extends existing `DataImportController` / `DataImportService`
> **Author:** AI-assisted design
> **Date:** 2026-02-19
> **Priority:** Product Review #7 — biggest barrier to ERP switching is data migration fear
> **Prerequisites:** Onboarding Flow V2 (ONBOARDING-FLOW-V2.md), AP/AR Foundation (AP-AR-FOUNDATION-SPEC.md)

---

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [Glossary](#2-glossary)
3. [Import Sources](#3-import-sources)
4. [Entity Mapping Engine](#4-entity-mapping-engine)
5. [Import Wizard UI](#5-import-wizard-ui)
6. [Per-Entity Importers](#6-per-entity-importers)
7. [Validation Engine](#7-validation-engine)
8. [Reconciliation Cockpit](#8-reconciliation-cockpit)
9. [Rollback Capability](#9-rollback-capability)
10. [Vista-Specific Handling](#10-vista-specific-handling)
11. [AI Agent Opportunities](#11-ai-agent-opportunities)
12. [Predictive Features](#12-predictive-features)
13. [Domain Entities](#13-domain-entities)
14. [API Surface](#14-api-surface)
15. [Implementation Phases](#15-implementation-phases)
16. [Acceptance Criteria](#16-acceptance-criteria)

---

## 1. Purpose & Scope

### 1.1 Problem Statement

The #1 reason construction companies stay on Vista, Sage 300, or Foundation — even when they hate the software — is **fear of data migration**. They have 5-15 years of vendor records, project history, GL balances, open invoices, and employee data locked in a legacy system. The perceived cost and risk of moving that data is higher than the pain of staying.

Current migration options are all bad:
- **Consulting firm:** $50K-200K, 3-6 months, custom SQL scripts, still requires company staff for validation
- **Manual re-entry:** Months of double-entry during cutover period, inevitable errors, staff burnout
- **"Start fresh":** Lose historical data, break audit trails, can't close out in-progress projects

Pitbull's Migration Accelerator eliminates this barrier with a self-service, AI-assisted migration tool that makes switching as easy as uploading a file.

### 1.2 Goals

| Goal | Description |
|------|-------------|
| Self-service migration | System Admin can migrate without consultants or SQL knowledge |
| Source auto-detection | Upload a file → system identifies the source system and version |
| Intelligent field mapping | AI suggests mappings with confidence scores; admin reviews |
| Comprehensive validation | Catch errors before import, not after |
| Reconciliation proof | Side-by-side totals proving the import was accurate |
| Full rollback | Undo any import batch completely if problems are found |
| Incremental migration | Import masters first, transactions later — at your own pace |
| Vista/Sage expertise | Deep knowledge of Vista/Sage data structures built into the tool |

### 1.3 Existing Codebase Anchors

| Component | Location | Current State |
|-----------|----------|---------------|
| `DataImportController` | `Pitbull.Api/Controllers` | 5 import endpoints (employees, projects, cost codes, equipment, time entries) + confirm + history |
| `DataImportService` | `Pitbull.Api/Services` | Preview → Confirm workflow with CSV parsing, validation, and batch tracking |
| `ImportBatch` | `Pitbull.Core/Entities` | Batch tracking entity with status, row counts, and error details |
| `CsvParser` | `Pitbull.Api/Services` | Generic CSV parser supporting any delimited format |
| Import UI | `/admin/data-import` | Upload, preview, confirm workflow |
| Export endpoints | `DataImportController` | Vista-format time entry export, CSV exports for employees/projects/cost codes |

### 1.4 Non-Goals (This Phase)

- Live database-to-database migration (always file-based for safety)
- Real-time sync between Pitbull and legacy system (migration is a one-time event)
- Historical transaction rebuild (import open balances, not every historical transaction)
- Custom ERP connectors (Procore, CMiC, ComputerEase — future phases)

---

## 2. Glossary

| Term | Definition |
|------|------------|
| **Vista/Viewpoint** | Trimble Viewpoint Vista — dominant construction ERP, SQL Server-based. Uses 6-digit GL account codes, company-based multi-entity structure. |
| **Sage 300 CRE** | Sage 300 Construction and Real Estate — legacy Timberline. Pervasive SQL/flat file storage. |
| **Foundation** | Foundation Software — mid-market construction accounting. SQL Server-based. |
| **QuickBooks** | Intuit QuickBooks Desktop/Online — used by smaller contractors. IIF/CSV export. |
| **Source System** | The legacy ERP from which data is being migrated |
| **Mapping Profile** | A saved configuration of field mappings from a source format to Pitbull entities |
| **Import Batch** | A group of records imported together as a single atomic unit |
| **Migration Project** | The overall container tracking a multi-batch migration from a source system |
| **Reconciliation** | Comparing source system totals to imported totals to verify accuracy |
| **Rollback** | Undoing an entire import batch, restoring the system to its pre-import state |
| **Staging Table** | Temporary storage for imported data before it's committed to production tables |
| **Control Total** | A summary number (count, sum) used to verify import accuracy (e.g., total AP balance) |

---

## 3. Import Sources

### 3.1 Supported Source Systems

| Source | Format | Detection Signature | Priority |
|--------|--------|-------------------|----------|
| **Vista/Viewpoint** | SQL Server export (CSV/Excel) | Column names: `APCo`, `JCCo`, `APVendor`, `JCCostType`, `PRCo` | Phase 1 |
| **Sage 300 CRE** | Pervasive SQL export (CSV) | Column names: `REC#`, `REC-TYPE`, `VENDOR-#`, `JOB-#` | Phase 1 |
| **Foundation** | SQL Server export (CSV/Excel) | Column names: `VENDOR_NO`, `JOB_NO`, `PHASE_NO`, `COST_TYPE` | Phase 1 |
| **QuickBooks Desktop** | IIF (Intuit Interchange Format) | File header: `!HDR`, `!SPL`, `!TRNS` | Phase 2 |
| **QuickBooks Online** | CSV (exported from QBO) | Column names: `*Name`, `Type`, `Balance`, `Account` | Phase 2 |
| **Generic CSV** | Any delimited text file | No recognized signature → manual mapping | Phase 1 |
| **Generic Excel** | `.xlsx` / `.xls` | Detected by file extension, parsed with EPPlus/ClosedXML | Phase 1 |

### 3.2 Source System Profiles

Each source system has a pre-built profile describing its data model, common export formats, and known quirks.

```
SourceSystemProfile
├── Id : string — "vista", "sage300", "foundation", "quickbooks", "generic"
├── DisplayName : string
├── Version : string? — "Vista 6.0", "Sage 300 CRE 19.2"
├── ExportInstructions : string — step-by-step guide for exporting from this system
├── KnownColumnPatterns : Dictionary<string, string[]> — column name → entity type detection
├── DefaultFieldMappings : Dictionary<string, FieldMapping[]> — pre-built mappings per entity
├── KnownQuirks : string[] — data quality issues common to this source
├── SupportedEntityTypes : string[] — which Pitbull entities can be imported from this source
```

### 3.3 Export Guides

The system provides step-by-step export guides for each source system, accessible from the import wizard. Each guide includes:

| Section | Content |
|---------|---------|
| Prerequisites | What access/permissions the user needs in the legacy system |
| Navigation path | Screen-by-screen instructions to reach the export function |
| Export settings | Which columns to include, date ranges, filters |
| File format | Recommended export format (CSV with specific delimiters) |
| Known issues | Common problems and workarounds (e.g., "Vista exports dates as MM/DD/YYYY, not ISO") |
| Screenshots | Annotated screenshots of the legacy system's export screens |

---

## 4. Entity Mapping Engine

### 4.1 Architecture

The mapping engine transforms source data into Pitbull entities through a pipeline:

```
Source File
    │
    ▼
┌──────────────────┐
│  File Parser      │  Parse CSV/Excel/IIF into raw rows
│  (auto-detect     │
│   delimiter,      │
│   encoding)       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Source Detector   │  Identify source system from column patterns
│  (AI-assisted)    │  Return: SourceSystemProfile + confidence score
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Column Mapper    │  Map source columns → Pitbull fields
│  (profile-based + │  Pre-fill from profile, AI fills gaps
│   AI-assisted)    │
└────────┬─────────┘
         │
         ▼
┌──────────────────────┐
│  Transformation      │  Apply type conversions, value mappings,
│  Engine              │  code translations, defaults
└────────┬─────────────┘
         │
         ▼
┌──────────────────┐
│  Validation       │  Check data quality, referential integrity,
│  Engine           │  duplicates, required fields
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Staging          │  Hold validated data for preview & commit
│  Tables           │
└──────────────────┘
```

### 4.2 MappingProfile Entity

```
MappingProfile
├── Id : Guid (PK)
├── TenantId : Guid (RLS)
├── CompanyId : Guid
├── Name : string — "Vista AP Vendor Export May 2026"
├── SourceSystem : string — "vista", "sage300", etc.
├── SourceVersion : string? — detected or user-specified
├── EntityType : string — "vendors", "employees", "projects", etc.
├── FieldMappings : ICollection<FieldMapping>
├── TransformationRules : ICollection<TransformationRule>
├── IsTemplate : bool — true for system-provided profiles
├── CreatedFromTemplateId : Guid? — which template this was cloned from
├── LastUsedDate : DateTimeOffset?
├── UsageCount : int
├── CreatedAt / CreatedBy / UpdatedAt / UpdatedBy (BaseEntity)
```

### 4.3 FieldMapping Entity

```
FieldMapping
├── Id : Guid (PK)
├── MappingProfileId : Guid (FK)
├── SourceColumnName : string — "APVendor" (column header from source)
├── SourceColumnIndex : int — column position (fallback if no header)
├── TargetEntityField : string — "VendorNumber" (Pitbull property name)
├── TargetEntityType : string — "Vendor"
├── MappingType : enum (Direct, Transformed, Constant, Computed, Ignored)
├── TransformationRuleId : Guid? — if MappingType = Transformed
├── ConstantValue : string? — if MappingType = Constant
├── ComputedExpression : string? — if MappingType = Computed (e.g., "{Col1} + '-' + {Col2}")
├── IsRequired : bool
├── DefaultValue : string? — used when source value is null/empty
├── ConfidenceScore : decimal(3,2) — AI's confidence in this mapping (0.00-1.00)
├── ConfidenceReason : string? — why AI chose this mapping
├── IsUserConfirmed : bool — user has explicitly approved this mapping
├── SortOrder : int
```

### 4.4 TransformationRule Entity

Handles value transformations that go beyond simple field copying.

```
TransformationRule
├── Id : Guid (PK)
├── MappingProfileId : Guid (FK)
├── Name : string — "Vista Company Code → Pitbull Company"
├── RuleType : enum (ValueMap, DateFormat, NumberFormat, CodeTranslation,
│                     Concatenate, Split, Lookup, RegexReplace, Custom)
├── Configuration : string (JSON) — rule-specific configuration
├── SourceExample : string? — example input value
├── TargetExample : string? — example output value
```

**Rule Type Examples:**

| Rule Type | Configuration | Source → Target |
|-----------|--------------|-----------------|
| ValueMap | `{"1":"Active","2":"OnHold","3":"Inactive"}` | Vista status code → Pitbull enum |
| DateFormat | `{"sourceFormat":"MM/dd/yyyy","targetFormat":"yyyy-MM-dd"}` | `02/19/2026` → `2026-02-19` |
| CodeTranslation | `{"sourcePrefix":"03","targetPrefix":"03-","padTo":6}` | Vista `031000` → `03-1000` |
| Concatenate | `{"separator":" ","columns":["FirstName","LastName"]}` | `John` + `Smith` → `John Smith` |
| Split | `{"delimiter":"-","index":0}` | `SC-2026-001` → `SC` |
| Lookup | `{"lookupTable":"gl_accounts","sourceKey":"code","targetField":"id"}` | GL code → Pitbull GL Account ID |
| RegexReplace | `{"pattern":"[^0-9]","replacement":""}` | `(555) 123-4567` → `5551234567` |

### 4.5 Mapping Confidence Levels

| Score | Label | UI Treatment | Action Required |
|-------|-------|-------------|-----------------|
| 0.90-1.00 | High | Green checkmark, auto-applied | None — user can override |
| 0.70-0.89 | Medium | Yellow indicator, pre-selected but highlighted | Review recommended |
| 0.40-0.69 | Low | Orange indicator, not pre-selected | User must select target |
| 0.00-0.39 | Unknown | Red indicator, unmapped | User must map or ignore |

---

## 5. Import Wizard UI

### 5.1 Wizard Flow

```
Step 1: Upload          Step 2: Detect          Step 3: Map
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│ Drag & drop  │──────→│ Source auto-  │──────→│ Column-by-   │
│ or browse    │       │ detected      │       │ column       │
│ CSV/Excel    │       │ "Vista 6.0   │       │ mapping with │
│              │       │  AP Vendors"  │       │ AI confidence│
│ [Export Guide│       │              │       │ scores       │
│  available]  │       │ Confirm or   │       │              │
└──────────────┘       │ correct      │       │ [Preview     │
                       └──────────────┘       │  panel]      │
                                              └──────┬───────┘
                                                     │
Step 4: Validate        Step 5: Import         Step 6: Reconcile
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│ Validation   │──────→│ Progress bar │──────→│ Source vs.   │
│ report:      │       │ with record  │       │ imported     │
│              │       │ counter      │       │ totals       │
│ ✓ 2,847 valid│       │              │       │              │
│ ✗ 23 errors  │       │ Batch ID:    │       │ Exception    │
│ ⚠ 15 warnings│       │ recorded for │       │ list with    │
│              │       │ rollback     │       │ fix & retry  │
│ [Fix errors] │       └──────────────┘       │              │
│ [Skip errors]│                              │ [Sign off]   │
└──────────────┘                              │ [Rollback]   │
                                              └──────────────┘
```

### 5.2 Step 1: Upload

**UI Components:**
- Drag-and-drop zone accepting `.csv`, `.xlsx`, `.xls`, `.iif`, `.txt`
- Max file size: 50 MB (configurable)
- Multiple file upload for related entities (e.g., vendors + vendor contacts)
- "Export Guide" link that opens source-system-specific instructions
- Entity type selector (auto-detected after upload, but user can override)

**Supported encodings:** UTF-8, UTF-16, Windows-1252, ASCII (auto-detected)

### 5.3 Step 2: Source Detection

**UI Components:**
- Source system badge: "Detected: Vista/Viewpoint 6.0" with confidence
- Entity type badge: "Detected: AP Vendors (2,847 rows)"
- "Not right?" link to manually select source system and entity type
- Summary stats: row count, column count, date range (if applicable)

### 5.4 Step 3: Column Mapping

**UI Components:**
- Two-column layout: Source columns (left) → Pitbull fields (right)
- Each row shows:
  - Source column name and sample values (first 3 rows)
  - Mapped Pitbull field (dropdown with search)
  - Confidence indicator (color-coded)
  - Transformation rule (if applicable)
  - "Ignore" checkbox for unmapped columns
- Preview panel at bottom showing 5 sample records as they would appear in Pitbull
- "Auto-map remaining" button for AI to attempt all unmapped columns
- "Save as template" to reuse this mapping for future imports

### 5.5 Step 4: Validation

**UI Components:**
- Summary bar: X valid, Y errors, Z warnings
- Error list grouped by error type:
  - Required field missing (with row numbers)
  - Duplicate detected (showing both records)
  - Invalid data type (expected number, got text)
  - Referential integrity violation (e.g., project referenced but doesn't exist)
  - Value out of range (e.g., negative dollar amount)
- Per-error actions:
  - Fix inline (edit the value)
  - Apply default (use a default value for all occurrences)
  - Skip row (exclude from import)
  - Create missing reference (e.g., create the missing project first)
- "Re-validate" button after fixes
- "Proceed with warnings" vs. "Fix all first"

### 5.6 Step 5: Import Execution

**UI Components:**
- Progress bar with record counter (N of M imported)
- Estimated time remaining
- Live error log (errors that occur during actual insert)
- Cancel button (rolls back partial import)
- Status transitions: Validating → Importing → Finalizing → Complete

### 5.7 Step 6: Reconciliation

**UI Components:**
- Side-by-side comparison table:
  | Metric | Source | Imported | Difference | Status |
  |--------|--------|----------|-----------|--------|
  | Total records | 2,847 | 2,824 | -23 (skipped) | ⚠ |
  | Total AP balance | $4,562,103.47 | $4,562,103.47 | $0.00 | ✓ |
  | Unique vendors | 312 | 312 | 0 | ✓ |
- Exception list: 23 skipped records with reasons
- "Fix and retry" for individual records
- "Sign off" button (locks the import — no further edits without rollback)
- "Rollback entire batch" button (with confirmation dialog)

---

## 6. Per-Entity Importers

### 6.1 Import Dependency Order

Entities must be imported in dependency order. The wizard enforces this.

```
Phase 1: Masters (no dependencies)
├── Chart of Accounts (GL accounts)
├── Employees
├── Vendors
├── Customers / Owners
└── Cost Codes

Phase 2: Project Structure (depends on Phase 1)
├── Projects (depends on: Customers)
├── Subcontracts (depends on: Projects, Vendors)
├── Schedule of Values (depends on: Subcontracts)
└── Change Orders (depends on: Subcontracts)

Phase 3: Open Balances (depends on Phase 2)
├── Open AP Invoices (depends on: Vendors, Projects, GL Accounts)
├── Open AR Invoices (depends on: Customers, Projects)
├── Job Cost History (depends on: Projects, Cost Codes, Vendors)
└── GL Opening Balances (depends on: GL Accounts)
```

### 6.2 Employees

| Source Field (Vista) | Source Field (Sage) | Pitbull Field | Transform |
|---------------------|--------------------|--------------|-----------|
| `PRCo` + `Employee` | `EMPLOYEE-#` | `EmployeeNumber` | Concatenate company + number or direct |
| `FirstName` | `FIRST-NAME` | `FirstName` | Direct |
| `LastName` | `LAST-NAME` | `LastName` | Direct |
| `JCCraftClass` | `CRAFT` | `Classification` | ValueMap (Vista craft → Pitbull classification) |
| `HrlyRate` | `PAY-RATE` | `BaseHourlyRate` | Direct (decimal) |
| `Status` ('A'/'I'/'T') | `STATUS` | `IsActive` | ValueMap ('A'→true, 'I'→false, 'T'→false) |
| `SSN` (encrypted) | `SSN` | `SsnEncrypted` | Re-encrypt with Pitbull key |
| `Email` | `EMAIL` | `Email` | Direct |
| `HireDate` | `HIRE-DATE` | `HireDate` | DateFormat conversion |
| `PRDept` | `DEPT` | `Department` | ValueMap or direct |
| `JCCraftTemplate` | `CLASS` | `TradeCode` | CodeTranslation |

**Special handling:**
- SSN: Must be re-encrypted. If source provides encrypted SSN, require admin to provide decryption key. If plaintext, encrypt on import. Flag if SSN is missing (compliance warning).
- Pay rates: Validate against reasonable range ($10-$200/hr for hourly, $30K-$500K for salary).
- Duplicate detection: Match on SSN (if available) OR (FirstName + LastName + HireDate).

### 6.3 Projects

| Source Field (Vista) | Source Field (Sage) | Pitbull Field | Transform |
|---------------------|--------------------|--------------|-----------|
| `JCCo` + `Job` | `JOB-#` | `ProjectNumber` | Concatenate or direct |
| `Description` | `JOB-NAME` | `Name` | Direct |
| `Contract` | `CONTRACT-AMT` | `OriginalContractAmount` | Decimal |
| `BillToCustomer` | `OWNER-#` | `CustomerId` | Lookup (customer must be imported first) |
| `Status` (1/2/3) | `STATUS` | `Status` | ValueMap (1→Active, 2→Complete, 3→Closed) |
| `StartDate` | `START-DATE` | `StartDate` | DateFormat |
| `ProjectAddress1` | `ADDRESS-1` | `Address` | Direct |
| `ContractType` | `CONTRACT-TYPE` | `ContractType` | ValueMap |

**Special handling:**
- Multi-company: Vista uses `JCCo` (Job Cost Company). Map to Pitbull `CompanyId`.
- Active vs. closed: Import active projects first. Closed projects are optional (historical data).
- Budget data: If Vista budget export is included, import as `ProjectBudget` entries.

### 6.4 Cost Codes

| Source Field (Vista) | Source Field (Sage) | Pitbull Field | Transform |
|---------------------|--------------------|--------------|-----------|
| `JCCo` + `PhaseGroup` + `Phase` | `PHASE-#` | `Code` | CodeTranslation (Vista 6-digit → Pitbull hierarchical) |
| `Description` | `DESCRIPTION` | `Description` | Direct |
| `CostType` (1-5) | `COST-TYPE` | `CostType` | ValueMap (1→Labor, 2→Material, 3→Subcontract, 4→Equipment, 5→Other) |
| `UM` (Unit of Measure) | `UNIT` | `UnitOfMeasure` | Direct |

**Special handling:**
- Vista cost types are numeric (1-5). Sage uses letters (L/M/S/E/O). Both map to the same enum.
- CSI cross-reference: If imported codes match CSI standard divisions, link to the seeded CSI codes rather than creating duplicates.
- Phase hierarchy: Vista uses `Phase` + `PhaseGroup`. Translate to Pitbull's parent-child cost code structure.

### 6.5 Vendors

| Source Field (Vista) | Source Field (Sage) | Pitbull Field | Transform |
|---------------------|--------------------|--------------|-----------|
| `APCo` + `Vendor` | `VENDOR-#` | `VendorNumber` | Concatenate or direct |
| `Name` | `VENDOR-NAME` | `LegalName` | Direct |
| `SortName` | `SORT-NAME` | `DbaName` | Direct |
| `TaxId` | `TAX-ID` | `TaxIdEncrypted` | Encrypt |
| `PayTerms` | `PAY-TERMS` | `DefaultPaymentTerms` | ValueMap |
| `Status` | `STATUS` | `Status` | ValueMap |
| `1099YN` | `1099-FLAG` | `Is1099Eligible` | Boolean conversion |
| `Address` / `Address2` | `ADDRESS-1/2` | `RemitAddressLine1/2` | Direct |
| `City` / `State` / `Zip` | `CITY/STATE/ZIP` | `City/State/Zip` | Direct |

**Special handling:**
- Tax ID: Encrypted on import. Validate format (XX-XXXXXXX for EIN, XXX-XX-XXXX for SSN).
- Duplicate detection: Match on TaxId OR (LegalName fuzzy match + State).
- Insurance: Vista `InsExpDate` → create `VendorInsurancePolicy` stub with expiry date.

### 6.6 Customers / Owners

| Source Field (Vista) | Source Field (Sage) | Pitbull Field | Transform |
|---------------------|--------------------|--------------|-----------|
| `ARCo` + `Customer` | `CUSTOMER-#` | `CustomerNumber` | Concatenate or direct |
| `Name` | `CUSTOMER-NAME` | `LegalName` | Direct |
| `BillAddress` / etc. | `ADDRESS-1/2/CITY/STATE/ZIP` | `BillingAddress*` | Direct |
| `PayTerms` | `PAY-TERMS` | `PaymentTerms` | ValueMap |
| `RetPct` | `RETAINAGE-%` | `DefaultRetentionPercent` | Decimal |

### 6.7 Chart of Accounts

| Source Field (Vista) | Source Field (Sage) | Pitbull Field | Transform |
|---------------------|--------------------|--------------|-----------|
| `GLCo` + `GLAcct` | `ACCOUNT-#` | `AccountCode` | CodeTranslation (see §10 Vista-specific) |
| `Description` | `DESCRIPTION` | `Name` | Direct |
| `AcctType` (A/L/O/R/E) | `ACCOUNT-TYPE` | `AccountType` | ValueMap (A→Asset, L→Liability, O→Equity, R→Revenue, E→Expense) |
| `NormBal` (D/C) | `NORMAL-BAL` | `NormalBalance` | ValueMap |
| `Active` (Y/N) | `STATUS` | `IsActive` | Boolean |
| `Summary` (Y/N) | `HEADER-FLAG` | `IsParent` | Boolean |

**Special handling:**
- Vista uses a 6-digit GL account with implicit hierarchy (first 4 digits = account, last 2 = sub-account). See §10.
- Sage uses a segmented account format (e.g., `01-4000-000`). Parse segments.
- QuickBooks uses text-based account names with indentation for hierarchy.

### 6.8 Open AP Invoices

| Source Field (Vista) | Pitbull Field | Transform |
|---------------------|--------------|-----------|
| `APCo` + `Vendor` | `VendorId` | Lookup (vendor must be imported first) |
| `APTrans` + `APLine` | `InvoiceNumber` | Concatenate |
| `InvDate` | `InvoiceDate` | DateFormat |
| `DueDate` | `DueDate` | DateFormat |
| `GrossAmt` | `TotalAmount` | Decimal |
| `PaidAmt` | (computed) | `BalanceAmount = GrossAmt - PaidAmt` |
| `Job` | `ProjectId` | Lookup (project must be imported first) |
| `Phase` + `CostType` | `CostCodeId` | Lookup (cost code must be imported first) |
| `GLAcct` | `GlAccountCode` | Lookup (GL account must be imported first) |
| `PayStatus` | `Status` | ValueMap (open only — skip paid invoices) |

**Special handling:**
- Only import **open** invoices (unpaid balance > 0). Historical paid invoices are optional.
- Verify: `SUM(imported open AP) = source AP trial balance`. This is the critical reconciliation check.
- Retention: If Vista tracks retention on the invoice, import as `RetainageApplied`.

### 6.9 Open AR Invoices

| Source Field (Vista) | Pitbull Field | Transform |
|---------------------|--------------|-----------|
| `ARCo` + `Customer` | `CustomerOwnerId` | Lookup |
| `TransType` + `Invoice` | `BillingNumber` | Concatenate |
| `InvDate` | `BillingDate` | DateFormat |
| `DueDate` | `DueDate` | DateFormat |
| `Amount` | `GrossAmount` | Decimal |
| `RetainageAmt` | `RetainageWithheld` | Decimal |
| `PaidAmt` | (computed) | `NetDue = Amount - PaidAmt - RetainageAmt` |
| `Job` | `ProjectId` | Lookup |

**Special handling:**
- Only import open receivables.
- Retention receivable imported as separate `RetentionLedger` entries.
- Verify: `SUM(imported open AR) = source AR trial balance`.

### 6.10 Job Cost History

| Source Field (Vista) | Pitbull Field | Transform |
|---------------------|--------------|-----------|
| `JCCo` + `Job` | `ProjectId` | Lookup |
| `Phase` + `CostType` | `CostCodeId` | Lookup |
| `ActualDate` | `TransactionDate` | DateFormat |
| `ActualCost` | `Amount` | Decimal |
| `Source` (AP/PR/JE/PO) | `TransactionType` | ValueMap (AP→Subcontractor, PR→Labor, JE→Adjustment, PO→Material) |
| `Vendor` | `VendorId` | Lookup (optional) |
| `OrigBudget` | `OriginalBudget` | Decimal (if budget import) |
| `CurrBudget` | `RevisedBudget` | Decimal (if budget import) |

**Special handling:**
- Job cost history can be massive (hundreds of thousands of records). Import in chunks.
- Option: import summary-level only (cost-to-date per cost code) instead of every transaction.
- Budget data: Import original and revised budgets at cost code level for active projects.

---

## 7. Validation Engine

### 7.1 Validation Pipeline

Every imported row passes through a multi-stage validation pipeline before staging.

```
Raw Row
  │
  ▼
┌─────────────────────┐
│ Stage 1: Schema      │  Column count matches? Required columns present?
│ Validation           │  File structure intact?
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Stage 2: Type        │  Numbers are numeric? Dates are valid?
│ Validation           │  Enums are recognized values?
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Stage 3: Required    │  All required fields have non-empty values?
│ Field Checks         │  Required field list varies by entity type
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Stage 4: Business    │  Values within acceptable ranges?
│ Rule Validation      │  Status codes recognized?
│                      │  Amounts reasonable?
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Stage 5: Referential │  FK references exist in Pitbull?
│ Integrity            │  Cross-entity relationships valid?
│                      │  (vendor exists for AP invoice, etc.)
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Stage 6: Duplicate   │  Does this record already exist in Pitbull?
│ Detection            │  Fuzzy matching on key fields
└─────────┬───────────┘
          │
          ▼
  Validated Row → Staging Table
```

### 7.2 Validation Rules by Entity

**Employees:**
| Rule | Type | Severity |
|------|------|----------|
| Employee number unique per company | Duplicate | Error |
| First name + last name not empty | Required | Error |
| Base hourly rate > 0 and < 500 | Range | Error |
| Email format valid (if provided) | Format | Warning |
| SSN format valid (if provided) | Format | Warning |
| Hire date not in the future | Logic | Warning |
| No existing employee with same SSN | Duplicate | Error |

**Projects:**
| Rule | Type | Severity |
|------|------|----------|
| Project number unique per company | Duplicate | Error |
| Name not empty | Required | Error |
| Contract amount >= 0 | Range | Error |
| Customer exists (if specified) | Referential | Warning (can create stub) |
| Start date before end date | Logic | Warning |
| No existing project with same number | Duplicate | Error |

**Vendors:**
| Rule | Type | Severity |
|------|------|----------|
| Vendor number unique per company | Duplicate | Error |
| Legal name not empty | Required | Error |
| Tax ID format valid (if provided) | Format | Warning |
| No existing vendor with same tax ID | Duplicate | Warning (may be intentional) |
| State abbreviation valid | Format | Warning |

**Open AP Invoices:**
| Rule | Type | Severity |
|------|------|----------|
| Vendor exists in Pitbull | Referential | Error |
| Project exists (if specified) | Referential | Error |
| Invoice number unique per vendor | Duplicate | Error |
| Balance amount > 0 | Logic | Error |
| Due date not more than 365 days past | Logic | Warning |
| GL account exists (if specified) | Referential | Warning |

**Chart of Accounts:**
| Rule | Type | Severity |
|------|------|----------|
| Account code unique per company | Duplicate | Error |
| Account type is valid enum | Format | Error |
| Description not empty | Required | Error |
| Parent account exists (if specified) | Referential | Error |

### 7.3 Duplicate Detection Strategies

| Entity | Primary Match | Secondary Match | Fuzzy Match |
|--------|-------------|----------------|-------------|
| Employee | SSN (exact) | Employee Number | FirstName + LastName (Levenshtein ≤ 2) |
| Vendor | Tax ID (exact) | Vendor Number | LegalName (similarity > 85%) |
| Customer | Customer Number | - | LegalName (similarity > 85%) |
| Project | Project Number | - | Name (similarity > 90%) |
| GL Account | Account Code | - | - |
| Cost Code | Code (exact) | - | Description (similarity > 90%) |

When a duplicate is detected, the user can:
- **Skip** — don't import this row
- **Update** — merge source data into existing record (field-by-field control)
- **Create as new** — import anyway with modified identifier
- **Flag for review** — import to staging only, don't commit

---

## 8. Reconciliation Cockpit

### 8.1 Purpose

The reconciliation cockpit proves that the import was accurate by comparing source system control totals against Pitbull's imported data. This is the System Admin's "sign-off" screen before the migration is considered complete.

### 8.2 Control Totals

| Entity Type | Control Totals Compared |
|------------|------------------------|
| Employees | Record count, active count, inactive count |
| Vendors | Record count, active count, 1099-eligible count |
| Customers | Record count, active count |
| Projects | Record count, active count, total contract value |
| Cost Codes | Record count by cost type |
| GL Accounts | Record count, count by account type |
| Open AP | Record count, total balance, balance by vendor (top 10), oldest invoice date |
| Open AR | Record count, total balance, total retention, balance by customer (top 10) |
| Job Cost | Total cost by project, total cost by cost type, total budget, total variance |

### 8.3 ReconciliationReport Entity

```
ReconciliationReport
├── Id : Guid (PK)
├── TenantId : Guid (RLS)
├── CompanyId : Guid
├── MigrationProjectId : Guid (FK)
├── ImportBatchId : Guid (FK)
├── EntityType : string
│
│  Source Totals (entered by user or parsed from source report)
├── SourceRecordCount : int
├── SourceControlTotals : string (JSON) — entity-specific totals
│
│  Imported Totals (calculated from Pitbull data)
├── ImportedRecordCount : int
├── ImportedControlTotals : string (JSON)
│
│  Comparison
├── Differences : string (JSON) — list of discrepancies
├── HasDiscrepancies : bool
├── SignedOffById : Guid?
├── SignedOffDate : DateTimeOffset?
├── SignOffNotes : string?
│
├── CreatedAt / CreatedBy / UpdatedAt / UpdatedBy (BaseEntity)
```

### 8.4 Reconciliation Workflow

```
Import Batch Completes
        │
        ▼
  System auto-calculates imported totals
        │
        ▼
  Admin enters source totals (from legacy system reports)
  ├── Option A: Upload a legacy report → AI extracts totals
  ├── Option B: Manual entry of key numbers
  └── Option C: API query of legacy system (if direct connection available)
        │
        ▼
  System compares and highlights discrepancies
        │
        ├── All match → Green "Reconciled" status
        │     └── Admin signs off → import locked
        │
        └── Discrepancies found → Red "Unreconciled" status
              ├── Admin investigates (drill into exception records)
              ├── Fix individual records → re-run reconciliation
              └── Accept discrepancy with documented reason
```

### 8.5 Exception Drill-Down

From any discrepancy in the reconciliation report, the admin can:

1. **View skipped records** — records that failed validation and were excluded
2. **View duplicates** — records that matched existing data and were merged/skipped
3. **View transformation log** — field-by-field before/after for every transformed value
4. **Compare source vs. imported** — side-by-side view of any individual record
5. **Re-import single record** — fix the source data and re-import just that record

---

## 9. Rollback Capability

### 9.1 Design

Every import batch is tagged with a `MigrationBatchId`. Rollback deletes all records created by that batch.

```
Rollback Process:
  1. Admin clicks "Rollback Batch" on reconciliation screen
  2. System shows impact analysis:
     - "This will remove 2,847 vendor records"
     - "WARNING: 23 AP invoices reference these vendors — they will also be removed"
     - "WARNING: 5 payment applications reference these vendors"
  3. Admin confirms (requires typing "ROLLBACK" to prevent accidents)
  4. System executes rollback in reverse dependency order:
     a. Remove referencing records (AP invoices, payment apps)
     b. Remove primary records (vendors)
     c. Update ImportBatch status to "RolledBack"
     d. Log rollback action in audit trail
  5. System verifies rollback: record counts return to pre-import state
```

### 9.2 MigrationBatchTag

Every record created by an import carries a migration tag:

```
MigrationBatchTag
├── EntityType : string — "Vendor", "Employee", etc.
├── EntityId : Guid — PK of the imported record
├── ImportBatchId : Guid (FK → ImportBatch)
├── MigrationProjectId : Guid (FK → MigrationProject)
├── SourceSystem : string — "vista", "sage300", etc.
├── SourceIdentifier : string — original ID in source system (for traceability)
├── ImportedAt : DateTimeOffset
```

This table enables:
- Rollback (find all records from batch X, delete them)
- Audit trail (this vendor was imported from Vista on Feb 19)
- Source traceability (Pitbull vendor 123 = Vista vendor APCo1-V00456)

### 9.3 Rollback Rules

| Rule | Description |
|------|-------------|
| Cascade check | Before rollback, identify all records that reference the batch's records |
| Transaction-based modifications block rollback | If a user has modified an imported record, rollback requires confirmation |
| Newer import batches block rollback | Cannot roll back Batch 1 if Batch 2 references its records |
| Time limit | Rollback recommended within 72 hours. After that, a full reconciliation recheck is required. |
| Audit trail | Rollback itself is an audited event — who, when, why |

### 9.4 Partial Rollback

In some cases, the admin may want to rollback specific records rather than an entire batch:

- **Exclude and re-import:** Remove a subset of records and re-import them with corrected data
- **Undo merge:** If a duplicate was merged, revert the merge and keep the original Pitbull record
- **Record-level rollback:** Restore a single record to its pre-import state

---

## 10. Vista-Specific Handling

### 10.1 Company Code Mapping

Vista uses a multi-company architecture where every entity includes a company code prefix (`APCo`, `JCCo`, `PRCo`, `ARCo`, `GLCo`). These may differ — a company might use APCo=1 for AP but GLCo=10 for GL.

```
VistaCompanyMapping
├── Id : Guid (PK)
├── TenantId : Guid (RLS)
├── MigrationProjectId : Guid (FK)
├── VistaCompanyCode : int — Vista's company number (1, 10, 50, etc.)
├── VistaCompanyType : string — "APCo", "JCCo", "PRCo", "ARCo", "GLCo"
├── PitbullCompanyId : Guid — Pitbull company this maps to
├── Notes : string?
```

**Wizard Step:** Before any import, the admin maps Vista company codes to Pitbull companies. The wizard presents all unique company codes found in the source files and asks the admin to assign each to a Pitbull company.

### 10.2 Cost Code Hierarchy Translation

Vista uses a flat 6-digit phase code with an implicit hierarchy:
- Digits 1-2: CSI Division (e.g., `03` = Concrete)
- Digits 3-4: Phase within division (e.g., `10` = Foundations)
- Digits 5-6: Sub-phase (e.g., `00` = General)

Combined with a separate Cost Type field (1-5):
- 1 = Labor
- 2 = Material
- 3 = Subcontract
- 4 = Equipment
- 5 = Other

**Translation to Pitbull:**

```
Vista: Phase "031000", CostType 1
  → Pitbull: Code "03-100", CostType "Labor", Description "Concrete Foundations - Labor"

Vista: Phase "092000", CostType 2
  → Pitbull: Code "09-200", CostType "Material", Description "Finishes Drywall - Material"
```

The migration tool provides a visual hierarchy editor where the admin can see the Vista codes mapped to Pitbull's tree structure and adjust descriptions.

### 10.3 GL Account Translation

Vista GL accounts are 6 digits with company prefix:

```
Vista: GLCo 1, GLAcct 110000 → "Cash - Operating"
Vista: GLCo 1, GLAcct 120000 → "Accounts Receivable"
Vista: GLCo 1, GLAcct 200000 → "Accounts Payable"
```

Pitbull uses a segmented account code (e.g., `1100-00` or hierarchical). The mapping tool provides:

1. **Auto-map by description:** AI matches "Cash - Operating" → Pitbull's "1000 Cash and Cash Equivalents"
2. **Pattern-based mapping:** "11XXXX" → "11XX-XX" with segment insertion
3. **Manual override:** Drag-and-drop from Vista account list to Pitbull account tree
4. **Unmapped account report:** Highlight accounts that couldn't be auto-mapped

### 10.4 Pay Group Conversion

Vista uses Pay Groups to define pay frequencies and payroll processing rules:

| Vista Pay Group | Description | Pitbull Equivalent |
|----------------|-------------|-------------------|
| 1 | Weekly (field hourly) | PayFrequency.Weekly |
| 2 | Bi-weekly (office hourly) | PayFrequency.BiWeekly |
| 3 | Semi-monthly (salaried) | PayFrequency.SemiMonthly |
| 4 | Monthly (executives) | PayFrequency.Monthly |

The migration tool maps pay groups to Pitbull pay frequencies and assigns employees to the correct pay period configuration.

### 10.5 Vista-Specific Quirks

| Quirk | Handling |
|-------|---------|
| Dates as `MM/DD/YYYY` strings | Auto-detect and parse |
| Amounts stored as integers (cents) | Divide by 100 when `AmtFormat = "integer"` |
| Soft-deleted records (status = 'I') | Import with `IsActive = false` or skip (configurable) |
| Multi-line addresses stored as pipe-delimited | Split on pipe, assign to Address1/Address2 |
| Cost types as numbers (1-5) | Map to enum values |
| Company-prefixed identifiers | Strip prefix or concatenate per company mapping |
| Encrypted fields | Require admin to provide Vista decryption key |
| Memo fields with embedded delimiters | Escape delimiters during CSV parsing |

---

## 11. AI Agent Opportunities

### 11.1 Source Format Auto-Detection Agent

**Trigger:** File uploaded to import wizard
**Action:**
1. Read first 100 rows + all column headers
2. Match column names against known source system signatures:
   - Vista keywords: `APCo`, `JCCo`, `PRCo`, `GLCo`, `APVendor`, `JCCostType`
   - Sage keywords: `REC#`, `REC-TYPE`, `VENDOR-#`, `JOB-#`
   - Foundation keywords: `VENDOR_NO`, `JOB_NO`, `PHASE_NO`
   - QuickBooks keywords: `!HDR`, `!SPL`, `!TRNS`, `*Name`
3. Return: source system, confidence score, entity type, detected version
4. If low confidence: present top 3 guesses with sample data explaining each

**Value:** Admin doesn't need to tell the system what they're importing — it figures it out.

### 11.2 Field Mapping Suggestion Agent

**Trigger:** Source detected, mapping step opened
**Action:**
1. Start with pre-built mapping profile for detected source system
2. For any columns not in the profile (custom fields, renamed columns):
   - Analyze column name semantics ("VendorAddr1" → Address, "Ins_Exp" → Insurance Expiration)
   - Analyze sample data types and patterns (dates, phone numbers, SSNs, dollar amounts)
   - Analyze value distributions (if 90% of values are "Y"/"N", it's a boolean)
3. Return mapping suggestions with confidence scores
4. Explain reasoning: "Column 'Ins_Exp' contains date values and name suggests insurance expiration → mapped to VendorInsurancePolicy.ExpirationDate (confidence: 0.87)"

**Value:** Reduces manual mapping work from 30 minutes to 5 minutes per entity type.

### 11.3 Unmapped Data Classifier Agent

**Trigger:** Mapping step has unmapped columns
**Action:**
1. Analyze unmapped columns for potential value:
   - Is this a note/comment field? → Map to Notes or ignore
   - Is this a custom field? → Suggest custom field creation
   - Is this redundant? (same data as a mapped column) → Suggest ignore
   - Is this a related entity's field? (vendor phone in an AP invoice export) → Suggest separate import
2. Present classification with recommended action per column

**Value:** Prevents important data from being silently lost during migration.

### 11.4 Anomaly Detection Agent

**Trigger:** Validation stage complete
**Action:**
1. Scan for statistical anomalies across the import dataset:
   - Dollar amounts: outliers more than 3σ from mean (e.g., one AP invoice for $50M in a dataset where mean is $10K)
   - Dates: records with dates far outside the expected range (invoices from 2005 in a 2026 import)
   - Counts: entities with unusual numbers of related records (vendor with 500 invoices vs. average of 10)
   - Patterns: sudden changes in data density (lots of records in one month, none in the next)
2. Flag anomalies with explanations:
   - "Vendor 'ABC Corp' has 847 open invoices (average is 12). Is this correct, or is this including paid invoices?"
   - "3 projects have contract amounts over $50M. Your average project is $2.5M. Please verify."
3. Categorize: likely data error vs. legitimate outlier

**Value:** Catches data export errors from legacy systems that would corrupt Pitbull's data if imported.

### 11.5 Reconciliation Assistant Agent

**Trigger:** Reconciliation cockpit opened
**Action:**
1. If admin uploads a legacy report (e.g., Vista AP aging report as PDF/CSV):
   - OCR/parse the report
   - Extract control totals (record count, total balance, aging buckets)
   - Auto-populate source totals in reconciliation report
2. If discrepancies exist:
   - Analyze the difference and suggest root cause:
     - "Source has 312 vendors but import shows 308. 4 vendors had duplicate TaxIds and were merged."
     - "AP balance differs by $12,500. This matches the 3 invoices that were skipped due to missing vendor records."
   - Suggest resolution: "Import the 3 missing vendor records first, then re-import the 3 AP invoices."

**Value:** Reconciliation that would take hours of manual comparison is done in minutes.

---

## 12. Predictive Features

### 12.1 Import Time Estimation

Before the admin clicks "Import," the system predicts how long the import will take:

```
Estimation Model:
  base_time = record_count × time_per_record[entity_type]
  validation_multiplier = 1.0 + (error_rate × 0.5)
  referential_check_time = fk_field_count × lookup_time × record_count
  estimated_total = (base_time × validation_multiplier) + referential_check_time

Benchmarks:
  employees:  ~50ms per record (simple, few FKs)
  vendors:    ~60ms per record (address parsing, duplicate check)
  projects:   ~80ms per record (customer lookup, status mapping)
  AP invoices: ~150ms per record (vendor + project + GL lookups)
  job cost:   ~30ms per record (high volume, simple structure)
```

**Display:** "Estimated import time: 4 minutes 30 seconds for 2,847 vendor records"

### 12.2 Entity Confidence Score

Before committing, the system shows a per-entity confidence score:

```
Migration Confidence Dashboard
──────────────────────────────────────────────
Entity          Records  Valid%  Confidence  Status
Employees         50      98%      🟢 High    Ready
Vendors          312      95%      🟢 High    Ready
Projects          10     100%      🟢 High    Ready
Cost Codes       180      92%      🟡 Medium  Review mappings
GL Accounts      245      88%      🟡 Medium  12 unmapped
Open AP          847      76%      🟠 Low     23 missing vendors
Open AR           45      91%      🟢 High    Ready
Job Cost       12,450     94%      🟢 High    Ready
──────────────────────────────────────────────
Overall Confidence: 🟡 Medium (Open AP needs vendor fix)
```

**Confidence factors:**
- Validation pass rate (% of rows with no errors)
- Mapping confidence (average AI confidence across field mappings)
- Referential integrity score (% of FK lookups that resolved)
- Duplicate resolution rate (% of duplicates auto-resolved)
- Control total reconciliation status

### 12.3 Migration Health Dashboard

A real-time dashboard tracking the overall migration progress:

```
Migration Health: "ACME Construction → Pitbull"
──────────────────────────────────────────────
Started: Feb 19, 2026 9:00 AM
Source: Vista/Viewpoint 6.0

Phase 1: Masters                    ████████████ 100%
  ├── Employees (50)                 ✓ Reconciled
  ├── Vendors (312)                  ✓ Reconciled
  ├── Customers (28)                 ✓ Reconciled
  ├── Cost Codes (180)               ✓ Reconciled
  └── GL Accounts (245)              ⚠ 12 unmapped (non-blocking)

Phase 2: Project Structure          ████████░░░░  67%
  ├── Projects (10)                  ✓ Reconciled
  ├── Subcontracts (47)              ✓ Reconciled
  └── Change Orders (23)             ⏳ In Progress

Phase 3: Open Balances              ░░░░░░░░░░░░   0%
  ├── Open AP ($4.5M)                ○ Not Started
  ├── Open AR ($2.1M)                ○ Not Started
  └── Job Cost History               ○ Not Started

Migration Readiness: 67%
Estimated remaining: 2 hours 15 minutes
```

### 12.4 Pre-Migration Assessment

Before any data is imported, the admin can run a **pre-migration assessment** on uploaded files:

```
Pre-Migration Assessment Report
──────────────────────────────────────────────
Source: Vista AP Vendor Export (2,847 records)

Data Quality Score: 78/100

Issues Found:
  🔴 Critical (must fix):
     - 4 vendors with no legal name
     - 12 AP invoices referencing vendors not in export
  🟡 Warning (should fix):
     - 156 vendors missing tax classification
     - 42 addresses with invalid state codes
     - 8 phone numbers in incorrect format
  🔵 Info:
     - 23 inactive vendors included (consider excluding)
     - Date range: Jan 2019 - Feb 2026 (7 years of data)
     - 3 company codes detected (APCo: 1, 10, 50)

Recommendations:
  1. Re-export vendors with names — 4 are blank
  2. Run "Vendor Missing from AP" query in Vista to find the 12 missing vendors
  3. Consider excluding inactive vendors (saves cleanup later)

Estimated migration time: 45 minutes (3 phases)
```

### 12.5 Post-Migration Validation Predictor

After migration, predict potential issues:

| Prediction | Based On | Alert |
|-----------|----------|-------|
| First AP payment run may fail | Vendors imported without bank details | "28 vendors need payment method setup before AP payment run" |
| AR aging will look wrong | Open AR imported without original invoice dates | "AR aging uses import date, not original billing date — verify" |
| Job cost report will show budget variance | Budgets imported at summary level, costs at detail | "Budget breakdown needed for 7 projects before job cost is meaningful" |
| Cost code mapping may cause re-coding | Vista codes mapped to different hierarchy | "15 cost codes were consolidated — time entries may need re-coding" |

---

## 13. Domain Entities — Complete Reference

### 13.1 Entity Relationship Diagram

```
┌──────────────────────┐
│  MigrationProject    │  The overall migration container
│  SourceSystem        │
│  Status              │
│  StartedDate         │
└──────────┬───────────┘
           │
    ┌──────┼──────────────────────────┐
    │      │                          │
    ▼      ▼                          ▼
┌──────────────┐  ┌────────────────┐  ┌────────────────────┐
│ ImportBatch  │  │ MappingProfile │  │VistaCompanyMapping │
│ (extended)   │  │ FieldMappings  │  │ VistaCode → Pitbull│
│ Type, Status │  │ Transforms     │  └────────────────────┘
│ Totals       │  └────────────────┘
└──────┬───────┘
       │
┌──────┼──────────────────┐
│      │                  │
▼      ▼                  ▼
┌──────────────┐  ┌──────────────────┐  ┌─────────────────────┐
│MigrationBatch│  │ ValidationResult │  │ ReconciliationReport│
│  Tag         │  │ Errors[]         │  │ SourceTotals        │
│ EntityType   │  │ Warnings[]       │  │ ImportedTotals      │
│ EntityId     │  │ Stage            │  │ Differences         │
│ SourceId     │  └──────────────────┘  │ SignedOff?          │
└──────────────┘                        └─────────────────────┘
```

### 13.2 MigrationProject Entity

```
MigrationProject
├── Id : Guid (PK)
├── TenantId : Guid (RLS)
├── CompanyId : Guid
├── Name : string — "Vista Migration - February 2026"
├── SourceSystem : string — "vista", "sage300", etc.
├── SourceVersion : string?
├── Status : enum (Planning, InProgress, Reconciling, Complete, Abandoned)
├── StartedDate : DateTimeOffset
├── CompletedDate : DateTimeOffset?
├── StartedById : Guid
├── Notes : string?
│
│  Phase Tracking
├── Phase1MastersComplete : bool
├── Phase2ProjectsComplete : bool
├── Phase3BalancesComplete : bool
│
│  Summary Stats
├── TotalBatches : int
├── TotalRecordsImported : int
├── TotalRecordsSkipped : int
├── TotalRecordsFailed : int
│
├── CreatedAt / CreatedBy / UpdatedAt / UpdatedBy (BaseEntity)
```

### 13.3 Extended ImportBatch

The existing `ImportBatch` entity is extended with migration-specific fields:

```
ImportBatch (extended)
├── ... (existing fields: Type, Status, TotalRows, ValidRows, ErrorRows, ErrorDetails)
│
│  New Fields
├── MigrationProjectId : Guid? (FK — null for non-migration imports)
├── MappingProfileId : Guid? (FK — mapping configuration used)
├── SourceSystem : string?
├── SourceFileName : string?
├── EntityType : string — more granular than Type (e.g., "open-ap-invoices" vs. "vendors")
├── ValidationPassRate : decimal(5,2)
├── RolledBack : bool
├── RolledBackAt : DateTimeOffset?
├── RolledBackById : Guid?
├── RollbackReason : string?
├── ReconciliationReportId : Guid?
├── ControlTotalsJson : string? — JSON snapshot of key totals at import time
```

### 13.4 New Enums

```csharp
public enum MigrationProjectStatus { Planning, InProgress, Reconciling, Complete, Abandoned }
public enum MappingType { Direct, Transformed, Constant, Computed, Ignored }
public enum TransformationRuleType { ValueMap, DateFormat, NumberFormat, CodeTranslation,
                                     Concatenate, Split, Lookup, RegexReplace, Custom }
public enum ValidationSeverity { Error, Warning, Info }
public enum ValidationStage { Schema, TypeCheck, RequiredField, BusinessRule,
                              ReferentialIntegrity, DuplicateDetection }
public enum DuplicateAction { Skip, Update, CreateNew, FlagForReview }
```

### 13.5 Database Tables

| Table | Key Columns | Indexes |
|-------|------------|---------|
| `migration_projects` | id, tenant_id, company_id | (tenant_id, company_id, status) |
| `mapping_profiles` | id, tenant_id, company_id | (tenant_id, source_system, entity_type), (tenant_id, is_template) |
| `field_mappings` | id, mapping_profile_id | (mapping_profile_id, sort_order) |
| `transformation_rules` | id, mapping_profile_id | (mapping_profile_id) |
| `migration_batch_tags` | entity_type, entity_id, import_batch_id | (import_batch_id), (entity_type, entity_id) UNIQUE, (migration_project_id) |
| `validation_results` | id, import_batch_id | (import_batch_id, severity), (import_batch_id, stage) |
| `reconciliation_reports` | id, migration_project_id, import_batch_id | (migration_project_id, entity_type) |
| `vista_company_mappings` | id, migration_project_id | (migration_project_id, vista_company_code, vista_company_type) |
| `source_system_profiles` | id | (id) — system reference data, not tenant-scoped |

---

## 14. API Surface

### 14.1 Migration Project APIs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/migration/projects` | List migration projects |
| GET | `/api/migration/projects/{id}` | Get project detail with phase status |
| POST | `/api/migration/projects` | Create a new migration project |
| PUT | `/api/migration/projects/{id}` | Update project metadata |
| POST | `/api/migration/projects/{id}/complete` | Mark migration as complete |
| POST | `/api/migration/projects/{id}/abandon` | Abandon a migration |
| GET | `/api/migration/projects/{id}/dashboard` | Migration health dashboard data |

### 14.2 Source Detection APIs

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/migration/detect-source` | Upload file → detect source system |
| GET | `/api/migration/source-profiles` | List supported source systems |
| GET | `/api/migration/source-profiles/{id}` | Get source system profile with export guide |

### 14.3 Mapping APIs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/migration/mapping-profiles` | List saved mapping profiles |
| GET | `/api/migration/mapping-profiles/{id}` | Get mapping profile with field mappings |
| POST | `/api/migration/mapping-profiles` | Create mapping profile from template |
| PUT | `/api/migration/mapping-profiles/{id}` | Update mapping profile |
| POST | `/api/migration/mapping-profiles/{id}/auto-map` | AI auto-map unmapped columns |
| GET | `/api/migration/mapping-profiles/templates` | List system-provided templates |

### 14.4 Import APIs (extend existing)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/migration/import/preview` | Preview import with mapping profile |
| POST | `/api/migration/import/validate` | Run full validation pipeline |
| POST | `/api/migration/import/execute` | Execute import batch |
| POST | `/api/migration/import/{batchId}/rollback` | Rollback an import batch |
| GET | `/api/migration/import/{batchId}/status` | Get import progress |
| GET | `/api/migration/import/{batchId}/errors` | Get validation errors |
| GET | `/api/migration/import/{batchId}/transformation-log` | Get transformation details |
| POST | `/api/migration/import/{batchId}/fix-and-retry` | Re-import specific records |

### 14.5 Entity-Specific Import APIs

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/migration/import/employees` | Import employees with migration tracking |
| POST | `/api/migration/import/vendors` | Import vendors |
| POST | `/api/migration/import/customers` | Import customers/owners |
| POST | `/api/migration/import/projects` | Import projects |
| POST | `/api/migration/import/cost-codes` | Import cost codes |
| POST | `/api/migration/import/gl-accounts` | Import chart of accounts |
| POST | `/api/migration/import/open-ap` | Import open AP invoices |
| POST | `/api/migration/import/open-ar` | Import open AR invoices |
| POST | `/api/migration/import/job-cost` | Import job cost history |
| POST | `/api/migration/import/subcontracts` | Import subcontracts |
| POST | `/api/migration/import/change-orders` | Import change orders |

### 14.6 Reconciliation APIs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/migration/reconciliation/{batchId}` | Get reconciliation report |
| POST | `/api/migration/reconciliation/{batchId}/source-totals` | Enter source control totals |
| POST | `/api/migration/reconciliation/{batchId}/upload-report` | Upload legacy report for AI extraction |
| POST | `/api/migration/reconciliation/{batchId}/recalculate` | Recalculate imported totals |
| POST | `/api/migration/reconciliation/{batchId}/sign-off` | Admin sign-off |
| GET | `/api/migration/reconciliation/{batchId}/exceptions` | Drill into discrepancies |

### 14.7 Vista-Specific APIs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/migration/vista/company-mappings/{projectId}` | Get Vista company mappings |
| PUT | `/api/migration/vista/company-mappings/{projectId}` | Set Vista company mappings |
| POST | `/api/migration/vista/detect-companies` | Detect Vista company codes from uploaded file |
| GET | `/api/migration/vista/cost-code-preview/{projectId}` | Preview Vista cost code translation |
| GET | `/api/migration/vista/gl-account-preview/{projectId}` | Preview GL account translation |

### 14.8 AI Suggestion APIs

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/migration/ai/detect-format` | AI source format detection |
| POST | `/api/migration/ai/suggest-mappings` | AI field mapping suggestions |
| POST | `/api/migration/ai/classify-unmapped` | AI classification of unmapped columns |
| POST | `/api/migration/ai/detect-anomalies` | AI anomaly detection on validated data |
| POST | `/api/migration/ai/extract-totals` | AI extraction of control totals from uploaded report |
| GET | `/api/migration/ai/pre-assessment/{batchId}` | Pre-migration assessment report |

---

## 15. Implementation Phases

### Phase 1: Enhanced Import Foundation (Sprint 1-3)

**Scope:**
- `MigrationProject` entity and lifecycle management
- `MappingProfile`, `FieldMapping`, `TransformationRule` entities
- `MigrationBatchTag` entity for rollback tracking
- Extend existing `ImportBatch` with migration-specific fields
- Generic CSV/Excel import with manual column mapping UI
- Basic transformation rules (ValueMap, DateFormat, Direct)
- Rollback capability for any import batch
- Import dependency order enforcement

**Dependencies:** Existing `DataImportController`, `DataImportService`, `ImportBatch`

**Acceptance:** Admin can upload a generic CSV, map columns manually, preview, validate, import, and rollback. Migration project tracks overall progress.

### Phase 2: Vista/Sage Source Profiles (Sprint 4-5)

**Scope:**
- Source system auto-detection from column patterns
- Pre-built `SourceSystemProfile` for Vista and Sage 300
- Pre-built mapping templates for all entity types (employees, vendors, projects, cost codes, GL accounts)
- Vista company code mapping
- Vista cost code hierarchy translation
- Vista GL account translation
- Vista pay group conversion
- Vista-specific transformation rules
- Sage-specific transformation rules

**Dependencies:** Phase 1

**Acceptance:** Admin uploads a Vista AP vendor export → system auto-detects Vista, pre-fills all mappings, handles company codes and cost code translation. Same for Sage 300.

### Phase 3: Validation Engine + Per-Entity Importers (Sprint 6-8)

**Scope:**
- Full 6-stage validation pipeline
- Per-entity validation rules (employees, vendors, projects, cost codes, GL accounts)
- Duplicate detection with configurable strategies
- Referential integrity checking across import batches
- Open AP and AR invoice importers with FK validation
- Job cost history importer (summary and detail modes)
- Subcontract and change order importers
- Validation error UI with inline fix, skip, and re-validate

**Dependencies:** Phase 2

**Acceptance:** Validation catches all data quality issues before import. Admin can fix errors inline. All 10+ entity types import correctly with cross-entity referential integrity.

### Phase 4: Reconciliation Cockpit (Sprint 9-10)

**Scope:**
- `ReconciliationReport` entity and workflow
- Control total calculation for all entity types
- Source total entry (manual and report upload)
- Side-by-side comparison UI
- Exception drill-down
- Admin sign-off workflow
- Fix-and-retry for individual records
- Partial rollback capability

**Dependencies:** Phase 3

**Acceptance:** Admin can prove import accuracy by reconciling source vs. imported totals. Discrepancies are explained and resolvable. Sign-off creates audit trail.

### Phase 5: Foundation/QuickBooks + Import Wizard UI (Sprint 11-12)

**Scope:**
- Foundation Software source profile
- QuickBooks Desktop (IIF) source profile
- QuickBooks Online (CSV) source profile
- Full import wizard UI (6-step flow: upload → detect → map → validate → import → reconcile)
- Export guides with screenshots for each source system
- Saved mapping profile management
- Import history and batch comparison

**Dependencies:** Phases 1-4

**Acceptance:** Migration wizard handles Vista, Sage, Foundation, QuickBooks, and generic CSV in a single unified workflow.

### Phase 6: AI & Predictive Features (Sprint 13-14)

**Scope:**
- Source format auto-detection agent
- Field mapping suggestion agent
- Unmapped data classifier agent
- Anomaly detection agent
- Reconciliation assistant agent (report OCR + total extraction)
- Import time estimation
- Entity confidence scoring
- Migration health dashboard
- Pre-migration assessment
- Post-migration validation predictor

**Dependencies:** Phases 1-5

**Acceptance:** AI auto-detects source format, suggests field mappings with high accuracy, catches anomalies, and assists with reconciliation. Migration health dashboard provides real-time visibility.

---

## 16. Acceptance Criteria

### Core Import
1. Admin can create a migration project and track multi-batch progress
2. CSV and Excel files upload and parse correctly (auto-detect encoding and delimiter)
3. Import enforces dependency order (masters before transactions)
4. Sequential import batches maintain referential integrity across batches
5. Every imported record is tagged with `MigrationBatchTag` for rollback traceability

### Source Detection & Mapping
6. Vista source files are auto-detected with >90% accuracy
7. Sage 300 source files are auto-detected with >90% accuracy
8. Pre-built mapping templates cover all standard export formats for Vista and Sage
9. Field mappings can be saved and reused across import batches
10. Transformation rules correctly handle Vista-specific formats (dates, amounts, codes)

### Per-Entity Importers
11. Employees import with all required fields and correct classification mapping
12. Vendors import with tax ID encryption and duplicate detection
13. Projects import with customer linkage and status mapping
14. Cost codes import with Vista hierarchy translation to Pitbull tree structure
15. GL accounts import with Vista 6-digit → Pitbull segmented translation
16. Open AP invoices import with vendor/project/GL lookups and balance verification
17. Open AR invoices import with customer/project lookups and retention tracking
18. Job cost history imports at both summary and detail levels

### Validation
19. All 6 validation stages execute in order and report errors per stage
20. Required field checks are entity-specific and configurable
21. Duplicate detection uses configurable matching strategies per entity
22. Referential integrity violations clearly identify the missing reference
23. Validation errors can be fixed inline without re-uploading the file

### Reconciliation
24. Control totals auto-calculate for all entity types after import
25. Source totals can be entered manually or extracted from uploaded reports
26. Side-by-side comparison highlights all discrepancies with drill-down
27. Admin sign-off creates an auditable record of migration acceptance
28. Exception list explains every skipped/failed record

### Rollback
29. Full batch rollback removes all records created by that batch
30. Rollback cascade check warns about dependent records before executing
31. Rollback is an audited action with reason tracking
32. Partial rollback allows removing specific records from a batch

### Vista-Specific
33. Vista company code mapping correctly routes entities to Pitbull companies
34. Vista 6-digit phase codes translate to Pitbull cost code hierarchy
35. Vista GL account translation preserves account type and hierarchy
36. Vista pay group conversion maps to Pitbull pay frequencies

### AI & Predictive
37. AI field mapping suggestions achieve >80% accuracy on standard exports
38. Anomaly detection flags statistical outliers before import
39. Migration health dashboard shows real-time progress across all phases
40. Import time estimation is within 25% of actual time

---

## Appendix A: Existing Code References

| File | Relevant Functionality |
|------|----------------------|
| `src/Pitbull.Api/Controllers/DataImportController.cs` | 5 import endpoints, confirm endpoint, history endpoint, 3 export endpoints |
| `src/Pitbull.Api/Services/DataImportService.cs` | Preview→Confirm workflow, CSV parsing, per-entity validation and import |
| `src/Modules/Pitbull.Core/Entities/ImportBatch.cs` | Import batch tracking entity with status and error counts |
| `src/Modules/Pitbull.Core/Data/ImportBatchConfiguration.cs` | EF configuration for ImportBatch |
| `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/admin/data-import/page.tsx` | Import UI (upload, preview, confirm) |

## Appendix B: Related Specifications

| Spec | Relationship |
|------|-------------|
| `docs/plans/ONBOARDING-FLOW-V2.md` | Import wizard is a key part of the 2-hour onboarding flow (Phase 1: AI-Assisted Data Import) |
| `docs/plans/AP-AR-FOUNDATION-SPEC.md` | `Vendor`, `CustomerOwner`, `ApInvoice`, `ArBilling` — entities that migration imports into |
| `docs/plans/GL-ACCOUNTING-SPEC.md` | `GlAccount`, `JournalEntry` — GL accounts and opening balance entries |
| `docs/plans/RETENTION-LIEN-WAIVER-SPEC.md` | `RetentionLedger` — AR retention entries from imported open receivables |
| `docs/roles/SYSTEM-ADMIN.md` | System Admin workflows for data import, module activation, and go-live |

## Appendix C: Vista Export Queries (Reference)

Common Vista SQL queries for export (included in export guides):

```sql
-- Vista AP Vendors
SELECT APCo, Vendor, Name, SortName, TaxId, PayTerms, Status, 1099YN,
       Address, City, State, Zip, Phone
FROM APVM
WHERE APCo = @Company

-- Vista Open AP
SELECT APCo, Vendor, APTrans, APLine, InvDate, DueDate, GrossAmt,
       (GrossAmt - PaidAmt) as Balance, Job, Phase, CostType, GLAcct
FROM APTD
WHERE APCo = @Company AND PaidDate IS NULL AND GrossAmt <> PaidAmt

-- Vista Employees
SELECT PRCo, Employee, FirstName, LastName, SSN, HrlyRate, Status,
       JCCraftClass, HireDate, Email, PRDept
FROM PREM
WHERE PRCo = @Company

-- Vista Projects
SELECT JCCo, Job, Description, Contract, Status, StartDate, BillToCustomer
FROM JCJM
WHERE JCCo = @Company

-- Vista Cost Codes (Phase)
SELECT JCCo, Job, PhaseGroup, Phase, Description, CostType, UM
FROM JCCH
WHERE JCCo = @Company AND Job = @Job

-- Vista GL Chart of Accounts
SELECT GLCo, GLAcct, Description, AcctType, NormBal, Active
FROM GLAC
WHERE GLCo = @Company
```
