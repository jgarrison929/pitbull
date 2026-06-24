# HR Director — Functional Role Reference

> **Audience:** AI agent teams building Pitbull Construction Solutions ERP
> **Last updated:** 2026-02-19

---

## 1. Role Description

The HR Director in a construction company manages the **employee lifecycle** from hire to termination — but in an industry with extreme regulatory complexity. Construction HR isn't like office HR. You're dealing with:

- **High turnover** — field workers move between companies constantly. A new hire might last two weeks.
- **Prevailing wage compliance** — federally funded projects require specific wage rates, fringe benefits, and certified payroll reports. Getting this wrong means debarment from federal work.
- **Union vs. open shop** — some employees are union members with collective bargaining agreements (CBAs) that dictate pay rates, benefits, work rules, and reporting. Others are non-union. Many companies run both simultaneously.
- **Multi-state operations** — a single contractor may have workers in 5+ states, each with different labor laws, withholding rules, and registration requirements.
- **OSHA compliance** — safety certifications, training records, incident tracking. OSHA can shut down a job site.
- **Workers' compensation** — class code assignment drives insurance costs. Misclassification is expensive. The difference between a carpenter (class code 5403) and a clerical worker (8810) is 10x in premium.

The HR Director owns the **Employee master record** — the single source of truth about who works for this company, what they can do, where they can work, and what they must be paid.

---

## 2. Core Responsibilities

| Area | Description |
|------|-------------|
| **Hiring & Onboarding** | Job postings, applications, offer letters, new-hire paperwork, orientation scheduling. In construction: verify certifications, assign safety training, set up for certified payroll if needed. |
| **Employee Master Data** | Maintain the canonical employee record: demographics, pay rates, classifications, certifications, emergency contacts, direct deposit, tax withholding elections. |
| **Compliance — I-9 / E-Verify** | Every employee must have a valid I-9. Federal contractors must use E-Verify. Violations = fines per employee. |
| **Compliance — OSHA** | Track required safety certifications (OSHA 10, OSHA 30, confined space, fall protection, etc.). Ensure no one works on site without valid certs. |
| **Compliance — Drug Testing** | Pre-employment, random, post-accident, reasonable suspicion. Many owners and GCs require it. Track results, manage MRO (Medical Review Officer) process. |
| **Union Administration** | Track union membership, local affiliation, classification, CBA terms. Report new hires/terminations to the union hall. Manage dispatch requests. |
| **Benefits Administration** | Health insurance, 401(k), PTO accruals, life insurance. In construction: union fringe benefits are often per-hour rather than per-month, and must be reported to the union trust fund. |
| **Workers' Compensation** | Assign correct class codes to employees based on job duties. Report injuries. Manage claims. Coordinate return-to-work. Class code assignment affects insurance premiums dramatically. |
| **Certified Payroll Setup** | For prevailing wage projects: determine applicable wage determination, set up job-level pay rates and fringe obligations, ensure employees are correctly classified per Davis-Bacon or state prevailing wage law. |
| **Termination / Offboarding** | Process terminations, calculate final pay (state-specific timing requirements), COBRA notifications, equipment return, exit interviews. |
| **EEO Reporting** | Track demographics for EEO-1 reporting. Federal contractors have affirmative action obligations. |
| **Training & Development** | Track continuing education, apprenticeship hours (critical for union and DOL programs), license renewals. |

---

## 3. Data Owned (Entities / Tables)

