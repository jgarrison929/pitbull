# HR Domain Expert Position Paper: HR Core Module Requirements

## The Construction HR Reality

Construction HR isn't corporate HR with hard hats. Our workforce is fundamentally different: 60% turnover is normal, workers move between projects weekly, and a single missing certification can shut down a jobsite. The HR Core module must reflect these realities or it will fail in the field.

## Essential Entities and Their Construction-Specific Fields

### Employee Entity
Beyond standard demographics, construction employees require:
- **Worker Classification**: Field/Office/Hybrid with default crew assignment
- **Union Affiliation**: Local number, apprenticeship level, hire hall status, dispatch date
- **Prevailing Wage Profile**: Home rate vs. traveled rate, per diem eligibility, subsistence zone
- **Multi-State Tax Withholding**: Home state, work states array, reciprocity elections
- **Emergency Contact with Jobsite Access**: Critical for remote site incidents
- **Rehire Flag + Last Separation Reason**: Construction rehires the same workers seasonally—we need instant history

### Certification Entity
This is non-negotiable infrastructure:
- **Certification Type**: OSHA-10, OSHA-30, forklift, crane operator, welding (with specific codes), confined space, fall protection, first aid/CPR, state-specific licenses
- **Issue Date / Expiration Date**: With configurable advance warning periods (30/60/90 days)
- **Issuing Authority**: Required for audit trails
- **Verification Status**: Pending/Verified/Expired/Revoked
- **Document Attachment**: Scanned cards and certificates
- **Project Requirements Link**: Which projects require which certs

### Position/Classification Entity
- **Trade Code**: Carpenter, electrician, laborer, operator—ties to union rates and prevailing wage classifications
- **Wage Determination Mapping**: Links to Davis-Bacon or state prevailing wage schedules
- **Journey/Apprentice Level**: Affects both pay rate and supervision requirements

### Employment Record Entity
Construction workers don't have continuous employment—they have episodes:
- **Hire Date / Termination Date / Rehire Dates**: Full history, not just current
- **Separation Reason**: Layoff (project end), quit, termination for cause, seasonal
- **Eligible for Rehire**: Boolean with notes
- **Union Dispatch Reference**: If applicable

## Critical Workflows

### Certification Compliance Workflow
1. Dashboard showing expiring certs by project and company-wide
2. Automated alerts to workers, supervisors, and HR at configurable intervals
3. **Hard stop integration**: Worker cannot be assigned to TimeTracking on projects requiring certs they don't have
4. Bulk cert verification for new project mobilization

### Prevailing Wage Classification Workflow
1. Assign worker to project with wage determination
2. System maps worker's trade to correct classification
3. Handles split classifications (laborer doing carpenter work = carpenter rate for those hours)
4. Generates certified payroll report data for Payroll module

### Seasonal Rehire Workflow
1. Mark workers as "seasonal inactive" vs. terminated
2. One-click reactivation with updated I-9 verification prompt if >3 years
3. Certification re-verification on rehire
4. Automatic restoration of previous crew/foreman assignments

## Integration Requirements

HR Core must expose clean APIs to:
- **TimeTracking**: Validate worker can work on project (active status + valid certs)
- **Job Costing**: Provide loaded labor rates including union benefits, per diem, fringes
- **Projects**: Feed certified payroll demographic data

---

## TOP 3 NON-NEGOTIABLE REQUIREMENTS

1. **Certification Tracking with Expiration Enforcement**: Real-time visibility into every worker's cert status with hard integration to TimeTracking. A worker with an expired OSHA-30 cannot log hours on a federal project. Period. This protects the company from OSHA fines and contract violations.

2. **Full Employment Episode History with Rehire Intelligence**: Construction workers are hired 3, 5, 10 times over a career. The system must treat this as normal, not exceptional. One-click rehire with automatic surfacing of past performance notes, certifications, and separation reasons.

3. **Prevailing Wage Classification Mapping**: Every field worker must link to wage determination classifications. Without this, certified payroll is impossible and we expose customers to False Claims Act liability on federal projects. This isn't a nice-to-have—it's why HR Core exists.
