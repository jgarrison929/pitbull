# HR Core Module Synthesis
**Date:** February 8, 2026  
**Synthesized from:** 4-agent design debate

---

## Consensus: The 12 Non-Negotiables

| # | Requirement | Champion | Why |
|---|-------------|----------|-----|
| 1 | Certification tracking with hard stops | Domain Expert | Can't log time without valid certs |
| 2 | Employment episode history (rehire-first) | Domain Expert | 60% turnover is normal in construction |
| 3 | Prevailing wage classification mapping | Domain Expert | Davis-Bacon / certified payroll foundation |
| 4 | Event sourcing for audit trail | Architect | Legal requirement for HR data |
| 5 | RLS tenant isolation | Architect | Can't trust app-level filtering alone |
| 6 | Idempotent APIs with correlation IDs | Architect | Agent automation requires retry-safe ops |
| 7 | Segregated EEO data storage | Compliance | Prevents discrimination liability |
| 8 | Automated retention enforcement | Compliance | Manual tracking fails at scale |
| 9 | Immutable audit logging (7 years) | Compliance | OFCCP audit survival |
| 10 | Effective-dated multi-rate pay structure | Payroll | Workers have many rates simultaneously |
| 11 | Tax jurisdiction resolution service | Payroll | HR owns 50-state complexity |
| 12 | W-4 + deduction records with effective dates | Payroll | Foundation for every paycheck |

---

## Unified Entity Model

### Employee Aggregate (HR Core owns this)
```
Employee {
  id: EmployeeId (strongly-typed)
  tenant_id: TenantId
  
  // Identity
  personal_info: PersonalInfo {
    first_name, middle_name, last_name
    ssn_encrypted, date_of_birth
    home_address, phone, email
    emergency_contacts[]
  }
  
  // Employment
  employment: EmploymentInfo {
    employee_number
    status: Active | Inactive | Terminated | SeasonalInactive
    hire_date, termination_date
    eligible_for_rehire: bool
    employment_episodes: EmploymentEpisode[]  // Full history
  }
  
  // Classification
  classification: WorkerClassification {
    type: Field | Office | Hybrid
    trade_code: string  // Carpenter, electrician, laborer
    union_affiliation: UnionInfo?
    workers_comp_class_code: string
    default_crew_assignment: CrewId?
  }
  
  // Compliance
  certifications: Certification[]
  
  // Payroll Integration
  pay_rates: PayRate[]
  tax_profile: TaxProfile
  withholdings: WithholdingElection[]
  deductions: Deduction[]
}
```

### Certification Entity
```
Certification {
  id: CertificationId
  employee_id: EmployeeId
  
  type: CertificationType  // OSHA-10, OSHA-30, forklift, crane, welding, etc.
  issuing_authority: string
  issue_date: DateOnly
  expiration_date: DateOnly?
  
  verification_status: Pending | Verified | Expired | Revoked
  document_url: string?  // Scanned card/certificate
  
  // Compliance workflow
  warning_sent_30d: bool
  warning_sent_60d: bool
  warning_sent_90d: bool
}
```

### PayRate Entity
```
PayRate {
  id: PayRateId
  employee_id: EmployeeId
  
  rate_type: Hourly | Salary | PieceRate | PerDiem
  amount: decimal
  
  effective_date: DateOnly
  expiration_date: DateOnly?
  
  // Scoping
  project_id: ProjectId?  // Null = applies to all
  job_classification_id: ClassificationId?
  wage_determination_id: WageDeterminationId?  // For prevailing wage
  shift_code: string?
  
  priority: int  // Rate selection hierarchy
}
```

### EmploymentEpisode Entity
```
EmploymentEpisode {
  id: EpisodeId
  employee_id: EmployeeId
  
  hire_date: DateOnly
  termination_date: DateOnly?
  
  separation_reason: ProjectEnd | Quit | TerminationForCause | Seasonal | Retirement
  eligible_for_rehire: bool
  rehire_notes: string?
  
  // Union-specific
  union_dispatch_reference: string?
}
```

### TaxProfile Value Object
```
TaxProfile {
  home_state: StateCode
  work_states: StateCode[]  // Multi-state workers
  sui_state: StateCode  // Often differs
  reciprocity_elections: ReciprocityElection[]
}
```

### WithholdingElection Entity
```
WithholdingElection {
  id: ElectionId
  employee_id: EmployeeId
  
  type: FederalW4 | StateWithholding
  
  // Federal W-4 fields
  filing_status: Single | MarriedFilingJointly | HeadOfHousehold
  multiple_jobs: bool
  dependents_amount: decimal
  other_income: decimal
  deductions: decimal
  extra_withholding: decimal
  
  // State-specific (varies by state)
  state_code: StateCode?
  state_allowances: int?
  state_additional_amount: decimal?
  
  effective_date: DateOnly
  expiration_date: DateOnly?
}
```

