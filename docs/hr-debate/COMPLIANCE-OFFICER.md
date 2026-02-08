# HR Core Compliance Requirements: Position Paper

**Author:** Compliance Officer  
**Date:** February 8, 2026  
**Subject:** Regulatory and Legal Requirements for HR Core Module

---

## Executive Summary

HR data isn't just sensitive—it's legally radioactive. Construction contractors face a unique compliance burden: federal contractors must meet OFCCP requirements, prevailing wage projects demand certified payroll, and multi-state operations trigger a patchwork of state-specific mandates. HR Core must be built compliance-first, not compliance-bolted-on.

## Mandatory Data Capture Requirements

### I-9 Employment Verification
Every employee requires a completed Form I-9 within three business days of hire. HR Core **must** capture:
- Section 1 employee information (with electronic signature capability)
- Section 2 employer verification with document metadata
- Reverification tracking for expiring work authorization
- **Storage requirement:** I-9s must be retained for 3 years after hire OR 1 year after termination, whichever is later. The system must auto-calculate and enforce this.

### EEO Data Collection
For employers with 100+ employees (or 50+ federal contractors), we must collect race, ethnicity, sex, and job category data for EEO-1 reporting. **Critical architectural requirement:** This data must be stored in a *separate, access-controlled table* from core employee records. Collection is voluntary for employees, but our system must:
- Clearly mark data as voluntary during collection
- Prevent hiring managers from viewing EEO data
- Generate Component 1 reports (and Component 2 pay data when required)

### OFCCP Compliance for Federal Contractors
Construction contractors frequently bid federal projects. OFCCP compliance requires:
- Applicant flow logs with disposition tracking
- Adverse impact analysis capability
- AAP (Affirmative Action Plan) data generation
- Internet Applicant Rule compliance (all expressions of interest must be logged)
- **Retention:** 2 years for contractors under $150K/150 employees; 3 years for larger contractors

## State-Specific Requirements

**California** demands:
- Pay scale disclosure in job postings
- Pay data reporting (SB 973)
- Itemized wage statements with specific fields

**New York** requires:
- Pay transparency in job advertisements
- Salary history ban enforcement
- Separate requirements for NYC employers

HR Core must be jurisdiction-aware, flagging missing required fields based on work location.

## Data Retention Matrix

| Record Type | Minimum Retention | Governing Law |
|-------------|-------------------|---------------|
| I-9 Forms | 3 years from hire OR 1 year post-termination | IRCA |
| Payroll Records | 3 years | FLSA |
| Personnel Files | 4 years post-termination | Various |
| FMLA Records | 3 years | FMLA |
| Benefits/ERISA | 6 years | ERISA |
| Safety Training | Duration of employment + 3 years | OSHA |

**Right to Deletion Conflicts:** GDPR/CCPA deletion requests cannot override federal retention mandates. HR Core must implement "soft delete" with legal hold capabilities.

## Audit Trail Requirements

Every access to sensitive HR data must log:
- User ID and timestamp
- Record accessed
- Action taken (view/edit/export/delete)
- IP address and session context

This isn't optional—it's required for OFCCP audits, litigation holds, and state privacy law compliance. Audit logs themselves must be retained for 7 years and be immutable.

## Document Storage

HR Core must securely store:
- Offer letters (signed)
- Acknowledgment of handbook/policies
- Performance reviews
- Disciplinary documentation
- Separation agreements

All documents require version control, access logging, and e-signature integration.

---

## TOP 3 NON-NEGOTIABLE REQUIREMENTS

1. **Segregated EEO Data Storage** — EEO demographic data must live in a separate, access-controlled data store with role-based permissions that prevent hiring managers from viewing it. This isn't a preference; it's how you avoid discrimination lawsuits.

2. **Automated Retention Enforcement** — The system must auto-calculate retention periods per record type and jurisdiction, prevent premature deletion, and flag records eligible for destruction. Manual tracking guarantees compliance failures at scale.

3. **Immutable, Comprehensive Audit Logging** — Every view, edit, and export of HR data must be logged with user, timestamp, and context. These logs must be tamper-proof and retained for 7 years. When the OFCCP auditor asks "who accessed this applicant's file and when," we must have the answer in seconds.
