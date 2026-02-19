# Payroll Manager — Functional Role Reference

> **Audience:** AI agent teams building Pitbull Construction Solutions ERP
> **Last updated:** 2026-02-19

---

## 1. Role Description

The Payroll Manager is the **execution engine** for employee compensation. They take approved timecards from Project Managers, apply the complex rules of construction payroll (union rates, prevailing wages, multi-state withholding, garnishments, fringe benefits), and produce:

- **Paychecks** (direct deposit or live checks)
- **Tax filings** (941, 940, state withholding, SUI)
- **Union reports** (trust fund remittances, dues reports)
- **Certified payroll reports** (WH-347 for Davis-Bacon jobs)
- **Workers' comp allocation** (payroll by class code for insurance)
- **GL journal entries** (labor cost distribution to jobs)

Construction payroll is **not** normal payroll. A single employee might work on three different jobs in one week — one private, one state prevailing wage, and one federal Davis-Bacon — each with different pay rates, fringe obligations, and reporting requirements. The Payroll Manager must get every penny right, because underpayment means Department of Labor enforcement actions, and overpayment means the company loses money it can't recover.

### Key Complexity Drivers

1. **Multiple pay rates per employee per job** — prevailing wage rates vary by trade, location, and funding source
2. **Union fringe benefits** — calculated per hour, remitted to trust funds monthly, each local has different rates
3. **Multi-state withholding** — employee lives in State A, works in State B. Which state gets the withholding? (It depends.)
4. **Certified payroll** — weekly reports to the government showing every worker, their classification, hours, rate, and fringe benefits on federal/state funded jobs
5. **Garnishments** — child support, tax levies, creditor garnishments, each with priority rules and calculation methods
6. **Burden** — on top of the paycheck, the company pays FICA match, FUTA, SUTA, workers' comp, GL insurance, health insurance — all of which must be allocated to job cost

---

## 2. Core Responsibilities

| Area | Description |
|------|-------------|
| **Timecard Processing** | Receive approved timecards from PMs. Validate hours, cost codes, pay rates. Resolve discrepancies before processing. |
| **Pay Calculation** | Calculate gross pay (regular, overtime, double-time, per diem, allowances), deductions, taxes, net pay. |
| **Tax Withholding** | Federal income tax, Social Security, Medicare, state income tax (potentially multiple states), local taxes. |
| **Union Fringe Benefits** | Calculate per-hour fringe obligations per CBA: pension, health & welfare, training fund, annuity, vacation/holiday fund. |
| **Certified Payroll (WH-347)** | Generate weekly certified payroll reports for prevailing wage jobs. Includes employee name, classification, hours by day, rate, gross, deductions, net. |
| **Garnishment Processing** | Apply garnishments in priority order (child support first, then tax levies, then creditor). Respect disposable income limits. |
| **Direct Deposit / Check Printing** | Generate ACH files for direct deposit, print live checks for those without DD. |
| **Tax Filing** | Federal 941 (quarterly), 940 (annual), state withholding deposits and reports, W-2 generation (annual). |
| **Union Reporting** | Monthly trust fund remittance reports showing hours and fringe amounts per employee per local. |
| **Workers' Comp Allocation** | Track payroll dollars by WC class code for insurance premium calculations. |
| **GL Posting** | Post payroll journal entries: gross wages, employer taxes, benefits, WC — all coded to the correct jobs/cost codes. |
| **Pay Stubs** | Generate detailed pay stubs showing earnings, deductions, taxes, YTD totals, accrual balances. |

---

## 3. Data Owned (Entities / Tables)

