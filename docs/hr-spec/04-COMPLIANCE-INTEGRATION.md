# HR Core Module - Compliance & Integration Specification

**Version:** 1.0  
**Date:** February 8, 2026  
**Status:** Draft  
**Module:** Pitbull.HRCore.Compliance  
**Source:** SYNTHESIS.md + COMPLIANCE-OFFICER.md requirements

---

## Table of Contents

1. [Overview](#1-overview)
2. [EEO Data Architecture](#2-eeo-data-architecture)
3. [I-9 / E-Verify Integration](#3-i-9--e-verify-integration)
4. [Document Storage System](#4-document-storage-system)
5. [Retention Policies](#5-retention-policies)
6. [Audit Logging](#6-audit-logging)
7. [State-Specific Compliance](#7-state-specific-compliance)
8. [TimeTracking Integration](#8-timetracking-integration)
9. [Implementation Checklist](#9-implementation-checklist)

---

## 1. Overview

### 1.1 Compliance Philosophy

HR data is **legally radioactive**. This specification treats compliance as a first-class architectural concern, not a bolt-on feature. Every design decision prioritizes:

1. **Audit survival** — When OFCCP auditors arrive, we answer in seconds, not days
2. **Discrimination prevention** — Technical barriers prevent misuse of protected data
3. **Retention automation** — Manual tracking fails at scale; the system enforces the law
4. **Multi-jurisdictional** — National (50-state) coverage from day 1

### 1.2 Regulatory Framework

| Regulation | Applicability | Key Requirements |
|------------|---------------|------------------|
| IRCA | All employees | I-9 within 3 days, E-Verify for certain states/contracts |
| FLSA | All employers | Payroll records 3 years |
| ERISA | Benefits participants | Benefits records 6 years |
| OSHA | All employers | Safety training records duration + 3 years |
| OFCCP | Federal contractors | Applicant flow, AAP data, 2-3 year retention |
| EEO-1 | 100+ employees or 50+ federal contractors | Annual demographic reporting |
| CCPA/CPRA | California employees | Privacy rights, deletion restrictions |
| State laws | Varies by state | CA pay transparency, NY salary history ban, etc. |

### 1.3 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HR CORE - COMPLIANCE LAYER                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         SEGREGATED DATA                               │  │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │  │
│  │  │    hr_eeo       │    │   hr_audit      │    │   hr_documents  │  │  │
│  │  │    schema       │    │    schema       │    │     schema      │  │  │
│  │  │  (demographics) │    │  (immutable)    │    │   (encrypted)   │  │  │
│  │  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘  │  │
│  │           │                      │                      │           │  │
│  │           └──────────────────────┼──────────────────────┘           │  │
│  │                                  │                                   │  │
│  │                    ┌─────────────▼─────────────┐                    │  │
│  │                    │   COMPLIANCE SERVICES     │                    │  │
│  │                    │  - RetentionEnforcer      │                    │  │
│  │                    │  - AuditLogger            │                    │  │
│  │                    │  - EVerifyClient          │                    │  │
│  │                    │  - StateComplianceEngine  │                    │  │
│  │                    └───────────────────────────┘                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        EXTERNAL INTEGRATIONS                          │  │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │  │
│  │  │    E-Verify     │    │  TimeTracking   │    │     Payroll     │  │  │
│  │  │   (DHS/SSA)     │    │    Module       │    │     Module      │  │  │
│  │  └─────────────────┘    └─────────────────┘    └─────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. EEO Data Architecture

### 2.1 Design Rationale

EEO demographic data (race, ethnicity, sex, veteran status, disability status) **must** be physically segregated from hiring-related employee data. This is not a preference—it's how you avoid discrimination lawsuits. If hiring managers can query EEO data during employment decisions, you've built a liability machine.

### 2.2 Segregated Schema Design

The `hr_eeo` schema exists as a completely separate PostgreSQL schema with its own access controls:

```sql
-- Create segregated schema
CREATE SCHEMA hr_eeo;

-- Grant schema usage only to EEO role
REVOKE ALL ON SCHEMA hr_eeo FROM PUBLIC;
GRANT USAGE ON SCHEMA hr_eeo TO hr_eeo_role;
```

#### 2.2.1 EEO Tables

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Table: hr_eeo.employee_demographics
-- Purpose: Voluntarily-reported demographic data for EEO-1 reporting
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE hr_eeo.employee_demographics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    employee_id uuid NOT NULL,  -- References hr.employees(id)
    
    -- Demographic data (all voluntarily reported)
    race varchar(50),  -- White, Black/African American, Asian, etc.
    ethnicity varchar(30),  -- Hispanic/Latino, Not Hispanic/Latino
    sex varchar(20),  -- Male, Female, Decline to Answer
    veteran_status varchar(50),  -- Protected Veteran, Not a Veteran, etc.
    disability_status varchar(50),  -- Yes, No, Decline to Answer
    
    -- Collection metadata
    collected_date timestamptz NOT NULL DEFAULT NOW(),
    collection_method varchar(30) NOT NULL,  -- SelfReported, VoluntarySurvey
    collection_context varchar(100),  -- e.g., "New hire onboarding", "Annual survey"
    
    -- Voluntary acknowledgment
    voluntary_disclosure_acknowledged boolean NOT NULL DEFAULT false,
    
    -- Audit fields
    created_at timestamptz NOT NULL DEFAULT NOW(),
    created_by varchar(100) NOT NULL,
    updated_at timestamptz,
    updated_by varchar(100),
    
    CONSTRAINT fk_employee FOREIGN KEY (employee_id) 
        REFERENCES hr.employees(id) ON DELETE RESTRICT,
    CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) 
        REFERENCES tenants(id) ON DELETE RESTRICT,
    CONSTRAINT uq_employee_demographics UNIQUE (tenant_id, employee_id)
);

-- RLS policy - only hr_eeo_role can access
ALTER TABLE hr_eeo.employee_demographics ENABLE ROW LEVEL SECURITY;

CREATE POLICY eeo_tenant_isolation ON hr_eeo.employee_demographics
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY eeo_role_access ON hr_eeo.employee_demographics
    TO hr_eeo_role
    USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- Table: hr_eeo.eeo1_job_categories
-- Purpose: Map employees to EEO-1 job categories for reporting
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE hr_eeo.eeo1_job_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    
    -- EEO-1 Category (1-10)
    eeo1_category smallint NOT NULL CHECK (eeo1_category BETWEEN 1 AND 10),
    -- 1 = Executive/Senior Officials
    -- 2 = First/Mid-Level Officials
    -- 3 = Professionals
    -- 4 = Technicians
    -- 5 = Sales Workers
    -- 6 = Administrative Support
    -- 7 = Craft Workers (construction!)
    -- 8 = Operatives
    -- 9 = Laborers/Helpers (construction!)
    -- 10 = Service Workers
    
    effective_date date NOT NULL,
    expiration_date date,
    
    -- Audit
    created_at timestamptz NOT NULL DEFAULT NOW(),
    created_by varchar(100) NOT NULL,
    
    CONSTRAINT fk_employee FOREIGN KEY (employee_id) 
        REFERENCES hr.employees(id) ON DELETE RESTRICT
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Table: hr_eeo.applicant_flow_log
-- Purpose: Track all applicants for adverse impact analysis (OFCCP)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE hr_eeo.applicant_flow_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    
    -- Applicant identification (NOT linked to employee until hired)
    applicant_external_id varchar(100) NOT NULL,  -- From ATS
    
    -- Position applied for
    job_requisition_id uuid,
    job_title varchar(200) NOT NULL,
    job_location varchar(100),
    
    -- Application details
    application_date timestamptz NOT NULL,
    source varchar(50),  -- Job board, referral, walk-in, etc.
    
    -- Demographic data (voluntary)
    race varchar(50),
    ethnicity varchar(30),
    sex varchar(20),
    veteran_status varchar(50),
    disability_status varchar(50),
    
    -- Disposition tracking (required for adverse impact)
    disposition varchar(50) NOT NULL,  -- Applied, Screened, Interviewed, Offered, Hired, Rejected
    disposition_date timestamptz NOT NULL,
    disposition_reason varchar(200),
    
    -- If hired, link to employee
    hired_employee_id uuid,
    
    -- OFCCP Internet Applicant Rule compliance
    meets_basic_qualifications boolean,
    expression_of_interest_date timestamptz,
    
    -- Audit
    created_at timestamptz NOT NULL DEFAULT NOW(),
    created_by varchar(100) NOT NULL,
    updated_at timestamptz,
    updated_by varchar(100)
);
```

### 2.3 Access Control Model

```csharp
namespace Pitbull.HRCore.Compliance.Authorization;

/// <summary>
/// EEO access is controlled via separate PostgreSQL role, not just application permissions.
/// This provides defense-in-depth: even if app-level authorization is bypassed,
/// the database role doesn't have access to the hr_eeo schema.
/// </summary>
public static class EEOAccessRoles
{
    // Database roles
    public const string EEO_READER = "hr_eeo_reader";   // View only
    public const string EEO_WRITER = "hr_eeo_writer";   // View + update
    public const string EEO_ADMIN = "hr_eeo_admin";     // Full access
    
    // Application-level permissions (maps to DB roles)
    public static class Permissions
    {
        public const string ViewDemographics = "eeo:demographics:read";
        public const string UpdateDemographics = "eeo:demographics:write";
        public const string ViewApplicantFlow = "eeo:applicant-flow:read";
        public const string GenerateEEO1Report = "eeo:reports:eeo1";
        public const string RunAdverseImpactAnalysis = "eeo:reports:adverse-impact";
    }
}
```

#### 2.3.1 Database Role Setup

```sql
-- Create EEO-specific roles
CREATE ROLE hr_eeo_reader;
CREATE ROLE hr_eeo_writer;
CREATE ROLE hr_eeo_admin;

-- Reader can only SELECT
GRANT USAGE ON SCHEMA hr_eeo TO hr_eeo_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA hr_eeo TO hr_eeo_reader;

-- Writer can SELECT, INSERT, UPDATE (no DELETE)
GRANT USAGE ON SCHEMA hr_eeo TO hr_eeo_writer;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA hr_eeo TO hr_eeo_writer;

-- Admin has full access including DELETE
GRANT ALL ON SCHEMA hr_eeo TO hr_eeo_admin;
GRANT ALL ON ALL TABLES IN SCHEMA hr_eeo TO hr_eeo_admin;

-- Regular HR users get the base role (no EEO access)
CREATE ROLE hr_standard;
GRANT USAGE ON SCHEMA hr TO hr_standard;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA hr TO hr_standard;
-- NOTE: hr_standard has NO grants on hr_eeo schema
```

### 2.4 EEO Data Collection Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      EEO DATA COLLECTION FLOW                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐     ┌─────────────────────┐     ┌─────────────────┐   │
│  │   Employee  │────▶│  Voluntary Survey   │────▶│  hr_eeo.employee│   │
│  │  Onboarding │     │  (separate from     │     │  _demographics  │   │
│  │             │     │   hiring workflow)  │     │                 │   │
│  └─────────────┘     └─────────────────────┘     └─────────────────┘   │
│                                                           │             │
│                               NO ACCESS                   │             │
│                                  ▲                        │             │
│                                  │                        ▼             │
│  ┌─────────────┐     ┌─────────────────────┐     ┌─────────────────┐   │
│  │   Hiring    │──X──│   Cannot Query      │     │  EEO-1 Report   │   │
│  │   Manager   │     │   Demographics      │     │   Generation    │   │
│  │             │     │   During Hiring     │     │   (Aggregated)  │   │
│  └─────────────┘     └─────────────────────┘     └─────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.5 EEO-1 Report Generation

```csharp
/// <summary>
/// EEO-1 Component 1 report generator.
/// Aggregates employee demographics by job category and establishment.
/// </summary>
public class EEO1ReportGenerator
{
    public record EEO1ReportRow(
        string JobCategory,
        int WhiteMale, int WhiteFemale,
        int BlackMale, int BlackFemale,
        int HispanicMale, int HispanicFemale,
        int AsianMale, int AsianFemale,
        int NativeAmericanMale, int NativeAmericanFemale,
        int TwoOrMoreMale, int TwoOrMoreFemale,
        int TotalMale, int TotalFemale
    );
    
    /// <summary>
    /// Generate EEO-1 Component 1 data for a specific establishment.
    /// Uses snapshot date to capture point-in-time workforce composition.
    /// </summary>
    public async Task<IEnumerable<EEO1ReportRow>> GenerateComponent1Async(
        Guid tenantId,
        Guid? establishmentId,
        DateOnly snapshotDate)
    {
        // Query joins hr.employees (active on snapshot date) with hr_eeo.employee_demographics
        // Groups by EEO-1 job category and demographic attributes
        // Returns aggregated counts only - never individual records
    }
}
```

---

## 3. I-9 / E-Verify Integration

### 3.1 I-9 Compliance Requirements

**Federal law (IRCA) requires:**
- Section 1 completed by employee on or before first day of work
- Section 2 completed by employer within 3 business days of hire
- Reverification before work authorization expires
- Retention: 3 years from hire OR 1 year post-termination (whichever is later)

**E-Verify requirements (mandatory in some states and for federal contractors):**
- Case created within 3 business days of hire (after I-9 Section 2)
- Photo match for certain documents
- TNC (Tentative Non-Confirmation) workflow
- Case closure within specific timeframes

### 3.2 I-9 Data Model

The I-9 entity is defined in `01-ENTITIES.md`. Key compliance fields:

```csharp
/// <summary>
/// I-9 compliance state machine.
/// </summary>
public enum I9RecordStatus
{
    NotStarted = 0,        // I-9 not begun
    Section1Pending = 1,   // Awaiting employee Section 1
    Section1Complete = 2,  // Section 1 done, awaiting Section 2
    Section2Pending = 3,   // Employer reviewing documents
    Complete = 4,          // Full I-9 complete
    ReverificationNeeded = 5,  // Work auth expiring
    ReverificationComplete = 6,
    Expired = 7            // Past retention period
}

/// <summary>
/// Citizenship/immigration status for I-9 Section 1.
/// </summary>
public enum CitizenshipStatus
{
    USCitizen = 1,
    NonctizenNational = 2,  // American Samoa, etc.
    LawfulPermanentResident = 3,  // Green card
    AlienAuthorizedToWork = 4  // Visa/work permit
}
```

### 3.3 I-9 Retention Calculator

```csharp
namespace Pitbull.HRCore.Compliance.Retention;

/// <summary>
/// Calculates I-9 retention dates per IRCA requirements.
/// Retention = MAX(3 years from hire, 1 year from termination)
/// </summary>
public class I9RetentionCalculator
{
    public DateOnly CalculateDestructionDate(DateOnly hireDate, DateOnly? terminationDate)
    {
        var threeYearsFromHire = hireDate.AddYears(3);
        
        if (terminationDate == null)
        {
            // Still employed - retention TBD until termination
            return DateOnly.MaxValue;
        }
        
        var oneYearFromTermination = terminationDate.Value.AddYears(1);
        
        return threeYearsFromHire > oneYearFromTermination 
            ? threeYearsFromHire 
            : oneYearFromTermination;
    }
    
    /// <summary>
    /// Recalculate on termination and update document destruction date.
    /// </summary>
    public async Task OnEmployeeTerminatedAsync(Guid employeeId, DateOnly terminationDate)
    {
        var i9 = await _i9Repository.GetByEmployeeIdAsync(employeeId);
        if (i9 == null) return;
        
        var hireDate = await _employeeRepository.GetHireDateAsync(employeeId);
        var newDestructionDate = CalculateDestructionDate(hireDate, terminationDate);
        
        // Update the I-9 form document's destruction date
        if (i9.FormDocumentId.HasValue)
        {
            await _documentService.UpdateDestructionDateAsync(
                i9.FormDocumentId.Value, 
                newDestructionDate);
        }
    }
}
```

### 3.4 E-Verify Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        E-VERIFY INTEGRATION FLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌──────────────────┐     ┌───────────────────────┐   │
│  │   I-9 Form   │────▶│  EVerifyClient   │────▶│  DHS E-Verify API     │   │
│  │  Section 2   │     │  Service         │     │  (SOAP/REST)          │   │
│  │  Completed   │     │                  │     │                       │   │
│  └──────────────┘     └────────┬─────────┘     └───────────┬───────────┘   │
│                                │                           │               │
│                                ▼                           ▼               │
│                    ┌──────────────────────┐     ┌───────────────────────┐ │
│                    │  EVerifyCase         │◀────│  Case Response        │ │
│                    │  (local tracking)    │     │  (status updates)     │ │
│                    └──────────┬───────────┘     └───────────────────────┘ │
│                               │                                           │
│              ┌────────────────┼────────────────┐                          │
│              ▼                ▼                ▼                          │
│    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐   │
│    │  Authorized     │ │     TNC         │ │   Final Nonconfirmation │   │
│    │  (complete)     │ │  (10 day        │ │   (employment decision) │   │
│    │                 │ │   workflow)     │ │                         │   │
│    └─────────────────┘ └─────────────────┘ └─────────────────────────┘   │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

### 3.5 E-Verify Client Service

```csharp
namespace Pitbull.HRCore.Compliance.EVerify;

/// <summary>
/// E-Verify integration client.
/// Wraps DHS E-Verify API for employment authorization verification.
/// </summary>
public interface IEVerifyClient
{
    /// <summary>
    /// Create a new E-Verify case from I-9 data.
    /// </summary>
    Task<EVerifyCreateCaseResult> CreateCaseAsync(EVerifyCreateCaseRequest request);
    
    /// <summary>
    /// Query case status.
    /// </summary>
    Task<EVerifyCaseStatusResult> GetCaseStatusAsync(string caseNumber);
    
    /// <summary>
    /// Close a case (required for all cases).
    /// </summary>
    Task<EVerifyCloseCaseResult> CloseCaseAsync(string caseNumber, EVerifyClosureReason reason);
    
    /// <summary>
    /// Submit photo match for applicable documents.
    /// </summary>
    Task<EVerifyPhotoMatchResult> SubmitPhotoMatchAsync(string caseNumber, byte[] employeePhoto);
    
    /// <summary>
    /// Confirm employee referral for TNC workflow.
    /// </summary>
    Task<EVerifyReferralResult> ConfirmReferralAsync(string caseNumber, bool employeeReferred);
}

/// <summary>
/// E-Verify case creation request built from I-9 data.
/// </summary>
public record EVerifyCreateCaseRequest(
    // Employee info (from I-9 Section 1)
    string FirstName,
    string LastName,
    string? MiddleInitial,
    DateOnly DateOfBirth,
    string SSN,
    CitizenshipStatus CitizenshipStatus,
    string? AlienNumber,
    string? I94Number,
    string? ForeignPassportNumber,
    string? ForeignPassportCountry,
    DateOnly? WorkAuthorizationExpiration,
    
    // Document info (from I-9 Section 2)
    DocumentListUsed DocumentList,  // ListA, or ListBAndC
    string DocumentTitle,
    string DocumentNumber,
    string IssuingAuthority,
    DateOnly? ExpirationDate,
    
    // Employer info
    DateOnly HireDate,
    string EmployerCaseCreatorId  // E-Verify user ID
);

public enum DocumentListUsed { ListA, ListBAndC }

/// <summary>
/// E-Verify case status enumeration matching DHS statuses.
/// </summary>
public enum EVerifyCaseStatus
{
    Created = 0,
    Pending = 1,
    EmploymentAuthorized = 2,
    TentativeNonconfirmation = 3,  // TNC - requires employee action
    CaseInContinuance = 4,  // SSA/DHS reviewing
    FinalNonconfirmation = 5,
    ClosedAuthorized = 6,
    ClosedNonconfirmation = 7,
    ClosedOther = 8
}

public enum EVerifyResult
{
    EmploymentAuthorized = 1,
    SSATentativeNonconfirmation = 2,
    DHSTentativeNonconfirmation = 3,
    DHSNoShow = 4,
    FinalNonconfirmation = 5,
    ClosedCaseAndResubmit = 6,
    ClosedOther = 7
}
```

### 3.6 E-Verify Workflow State Machine

```csharp
/// <summary>
/// E-Verify case workflow handler.
/// Implements the DHS-mandated workflow for employment authorization.
/// </summary>
public class EVerifyWorkflowHandler
{
    private readonly IEVerifyClient _client;
    private readonly IEVerifyCaseRepository _repository;
    private readonly INotificationService _notifications;
    private readonly IAuditLogger _auditLog;
    
    /// <summary>
    /// Process E-Verify status update and trigger appropriate actions.
    /// </summary>
    public async Task ProcessStatusUpdateAsync(EVerifyCase existingCase, EVerifyCaseStatusResult newStatus)
    {
        var oldStatus = existingCase.Status;
        
        switch (newStatus.Status)
        {
            case EVerifyCaseStatus.EmploymentAuthorized:
                await HandleEmploymentAuthorizedAsync(existingCase);
                break;
                
            case EVerifyCaseStatus.TentativeNonconfirmation:
                await HandleTNCAsync(existingCase, newStatus);
                break;
                
            case EVerifyCaseStatus.FinalNonconfirmation:
                await HandleFinalNonconfirmationAsync(existingCase);
                break;
                
            case EVerifyCaseStatus.CaseInContinuance:
                // Waiting on SSA/DHS - just log and continue monitoring
                existingCase.UpdateStatus(EVerifyCaseStatus.CaseInContinuance);
                break;
        }
        
        await _repository.UpdateAsync(existingCase);
        await _auditLog.LogAsync(AuditEvent.EVerifyStatusChange, existingCase.Id, new {
            OldStatus = oldStatus,
            NewStatus = newStatus.Status,
            CaseNumber = existingCase.CaseNumber
        });
    }
    
    private async Task HandleTNCAsync(EVerifyCase eCase, EVerifyCaseStatusResult status)
    {
        eCase.MarkTNCIssued(DateTime.UtcNow);
        
        // Calculate resolution due date (10 federal business days)
        var dueDate = CalculateFederalBusinessDays(DateOnly.FromDateTime(DateTime.UtcNow), 10);
        eCase.SetResolutionDueDate(dueDate);
        
        // Notify HR to give employee the TNC notice
        await _notifications.SendAsync(new TNCIssuedNotification {
            EmployeeId = eCase.EmployeeId,
            CaseNumber = eCase.CaseNumber,
            ResolutionDueDate = dueDate,
            TNCSSource = status.TNCSource  // SSA or DHS
        });
        
        // CRITICAL: Employee cannot be terminated during TNC period
        // unless they decline to contest
    }
    
    private async Task HandleFinalNonconfirmationAsync(EVerifyCase eCase)
    {
        // Final nonconfirmation = employment must be terminated
        eCase.CloseFinalNonconfirmation(DateTime.UtcNow);
        
        await _notifications.SendAsync(new FinalNonconfirmationNotification {
            EmployeeId = eCase.EmployeeId,
            CaseNumber = eCase.CaseNumber,
            // Include required action: terminate employment
            RequiredAction = "Employee must be terminated per E-Verify requirements"
        });
    }
    
    /// <summary>
    /// Calculate federal business days (excludes weekends and federal holidays).
    /// </summary>
    private DateOnly CalculateFederalBusinessDays(DateOnly start, int days)
    {
        var current = start;
        var counted = 0;
        
        while (counted < days)
        {
            current = current.AddDays(1);
            if (!IsWeekend(current) && !IsFederalHoliday(current))
            {
                counted++;
            }
        }
        
        return current;
    }
}
```

### 3.7 E-Verify Configuration per State

```csharp
/// <summary>
/// E-Verify requirement configuration by state.
/// Some states mandate E-Verify for all employers; others only for public contracts.
/// </summary>
public static class EVerifyRequirements
{
    public static readonly Dictionary<string, EVerifyStateRequirement> ByState = new()
    {
        // Mandatory for all employers
        ["AL"] = new(Mandatory: true, AllEmployers: true),
        ["AZ"] = new(Mandatory: true, AllEmployers: true),
        ["MS"] = new(Mandatory: true, AllEmployers: true),
        ["SC"] = new(Mandatory: true, AllEmployers: true),
        
        // Mandatory for public contractors only
        ["CO"] = new(Mandatory: true, AllEmployers: false, PublicContractorsOnly: true),
        ["GA"] = new(Mandatory: true, AllEmployers: false, PublicContractorsOnly: true, ThresholdEmployees: 10),
        ["FL"] = new(Mandatory: true, AllEmployers: false, PublicContractorsOnly: true),
        ["IN"] = new(Mandatory: true, AllEmployers: false, PublicContractorsOnly: true),
        ["MO"] = new(Mandatory: true, AllEmployers: false, PublicContractorsOnly: true),
        ["NC"] = new(Mandatory: true, AllEmployers: false, PublicContractorsOnly: true, ThresholdEmployees: 25),
        ["OK"] = new(Mandatory: true, AllEmployers: false, PublicContractorsOnly: true),
        ["TN"] = new(Mandatory: true, AllEmployers: false, PublicContractorsOnly: true, ThresholdEmployees: 6),
        ["TX"] = new(Mandatory: true, AllEmployers: false, PublicContractorsOnly: true),
        ["UT"] = new(Mandatory: true, AllEmployers: false, ThresholdEmployees: 15),
        ["VA"] = new(Mandatory: true, AllEmployers: false, PublicContractorsOnly: true),
        
        // No state mandate (federal contractors still require it)
        ["CA"] = new(Mandatory: false, AllEmployers: false),
        ["NY"] = new(Mandatory: false, AllEmployers: false),
        ["WA"] = new(Mandatory: false, AllEmployers: false),
        // ... other states default to federal-only requirements
    };
    
    /// <summary>
    /// Determine if E-Verify is required for a specific hire.
    /// </summary>
    public static bool IsRequired(string workState, bool isFederalContractor, bool isPublicContractor)
    {
        // Federal contractors always require E-Verify
        if (isFederalContractor) return true;
        
        if (!ByState.TryGetValue(workState, out var req))
            return false;
        
        if (req.AllEmployers) return true;
        if (req.PublicContractorsOnly && isPublicContractor) return true;
        
        return false;
    }
}

public record EVerifyStateRequirement(
    bool Mandatory,
    bool AllEmployers,
    bool PublicContractorsOnly = false,
    int? ThresholdEmployees = null
);
```

### 3.8 I-9/E-Verify API Endpoints

```
POST   /api/hr/employees/{id}/i9
       Create/update I-9 record for employee
       
GET    /api/hr/employees/{id}/i9
       Get current I-9 status and details
       
POST   /api/hr/employees/{id}/i9/section1
       Complete Section 1 (employee self-service or HR entry)
       
POST   /api/hr/employees/{id}/i9/section2
       Complete Section 2 (employer verification)
       Body: { documents: [...], employerRepresentative: {...} }
       
POST   /api/hr/employees/{id}/i9/reverify
       Create reverification record (Section 3)
       
POST   /api/hr/employees/{id}/e-verify
       Submit E-Verify case (after I-9 Section 2 complete)
       
GET    /api/hr/employees/{id}/e-verify
       Get E-Verify case status
       
POST   /api/hr/employees/{id}/e-verify/referral
       Confirm employee TNC referral decision
       Body: { referred: true/false }
       
POST   /api/hr/employees/{id}/e-verify/close
       Close E-Verify case
       Body: { reason: "EmploymentAuthorized" | "EmployeeQuit" | ... }

GET    /api/hr/compliance/i9/expiring
       List employees with work authorization expiring within N days
       Query: ?days=90&status=active

GET    /api/hr/compliance/e-verify/pending-tnc
       List E-Verify cases in TNC status requiring action
```

---

## 4. Document Storage System

### 4.1 Design Decision: Built-In Storage

**We are building our own document storage system** rather than integrating with external providers (Box, SharePoint, S3 direct). Rationale:

1. **Compliance control** — Retention enforcement, legal holds, and destruction must be system-controlled
2. **Audit integration** — Every access logged in our immutable audit trail
3. **Encryption** — At-rest encryption with tenant-specific keys
4. **Access control** — Document visibility tied to HR permission model
5. **Simplicity** — One system to secure, audit, and backup

### 4.2 Storage Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      DOCUMENT STORAGE ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      hr_documents Schema                            │   │
│  │                                                                     │   │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │   │
│  │  │ document_types  │    │employee_documents│    │ document_access │ │   │
│  │  │ (reference)     │    │ (metadata)       │    │ _log (audit)    │ │   │
│  │  └─────────────────┘    └────────┬─────────┘    └─────────────────┘ │   │
│  └──────────────────────────────────┼──────────────────────────────────┘   │
│                                     │                                       │
│                                     ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      BLOB STORAGE LAYER                             │   │
│  │                                                                     │   │
│  │  Storage Path: /tenants/{tenant_id}/employees/{employee_id}/        │   │
│  │                        {category}/{document_id}.{ext}               │   │
│  │                                                                     │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │   │
│  │  │  Local Disk      │  │  Azure Blob      │  │  S3 Compatible   │  │   │
│  │  │  (dev/small)     │  │  (production)    │  │  (on-prem)       │  │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘  │   │
│  │                                                                     │   │
│  │  Features:                                                          │   │
│  │  ✓ At-rest encryption (AES-256, tenant-specific keys)              │   │
│  │  ✓ Content hash verification (SHA-256)                              │   │
│  │  ✓ Virus scanning on upload                                         │   │
│  │  ✓ Streaming upload/download (no full file in memory)               │   │
│  │  ✓ Soft delete with retention hold                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Document Type Registry

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Table: hr_documents.document_types
-- Purpose: Define document types with retention policies and requirements
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE hr_documents.document_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    code varchar(50) NOT NULL UNIQUE,  -- e.g., 'I9_FORM', 'W4_FEDERAL'
    name varchar(100) NOT NULL,
    description text,
    category varchar(30) NOT NULL,  -- Employment, Tax, Benefit, Certification, etc.
    
    -- Retention configuration
    retention_period_code varchar(20) NOT NULL,  -- References retention_policies
    allows_override boolean NOT NULL DEFAULT false,  -- Can individual docs override?
    
    -- Requirements
    requires_signature boolean NOT NULL DEFAULT false,
    requires_expiration_date boolean NOT NULL DEFAULT false,
    requires_effective_date boolean NOT NULL DEFAULT false,
    
    -- Accepted formats
    allowed_mime_types text[] NOT NULL DEFAULT ARRAY['application/pdf'],
    max_file_size_bytes bigint NOT NULL DEFAULT 10485760,  -- 10MB default
    
    -- Visibility default
    default_visibility smallint NOT NULL DEFAULT 0,  -- HROnly
    
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT NOW()
);

-- Seed essential document types
INSERT INTO hr_documents.document_types 
    (code, name, category, retention_period_code, requires_signature, requires_expiration_date)
VALUES
    ('I9_FORM', 'I-9 Employment Eligibility', 'Employment', 'I9', true, false),
    ('I9_LIST_A', 'I-9 List A Document', 'Employment', 'I9', false, true),
    ('I9_LIST_B', 'I-9 List B Document', 'Employment', 'I9', false, true),
    ('I9_LIST_C', 'I-9 List C Document', 'Employment', 'I9', false, true),
    ('W4_FEDERAL', 'Federal W-4', 'Tax', 'PAYROLL_3YR', true, false),
    ('W4_STATE', 'State Withholding Form', 'Tax', 'PAYROLL_3YR', true, false),
    ('OFFER_LETTER', 'Offer Letter', 'Employment', 'PERSONNEL_4YR', true, false),
    ('HANDBOOK_ACK', 'Employee Handbook Acknowledgment', 'Employment', 'PERSONNEL_4YR', true, false),
    ('PERFORMANCE_REVIEW', 'Performance Review', 'Employment', 'PERSONNEL_4YR', true, false),
    ('DISCIPLINARY', 'Disciplinary Documentation', 'Employment', 'PERSONNEL_4YR', true, false),
    ('SEPARATION_AGREEMENT', 'Separation Agreement', 'Employment', 'PERSONNEL_4YR', true, false),
    ('CERT_OSHA10', 'OSHA 10 Certificate', 'Certification', 'SAFETY_TRAINING', false, true),
    ('CERT_OSHA30', 'OSHA 30 Certificate', 'Certification', 'SAFETY_TRAINING', false, true),
    ('CERT_FORKLIFT', 'Forklift Certification', 'Certification', 'SAFETY_TRAINING', false, true),
    ('CERT_CRANE', 'Crane Operator License', 'Certification', 'SAFETY_TRAINING', false, true),
    ('DIRECT_DEPOSIT', 'Direct Deposit Authorization', 'Payroll', 'PAYROLL_3YR', true, false),
    ('BENEFIT_ENROLLMENT', 'Benefits Enrollment Form', 'Benefit', 'ERISA_6YR', true, false),
    ('GARNISHMENT_ORDER', 'Garnishment/Support Order', 'Payroll', 'PAYROLL_3YR', false, false),
    ('UNION_CARD', 'Union Membership Card', 'Employment', 'PERSONNEL_4YR', false, true);
```

### 4.4 Document Storage Service

```csharp
namespace Pitbull.HRCore.Compliance.Documents;

/// <summary>
/// Document storage service with compliance features.
/// </summary>
public interface IDocumentStorageService
{
    /// <summary>
    /// Upload a document with automatic retention calculation.
    /// </summary>
    Task<EmployeeDocument> UploadAsync(DocumentUploadRequest request, Stream content);
    
    /// <summary>
    /// Download document content (creates audit log entry).
    /// </summary>
    Task<Stream> DownloadAsync(Guid documentId, string requestedBy);
    
    /// <summary>
    /// Get document metadata without downloading content.
    /// </summary>
    Task<EmployeeDocument?> GetMetadataAsync(Guid documentId);
    
    /// <summary>
    /// Update document metadata (e.g., expiration date, visibility).
    /// </summary>
    Task<EmployeeDocument> UpdateMetadataAsync(Guid documentId, DocumentUpdateRequest request);
    
    /// <summary>
    /// Place document on legal hold (prevents destruction).
    /// </summary>
    Task PlaceLegalHoldAsync(Guid documentId, string holdReference, string reason);
    
    /// <summary>
    /// Release legal hold (retention period resumes).
    /// </summary>
    Task ReleaseLegalHoldAsync(Guid documentId, string holdReference);
    
    /// <summary>
    /// Soft delete a document (respects retention - may be blocked).
    /// </summary>
    Task<bool> DeleteAsync(Guid documentId, string reason);
}

public record DocumentUploadRequest(
    Guid EmployeeId,
    string DocumentTypeCode,  // References document_types.code
    string Title,
    string OriginalFilename,
    string MimeType,
    DateOnly? EffectiveDate,
    DateOnly? ExpirationDate,
    DocumentVisibility Visibility,
    string? Notes,
    string UploadedBy
);

/// <summary>
/// Document visibility controls who can access.
/// </summary>
public enum DocumentVisibility
{
    HROnly = 0,           // Only HR personnel
    EmployeeAndHR = 1,    // Employee can view their own
    ManagerAndHR = 2,     // Direct manager + HR
    Public = 3            // Anyone in tenant (rare)
}
```

### 4.5 Document Service Implementation

```csharp
public class DocumentStorageService : IDocumentStorageService
{
    private readonly IBlobStorageProvider _blobStorage;
    private readonly IDocumentRepository _documentRepo;
    private readonly IDocumentTypeRepository _typeRepo;
    private readonly IRetentionService _retentionService;
    private readonly IEncryptionService _encryption;
    private readonly IAuditLogger _auditLog;
    private readonly IVirusScanService _virusScan;
    
    public async Task<EmployeeDocument> UploadAsync(DocumentUploadRequest request, Stream content)
    {
        // 1. Validate document type
        var docType = await _typeRepo.GetByCodeAsync(request.DocumentTypeCode)
            ?? throw new ValidationException($"Unknown document type: {request.DocumentTypeCode}");
        
        // 2. Validate file
        if (!docType.AllowedMimeTypes.Contains(request.MimeType))
            throw new ValidationException($"File type {request.MimeType} not allowed for {docType.Name}");
        
        // 3. Virus scan
        var scanResult = await _virusScan.ScanAsync(content);
        if (scanResult.IsMalicious)
            throw new SecurityException($"Virus detected: {scanResult.ThreatName}");
        
        content.Position = 0;  // Reset after scan
        
        // 4. Calculate content hash
        var hash = await ComputeHashAsync(content);
        content.Position = 0;
        
        // 5. Encrypt content
        var encryptedContent = await _encryption.EncryptStreamAsync(content, request.TenantId);
        
        // 6. Generate storage path
        var document = new EmployeeDocument
        {
            Id = Guid.NewGuid(),
            TenantId = request.TenantId,
            EmployeeId = request.EmployeeId,
            Category = docType.Category,
            DocumentTypeId = docType.Id,
            Title = request.Title,
            OriginalFilename = request.OriginalFilename,
            MimeType = request.MimeType,
            FileSizeBytes = content.Length,
            ContentHash = hash,
            EffectiveDate = request.EffectiveDate,
            ExpirationDate = request.ExpirationDate,
            RetentionPeriodCode = docType.RetentionPeriodCode,
            Visibility = request.Visibility,
            UploadedBy = request.UploadedBy,
            UploadedAt = DateTime.UtcNow
        };
        
        document.StoragePath = BuildStoragePath(document);
        
        // 7. Calculate destruction date based on retention policy
        document.DestructionDate = await _retentionService.CalculateDestructionDateAsync(
            document.RetentionPeriodCode,
            document.EmployeeId,
            document.EffectiveDate ?? DateOnly.FromDateTime(DateTime.UtcNow));
        
        // 8. Upload to blob storage
        await _blobStorage.UploadAsync(document.StoragePath, encryptedContent);
        
        // 9. Save metadata
        await _documentRepo.CreateAsync(document);
        
        // 10. Audit log
        await _auditLog.LogAsync(AuditEvent.DocumentUploaded, document.Id, new {
            EmployeeId = document.EmployeeId,
            DocumentType = docType.Code,
            Filename = document.OriginalFilename,
            SizeBytes = document.FileSizeBytes
        });
        
        return document;
    }
    
    public async Task<Stream> DownloadAsync(Guid documentId, string requestedBy)
    {
        var document = await _documentRepo.GetByIdAsync(documentId)
            ?? throw new NotFoundException($"Document {documentId} not found");
        
        // Audit the access
        await _auditLog.LogAsync(AuditEvent.DocumentAccessed, documentId, new {
            RequestedBy = requestedBy,
            EmployeeId = document.EmployeeId,
            DocumentType = document.DocumentType.Code
        });
        
        // Update access tracking
        document.RecordAccess();
        await _documentRepo.UpdateAsync(document);
        
        // Fetch and decrypt
        var encryptedContent = await _blobStorage.DownloadAsync(document.StoragePath);
        return await _encryption.DecryptStreamAsync(encryptedContent, document.TenantId);
    }
    
    public async Task<bool> DeleteAsync(Guid documentId, string reason)
    {
        var document = await _documentRepo.GetByIdAsync(documentId)
            ?? throw new NotFoundException($"Document {documentId} not found");
        
        // Check legal hold
        if (document.LegalHold)
        {
            await _auditLog.LogAsync(AuditEvent.DocumentDeleteBlocked, documentId, new {
                Reason = "Document under legal hold",
                HoldReference = document.LegalHoldReference
            });
            return false;
        }
        
        // Check retention period
        if (document.DestructionDate > DateOnly.FromDateTime(DateTime.UtcNow))
        {
            await _auditLog.LogAsync(AuditEvent.DocumentDeleteBlocked, documentId, new {
                Reason = "Retention period not expired",
                DestructionDate = document.DestructionDate
            });
            return false;
        }
        
        // Soft delete
        document.SoftDelete(reason);
        await _documentRepo.UpdateAsync(document);
        
        await _auditLog.LogAsync(AuditEvent.DocumentDeleted, documentId, new {
            Reason = reason,
            EmployeeId = document.EmployeeId
        });
        
        return true;
    }
    
    private string BuildStoragePath(EmployeeDocument doc)
    {
        return $"tenants/{doc.TenantId}/employees/{doc.EmployeeId}/" +
               $"{doc.Category.ToString().ToLower()}/{doc.Id}{Path.GetExtension(doc.OriginalFilename)}";
    }
}
```

### 4.6 Document API Endpoints

```
POST   /api/hr/employees/{id}/documents
       Upload a document
       Content-Type: multipart/form-data
       Form fields: file, documentTypeCode, title, effectiveDate?, expirationDate?, notes?
       
GET    /api/hr/employees/{id}/documents
       List employee's documents
       Query: ?category=Employment&includeDeleted=false
       
GET    /api/hr/documents/{documentId}
       Get document metadata
       
GET    /api/hr/documents/{documentId}/download
       Download document content
       Response: application/octet-stream with Content-Disposition header
       
PATCH  /api/hr/documents/{documentId}
       Update document metadata
       Body: { expirationDate?, visibility?, notes? }
       
DELETE /api/hr/documents/{documentId}
       Soft delete (blocked if retention/legal hold)
       Query: ?reason=string (required)
       
POST   /api/hr/documents/{documentId}/legal-hold
       Place document on legal hold
       Body: { holdReference: "CASE-2026-001", reason: "Litigation hold" }
       
DELETE /api/hr/documents/{documentId}/legal-hold
       Release legal hold
       Query: ?holdReference=CASE-2026-001
```

---

## 5. Retention Policies

### 5.1 Retention Policy Registry

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Table: hr_compliance.retention_policies
-- Purpose: Define retention rules per record type and governing law
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE hr_compliance.retention_policies (
    code varchar(20) PRIMARY KEY,
    name varchar(100) NOT NULL,
    description text,
    governing_law varchar(100) NOT NULL,
    
    -- Retention calculation
    base_period_years int NOT NULL,
    base_period_months int NOT NULL DEFAULT 0,
    
    -- Calculation trigger
    calculation_trigger varchar(30) NOT NULL,  -- 'hire_date', 'termination_date', 'document_date', etc.
    
    -- For termination-triggered: additional period after base
    post_termination_years int,
    post_termination_months int,
    
    -- Use MAX of base and post-termination (like I-9)
    use_max_calculation boolean NOT NULL DEFAULT false,
    
    -- State overrides (JSON: { "CA": { "years": 4 }, "NY": { "years": 6 } })
    state_overrides jsonb,
    
    -- Flags
    can_be_extended boolean NOT NULL DEFAULT true,  -- Legal holds can extend
    requires_destruction_approval boolean NOT NULL DEFAULT false,
    
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT NOW()
);

-- Seed retention policies
INSERT INTO hr_compliance.retention_policies 
    (code, name, governing_law, base_period_years, base_period_months, 
     calculation_trigger, post_termination_years, use_max_calculation, state_overrides)
VALUES
    -- I-9: 3 years from hire OR 1 year from termination (whichever is later)
    ('I9', 'I-9 Employment Eligibility', 'IRCA', 3, 0, 
     'hire_date', 1, true, NULL),
    
    -- Payroll: 3 years from date
    ('PAYROLL_3YR', 'Payroll Records', 'FLSA', 3, 0, 
     'document_date', NULL, false, NULL),
    
    -- Personnel files: 4 years post-termination (varies by state)
    ('PERSONNEL_4YR', 'Personnel Files', 'Various State Laws', 0, 0,
     'termination_date', 4, false, 
     '{"CA": {"post_termination_years": 4}, "TX": {"post_termination_years": 4}}'),
    
    -- FMLA: 3 years
    ('FMLA_3YR', 'FMLA Records', 'FMLA', 3, 0,
     'document_date', NULL, false, NULL),
    
    -- ERISA/Benefits: 6 years
    ('ERISA_6YR', 'Benefits Records', 'ERISA', 6, 0,
     'document_date', NULL, false, NULL),
    
    -- Safety training: duration of employment + 3 years
    ('SAFETY_TRAINING', 'Safety Training Records', 'OSHA', 0, 0,
     'termination_date', 3, false, NULL),
    
    -- OFCCP (large federal contractors): 3 years
    ('OFCCP_3YR', 'OFCCP Compliance Records', 'OFCCP', 3, 0,
     'document_date', NULL, false, NULL),
    
    -- EEO-1 reports: 3 years
    ('EEO1_3YR', 'EEO-1 Reports', 'Title VII', 3, 0,
     'document_date', NULL, false, NULL);
```

### 5.2 Retention Calculation Service

```csharp
namespace Pitbull.HRCore.Compliance.Retention;

/// <summary>
/// Service for calculating document/record retention dates.
/// </summary>
public class RetentionService : IRetentionService
{
    private readonly IRetentionPolicyRepository _policyRepo;
    private readonly IEmployeeRepository _employeeRepo;
    
    /// <summary>
    /// Calculate the destruction date for a document based on its retention policy.
    /// </summary>
    public async Task<DateOnly?> CalculateDestructionDateAsync(
        string retentionPolicyCode,
        Guid employeeId,
        DateOnly documentDate,
        string? workState = null)
    {
        var policy = await _policyRepo.GetByCodeAsync(retentionPolicyCode)
            ?? throw new ArgumentException($"Unknown retention policy: {retentionPolicyCode}");
        
        var employee = await _employeeRepo.GetByIdAsync(employeeId);
        if (employee == null)
            throw new ArgumentException($"Employee not found: {employeeId}");
        
        // Get state-specific override if applicable
        var effectivePolicy = GetEffectivePolicy(policy, workState ?? employee.HomeState);
        
        return policy.CalculationTrigger switch
        {
            "hire_date" => CalculateFromHireDate(effectivePolicy, employee, documentDate),
            "termination_date" => CalculateFromTermination(effectivePolicy, employee),
            "document_date" => CalculateFromDocumentDate(effectivePolicy, documentDate),
            _ => throw new InvalidOperationException($"Unknown trigger: {policy.CalculationTrigger}")
        };
    }
    
    private DateOnly? CalculateFromHireDate(RetentionPolicy policy, Employee employee, DateOnly documentDate)
    {
        var hireDate = employee.OriginalHireDate;
        var baseDestructionDate = hireDate
            .AddYears(policy.BasePeriodYears)
            .AddMonths(policy.BasePeriodMonths);
        
        if (!policy.UseMaxCalculation || employee.TerminationDate == null)
        {
            return employee.IsActive ? null : baseDestructionDate;
        }
        
        // Use MAX calculation (like I-9)
        var postTerminationDate = employee.TerminationDate.Value
            .AddYears(policy.PostTerminationYears ?? 0)
            .AddMonths(policy.PostTerminationMonths ?? 0);
        
        return baseDestructionDate > postTerminationDate 
            ? baseDestructionDate 
            : postTerminationDate;
    }
    
    private DateOnly? CalculateFromTermination(RetentionPolicy policy, Employee employee)
    {
        if (employee.IsActive || employee.TerminationDate == null)
        {
            // Cannot calculate until terminated
            return null;
        }
        
        return employee.TerminationDate.Value
            .AddYears(policy.PostTerminationYears ?? policy.BasePeriodYears)
            .AddMonths(policy.PostTerminationMonths ?? policy.BasePeriodMonths);
    }
    
    private DateOnly CalculateFromDocumentDate(RetentionPolicy policy, DateOnly documentDate)
    {
        return documentDate
            .AddYears(policy.BasePeriodYears)
            .AddMonths(policy.BasePeriodMonths);
    }
    
    private RetentionPolicy GetEffectivePolicy(RetentionPolicy basePolicy, string? state)
    {
        if (string.IsNullOrEmpty(state) || basePolicy.StateOverrides == null)
            return basePolicy;
        
        if (basePolicy.StateOverrides.TryGetValue(state, out var stateOverride))
        {
            return basePolicy with
            {
                BasePeriodYears = stateOverride.Years ?? basePolicy.BasePeriodYears,
                BasePeriodMonths = stateOverride.Months ?? basePolicy.BasePeriodMonths,
                PostTerminationYears = stateOverride.PostTerminationYears ?? basePolicy.PostTerminationYears
            };
        }
        
        return basePolicy;
    }
}
```

### 5.3 Retention Enforcement Job

```csharp
/// <summary>
/// Background job that enforces retention policies.
/// Runs daily to:
/// 1. Recalculate destruction dates on status changes
/// 2. Flag records eligible for destruction
/// 3. Execute approved destructions
/// </summary>
public class RetentionEnforcementJob : IHostedService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<RetentionEnforcementJob> _logger;
    private Timer? _timer;
    
    public Task StartAsync(CancellationToken cancellationToken)
    {
        // Run daily at 2 AM
        _timer = new Timer(
            ExecuteAsync,
            null,
            CalculateNextRunTime(),
            TimeSpan.FromDays(1));
        
        return Task.CompletedTask;
    }
    
    private async void ExecuteAsync(object? state)
    {
        using var scope = _scopeFactory.CreateScope();
        var documentRepo = scope.ServiceProvider.GetRequiredService<IDocumentRepository>();
        var retentionService = scope.ServiceProvider.GetRequiredService<IRetentionService>();
        var auditLog = scope.ServiceProvider.GetRequiredService<IAuditLogger>();
        
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        
        // 1. Recalculate destruction dates for recently terminated employees
        await RecalculateForTerminatedEmployeesAsync(scope, today);
        
        // 2. Find documents past retention that aren't on legal hold
        var eligibleForDestruction = await documentRepo
            .GetEligibleForDestructionAsync(today);
        
        foreach (var doc in eligibleForDestruction)
        {
            // If policy requires approval, flag for review
            if (doc.DocumentType.RetentionPolicy.RequiresDestructionApproval)
            {
                await FlagForDestructionReviewAsync(doc);
                continue;
            }
            
            // Auto-destroy (soft delete + schedule blob removal)
            await DestroyDocumentAsync(doc, "Automated retention enforcement");
            
            await auditLog.LogAsync(AuditEvent.DocumentRetentionDestroyed, doc.Id, new {
                EmployeeId = doc.EmployeeId,
                RetentionPolicy = doc.RetentionPeriodCode,
                DestructionDate = doc.DestructionDate,
                AutomatedDestruction = true
            });
        }
        
        _logger.LogInformation(
            "Retention enforcement complete. Processed {Count} documents eligible for destruction",
            eligibleForDestruction.Count);
    }
    
    private async Task RecalculateForTerminatedEmployeesAsync(IServiceScope scope, DateOnly today)
    {
        var employeeRepo = scope.ServiceProvider.GetRequiredService<IEmployeeRepository>();
        var retentionService = scope.ServiceProvider.GetRequiredService<IRetentionService>();
        
        // Get employees terminated in last 7 days whose documents need recalculation
        var recentlyTerminated = await employeeRepo
            .GetTerminatedSinceAsync(today.AddDays(-7));
        
        foreach (var emp in recentlyTerminated)
        {
            await retentionService.RecalculateAllDocumentsAsync(emp.Id);
        }
    }
}
```

### 5.4 Legal Hold Management

```csharp
/// <summary>
/// Legal hold service for litigation/audit preservation.
/// When a legal hold is placed, affected documents cannot be destroyed
/// regardless of retention period expiration.
/// </summary>
public interface ILegalHoldService
{
    /// <summary>
    /// Create a legal hold that applies to specified employees/documents.
    /// </summary>
    Task<LegalHold> CreateHoldAsync(CreateLegalHoldRequest request);
    
    /// <summary>
    /// Release a legal hold (documents return to normal retention).
    /// </summary>
    Task ReleaseHoldAsync(string holdReference, string releasedBy, string reason);
    
    /// <summary>
    /// Get all documents currently under a specific hold.
    /// </summary>
    Task<IEnumerable<EmployeeDocument>> GetDocumentsUnderHoldAsync(string holdReference);
    
    /// <summary>
    /// Check if a document is under any legal hold.
    /// </summary>
    Task<bool> IsDocumentHeldAsync(Guid documentId);
}

public record CreateLegalHoldRequest(
    string HoldReference,  // e.g., "LITIGATION-2026-001"
    string Matter,  // Description of the legal matter
    string CreatedBy,
    Guid[] EmployeeIds,  // Employees whose documents are held
    string[]? DocumentTypeCodes,  // Specific types, or null for all
    DateOnly? DocumentsFromDate,  // Only documents after this date
    DateOnly? DocumentsToDate  // Only documents before this date
);
```

### 5.5 Retention Dashboard Data

```
GET /api/hr/compliance/retention/summary
    Returns counts by retention status

Response:
{
  "data": {
    "totalDocuments": 45230,
    "byStatus": {
      "withinRetention": 43500,
      "eligibleForDestruction": 1200,
      "underLegalHold": 530,
      "pendingApproval": 45
    },
    "upcomingDestructions": [
      { "month": "2026-03", "count": 150 },
      { "month": "2026-04", "count": 200 }
    ],
    "activeLegalHolds": [
      {
        "holdReference": "LITIGATION-2026-001",
        "matter": "Smith v. Pitbull Construction",
        "documentCount": 325,
        "employeeCount": 12
      }
    ]
  }
}

GET /api/hr/compliance/retention/eligible-for-destruction
    List documents ready for destruction
    Query: ?requiresApproval=true&limit=100

GET /api/hr/compliance/retention/expiring
    Documents reaching destruction date within N days
    Query: ?days=30&documentType=I9_FORM
```

---

## 6. Audit Logging

### 6.1 Audit Requirements

Per compliance mandates, we must log:

| What | Why |
|------|-----|
| Every view of sensitive HR data | OFCCP audit readiness |
| Every edit with before/after | Legal discovery |
| Every export/download | Data exfiltration detection |
| Every deletion attempt (success or blocked) | Compliance enforcement |
| Every access denial | Security monitoring |
| User identity, timestamp, IP, session | Full attribution |

**Immutability requirement**: Audit logs cannot be modified or deleted by any user, including administrators. Retention: **7 years minimum**.

### 6.2 Audit Schema Design

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Schema: hr_audit (write-only, no UPDATE/DELETE permitted)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE SCHEMA hr_audit;

-- Revoke all modification rights
REVOKE UPDATE, DELETE ON ALL TABLES IN SCHEMA hr_audit FROM PUBLIC;

-- ═══════════════════════════════════════════════════════════════════════════
-- Table: hr_audit.events
-- Purpose: Immutable audit trail of all HR data access and changes
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE hr_audit.events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    
    -- Event identification
    event_type varchar(50) NOT NULL,  -- See AuditEvent enum
    event_category varchar(30) NOT NULL,  -- Access, Change, Security, Compliance
    severity varchar(10) NOT NULL DEFAULT 'Info',  -- Info, Warning, Error, Critical
    
    -- Timestamp (immutable)
    occurred_at timestamptz NOT NULL DEFAULT NOW(),
    
    -- Actor (who did this)
    actor_user_id varchar(100) NOT NULL,
    actor_username varchar(100),
    actor_role varchar(50),
    actor_ip_address inet,
    actor_user_agent text,
    actor_session_id varchar(100),
    
    -- Target (what was affected)
    target_entity_type varchar(50),  -- Employee, Document, Certification, etc.
    target_entity_id uuid,
    target_employee_id uuid,  -- Always populated if action relates to an employee
    
    -- Correlation
    correlation_id uuid,  -- Links related events across services
    request_id uuid,
    
    -- Change details (for modifications)
    previous_values jsonb,  -- Before state
    new_values jsonb,  -- After state
    changed_fields text[],  -- List of fields that changed
    
    -- Additional context
    details jsonb,  -- Event-specific metadata
    
    -- Query optimization
    event_date date GENERATED ALWAYS AS (occurred_at::date) STORED
);

-- Partition by month for performance and retention management
CREATE TABLE hr_audit.events_y2026m01 PARTITION OF hr_audit.events
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE hr_audit.events_y2026m02 PARTITION OF hr_audit.events
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
-- ... continue for 7+ years of partitions

-- Indexes for common queries
CREATE INDEX idx_audit_tenant_date ON hr_audit.events (tenant_id, event_date);
CREATE INDEX idx_audit_employee ON hr_audit.events (target_employee_id, occurred_at);
CREATE INDEX idx_audit_actor ON hr_audit.events (actor_user_id, occurred_at);
CREATE INDEX idx_audit_event_type ON hr_audit.events (event_type, occurred_at);
CREATE INDEX idx_audit_correlation ON hr_audit.events (correlation_id);

-- Prevent any updates or deletes via trigger (defense in depth)
CREATE OR REPLACE FUNCTION hr_audit.prevent_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log modification is not permitted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_audit_update
    BEFORE UPDATE ON hr_audit.events
    FOR EACH ROW
    EXECUTE FUNCTION hr_audit.prevent_modification();

CREATE TRIGGER prevent_audit_delete
    BEFORE DELETE ON hr_audit.events
    FOR EACH ROW
    EXECUTE FUNCTION hr_audit.prevent_modification();

-- ═══════════════════════════════════════════════════════════════════════════
-- Table: hr_audit.sensitive_data_access
-- Purpose: Detailed log of all PII access for privacy compliance
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE hr_audit.sensitive_data_access (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    
    occurred_at timestamptz NOT NULL DEFAULT NOW(),
    
    actor_user_id varchar(100) NOT NULL,
    actor_ip_address inet,
    
    -- What was accessed
    employee_id uuid NOT NULL,
    data_category varchar(30) NOT NULL,  -- SSN, Salary, EEO, Medical, etc.
    fields_accessed text[] NOT NULL,
    
    -- Context
    access_reason varchar(200),  -- Business justification if provided
    request_path varchar(500),  -- API endpoint
    
    -- Query performance
    access_date date GENERATED ALWAYS AS (occurred_at::date) STORED
);
```

### 6.3 Audit Event Types

```csharp
namespace Pitbull.HRCore.Compliance.Audit;

/// <summary>
/// Comprehensive audit event types for HR operations.
/// </summary>
public static class AuditEvent
{
    // ═══════════════════════════════════════════════════════════════
    // Employee Lifecycle
    // ═══════════════════════════════════════════════════════════════
    public const string EmployeeCreated = "Employee.Created";
    public const string EmployeeUpdated = "Employee.Updated";
    public const string EmployeeViewed = "Employee.Viewed";
    public const string EmployeeTerminated = "Employee.Terminated";
    public const string EmployeeRehired = "Employee.Rehired";
    public const string EmployeeDeleted = "Employee.Deleted";
    
    // ═══════════════════════════════════════════════════════════════
    // Sensitive Data Access
    // ═══════════════════════════════════════════════════════════════
    public const string SSNViewed = "SensitiveData.SSN.Viewed";
    public const string SSNDecrypted = "SensitiveData.SSN.Decrypted";
    public const string SalaryViewed = "SensitiveData.Salary.Viewed";
    public const string EEODataViewed = "SensitiveData.EEO.Viewed";
    public const string MedicalDataViewed = "SensitiveData.Medical.Viewed";
    
    // ═══════════════════════════════════════════════════════════════
    // Documents
    // ═══════════════════════════════════════════════════════════════
    public const string DocumentUploaded = "Document.Uploaded";
    public const string DocumentAccessed = "Document.Accessed";
    public const string DocumentDownloaded = "Document.Downloaded";
    public const string DocumentUpdated = "Document.Updated";
    public const string DocumentDeleted = "Document.Deleted";
    public const string DocumentDeleteBlocked = "Document.DeleteBlocked";
    public const string DocumentRetentionDestroyed = "Document.RetentionDestroyed";
    public const string DocumentLegalHoldPlaced = "Document.LegalHold.Placed";
    public const string DocumentLegalHoldReleased = "Document.LegalHold.Released";
    
    // ═══════════════════════════════════════════════════════════════
    // I-9 / E-Verify
    // ═══════════════════════════════════════════════════════════════
    public const string I9Section1Completed = "I9.Section1.Completed";
    public const string I9Section2Completed = "I9.Section2.Completed";
    public const string I9Reverification = "I9.Reverification";
    public const string EVerifyCaseCreated = "EVerify.Case.Created";
    public const string EVerifyStatusChange = "EVerify.Status.Changed";
    public const string EVerifyTNCIssued = "EVerify.TNC.Issued";
    public const string EVerifyCaseClosed = "EVerify.Case.Closed";
    
    // ═══════════════════════════════════════════════════════════════
    // Certifications
    // ═══════════════════════════════════════════════════════════════
    public const string CertificationAdded = "Certification.Added";
    public const string CertificationVerified = "Certification.Verified";
    public const string CertificationExpired = "Certification.Expired";
    public const string CertificationRevoked = "Certification.Revoked";
    
    // ═══════════════════════════════════════════════════════════════
    // Pay & Tax
    // ═══════════════════════════════════════════════════════════════
    public const string PayRateCreated = "PayRate.Created";
    public const string PayRateModified = "PayRate.Modified";
    public const string WithholdingUpdated = "Withholding.Updated";
    public const string DeductionAdded = "Deduction.Added";
    public const string DeductionModified = "Deduction.Modified";
    
    // ═══════════════════════════════════════════════════════════════
    // Exports & Reports
    // ═══════════════════════════════════════════════════════════════
    public const string DataExported = "Data.Exported";
    public const string ReportGenerated = "Report.Generated";
    public const string BulkQueryExecuted = "Query.Bulk.Executed";
    
    // ═══════════════════════════════════════════════════════════════
    // Security
    // ═══════════════════════════════════════════════════════════════
    public const string AccessDenied = "Security.AccessDenied";
    public const string SuspiciousActivity = "Security.SuspiciousActivity";
    public const string RateLimitExceeded = "Security.RateLimit.Exceeded";
    public const string PermissionEscalation = "Security.Permission.Escalation";
}
```

### 6.4 Audit Logger Implementation

```csharp
namespace Pitbull.HRCore.Compliance.Audit;

/// <summary>
/// Immutable audit logger for HR compliance.
/// All operations are INSERT-only to PostgreSQL.
/// </summary>
public interface IAuditLogger
{
    /// <summary>
    /// Log an audit event.
    /// </summary>
    Task LogAsync(string eventType, Guid? targetId, object? details = null);
    
    /// <summary>
    /// Log an audit event with before/after values for change tracking.
    /// </summary>
    Task LogChangeAsync<T>(string eventType, Guid targetId, T? previous, T current, string[] changedFields);
    
    /// <summary>
    /// Log sensitive data access.
    /// </summary>
    Task LogSensitiveAccessAsync(Guid employeeId, string dataCategory, string[] fieldsAccessed, string? reason = null);
}

public class AuditLogger : IAuditLogger
{
    private readonly IDbConnection _connection;
    private readonly IHttpContextAccessor _httpContext;
    private readonly ILogger<AuditLogger> _logger;
    
    public async Task LogAsync(string eventType, Guid? targetId, object? details = null)
    {
        var context = _httpContext.HttpContext;
        var actor = GetActorInfo(context);
        
        var sql = @"
            INSERT INTO hr_audit.events 
                (tenant_id, event_type, event_category, actor_user_id, actor_username, 
                 actor_role, actor_ip_address, actor_user_agent, actor_session_id,
                 target_entity_id, target_employee_id, correlation_id, request_id, details)
            VALUES 
                (@TenantId, @EventType, @Category, @UserId, @Username,
                 @Role, @IpAddress::inet, @UserAgent, @SessionId,
                 @TargetId, @EmployeeId, @CorrelationId, @RequestId, @Details::jsonb)";
        
        await _connection.ExecuteAsync(sql, new
        {
            TenantId = actor.TenantId,
            EventType = eventType,
            Category = GetEventCategory(eventType),
            UserId = actor.UserId,
            Username = actor.Username,
            Role = actor.Role,
            IpAddress = actor.IpAddress,
            UserAgent = actor.UserAgent,
            SessionId = actor.SessionId,
            TargetId = targetId,
            EmployeeId = ExtractEmployeeId(targetId, details),
            CorrelationId = actor.CorrelationId,
            RequestId = Guid.NewGuid(),
            Details = details != null ? JsonSerializer.Serialize(details) : null
        });
    }
    
    public async Task LogChangeAsync<T>(string eventType, Guid targetId, T? previous, T current, string[] changedFields)
    {
        var context = _httpContext.HttpContext;
        var actor = GetActorInfo(context);
        
        var sql = @"
            INSERT INTO hr_audit.events 
                (tenant_id, event_type, event_category, actor_user_id, actor_username, 
                 actor_role, actor_ip_address, target_entity_id, target_employee_id,
                 correlation_id, previous_values, new_values, changed_fields)
            VALUES 
                (@TenantId, @EventType, @Category, @UserId, @Username,
                 @Role, @IpAddress::inet, @TargetId, @EmployeeId,
                 @CorrelationId, @Previous::jsonb, @New::jsonb, @ChangedFields)";
        
        await _connection.ExecuteAsync(sql, new
        {
            TenantId = actor.TenantId,
            EventType = eventType,
            Category = GetEventCategory(eventType),
            UserId = actor.UserId,
            Username = actor.Username,
            Role = actor.Role,
            IpAddress = actor.IpAddress,
            TargetId = targetId,
            EmployeeId = ExtractEmployeeId(targetId, current),
            CorrelationId = actor.CorrelationId,
            Previous = previous != null ? JsonSerializer.Serialize(previous) : null,
            New = JsonSerializer.Serialize(current),
            ChangedFields = changedFields
        });
    }
    
    public async Task LogSensitiveAccessAsync(Guid employeeId, string dataCategory, string[] fieldsAccessed, string? reason = null)
    {
        var context = _httpContext.HttpContext;
        var actor = GetActorInfo(context);
        
        var sql = @"
            INSERT INTO hr_audit.sensitive_data_access 
                (tenant_id, actor_user_id, actor_ip_address, employee_id, 
                 data_category, fields_accessed, access_reason, request_path)
            VALUES 
                (@TenantId, @UserId, @IpAddress::inet, @EmployeeId,
                 @Category, @Fields, @Reason, @RequestPath)";
        
        await _connection.ExecuteAsync(sql, new
        {
            TenantId = actor.TenantId,
            UserId = actor.UserId,
            IpAddress = actor.IpAddress,
            EmployeeId = employeeId,
            Category = dataCategory,
            Fields = fieldsAccessed,
            Reason = reason,
            RequestPath = context?.Request?.Path.Value
        });
    }
}
```

### 6.5 Audit Query APIs

```
GET /api/hr/audit/events
    Query audit events with filters
    Query: ?employeeId={}&eventType={}&fromDate={}&toDate={}&actorId={}&limit=100
    Requires: HR.Admin role
    
GET /api/hr/audit/events/{eventId}
    Get single audit event details
    
GET /api/hr/audit/employee/{employeeId}/history
    Complete audit history for an employee
    Query: ?fromDate={}&toDate={}&eventTypes=[]
    
GET /api/hr/audit/sensitive-access
    Query sensitive data access log
    Query: ?employeeId={}&dataCategory={}&fromDate={}&toDate={}
    Requires: HR.Admin role
    
GET /api/hr/audit/report/access-summary
    Generate access summary report for compliance
    Query: ?period=monthly&month=2026-02
    Response: Aggregated access counts by user, data type, and event category
```

---

## 7. State-Specific Compliance

### 7.1 Challenge: 50-State Coverage

Employment law varies dramatically by state. Key variations that affect HR Core:

| Area | Variation Examples |
|------|-------------------|
| Pay transparency | CA, NY, CO require salary ranges in postings |
| Salary history | CA, NY, MA prohibit asking about prior salary |
| Wage statement | CA requires 9 specific fields; varies by state |
| Leave accrual | CA, WA, OR have specific sick leave requirements |
| Final pay timing | CA: immediate; WA: next regular payday |
| Personnel file access | CA: employee can request copy |
| Background check consent | Ban-the-box laws vary widely |
| E-Verify | Some states mandate, some prohibit certain uses |
| Withholding forms | State-specific forms (DE 4 for CA, etc.) |

### 7.2 State Compliance Engine Architecture

```csharp
namespace Pitbull.HRCore.Compliance.State;

/// <summary>
/// State compliance engine that provides jurisdiction-aware rules.
/// Designed for 50-state coverage from day 1.
/// </summary>
public interface IStateComplianceEngine
{
    /// <summary>
    /// Get all compliance requirements for a given state.
    /// </summary>
    Task<StateComplianceRequirements> GetRequirementsAsync(string stateCode);
    
    /// <summary>
    /// Validate an employee record against state requirements.
    /// </summary>
    Task<ComplianceValidationResult> ValidateEmployeeAsync(Guid employeeId, string workState);
    
    /// <summary>
    /// Get required fields for job postings in a state.
    /// </summary>
    Task<JobPostingRequirements> GetJobPostingRequirementsAsync(string stateCode);
    
    /// <summary>
    /// Calculate final pay deadline after termination.
    /// </summary>
    Task<FinalPayDeadline> GetFinalPayDeadlineAsync(string stateCode, DateOnly terminationDate, SeparationReason reason);
    
    /// <summary>
    /// Get state-specific withholding form requirements.
    /// </summary>
    Task<WithholdingFormRequirements> GetWithholdingRequirementsAsync(string stateCode);
}

public record StateComplianceRequirements(
    string StateCode,
    string StateName,
    
    // Pay transparency
    bool RequireSalaryRangeInPosting,
    bool ProhibitSalaryHistoryInquiry,
    
    // Wage statement
    string[] RequiredWageStatementFields,
    
    // E-Verify
    bool EVerifyMandatory,
    bool EVerifyPublicContractorsOnly,
    
    // Leave
    bool HasStateSickLeave,
    decimal? SickLeaveAccrualRate,  // hours per hours worked
    decimal? SickLeaveCap,
    
    // Personnel file
    bool EmployeeCanRequestCopy,
    int? DaysToProvideFile,
    
    // Final pay
    int FinalPayDaysVoluntary,
    int FinalPayDaysInvoluntary,
    bool ImmediateOnTerminationForCause,
    
    // Withholding
    string? StateWithholdingFormCode,
    bool UsesAllowances,  // vs W-4 style
    
    // Background checks
    bool BanTheBox,
    bool DelayBackgroundCheckUntilConditionalOffer
);
```

### 7.3 State Rules Database

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Table: hr_compliance.state_rules
-- Purpose: Jurisdiction-specific compliance rules
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE hr_compliance.state_rules (
    state_code char(2) PRIMARY KEY,
    state_name varchar(50) NOT NULL,
    
    -- Pay transparency
    require_salary_range_in_posting boolean NOT NULL DEFAULT false,
    salary_range_posting_effective_date date,
    prohibit_salary_history_inquiry boolean NOT NULL DEFAULT false,
    
    -- E-Verify
    e_verify_mandatory boolean NOT NULL DEFAULT false,
    e_verify_public_contractors_only boolean NOT NULL DEFAULT false,
    e_verify_threshold_employees int,
    
    -- Final pay
    final_pay_days_voluntary int NOT NULL DEFAULT 10,
    final_pay_days_involuntary int NOT NULL DEFAULT 10,
    immediate_on_termination_for_cause boolean NOT NULL DEFAULT false,
    
    -- Leave
    has_state_sick_leave boolean NOT NULL DEFAULT false,
    sick_leave_accrual_rate numeric(5,3),  -- e.g., 0.033 = 1hr per 30hrs
    sick_leave_cap_hours numeric(5,1),
    sick_leave_carryover_hours numeric(5,1),
    
    -- Personnel file
    employee_can_request_copy boolean NOT NULL DEFAULT false,
    days_to_provide_file int,
    
    -- Wage statement
    required_wage_statement_fields text[] NOT NULL DEFAULT '{}',
    
    -- Withholding
    state_withholding_form_code varchar(20),
    uses_allowances boolean NOT NULL DEFAULT false,
    
    -- Background checks
    ban_the_box boolean NOT NULL DEFAULT false,
    delay_background_check boolean NOT NULL DEFAULT false,
    
    -- Additional rules (JSON for flexibility)
    additional_rules jsonb,
    
    last_updated date NOT NULL,
    update_notes text
);

-- Seed key states (construction hotspots + high-regulation states)
INSERT INTO hr_compliance.state_rules 
    (state_code, state_name, require_salary_range_in_posting, prohibit_salary_history_inquiry,
     final_pay_days_voluntary, final_pay_days_involuntary, immediate_on_termination_for_cause,
     has_state_sick_leave, sick_leave_accrual_rate, e_verify_mandatory,
     employee_can_request_copy, days_to_provide_file,
     required_wage_statement_fields, state_withholding_form_code,
     ban_the_box, last_updated)
VALUES
    ('CA', 'California', true, true, 
     72, 0, true,  -- 72 hours for voluntary, immediate for involuntary
     true, 0.033,  -- 1 hour per 30 hours
     false,
     true, 30,
     ARRAY['employee_name', 'ssn_last4', 'gross_wages', 'total_hours', 'hourly_rate', 
           'net_wages', 'pay_period_dates', 'employer_name_address', 'deductions_itemized'],
     'DE 4',
     true, '2026-01-01'),
     
    ('WA', 'Washington', true, true,
     -1, -1, false,  -- -1 = next regular payday
     true, 0.025,  -- 1 hour per 40 hours
     false,
     false, NULL,
     ARRAY['employee_name', 'employer_name', 'pay_period', 'gross_pay', 'deductions', 'net_pay'],
     NULL,  -- No state form, uses federal W-4
     false, '2026-01-01'),
     
    ('NY', 'New York', true, true,
     -1, -1, false,
     true, 0.033,
     false,
     true, 30,
     ARRAY['employee_name', 'employer_name', 'address', 'pay_period', 'rate', 'gross', 'deductions', 'net'],
     'IT-2104',
     true, '2026-01-01'),
     
    ('TX', 'Texas', false, false,
     6, 6, false,  -- 6 days for both
     false, NULL,
     true,  -- E-Verify for public contractors
     false, NULL,
     ARRAY['employee_name', 'pay_period', 'gross', 'deductions', 'net'],
     NULL,
     false, '2026-01-01'),
     
    ('FL', 'Florida', false, false,
     -1, -1, false,
     false, NULL,
     true,  -- E-Verify for public contractors
     false, NULL,
     ARRAY['employee_name', 'pay_period', 'gross', 'deductions', 'net'],
     NULL,
     false, '2026-01-01'),
     
    ('AZ', 'Arizona', false, false,
     7, 3, false,
     true, 0.033,
     true,  -- E-Verify mandatory for all employers
     false, NULL,
     ARRAY['employee_name', 'pay_period', 'gross', 'deductions', 'net'],
     'A-4',
     false, '2026-01-01');

-- Add remaining 44 states with federal minimums as defaults
-- (Full seed script would populate all 50 states)
```

### 7.4 State Compliance Validation

```csharp
/// <summary>
/// Validates employee data against state-specific requirements.
/// </summary>
public class StateComplianceValidator
{
    private readonly IStateComplianceEngine _engine;
    private readonly IEmployeeRepository _employeeRepo;
    private readonly IDocumentRepository _documentRepo;
    
    public async Task<ComplianceValidationResult> ValidateEmployeeAsync(Guid employeeId, string workState)
    {
        var employee = await _employeeRepo.GetByIdAsync(employeeId);
        var requirements = await _engine.GetRequirementsAsync(workState);
        var issues = new List<ComplianceIssue>();
        
        // Check state withholding form
        if (!string.IsNullOrEmpty(requirements.StateWithholdingFormCode))
        {
            var hasStateWithholding = await _documentRepo.ExistsAsync(
                employeeId, 
                "W4_STATE",
                d => d.Details.Contains(workState));
            
            if (!hasStateWithholding)
            {
                issues.Add(new ComplianceIssue(
                    Severity.Error,
                    $"Missing {workState} state withholding form ({requirements.StateWithholdingFormCode})",
                    $"Employee working in {workState} requires {requirements.StateWithholdingFormCode}"
                ));
            }
        }
        
        // Check I-9 / E-Verify
        if (requirements.EVerifyMandatory)
        {
            var hasEVerify = await CheckEVerifyComplianceAsync(employeeId);
            if (!hasEVerify)
            {
                issues.Add(new ComplianceIssue(
                    Severity.Error,
                    $"E-Verify required for {workState} employment",
                    "State law mandates E-Verify verification"
                ));
            }
        }
        
        // Check certifications required by state (e.g., state-specific licenses)
        await ValidateStateCertificationsAsync(employee, workState, issues);
        
        return new ComplianceValidationResult(
            EmployeeId: employeeId,
            WorkState: workState,
            IsCompliant: !issues.Any(i => i.Severity == Severity.Error),
            Issues: issues
        );
    }
}

public record ComplianceIssue(
    Severity Severity,
    string Message,
    string Details
);

public enum Severity { Info, Warning, Error }

public record ComplianceValidationResult(
    Guid EmployeeId,
    string WorkState,
    bool IsCompliant,
    IReadOnlyList<ComplianceIssue> Issues
);
```

### 7.5 State Compliance API Endpoints

```
GET /api/hr/compliance/states
    List all states with summary compliance info
    
GET /api/hr/compliance/states/{stateCode}
    Get detailed compliance requirements for a state
    
GET /api/hr/compliance/states/{stateCode}/checklist
    Get actionable checklist for employing workers in state
    
POST /api/hr/compliance/validate
    Validate employee(s) against state requirements
    Body: { employeeIds: [...], workState: "CA" }
    Response: { results: [{ employeeId, isCompliant, issues: [...] }] }
    
GET /api/hr/compliance/employees/{id}/state-coverage
    List all states employee works in with compliance status
    
GET /api/hr/compliance/final-pay-deadline
    Calculate final pay deadline
    Query: ?state=CA&terminationDate=2026-02-15&reason=TerminationForCause
    Response: { deadline: "2026-02-15", requiresImmediate: true, notes: "CA requires immediate payment on involuntary termination" }
```

---

## 8. TimeTracking Integration

### 8.1 Integration Overview

HR Core is the **single source of truth** for employee data. TimeTracking module:
- Subscribes to HR domain events
- Maintains a read-only projection of relevant employee data
- Calls HR Core APIs for real-time validation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HR CORE ↔ TIMETRACKING INTEGRATION                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                           HR CORE                                   │   │
│  │                                                                     │   │
│  │  Employee     Certification    PayRate    Domain                   │   │
│  │  Aggregate    Entity           Entity     Events                   │   │
│  │      │             │              │          │                     │   │
│  │      └─────────────┼──────────────┼──────────┘                     │   │
│  │                    │              │                                │   │
│  │                    ▼              ▼                                │   │
│  │              ┌─────────────────────────┐                           │   │
│  │              │   Event Publisher       │                           │   │
│  │              │   (RabbitMQ/Kafka)      │                           │   │
│  │              └───────────┬─────────────┘                           │   │
│  └──────────────────────────┼──────────────────────────────────────────┘   │
│                             │                                               │
│                             │ Domain Events                                 │
│                             │ - EmployeeHired                               │
│                             │ - EmployeeTerminated                          │
│                             │ - CertificationExpired                        │
│                             │ - PayRateChanged                              │
│                             ▼                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        TIMETRACKING                                   │  │
│  │                                                                       │  │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │  │
│  │  │ Event Handler   │───▶│ Employee Read   │    │ Time Entry      │  │  │
│  │  │ (subscriber)    │    │ Projection      │    │ Validation      │  │  │
│  │  └─────────────────┘    └────────┬────────┘    └────────┬────────┘  │  │
│  │                                  │                      │           │  │
│  │                                  │   Real-time API      │           │  │
│  │                                  │   calls for          │           │  │
│  │                                  │   validation         │           │  │
│  │                                  ▼                      ▼           │  │
│  │                         ┌──────────────────────────────────┐        │  │
│  │                         │  HR Core API Client              │        │  │
│  │                         │  GET /api/hr/employees/{id}/     │        │  │
│  │                         │      can-work?projectId=&date=   │        │  │
│  │                         └──────────────────────────────────┘        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Domain Events Published by HR Core

```csharp
namespace Pitbull.HRCore.Domain.Events;

/// <summary>
/// Domain events published by HR Core for subscribers.
/// All events include TenantId, CorrelationId, and Timestamp.
/// </summary>

// ═══════════════════════════════════════════════════════════════════
// Employee Lifecycle Events
// ═══════════════════════════════════════════════════════════════════

public record EmployeeHiredEvent(
    Guid TenantId,
    Guid EmployeeId,
    string EmployeeNumber,
    string FirstName,
    string LastName,
    DateOnly HireDate,
    EmploymentStatus Status,
    WorkerType WorkerType,
    string? DefaultProjectId
) : IDomainEvent;

public record EmployeeTerminatedEvent(
    Guid TenantId,
    Guid EmployeeId,
    DateOnly TerminationDate,
    SeparationReason Reason,
    bool EligibleForRehire
) : IDomainEvent;

public record EmployeeRehiredEvent(
    Guid TenantId,
    Guid EmployeeId,
    DateOnly RehireDate,
    Guid NewEpisodeId
) : IDomainEvent;

public record EmployeeStatusChangedEvent(
    Guid TenantId,
    Guid EmployeeId,
    EmploymentStatus PreviousStatus,
    EmploymentStatus NewStatus,
    string? Reason
) : IDomainEvent;

// ═══════════════════════════════════════════════════════════════════
// Certification Events (Critical for TimeTracking validation)
// ═══════════════════════════════════════════════════════════════════

public record CertificationAddedEvent(
    Guid TenantId,
    Guid EmployeeId,
    Guid CertificationId,
    string CertificationType,
    DateOnly? ExpirationDate
) : IDomainEvent;

public record CertificationVerifiedEvent(
    Guid TenantId,
    Guid EmployeeId,
    Guid CertificationId,
    string CertificationType
) : IDomainEvent;

public record CertificationExpiredEvent(
    Guid TenantId,
    Guid EmployeeId,
    Guid CertificationId,
    string CertificationType,
    DateOnly ExpiredDate
) : IDomainEvent;

public record CertificationExpiringWarningEvent(
    Guid TenantId,
    Guid EmployeeId,
    Guid CertificationId,
    string CertificationType,
    DateOnly ExpirationDate,
    int DaysRemaining  // 90, 60, or 30
) : IDomainEvent;

// ═══════════════════════════════════════════════════════════════════
// Pay Rate Events (For TimeTracking cost calculations)
// ═══════════════════════════════════════════════════════════════════

public record PayRateChangedEvent(
    Guid TenantId,
    Guid EmployeeId,
    Guid PayRateId,
    DateOnly EffectiveDate,
    decimal NewRate,
    RateType RateType,
    Guid? ProjectId,  // If rate is project-specific
    string? WageDeterminationId  // If prevailing wage
) : IDomainEvent;

public record PayRateExpiredEvent(
    Guid TenantId,
    Guid EmployeeId,
    Guid PayRateId,
    DateOnly ExpirationDate
) : IDomainEvent;
```

### 8.3 TimeTracking Event Handlers

```csharp
namespace Pitbull.TimeTracking.Integration.HRCore;

/// <summary>
/// Handles HR Core domain events to maintain TimeTracking's read projection.
/// </summary>
public class HRCoreEventHandler : 
    IEventHandler<EmployeeHiredEvent>,
    IEventHandler<EmployeeTerminatedEvent>,
    IEventHandler<CertificationExpiredEvent>,
    IEventHandler<CertificationAddedEvent>,
    IEventHandler<PayRateChangedEvent>
{
    private readonly IEmployeeProjectionRepository _projection;
    private readonly ILogger<HRCoreEventHandler> _logger;
    
    public async Task HandleAsync(EmployeeHiredEvent evt)
    {
        // Create/update employee read projection
        var projection = new EmployeeProjection
        {
            EmployeeId = evt.EmployeeId,
            TenantId = evt.TenantId,
            EmployeeNumber = evt.EmployeeNumber,
            FullName = $"{evt.FirstName} {evt.LastName}",
            HireDate = evt.HireDate,
            IsActive = true,
            WorkerType = evt.WorkerType,
            LastSyncedAt = DateTime.UtcNow
        };
        
        await _projection.UpsertAsync(projection);
        
        _logger.LogInformation(
            "Employee projection created for {EmployeeId} ({EmployeeNumber})",
            evt.EmployeeId, evt.EmployeeNumber);
    }
    
    public async Task HandleAsync(EmployeeTerminatedEvent evt)
    {
        await _projection.UpdateAsync(evt.EmployeeId, p =>
        {
            p.IsActive = false;
            p.TerminationDate = evt.TerminationDate;
            p.EligibleForRehire = evt.EligibleForRehire;
            p.LastSyncedAt = DateTime.UtcNow;
        });
        
        _logger.LogInformation(
            "Employee {EmployeeId} marked as terminated",
            evt.EmployeeId);
    }
    
    public async Task HandleAsync(CertificationExpiredEvent evt)
    {
        // Update certification cache for fast validation
        await _projection.ExpireCertificationAsync(
            evt.EmployeeId, 
            evt.CertificationId,
            evt.ExpiredDate);
        
        _logger.LogWarning(
            "Certification {CertType} expired for employee {EmployeeId}",
            evt.CertificationType, evt.EmployeeId);
    }
    
    public async Task HandleAsync(CertificationAddedEvent evt)
    {
        await _projection.AddCertificationAsync(
            evt.EmployeeId,
            evt.CertificationId,
            evt.CertificationType,
            evt.ExpirationDate);
    }
    
    public async Task HandleAsync(PayRateChangedEvent evt)
    {
        // Update default rate in projection for quick access
        if (evt.ProjectId == null)  // Default rate (not project-specific)
        {
            await _projection.UpdateDefaultRateAsync(
                evt.EmployeeId,
                evt.NewRate,
                evt.RateType,
                evt.EffectiveDate);
        }
    }
}
```

### 8.4 TimeTracking Validation API (HR Core Provides)

```csharp
/// <summary>
/// API endpoint for TimeTracking to validate employee work eligibility.
/// Called in real-time during time entry.
/// </summary>
[ApiController]
[Route("api/hr/employees/{employeeId}")]
public class EmployeeValidationController : ControllerBase
{
    private readonly IEmployeeRepository _employeeRepo;
    private readonly ICertificationService _certService;
    private readonly IStateComplianceEngine _stateEngine;
    
    /// <summary>
    /// Check if employee can work on a specific project/date.
    /// Called by TimeTracking before accepting time entry.
    /// </summary>
    [HttpGet("can-work")]
    [Authorize(Policy = "TimeTracking.Validate")]
    public async Task<ActionResult<CanWorkResult>> CanWork(
        Guid employeeId,
        [FromQuery] Guid projectId,
        [FromQuery] DateOnly date)
    {
        var employee = await _employeeRepo.GetByIdAsync(employeeId);
        if (employee == null)
        {
            return NotFound(new CanWorkResult(false, new[] { "Employee not found" }));
        }
        
        var blockers = new List<string>();
        
        // Check employment status
        if (!employee.IsActiveOn(date))
        {
            blockers.Add($"Employee not active on {date}");
        }
        
        // Check certifications
        var project = await GetProjectAsync(projectId);
        var requiredCerts = project.RequiredCertifications;
        
        foreach (var reqCert in requiredCerts)
        {
            var hasCert = await _certService.HasValidCertificationAsync(
                employeeId, reqCert, date);
            
            if (!hasCert)
            {
                blockers.Add($"Missing or expired certification: {reqCert}");
            }
        }
        
        // Check state-specific work authorization
        if (!string.IsNullOrEmpty(project.WorkState))
        {
            var compliance = await _stateEngine.ValidateEmployeeAsync(
                employeeId, project.WorkState);
            
            if (!compliance.IsCompliant)
            {
                blockers.AddRange(
                    compliance.Issues
                        .Where(i => i.Severity == Severity.Error)
                        .Select(i => i.Message));
            }
        }
        
        return Ok(new CanWorkResult(
            CanWork: !blockers.Any(),
            Blockers: blockers
        ));
    }
}

public record CanWorkResult(
    bool CanWork,
    IReadOnlyList<string> Blockers
);
```

### 8.5 Migration Plan: TimeTracking.Employee → HR Core

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MIGRATION PHASES                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 1: Dual-Write (Week 1-2)                                            │
│  ─────────────────────────────────────────────────────────────────────     │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐              │
│  │ TimeTracking  │───▶│  HR Core      │───▶│ TimeTracking  │              │
│  │ UI/API        │    │  (new writes) │    │ Projection    │              │
│  │               │    │               │    │ (event sync)  │              │
│  └───────────────┘    └───────────────┘    └───────────────┘              │
│                                                                             │
│  - All new employees created in HR Core                                     │
│  - HR Core publishes events                                                 │
│  - TimeTracking subscribes and updates projection                           │
│  - TimeTracking reads from projection (not direct employee table)           │
│  - Legacy TimeTracking.Employee still exists but receives no new writes     │
│                                                                             │
│  PHASE 2: Historical Migration (Week 3)                                    │
│  ─────────────────────────────────────────────────────────────────────     │
│  ┌───────────────────────────────────────────────────────────────┐        │
│  │  Migration Job                                                  │        │
│  │  - Read all TimeTracking.Employee records                       │        │
│  │  - Transform to HR Core Employee aggregate                      │        │
│  │  - Validate data integrity                                      │        │
│  │  - Insert into HR Core (with original IDs preserved)            │        │
│  │  - Publish EmployeeHired events for each                        │        │
│  │  - Log audit trail of migration                                 │        │
│  └───────────────────────────────────────────────────────────────┘        │
│                                                                             │
│  PHASE 3: Validation (Week 4)                                              │
│  ─────────────────────────────────────────────────────────────────────     │
│  - Compare record counts: TimeTracking vs HR Core vs Projection             │
│  - Verify all employees exist in both systems                               │
│  - Run certification validation on all active employees                     │
│  - Test time entry workflow end-to-end                                      │
│  - Monitor event handler lag                                                │
│                                                                             │
│  PHASE 4: Cut-Over (Week 5)                                                │
│  ─────────────────────────────────────────────────────────────────────     │
│  - TimeTracking.Employee table marked read-only                             │
│  - All reads go through projection                                          │
│  - can-work validation calls HR Core API                                    │
│  - Monitor for 1 week                                                       │
│                                                                             │
│  PHASE 5: Cleanup (Week 6+)                                                │
│  ─────────────────────────────────────────────────────────────────────     │
│  - Archive TimeTracking.Employee table                                      │
│  - Remove legacy employee code from TimeTracking                            │
│  - Update documentation                                                     │
│  - Celebrate! 🎉                                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.6 Migration Script Outline

```csharp
/// <summary>
/// Migration job to move employees from TimeTracking to HR Core.
/// </summary>
public class EmployeeMigrationJob
{
    public async Task<MigrationResult> ExecuteAsync(MigrationOptions options)
    {
        var result = new MigrationResult();
        
        // 1. Load all TimeTracking employees
        var ttEmployees = await _timeTrackingDb.Query<TTEmployee>(
            "SELECT * FROM time_tracking.employees WHERE tenant_id = @TenantId",
            new { options.TenantId });
        
        foreach (var tt in ttEmployees)
        {
            try
            {
                // 2. Transform to HR Core model
                var hrEmployee = MapToHRCore(tt);
                
                // 3. Validate
                var validation = await _validator.ValidateAsync(hrEmployee);
                if (!validation.IsValid)
                {
                    result.ValidationErrors.Add(tt.Id, validation.Errors);
                    continue;
                }
                
                // 4. Insert with original ID
                await _hrCoreRepo.CreateAsync(hrEmployee);
                
                // 5. Publish event (triggers projection update)
                await _eventPublisher.PublishAsync(new EmployeeHiredEvent(
                    TenantId: tt.TenantId,
                    EmployeeId: tt.Id,
                    EmployeeNumber: tt.EmployeeNumber,
                    FirstName: hrEmployee.FirstName,
                    LastName: hrEmployee.LastName,
                    HireDate: hrEmployee.HireDate,
                    Status: hrEmployee.Status,
                    WorkerType: hrEmployee.WorkerType,
                    DefaultProjectId: null
                ));
                
                // 6. Log audit
                await _auditLog.LogAsync(AuditEvent.EmployeeMigrated, tt.Id, new {
                    SourceSystem = "TimeTracking",
                    MigrationBatch = options.BatchId
                });
                
                result.Migrated++;
            }
            catch (Exception ex)
            {
                result.Errors.Add(tt.Id, ex.Message);
                _logger.LogError(ex, "Failed to migrate employee {EmployeeId}", tt.Id);
            }
        }
        
        return result;
    }
    
    private Employee MapToHRCore(TTEmployee tt)
    {
        return new Employee
        {
            Id = tt.Id,  // Preserve ID!
            TenantId = tt.TenantId,
            EmployeeNumber = tt.EmployeeNumber,
            FirstName = tt.FirstName,
            LastName = tt.LastName,
            Email = tt.Email,
            Phone = tt.Phone,
            HireDate = tt.HireDate,
            Status = MapStatus(tt.Status),
            WorkerType = tt.IsFieldWorker ? WorkerType.Field : WorkerType.Office,
            // ... map remaining fields
        };
    }
}
```

---

## 9. Implementation Checklist

### Phase 2B: Compliance Layer (1-2 weeks)

- [ ] **EEO Data Architecture**
  - [ ] Create `hr_eeo` schema
  - [ ] Create `employee_demographics` table with RLS
  - [ ] Create `eeo1_job_categories` table
  - [ ] Create `applicant_flow_log` table
  - [ ] Create PostgreSQL roles (`hr_eeo_reader`, `hr_eeo_writer`, `hr_eeo_admin`)
  - [ ] Implement EEO access control service
  - [ ] Create EEO data collection API endpoints
  - [ ] Implement EEO-1 report generator

- [ ] **I-9 / E-Verify Integration**
  - [ ] I-9 entity already in 01-ENTITIES.md ✓
  - [ ] EVerifyCase entity already in 01-ENTITIES.md ✓
  - [ ] Implement I-9 workflow service
  - [ ] Implement E-Verify API client
  - [ ] Implement E-Verify workflow handler (TNC, referral, closure)
  - [ ] Create I-9/E-Verify API endpoints
  - [ ] Implement reverification tracking and alerts
  - [ ] Add E-Verify state requirement configuration

- [ ] **Document Storage System**
  - [ ] Create `hr_documents` schema
  - [ ] Create `document_types` table and seed data
  - [ ] Implement blob storage provider interface
  - [ ] Implement local disk provider (development)
  - [ ] Implement Azure Blob provider (production)
  - [ ] Implement document encryption service
  - [ ] Implement virus scanning integration
  - [ ] Implement document storage service
  - [ ] Create document API endpoints

- [ ] **Retention Policies**
  - [ ] Create `hr_compliance.retention_policies` table and seed
  - [ ] Implement retention calculation service
  - [ ] Implement retention enforcement job
  - [ ] Implement legal hold service
  - [ ] Create retention dashboard APIs
  - [ ] Set up job scheduling (daily 2 AM)

- [ ] **Audit Logging**
  - [ ] Create `hr_audit` schema (write-only)
  - [ ] Create `events` table with partitions
  - [ ] Create `sensitive_data_access` table
  - [ ] Create immutability triggers
  - [ ] Implement audit logger service
  - [ ] Integrate audit logging across all HR operations
  - [ ] Create audit query APIs

- [ ] **State-Specific Compliance**
  - [ ] Create `hr_compliance.state_rules` table and seed all 50 states
  - [ ] Implement state compliance engine
  - [ ] Implement state validation service
  - [ ] Create state compliance API endpoints
  - [ ] Add final pay deadline calculator

### Phase 2C: TimeTracking Integration (1 week)

- [ ] **Event Publishing**
  - [ ] Set up message broker (RabbitMQ/Kafka)
  - [ ] Implement event publisher service
  - [ ] Add event publishing to all HR aggregate methods
  - [ ] Create dead-letter handling

- [ ] **TimeTracking Subscription**
  - [ ] Create employee projection table in TimeTracking
  - [ ] Implement event handlers
  - [ ] Implement projection update logic
  - [ ] Add projection sync status monitoring

- [ ] **Validation API**
  - [ ] Implement `can-work` endpoint
  - [ ] Add certification validation logic
  - [ ] Add state compliance validation
  - [ ] Set up service-to-service authentication

- [ ] **Migration**
  - [ ] Write migration job
  - [ ] Test with subset of data
  - [ ] Execute full migration
  - [ ] Validate data integrity
  - [ ] Cut over and monitor
  - [ ] Archive legacy table

---

## Appendix A: Compliance Reference Links

- [USCIS I-9 Central](https://www.uscis.gov/i-9-central)
- [E-Verify Employer Resource Center](https://www.e-verify.gov/employers)
- [OFCCP Compliance Guide](https://www.dol.gov/agencies/ofccp/compliance-assistance)
- [EEO-1 Component 1 Instructions](https://www.eeoc.gov/employers/eeo-1-data-collection)
- [California Labor Code](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=LAB&sectionNum=226)
- [DOL FLSA Recordkeeping](https://www.dol.gov/agencies/whd/flsa/recordkeeping)

---

*This specification will be implemented directly. All design decisions have been made with input from Domain Expert, Architect, Compliance Officer, and Payroll Integration Specialist perspectives per the SYNTHESIS.md consensus.*
