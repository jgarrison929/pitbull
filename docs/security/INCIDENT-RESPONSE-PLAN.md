# Incident Response Plan
**Pitbull Construction Solutions**
**Effective Date:** February 25, 2026
**Version:** 1.0

## Purpose
Define the process for identifying, responding to, and recovering from security incidents.

## Definitions

- **Security Event:** Any observable occurrence relevant to information security (failed login, unusual API pattern).
- **Security Incident:** A security event that results in or has the potential to result in unauthorized access, data loss, or service disruption.
- **Severity Levels:**
  - **Critical:** Data breach, unauthorized access to Restricted data, complete service outage
  - **High:** Partial service outage, unauthorized access to Confidential data, active exploitation attempt
  - **Medium:** Suspicious activity, failed brute force attempts, misconfiguration discovered
  - **Low:** Policy violation, minor vulnerability discovered, informational alert

## Detection

### Automated Detection
- **PostHog:** Exception monitoring, session analysis, error rate tracking (Project ID: 316552)
- **Serilog:** Structured logging with real-time JSON output. Alert on: authentication failures >5/min, 500 error rate >1%, unusual API patterns
- **Railway:** Infrastructure health monitoring, resource usage alerts
- **Health Dashboard:** Admin-visible system health (CPU, memory, database connections, error rates)
- **Rate Limiting:** Automatic blocking of excessive requests (configured per endpoint)

### Manual Detection
- Customer reports via feedback widget or support contact
- Team member observation during routine monitoring
- Third-party vulnerability disclosures

## Response Procedures

### Step 1: Triage (0-15 minutes)
1. Confirm the incident is real (not a false positive)
2. Classify severity (Critical / High / Medium / Low)
3. Assign incident lead
4. Begin incident log (timestamp every action)

### Step 2: Containment (15-60 minutes)
| Severity | Containment Action |
|---|---|
| Critical | Isolate affected systems. Revoke compromised credentials. Consider full service suspension. |
| High | Block attacking IPs. Disable compromised accounts. Enable additional logging. |
| Medium | Monitor closely. Block suspicious sources. Patch if applicable. |
| Low | Document and schedule fix. |

### Step 3: Eradication (1-24 hours)
1. Identify root cause
2. Remove attacker access / patch vulnerability
3. Verify fix in staging environment
4. Deploy fix to production

### Step 4: Recovery (1-48 hours)
1. Restore affected services
2. Verify data integrity
3. Monitor for recurrence (heightened alerting for 72 hours)
4. Communicate status to affected customers

### Step 5: Post-Incident (within 5 business days)
1. Write post-mortem document
2. Identify lessons learned
3. Update runbooks and monitoring
4. File in incident log for SOC 2 evidence

## Communication

### Internal Communication
- Critical/High: Immediate notification to all team members
- Medium: Notification within 4 hours
- Low: Next business day

### Customer Communication
- **Data breach (Restricted data):** Notify affected customers within 72 hours per state breach notification laws (California: Cal. Civ. Code 1798.82)
- **Service outage >1 hour:** Status page update + email to affected tenants
- **Vulnerability discovered but not exploited:** Patch first, then notify if customer action required

### Regulatory Notification
- CCPA: Notify California residents within 72 hours of confirmed breach involving personal information
- State-specific: Follow most restrictive applicable state law
- Federal: Notify if breach involves >500 records (HHS if health data, varies by industry)

## Contacts

| Role | Name | Contact |
|---|---|---|
| Incident Lead | Security Lead | security@example.com |
| Technical Response | River (AI Agent) | Automated monitoring + response |
| Legal | TBD | (Engage counsel for Critical incidents) |
| Affected Customers | Via Email Provider | noreply@example.com |

## Incident Log Template

```
Incident ID: INC-YYYY-NNN
Date/Time Detected:
Detected By:
Severity:
Description:
Affected Systems:
Affected Customers:
Root Cause:
Containment Actions:
Resolution:
Timeline:
Lessons Learned:
Follow-up Actions:
```

## Annual Testing
- Tabletop exercise: Annually (simulate a data breach scenario)
- Penetration test: Annually (external engagement)
- Vulnerability scan: Quarterly (automated)
- Review and update this plan: Annually

## Review Schedule
This plan will be reviewed annually or after any Critical/High severity incident.