| Entity | Description | Key Fields |
|--------|-------------|------------|
| `PayPeriod` | Pay period definitions | PeriodStart, PeriodEnd, PayDate, Status (Open/Calculated/Approved/Posted/Closed), PayFrequency (Weekly/Biweekly) |
| `PayrollBatch` | Batch header for a payroll run | PayPeriodId, BatchNumber, CreatedDate, CalculatedDate, ApprovedBy, PostedDate, TotalGross, TotalNet, EmployeeCount |
| `PayrollDetail` | Per-employee pay detail | BatchId, EmployeeId, RegularHours, OTHours, DTHours, GrossPay, FederalTax, StateTax, FICA_EE, Medicare_EE, Deductions (JSON), NetPay |
| `PayrollEarning` | Individual earning lines | PayrollDetailId, EarningType (Regular/OT/DT/PerDiem/Allowance/PrevailingWage), Hours, Rate, Amount, JobId, CostCodeId, PhaseId, WCClassCode, StateWorked |
| `PayrollDeduction` | Deduction lines | PayrollDetailId, DeductionType, Amount, PreTax, EmployerMatch |
| `PayrollTax` | Tax calculation details | PayrollDetailId, TaxType (FederalIncome/FICA/Medicare/State/Local/FUTA/SUTA), TaxableWages, TaxAmount, EmployerPortion |
| `Garnishment` | Active garnishments | EmployeeId, GarnishmentType (ChildSupport/TaxLevy/Creditor/StudentLoan/Bankruptcy), CaseNumber, Amount/Percentage, Priority, MaxAmount, StartDate, EndDate |
| `UnionFringeCalc` | Per-employee fringe calculation | PayrollDetailId, UnionLocalId, FringeType (Pension/H&W/Training/Annuity/Vacation), Hours, Rate, Amount |
| `CertifiedPayroll` | WH-347 report data | JobId, WeekEnding, EmployeeId, Classification, WorkDay1-7Hours, StraightTimeRate, OTRate, GrossPay, Deductions, NetPay, FringeBenefits |
| `TaxDeposit` | Tax deposit/filing tracking | TaxType, Period, DueDate, Amount, DepositDate, ConfirmationNumber, Status |
| `UnionRemittance` | Monthly union trust fund report | UnionLocalId, ReportMonth, EmployeeId, TotalHours, PensionAmount, H_W_Amount, TrainingAmount, OtherAmounts, TotalDue |
| `W2Record` | Year-end W-2 data | EmployeeId, TaxYear, Wages, FederalTaxWithheld, SSTaxableWages, SSWithheld, MedicareWages, MedicareWithheld, StateWages, StateTaxWithheld |
| `PayrollGLEntry` | GL posting template and results | BatchId, AccountId, JobId, CostCodeId, DebitAmount, CreditAmount, Description |
| `BurdenRate` | Employer burden rates | EffectiveDate, FICA_Rate, FUTA_Rate, SUTA_Rate, WC_Rate (by class code), GL_Rate, BenefitLoadRate |

---

## 4. Modules Used Daily

| Module | Usage |
|--------|-------|
| **Payroll Processing** | Primary workspace. Calculate, review, approve, post payroll. |
| **Timecard Management** | Review and validate timecards submitted by PMs. Resolve discrepancies. |
| **Certified Payroll** | Generate WH-347 reports for prevailing wage jobs. |
| **Tax Management** | Track filing deadlines, calculate deposits, generate returns. |
| **Union Reporting** | Generate monthly trust fund remittance reports. |
| **Employee Inquiry** | Look up employee pay history, deductions, tax elections. |
| **General Ledger** | Review payroll journal entries after posting. |
| **Banking** | Manage ACH transmission for direct deposits. |

---

## 5. Dependencies on Other Roles

| Role | Dependency Direction | Description |
|------|---------------------|-------------|
| **HR Director** | HR → Payroll | HR must set up the employee record (classification, pay rate, tax elections, direct deposit, WC class code) BEFORE Payroll can include them. This is the #1 bottleneck — if HR hasn't finished onboarding, the employee can't get paid. |
| **Project Manager** | PM → Payroll | PM approves timecards with job/cost code allocation. Without approved timecards, Payroll has nothing to process. Timecard approval deadline is the most missed deadline in construction. |
| **Controller/CFO** | Payroll → Controller | Payroll produces GL journal entries that the Controller reviews. Controller sets burden rates that Payroll applies. Controller approves payroll before final posting. |
| **AP Clerk** | Payroll → AP | Union fringe remittances and tax deposits may flow through AP for payment. Payroll calculates the amounts; AP cuts the checks. |
| **System Admin** | Support | Pay period setup, tax table updates, system configuration. |

