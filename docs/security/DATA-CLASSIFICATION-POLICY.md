# Data Classification Policy
**Pitbull Construction Solutions**
**Effective Date:** February 25, 2026
**Version:** 1.0

## Purpose
Define data sensitivity levels and handling requirements for all data processed by Pitbull Construction Solutions.

## Classification Levels

### Level 1: Public
Data intended for public consumption.
- Marketing materials, public website content
- Published pricing (when available)
- Open-source code (if applicable)
- **Handling:** No restrictions on storage or transmission.

### Level 2: Internal
Business data not intended for external sharing.
- Application source code
- Internal documentation and design specs
- Aggregate analytics and metrics
- Error logs and system telemetry
- **Handling:** Encrypted in transit (TLS 1.2+). Access limited to authorized team members.

### Level 3: Confidential
Customer and business-sensitive data.
- Customer company names and contact information
- Project names, descriptions, and schedules
- RFIs, submittals, daily reports, punch lists
- Contract amounts and change orders
- Vendor/subcontractor information
- AI interaction logs and chat history
- GPS location data (time entry geofencing)
- Daily report photos
- **Handling:** Encrypted in transit and at rest. Access controlled by tenant isolation (RLS) and RBAC. Retention per contractual and regulatory requirements.

### Level 4: Restricted
Highly sensitive data requiring maximum protection.
- Employee SSNs and tax IDs (W-4, I-9 data)
- Bank account numbers (direct deposit, vendor payments)
- Payroll rates and compensation data
- Bid amounts and estimating data (competitively sensitive)
- User credentials and authentication tokens
- API keys and secrets
- Insurance certificate details (third-party sensitive)
- Financial statements uploaded for pre-qualification
- **Handling:** Encrypted in transit, at rest, AND at field level (AES-256). Column-level encryption for SSN, bank accounts, bid amounts. Access logged and auditable. Minimum necessary access principle enforced.

## Data Handling Matrix

| Action | Public | Internal | Confidential | Restricted |
|---|---|---|---|---|
| Store unencrypted | ✅ | ❌ | ❌ | ❌ |
| Store encrypted at rest | N/A | ✅ | ✅ | ✅ + field-level |
| Transmit over TLS | ✅ | ✅ | ✅ | ✅ |
| Transmit unencrypted | ✅ | ❌ | ❌ | ❌ |
| Include in logs | ✅ | ✅ | Redacted | ❌ Never |
| Include in error reports | ✅ | ✅ | Redacted | ❌ Never |
| Backup | N/A | ✅ | ✅ Encrypted | ✅ Encrypted |
| Share with third parties | ✅ | With NDA | With consent | With consent + encryption |

## GPS Data Retention

Worker GPS data collected for time entry geofencing is classified as **Confidential** with additional handling:
- **Collection:** Only during clock-in/clock-out events. No continuous tracking.
- **Purpose:** Compliance verification for prevailing wage / certified payroll jobs.
- **Retention:** 90 days after pay period close, then deleted.
- **Access:** Payroll administrators and compliance officers only.
- **CCPA/State law:** Employees must be notified of GPS collection. Opt-out available for non-prevailing-wage projects.

## Photo Data Handling

Photos captured via daily reports and punch lists are classified as **Confidential** with additional handling:
- **Content risks:** May contain worker faces (biometric data in IL/TX/WA), license plates, proprietary project details.
- **Storage:** Encrypted at rest in blob storage. Tenant-isolated.
- **Retention:** Per project retention schedule (minimum: project duration + 3 years for warranty period).
- **BIPA compliance (Illinois):** If operating in IL, photos containing faces require written consent before collection. AI facial recognition is NOT used on any photos.
- **AI processing:** Photos may be processed by AI for document extraction (delivery tickets, punch list items). AI providers must meet our vendor security requirements. No photos are used for AI training.

## Regulatory Retention Requirements

| Data Type | Minimum Retention | Regulation |
|---|---|---|
| Certified payroll records | 3 years | Davis-Bacon Act |
| Tax records (W-2, 1099) | 7 years | IRS |
| Employment records | 4 years | California FEHA |
| OSHA safety records | 5-30 years | OSHA 29 CFR 1904 |
| Contract documents | Project life + 6 years | State statute of limitations |
| Financial records (GL, AP, AR) | 7 years | IRS + surety requirements |
| AI interaction logs | 1 year | Internal policy |

## Review Schedule
This policy will be reviewed annually or when significant changes occur in data handling practices, regulatory requirements, or product capabilities.
