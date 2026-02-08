# HR Core Module - Entities & Domain Model

**Version:** 1.0  
**Date:** February 8, 2026  
**Status:** Draft  
**Module:** Pitbull.HRCore

---

## Table of Contents

1. [Overview](#overview)
2. [Design Principles](#design-principles)
3. [Aggregate Boundaries](#aggregate-boundaries)
4. [Entity vs Value Object Distinction](#entity-vs-value-object-distinction)
5. [Core Entities](#core-entities)
   - [Employee (Aggregate Root)](#employee-aggregate-root)
   - [EmploymentEpisode](#employmentepisode)
   - [Certification](#certification)
   - [PayRate](#payrate)
   - [WithholdingElection](#withholdingelection)
   - [Deduction](#deduction)
   - [EmergencyContact](#emergencycontact)
   - [EmployeeDocument](#employeedocument)
   - [UnionMembership](#unionmembership)
   - [I9Record](#i9record)
   - [EVerifyCase](#everifycase)
6. [Value Objects](#value-objects)
7. [Enumerations](#enumerations)
8. [Segregated EEO Schema](#segregated-eeo-schema)
9. [Supporting Entities](#supporting-entities)
10. [Entity Relationships](#entity-relationships)
11. [Database Indexes](#database-indexes)
12. [Domain Events](#domain-events)
13. [Implementation Notes](#implementation-notes)

---

## Overview

The HR Core module is the **single source of truth** for employee data in Pitbull Construction Solutions. It owns:

- Employee identity and personal information
- Employment history (episodes, rehires, terminations)
- Certifications and compliance tracking
- Pay rates (multi-rate, effective-dated, project-scoped)
- Tax withholdings (W-4, state elections)
- Deductions (benefits, garnishments, union dues)
- Union membership and dispatch tracking
- Document storage and retention
- I-9 verification and E-Verify integration

Other modules (TimeTracking, Payroll, Projects) consume HR data via domain events and query APIs.

---

## Design Principles

### 1. Event Sourcing for Audit Trail
All employee lifecycle changes emit domain events. An immutable audit log captures:
- Who changed what
- When it changed
- Previous and new values
- Correlation ID for agent automation traceability

### 2. Effective Dating
Rates, withholdings, and deductions use `EffectiveDate` / `ExpirationDate` patterns:
- Never delete—expire and create new
- Query by date to get point-in-time state
- Full history preserved for audits

### 3. Row-Level Security (RLS)
All tables include `TenantId` with PostgreSQL RLS policies:
```sql
CREATE POLICY tenant_isolation ON hr.employees
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

### 4. Soft Delete
All entities inherit `IsDeleted`, `DeletedAt`, `DeletedBy` from `BaseEntity`. Hard deletes only occur via retention enforcement jobs after legal hold periods expire.

### 5. Construction Industry Patterns
- Rehire-first design (60% turnover is normal)
- Multiple simultaneous pay rates per employee
- Union dispatch and apprentice tracking
- Multi-state workers with complex tax jurisdictions

---

## Aggregate Boundaries

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EMPLOYEE AGGREGATE                                   │
│  ┌──────────────┐                                                           │
│  │   Employee   │ ◄─── Aggregate Root                                       │
│  │  (HR Core)   │                                                           │
│  └──────┬───────┘                                                           │
│         │                                                                   │
│         ├──────────────┬──────────────┬───────────────┬─────────────────┐  │
│         │              │              │               │                 │  │
│         ▼              ▼              ▼               ▼                 ▼  │
│  ┌────────────┐ ┌────────────┐ ┌───────────┐ ┌─────────────┐ ┌──────────┐ │
│  │Employment  │ │Certification│ │  PayRate  │ │ Withholding │ │Deduction │ │
│  │  Episode   │ │            │ │           │ │  Election   │ │          │ │
│  └────────────┘ └────────────┘ └───────────┘ └─────────────┘ └──────────┘ │
│         │                                                                   │
│         ├──────────────┬──────────────┬───────────────┐                    │
│         │              │              │               │                    │
│         ▼              ▼              ▼               ▼                    │
│  ┌────────────┐ ┌────────────┐ ┌───────────┐ ┌─────────────┐              │
│  │ Emergency  │ │  Employee  │ │   Union   │ │  I9Record   │              │
│  │  Contact   │ │  Document  │ │ Membership│ │ + EVerify   │              │
│  └────────────┘ └────────────┘ └───────────┘ └─────────────┘              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      SEGREGATED EEO AGGREGATE                               │
│  ┌──────────────────────┐                                                   │
│  │ EmployeeDemographics │ ◄─── Separate schema (hr_eeo), restricted access  │
│  │   (hr_eeo schema)    │                                                   │
│  └──────────────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Aggregate Rules

1. **Employee is the root** - All child entities are accessed through Employee
2. **Consistency boundary** - Changes to child entities go through Employee methods
3. **Transaction boundary** - One Employee aggregate per transaction
4. **Identity** - Children have their own IDs but are scoped to parent EmployeeId
5. **Cascade** - Deleting an Employee soft-deletes all children

---

## Entity vs Value Object Distinction

### Entities (Have Identity, Lifecycle)
| Entity | Why Entity? |
|--------|-------------|
| Employee | Core identity, referenced by other modules |
| EmploymentEpisode | Distinct periods with start/end, queryable history |
| Certification | Tracked independently, has expiration lifecycle |
| PayRate | Effective-dated records, need audit trail |
| WithholdingElection | Legal documents, need history |
| Deduction | Tracked for YTD, arrears calculations |
| EmergencyContact | Multiple per employee, need to update individually |
| EmployeeDocument | File storage with metadata, retention tracking |
| UnionMembership | Separate dispatch/apprentice tracking |
| I9Record | Legal compliance, E-Verify case tracking |
| EVerifyCase | Government integration, case status tracking |

### Value Objects (No Identity, Immutable)
| Value Object | Why Value Object? |
|--------------|-------------------|
| PersonalInfo | Embedded data, no separate identity |
| Address | Reusable structure, no lifecycle |
| TaxProfile | Configuration, replaced wholesale |
| PhoneNumber | Validated format, no identity |
| SSN | Encrypted value, no separate existence |
| Money | Decimal + currency, immutable |
| DateRange | Start/end pair, no identity |

---

## Core Entities

### Employee (Aggregate Root)

The central entity representing a worker. Inherits from `BaseEntity`.

```csharp
namespace Pitbull.HRCore.Domain;

/// <summary>
/// Core employee entity. The aggregate root for all HR data.
/// Represents a worker who can be assigned to projects and log time.
/// </summary>
public class Employee : BaseEntity
{
    // ──────────────────────────────────────────────────────────────
    // Identity
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Employee number/badge number. Unique within tenant.
    /// Format: Configurable per tenant (e.g., "EMP-001", "10045")
    /// </summary>
    public string EmployeeNumber { get; private set; } = string.Empty;
    
    /// <summary>
    /// Legal first name as it appears on tax documents.
    /// </summary>
    public string FirstName { get; private set; } = string.Empty;
    
    /// <summary>
    /// Middle name or initial (optional).
    /// </summary>
    public string? MiddleName { get; private set; }
    
    /// <summary>
    /// Legal last name as it appears on tax documents.
    /// </summary>
    public string LastName { get; private set; } = string.Empty;
    
    /// <summary>
    /// Preferred name for display (if different from legal name).
    /// </summary>
    public string? PreferredName { get; private set; }
    
    /// <summary>
    /// Suffix (Jr., Sr., III, etc.)
    /// </summary>
    public string? Suffix { get; private set; }
    
    /// <summary>
    /// Full display name (computed).
    /// </summary>
    public string FullName => string.IsNullOrEmpty(PreferredName) 
        ? $"{FirstName} {LastName}".Trim()
        : $"{PreferredName} {LastName}".Trim();
    
    /// <summary>
    /// Legal full name for tax documents.
    /// </summary>
    public string LegalFullName => string.Join(" ", 
        new[] { FirstName, MiddleName, LastName, Suffix }
        .Where(s => !string.IsNullOrEmpty(s)));
    
    // ──────────────────────────────────────────────────────────────
    // Sensitive PII (Encrypted at rest)
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Social Security Number (encrypted, never logged).
    /// Required for payroll and tax reporting.
    /// </summary>
    public string SSNEncrypted { get; private set; } = string.Empty;
    
    /// <summary>
    /// Last 4 digits of SSN for display/verification.
    /// </summary>
    public string SSNLast4 { get; private set; } = string.Empty;
    
    /// <summary>
    /// Date of birth. Required for age verification and benefits.
    /// </summary>
    public DateOnly DateOfBirth { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Contact Information
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Primary email address for notifications and login.
    /// </summary>
    public string? Email { get; private set; }
    
    /// <summary>
    /// Personal/secondary email (for terminated employee contact).
    /// </summary>
    public string? PersonalEmail { get; private set; }
    
    /// <summary>
    /// Primary phone number (mobile preferred).
    /// </summary>
    public string? Phone { get; private set; }
    
    /// <summary>
    /// Secondary/home phone number.
    /// </summary>
    public string? SecondaryPhone { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Home Address (Value Object embedded)
    // ──────────────────────────────────────────────────────────────
    
    public string? AddressLine1 { get; private set; }
    public string? AddressLine2 { get; private set; }
    public string? City { get; private set; }
    public string? State { get; private set; }
    public string? ZipCode { get; private set; }
    public string? Country { get; private set; } = "US";
    
    // ──────────────────────────────────────────────────────────────
    // Employment Status
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Current employment status.
    /// </summary>
    public EmploymentStatus Status { get; private set; } = EmploymentStatus.Active;
    
    /// <summary>
    /// Original hire date (first episode).
    /// </summary>
    public DateOnly OriginalHireDate { get; private set; }
    
    /// <summary>
    /// Most recent hire date (current or last episode).
    /// </summary>
    public DateOnly MostRecentHireDate { get; private set; }
    
    /// <summary>
    /// Termination date if not currently active.
    /// </summary>
    public DateOnly? TerminationDate { get; private set; }
    
    /// <summary>
    /// Whether eligible for rehire after termination.
    /// </summary>
    public bool EligibleForRehire { get; private set; } = true;
    
    /// <summary>
    /// Adjusted service date for seniority calculations.
    /// Accounts for breaks in service.
    /// </summary>
    public DateOnly? AdjustedServiceDate { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Classification
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Worker type: Field, Office, or Hybrid.
    /// </summary>
    public WorkerType WorkerType { get; private set; } = WorkerType.Field;
    
    /// <summary>
    /// FLSA classification: Exempt (salary) or NonExempt (hourly).
    /// </summary>
    public FLSAStatus FLSAStatus { get; private set; } = FLSAStatus.NonExempt;
    
    /// <summary>
    /// Full-time or Part-time status.
    /// </summary>
    public EmploymentType EmploymentType { get; private set; } = EmploymentType.FullTime;
    
    /// <summary>
    /// Job title for display.
    /// </summary>
    public string? JobTitle { get; private set; }
    
    /// <summary>
    /// Trade code (e.g., "CARP", "ELEC", "LABR", "OPER").
    /// Links to tenant's trade code configuration.
    /// </summary>
    public string? TradeCode { get; private set; }
    
    /// <summary>
    /// Workers' compensation class code for insurance.
    /// </summary>
    public string? WorkersCompClassCode { get; private set; }
    
    /// <summary>
    /// Department for organizational reporting.
    /// </summary>
    public Guid? DepartmentId { get; private set; }
    
    /// <summary>
    /// Primary supervisor who approves time entries.
    /// </summary>
    public Guid? SupervisorId { get; private set; }
    
    /// <summary>
    /// Default crew assignment for field workers.
    /// </summary>
    public Guid? DefaultCrewId { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Tax Configuration (Value Object embedded)
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Home/resident state for tax purposes.
    /// </summary>
    public string HomeState { get; private set; } = string.Empty;
    
    /// <summary>
    /// SUI (State Unemployment Insurance) state.
    /// Often differs from home state for construction workers.
    /// </summary>
    public string SUISate { get; private set; } = string.Empty;
    
    /// <summary>
    /// States the employee is authorized to work in.
    /// JSON array: ["CA", "WA", "OR"]
    /// </summary>
    public string WorkStatesJson { get; private set; } = "[]";
    
    /// <summary>
    /// Local tax jurisdictions (city/county).
    /// JSON array of jurisdiction codes.
    /// </summary>
    public string LocalTaxJurisdictionsJson { get; private set; } = "[]";
    
    // ──────────────────────────────────────────────────────────────
    // Payroll Configuration
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Pay frequency: Weekly, BiWeekly, SemiMonthly, Monthly.
    /// </summary>
    public PayFrequency PayFrequency { get; private set; } = PayFrequency.Weekly;
    
    /// <summary>
    /// Default pay type: Hourly or Salary.
    /// </summary>
    public PayType DefaultPayType { get; private set; } = PayType.Hourly;
    
    /// <summary>
    /// Default hourly rate (fallback when no specific rate matches).
    /// </summary>
    public decimal? DefaultHourlyRate { get; private set; }
    
    /// <summary>
    /// Annual salary amount (for salaried employees).
    /// </summary>
    public decimal? AnnualSalary { get; private set; }
    
    /// <summary>
    /// Payment method preference.
    /// </summary>
    public PaymentMethod PaymentMethod { get; private set; } = PaymentMethod.DirectDeposit;
    
    // ──────────────────────────────────────────────────────────────
    // Union Information
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Whether employee is a union member.
    /// </summary>
    public bool IsUnionMember { get; private set; }
    
    /// <summary>
    /// Primary union local ID (FK to UnionLocal reference table).
    /// </summary>
    public Guid? PrimaryUnionLocalId { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Compliance Tracking
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// I-9 verification status.
    /// </summary>
    public I9Status I9Status { get; private set; } = I9Status.NotStarted;
    
    /// <summary>
    /// E-Verify case status (if used).
    /// </summary>
    public EVerifyStatus? EVerifyStatus { get; private set; }
    
    /// <summary>
    /// Background check status.
    /// </summary>
    public BackgroundCheckStatus? BackgroundCheckStatus { get; private set; }
    
    /// <summary>
    /// Drug test status.
    /// </summary>
    public DrugTestStatus? DrugTestStatus { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Application User Link
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Link to ASP.NET Identity user (if employee has system access).
    /// Null for employees without login (e.g., field workers without app).
    /// </summary>
    public Guid? AppUserId { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Notes
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// General notes about the employee (not visible to employee).
    /// </summary>
    public string? Notes { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Navigation Properties (Child Entities)
    // ──────────────────────────────────────────────────────────────
    
    public ICollection<EmploymentEpisode> EmploymentEpisodes { get; private set; } = [];
    public ICollection<Certification> Certifications { get; private set; } = [];
    public ICollection<PayRate> PayRates { get; private set; } = [];
    public ICollection<WithholdingElection> WithholdingElections { get; private set; } = [];
    public ICollection<Deduction> Deductions { get; private set; } = [];
    public ICollection<EmergencyContact> EmergencyContacts { get; private set; } = [];
    public ICollection<EmployeeDocument> Documents { get; private set; } = [];
    public ICollection<UnionMembership> UnionMemberships { get; private set; } = [];
    public I9Record? I9Record { get; private set; }
    
    // Navigation to reference entities
    public Employee? Supervisor { get; private set; }
    public ICollection<Employee> DirectReports { get; private set; } = [];
}
```

#### Database Table: `hr.employees`

| Column | Type | Nullable | Constraints | Description |
|--------|------|----------|-------------|-------------|
| id | uuid | NO | PK, DEFAULT gen_random_uuid() | Unique identifier |
| tenant_id | uuid | NO | FK tenants(id), INDEX | Tenant isolation |
| employee_number | varchar(20) | NO | UNIQUE per tenant | Badge/clock number |
| first_name | varchar(50) | NO | | Legal first name |
| middle_name | varchar(50) | YES | | Middle name/initial |
| last_name | varchar(50) | NO | | Legal last name |
| preferred_name | varchar(50) | YES | | Display name |
| suffix | varchar(10) | YES | | Jr., Sr., III |
| ssn_encrypted | bytea | NO | | AES-256 encrypted SSN |
| ssn_last4 | char(4) | NO | | Last 4 for verification |
| date_of_birth | date | NO | CHECK >= 1900-01-01 | DOB |
| email | varchar(255) | YES | INDEX | Work email |
| personal_email | varchar(255) | YES | | Personal email |
| phone | varchar(20) | YES | | Primary phone |
| secondary_phone | varchar(20) | YES | | Home phone |
| address_line1 | varchar(100) | YES | | Street address |
| address_line2 | varchar(100) | YES | | Apt/Suite |
| city | varchar(50) | YES | | City |
| state | char(2) | YES | | State code |
| zip_code | varchar(10) | YES | | ZIP/Postal code |
| country | char(2) | YES | DEFAULT 'US' | Country code |
| status | smallint | NO | DEFAULT 1 | EmploymentStatus enum |
| original_hire_date | date | NO | | First hire date |
| most_recent_hire_date | date | NO | | Current/last hire |
| termination_date | date | YES | | If terminated |
| eligible_for_rehire | boolean | NO | DEFAULT true | Rehire eligibility |
| adjusted_service_date | date | YES | | Seniority date |
| worker_type | smallint | NO | DEFAULT 1 | Field/Office/Hybrid |
| flsa_status | smallint | NO | DEFAULT 1 | Exempt/NonExempt |
| employment_type | smallint | NO | DEFAULT 1 | FullTime/PartTime |
| job_title | varchar(100) | YES | | Job title |
| trade_code | varchar(10) | YES | INDEX | Trade classification |
| workers_comp_class_code | varchar(10) | YES | | WC class code |
| department_id | uuid | YES | FK departments(id) | Department |
| supervisor_id | uuid | YES | FK employees(id) | Direct supervisor |
| default_crew_id | uuid | YES | FK crews(id) | Default crew |
| home_state | char(2) | NO | | Resident state |
| sui_state | char(2) | NO | | SUI state |
| work_states_json | jsonb | NO | DEFAULT '[]' | Work states array |
| local_tax_jurisdictions_json | jsonb | NO | DEFAULT '[]' | Local tax codes |
| pay_frequency | smallint | NO | DEFAULT 1 | Pay frequency |
| default_pay_type | smallint | NO | DEFAULT 1 | Hourly/Salary |
| default_hourly_rate | numeric(10,4) | YES | CHECK >= 0 | Fallback rate |
| annual_salary | numeric(12,2) | YES | CHECK >= 0 | Salary amount |
| payment_method | smallint | NO | DEFAULT 1 | Payment method |
| is_union_member | boolean | NO | DEFAULT false | Union flag |
| primary_union_local_id | uuid | YES | FK union_locals(id) | Primary union |
| i9_status | smallint | NO | DEFAULT 0 | I-9 status |
| e_verify_status | smallint | YES | | E-Verify status |
| background_check_status | smallint | YES | | Background check |
| drug_test_status | smallint | YES | | Drug test |
| app_user_id | uuid | YES | FK app_users(id), UNIQUE | System user link |
| notes | text | YES | | Internal notes |
| created_at | timestamptz | NO | DEFAULT now() | Created timestamp |
| created_by | varchar(100) | NO | | Created by user |
| updated_at | timestamptz | YES | | Last update |
| updated_by | varchar(100) | YES | | Updated by user |
| is_deleted | boolean | NO | DEFAULT false | Soft delete flag |
| deleted_at | timestamptz | YES | | Deletion timestamp |
| deleted_by | varchar(100) | YES | | Deleted by user |
| xmin | xid | NO | | Optimistic concurrency |

---

### EmploymentEpisode

Tracks distinct periods of employment for rehire support.

```csharp
/// <summary>
/// Represents a distinct period of employment.
/// Supports the rehire-first pattern common in construction (60% turnover).
/// </summary>
public class EmploymentEpisode : BaseEntity
{
    /// <summary>
    /// Parent employee.
    /// </summary>
    public Guid EmployeeId { get; private set; }
    
    /// <summary>
    /// Episode sequence number (1 = first hire, 2 = first rehire, etc.)
    /// </summary>
    public int EpisodeNumber { get; private set; }
    
    /// <summary>
    /// Start date of this employment period.
    /// </summary>
    public DateOnly HireDate { get; private set; }
    
    /// <summary>
    /// End date of this employment period (null if current).
    /// </summary>
    public DateOnly? TerminationDate { get; private set; }
    
    /// <summary>
    /// Reason for separation.
    /// </summary>
    public SeparationReason? SeparationReason { get; private set; }
    
    /// <summary>
    /// Whether eligible for rehire after this separation.
    /// </summary>
    public bool? EligibleForRehire { get; private set; }
    
    /// <summary>
    /// Notes about separation/rehire eligibility.
    /// </summary>
    public string? SeparationNotes { get; private set; }
    
    /// <summary>
    /// Voluntary or involuntary termination.
    /// </summary>
    public bool? WasVoluntary { get; private set; }
    
    /// <summary>
    /// Union dispatch reference number (if applicable).
    /// </summary>
    public string? UnionDispatchReference { get; private set; }
    
    /// <summary>
    /// Job classification at time of this episode.
    /// </summary>
    public string? JobClassificationAtHire { get; private set; }
    
    /// <summary>
    /// Pay rate at time of this episode (snapshot).
    /// </summary>
    public decimal? HourlyRateAtHire { get; private set; }
    
    /// <summary>
    /// Position/title at start of episode.
    /// </summary>
    public string? PositionAtHire { get; private set; }
    
    /// <summary>
    /// Position/title at end of episode.
    /// </summary>
    public string? PositionAtTermination { get; private set; }
    
    // Navigation
    public Employee Employee { get; private set; } = null!;
}
```

#### Database Table: `hr.employment_episodes`

| Column | Type | Nullable | Constraints | Description |
|--------|------|----------|-------------|-------------|
| id | uuid | NO | PK | Unique identifier |
| tenant_id | uuid | NO | FK, INDEX, RLS | Tenant isolation |
| employee_id | uuid | NO | FK employees(id), INDEX | Parent employee |
| episode_number | int | NO | CHECK >= 1 | Sequence number |
| hire_date | date | NO | | Episode start |
| termination_date | date | YES | CHECK >= hire_date | Episode end |
| separation_reason | smallint | YES | | SeparationReason enum |
| eligible_for_rehire | boolean | YES | | Rehire flag |
| separation_notes | text | YES | | Separation notes |
| was_voluntary | boolean | YES | | Voluntary/involuntary |
| union_dispatch_reference | varchar(50) | YES | | Union dispatch # |
| job_classification_at_hire | varchar(50) | YES | | Classification snapshot |
| hourly_rate_at_hire | numeric(10,4) | YES | | Rate snapshot |
| position_at_hire | varchar(100) | YES | | Title at start |
| position_at_termination | varchar(100) | YES | | Title at end |
| created_at | timestamptz | NO | | Audit |
| created_by | varchar(100) | NO | | Audit |
| updated_at | timestamptz | YES | | Audit |
| updated_by | varchar(100) | YES | | Audit |
| is_deleted | boolean | NO | DEFAULT false | Soft delete |
| deleted_at | timestamptz | YES | | Audit |
| deleted_by | varchar(100) | YES | | Audit |

**Unique Constraint:** `(tenant_id, employee_id, episode_number)`

---

### Certification

Tracks training, licenses, and certifications with expiration enforcement.

```csharp
/// <summary>
/// Employee certification/license with expiration tracking.
/// Hard stops prevent time logging with expired required certifications.
/// </summary>
public class Certification : BaseEntity
{
    /// <summary>
    /// Parent employee.
    /// </summary>
    public Guid EmployeeId { get; private set; }
    
    /// <summary>
    /// Type of certification (FK to CertificationType reference).
    /// </summary>
    public Guid CertificationTypeId { get; private set; }
    
    /// <summary>
    /// Certification type code for quick reference (denormalized).
    /// </summary>
    public string CertificationTypeCode { get; private set; } = string.Empty;
    
    /// <summary>
    /// Certificate/license number.
    /// </summary>
    public string? CertificateNumber { get; private set; }
    
    /// <summary>
    /// Issuing authority/organization.
    /// </summary>
    public string? IssuingAuthority { get; private set; }
    
    /// <summary>
    /// Date certification was issued.
    /// </summary>
    public DateOnly IssueDate { get; private set; }
    
    /// <summary>
    /// Expiration date (null for non-expiring certifications).
    /// </summary>
    public DateOnly? ExpirationDate { get; private set; }
    
    /// <summary>
    /// Current verification status.
    /// </summary>
    public CertificationStatus Status { get; private set; } = CertificationStatus.Pending;
    
    /// <summary>
    /// Date verification was performed.
    /// </summary>
    public DateTime? VerifiedAt { get; private set; }
    
    /// <summary>
    /// Who verified the certification.
    /// </summary>
    public string? VerifiedBy { get; private set; }
    
    /// <summary>
    /// Notes about verification.
    /// </summary>
    public string? VerificationNotes { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Warning Tracking (for automated notifications)
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Date 90-day warning was sent.
    /// </summary>
    public DateTime? Warning90DaysSentAt { get; private set; }
    
    /// <summary>
    /// Date 60-day warning was sent.
    /// </summary>
    public DateTime? Warning60DaysSentAt { get; private set; }
    
    /// <summary>
    /// Date 30-day warning was sent.
    /// </summary>
    public DateTime? Warning30DaysSentAt { get; private set; }
    
    /// <summary>
    /// Date expired notification was sent.
    /// </summary>
    public DateTime? ExpiredNotificationSentAt { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Document Link
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Link to scanned certificate document.
    /// </summary>
    public Guid? DocumentId { get; private set; }
    
    // Navigation
    public Employee Employee { get; private set; } = null!;
    public CertificationType CertificationType { get; private set; } = null!;
    public EmployeeDocument? Document { get; private set; }
}
```

#### Database Table: `hr.certifications`

| Column | Type | Nullable | Constraints | Description |
|--------|------|----------|-------------|-------------|
| id | uuid | NO | PK | Unique identifier |
| tenant_id | uuid | NO | FK, INDEX, RLS | Tenant isolation |
| employee_id | uuid | NO | FK employees(id), INDEX | Parent employee |
| certification_type_id | uuid | NO | FK certification_types(id) | Cert type |
| certification_type_code | varchar(20) | NO | INDEX | Denormalized code |
| certificate_number | varchar(50) | YES | | License number |
| issuing_authority | varchar(100) | YES | | Issuer |
| issue_date | date | NO | | Issue date |
| expiration_date | date | YES | INDEX | Expiration |
| status | smallint | NO | DEFAULT 0 | CertificationStatus |
| verified_at | timestamptz | YES | | Verification timestamp |
| verified_by | varchar(100) | YES | | Verified by |
| verification_notes | text | YES | | Notes |
| warning_90_days_sent_at | timestamptz | YES | | 90-day warning |
| warning_60_days_sent_at | timestamptz | YES | | 60-day warning |
| warning_30_days_sent_at | timestamptz | YES | | 30-day warning |
| expired_notification_sent_at | timestamptz | YES | | Expired notice |
| document_id | uuid | YES | FK employee_documents(id) | Doc link |
| created_at | timestamptz | NO | | Audit |
| created_by | varchar(100) | NO | | Audit |
| updated_at | timestamptz | YES | | Audit |
| updated_by | varchar(100) | YES | | Audit |
| is_deleted | boolean | NO | DEFAULT false | Soft delete |
| deleted_at | timestamptz | YES | | Audit |
| deleted_by | varchar(100) | YES | | Audit |

---

### PayRate

Effective-dated, multi-dimensional pay rate structure.

```csharp
/// <summary>
/// Employee pay rate with effective dating and multi-dimensional scoping.
/// Supports construction-specific patterns: prevailing wage, shift differentials,
/// project-specific rates, and union scale.
/// </summary>
public class PayRate : BaseEntity
{
    /// <summary>
    /// Parent employee.
    /// </summary>
    public Guid EmployeeId { get; private set; }
    
    /// <summary>
    /// Human-readable description of this rate.
    /// </summary>
    public string? Description { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Rate Definition
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Type of rate calculation.
    /// </summary>
    public RateType RateType { get; private set; } = RateType.Hourly;
    
    /// <summary>
    /// Base rate amount.
    /// </summary>
    public decimal Amount { get; private set; }
    
    /// <summary>
    /// Currency code (default USD).
    /// </summary>
    public string Currency { get; private set; } = "USD";
    
    // ──────────────────────────────────────────────────────────────
    // Effective Dating
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// When this rate becomes active.
    /// </summary>
    public DateOnly EffectiveDate { get; private set; }
    
    /// <summary>
    /// When this rate expires (null = indefinite).
    /// </summary>
    public DateOnly? ExpirationDate { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Scoping (all nullable = applies to all)
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Specific project this rate applies to (null = all projects).
    /// </summary>
    public Guid? ProjectId { get; private set; }
    
    /// <summary>
    /// Job classification this rate applies to.
    /// </summary>
    public Guid? JobClassificationId { get; private set; }
    
    /// <summary>
    /// Wage determination ID for prevailing wage (Davis-Bacon).
    /// </summary>
    public Guid? WageDeterminationId { get; private set; }
    
    /// <summary>
    /// Shift code (e.g., "DAY", "SWING", "GRAVE").
    /// </summary>
    public string? ShiftCode { get; private set; }
    
    /// <summary>
    /// Union local this rate is associated with.
    /// </summary>
    public Guid? UnionLocalId { get; private set; }
    
    /// <summary>
    /// Work state this rate applies to (for state-specific rates).
    /// </summary>
    public string? WorkState { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Rate Selection Priority
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Priority for rate selection (higher = checked first).
    /// Default priority tiers:
    ///   100 = Project + Classification + WageDetermination
    ///    90 = Project + Classification
    ///    80 = WageDetermination only
    ///    70 = Classification only
    ///    50 = Shift differential
    ///    10 = Default rate
    /// </summary>
    public int Priority { get; private set; } = 10;
    
    // ──────────────────────────────────────────────────────────────
    // Fringe Benefits (Union/Prevailing Wage)
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Whether this rate includes fringe calculations.
    /// </summary>
    public bool IncludesFringe { get; private set; }
    
    /// <summary>
    /// Fringe benefit rate (hourly).
    /// </summary>
    public decimal? FringeRate { get; private set; }
    
    /// <summary>
    /// Health & welfare contribution (hourly).
    /// </summary>
    public decimal? HealthWelfareRate { get; private set; }
    
    /// <summary>
    /// Pension contribution (hourly).
    /// </summary>
    public decimal? PensionRate { get; private set; }
    
    /// <summary>
    /// Training fund contribution (hourly).
    /// </summary>
    public decimal? TrainingRate { get; private set; }
    
    /// <summary>
    /// Other fringe contributions (hourly).
    /// </summary>
    public decimal? OtherFringeRate { get; private set; }
    
    /// <summary>
    /// Total hourly cost (base + all fringe).
    /// </summary>
    public decimal TotalHourlyCost => Amount + (FringeRate ?? 0) + 
        (HealthWelfareRate ?? 0) + (PensionRate ?? 0) + 
        (TrainingRate ?? 0) + (OtherFringeRate ?? 0);
    
    // ──────────────────────────────────────────────────────────────
    // Metadata
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Source of this rate (manual entry, union scale import, etc.)
    /// </summary>
    public RateSource Source { get; private set; } = RateSource.Manual;
    
    /// <summary>
    /// Notes about this rate.
    /// </summary>
    public string? Notes { get; private set; }
    
    // Navigation
    public Employee Employee { get; private set; } = null!;
}
```

#### Database Table: `hr.pay_rates`

| Column | Type | Nullable | Constraints | Description |
|--------|------|----------|-------------|-------------|
| id | uuid | NO | PK | Unique identifier |
| tenant_id | uuid | NO | FK, INDEX, RLS | Tenant isolation |
| employee_id | uuid | NO | FK employees(id), INDEX | Parent employee |
| description | varchar(200) | YES | | Rate description |
| rate_type | smallint | NO | DEFAULT 1 | RateType enum |
| amount | numeric(10,4) | NO | CHECK >= 0 | Base rate |
| currency | char(3) | NO | DEFAULT 'USD' | Currency |
| effective_date | date | NO | INDEX | Start date |
| expiration_date | date | YES | INDEX | End date |
| project_id | uuid | YES | FK projects(id), INDEX | Project scope |
| job_classification_id | uuid | YES | FK job_classifications(id) | Classification |
| wage_determination_id | uuid | YES | FK wage_determinations(id) | Davis-Bacon |
| shift_code | varchar(10) | YES | INDEX | Shift scope |
| union_local_id | uuid | YES | FK union_locals(id) | Union scope |
| work_state | char(2) | YES | INDEX | State scope |
| priority | int | NO | DEFAULT 10 | Selection priority |
| includes_fringe | boolean | NO | DEFAULT false | Fringe flag |
| fringe_rate | numeric(10,4) | YES | CHECK >= 0 | Fringe rate |
| health_welfare_rate | numeric(10,4) | YES | CHECK >= 0 | H&W rate |
| pension_rate | numeric(10,4) | YES | CHECK >= 0 | Pension rate |
| training_rate | numeric(10,4) | YES | CHECK >= 0 | Training rate |
| other_fringe_rate | numeric(10,4) | YES | CHECK >= 0 | Other fringe |
| source | smallint | NO | DEFAULT 0 | RateSource enum |
| notes | text | YES | | Notes |
| created_at | timestamptz | NO | | Audit |
| created_by | varchar(100) | NO | | Audit |
| updated_at | timestamptz | YES | | Audit |
| updated_by | varchar(100) | YES | | Audit |
| is_deleted | boolean | NO | DEFAULT false | Soft delete |
| deleted_at | timestamptz | YES | | Audit |
| deleted_by | varchar(100) | YES | | Audit |

---

### WithholdingElection

Tax withholding elections (Federal W-4 and state equivalents).

```csharp
/// <summary>
/// Employee tax withholding election.
/// Supports the 2020+ W-4 format and state-specific forms.
/// </summary>
public class WithholdingElection : BaseEntity
{
    /// <summary>
    /// Parent employee.
    /// </summary>
    public Guid EmployeeId { get; private set; }
    
    /// <summary>
    /// Type of withholding election.
    /// </summary>
    public WithholdingType Type { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Effective Dating
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// When this election becomes effective.
    /// </summary>
    public DateOnly EffectiveDate { get; private set; }
    
    /// <summary>
    /// When this election expires (usually when superseded).
    /// </summary>
    public DateOnly? ExpirationDate { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Federal W-4 (2020+ format)
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Step 1(c): Filing status.
    /// </summary>
    public FilingStatus? FilingStatus { get; private set; }
    
    /// <summary>
    /// Step 2(c): Multiple jobs or spouse works.
    /// </summary>
    public bool? MultipleJobsOrSpouseWorks { get; private set; }
    
    /// <summary>
    /// Step 3: Claim dependents amount (annual).
    /// </summary>
    public decimal? DependentsAmount { get; private set; }
    
    /// <summary>
    /// Step 4(a): Other income (annual).
    /// </summary>
    public decimal? OtherIncomeAmount { get; private set; }
    
    /// <summary>
    /// Step 4(b): Deductions (annual).
    /// </summary>
    public decimal? DeductionsAmount { get; private set; }
    
    /// <summary>
    /// Step 4(c): Extra withholding (per pay period).
    /// </summary>
    public decimal? ExtraWithholdingAmount { get; private set; }
    
    /// <summary>
    /// Exempt from federal withholding (must be renewed annually).
    /// </summary>
    public bool FederalExempt { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // State Withholding
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// State code for state withholding elections.
    /// </summary>
    public string? StateCode { get; private set; }
    
    /// <summary>
    /// State filing status (varies by state).
    /// </summary>
    public string? StateFilingStatus { get; private set; }
    
    /// <summary>
    /// State allowances (legacy states that still use allowances).
    /// </summary>
    public int? StateAllowances { get; private set; }
    
    /// <summary>
    /// State additional withholding amount.
    /// </summary>
    public decimal? StateAdditionalAmount { get; private set; }
    
    /// <summary>
    /// Exempt from state withholding.
    /// </summary>
    public bool StateExempt { get; private set; }
    
    /// <summary>
    /// State-specific JSON for complex state forms.
    /// </summary>
    public string? StateSpecificDataJson { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Reciprocity
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Employee has elected reciprocity with home state.
    /// </summary>
    public bool? ReciprocityElected { get; private set; }
    
    /// <summary>
    /// Certificate of non-residence document ID.
    /// </summary>
    public Guid? ReciprocityCertificateDocumentId { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Signature/Verification
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Date employee signed the form.
    /// </summary>
    public DateOnly? SignedDate { get; private set; }
    
    /// <summary>
    /// Electronic signature reference.
    /// </summary>
    public string? ElectronicSignatureRef { get; private set; }
    
    /// <summary>
    /// Link to scanned signed document.
    /// </summary>
    public Guid? DocumentId { get; private set; }
    
    // Navigation
    public Employee Employee { get; private set; } = null!;
    public EmployeeDocument? Document { get; private set; }
}
```

#### Database Table: `hr.withholding_elections`

| Column | Type | Nullable | Constraints | Description |
|--------|------|----------|-------------|-------------|
| id | uuid | NO | PK | Unique identifier |
| tenant_id | uuid | NO | FK, INDEX, RLS | Tenant isolation |
| employee_id | uuid | NO | FK employees(id), INDEX | Parent employee |
| type | smallint | NO | | WithholdingType enum |
| effective_date | date | NO | INDEX | Start date |
| expiration_date | date | YES | INDEX | End date |
| filing_status | smallint | YES | | FilingStatus enum |
| multiple_jobs_or_spouse_works | boolean | YES | | W-4 Step 2(c) |
| dependents_amount | numeric(10,2) | YES | CHECK >= 0 | W-4 Step 3 |
| other_income_amount | numeric(10,2) | YES | CHECK >= 0 | W-4 Step 4(a) |
| deductions_amount | numeric(10,2) | YES | CHECK >= 0 | W-4 Step 4(b) |
| extra_withholding_amount | numeric(10,2) | YES | CHECK >= 0 | W-4 Step 4(c) |
| federal_exempt | boolean | NO | DEFAULT false | Federal exempt |
| state_code | char(2) | YES | INDEX | State code |
| state_filing_status | varchar(20) | YES | | State filing |
| state_allowances | int | YES | CHECK >= 0 | State allowances |
| state_additional_amount | numeric(10,2) | YES | CHECK >= 0 | State additional |
| state_exempt | boolean | NO | DEFAULT false | State exempt |
| state_specific_data_json | jsonb | YES | | State-specific |
| reciprocity_elected | boolean | YES | | Reciprocity |
| reciprocity_certificate_document_id | uuid | YES | FK | Reciprocity cert |
| signed_date | date | YES | | Signature date |
| electronic_signature_ref | varchar(100) | YES | | E-signature |
| document_id | uuid | YES | FK employee_documents(id) | Form document |
| created_at | timestamptz | NO | | Audit |
| created_by | varchar(100) | NO | | Audit |
| updated_at | timestamptz | YES | | Audit |
| updated_by | varchar(100) | YES | | Audit |
| is_deleted | boolean | NO | DEFAULT false | Soft delete |
| deleted_at | timestamptz | YES | | Audit |
| deleted_by | varchar(100) | YES | | Audit |

---

### Deduction

Employee deductions with calculation methods and priority ordering.

```csharp
/// <summary>
/// Employee deduction (benefits, garnishments, union dues, retirement).
/// Supports flat, percentage, and hours-based calculations.
/// </summary>
public class Deduction : BaseEntity
{
    /// <summary>
    /// Parent employee.
    /// </summary>
    public Guid EmployeeId { get; private set; }
    
    /// <summary>
    /// Deduction category.
    /// </summary>
    public DeductionCategory Category { get; private set; }
    
    /// <summary>
    /// Specific deduction type (links to deduction type reference).
    /// </summary>
    public Guid DeductionTypeId { get; private set; }
    
    /// <summary>
    /// Deduction code for quick reference (denormalized).
    /// </summary>
    public string DeductionCode { get; private set; } = string.Empty;
    
    /// <summary>
    /// Description of this deduction.
    /// </summary>
    public string Description { get; private set; } = string.Empty;
    
    // ──────────────────────────────────────────────────────────────
    // Effective Dating
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// When this deduction becomes effective.
    /// </summary>
    public DateOnly EffectiveDate { get; private set; }
    
    /// <summary>
    /// When this deduction expires.
    /// </summary>
    public DateOnly? ExpirationDate { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Calculation
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// How the deduction is calculated.
    /// </summary>
    public DeductionCalculationMethod CalculationMethod { get; private set; }
    
    /// <summary>
    /// Amount or rate (interpretation depends on CalculationMethod).
    /// Flat: dollar amount per pay period
    /// Percentage: decimal (0.05 = 5%)
    /// HoursBased: dollar amount per hour
    /// </summary>
    public decimal AmountOrRate { get; private set; }
    
    /// <summary>
    /// Maximum amount per pay period.
    /// </summary>
    public decimal? MaxPerPayPeriod { get; private set; }
    
    /// <summary>
    /// Maximum amount per year (goal/limit).
    /// </summary>
    public decimal? AnnualLimit { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Tracking
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Year-to-date amount withheld.
    /// </summary>
    public decimal YTDWithheld { get; private set; }
    
    /// <summary>
    /// Arrears balance (when unable to take full deduction).
    /// </summary>
    public decimal ArrearsBalance { get; private set; }
    
    /// <summary>
    /// Total goal amount (for limited deductions like loans).
    /// </summary>
    public decimal? GoalAmount { get; private set; }
    
    /// <summary>
    /// Total collected toward goal.
    /// </summary>
    public decimal? GoalCollected { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Priority and Pre/Post Tax
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Deduction priority (garnishments have legally mandated order).
    /// Lower number = deducted first.
    /// 1-10: Legally mandated (tax levies, child support)
    /// 11-50: Pre-tax benefits
    /// 51-100: Post-tax benefits
    /// 101+: Voluntary deductions
    /// </summary>
    public int Priority { get; private set; }
    
    /// <summary>
    /// Whether this is a pre-tax deduction.
    /// </summary>
    public bool IsPreTax { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Garnishment-specific
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Case number (for garnishments).
    /// </summary>
    public string? CaseNumber { get; private set; }
    
    /// <summary>
    /// Court or agency issuing the garnishment.
    /// </summary>
    public string? IssuingAuthority { get; private set; }
    
    /// <summary>
    /// Payee for garnishment remittance.
    /// </summary>
    public string? PayeeName { get; private set; }
    
    /// <summary>
    /// Payee address for remittance.
    /// </summary>
    public string? PayeeAddress { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Document Link
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Link to enrollment form or court order.
    /// </summary>
    public Guid? DocumentId { get; private set; }
    
    /// <summary>
    /// Notes about this deduction.
    /// </summary>
    public string? Notes { get; private set; }
    
    // Navigation
    public Employee Employee { get; private set; } = null!;
    public DeductionType DeductionType { get; private set; } = null!;
    public EmployeeDocument? Document { get; private set; }
}
```

#### Database Table: `hr.deductions`

| Column | Type | Nullable | Constraints | Description |
|--------|------|----------|-------------|-------------|
| id | uuid | NO | PK | Unique identifier |
| tenant_id | uuid | NO | FK, INDEX, RLS | Tenant isolation |
| employee_id | uuid | NO | FK employees(id), INDEX | Parent employee |
| category | smallint | NO | | DeductionCategory enum |
| deduction_type_id | uuid | NO | FK deduction_types(id) | Deduction type |
| deduction_code | varchar(20) | NO | INDEX | Denormalized code |
| description | varchar(200) | NO | | Description |
| effective_date | date | NO | INDEX | Start date |
| expiration_date | date | YES | INDEX | End date |
| calculation_method | smallint | NO | | Calculation enum |
| amount_or_rate | numeric(12,4) | NO | CHECK >= 0 | Amount/rate |
| max_per_pay_period | numeric(10,2) | YES | CHECK >= 0 | Per-period max |
| annual_limit | numeric(12,2) | YES | CHECK >= 0 | Annual limit |
| ytd_withheld | numeric(12,2) | NO | DEFAULT 0 | YTD tracking |
| arrears_balance | numeric(10,2) | NO | DEFAULT 0 | Arrears |
| goal_amount | numeric(12,2) | YES | CHECK >= 0 | Goal total |
| goal_collected | numeric(12,2) | YES | CHECK >= 0 | Collected |
| priority | int | NO | CHECK >= 1 | Priority order |
| is_pre_tax | boolean | NO | DEFAULT false | Pre-tax flag |
| case_number | varchar(50) | YES | | Garnishment case # |
| issuing_authority | varchar(100) | YES | | Garnishment issuer |
| payee_name | varchar(100) | YES | | Garnishment payee |
| payee_address | text | YES | | Payee address |
| document_id | uuid | YES | FK employee_documents(id) | Form document |
| notes | text | YES | | Notes |
| created_at | timestamptz | NO | | Audit |
| created_by | varchar(100) | NO | | Audit |
| updated_at | timestamptz | YES | | Audit |
| updated_by | varchar(100) | YES | | Audit |
| is_deleted | boolean | NO | DEFAULT false | Soft delete |
| deleted_at | timestamptz | YES | | Audit |
| deleted_by | varchar(100) | YES | | Audit |

---

### EmergencyContact

Employee emergency contacts.

```csharp
/// <summary>
/// Employee emergency contact information.
/// </summary>
public class EmergencyContact : BaseEntity
{
    /// <summary>
    /// Parent employee.
    /// </summary>
    public Guid EmployeeId { get; private set; }
    
    /// <summary>
    /// Contact's full name.
    /// </summary>
    public string Name { get; private set; } = string.Empty;
    
    /// <summary>
    /// Relationship to employee.
    /// </summary>
    public string Relationship { get; private set; } = string.Empty;
    
    /// <summary>
    /// Primary phone number.
    /// </summary>
    public string PrimaryPhone { get; private set; } = string.Empty;
    
    /// <summary>
    /// Secondary phone number.
    /// </summary>
    public string? SecondaryPhone { get; private set; }
    
    /// <summary>
    /// Email address.
    /// </summary>
    public string? Email { get; private set; }
    
    /// <summary>
    /// Contact priority (1 = primary, 2 = secondary, etc.)
    /// </summary>
    public int Priority { get; private set; } = 1;
    
    /// <summary>
    /// Notes about this contact.
    /// </summary>
    public string? Notes { get; private set; }
    
    // Navigation
    public Employee Employee { get; private set; } = null!;
}
```

#### Database Table: `hr.emergency_contacts`

| Column | Type | Nullable | Constraints | Description |
|--------|------|----------|-------------|-------------|
| id | uuid | NO | PK | Unique identifier |
| tenant_id | uuid | NO | FK, INDEX, RLS | Tenant isolation |
| employee_id | uuid | NO | FK employees(id), INDEX | Parent employee |
| name | varchar(100) | NO | | Contact name |
| relationship | varchar(50) | NO | | Relationship |
| primary_phone | varchar(20) | NO | | Primary phone |
| secondary_phone | varchar(20) | YES | | Secondary phone |
| email | varchar(255) | YES | | Email |
| priority | int | NO | DEFAULT 1, CHECK >= 1 | Priority order |
| notes | text | YES | | Notes |
| created_at | timestamptz | NO | | Audit |
| created_by | varchar(100) | NO | | Audit |
| updated_at | timestamptz | YES | | Audit |
| updated_by | varchar(100) | YES | | Audit |
| is_deleted | boolean | NO | DEFAULT false | Soft delete |
| deleted_at | timestamptz | YES | | Audit |
| deleted_by | varchar(100) | YES | | Audit |

---

### EmployeeDocument

Document storage with retention tracking.

```csharp
/// <summary>
/// Employee document with storage and retention tracking.
/// Supports: certifications, I-9s, W-4s, direct deposit forms,
/// performance reviews, disciplinary records, etc.
/// </summary>
public class EmployeeDocument : BaseEntity
{
    /// <summary>
    /// Parent employee.
    /// </summary>
    public Guid EmployeeId { get; private set; }
    
    /// <summary>
    /// Document category.
    /// </summary>
    public DocumentCategory Category { get; private set; }
    
    /// <summary>
    /// Specific document type (links to document type reference).
    /// </summary>
    public Guid DocumentTypeId { get; private set; }
    
    /// <summary>
    /// Document title/filename for display.
    /// </summary>
    public string Title { get; private set; } = string.Empty;
    
    /// <summary>
    /// Original filename when uploaded.
    /// </summary>
    public string OriginalFilename { get; private set; } = string.Empty;
    
    /// <summary>
    /// Storage path or blob reference.
    /// Format: {tenant_id}/{employee_id}/{category}/{uuid}.{ext}
    /// </summary>
    public string StoragePath { get; private set; } = string.Empty;
    
    /// <summary>
    /// MIME type of the document.
    /// </summary>
    public string MimeType { get; private set; } = string.Empty;
    
    /// <summary>
    /// File size in bytes.
    /// </summary>
    public long FileSizeBytes { get; private set; }
    
    /// <summary>
    /// SHA-256 hash for integrity verification.
    /// </summary>
    public string ContentHash { get; private set; } = string.Empty;
    
    // ──────────────────────────────────────────────────────────────
    // Retention
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Document effective date (e.g., when W-4 was signed).
    /// </summary>
    public DateOnly? EffectiveDate { get; private set; }
    
    /// <summary>
    /// Document expiration date (e.g., certification expiry).
    /// </summary>
    public DateOnly? ExpirationDate { get; private set; }
    
    /// <summary>
    /// Retention period code from document type.
    /// </summary>
    public string RetentionPeriodCode { get; private set; } = string.Empty;
    
    /// <summary>
    /// Calculated destruction date based on retention rules.
    /// </summary>
    public DateOnly? DestructionDate { get; private set; }
    
    /// <summary>
    /// Whether document is under legal hold (cannot be destroyed).
    /// </summary>
    public bool LegalHold { get; private set; }
    
    /// <summary>
    /// Legal hold reference number.
    /// </summary>
    public string? LegalHoldReference { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Access Tracking
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Who uploaded the document.
    /// </summary>
    public string UploadedBy { get; private set; } = string.Empty;
    
    /// <summary>
    /// When document was uploaded.
    /// </summary>
    public DateTime UploadedAt { get; private set; }
    
    /// <summary>
    /// Last access timestamp.
    /// </summary>
    public DateTime? LastAccessedAt { get; private set; }
    
    /// <summary>
    /// Access count for audit.
    /// </summary>
    public int AccessCount { get; private set; }
    
    /// <summary>
    /// Notes about this document.
    /// </summary>
    public string? Notes { get; private set; }
    
    /// <summary>
    /// Visibility: who can access this document.
    /// </summary>
    public DocumentVisibility Visibility { get; private set; } = DocumentVisibility.HROnly;
    
    // Navigation
    public Employee Employee { get; private set; } = null!;
    public DocumentType DocumentType { get; private set; } = null!;
}
```

#### Database Table: `hr.employee_documents`

| Column | Type | Nullable | Constraints | Description |
|--------|------|----------|-------------|-------------|
| id | uuid | NO | PK | Unique identifier |
| tenant_id | uuid | NO | FK, INDEX, RLS | Tenant isolation |
| employee_id | uuid | NO | FK employees(id), INDEX | Parent employee |
| category | smallint | NO | INDEX | DocumentCategory enum |
| document_type_id | uuid | NO | FK document_types(id) | Document type |
| title | varchar(200) | NO | | Document title |
| original_filename | varchar(255) | NO | | Original filename |
| storage_path | varchar(500) | NO | | Storage path/blob |
| mime_type | varchar(100) | NO | | MIME type |
| file_size_bytes | bigint | NO | CHECK >= 0 | File size |
| content_hash | char(64) | NO | | SHA-256 hash |
| effective_date | date | YES | | Effective date |
| expiration_date | date | YES | INDEX | Expiration |
| retention_period_code | varchar(20) | NO | | Retention code |
| destruction_date | date | YES | INDEX | Destruction date |
| legal_hold | boolean | NO | DEFAULT false | Legal hold flag |
| legal_hold_reference | varchar(50) | YES | | Hold reference |
| uploaded_by | varchar(100) | NO | | Uploader |
| uploaded_at | timestamptz | NO | | Upload timestamp |
| last_accessed_at | timestamptz | YES | | Last access |
| access_count | int | NO | DEFAULT 0 | Access count |
| notes | text | YES | | Notes |
| visibility | smallint | NO | DEFAULT 0 | Visibility enum |
| created_at | timestamptz | NO | | Audit |
| created_by | varchar(100) | NO | | Audit |
| updated_at | timestamptz | YES | | Audit |
| updated_by | varchar(100) | YES | | Audit |
| is_deleted | boolean | NO | DEFAULT false | Soft delete |
| deleted_at | timestamptz | YES | | Audit |
| deleted_by | varchar(100) | YES | | Audit |

---

### UnionMembership

Union membership with dispatch and apprentice tracking.

```csharp
/// <summary>
/// Employee union membership with full dispatch and apprentice support.
/// </summary>
public class UnionMembership : BaseEntity
{
    /// <summary>
    /// Parent employee.
    /// </summary>
    public Guid EmployeeId { get; private set; }
    
    /// <summary>
    /// Union local (FK to reference table).
    /// </summary>
    public Guid UnionLocalId { get; private set; }
    
    /// <summary>
    /// Member's union card number.
    /// </summary>
    public string? MemberNumber { get; private set; }
    
    /// <summary>
    /// Membership status.
    /// </summary>
    public UnionMembershipStatus Status { get; private set; } = UnionMembershipStatus.Active;
    
    // ──────────────────────────────────────────────────────────────
    // Dates
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Date joined this union.
    /// </summary>
    public DateOnly MemberSince { get; private set; }
    
    /// <summary>
    /// Date membership ended (if applicable).
    /// </summary>
    public DateOnly? MembershipEndDate { get; private set; }
    
    /// <summary>
    /// Current dues paid through date.
    /// </summary>
    public DateOnly? DuesPaidThrough { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Classification
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Union classification (Journeyman, Apprentice, etc.)
    /// </summary>
    public UnionClassification Classification { get; private set; } = UnionClassification.Journeyman;
    
    /// <summary>
    /// Apprentice year (1-5 typically) if apprentice.
    /// </summary>
    public int? ApprenticeYear { get; private set; }
    
    /// <summary>
    /// Apprentice period (some programs use periods instead of years).
    /// </summary>
    public int? ApprenticePeriod { get; private set; }
    
    /// <summary>
    /// Expected journeyman date for apprentices.
    /// </summary>
    public DateOnly? ExpectedJourneymanDate { get; private set; }
    
    /// <summary>
    /// Date achieved journeyman status.
    /// </summary>
    public DateOnly? JourneymanDate { get; private set; }
    
    /// <summary>
    /// Total apprentice hours logged.
    /// </summary>
    public decimal? ApprenticeHoursLogged { get; private set; }
    
    /// <summary>
    /// Apprentice hours required for completion.
    /// </summary>
    public decimal? ApprenticeHoursRequired { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Dispatch Tracking
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Whether this employee came through dispatch.
    /// </summary>
    public bool IsDispatch { get; private set; }
    
    /// <summary>
    /// Current dispatch reference number.
    /// </summary>
    public string? CurrentDispatchReference { get; private set; }
    
    /// <summary>
    /// Dispatch date for current job.
    /// </summary>
    public DateOnly? CurrentDispatchDate { get; private set; }
    
    /// <summary>
    /// Dispatch ticket expiration (some locals have limits).
    /// </summary>
    public DateOnly? DispatchExpirationDate { get; private set; }
    
    /// <summary>
    /// Out-of-work list position (for hiring hall dispatches).
    /// </summary>
    public int? OutOfWorkListPosition { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Fringe Reporting
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Trust fund reporting ID.
    /// </summary>
    public string? TrustFundReportingId { get; private set; }
    
    /// <summary>
    /// Whether subject to fringe reporting.
    /// </summary>
    public bool SubjectToFringeReporting { get; private set; } = true;
    
    /// <summary>
    /// Notes about this membership.
    /// </summary>
    public string? Notes { get; private set; }
    
    // Navigation
    public Employee Employee { get; private set; } = null!;
    public UnionLocal UnionLocal { get; private set; } = null!;
}
```

#### Database Table: `hr.union_memberships`

| Column | Type | Nullable | Constraints | Description |
|--------|------|----------|-------------|-------------|
| id | uuid | NO | PK | Unique identifier |
| tenant_id | uuid | NO | FK, INDEX, RLS | Tenant isolation |
| employee_id | uuid | NO | FK employees(id), INDEX | Parent employee |
| union_local_id | uuid | NO | FK union_locals(id), INDEX | Union local |
| member_number | varchar(50) | YES | INDEX | Member card # |
| status | smallint | NO | DEFAULT 1 | Status enum |
| member_since | date | NO | | Join date |
| membership_end_date | date | YES | | End date |
| dues_paid_through | date | YES | | Dues current |
| classification | smallint | NO | DEFAULT 1 | Classification |
| apprentice_year | int | YES | CHECK 1-10 | Apprentice year |
| apprentice_period | int | YES | CHECK >= 1 | Apprentice period |
| expected_journeyman_date | date | YES | | Expected journeyman |
| journeyman_date | date | YES | | Achieved journeyman |
| apprentice_hours_logged | numeric(10,2) | YES | CHECK >= 0 | Hours logged |
| apprentice_hours_required | numeric(10,2) | YES | CHECK >= 0 | Hours required |
| is_dispatch | boolean | NO | DEFAULT false | Dispatch flag |
| current_dispatch_reference | varchar(50) | YES | | Dispatch # |
| current_dispatch_date | date | YES | | Dispatch date |
| dispatch_expiration_date | date | YES | | Dispatch expires |
| out_of_work_list_position | int | YES | CHECK >= 1 | OOW position |
| trust_fund_reporting_id | varchar(50) | YES | | Trust fund ID |
| subject_to_fringe_reporting | boolean | NO | DEFAULT true | Fringe flag |
| notes | text | YES | | Notes |
| created_at | timestamptz | NO | | Audit |
| created_by | varchar(100) | NO | | Audit |
| updated_at | timestamptz | YES | | Audit |
| updated_by | varchar(100) | YES | | Audit |
| is_deleted | boolean | NO | DEFAULT false | Soft delete |
| deleted_at | timestamptz | YES | | Audit |
| deleted_by | varchar(100) | YES | | Audit |

---

### I9Record

I-9 employment eligibility verification.

```csharp
/// <summary>
/// I-9 Employment Eligibility Verification record.
/// Required for all US employees within 3 business days of hire.
/// </summary>
public class I9Record : BaseEntity
{
    /// <summary>
    /// Parent employee.
    /// </summary>
    public Guid EmployeeId { get; private set; }
    
    /// <summary>
    /// Overall I-9 status.
    /// </summary>
    public I9RecordStatus Status { get; private set; } = I9RecordStatus.NotStarted;
    
    // ──────────────────────────────────────────────────────────────
    // Section 1 (Employee)
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Date Section 1 was completed by employee.
    /// </summary>
    public DateOnly? Section1CompletedDate { get; private set; }
    
    /// <summary>
    /// Citizenship/immigration status attestation.
    /// </summary>
    public CitizenshipStatus? CitizenshipStatus { get; private set; }
    
    /// <summary>
    /// Alien/USCIS number (if applicable).
    /// </summary>
    public string? AlienNumber { get; private set; }
    
    /// <summary>
    /// I-94 admission number (if applicable).
    /// </summary>
    public string? I94AdmissionNumber { get; private set; }
    
    /// <summary>
    /// Foreign passport number (if applicable).
    /// </summary>
    public string? ForeignPassportNumber { get; private set; }
    
    /// <summary>
    /// Country of issuance for foreign passport.
    /// </summary>
    public string? ForeignPassportCountry { get; private set; }
    
    /// <summary>
    /// Work authorization expiration date (if applicable).
    /// </summary>
    public DateOnly? WorkAuthorizationExpiration { get; private set; }
    
    /// <summary>
    /// Electronic signature for Section 1.
    /// </summary>
    public string? Section1ElectronicSignature { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Section 2 (Employer)
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Date Section 2 was completed by employer.
    /// </summary>
    public DateOnly? Section2CompletedDate { get; private set; }
    
    /// <summary>
    /// List A document type (if using List A).
    /// </summary>
    public string? ListADocumentType { get; private set; }
    
    /// <summary>
    /// List A document number.
    /// </summary>
    public string? ListADocumentNumber { get; private set; }
    
    /// <summary>
    /// List A document issuing authority.
    /// </summary>
    public string? ListAIssuingAuthority { get; private set; }
    
    /// <summary>
    /// List A document expiration.
    /// </summary>
    public DateOnly? ListAExpirationDate { get; private set; }
    
    /// <summary>
    /// List B document type (identity).
    /// </summary>
    public string? ListBDocumentType { get; private set; }
    
    /// <summary>
    /// List B document number.
    /// </summary>
    public string? ListBDocumentNumber { get; private set; }
    
    /// <summary>
    /// List B document issuing authority.
    /// </summary>
    public string? ListBIssuingAuthority { get; private set; }
    
    /// <summary>
    /// List B document expiration.
    /// </summary>
    public DateOnly? ListBExpirationDate { get; private set; }
    
    /// <summary>
    /// List C document type (work authorization).
    /// </summary>
    public string? ListCDocumentType { get; private set; }
    
    /// <summary>
    /// List C document number.
    /// </summary>
    public string? ListCDocumentNumber { get; private set; }
    
    /// <summary>
    /// List C document issuing authority.
    /// </summary>
    public string? ListCIssuingAuthority { get; private set; }
    
    /// <summary>
    /// List C document expiration.
    /// </summary>
    public DateOnly? ListCExpirationDate { get; private set; }
    
    /// <summary>
    /// First day of employment.
    /// </summary>
    public DateOnly? FirstDayOfEmployment { get; private set; }
    
    /// <summary>
    /// Employer representative who completed Section 2.
    /// </summary>
    public string? EmployerRepresentativeName { get; private set; }
    
    /// <summary>
    /// Title of employer representative.
    /// </summary>
    public string? EmployerRepresentativeTitle { get; private set; }
    
    /// <summary>
    /// Electronic signature for Section 2.
    /// </summary>
    public string? Section2ElectronicSignature { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Section 3 (Reverification/Rehire)
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Date of last reverification.
    /// </summary>
    public DateOnly? LastReverificationDate { get; private set; }
    
    /// <summary>
    /// New document type for reverification.
    /// </summary>
    public string? ReverificationDocumentType { get; private set; }
    
    /// <summary>
    /// New document number.
    /// </summary>
    public string? ReverificationDocumentNumber { get; private set; }
    
    /// <summary>
    /// New expiration date.
    /// </summary>
    public DateOnly? ReverificationExpirationDate { get; private set; }
    
    /// <summary>
    /// Date of rehire (for Section 3 rehire).
    /// </summary>
    public DateOnly? RehireDate { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Document Storage
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Scanned I-9 form document ID.
    /// </summary>
    public Guid? FormDocumentId { get; private set; }
    
    /// <summary>
    /// List A supporting document ID.
    /// </summary>
    public Guid? ListADocumentId { get; private set; }
    
    /// <summary>
    /// List B supporting document ID.
    /// </summary>
    public Guid? ListBDocumentId { get; private set; }
    
    /// <summary>
    /// List C supporting document ID.
    /// </summary>
    public Guid? ListCDocumentId { get; private set; }
    
    /// <summary>
    /// Notes about this I-9.
    /// </summary>
    public string? Notes { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // E-Verify Link
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Associated E-Verify case (if E-Verify used).
    /// </summary>
    public Guid? EVerifyCaseId { get; private set; }
    
    // Navigation
    public Employee Employee { get; private set; } = null!;
    public EVerifyCase? EVerifyCase { get; private set; }
    public EmployeeDocument? FormDocument { get; private set; }
}
```

#### Database Table: `hr.i9_records`

| Column | Type | Nullable | Constraints | Description |
|--------|------|----------|-------------|-------------|
| id | uuid | NO | PK | Unique identifier |
| tenant_id | uuid | NO | FK, INDEX, RLS | Tenant isolation |
| employee_id | uuid | NO | FK employees(id), UNIQUE | One per employee |
| status | smallint | NO | DEFAULT 0 | I9RecordStatus |
| section1_completed_date | date | YES | | Section 1 date |
| citizenship_status | smallint | YES | | CitizenshipStatus |
| alien_number | varchar(20) | YES | | A-Number |
| i94_admission_number | varchar(20) | YES | | I-94 number |
| foreign_passport_number | varchar(20) | YES | | Passport # |
| foreign_passport_country | char(2) | YES | | Passport country |
| work_authorization_expiration | date | YES | INDEX | Auth expiration |
| section1_electronic_signature | varchar(200) | YES | | Section 1 sig |
| section2_completed_date | date | YES | | Section 2 date |
| list_a_document_type | varchar(50) | YES | | List A doc |
| list_a_document_number | varchar(50) | YES | | List A # |
| list_a_issuing_authority | varchar(100) | YES | | List A issuer |
| list_a_expiration_date | date | YES | | List A exp |
| list_b_document_type | varchar(50) | YES | | List B doc |
| list_b_document_number | varchar(50) | YES | | List B # |
| list_b_issuing_authority | varchar(100) | YES | | List B issuer |
| list_b_expiration_date | date | YES | | List B exp |
| list_c_document_type | varchar(50) | YES | | List C doc |
| list_c_document_number | varchar(50) | YES | | List C # |
| list_c_issuing_authority | varchar(100) | YES | | List C issuer |
| list_c_expiration_date | date | YES | | List C exp |
| first_day_of_employment | date | YES | | First work day |
| employer_representative_name | varchar(100) | YES | | Employer rep |
| employer_representative_title | varchar(100) | YES | | Employer title |
| section2_electronic_signature | varchar(200) | YES | | Section 2 sig |
| last_reverification_date | date | YES | | Reverification |
| reverification_document_type | varchar(50) | YES | | New doc type |
| reverification_document_number | varchar(50) | YES | | New doc # |
| reverification_expiration_date | date | YES | | New exp date |
| rehire_date | date | YES | | Rehire date |
| form_document_id | uuid | YES | FK employee_documents(id) | I-9 form doc |
| list_a_document_id | uuid | YES | FK employee_documents(id) | List A doc |
| list_b_document_id | uuid | YES | FK employee_documents(id) | List B doc |
| list_c_document_id | uuid | YES | FK employee_documents(id) | List C doc |
| e_verify_case_id | uuid | YES | FK e_verify_cases(id) | E-Verify link |
| notes | text | YES | | Notes |
| created_at | timestamptz | NO | | Audit |
| created_by | varchar(100) | NO | | Audit |
| updated_at | timestamptz | YES | | Audit |
| updated_by | varchar(100) | YES | | Audit |
| is_deleted | boolean | NO | DEFAULT false | Soft delete |
| deleted_at | timestamptz | YES | | Audit |
| deleted_by | varchar(100) | YES | | Audit |

---

### EVerifyCase

E-Verify case tracking for employment authorization verification.

```csharp
/// <summary>
/// E-Verify case tracking for employment eligibility verification.
/// </summary>
public class EVerifyCase : BaseEntity
{
    /// <summary>
    /// Parent employee.
    /// </summary>
    public Guid EmployeeId { get; private set; }
    
    /// <summary>
    /// E-Verify case number assigned by DHS.
    /// </summary>
    public string CaseNumber { get; private set; } = string.Empty;
    
    /// <summary>
    /// Current case status.
    /// </summary>
    public EVerifyCaseStatus Status { get; private set; } = EVerifyCaseStatus.Created;
    
    /// <summary>
    /// Date case was created/submitted.
    /// </summary>
    public DateTime SubmittedAt { get; private set; }
    
    /// <summary>
    /// Date of initial verification result.
    /// </summary>
    public DateTime? InitialVerificationAt { get; private set; }
    
    /// <summary>
    /// Initial verification result.
    /// </summary>
    public EVerifyResult? InitialResult { get; private set; }
    
    /// <summary>
    /// Date of final case closure.
    /// </summary>
    public DateTime? FinalClosureAt { get; private set; }
    
    /// <summary>
    /// Final case result.
    /// </summary>
    public EVerifyResult? FinalResult { get; private set; }
    
    /// <summary>
    /// Tentative Non-Confirmation (TNC) issued.
    /// </summary>
    public bool TNCIssued { get; private set; }
    
    /// <summary>
    /// Date TNC was issued.
    /// </summary>
    public DateTime? TNCIssuedAt { get; private set; }
    
    /// <summary>
    /// Employee referred case to SSA/DHS.
    /// </summary>
    public bool? EmployeeReferred { get; private set; }
    
    /// <summary>
    /// Date employee was referred.
    /// </summary>
    public DateTime? ReferralDate { get; private set; }
    
    /// <summary>
    /// Due date for resolution (10 federal business days from TNC).
    /// </summary>
    public DateOnly? ResolutionDueDate { get; private set; }
    
    /// <summary>
    /// Photo match required (for certain documents).
    /// </summary>
    public bool PhotoMatchRequired { get; private set; }
    
    /// <summary>
    /// Photo match result.
    /// </summary>
    public PhotoMatchResult? PhotoMatchResult { get; private set; }
    
    /// <summary>
    /// Raw response JSON from E-Verify API (for troubleshooting).
    /// </summary>
    public string? ResponseJson { get; private set; }
    
    /// <summary>
    /// Notes about this case.
    /// </summary>
    public string? Notes { get; private set; }
    
    // Navigation
    public Employee Employee { get; private set; } = null!;
    public I9Record? I9Record { get; private set; }
}
```

#### Database Table: `hr.e_verify_cases`

| Column | Type | Nullable | Constraints | Description |
|--------|------|----------|-------------|-------------|
| id | uuid | NO | PK | Unique identifier |
| tenant_id | uuid | NO | FK, INDEX, RLS | Tenant isolation |
| employee_id | uuid | NO | FK employees(id), INDEX | Parent employee |
| case_number | varchar(50) | NO | UNIQUE INDEX | DHS case # |
| status | smallint | NO | DEFAULT 0 | Case status |
| submitted_at | timestamptz | NO | | Submit timestamp |
| initial_verification_at | timestamptz | YES | | Initial result time |
| initial_result | smallint | YES | | Initial result |
| final_closure_at | timestamptz | YES | | Closure time |
| final_result | smallint | YES | | Final result |
| tnc_issued | boolean | NO | DEFAULT false | TNC flag |
| tnc_issued_at | timestamptz | YES | | TNC timestamp |
| employee_referred | boolean | YES | | Referral flag |
| referral_date | timestamptz | YES | | Referral date |
| resolution_due_date | date | YES | INDEX | Due date |
| photo_match_required | boolean | NO | DEFAULT false | Photo match flag |
| photo_match_result | smallint | YES | | Photo result |
| response_json | jsonb | YES | | API response |
| notes | text | YES | | Notes |
| created_at | timestamptz | NO | | Audit |
| created_by | varchar(100) | NO | | Audit |
| updated_at | timestamptz | YES | | Audit |
| updated_by | varchar(100) | YES | | Audit |
| is_deleted | boolean | NO | DEFAULT false | Soft delete |
| deleted_at | timestamptz | YES | | Audit |
| deleted_by | varchar(100) | YES | | Audit |

---

## Value Objects

Value objects are immutable and have no identity. They're embedded or serialized.

### Address

```csharp
/// <summary>
/// Postal address value object.
/// </summary>
public sealed record Address(
    string? Line1,
    string? Line2,
    string? City,
    string? State,
    string? ZipCode,
    string Country = "US"
)
{
    public string? FullAddress => string.Join(", ", 
        new[] { Line1, Line2, City, State, ZipCode, Country }
        .Where(s => !string.IsNullOrEmpty(s)));
    
    public bool IsComplete => !string.IsNullOrEmpty(Line1) && 
        !string.IsNullOrEmpty(City) && 
        !string.IsNullOrEmpty(State) && 
        !string.IsNullOrEmpty(ZipCode);
}
```

### Money

```csharp
/// <summary>
/// Monetary value with currency.
/// </summary>
public sealed record Money(decimal Amount, string Currency = "USD")
{
    public static Money Zero => new(0);
    public static Money FromDollars(decimal amount) => new(amount, "USD");
    
    public Money Add(Money other)
    {
        if (Currency != other.Currency)
            throw new InvalidOperationException("Cannot add different currencies");
        return new Money(Amount + other.Amount, Currency);
    }
}
```

### DateRange

```csharp
/// <summary>
/// Effective date range for temporal records.
/// </summary>
public sealed record DateRange(DateOnly Start, DateOnly? End)
{
    public bool Contains(DateOnly date) => 
        date >= Start && (End == null || date <= End);
    
    public bool IsOpen => End == null;
    public bool IsClosed => End != null;
}
```

### SSN (Encrypted Value)

```csharp
/// <summary>
/// Social Security Number (encrypted storage, last 4 for display).
/// </summary>
public sealed class SSN
{
    public byte[] EncryptedValue { get; }
    public string Last4 { get; }
    
    private SSN(byte[] encrypted, string last4)
    {
        EncryptedValue = encrypted;
        Last4 = last4;
    }
    
    public static SSN FromPlainText(string ssn, IEncryptionService encryption)
    {
        var cleaned = new string(ssn.Where(char.IsDigit).ToArray());
        if (cleaned.Length != 9)
            throw new ArgumentException("SSN must be 9 digits");
        
        return new SSN(
            encryption.Encrypt(cleaned),
            cleaned[^4..]
        );
    }
    
    public string Decrypt(IEncryptionService encryption) => 
        encryption.Decrypt(EncryptedValue);
    
    public string Masked => $"XXX-XX-{Last4}";
}
```

---

## Enumerations

```csharp
namespace Pitbull.HRCore.Domain;

// ═══════════════════════════════════════════════════════════════════
// Employment Status & Type
// ═══════════════════════════════════════════════════════════════════

public enum EmploymentStatus
{
    Active = 1,
    Inactive = 2,
    Terminated = 3,
    SeasonalInactive = 4,  // Will be recalled
    LeaveOfAbsence = 5,
    Suspended = 6
}

public enum EmploymentType
{
    FullTime = 1,
    PartTime = 2,
    Temporary = 3,
    Seasonal = 4,
    OnCall = 5
}

public enum WorkerType
{
    Field = 1,      // Jobsite workers
    Office = 2,     // Office/administrative
    Hybrid = 3      // Both field and office
}

public enum FLSAStatus
{
    NonExempt = 1,  // Hourly, eligible for overtime
    Exempt = 2      // Salary, not eligible for overtime
}

// ═══════════════════════════════════════════════════════════════════
// Separation Reasons
// ═══════════════════════════════════════════════════════════════════

public enum SeparationReason
{
    ProjectEnd = 1,          // Normal end of project work
    Resignation = 2,         // Voluntary quit
    TerminationForCause = 3, // Fired for cause
    Layoff = 4,              // Economic layoff
    SeasonalEnd = 5,         // End of season
    Retirement = 6,
    Deceased = 7,
    MutualAgreement = 8,
    Abandonment = 9,         // No call/no show
    DischargePerformance = 10,
    MedicalDisability = 11
}

// ═══════════════════════════════════════════════════════════════════
// Pay & Rates
// ═══════════════════════════════════════════════════════════════════

public enum PayFrequency
{
    Weekly = 1,
    BiWeekly = 2,
    SemiMonthly = 3,
    Monthly = 4
}

public enum PayType
{
    Hourly = 1,
    Salary = 2,
    Commission = 3,
    PieceRate = 4
}

public enum RateType
{
    Hourly = 1,
    Daily = 2,
    Weekly = 3,
    Annual = 4,
    PerDiem = 5,
    PieceRate = 6
}

public enum RateSource
{
    Manual = 0,
    UnionScale = 1,
    WageDetermination = 2,
    ContractImport = 3,
    SystemCalculated = 4
}

public enum PaymentMethod
{
    DirectDeposit = 1,
    Check = 2,
    PayCard = 3
}

// ═══════════════════════════════════════════════════════════════════
// Tax & Withholding
// ═══════════════════════════════════════════════════════════════════

public enum WithholdingType
{
    FederalW4 = 1,
    StateWithholding = 2,
    LocalWithholding = 3
}

public enum FilingStatus
{
    Single = 1,
    MarriedFilingJointly = 2,
    MarriedFilingSeparately = 3,
    HeadOfHousehold = 4,
    QualifyingWidower = 5
}

// ═══════════════════════════════════════════════════════════════════
// Deductions
// ═══════════════════════════════════════════════════════════════════

public enum DeductionCategory
{
    Benefit = 1,
    Garnishment = 2,
    UnionDues = 3,
    Retirement = 4,
    Loan = 5,
    Voluntary = 6,
    Other = 99
}

public enum DeductionCalculationMethod
{
    Flat = 1,         // Fixed dollar amount per pay period
    Percentage = 2,   // Percentage of gross/net pay
    HoursBased = 3    // Dollar amount per hour worked
}

// ═══════════════════════════════════════════════════════════════════
// Certifications
// ═══════════════════════════════════════════════════════════════════

public enum CertificationStatus
{
    Pending = 0,
    Verified = 1,
    Expired = 2,
    Revoked = 3,
    Renewal = 4
}

// ═══════════════════════════════════════════════════════════════════
// Documents
// ═══════════════════════════════════════════════════════════════════

public enum DocumentCategory
{
    Certification = 1,
    TaxForm = 2,
    I9Verification = 3,
    DirectDeposit = 4,
    PolicyAcknowledgment = 5,
    PerformanceReview = 6,
    DisciplinaryRecord = 7,
    Contract = 8,
    Medical = 9,
    Training = 10,
    Other = 99
}

public enum DocumentVisibility
{
    HROnly = 0,
    ManagerAndHR = 1,
    EmployeeAndHR = 2,
    All = 3
}

// ═══════════════════════════════════════════════════════════════════
// Union
// ═══════════════════════════════════════════════════════════════════

public enum UnionMembershipStatus
{
    Active = 1,
    Inactive = 2,
    Suspended = 3,
    Withdrawn = 4,
    Expelled = 5
}

public enum UnionClassification
{
    Journeyman = 1,
    Apprentice = 2,
    Foreman = 3,
    GeneralForeman = 4,
    Superintendent = 5,
    Trainee = 6,
    Helper = 7
}

// ═══════════════════════════════════════════════════════════════════
// I-9 & E-Verify
// ═══════════════════════════════════════════════════════════════════

public enum I9Status
{
    NotStarted = 0,
    Section1InProgress = 1,
    Section1Complete = 2,
    Section2InProgress = 3,
    Complete = 4,
    ReverificationNeeded = 5,
    ReverificationComplete = 6,
    Error = 99
}

public enum I9RecordStatus
{
    NotStarted = 0,
    InProgress = 1,
    Complete = 2,
    NeedsReverification = 3,
    Error = 99
}

public enum CitizenshipStatus
{
    USCitizen = 1,
    NoncitizenNational = 2,
    LawfulPermanentResident = 3,
    AlienAuthorizedToWork = 4
}

public enum EVerifyStatus
{
    NotSubmitted = 0,
    Pending = 1,
    EmploymentAuthorized = 2,
    TentativeNonconfirmation = 3,
    CaseInContinuance = 4,
    FinalNonconfirmation = 5,
    ClosedAuthorized = 6,
    ClosedUnauthorized = 7
}

public enum EVerifyCaseStatus
{
    Created = 0,
    Submitted = 1,
    Pending = 2,
    InitialResponse = 3,
    ReferredToSSA = 4,
    ReferredToDHS = 5,
    CaseInContinuance = 6,
    ClosedAuthorized = 7,
    ClosedUnauthorized = 8,
    Error = 99
}

public enum EVerifyResult
{
    EmploymentAuthorized = 1,
    TentativeNonconfirmation = 2,
    FinalNonconfirmation = 3,
    DhsNoShow = 4,
    SsaNoShow = 5
}

public enum PhotoMatchResult
{
    Match = 1,
    NoMatch = 2,
    PhotoNotAvailable = 3,
    Inconclusive = 4
}

// ═══════════════════════════════════════════════════════════════════
// Background Check & Drug Test
// ═══════════════════════════════════════════════════════════════════

public enum BackgroundCheckStatus
{
    NotRequired = 0,
    Pending = 1,
    InProgress = 2,
    Clear = 3,
    Flagged = 4,
    Failed = 5
}

public enum DrugTestStatus
{
    NotRequired = 0,
    Scheduled = 1,
    Completed = 2,
    Negative = 3,
    Positive = 4,
    Inconclusive = 5,
    Refused = 6
}
```

---

## Segregated EEO Schema

Per compliance requirements, EEO demographic data is stored in a **separate PostgreSQL schema** with restricted access. This prevents discrimination liability by ensuring hiring managers cannot access this data.

### Schema: `hr_eeo`

```sql
CREATE SCHEMA hr_eeo;

-- Separate role with restricted access
CREATE ROLE hr_eeo_reader;
GRANT USAGE ON SCHEMA hr_eeo TO hr_eeo_reader;

-- Main app role cannot access hr_eeo schema
REVOKE ALL ON SCHEMA hr_eeo FROM pitbull_app;
```

### EmployeeDemographics Entity

```csharp
namespace Pitbull.HRCore.Domain.EEO;

/// <summary>
/// Voluntarily reported demographic data for EEO compliance.
/// Stored in segregated schema with restricted access.
/// </summary>
public class EmployeeDemographics
{
    /// <summary>
    /// Primary key (same as Employee.Id for 1:1 relationship).
    /// </summary>
    public Guid EmployeeId { get; private set; }
    
    public Guid TenantId { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Demographic Data (All Voluntary)
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Race category (EEO-1 categories).
    /// </summary>
    public string? Race { get; private set; }
    
    /// <summary>
    /// Ethnicity: Hispanic or Latino / Not Hispanic or Latino.
    /// </summary>
    public string? Ethnicity { get; private set; }
    
    /// <summary>
    /// Sex: Male / Female / Prefer not to say.
    /// </summary>
    public string? Sex { get; private set; }
    
    /// <summary>
    /// Veteran status (VEVRAA categories).
    /// </summary>
    public string? VeteranStatus { get; private set; }
    
    /// <summary>
    /// Disability status (voluntary self-identification).
    /// </summary>
    public string? DisabilityStatus { get; private set; }
    
    // ──────────────────────────────────────────────────────────────
    // Collection Metadata
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// When data was collected.
    /// </summary>
    public DateTime CollectedAt { get; private set; }
    
    /// <summary>
    /// How data was collected.
    /// </summary>
    public EEOCollectionMethod CollectionMethod { get; private set; }
    
    /// <summary>
    /// Whether employee declined to self-identify.
    /// </summary>
    public bool DeclinedToIdentify { get; private set; }
    
    // Audit (no soft delete - retention controlled separately)
    public DateTime CreatedAt { get; private set; }
    public string CreatedBy { get; private set; } = string.Empty;
    public DateTime? UpdatedAt { get; private set; }
    public string? UpdatedBy { get; private set; }
}

public enum EEOCollectionMethod
{
    SelfReported = 1,
    VoluntarySurvey = 2,
    VisualObservation = 3  // Only when employee declines
}
```

#### Database Table: `hr_eeo.employee_demographics`

| Column | Type | Nullable | Constraints | Description |
|--------|------|----------|-------------|-------------|
| employee_id | uuid | NO | PK, FK hr.employees(id) | Employee link |
| tenant_id | uuid | NO | FK, INDEX, RLS | Tenant isolation |
| race | varchar(50) | YES | | Race category |
| ethnicity | varchar(50) | YES | | Ethnicity |
| sex | varchar(20) | YES | | Sex |
| veteran_status | varchar(100) | YES | | Veteran status |
| disability_status | varchar(100) | YES | | Disability status |
| collected_at | timestamptz | NO | | Collection time |
| collection_method | smallint | NO | | Collection method |
| declined_to_identify | boolean | NO | DEFAULT false | Declined flag |
| created_at | timestamptz | NO | | Audit |
| created_by | varchar(100) | NO | | Audit |
| updated_at | timestamptz | YES | | Audit |
| updated_by | varchar(100) | YES | | Audit |

---

## Supporting Entities

These are reference/lookup tables that support the main entities.

### CertificationType

```csharp
/// <summary>
/// Certification type reference (e.g., OSHA-10, OSHA-30, Forklift).
/// </summary>
public class CertificationType : BaseEntity
{
    public string Code { get; set; } = string.Empty;      // "OSHA10", "FORKLIFT"
    public string Name { get; set; } = string.Empty;      // "OSHA 10-Hour"
    public string? Description { get; set; }
    public bool HasExpiration { get; set; } = true;
    public int? DefaultValidityYears { get; set; }        // e.g., 5 years
    public bool IsRequired { get; set; }                  // Site-wide requirement
    public string? CategoryCode { get; set; }             // "SAFETY", "TRADE", "LICENSE"
    public int SortOrder { get; set; }
}
```

### UnionLocal

```csharp
/// <summary>
/// Union local reference (e.g., IBEW Local 46, Carpenters Local 22).
/// </summary>
public class UnionLocal : BaseEntity
{
    public string Code { get; set; } = string.Empty;      // "IBEW46", "CARP22"
    public string Name { get; set; } = string.Empty;      // "IBEW Local 46"
    public string UnionName { get; set; } = string.Empty; // "International Brotherhood of Electrical Workers"
    public string LocalNumber { get; set; } = string.Empty;
    public string? TradeCode { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Phone { get; set; }
    public string? DispatchPhone { get; set; }
    public string? Website { get; set; }
    public string? FringeReportingInstructions { get; set; }
    public bool IsActive { get; set; } = true;
}
```

### DeductionType

```csharp
/// <summary>
/// Deduction type reference with default configurations.
/// </summary>
public class DeductionType : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DeductionCategory Category { get; set; }
    public bool IsPreTax { get; set; }
    public int DefaultPriority { get; set; }
    public string? GlAccountCode { get; set; }
    public string? VendorCode { get; set; }
    public bool IsActive { get; set; } = true;
}
```

### DocumentType

```csharp
/// <summary>
/// Document type reference with retention rules.
/// </summary>
public class DocumentType : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DocumentCategory Category { get; set; }
    public string RetentionPeriodCode { get; set; } = string.Empty;  // "3Y", "7Y", "TERM+3Y"
    public int RetentionYears { get; set; }
    public bool RetentionAfterTermination { get; set; }
    public bool RequiresSignature { get; set; }
    public DocumentVisibility DefaultVisibility { get; set; }
    public bool IsActive { get; set; } = true;
}
```

### WageDetermination

```csharp
/// <summary>
/// Davis-Bacon wage determination for prevailing wage projects.
/// </summary>
public class WageDetermination : BaseEntity
{
    public string DeterminationNumber { get; set; } = string.Empty;  // "CA20260001"
    public string State { get; set; } = string.Empty;
    public string? County { get; set; }
    public string ConstructionType { get; set; } = string.Empty;     // "Building", "Heavy", "Highway"
    public DateOnly EffectiveDate { get; set; }
    public DateOnly? ExpirationDate { get; set; }
    public string? ModificationNumber { get; set; }
    public string? SourceUrl { get; set; }                           // SAM.gov URL
    public string RatesJson { get; set; } = "{}";                    // Classification -> rate mapping
    public bool IsActive { get; set; } = true;
}
```

### JobClassification

```csharp
/// <summary>
/// Job classification for pay rate assignment.
/// </summary>
public class JobClassification : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? TradeCode { get; set; }
    public string? WorkersCompClassCode { get; set; }
    public string? Description { get; set; }
    public bool IsUnionClassification { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}
```

---

## Entity Relationships

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           RELATIONSHIP DIAGRAM                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

Employee (1) ─────────────────┬──── (0..*) EmploymentEpisode
    │                         ├──── (0..*) Certification ──────── (1) CertificationType
    │                         ├──── (0..*) PayRate
    │                         ├──── (0..*) WithholdingElection
    │                         ├──── (0..*) Deduction ───────────── (1) DeductionType
    │                         ├──── (0..*) EmergencyContact
    │                         ├──── (0..*) EmployeeDocument ────── (1) DocumentType
    │                         ├──── (0..*) UnionMembership ─────── (1) UnionLocal
    │                         └──── (0..1) I9Record ───────────── (0..1) EVerifyCase
    │
    ├── (0..1) AppUser (Identity)
    ├── (0..1) Supervisor (self-reference)
    ├── (0..1) Department
    ├── (0..1) DefaultCrew
    └── (0..1) PrimaryUnionLocal

EmployeeDemographics (1) ────── (1) Employee (segregated schema)

PayRate (0..1) ──────────────── (0..1) Project (from Projects module)
PayRate (0..1) ──────────────── (0..1) JobClassification
PayRate (0..1) ──────────────── (0..1) WageDetermination
PayRate (0..1) ──────────────── (0..1) UnionLocal
```

### Cardinality Summary

| Parent | Child | Cardinality | Notes |
|--------|-------|-------------|-------|
| Employee | EmploymentEpisode | 1:0..* | At least 1 episode when hired |
| Employee | Certification | 1:0..* | Multiple certs per employee |
| Employee | PayRate | 1:0..* | Multiple rates (project, shift, etc.) |
| Employee | WithholdingElection | 1:0..* | Federal + states |
| Employee | Deduction | 1:0..* | Benefits, garnishments, etc. |
| Employee | EmergencyContact | 1:0..* | Usually 1-3 |
| Employee | EmployeeDocument | 1:0..* | All related documents |
| Employee | UnionMembership | 1:0..* | Can belong to multiple locals |
| Employee | I9Record | 1:0..1 | One I-9 per employee |
| I9Record | EVerifyCase | 1:0..1 | Optional E-Verify |
| Employee | EmployeeDemographics | 1:0..1 | Optional EEO data |
| Employee | Supervisor | 0..1:0..* | Self-reference |

---

## Database Indexes

### Primary Indexes (All Tables)

```sql
-- Primary keys (automatically indexed)
-- Tenant isolation (all tables)
CREATE INDEX IX_{table}_tenant_id ON hr.{table}(tenant_id);
```

### Employee Indexes

```sql
-- Unique constraints
CREATE UNIQUE INDEX IX_employees_tenant_employee_number 
    ON hr.employees(tenant_id, employee_number) WHERE NOT is_deleted;

CREATE UNIQUE INDEX IX_employees_app_user_id 
    ON hr.employees(app_user_id) WHERE app_user_id IS NOT NULL AND NOT is_deleted;

-- Common query patterns
CREATE INDEX IX_employees_status ON hr.employees(status) WHERE NOT is_deleted;
CREATE INDEX IX_employees_trade_code ON hr.employees(trade_code) WHERE NOT is_deleted;
CREATE INDEX IX_employees_supervisor_id ON hr.employees(supervisor_id) WHERE NOT is_deleted;
CREATE INDEX IX_employees_is_union_member ON hr.employees(is_union_member) WHERE NOT is_deleted;
CREATE INDEX IX_employees_email ON hr.employees(email) WHERE email IS NOT NULL AND NOT is_deleted;

-- Full name search (trigram)
CREATE INDEX IX_employees_name_search 
    ON hr.employees USING gin((first_name || ' ' || last_name) gin_trgm_ops) 
    WHERE NOT is_deleted;

-- Date-based queries
CREATE INDEX IX_employees_hire_date ON hr.employees(most_recent_hire_date) WHERE NOT is_deleted;
CREATE INDEX IX_employees_termination_date ON hr.employees(termination_date) 
    WHERE termination_date IS NOT NULL AND NOT is_deleted;
```

### Certification Indexes

```sql
-- Employee certifications
CREATE INDEX IX_certifications_employee_id ON hr.certifications(employee_id) WHERE NOT is_deleted;

-- Expiration tracking (critical for compliance)
CREATE INDEX IX_certifications_expiration_date 
    ON hr.certifications(expiration_date) 
    WHERE expiration_date IS NOT NULL AND NOT is_deleted;

-- Type lookup
CREATE INDEX IX_certifications_type_code ON hr.certifications(certification_type_code) WHERE NOT is_deleted;

-- Status queries
CREATE INDEX IX_certifications_status ON hr.certifications(status) WHERE NOT is_deleted;

-- Compliance check (employee + type + valid date)
CREATE INDEX IX_certifications_compliance_check 
    ON hr.certifications(employee_id, certification_type_code, expiration_date) 
    WHERE status = 1 AND NOT is_deleted;  -- Verified only
```

### PayRate Indexes

```sql
-- Employee rates
CREATE INDEX IX_pay_rates_employee_id ON hr.pay_rates(employee_id) WHERE NOT is_deleted;

-- Effective date range queries
CREATE INDEX IX_pay_rates_effective_date ON hr.pay_rates(effective_date) WHERE NOT is_deleted;
CREATE INDEX IX_pay_rates_expiration_date ON hr.pay_rates(expiration_date) 
    WHERE expiration_date IS NOT NULL AND NOT is_deleted;

-- Rate resolution (most specific first)
CREATE INDEX IX_pay_rates_resolution 
    ON hr.pay_rates(employee_id, project_id, job_classification_id, wage_determination_id, priority DESC)
    WHERE NOT is_deleted;

-- Project-specific rates
CREATE INDEX IX_pay_rates_project_id ON hr.pay_rates(project_id) 
    WHERE project_id IS NOT NULL AND NOT is_deleted;

-- Union rates
CREATE INDEX IX_pay_rates_union_local_id ON hr.pay_rates(union_local_id) 
    WHERE union_local_id IS NOT NULL AND NOT is_deleted;
```

### Withholding & Deduction Indexes

```sql
-- Employee lookups
CREATE INDEX IX_withholding_elections_employee_id ON hr.withholding_elections(employee_id) WHERE NOT is_deleted;
CREATE INDEX IX_deductions_employee_id ON hr.deductions(employee_id) WHERE NOT is_deleted;

-- Effective date queries
CREATE INDEX IX_withholding_elections_effective ON hr.withholding_elections(effective_date, expiration_date) 
    WHERE NOT is_deleted;
CREATE INDEX IX_deductions_effective ON hr.deductions(effective_date, expiration_date) 
    WHERE NOT is_deleted;

-- Type queries
CREATE INDEX IX_withholding_elections_type_state ON hr.withholding_elections(type, state_code) 
    WHERE NOT is_deleted;
CREATE INDEX IX_deductions_category ON hr.deductions(category) WHERE NOT is_deleted;

-- Priority ordering
CREATE INDEX IX_deductions_priority ON hr.deductions(priority) WHERE NOT is_deleted;
```

### Document Indexes

```sql
-- Employee documents
CREATE INDEX IX_employee_documents_employee_id ON hr.employee_documents(employee_id) WHERE NOT is_deleted;

-- Category filtering
CREATE INDEX IX_employee_documents_category ON hr.employee_documents(category) WHERE NOT is_deleted;

-- Retention enforcement
CREATE INDEX IX_employee_documents_destruction_date 
    ON hr.employee_documents(destruction_date) 
    WHERE destruction_date IS NOT NULL AND NOT legal_hold AND NOT is_deleted;

-- Legal hold tracking
CREATE INDEX IX_employee_documents_legal_hold 
    ON hr.employee_documents(legal_hold) 
    WHERE legal_hold = true AND NOT is_deleted;
```

### Union Indexes

```sql
-- Employee memberships
CREATE INDEX IX_union_memberships_employee_id ON hr.union_memberships(employee_id) WHERE NOT is_deleted;

-- Local lookups
CREATE INDEX IX_union_memberships_union_local_id ON hr.union_memberships(union_local_id) WHERE NOT is_deleted;

-- Dispatch tracking
CREATE INDEX IX_union_memberships_dispatch 
    ON hr.union_memberships(is_dispatch, current_dispatch_date) 
    WHERE is_dispatch = true AND NOT is_deleted;

-- Apprentice tracking
CREATE INDEX IX_union_memberships_apprentice 
    ON hr.union_memberships(classification, apprentice_year) 
    WHERE classification = 2 AND NOT is_deleted;  -- Apprentice = 2
```

### I-9 & E-Verify Indexes

```sql
-- Employee I-9 (1:1)
CREATE UNIQUE INDEX IX_i9_records_employee_id 
    ON hr.i9_records(employee_id) WHERE NOT is_deleted;

-- Work authorization expiration tracking
CREATE INDEX IX_i9_records_work_auth_expiration 
    ON hr.i9_records(work_authorization_expiration) 
    WHERE work_authorization_expiration IS NOT NULL AND NOT is_deleted;

-- Reverification needed
CREATE INDEX IX_i9_records_reverification 
    ON hr.i9_records(status) 
    WHERE status = 3 AND NOT is_deleted;  -- NeedsReverification = 3

-- E-Verify cases by employee
CREATE INDEX IX_e_verify_cases_employee_id ON hr.e_verify_cases(employee_id) WHERE NOT is_deleted;

-- E-Verify case number lookup
CREATE UNIQUE INDEX IX_e_verify_cases_case_number 
    ON hr.e_verify_cases(case_number) WHERE NOT is_deleted;

-- Pending E-Verify cases
CREATE INDEX IX_e_verify_cases_pending 
    ON hr.e_verify_cases(status, resolution_due_date) 
    WHERE status IN (1, 2, 3, 4, 5, 6) AND NOT is_deleted;  -- Active statuses
```

### EEO Schema Indexes

```sql
-- Tenant isolation (separate schema)
CREATE INDEX IX_employee_demographics_tenant_id 
    ON hr_eeo.employee_demographics(tenant_id);

-- Employee link
CREATE UNIQUE INDEX IX_employee_demographics_employee_id 
    ON hr_eeo.employee_demographics(employee_id);
```

---

## Domain Events

HR Core publishes domain events for other modules to consume. All events inherit from `DomainEventBase`.

### Employee Lifecycle Events

```csharp
namespace Pitbull.HRCore.Domain.Events;

/// <summary>
/// Published when a new employee is created.
/// </summary>
public sealed record EmployeeCreatedEvent(
    Guid EmployeeId,
    Guid TenantId,
    string EmployeeNumber,
    string FullName,
    EmploymentStatus Status,
    DateOnly HireDate
) : DomainEventBase;

/// <summary>
/// Published when employee status changes.
/// </summary>
public sealed record EmployeeStatusChangedEvent(
    Guid EmployeeId,
    Guid TenantId,
    EmploymentStatus OldStatus,
    EmploymentStatus NewStatus,
    string? Reason
) : DomainEventBase;

/// <summary>
/// Published when an employee is terminated.
/// </summary>
public sealed record EmployeeTerminatedEvent(
    Guid EmployeeId,
    Guid TenantId,
    DateOnly TerminationDate,
    SeparationReason Reason,
    bool EligibleForRehire
) : DomainEventBase;

/// <summary>
/// Published when an employee is rehired.
/// </summary>
public sealed record EmployeeRehiredEvent(
    Guid EmployeeId,
    Guid TenantId,
    DateOnly RehireDate,
    int EpisodeNumber
) : DomainEventBase;

/// <summary>
/// Published when employee personal info changes.
/// </summary>
public sealed record EmployeeInfoUpdatedEvent(
    Guid EmployeeId,
    Guid TenantId,
    string[] ChangedFields
) : DomainEventBase;
```

### Certification Events

```csharp
/// <summary>
/// Published when a certification is added.
/// </summary>
public sealed record CertificationAddedEvent(
    Guid CertificationId,
    Guid EmployeeId,
    Guid TenantId,
    string CertificationTypeCode,
    DateOnly? ExpirationDate
) : DomainEventBase;

/// <summary>
/// Published when a certification expires.
/// </summary>
public sealed record CertificationExpiredEvent(
    Guid CertificationId,
    Guid EmployeeId,
    Guid TenantId,
    string CertificationTypeCode,
    DateOnly ExpirationDate
) : DomainEventBase;

/// <summary>
/// Published when a certification is about to expire.
/// </summary>
public sealed record CertificationExpiringEvent(
    Guid CertificationId,
    Guid EmployeeId,
    Guid TenantId,
    string CertificationTypeCode,
    DateOnly ExpirationDate,
    int DaysUntilExpiration
) : DomainEventBase;
```

### Pay Rate Events

```csharp
/// <summary>
/// Published when a pay rate is added or changed.
/// </summary>
public sealed record PayRateChangedEvent(
    Guid PayRateId,
    Guid EmployeeId,
    Guid TenantId,
    decimal NewAmount,
    decimal? OldAmount,
    DateOnly EffectiveDate,
    Guid? ProjectId
) : DomainEventBase;
```

### Event Consumers

| Event | Consumer Module | Action |
|-------|----------------|--------|
| EmployeeCreatedEvent | TimeTracking | Create employee read projection |
| EmployeeTerminatedEvent | TimeTracking | Mark employee inactive, close open entries |
| EmployeeStatusChangedEvent | TimeTracking | Update status projection |
| CertificationExpiredEvent | TimeTracking | Block time entry for cert-required work |
| PayRateChangedEvent | Payroll | Update rate cache |

---

## Implementation Notes

### 1. Entity Framework Configuration Pattern

Follow the existing Pitbull pattern from `EmployeeConfiguration.cs`:

```csharp
public class EmployeeConfiguration : IEntityTypeConfiguration<Employee>
{
    public void Configure(EntityTypeBuilder<Employee> builder)
    {
        builder.ToTable("employees", "hr");
        
        builder.HasKey(e => e.Id);
        
        // All properties with explicit configuration
        builder.Property(e => e.EmployeeNumber)
            .IsRequired()
            .HasMaxLength(20);
        
        // ... etc
        
        // Optimistic concurrency
        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
```

### 2. Strongly-Typed IDs (Future)

Consider implementing strongly-typed IDs to prevent ID mixups:

```csharp
public readonly record struct EmployeeId(Guid Value);
public readonly record struct CertificationId(Guid Value);
// etc.
```

### 3. Private Setters

All entity properties use `private set` to enforce aggregate boundaries:
- Changes flow through Employee aggregate methods
- Domain events emitted from aggregate root
- Prevents bypassing business rules

### 4. Migration from TimeTracking.Employee

The existing `TimeTracking.Employee` table will become a read projection:
1. HR Core publishes events
2. TimeTracking subscribes and maintains local projection
3. TimeTracking queries its local projection for performance
4. HR Core is the source of truth

### 5. RLS Policy Template

Apply to all HR tables:

```sql
ALTER TABLE hr.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON hr.employees
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_insert_policy ON hr.employees
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
```

### 6. Audit Table

All HR changes log to an append-only audit table:

```sql
CREATE TABLE hr.audit_log (
    id bigserial PRIMARY KEY,
    tenant_id uuid NOT NULL,
    entity_type varchar(50) NOT NULL,
    entity_id uuid NOT NULL,
    action varchar(20) NOT NULL,  -- INSERT, UPDATE, DELETE
    old_values jsonb,
    new_values jsonb,
    changed_by varchar(100) NOT NULL,
    changed_at timestamptz NOT NULL DEFAULT now(),
    correlation_id uuid,  -- For agent automation tracing
    client_ip inet,
    user_agent varchar(500)
);

CREATE INDEX IX_audit_log_entity ON hr.audit_log(entity_type, entity_id);
CREATE INDEX IX_audit_log_tenant_date ON hr.audit_log(tenant_id, changed_at);
CREATE INDEX IX_audit_log_correlation ON hr.audit_log(correlation_id) WHERE correlation_id IS NOT NULL;
```

---

## Summary

This document defines **12 core entities**, **6 supporting reference entities**, **4 value objects**, and **25+ enumerations** for the HR Core module. Key design decisions:

1. **Employee as aggregate root** - All child entities accessed through Employee
2. **Effective dating** - PayRates, Withholdings, Deductions track history
3. **Rehire-first design** - EmploymentEpisodes support construction industry patterns  
4. **Full union support** - Dispatch, apprentice tracking, fringe reporting
5. **Own document storage** - With retention enforcement and legal hold
6. **E-Verify integration** - Full case tracking workflow
7. **National from day 1** - 50-state tax jurisdiction support
8. **Segregated EEO** - Separate schema prevents discrimination liability
9. **Event sourcing** - Immutable audit trail for 7-year retention

Total estimated tables: **19** (excluding audit log and EEO schema)