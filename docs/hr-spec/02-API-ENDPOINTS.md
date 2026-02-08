# HR Core Module - API Endpoints Specification
**Version:** 1.0  
**Date:** February 8, 2026  
**Status:** Draft  
**Source:** SYNTHESIS.md consensus requirements

---

## Table of Contents
1. [Overview](#1-overview)
2. [Common Patterns](#2-common-patterns)
3. [Employee Endpoints](#3-employee-endpoints)
4. [Certification Endpoints](#4-certification-endpoints)
5. [Pay Rate Endpoints](#5-pay-rate-endpoints)
6. [Employment Episode Endpoints](#6-employment-episode-endpoints)
7. [Withholding & Deduction Endpoints](#7-withholding--deduction-endpoints)
8. [Specialized Query Endpoints](#8-specialized-query-endpoints)
9. [Bulk Operations](#9-bulk-operations)
10. [EEO Data Endpoints](#10-eeo-data-endpoints)
11. [Error Reference](#11-error-reference)

---

## 1. Overview

### 1.1 Design Principles

All HR Core APIs are designed for **AI agent automation** with these guarantees:

| Principle | Implementation |
|-----------|----------------|
| **Idempotency** | All mutating operations accept `X-Idempotency-Key` header |
| **Determinism** | Same inputs always produce same outputs (no random behavior) |
| **Retry-safe** | Duplicate requests with same idempotency key return cached response |
| **Audit trail** | All mutations emit domain events and are logged immutably |
| **Tenant isolation** | Row-level security (RLS) enforced at database layer |

### 1.2 Base URL

```
/api/hr
```

### 1.3 API Versioning

Initial release uses implicit v1. Future breaking changes will use URL versioning:
```
/api/hr/v2/employees
```

---

## 2. Common Patterns

### 2.1 Authentication & Authorization

All endpoints require JWT Bearer authentication. Authorization is role-based:

| Role | Scope |
|------|-------|
| `HR.Read` | View employee data (excluding EEO) |
| `HR.Write` | Create/update employees, certs, rates |
| `HR.Admin` | Full access including termination, EEO |
| `HR.EEO` | Access to segregated EEO data |
| `Payroll.Read` | Query pay rates, withholdings, tax jurisdictions |
| `TimeTracking.Validate` | Check work eligibility (cert validation) |

**Service-to-service calls** (e.g., TimeTracking → HR Core) use scoped API keys with specific permissions.

### 2.2 Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer {jwt_token}` |
| `X-Correlation-Id` | No | Client-provided trace ID (auto-generated if missing) |
| `X-Idempotency-Key` | Conditional | Required for POST/PUT/PATCH/DELETE (UUID format) |
| `X-Tenant-Id` | No | Override tenant (admin only, for cross-tenant ops) |
| `If-Match` | Conditional | ETag for optimistic concurrency on updates |

### 2.3 Response Headers

| Header | Description |
|--------|-------------|
| `X-Correlation-Id` | Echo or generated correlation ID |
| `ETag` | Resource version for optimistic concurrency |
| `X-Request-Id` | Server-assigned request identifier |
| `X-RateLimit-Remaining` | Remaining requests in window |

### 2.4 Standard Response Envelope

All responses follow this structure:

**Success (single resource):**
```json
{
  "data": { /* resource */ },
  "meta": {
    "correlationId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-02-08T15:30:00Z"
  }
}
```

**Success (collection with pagination):**
```json
{
  "data": [ /* resources */ ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "totalItems": 234,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "meta": {
    "correlationId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-02-08T15:30:00Z"
  }
}
```

**Error:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more validation errors occurred",
    "details": [
      {
        "field": "hireDate",
        "code": "INVALID_DATE",
        "message": "Hire date cannot be in the future"
      }
    ],
    "traceId": "00-abc123-def456-00",
    "correlationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### 2.5 Effective Dating

Many HR entities use effective dating for historical accuracy:

```json
{
  "effectiveDate": "2026-03-01",
  "expirationDate": null
}
```

- `effectiveDate`: When this record becomes active (inclusive)
- `expirationDate`: When this record expires (exclusive, null = no expiration)
- Queries accept `?asOf=2026-02-15` to retrieve point-in-time state

### 2.6 Rate Limiting

| Tier | Rate | Window |
|------|------|--------|
| Standard | 100 req | 1 minute |
| Elevated (Admin) | 500 req | 1 minute |
| Bulk Operations | 10 req | 1 minute |
| Service-to-Service | 1000 req | 1 minute |

---

## 3. Employee Endpoints

### 3.1 Create Employee

Creates a new employee record within the tenant.

```
POST /api/hr/employees
```

**Authorization:** `HR.Write`

**Headers:**
- `X-Idempotency-Key` (required): UUID for retry safety

**Request Body:**
```json
{
  "employeeNumber": "EMP-2026-0142",
  "personalInfo": {
    "firstName": "Michael",
    "middleName": "James",
    "lastName": "Rodriguez",
    "dateOfBirth": "1985-07-22",
    "ssnLast4": "4532",
    "homeAddress": {
      "street1": "1234 Oak Street",
      "street2": "Apt 5B",
      "city": "Seattle",
      "state": "WA",
      "zipCode": "98101",
      "country": "US"
    },
    "phone": "+1-206-555-0142",
    "email": "michael.rodriguez@email.com",
    "emergencyContacts": [
      {
        "name": "Maria Rodriguez",
        "relationship": "Spouse",
        "phone": "+1-206-555-0143"
      }
    ]
  },
  "classification": {
    "workerType": "Field",
    "tradeCode": "CARP",
    "tradeName": "Carpenter",
    "unionAffiliation": {
      "localNumber": "Local 131",
      "unionName": "United Brotherhood of Carpenters",
      "memberNumber": "UBC-2015-88421"
    },
    "workersCompClassCode": "5403",
    "defaultCrewId": null
  },
  "hireDate": "2026-02-15",
  "eligibleForRehire": true,
  "notes": "Referred by John Smith (EMP-2024-0089)"
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "employeeNumber": "EMP-2026-0142",
    "personalInfo": { /* ... */ },
    "classification": { /* ... */ },
    "employment": {
      "status": "Active",
      "hireDate": "2026-02-15",
      "terminationDate": null,
      "eligibleForRehire": true,
      "currentEpisode": {
        "id": "4fa85f64-5717-4562-b3fc-2c963f66afa7",
        "hireDate": "2026-02-15",
        "terminationDate": null
      }
    },
    "certifications": [],
    "payRates": [],
    "createdAt": "2026-02-08T15:30:00Z",
    "updatedAt": "2026-02-08T15:30:00Z",
    "version": 1
  },
  "meta": {
    "correlationId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-02-08T15:30:00Z"
  }
}
```

**Error Responses:**
| Code | Condition |
|------|-----------|
| 400 | Validation error |
| 401 | Not authenticated |
| 403 | Insufficient permissions |
| 409 | Duplicate employee number |
| 422 | Business rule violation (e.g., hire date before company founding) |
| 429 | Rate limit exceeded |

---

### 3.2 Get Employee

Retrieve a single employee by ID.

```
GET /api/hr/employees/{id}
```

**Authorization:** `HR.Read`

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Employee unique identifier |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `asOf` | DateOnly | today | Point-in-time for effective-dated fields |
| `include` | string[] | none | Related data: `certifications`, `payRates`, `episodes`, `withholdings`, `deductions` |

**Example:**
```
GET /api/hr/employees/3fa85f64-5717-4562-b3fc-2c963f66afa6?include=certifications,payRates&asOf=2026-01-15
```

**Response:** `200 OK`
```json
{
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "employeeNumber": "EMP-2026-0142",
    "personalInfo": {
      "firstName": "Michael",
      "middleName": "James",
      "lastName": "Rodriguez",
      "dateOfBirth": "1985-07-22",
      "ssnMasked": "***-**-4532",
      "homeAddress": { /* ... */ },
      "phone": "+1-206-555-0142",
      "email": "michael.rodriguez@email.com",
      "emergencyContacts": [ /* ... */ ]
    },
    "employment": {
      "status": "Active",
      "hireDate": "2026-02-15",
      "terminationDate": null,
      "eligibleForRehire": true,
      "currentEpisode": { /* ... */ }
    },
    "classification": {
      "workerType": "Field",
      "tradeCode": "CARP",
      "tradeName": "Carpenter",
      "unionAffiliation": { /* ... */ },
      "workersCompClassCode": "5403",
      "defaultCrewId": null
    },
    "certifications": [
      {
        "id": "5fa85f64-5717-4562-b3fc-2c963f66afa8",
        "type": "OSHA-30",
        "status": "Verified",
        "expirationDate": "2027-02-15",
        "daysUntilExpiration": 372
      }
    ],
    "payRates": [
      {
        "id": "6fa85f64-5717-4562-b3fc-2c963f66afa9",
        "rateType": "Hourly",
        "amount": 45.50,
        "effectiveDate": "2026-02-15",
        "scope": "Default"
      }
    ],
    "createdAt": "2026-02-08T15:30:00Z",
    "updatedAt": "2026-02-08T16:45:00Z",
    "version": 3
  },
  "meta": { /* ... */ }
}
```

**Error Responses:**
| Code | Condition |
|------|-----------|
| 401 | Not authenticated |
| 404 | Employee not found or not in tenant |

---

### 3.3 List Employees

Paginated list with filtering and sorting.

```
GET /api/hr/employees
```

**Authorization:** `HR.Read`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | int | 1 | Page number (1-indexed) |
| `pageSize` | int | 50 | Items per page (max 100) |
| `status` | string | all | `Active`, `Inactive`, `Terminated`, `SeasonalInactive` |
| `workerType` | string | all | `Field`, `Office`, `Hybrid` |
| `tradeCode` | string | all | Filter by trade |
| `search` | string | none | Search name, employee number |
| `hasExpiredCerts` | bool | null | Filter by cert status |
| `projectId` | UUID | null | Employees assigned to project |
| `sortBy` | string | `lastName` | Sort field |
| `sortDir` | string | `asc` | `asc` or `desc` |
| `asOf` | DateOnly | today | Point-in-time state |

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "employeeNumber": "EMP-2026-0142",
      "fullName": "Michael J. Rodriguez",
      "status": "Active",
      "workerType": "Field",
      "tradeCode": "CARP",
      "hireDate": "2026-02-15",
      "certificationStatus": "Valid",
      "activeCertCount": 3,
      "expiringSoonCount": 1
    }
    // ...more employees
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "totalItems": 234,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "meta": { /* ... */ }
}
```

---

### 3.4 Update Employee

Partial update of employee fields.

```
PATCH /api/hr/employees/{id}
```

**Authorization:** `HR.Write`

**Headers:**
- `X-Idempotency-Key` (required)
- `If-Match` (required): ETag from GET response for optimistic concurrency

**Request Body (JSON Patch or Merge Patch):**
```json
{
  "personalInfo": {
    "phone": "+1-206-555-9999",
    "homeAddress": {
      "street1": "5678 Pine Avenue"
    }
  },
  "classification": {
    "defaultCrewId": "7fa85f64-5717-4562-b3fc-2c963f66afb0"
  }
}
```

**Response:** `200 OK` with updated employee

**Error Responses:**
| Code | Condition |
|------|-----------|
| 400 | Validation error |
| 401 | Not authenticated |
| 403 | Insufficient permissions |
| 404 | Employee not found |
| 409 | Concurrent modification (ETag mismatch) |
| 412 | Precondition failed (missing If-Match) |
| 422 | Business rule violation |

---

### 3.5 Change Employee Status

Explicit status transitions with validation.

```
POST /api/hr/employees/{id}/status
```

**Authorization:** `HR.Write` (activate/deactivate), `HR.Admin` (terminate)

**Headers:**
- `X-Idempotency-Key` (required)

**Request Body:**
```json
{
  "newStatus": "Terminated",
  "effectiveDate": "2026-02-28",
  "reason": "ProjectEnd",
  "eligibleForRehire": true,
  "notes": "Project ABC completed. Good standing."
}
```

**Status Transition Rules:**
| From | To | Requires |
|------|----|----------|
| Active | Inactive | HR.Write |
| Active | SeasonalInactive | HR.Write |
| Active | Terminated | HR.Admin |
| Inactive | Active | HR.Write |
| SeasonalInactive | Active | HR.Write |
| Terminated | Active | HR.Admin (creates new episode) |

**Response:** `200 OK`
```json
{
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "previousStatus": "Active",
    "newStatus": "Terminated",
    "effectiveDate": "2026-02-28",
    "episodeClosed": {
      "id": "4fa85f64-5717-4562-b3fc-2c963f66afa7",
      "hireDate": "2026-02-15",
      "terminationDate": "2026-02-28",
      "separationReason": "ProjectEnd"
    }
  },
  "meta": { /* ... */ }
}
```

---

### 3.6 Rehire Employee

Specialized endpoint for the common rehire workflow (60% turnover in construction).

```
POST /api/hr/employees/{id}/rehire
```

**Authorization:** `HR.Admin`

**Headers:**
- `X-Idempotency-Key` (required)

**Request Body:**
```json
{
  "rehireDate": "2026-04-01",
  "employeeNumber": null,
  "classification": {
    "tradeCode": "CARP",
    "workerType": "Field"
  },
  "unionDispatchReference": "DISPATCH-2026-04-0088",
  "notes": "Returning for Highway 101 project"
}
```

**Validation:**
- Employee must have `eligibleForRehire = true`
- Cannot rehire if currently Active
- `rehireDate` must be after last termination date

**Response:** `201 Created` with new employment episode

---

## 4. Certification Endpoints

### 4.1 Add Certification

```
POST /api/hr/employees/{employeeId}/certifications
```

**Authorization:** `HR.Write`

**Headers:**
- `X-Idempotency-Key` (required)

**Request Body:**
```json
{
  "type": "OSHA-30",
  "issuingAuthority": "OSHA Training Institute",
  "issueDate": "2024-02-15",
  "expirationDate": "2029-02-15",
  "credentialNumber": "OSHA30-2024-88421",
  "documentUrl": null
}
```

**Certification Types (enum):**
```
OSHA-10, OSHA-30, OSHA-500, OSHA-510
Forklift, Crane, AerialLift, ScissorLift
WeldingAWS, WeldingCWB
FirstAid, CPR, AED
Scaffolding, ConfinedSpace, FallProtection
ElectricalLicense, PlumbingLicense
DriversLicenseCDL_A, DriversLicenseCDL_B
Asbestos, LeadAbatement
StateContractorLicense
Other
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "5fa85f64-5717-4562-b3fc-2c963f66afa8",
    "employeeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "type": "OSHA-30",
    "issuingAuthority": "OSHA Training Institute",
    "issueDate": "2024-02-15",
    "expirationDate": "2029-02-15",
    "credentialNumber": "OSHA30-2024-88421",
    "verificationStatus": "Pending",
    "documentUrl": null,
    "daysUntilExpiration": 1103,
    "warnings": {
      "sent30Day": false,
      "sent60Day": false,
      "sent90Day": false
    },
    "createdAt": "2026-02-08T15:30:00Z"
  },
  "meta": { /* ... */ }
}
```

---

### 4.2 List Employee Certifications

```
GET /api/hr/employees/{employeeId}/certifications
```

**Authorization:** `HR.Read`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | all | `Pending`, `Verified`, `Expired`, `Revoked` |
| `type` | string | all | Filter by certification type |
| `expiringWithinDays` | int | null | Filter certs expiring within N days |
| `asOf` | DateOnly | today | Point-in-time validation |

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "5fa85f64-5717-4562-b3fc-2c963f66afa8",
      "type": "OSHA-30",
      "typeName": "OSHA 30-Hour Construction",
      "verificationStatus": "Verified",
      "expirationDate": "2029-02-15",
      "daysUntilExpiration": 1103,
      "isExpired": false,
      "isExpiringSoon": false
    },
    {
      "id": "6fa85f64-5717-4562-b3fc-2c963f66afa9",
      "type": "Forklift",
      "typeName": "Forklift Operator",
      "verificationStatus": "Expired",
      "expirationDate": "2026-01-15",
      "daysUntilExpiration": -24,
      "isExpired": true,
      "isExpiringSoon": false
    }
  ],
  "meta": { /* ... */ }
}
```

---

### 4.3 Update Certification

```
PATCH /api/hr/employees/{employeeId}/certifications/{certId}
```

**Authorization:** `HR.Write`

**Headers:**
- `X-Idempotency-Key` (required)
- `If-Match` (required)

**Request Body:**
```json
{
  "expirationDate": "2030-02-15",
  "verificationStatus": "Verified",
  "documentUrl": "https://storage.pitbull.app/docs/cert-88421.pdf"
}
```

---

### 4.4 Verify Certification

Administrative verification of a certification.

```
POST /api/hr/employees/{employeeId}/certifications/{certId}/verify
```

**Authorization:** `HR.Write`

**Headers:**
- `X-Idempotency-Key` (required)

**Request Body:**
```json
{
  "verificationMethod": "DocumentReview",
  "verifiedBy": "Jane Smith",
  "notes": "Original card verified in person"
}
```

**Response:** `200 OK` with updated certification status

---

### 4.5 Revoke Certification

```
POST /api/hr/employees/{employeeId}/certifications/{certId}/revoke
```

**Authorization:** `HR.Admin`

**Headers:**
- `X-Idempotency-Key` (required)

**Request Body:**
```json
{
  "reason": "Issuing authority revocation",
  "effectiveDate": "2026-02-08"
}
```

---

## 5. Pay Rate Endpoints

### 5.1 Add Pay Rate

```
POST /api/hr/employees/{employeeId}/pay-rates
```

**Authorization:** `HR.Write`

**Headers:**
- `X-Idempotency-Key` (required)

**Request Body:**
```json
{
  "rateType": "Hourly",
  "amount": 52.50,
  "effectiveDate": "2026-03-01",
  "expirationDate": null,
  "scope": {
    "projectId": null,
    "jobClassificationId": "7fa85f64-5717-4562-b3fc-2c963f66afb1",
    "wageDeterminationId": null,
    "shiftCode": null
  },
  "priority": 100,
  "notes": "Annual raise effective March 1"
}
```

**Rate Types:**
- `Hourly` - Standard hourly rate
- `Salary` - Annual salary (converted to hourly for calc)
- `PieceRate` - Per-unit production rate
- `PerDiem` - Daily allowance

**Scope Fields (for rate selection hierarchy):**
| Field | Description |
|-------|-------------|
| `projectId` | Specific project override |
| `jobClassificationId` | Trade/role-specific rate |
| `wageDeterminationId` | Prevailing wage (Davis-Bacon) |
| `shiftCode` | Shift differential (`DAY`, `SWING`, `GRAVE`) |

**Priority Rules:**
- Higher priority number = higher precedence
- Most specific scope wins ties
- System resolves: Project+Shift > Project > WageDetermination > JobClass > Default

**Response:** `201 Created`
```json
{
  "data": {
    "id": "8fa85f64-5717-4562-b3fc-2c963f66afb2",
    "employeeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "rateType": "Hourly",
    "amount": 52.50,
    "effectiveDate": "2026-03-01",
    "expirationDate": null,
    "scope": {
      "projectId": null,
      "jobClassificationId": "7fa85f64-5717-4562-b3fc-2c963f66afb1",
      "jobClassificationName": "Journeyman Carpenter",
      "wageDeterminationId": null,
      "shiftCode": null
    },
    "priority": 100,
    "isActive": false,
    "activatesIn": 21,
    "createdAt": "2026-02-08T15:30:00Z"
  },
  "meta": { /* ... */ }
}
```

---

### 5.2 List Pay Rates

```
GET /api/hr/employees/{employeeId}/pay-rates
```

**Authorization:** `HR.Read`, `Payroll.Read`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `activeOnly` | bool | false | Only currently effective rates |
| `projectId` | UUID | null | Filter rates applicable to project |
| `asOf` | DateOnly | today | Point-in-time state |
| `includeExpired` | bool | false | Include expired rates |

**Response:** `200 OK` with array of pay rates

---

### 5.3 Update Pay Rate

```
PATCH /api/hr/employees/{employeeId}/pay-rates/{rateId}
```

**Authorization:** `HR.Write`

**Note:** Only future-dated rates can have `amount` changed. Active rates can only modify `expirationDate`.

---

### 5.4 Expire Pay Rate

Explicitly end a pay rate (sets expirationDate).

```
POST /api/hr/employees/{employeeId}/pay-rates/{rateId}/expire
```

**Authorization:** `HR.Write`

**Headers:**
- `X-Idempotency-Key` (required)

**Request Body:**
```json
{
  "expirationDate": "2026-02-28",
  "reason": "Project completed"
}
```

---

## 6. Employment Episode Endpoints

### 6.1 List Employment Episodes

Full employment history for rehire tracking.

```
GET /api/hr/employees/{employeeId}/episodes
```

**Authorization:** `HR.Read`

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "4fa85f64-5717-4562-b3fc-2c963f66afa7",
      "hireDate": "2026-02-15",
      "terminationDate": null,
      "separationReason": null,
      "eligibleForRehire": true,
      "isCurrent": true,
      "durationDays": 24,
      "unionDispatchReference": null
    },
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "hireDate": "2024-03-01",
      "terminationDate": "2025-11-15",
      "separationReason": "Seasonal",
      "eligibleForRehire": true,
      "isCurrent": false,
      "durationDays": 625,
      "unionDispatchReference": "DISPATCH-2024-03-0042"
    }
  ],
  "summary": {
    "totalEpisodes": 2,
    "totalDaysEmployed": 649,
    "firstHireDate": "2024-03-01",
    "isCurrentlyEmployed": true
  },
  "meta": { /* ... */ }
}
```

---

### 6.2 Get Episode Details

```
GET /api/hr/employees/{employeeId}/episodes/{episodeId}
```

**Authorization:** `HR.Read`

**Response:** `200 OK` with full episode details including notes and union dispatch info

---

## 7. Withholding & Deduction Endpoints

### 7.1 Add Withholding Election

```
POST /api/hr/employees/{employeeId}/withholdings
```

**Authorization:** `HR.Write`

**Headers:**
- `X-Idempotency-Key` (required)

**Request Body (Federal W-4):**
```json
{
  "type": "FederalW4",
  "effectiveDate": "2026-01-01",
  "filingStatus": "MarriedFilingJointly",
  "multipleJobs": false,
  "dependentsAmount": 4000.00,
  "otherIncome": 0,
  "deductions": 0,
  "extraWithholding": 50.00
}
```

**Request Body (State Withholding):**
```json
{
  "type": "StateWithholding",
  "stateCode": "WA",
  "effectiveDate": "2026-01-01",
  "stateAllowances": 2,
  "stateAdditionalAmount": 0
}
```

**Response:** `201 Created`

---

### 7.2 List Withholdings

```
GET /api/hr/employees/{employeeId}/withholdings
```

**Authorization:** `HR.Read`, `Payroll.Read`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | all | `FederalW4`, `StateWithholding` |
| `stateCode` | string | all | For state withholdings |
| `activeOnly` | bool | true | Only currently effective |
| `asOf` | DateOnly | today | Point-in-time state |

---

### 7.3 Add Deduction

```
POST /api/hr/employees/{employeeId}/deductions
```

**Authorization:** `HR.Write`

**Headers:**
- `X-Idempotency-Key` (required)

**Request Body:**
```json
{
  "type": "Garnishment",
  "description": "Child Support - Case #12345",
  "calculationMethod": "Flat",
  "amountOrRate": 450.00,
  "capAmount": null,
  "priority": 1,
  "effectiveDate": "2026-02-01",
  "expirationDate": null,
  "courtOrderNumber": "CS-2026-12345",
  "garnishmentType": "ChildSupport"
}
```

**Deduction Types:**
- `Benefit` - Health, dental, vision premiums
- `Garnishment` - Court-ordered (legally mandated priority)
- `UnionDues` - Union membership dues
- `Retirement401k` - 401(k) contributions
- `Other` - Miscellaneous

**Calculation Methods:**
- `Flat` - Fixed dollar amount per pay period
- `Percentage` - Percentage of gross pay
- `HoursBased` - Per-hour deduction

**Response:** `201 Created`

---

### 7.4 List Deductions

```
GET /api/hr/employees/{employeeId}/deductions
```

**Authorization:** `HR.Read`, `Payroll.Read`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | all | Filter by deduction type |
| `activeOnly` | bool | true | Only currently effective |
| `asOf` | DateOnly | today | Point-in-time state |

---

### 7.5 Update Deduction

```
PATCH /api/hr/employees/{employeeId}/deductions/{deductionId}
```

**Authorization:** `HR.Write`

**Note:** Garnishment priority cannot be changed (legally mandated ordering).

---

## 8. Specialized Query Endpoints

These endpoints are optimized for AI agent and service-to-service calls.

### 8.1 Can Work Check (Cert Validation)

**Critical for TimeTracking integration.** Determines if employee can log time.

```
GET /api/hr/employees/{employeeId}/can-work
```

**Authorization:** `TimeTracking.Validate`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | UUID | Yes | Project being worked |
| `date` | DateOnly | Yes | Work date |
| `requiredCerts` | string[] | No | Additional cert requirements |

**Response:** `200 OK`
```json
{
  "data": {
    "canWork": false,
    "employeeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "employeeName": "Michael Rodriguez",
    "projectId": "9fa85f64-5717-4562-b3fc-2c963f66afb3",
    "date": "2026-02-08",
    "blockers": [
      {
        "code": "CERT_EXPIRED",
        "message": "OSHA-30 certification expired on 2026-01-15",
        "certType": "OSHA-30",
        "expirationDate": "2026-01-15",
        "severity": "Hard"
      }
    ],
    "warnings": [
      {
        "code": "CERT_EXPIRING_SOON",
        "message": "Forklift certification expires in 28 days",
        "certType": "Forklift",
        "expirationDate": "2026-03-08",
        "severity": "Soft"
      }
    ],
    "validCertifications": [
      "FirstAid",
      "CPR"
    ]
  },
  "meta": { /* ... */ }
}
```

**Blocker Codes:**
| Code | Description | Severity |
|------|-------------|----------|
| `CERT_EXPIRED` | Required cert is expired | Hard |
| `CERT_MISSING` | Required cert not on file | Hard |
| `CERT_REVOKED` | Cert has been revoked | Hard |
| `CERT_PENDING` | Cert pending verification | Soft |
| `EMPLOYEE_INACTIVE` | Employee not in Active status | Hard |
| `NOT_ASSIGNED` | Not assigned to project | Hard |

---

### 8.2 Pay Rate Resolution

**Critical for Payroll integration.** Returns the applicable pay rate for a work context.

```
GET /api/hr/employees/{employeeId}/pay-rate
```

**Authorization:** `Payroll.Read`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | UUID | Yes | Project context |
| `date` | DateOnly | Yes | Work date |
| `shiftCode` | string | No | Shift identifier |
| `jobClassificationId` | UUID | No | Specific classification |

**Response:** `200 OK`
```json
{
  "data": {
    "employeeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "resolvedRate": {
      "id": "8fa85f64-5717-4562-b3fc-2c963f66afb2",
      "rateType": "Hourly",
      "amount": 52.50,
      "effectiveDate": "2026-03-01"
    },
    "resolutionPath": [
      {
        "step": 1,
        "check": "Project + Shift specific",
        "found": false
      },
      {
        "step": 2,
        "check": "Project specific",
        "found": false
      },
      {
        "step": 3,
        "check": "Wage determination (prevailing wage)",
        "found": false
      },
      {
        "step": 4,
        "check": "Job classification",
        "found": true,
        "rateId": "8fa85f64-5717-4562-b3fc-2c963f66afb2"
      }
    ],
    "prevailingWage": null,
    "context": {
      "projectId": "9fa85f64-5717-4562-b3fc-2c963f66afb3",
      "date": "2026-03-15",
      "shiftCode": null,
      "jobClassificationId": "7fa85f64-5717-4562-b3fc-2c963f66afb1"
    }
  },
  "meta": { /* ... */ }
}
```

---

### 8.3 Tax Jurisdiction Resolution

**Critical for Payroll integration.** Determines applicable tax jurisdictions.

```
GET /api/hr/employees/{employeeId}/tax-jurisdictions
```

**Authorization:** `Payroll.Read`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workDate` | DateOnly | Yes | Date of work |
| `siteId` | UUID | Yes | Work site location |
| `siteState` | string | No | Override site state |
| `siteCity` | string | No | Override site city |

**Response:** `200 OK`
```json
{
  "data": {
    "employeeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "workDate": "2026-02-08",
    "jurisdictions": {
      "federal": "US",
      "states": [
        {
          "code": "CA",
          "type": "Work",
          "withholdingRequired": true
        },
        {
          "code": "WA",
          "type": "Residence",
          "withholdingRequired": false,
          "note": "WA has no state income tax"
        }
      ],
      "locals": [
        {
          "code": "SF",
          "name": "San Francisco",
          "state": "CA",
          "withholdingRequired": true,
          "rate": 0.015
        }
      ]
    },
    "reciprocity": {
      "applies": false,
      "election": null
    },
    "suiState": "WA",
    "notes": [
      "Employee home state WA, working in CA",
      "CA requires withholding for all work performed in state"
    ]
  },
  "meta": { /* ... */ }
}
```

---

### 8.4 Get Employee Payroll Data

Consolidated view for payroll processing.

```
GET /api/hr/employees/{employeeId}/payroll-data
```

**Authorization:** `Payroll.Read`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `asOf` | DateOnly | today | Point-in-time state |
| `projectId` | UUID | null | Context for rate resolution |

**Response:** `200 OK`
```json
{
  "data": {
    "employeeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "employeeNumber": "EMP-2026-0142",
    "fullName": "Michael J. Rodriguez",
    "ssn4": "4532",
    "homeState": "WA",
    "taxProfile": {
      "federalWithholding": {
        "filingStatus": "MarriedFilingJointly",
        "multipleJobs": false,
        "dependentsAmount": 4000.00,
        "otherIncome": 0,
        "deductions": 0,
        "extraWithholding": 50.00,
        "effectiveDate": "2026-01-01"
      },
      "stateWithholdings": [],
      "workStates": ["CA", "WA", "OR"],
      "suiState": "WA"
    },
    "activePayRates": [
      {
        "id": "8fa85f64-5717-4562-b3fc-2c963f66afb2",
        "rateType": "Hourly",
        "amount": 52.50,
        "scope": "JobClassification:Journeyman Carpenter",
        "effectiveDate": "2026-03-01"
      }
    ],
    "activeDeductions": [
      {
        "id": "afa85f64-5717-4562-b3fc-2c963f66afb4",
        "type": "Garnishment",
        "description": "Child Support - Case #12345",
        "calculationMethod": "Flat",
        "amountOrRate": 450.00,
        "priority": 1,
        "ytdWithheld": 900.00,
        "arrearsBalance": 0
      },
      {
        "id": "bfa85f64-5717-4562-b3fc-2c963f66afb5",
        "type": "UnionDues",
        "description": "UBC Local 131 Dues",
        "calculationMethod": "HoursBased",
        "amountOrRate": 0.85,
        "priority": 50,
        "ytdWithheld": 340.00
      }
    ],
    "classification": {
      "workerType": "Field",
      "tradeCode": "CARP",
      "workersCompClassCode": "5403"
    }
  },
  "meta": { /* ... */ }
}
```

---

## 9. Bulk Operations

All bulk operations are designed for AI agent automation with these guarantees:
- Atomic: All succeed or all fail (transactional)
- Idempotent: Same request produces same result
- Progress tracking: Long operations return job ID for polling

### 9.1 Bulk Cert Verification

Verify certifications for a group of employees against project requirements.

```
POST /api/hr/certifications/verify-bulk
```

**Authorization:** `TimeTracking.Validate`

**Headers:**
- `X-Idempotency-Key` (required)

**Request Body:**
```json
{
  "projectId": "9fa85f64-5717-4562-b3fc-2c963f66afb3",
  "date": "2026-02-15",
  "employeeIds": [
    "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "4fa85f64-5717-4562-b3fc-2c963f66afa7",
    "5fa85f64-5717-4562-b3fc-2c963f66afa8"
  ],
  "requiredCerts": ["OSHA-30", "FirstAid"],
  "includeWarnings": true
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "projectId": "9fa85f64-5717-4562-b3fc-2c963f66afb3",
    "date": "2026-02-15",
    "summary": {
      "total": 3,
      "valid": 2,
      "invalid": 1
    },
    "valid": [
      {
        "employeeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "employeeName": "Michael Rodriguez",
        "allCertsValid": true,
        "warnings": []
      },
      {
        "employeeId": "4fa85f64-5717-4562-b3fc-2c963f66afa7",
        "employeeName": "Sarah Chen",
        "allCertsValid": true,
        "warnings": [
          {
            "certType": "FirstAid",
            "message": "Expires in 45 days"
          }
        ]
      }
    ],
    "invalid": [
      {
        "employeeId": "5fa85f64-5717-4562-b3fc-2c963f66afa8",
        "employeeName": "James Wilson",
        "blockers": [
          {
            "certType": "OSHA-30",
            "reason": "CERT_EXPIRED",
            "expiredOn": "2026-01-30"
          }
        ]
      }
    ]
  },
  "meta": { /* ... */ }
}
```

---

### 9.2 Bulk Pay Rate Resolution

Get applicable pay rates for multiple employees in a single call.

```
POST /api/hr/pay-rates/resolve-bulk
```

**Authorization:** `Payroll.Read`

**Headers:**
- `X-Idempotency-Key` (required)

**Request Body:**
```json
{
  "requests": [
    {
      "employeeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "projectId": "9fa85f64-5717-4562-b3fc-2c963f66afb3",
      "date": "2026-02-15",
      "shiftCode": "DAY"
    },
    {
      "employeeId": "4fa85f64-5717-4562-b3fc-2c963f66afa7",
      "projectId": "9fa85f64-5717-4562-b3fc-2c963f66afb3",
      "date": "2026-02-15",
      "shiftCode": "SWING"
    }
  ]
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "results": [
      {
        "employeeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "resolved": true,
        "rate": {
          "rateType": "Hourly",
          "amount": 52.50,
          "rateId": "8fa85f64-5717-4562-b3fc-2c963f66afb2"
        }
      },
      {
        "employeeId": "4fa85f64-5717-4562-b3fc-2c963f66afa7",
        "resolved": true,
        "rate": {
          "rateType": "Hourly",
          "amount": 48.75,
          "rateId": "9fa85f64-5717-4562-b3fc-2c963f66afb3"
        }
      }
    ],
    "allResolved": true
  },
  "meta": { /* ... */ }
}
```

---

### 9.3 Bulk Employee Import

Import multiple employees from external system (CSV, payroll system, etc.).

```
POST /api/hr/employees/import
```

**Authorization:** `HR.Admin`

**Headers:**
- `X-Idempotency-Key` (required)

**Request Body:**
```json
{
  "source": "VistaPayroll",
  "mode": "CreateOrUpdate",
  "validateOnly": false,
  "employees": [
    {
      "externalId": "VISTA-12345",
      "employeeNumber": "EMP-2026-0143",
      "firstName": "David",
      "lastName": "Kim",
      "dateOfBirth": "1990-03-15",
      "hireDate": "2026-02-20",
      "tradeCode": "ELEC",
      "baseHourlyRate": 55.00
    }
    // ...more employees (max 100 per batch)
  ]
}
```

**Import Modes:**
- `CreateOnly` - Fail if any employee exists
- `UpdateOnly` - Fail if any employee doesn't exist
- `CreateOrUpdate` - Upsert behavior
- `ValidateOnly` - Dry run, return validation results

**Response:** `200 OK` (or `202 Accepted` for large batches)
```json
{
  "data": {
    "jobId": "cfa85f64-5717-4562-b3fc-2c963f66afb6",
    "status": "Completed",
    "summary": {
      "total": 50,
      "created": 45,
      "updated": 3,
      "failed": 2
    },
    "failures": [
      {
        "index": 12,
        "externalId": "VISTA-12356",
        "errors": [
          {
            "field": "dateOfBirth",
            "code": "INVALID_DATE",
            "message": "Date of birth cannot be in the future"
          }
        ]
      }
    ]
  },
  "meta": { /* ... */ }
}
```

---

### 9.4 Bulk Status Update

Change status for multiple employees (e.g., seasonal deactivation).

```
POST /api/hr/employees/status-bulk
```

**Authorization:** `HR.Admin`

**Headers:**
- `X-Idempotency-Key` (required)

**Request Body:**
```json
{
  "employeeIds": [
    "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "4fa85f64-5717-4562-b3fc-2c963f66afa7",
    "5fa85f64-5717-4562-b3fc-2c963f66afa8"
  ],
  "newStatus": "SeasonalInactive",
  "effectiveDate": "2026-11-30",
  "reason": "Winter shutdown",
  "eligibleForRehire": true
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "total": 3,
    "successful": 3,
    "failed": 0,
    "results": [
      {
        "employeeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "previousStatus": "Active",
        "newStatus": "SeasonalInactive",
        "success": true
      }
      // ...
    ]
  },
  "meta": { /* ... */ }
}
```

---

### 9.5 Expiring Certifications Report

Query for certifications expiring within a date range.

```
GET /api/hr/certifications/expiring
```

**Authorization:** `HR.Read`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `daysAhead` | int | 30 | Days to look ahead |
| `certTypes` | string[] | all | Filter by cert type |
| `projectId` | UUID | null | Only employees on project |
| `page` | int | 1 | Page number |
| `pageSize` | int | 50 | Items per page |

**Response:** `200 OK`
```json
{
  "data": [
    {
      "employeeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "employeeName": "Michael Rodriguez",
      "employeeNumber": "EMP-2026-0142",
      "certification": {
        "id": "5fa85f64-5717-4562-b3fc-2c963f66afa8",
        "type": "OSHA-30",
        "expirationDate": "2026-03-01",
        "daysUntilExpiration": 21
      },
      "assignedProjects": [
        {
          "projectId": "9fa85f64-5717-4562-b3fc-2c963f66afb3",
          "projectName": "Highway 101 Phase 2"
        }
      ],
      "warningsSent": {
        "day90": true,
        "day60": true,
        "day30": false
      }
    }
  ],
  "pagination": { /* ... */ },
  "meta": { /* ... */ }
}
```

---

## 10. EEO Data Endpoints

**⚠️ SEGREGATED STORAGE**: EEO data is stored in a separate schema (`hr_eeo`) with restricted access. These endpoints have additional audit logging.

### 10.1 Submit EEO Demographics

```
POST /api/hr/employees/{employeeId}/eeo-demographics
```

**Authorization:** `HR.EEO`

**Headers:**
- `X-Idempotency-Key` (required)

**Request Body:**
```json
{
  "race": "Asian",
  "ethnicity": "Not Hispanic or Latino",
  "sex": "Male",
  "veteranStatus": "Not a Veteran",
  "disabilityStatus": "No",
  "collectionMethod": "SelfReported"
}
```

**Collection Methods:**
- `SelfReported` - Employee self-identified
- `Voluntary` - Voluntary disclosure form
- `VisualObservation` - Observer assessment (last resort)

**Response:** `201 Created`

---

### 10.2 Get EEO Demographics

```
GET /api/hr/employees/{employeeId}/eeo-demographics
```

**Authorization:** `HR.EEO`

**Response:** `200 OK`
```json
{
  "data": {
    "employeeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "demographics": {
      "race": "Asian",
      "ethnicity": "Not Hispanic or Latino",
      "sex": "Male",
      "veteranStatus": "Not a Veteran",
      "disabilityStatus": "No"
    },
    "collectedDate": "2026-02-15T10:30:00Z",
    "collectionMethod": "SelfReported"
  },
  "meta": { /* ... */ }
}
```

---

### 10.3 EEO Summary Report

Aggregate EEO statistics (anonymized for OFCCP compliance).

```
GET /api/hr/reports/eeo-summary
```

**Authorization:** `HR.EEO`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `startDate` | DateOnly | 1 year ago | Report period start |
| `endDate` | DateOnly | today | Report period end |
| `groupBy` | string | none | `trade`, `project`, `department` |

**Response:** `200 OK`
```json
{
  "data": {
    "reportPeriod": {
      "start": "2025-02-08",
      "end": "2026-02-08"
    },
    "totalEmployees": 234,
    "demographics": {
      "race": {
        "White": 145,
        "Hispanic or Latino": 42,
        "Black or African American": 23,
        "Asian": 18,
        "Other": 6
      },
      "sex": {
        "Male": 198,
        "Female": 36
      },
      "veteranStatus": {
        "Veteran": 28,
        "Not a Veteran": 206
      }
    },
    "byTrade": [
      {
        "tradeCode": "CARP",
        "tradeName": "Carpenter",
        "count": 45,
        "demographics": { /* ... */ }
      }
    ]
  },
  "meta": { /* ... */ }
}
```

---

## 11. Error Reference

### 11.1 Standard Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `VALIDATION_ERROR` | Request body failed validation |
| 400 | `INVALID_DATE_RANGE` | Date range invalid or too large |
| 400 | `INVALID_STATE_TRANSITION` | Status change not allowed |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 403 | `TENANT_MISMATCH` | Resource belongs to different tenant |
| 404 | `NOT_FOUND` | Resource does not exist |
| 404 | `EMPLOYEE_NOT_FOUND` | Employee ID not found |
| 404 | `CERTIFICATION_NOT_FOUND` | Certification ID not found |
| 404 | `PAY_RATE_NOT_FOUND` | Pay rate ID not found |
| 409 | `DUPLICATE_EMPLOYEE_NUMBER` | Employee number already exists |
| 409 | `CONCURRENT_MODIFICATION` | ETag mismatch, resource modified |
| 412 | `PRECONDITION_FAILED` | Required header missing (e.g., If-Match) |
| 422 | `BUSINESS_RULE_VIOLATION` | Operation violates business rules |
| 422 | `REHIRE_NOT_ELIGIBLE` | Employee not eligible for rehire |
| 422 | `CERT_ALREADY_VERIFIED` | Certification already verified |
| 422 | `RATE_CANNOT_BE_MODIFIED` | Active rate cannot be changed |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

### 11.2 Validation Error Detail Structure

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more validation errors occurred",
    "details": [
      {
        "field": "personalInfo.firstName",
        "code": "REQUIRED",
        "message": "First name is required"
      },
      {
        "field": "personalInfo.email",
        "code": "INVALID_FORMAT",
        "message": "Email must be a valid email address"
      },
      {
        "field": "hireDate",
        "code": "INVALID_DATE",
        "message": "Hire date cannot be more than 30 days in the future"
      }
    ]
  }
}
```

### 11.3 Business Rule Violation Detail

```json
{
  "error": {
    "code": "BUSINESS_RULE_VIOLATION",
    "message": "Cannot terminate employee",
    "details": [
      {
        "rule": "PENDING_TIME_ENTRIES",
        "message": "Employee has 3 unapproved time entries that must be resolved first"
      }
    ]
  }
}
```

---

## Appendix A: OpenAPI Specification

The complete OpenAPI 3.0 specification is available at:
```
GET /api/hr/openapi.json
GET /api/hr/swagger
```

## Appendix B: Event Catalog

All mutations publish domain events to the event store:

| Event | Trigger |
|-------|---------|
| `EmployeeCreated` | New employee added |
| `EmployeeUpdated` | Employee fields modified |
| `EmployeeStatusChanged` | Status transition |
| `EmployeeRehired` | New employment episode created |
| `CertificationAdded` | New cert added |
| `CertificationVerified` | Cert marked verified |
| `CertificationExpired` | Cert passed expiration date |
| `CertificationRevoked` | Cert manually revoked |
| `PayRateAdded` | New pay rate added |
| `PayRateExpired` | Pay rate expired |
| `WithholdingElectionAdded` | New W-4 or state withholding |
| `DeductionAdded` | New deduction added |
| `DeductionModified` | Deduction updated |
| `EEODataCollected` | EEO demographics submitted |

Events include:
- `eventId`: Unique event identifier
- `correlationId`: Request correlation ID
- `tenantId`: Tenant context
- `occurredAt`: Event timestamp
- `userId`: Acting user
- `payload`: Event-specific data

---

*This specification is designed for direct implementation. All endpoints follow existing Pitbull patterns and are optimized for AI agent automation with idempotency and determinism guarantees.*