---

## 6. Workflows

### Pay Period Processing (Weekly — Most Construction Companies Pay Weekly)

```
Monday:
├── 1. Open new pay period
├── 2. Import/receive timecards from field (mobile app, kiosk, manual)
├── 3. PM approval reminder — timecards due by Tuesday noon
│
Tuesday:
├── 4. Chase unapproved timecards (this is 30% of the job)
├── 5. Validate approved timecards:
│   ├── Hours within legal limits (OT calculation correct?)
│   ├── Cost codes valid and active?
│   ├── Pay rates correct for job type (prevailing wage)?
│   ├── Per diem/allowances correct?
│   └── Multi-state allocation correct?
├── 6. Process new hires — verify HR has completed setup
├── 7. Process terminations — calculate final pay per state law
├── 8. Apply garnishment updates
│
Wednesday:
├── 9. CALCULATE PAYROLL
│   ├── Gross pay computation (regular, OT, DT, premiums)
│   ├── Pre-tax deduction application (401k, HSA, Section 125)
│   ├── Tax withholding calculation (federal, state(s), local)
│   ├── Post-tax deduction application (union dues, garnishments)
│   ├── Employer tax calculation (FICA match, FUTA, SUTA)
│   ├── Employer fringe calculation (union trust funds)
│   ├── Workers' comp allocation
│   └── Net pay computation
├── 10. REVIEW PAYROLL
│   ├── Payroll register — every employee, every earning/deduction line
│   ├── Exception report — unusually high/low checks, new employees, terminated
│   ├── Compare to prior period — significant changes?
│   ├── Verify tax deposit amounts
│   └── Review GL distribution — costs hitting correct jobs?
├── 11. CONTROLLER APPROVAL
│   └── Controller reviews totals, GL distribution, signs off
│
Thursday:
├── 12. POST PAYROLL
│   ├── Generate ACH file for direct deposits
│   ├── Transmit ACH to bank (must be 1-2 days before pay date)
│   ├── Print live checks (if any)
│   ├── Post GL journal entries
│   ├── Generate pay stubs
│   └── Lock pay period
│
Friday:
├── 13. PAY DAY
│   ├── Direct deposits hit accounts
│   ├── Distribute live checks
│   └── Distribute pay stubs (or notify electronic availability)
│
Ongoing:
├── 14. Generate certified payroll (WH-347) for prevailing wage jobs
├── 15. Deposit taxes per schedule (semi-weekly or monthly depositor)
├── 16. Resolve employee pay questions
└── 17. Process manual checks for corrections/adjustments
```

### Monthly
1. Generate union trust fund remittance reports
2. Remit union fringe payments
3. Reconcile payroll tax deposits against liability
4. Review and update garnishment orders
5. Workers' comp payroll summary by class code
6. Reconcile payroll bank account