| Entity | Description | Key Fields |
|--------|-------------|------------|
| `Employee` | Master employee record | EmployeeId, FirstName, LastName, SSN (encrypted), DateOfBirth, HireDate, TermDate, Status (Active/Inactive/Terminated/LOA), EmployeeType (W2/1099/Temp) |
| `EmployeeClassification` | Job classification and pay info | EmployeeId, ClassificationCode, TradeCode, PayRate, PayType (Hourly/Salary), UnionLocal, EffectiveDate |
| `EmployeeCertification` | Safety and trade certifications | EmployeeId, CertType, CertNumber, IssueDate, ExpirationDate, IssuingBody, DocumentId |
| `EmployeeI9` | I-9 verification records | EmployeeId, Section1Date, Section2Date, DocumentListA, DocumentListB, DocumentListC, EVerifyCase, Status |
| `EmployeeDrugTest` | Drug testing records | EmployeeId, TestDate, TestType (Pre-employment/Random/PostAccident/ReasonableSuspicion), Result, MROReviewDate |
| `EmployeeBenefit` | Benefit enrollments | EmployeeId, PlanId, CoverageLevel, EffectiveDate, TermDate, EmployeeContribution, EmployerContribution |
| `UnionMembership` | Union affiliation details | EmployeeId, UnionId, LocalNumber, MemberNumber, ClassificationCode, DispatchDate, DuesStatus |
| `WorkersCompClass` | WC class code assignments | EmployeeId, ClassCode, StateCode, EffectiveDate, Rate |
| `EmployeeTaxSetup` | Tax withholding elections | EmployeeId, FederalFilingStatus, FederalAllowances, StateCode, StateFilingStatus, StateAllowances, AdditionalWithholding |
| `EmployeeDirectDeposit` | Bank account info for pay | EmployeeId, BankName, RoutingNumber, AccountNumber (encrypted), AccountType, Amount/Percentage, Priority |
| `EmployeeDocument` | Uploaded documents (licenses, certs, etc.) | EmployeeId, DocumentType, FileName, UploadDate, ExpirationDate, StoragePath |
| `EmergencyContact` | Emergency contact info | EmployeeId, ContactName, Relationship, Phone, Email |
| `EmployeeEquipment` | Assigned company equipment | EmployeeId, EquipmentId, AssignedDate, ReturnedDate, Condition |
| `Trade` | Trade/skill master list | TradeCode, TradeName, Description, DefaultWCClassCode |
| `Union` | Union organization master | UnionId, UnionName, LocalNumber, ContactInfo, TrustFundInfo |
| `CBA` (Collective Bargaining Agreement) | Union contract terms | UnionId, EffectiveDate, ExpirationDate, WageSchedule (JSON), FringeBenefits (JSON), WorkRules |

---

## 4. Modules Used Daily

| Module | Usage |
|--------|-------|
| **Employee Management** | Primary workspace. Add/edit employees, manage classifications, track certifications. |
| **Compliance Dashboard** | Monitor expiring certifications, missing I-9s, overdue drug tests, expired insurance. |
| **Union Administration** | Manage dispatch, track membership, review CBA terms. |
| **Benefits Administration** | Enroll/terminate benefits, process life events, track contributions. |
| **Document Management** | Store and retrieve employee documents (certifications, licenses, I-9s, drug tests). |
| **Training Tracker** | Assign training, track completion, ensure site-readiness. |
| **Reporting** | EEO-1, OSHA 300 log, workers' comp reports, headcount analysis. |
| **Onboarding Workflow** | Step-by-step new-hire process with task tracking. |

---

## 5. Dependencies on Other Roles

| Role | Dependency |
|------|-----------|
| **Payroll Manager** | HR sets up the employee; Payroll pays them. HR must have the employee record complete (classification, pay rate, tax elections, direct deposit) BEFORE payroll can process. |
| **Project Manager** | PM requests workers for projects. HR verifies they have required certifications for that job. PM provides the prevailing wage determination for certified payroll jobs. |
| **Controller/CFO** | Controller sets the workers' comp burden rates and benefits allocation rates that HR uses for cost projections. |
| **AP Clerk** | Benefits vendor invoices go through AP. HR must reconcile benefit enrollments against vendor billings. |
| **System Admin** | User account provisioning, module access for new hires who need ERP access. |

---

## 6. Workflows

### New Hire Onboarding (Construction-Specific)

```
Day 0: Offer Accepted
├── 1. Create Employee record (demographics, SSN, DOB)
├── 2. Assign classification (trade, pay rate)
├── 3. Collect I-9 documents — MUST complete Section 1 by first day
├── 4. Run E-Verify (if federal contractor)
├── 5. Order pre-employment drug test
├── 6. Collect tax withholding forms (W-4, state forms)
├── 7. Set up direct deposit
├── 8. Collect emergency contact info
├── 9. Verify/upload certifications (OSHA, trade licenses)
├── 10. Assign workers' comp class code
├── 11. Enroll in benefits (if eligible — often 60-90 day wait)
├── 12. If union: record union local, member number, dispatch info
├── 13. If prevailing wage job: set up certified payroll classification
├── 14. Assign required safety training
├── 15. Issue company equipment (PPE, phone, vehicle)
└── 16. Notify Payroll that employee is ready for pay processing

Day 3: I-9 Section 2 must be complete
Day 30: Review probationary period status
Day 60-90: Benefits eligibility trigger
```