### Deduction Entity
```
Deduction {
  id: DeductionId
  employee_id: EmployeeId
  
  type: Benefit | Garnishment | UnionDues | Retirement401k | Other
  description: string
  
  calculation_method: Flat | Percentage | HoursBased
  amount_or_rate: decimal
  cap_amount: decimal?
  
  ytd_withheld: decimal
  arrears_balance: decimal  // For catch-up
  
  priority: int  // Garnishment ordering is legally mandated
  
  effective_date: DateOnly
  expiration_date: DateOnly?
}
```

---

## EEO Data (Segregated Storage)

Per Compliance mandate, EEO data lives in a **separate schema** with restricted access:

```
hr_eeo.employee_demographics {
  employee_id: EmployeeId  // FK to hr.employees
  
  // Voluntarily reported
  race: string?
  ethnicity: string?
  sex: string?
  veteran_status: string?
  disability_status: string?
  
  collected_date: timestamp
  collection_method: SelfReported | Voluntary | VisualObservation
}
```

Access controlled via separate PostgreSQL role. Hiring managers cannot query this schema.

---

## Integration Architecture

```
                    ┌──────────────────────────┐
                    │        HR Core           │
                    │  (Employee Aggregate)    │
                    └────────────┬─────────────┘
                                 │
                    publishes domain events
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  TimeTracking   │    │     Payroll     │    │    Projects     │
│  (subscriber)   │    │    (future)     │    │  (subscriber)   │
│                 │    │                 │    │                 │
│ Validates:      │    │ Queries:        │    │ Queries:        │
│ - Active status │    │ - GetPayRate()  │    │ - GetCertified  │
│ - Valid certs   │    │ - GetTaxJuris() │    │   PayrollData() │
│ - Project auth  │    │ - GetDeductions │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key APIs for Agent Automation

```
// Cert compliance check (TimeTracking calls this)
GET /api/hr/employees/{id}/can-work?projectId={}&date={}
Response: { canWork: bool, blockers: ["OSHA-30 expired"] }

// Pay rate resolution (Payroll calls this)
GET /api/hr/employees/{id}/pay-rate?projectId={}&date={}&shift={}
Response: { rate: 45.50, rateType: "Hourly", wageDetId: "CA-2026-1" }

// Tax jurisdiction (Payroll calls this)
GET /api/hr/employees/{id}/tax-jurisdictions?workDate={}&siteId={}
Response: { federal: "US", states: ["CA"], locals: ["SF"] }

// Bulk cert verification (mobilization)
POST /api/hr/certifications/verify-bulk
Body: { projectId: "...", employeeIds: [...], requiredCerts: ["OSHA-30"] }
Response: { valid: [...], invalid: [...] }
```

---

## Migration from TimeTracking.Employee

| Phase | Action | Rollback |
|-------|--------|----------|
| 1 | Deploy HR Core module alongside TimeTracking | Drop HR Core tables |
| 2 | Migrate existing employees → HR Core (batch job with audit trail) | Re-run from TimeTracking |
| 3 | TimeTracking subscribes to HR events, maintains read projection | Revert to direct queries |
| 4 | Deprecate TimeTracking.Employee writes | Re-enable writes |
| 5 | Drop TimeTracking.Employee after 90 days | N/A (point of no return) |

---

## Recommended Implementation Order

### Phase 2A: HR Core Foundation (2-3 weeks)
1. Employee aggregate with core fields
2. Certification entity with expiration tracking
3. PayRate entity with effective dating
4. Event sourcing infrastructure
5. RLS policies
6. Audit logging

### Phase 2B: Compliance Layer (1-2 weeks)
1. Segregated EEO schema
2. Retention period calculations
3. I-9 tracking fields
4. Document storage integration

### Phase 2C: TimeTracking Integration (1 week)
1. Domain events for Employee lifecycle
2. TimeTracking subscription and projection
3. Cert validation API for time entry
4. Migration job

### Phase 2D: Payroll-Ready APIs (1-2 weeks)
1. Pay rate resolution API
2. Tax jurisdiction service
3. Withholding/deduction APIs
4. Bulk operations for agent automation

---

## Open Questions for Josh

1. **Union complexity:** How deep do we go on union dispatch, apprentice ratios, fringe fund reporting? MVP or full?
2. **Document storage:** Build our own or integrate (Box, SharePoint, S3)?
3. **I-9 verification:** Manual only or integrate with E-Verify?
4. **State coverage:** Start with CA + WA + OR (Josh's region) or go national from day 1?

---

*This synthesis represents consensus across Domain, Architecture, Compliance, and Payroll perspectives. All 12 non-negotiables must be addressed in the HR Core implementation.*