### Quarterly
1. File Form 941 (Employer's Quarterly Federal Tax Return)
2. File state quarterly withholding returns
3. File state unemployment (SUI) reports
4. Reconcile quarterly totals to monthly deposits
5. Review burden rates against actual costs

### Annually
1. Generate and distribute W-2s (deadline: January 31)
2. File Form 940 (Federal Unemployment Tax)
3. File W-3 transmittal
4. Reconcile annual totals: gross wages, taxes withheld, taxes deposited
5. Update tax tables for new year
6. Update union fringe rates (per CBA renewals)
7. Update burden rates based on actual costs
8. Support workers' comp annual audit

---

## 7. Key Reports

| Report | Frequency | Description |
|--------|-----------|-------------|
| **Payroll Register** | Per pay period | Master list of all employees, earnings, deductions, taxes, net pay. The single most important payroll document. |
| **Certified Payroll (WH-347)** | Weekly (per prevailing wage job) | Federal/state required report showing every worker, classification, daily hours, rates, and fringes on funded projects. |
| **Payroll Journal Entry** | Per pay period | GL debit/credit distribution of all payroll costs to accounts and jobs. |
| **Tax Deposit Report** | Per deposit | Federal and state tax liability vs. deposits made. |
| **Union Trust Fund Report** | Monthly | Hours and fringe amounts by employee by union local. Submitted with payment to trust funds. |
| **Garnishment Report** | Per pay period | Active garnishments, amounts withheld this period, running balances. |
| **Workers' Comp Summary** | Monthly | Payroll dollars by WC class code by state. Used for insurance reporting. |
| **Labor Distribution Report** | Per pay period | Labor costs by job, phase, cost code. Critical for job costing accuracy. |
| **Quarterly Tax Return (941)** | Quarterly | Wages, federal tax withheld, FICA — reconciles to deposits. |
| **W-2 Summary** | Annual | Employee-level annual wage and tax summary. |
| **Payroll Exception Report** | Per pay period | Flags: missing timecards, unusual hours, rate changes, new/terminated employees, negative net pay. |
| **Overtime Analysis** | Weekly | OT hours and cost by employee, job, and department. |
| **Fringe Benefit Analysis** | Monthly | Total fringe cost per employee (union and non-union). |
| **YTD Earnings Report** | On demand | Year-to-date summary per employee for all earnings and deductions. |

---

## 8. AI Agent Assistance Opportunities

### Timecard Validation
- **Auto-flag discrepancies:** AI compares submitted timecards against: geofence data (was the employee actually on that job?), schedule (were they scheduled to work?), and historical patterns (did they usually work 8 hours, not 12?).
- **Rate auto-selection:** Based on the job's wage determination and the employee's classification, AI applies the correct rate automatically. No manual rate lookup.
- **OT calculation:** Auto-calculate overtime per FLSA rules, including weighted-average OT for employees working multiple jobs at different rates in one week.
- **Missing timecard detection:** AI identifies employees who were scheduled but have no timecard submitted, and alerts PMs before the approval deadline.

### Payroll Calculation
- **Multi-state auto-allocation:** Based on job locations and employee home state, AI determines which state(s) get withholding and applies reciprocity agreements where applicable.
- **Garnishment priority engine:** Auto-apply garnishments in correct legal priority order, calculate disposable income limits, and stop when maximums are reached.
- **Certified payroll auto-generation:** AI builds WH-347 from timecard data — no manual re-entry. Validates classifications against wage determination.
- **Anomaly detection:** Flag paychecks that are significantly different from the employee's historical pattern (50% higher/lower gross pay, new deduction, missing deduction).

### Tax & Compliance
- **Filing deadline tracker:** AI tracks all federal, state, and local filing deadlines and reminds Payroll with time to prepare.
- **Deposit calculation:** Based on deposit schedule (semi-weekly or monthly), AI calculates the required deposit and reminds Payroll of the due date.
- **W-2 reconciliation:** AI reconciles quarterly 941 totals to annual W-2 totals and flags discrepancies before filing.
- **Prevailing wage rate updates:** When a new wage determination is published, AI identifies affected jobs and alerts Payroll to rate changes.

### Reporting Intelligence
- **Natural language queries:** "How much did we pay in union fringes for Local 3 last month?" → instant answer from payroll data.
- **Labor cost trending:** Compare labor cost per hour by trade across projects to identify efficiency outliers.
- **Burden rate analysis:** Compare actual burden costs to applied rates and recommend adjustments.

---

## 9. Pain Points in Vista / Legacy Systems That Pitbull Solves

| Vista / Legacy Pain | Pitbull Solution |
|---------------------|-----------------|
| **Timecards arrive on paper or in spreadsheets.** Even with Vista's timecard entry, field data often comes in on paper daily logs that office staff re-keys. | **Mobile time entry** with GPS, job/cost code selection, and photo capability. Data flows directly from field to payroll queue. |
| **Certified payroll is a separate process.** In Vista, you run payroll first, then manually generate or re-enter data for WH-347. Many companies use LCPtracker separately. | **Certified payroll is a by-product of normal payroll.** Same data, different report format. No double-entry. |
| **Multi-rate employees are nightmares.** An employee on 3 jobs at 3 different rates in one week requires manual rate overrides in Vista. OT calculation on blended rates is often wrong. | **Automatic rate engine.** The system knows job → wage determination → employee classification → rate. Blended OT calculates automatically per FLSA rules. |
| **Union fringe calculations are manual or semi-manual.** Vista can calculate basic fringes but complex CBA rules (tiered rates, hour thresholds, apprentice vs. journeyman) require manual intervention. | **CBA rules engine.** Upload the CBA terms, and the system applies them automatically. Handles tiered rates, apprentice progressions, and multiple fund types. |
| **Tax filing is disjointed.** Vista calculates taxes but doesn't file them. Companies use a third-party service or file manually. | **Integrated tax filing** (or seamless integration with tax filing services). Calculate, validate, transmit — one workflow. |
| **Payroll preview takes too long.** In Vista, calculating a payroll for 200+ employees can take 30+ minutes, and if there's an error, you recalculate from scratch. | **Fast calculation with incremental recalc.** Change one timecard → recalculate that employee only. Full payroll preview in seconds, not minutes. |
| **GL posting is a black box.** In Vista, the payroll GL posting uses complex distribution codes that are hard to understand and harder to troubleshoot when jobs don't get the right costs. | **Transparent GL distribution.** Every dollar of labor cost traces from timecard → earning line → GL entry → job cost code. Drill-down from any number to its source. |
| **Year-end is painful.** W-2 generation in Vista requires manual adjustments, third-party printing services, and prayer. | **Automated W-2 generation** with validation, electronic filing, and employee self-service access to forms. |
| **No payroll analytics.** Vista is transactional — it processes payroll but doesn't help you understand labor cost patterns. | **Built-in analytics:** labor cost per hour by trade, OT trends, burden rate accuracy, union fringe as % of gross. |

---

## 10. Payroll Calculation Flow

```
Timecard (Approved)
│
├── Determine Pay Rate
│   ├── Standard rate from Employee record?
│   ├── Prevailing wage rate from Wage Determination?
│   ├── Union scale from CBA?
│   └── Override rate on timecard?
│
├── Calculate Gross Pay
│   ├── Regular hours × rate
│   ├── OT hours × rate × 1.5 (or per CBA)
│   ├── DT hours × rate × 2.0 (or per CBA)
│   ├── + Per diem / allowances
│   ├── + Shift differential
│   └── + Other earnings (bonus, retro pay)
│
├── Apply Pre-Tax Deductions
│   ├── 401(k) / pension (employee portion)
│   ├── Health insurance premium (Section 125)
│   ├── HSA / FSA contributions
│   └── Other pre-tax deductions
│
├── Calculate Taxes
│   ├── Federal income tax (based on W-4, filing status)
│   ├── Social Security (6.2% up to wage base)
│   ├── Medicare (1.45% + 0.9% additional over $200K)
│   ├── State income tax (work state, home state, reciprocity)
│   └── Local taxes (where applicable)
│
├── Apply Post-Tax Deductions
│   ├── Union dues
│   ├── Garnishments (in priority order)
│   ├── Roth 401(k)
│   ├── Voluntary deductions (charitable, tools, etc.)
│   └── Employee advances / repayments
│
├── Calculate Employer Costs (not on paycheck, but posted to jobs)
│   ├── FICA match (6.2% SS + 1.45% Medicare)
│   ├── FUTA (0.6% up to $7,000)
│   ├── SUTA (rate varies by state and experience)
│   ├── Workers' comp (rate varies by class code)
│   ├── General liability insurance allocation
│   ├── Employer health insurance contribution
│   ├── Union fringe benefits (per CBA rates)
│   │   ├── Pension fund
│   │   ├── Health & welfare fund
│   │   ├── Training fund
│   │   ├── Annuity fund
│   │   └── Vacation/holiday fund
│   └── Other employer contributions
│
├── Calculate Net Pay
│   └── Gross - Pre-Tax Deductions - Taxes - Post-Tax Deductions = Net Pay
│
└── Generate GL Distribution
    ├── DEBIT: Job cost accounts (labor + burden per cost code)
    ├── DEBIT: Overhead labor (non-job time)
    ├── CREDIT: Cash (net pay)
    ├── CREDIT: Tax liabilities (federal, state, local)
    ├── CREDIT: Benefit liabilities
    ├── CREDIT: Union payables
    └── CREDIT: Garnishment payables
```

---

## 11. Key Business Rules

1. **No paycheck without an approved timecard.** If the PM hasn't approved the hours, they don't get calculated. Exception: salaried employees on auto-pay.
2. **Prevailing wage rate compliance is non-negotiable.** If the employee's pay rate on a Davis-Bacon job is below the required rate, the system MUST block the calculation or flag for immediate correction.
3. **Overtime is calculated on the work week, not the day** (except in California and a few other states). For employees on multiple jobs at different rates, FLSA requires weighted-average OT rate calculation.
4. **Garnishments have a legal priority order:** (1) Child support, (2) Federal tax levies, (3) State tax levies, (4) Federal student loans, (5) Creditor garnishments. The system must respect this.
5. **Union fringe benefits are per-hour obligations, not deductions.** They are an employer cost paid to the trust fund, not withheld from the employee's paycheck (though some CBAs have employee contributions too).
6. **Payroll must be posted to the GL in the same period as the pay date.** If pay period ends in January but pay date is in February, the payroll hits February's GL (for cash-basis items) but the labor cost may need to be accrued in January (for accrual-basis).
7. **Certified payroll is weekly regardless of pay frequency.** Even if the company pays biweekly, WH-347 reports are submitted weekly.
8. **Final pay timing varies by state.** California requires final pay on the day of termination. Other states allow until the next regular pay date. The system must know the rules per state.
9. **Void and reissue, never edit.** If a paycheck has an error after posting, void it and reissue. Never modify a posted paycheck record.
10. **Year-to-date accumulators must be immutable audit artifacts.** W-2 numbers must reconcile to the penny against quarterly 941 filings. Any adjustment creates a new record, not a modification.

---

## 12. Certified Payroll (WH-347) Detail

The WH-347 is the federal certified payroll form required on Davis-Bacon (federally funded) construction projects. It requires:

| Field | Source |
|-------|--------|
| Contractor name and address | Company master |
| Project name and number | Job record |
| Week ending date | Pay period |
| Employee name and last 4 of SSN | Employee record |
| Work classification | Prevailing wage classification (NOT the employee's normal classification — it's job-specific) |
| Hours worked each day (Mon-Sun) | Timecard detail |
| Total hours (ST and OT) | Calculated from timecard |
| Rate of pay (ST and OT) | From wage determination |
| Gross pay | Calculated |
| Deductions (itemized) | From payroll detail |
| Net pay | Calculated |
| Fringe benefits | Per wage determination — can be paid in cash, to plans, or a combination |
| Statement of compliance (signature) | Controller or authorized officer signs |

**Key rules:**
- Apprentices must show their apprentice-to-journeyman ratio and registration number
- Fringe benefits can be paid as cash (shown as wages) or to bona fide plans (shown separately)
- The "prevailing wage" is base rate + fringe. The contractor can meet the fringe obligation through approved benefit plans (health, pension) and pay any shortfall as cash
- Reports are due weekly, typically within 7 days of the week ending

---

*This document is a living reference for AI agent teams. When building any feature that touches payroll, consult this document to understand the Payroll Manager's perspective and constraints.*