### Daily
1. Process new hire paperwork for any starts today
2. Review certification expiration alerts — pull anyone from field whose certs expired
3. Process terminations — calculate final pay timing per state law
4. Respond to PM requests for worker availability/qualifications
5. Review drug test results from MRO
6. Process status changes (transfers, rate changes, classification changes)

### Weekly
1. Review new hire checklist completion — chase missing items
2. Run compliance report: I-9 audit, expired certs, missing training
3. Process benefit enrollment changes
4. Review workers' comp class code accuracy
5. Union reporting: new hires/terminations to union halls

### Monthly
1. Reconcile benefit invoices against enrollment records
2. Review headcount and turnover metrics
3. Update OSHA 300 log with any incidents
4. Process any prevailing wage determination updates
5. Review apprentice-to-journeyman ratios (union and DOL requirements)

### Quarterly
1. EEO-1 data preparation
2. Workers' comp audit preparation
3. Benefits renewal planning
4. Training compliance audit

### Annually
1. Open enrollment for benefits
2. Workers' comp audit — reconcile actual payroll by class code against estimated
3. OSHA 300A posting (February)
4. EEO-1 filing
5. Update CBA wage/fringe rates (if union contracts renewed)
6. ACA compliance (1095-C preparation if applicable)

---

## 7. Key Reports

| Report | Frequency | Description |
|--------|-----------|-------------|
| **Certification Expiration Report** | Daily | All employees with certs expiring in next 30/60/90 days. Critical — an employee on site with an expired cert is a liability. |
| **I-9 Compliance Report** | Weekly | Missing or incomplete I-9s, upcoming re-verification dates. |
| **Headcount by Classification** | Weekly | Active employees by trade, location, union status. |
| **Turnover Report** | Monthly | Hires, terms, turnover rate by department/trade. |
| **Workers' Comp Summary** | Monthly | Payroll dollars by class code, projected vs. actual premium. |
| **Drug Test Status** | Weekly | Pending tests, overdue random tests, results awaiting MRO review. |
| **OSHA 300 Log** | On-demand | Required recordable incident log. Must be posted annually (300A). |
| **Training Compliance** | Monthly | Required vs. completed training by employee. |
| **Prevailing Wage Employee List** | Per job | Employees assigned to prevailing wage jobs with correct classifications and rates. |
| **Union Roster** | Monthly | Active union employees by local, classification, hire date. |
| **Benefits Enrollment** | Monthly | Enrollment counts by plan, cost summary. |
| **EEO-1 Summary** | Quarterly | Headcount by EEO category, gender, ethnicity. |

---

## 8. AI Agent Assistance Opportunities

### Onboarding Automation
- **Smart onboarding checklist:** AI tracks which steps are complete for each new hire and surfaces what's blocking them from being "payroll-ready." Automatically notifies the right people.
- **I-9 document verification:** AI validates that uploaded documents match I-9 acceptable document lists and flags discrepancies.
- **Certification OCR:** Upload a photo of an OSHA card or trade license → AI extracts cert type, number, expiration date, and creates the record.
- **E-Verify integration:** Auto-submit to E-Verify upon I-9 completion, track case status, alert on tentative nonconfirmations.

### Compliance Monitoring
- **Proactive cert alerts:** Don't just report expirations — automatically notify the employee, their supervisor, and HR 60/30/15/7 days before expiration.
- **Prevailing wage classification matching:** Given a wage determination and an employee's trade, AI suggests the correct prevailing wage classification and validates the rate.
- **OSHA training auto-assignment:** When an employee is assigned to a project, AI checks site requirements and auto-assigns any missing required training.
- **Workers' comp class code validation:** AI reviews employee duties against NCCI class code descriptions and flags potential misclassifications.

### Document Intelligence
- **Union CBA parsing:** Upload a CBA PDF → AI extracts wage scales, fringe rates, work rules, and creates structured data for payroll setup.
- **Benefit plan comparison:** During open enrollment, AI generates employee-specific benefit comparisons based on their usage patterns.
- **Automated state law compliance:** When an employee works in a new state, AI surfaces registration requirements, withholding rules, and pay timing laws.

### Workforce Analytics
- **Predictive turnover:** Based on tenure, pay rate, season, and trade, predict which employees are likely to leave.
- **Skill gap analysis:** Given upcoming project requirements, identify certification and training gaps in the workforce.
- **Optimal crew composition:** Suggest crew assignments based on certifications, experience, and project requirements.

---

## 9. Pain Points in Vista / Legacy Systems That Pitbull Solves

| Vista / Legacy Pain | Pitbull Solution |
|---------------------|-----------------|
| **Employee setup is 15+ screens.** New hire paperwork in Vista requires touching PR Employee, HR Employee, Certs, Benefits, Tax, Direct Deposit as separate forms. Takes 30-45 minutes per hire. | **Single onboarding workflow** that collects everything in one flow. AI pre-fills from previous employment if they're a rehire. Target: under 10 minutes. |
| **Certification tracking is manual.** Vista tracks certs but doesn't proactively alert or prevent site assignment. Most companies use spreadsheets alongside Vista. | **Integrated cert management** with automatic expiration alerts, site-assignment blocking, and mobile upload capability. |
| **No mobile self-service.** Field workers can't update their own info, view pay stubs, or upload documents. Everything requires calling the office. | **Employee self-service portal** — view pay stubs, update contact info, upload certs, enroll in benefits from a phone. |
| **Prevailing wage setup is complex and error-prone.** Setting up wage determinations in Vista requires manual entry of every classification/rate combination. | **Wage determination import** — paste or upload a Davis-Bacon determination → AI parses it and creates all classifications/rates automatically. |
| **Union reporting is manual.** Monthly union reports require data extraction and manual formatting for each local. | **Automated union reports** — generate trust fund reports, remittance reports, and dues reports automatically from payroll data. |
| **Workers' comp audit is painful.** Annual WC audit requires reconciling payroll by class code — Vista reports don't always match auditor formats. | **WC audit-ready reports** — payroll by class code by state, matching NCCI format, generated on demand. |
| **No document management.** Vista doesn't store documents — I-9s, certs, and licenses live in filing cabinets or shared drives. | **Integrated document vault** — all employee documents stored with the record, searchable, with retention policies. |
| **Rehires require re-entering everything.** If someone quits and returns (common in construction), Vista treats them as a new hire. | **Rehire with history.** Pitbull recognizes returning employees, pre-fills their data, and maintains employment history. |
| **Multi-state compliance is guesswork.** Vista doesn't proactively tell you what's required when an employee works in a new state. | **State compliance engine** — auto-detects multi-state work from timecards and alerts on registration, withholding, and reporting requirements. |

---

## 10. Key Business Rules

1. **An employee cannot be assigned to a project without a valid, active Employee record.** No record = no timecard = no pay = no cost tracking.
2. **I-9 Section 1 must be completed on or before the first day of work.** Section 2 within 3 business days. System should enforce this.
3. **Certifications gate site access.** If a project requires OSHA 30 and the employee doesn't have it, the system should block time entry for that project.
4. **Workers' comp class codes must be assigned before the first timecard.** Payroll cannot process without a WC class code — it drives insurance allocation.
5. **Prevailing wage classifications are job-specific.** An employee may be classified as "Electrician" on a prevailing wage job and "Maintenance Tech" on a private job — different rates, different reporting.
6. **Union dispatch has priority rules.** Some CBAs require dispatching through the hall before hiring directly. The system must track dispatch vs. direct hire.
7. **Termination triggers cascading actions:** final pay calculation (state-specific timing), COBRA notification, benefit termination, equipment return checklist, union notification, access revocation.
8. **Employee data is PII.** SSN, DOB, bank accounts, medical info (drug tests) require encryption at rest, role-based access, and audit logging on every read.
9. **Rehired employees keep their original Employee ID.** Do not create a new record. Create a new employment period linked to the original record.
10. **Apprenticeship hours must be tracked.** DOL-registered apprenticeship programs require tracking of on-the-job training hours by category. This feeds into advancement to journeyman status.

---

## 11. Employee Status State Machine

```
                    ┌─────────┐
          ┌────────►│  Active  │◄────────┐
          │         └────┬─┬──┘         │
          │              │ │            │
     [Rehire]      [LOA] │ │[Term]  [Return]
          │              │ │            │
          │         ┌────▼─┘──┐    ┌───┴────┐
          │         │  Leave   │    │        │
          │         │ of       ├────┘        │
          │         │ Absence  │             │
          │         └──────────┘             │
          │                                  │
     ┌────┴──────┐                          │
     │ Terminated │──────────────────────────┘
     └────┬──────┘
          │
     [No rehire]
          │
     ┌────▼──────┐
     │  Inactive  │ (permanent, no rehire)
     └───────────┘
```

---

*This document is a living reference for AI agent teams. When building any feature that touches employee data, consult this document to understand the HR Director's perspective and constraints.*
