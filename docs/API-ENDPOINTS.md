# Pitbull API Endpoint Reference

Complete reference for all Pitbull Construction Management API endpoints.

## Authentication

All endpoints (except registration and login) require a valid JWT bearer token.

```
Authorization: Bearer <your-jwt-token>
```

Tokens are obtained via `/api/auth/login` and include tenant isolation automatically.

---

## Table of Contents

- [Authentication](#authentication-1)
- [Projects](#projects)
- [Bids](#bids)
- [Employees](#employees)
- [Time Entries](#time-entries)
- [Project Assignments](#project-assignments)
- [Cost Codes](#cost-codes)
- [Subcontracts](#subcontracts)
- [Change Orders](#change-orders)
- [Payment Applications](#payment-applications)
- [RFIs](#rfis)
- [Dashboard](#dashboard)
- [Tenants](#tenants)
- [Admin - Users](#admin---users)
- [Admin - Company Settings](#admin---company-settings)
- [Admin - Audit Logs](#admin---audit-logs)
- [User Management](#user-management)
- [Monitoring](#monitoring)
- [Development](#development)

---

## Authentication

### Register User

```
POST /api/auth/register
```

Create a new user account. Optionally creates a new tenant (organization).

**Rate Limit:** 5 requests/hour per IP

**Request Body:**
```json
{
  "email": "john@acmeconstruction.com",
  "password": "SecurePass123",
  "firstName": "John",
  "lastName": "Doe",
  "companyName": "Acme Construction",
  "tenantId": "00000000-0000-0000-0000-000000000000"  // optional
}
```

**Response:** `201 Created`
```json
{
  "token": "REDACTED...",
  "userId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "fullName": "John Doe",
  "email": "john@acmeconstruction.com",
  "roles": ["Admin"]
}
```

---

### Login

```
POST /api/auth/login
```

Authenticate and receive a JWT token.

**Rate Limit:** 10 requests/minute per IP

**Request Body:**
```json
{
  "email": "john@acmeconstruction.com",
  "password": "SecurePass123"
}
```

**Response:** `200 OK`
```json
{
  "token": "REDACTED...",
  "userId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "fullName": "John Doe",
  "email": "john@acmeconstruction.com",
  "roles": ["Admin", "Manager"]
}
```

---

### Get Current User Profile

```
GET /api/auth/me
```

Returns the authenticated user's profile.

**Response:** `200 OK`
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "email": "john@acmeconstruction.com",
  "firstName": "John",
  "lastName": "Doe",
  "fullName": "John Doe",
  "roles": ["Admin", "Manager"],
  "tenantId": "3fa85f64-5717-4562-b3fc-2c963f66afa7",
  "tenantName": "Acme Construction",
  "createdAt": "2026-01-15T08:00:00Z",
  "lastLoginAt": "2026-02-11T17:00:00Z"
}
```

---

### Change Password

```
POST /api/auth/change-password
```

Change the current user's password.

**Request Body:**
```json
{
  "currentPassword": "OldPass123",
  "newPassword": "NewPass456"
}
```

**Response:** `200 OK`
```json
{
  "message": "Password changed successfully"
}
```

---

## Projects

### List Projects

```
GET /api/projects
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| status | string | - | Filter by status: `Active`, `Completed`, `OnHold`, `Bidding` |
| type | string | - | Filter by type: `Commercial`, `Residential`, `Industrial`, `Government` |
| search | string | - | Search name and project number |
| page | int | 1 | Page number |
| pageSize | int | 10 | Items per page (max 100) |

**Response:** `200 OK`
```json
{
  "items": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "Highway Bridge Renovation",
      "number": "PRJ-2026-001",
      "type": "Government",
      "status": "Active",
      "contractAmount": 2500000.00,
      "clientName": "State DOT",
      "startDate": "2026-03-01",
      "percentComplete": 45.5
    }
  ],
  "totalCount": 25,
  "page": 1,
  "pageSize": 10,
  "totalPages": 3
}
```

---

### Create Project

```
POST /api/projects
```

**Request Body:**
```json
{
  "name": "Highway Bridge Renovation",
  "number": "PRJ-2026-001",
  "type": 0,
  "contractAmount": 2500000.00,
  "clientName": "State DOT",
  "startDate": "2026-03-01"
}
```

> **Note:** Type is numeric: `0`=Commercial, `1`=Residential, `2`=Industrial, `3`=Government

**Response:** `201 Created`

---

### Get Project

```
GET /api/projects/{id}
```

**Response:** `200 OK` — Full project details

---

### Update Project

```
PUT /api/projects/{id}
```

**Request Body:** Full project object with `id` matching route

**Response:** `200 OK` — Updated project

---

### Delete Project

```
DELETE /api/projects/{id}
```

Soft delete. Returns `204 No Content`.

---

### Get Project Stats

```
GET /api/projects/{id}/stats
```

Returns quick metrics without AI analysis.

**Response:** `200 OK`
```json
{
  "totalHours": 1250.5,
  "regularHours": 1100.0,
  "overtimeHours": 120.5,
  "doubletimeHours": 30.0,
  "totalLaborCost": 87500.00,
  "timeEntryCount": 156,
  "approvedCount": 140,
  "pendingCount": 16,
  "employeeCount": 12,
  "firstEntryDate": "2026-03-01",
  "lastEntryDate": "2026-02-10"
}
```

---

### Get AI Project Summary

```
GET /api/projects/{id}/ai-summary
```

AI-powered analysis using Claude. Requires `ANTHROPIC_API_KEY`.

**Response:** `200 OK`
```json
{
  "success": true,
  "summary": "Project is progressing well...",
  "healthScore": 85,
  "healthStatus": "Good",
  "highlights": ["On schedule", "Under budget"],
  "concerns": ["High overtime this week"],
  "recommendations": ["Review crew scheduling"],
  "metrics": {
    "budgetUtilization": 0.45,
    "scheduleVariance": 0.02
  }
}
```

---

## Bids

### List Bids

```
GET /api/bids
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| status | string | - | Filter: `Draft`, `Submitted`, `Won`, `Lost`, `Withdrawn` |
| search | string | - | Search name and bid number |
| page | int | 1 | Page number |
| pageSize | int | 10 | Items per page (max 100) |

**Response:** `200 OK` — Paginated bid list

---

### Create Bid

```
POST /api/bids
```

**Request Body:**
```json
{
  "name": "Highway Bridge Estimate",
  "number": "BID-2026-005",
  "estimatedValue": 500000.00,
  "bidDate": "2026-02-15",
  "dueDate": "2026-03-01",
  "owner": "John Doe",
  "items": [
    {
      "description": "Concrete work",
      "category": 1,
      "quantity": 500,
      "unitCost": 125.00
    }
  ]
}
```

**Response:** `201 Created`

---

### Get Bid

```
GET /api/bids/{id}
```

Returns full bid with line items.

---

### Update Bid

```
PUT /api/bids/{id}
```

---

### Delete Bid

```
DELETE /api/bids/{id}
```

Soft delete. Returns `204 No Content`.

---

### Convert Bid to Project

```
POST /api/bids/{id}/convert-to-project
```

Converts a "Won" bid into a project.

**Request Body:**
```json
{
  "projectNumber": "PRJ-2026-010"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "projectId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "projectNumber": "PRJ-2026-010",
  "bidId": "3fa85f64-5717-4562-b3fc-2c963f66afa7"
}
```

---

## Employees

### List Employees

```
GET /api/employees
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| isActive | bool | true | Filter by active status |
| classification | int | - | `0`=Hourly, `1`=Salary, `2`=Contractor |
| search | string | - | Search name or employee number |
| page | int | 1 | Page number |
| pageSize | int | 50 | Items per page (max 100) |

**Response:** `200 OK` — Paginated employee list

---

### Create Employee

```
POST /api/employees
```

**Required Role:** Admin or Manager

**Request Body:**
```json
{
  "employeeNumber": "EMP-001",
  "firstName": "John",
  "lastName": "Smith",
  "email": "john.smith@example.com",
  "phone": "(555) 123-4567",
  "title": "Carpenter",
  "classification": 0,
  "baseHourlyRate": 45.00,
  "hireDate": "2026-01-15"
}
```

**Response:** `201 Created`

---

### Get Employee

```
GET /api/employees/{id}
```

---

### Update Employee

```
PUT /api/employees/{id}
```

**Required Role:** Admin or Manager

---

### Get Employee Projects

```
GET /api/employees/{id}/projects
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| activeOnly | bool | true | Only active assignments |

Returns projects the employee is assigned to.

---

### Get Employee Stats

```
GET /api/employees/{id}/stats
```

**Response:** `200 OK`
```json
{
  "totalHours": 480.0,
  "regularHours": 400.0,
  "overtimeHours": 60.0,
  "doubletimeHours": 20.0,
  "totalEarnings": 24000.00,
  "timeEntryCount": 60,
  "approvedCount": 55,
  "pendingCount": 5,
  "projectCount": 3,
  "firstEntryDate": "2026-01-15",
  "lastEntryDate": "2026-02-10"
}
```

---

## Time Entries

### List Time Entries

```
GET /api/time-entries
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| projectId | guid | - | Filter by project |
| employeeId | guid | - | Filter by employee |
| startDate | date | - | Entries on/after this date |
| endDate | date | - | Entries on/before this date |
| status | int | - | `0`=Draft, `1`=Submitted, `2`=Approved, `3`=Rejected |
| page | int | 1 | Page number |
| pageSize | int | 25 | Items per page (max 100) |

**Response:** `200 OK` — Paginated time entries

---

### Create Time Entry

```
POST /api/time-entries
```

**Request Body:**
```json
{
  "date": "2026-02-06",
  "employeeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "projectId": "3fa85f64-5717-4562-b3fc-2c963f66afa7",
  "costCodeId": "3fa85f64-5717-4562-b3fc-2c963f66afa8",
  "regularHours": 8.0,
  "overtimeHours": 2.0,
  "doubletimeHours": 0,
  "description": "Foundation formwork"
}
```

**Response:** `201 Created`

---

### Get Time Entry

```
GET /api/time-entries/{id}
```

---

### Update Time Entry

```
PUT /api/time-entries/{id}
```

**Request Body:**
```json
{
  "regularHours": 8.0,
  "overtimeHours": 1.5,
  "doubletimeHours": 0,
  "description": "Updated description",
  "newStatus": 1,
  "approverId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "approverNotes": "Approved"
}
```

---

### Approve Time Entry

```
POST /api/time-entries/{id}/approve
```

**Request Body:**
```json
{
  "approverId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "comments": "Looks good"
}
```

---

### Reject Time Entry

```
POST /api/time-entries/{id}/reject
```

**Request Body:**
```json
{
  "approverId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "reason": "Hours seem excessive, please clarify"
}
```

---

### Get Time Entries by Project

```
GET /api/time-entries/by-project/{projectId}
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| startDate | date | - | From date |
| endDate | date | - | To date |
| status | int | - | Filter by status |
| includeSummary | bool | false | Include hours/cost summary |
| page | int | 1 | Page number |
| pageSize | int | 50 | Items per page |

---

### Get Labor Cost Report

```
GET /api/time-entries/cost-report
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| projectId | guid | - | Filter to specific project |
| startDate | date | - | From date |
| endDate | date | - | To date |
| approvedOnly | bool | true | Only approved entries |

**Response:** `200 OK`
```json
{
  "totalBurdenedCost": 125000.00,
  "projects": [
    {
      "projectId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "projectName": "Highway Bridge",
      "totalHours": 1000.0,
      "baseWage": 50000.00,
      "burden": 17500.00,
      "totalCost": 67500.00,
      "costCodes": [
        {
          "costCodeId": "...",
          "code": "03-100",
          "description": "Concrete",
          "hours": 400.0,
          "cost": 27000.00
        }
      ]
    }
  ]
}
```

---

### Export Vista Timesheet

```
GET /api/time-entries/export/vista
```

**Required Role:** Admin or Manager

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| startDate | date | Yes | Start of export period |
| endDate | date | Yes | End of export period |
| projectId | guid | No | Filter to specific project |

**Response:** 
- `Content-Type: text/csv` — CSV file download
- `Content-Type: application/json` — Export metadata (if Accept header is JSON)

---

## Project Assignments

### Assign Employee to Project

```
POST /api/project-assignments
```

**Request Body:**
```json
{
  "employeeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "projectId": "3fa85f64-5717-4562-b3fc-2c963f66afa7",
  "role": 0,
  "startDate": "2026-02-01",
  "endDate": "2026-12-31",
  "notes": "Lead carpenter for foundation work"
}
```

> **Role values:** `0`=Worker, `1`=Foreman, `2`=Superintendent, `3`=ProjectManager

**Response:** `201 Created`

---

### Get Assignments by Project

```
GET /api/project-assignments/by-project/{projectId}
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| activeOnly | bool | true | Only active assignments |

---

### Get Assignments by Employee

```
GET /api/project-assignments/by-employee/{employeeId}
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| activeOnly | bool | true | Only active assignments |
| asOfDate | date | - | Check status as of date |

---

### Remove Assignment by ID

```
DELETE /api/project-assignments/{assignmentId}
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| endDate | date | today | End date for assignment |

Soft delete. Returns `204 No Content`.

---

### Remove Assignment by Employee/Project

```
DELETE /api/project-assignments
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| employeeId | guid | Yes | Employee ID |
| projectId | guid | Yes | Project ID |
| endDate | date | No | End date (defaults to today) |

Returns `204 No Content`.

---

## Cost Codes

### List Cost Codes

```
GET /api/cost-codes
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| costType | int | - | `0`=Labor, `1`=Material, `2`=Equipment, `3`=Subcontract |
| isActive | bool | true | Filter by active status |
| search | string | - | Search code or description |
| page | int | 1 | Page number |
| pageSize | int | 100 | Items per page |

**Response:** `200 OK`
```json
{
  "items": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "code": "03-100",
      "description": "Concrete Foundations",
      "division": "03",
      "costType": "Labor",
      "isActive": true
    }
  ],
  "totalCount": 150,
  "page": 1,
  "pageSize": 100,
  "totalPages": 2
}
```

---

### Get Cost Code

```
GET /api/cost-codes/{id}
```

---

## Subcontracts

### List Subcontracts

```
GET /api/subcontracts
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| projectId | guid | - | Filter by project |
| status | string | - | `Draft`, `Executed`, `InProgress`, `Complete`, `Terminated` |
| search | string | - | Search subcontractor name and number |
| page | int | 1 | Page number |
| pageSize | int | 20 | Items per page (max 100) |

---

### Create Subcontract

```
POST /api/subcontracts
```

**Request Body:**
```json
{
  "projectId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "subcontractNumber": "SC-2026-001",
  "subcontractorName": "ABC Concrete Inc",
  "scopeOfWork": "Concrete foundations and footings",
  "tradeCode": "03 - Concrete",
  "originalValue": 150000.00,
  "retainagePercent": 10
}
```

**Response:** `201 Created`

---

### Get Subcontract

```
GET /api/subcontracts/{id}
```

---

### Update Subcontract

```
PUT /api/subcontracts/{id}
```

---

### Delete Subcontract

```
DELETE /api/subcontracts/{id}
```

Soft delete (also deletes associated change orders). Returns `204 No Content`.

---

## Change Orders

### List Change Orders

```
GET /api/changeorders
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| subcontractId | guid | - | Filter by subcontract |
| status | string | - | `Pending`, `Approved`, `Rejected` |
| search | string | - | Search title and CO number |
| page | int | 1 | Page number |
| pageSize | int | 20 | Items per page (max 100) |

---

### Create Change Order

```
POST /api/changeorders
```

**Request Body:**
```json
{
  "subcontractId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "changeOrderNumber": "CO-001",
  "title": "Additional Foundation Work",
  "description": "Extended footings required due to soil conditions",
  "reason": "Field condition",
  "amount": 15000.00,
  "daysExtension": 5
}
```

**Response:** `201 Created`

---

### Get Change Order

```
GET /api/changeorders/{id}
```

---

### Update Change Order

```
PUT /api/changeorders/{id}
```

---

### Delete Change Order

```
DELETE /api/changeorders/{id}
```

Soft delete. Returns `204 No Content`.

---

## Payment Applications

### List Payment Applications

```
GET /api/paymentapplications
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| subcontractId | guid | - | Filter by subcontract |
| status | string | - | `Draft`, `Submitted`, `Approved`, `Paid` |
| page | int | 1 | Page number |
| pageSize | int | 20 | Items per page (max 100) |

---

### Create Payment Application

```
POST /api/paymentapplications
```

**Request Body:**
```json
{
  "subcontractId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "periodStart": "2026-02-01",
  "periodEnd": "2026-02-28",
  "workCompletedThisPeriod": 25000.00,
  "storedMaterials": 5000.00,
  "invoiceNumber": "INV-2026-001"
}
```

**Response:** `201 Created`

---

### Get Payment Application

```
GET /api/paymentapplications/{id}
```

---

### Update Payment Application

```
PUT /api/paymentapplications/{id}
```

---

### Delete Payment Application

```
DELETE /api/paymentapplications/{id}
```

Only draft applications can be deleted. Returns `204 No Content`.

---

## RFIs

RFIs are nested under projects: `/api/projects/{projectId}/rfis`

### List RFIs

```
GET /api/projects/{projectId}/rfis
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| status | string | - | `Open`, `Answered`, `Closed` |
| priority | string | - | `Low`, `Normal`, `High`, `Critical` |
| ballInCourtUserId | guid | - | Filter by assigned user |
| search | string | - | Search subject and question |
| page | int | 1 | Page number |
| pageSize | int | 25 | Items per page (max 100) |

---

### Create RFI

```
POST /api/projects/{projectId}/rfis
```

**Request Body:**
```json
{
  "subject": "Foundation Depth Clarification",
  "question": "Drawing A2.1 shows 36\" depth but specification calls for 42\". Please clarify.",
  "priority": "High",
  "dueDate": "2026-02-15",
  "ballInCourtName": "John Architect"
}
```

**Response:** `201 Created`

---

### Get RFI

```
GET /api/projects/{projectId}/rfis/{id}
```

---

### Update RFI

```
PUT /api/projects/{projectId}/rfis/{id}
```

**Request Body:**
```json
{
  "subject": "Foundation Depth Clarification",
  "question": "Drawing A2.1 shows 36\" depth but specification calls for 42\". Please clarify.",
  "answer": "Use specification depth of 42\". Drawing will be revised in next issue.",
  "status": "Answered",
  "priority": "High"
}
```

---

## Dashboard

### Get Dashboard Stats

```
GET /api/dashboard/stats
```

**Response:** `200 OK`
```json
{
  "projectCount": 12,
  "bidCount": 25,
  "totalProjectValue": 15000000.00,
  "totalBidValue": 8500000.00,
  "pendingChangeOrders": 3,
  "lastActivityDate": "2026-02-01T18:30:00Z"
}
```

---

### Get Weekly Hours

```
GET /api/dashboard/weekly-hours
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| weeks | int | 8 | Number of weeks (1-52) |

**Response:** `200 OK`
```json
{
  "data": [
    {
      "weekLabel": "Jan 6",
      "weekStart": "2026-01-06",
      "regularHours": 320.0,
      "overtimeHours": 45.5,
      "doubleTimeHours": 8.0,
      "totalHours": 373.5
    }
  ],
  "totalHours": 2988.0,
  "averageHoursPerWeek": 373.5
}
```

---

## Tenants

### Get Current Tenant

```
GET /api/tenants
```

Returns the current user's tenant information.

**Response:** `200 OK`
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "name": "Acme Construction LLC",
  "slug": "acme-construction-llc",
  "status": "Active",
  "plan": "Standard"
}
```

---

### Get Tenant by ID

```
GET /api/tenants/{id}
```

Only accessible for user's own tenant.

---

### Create Tenant

```
POST /api/tenants
```

**Required Role:** Admin

**Request Body:**
```json
{
  "name": "Acme Construction LLC"
}
```

**Response:** `201 Created`

---

## Admin - Users

All admin user endpoints require **Admin** role.

### List Users

```
GET /api/admin/users
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| search | string | - | Search name or email |
| role | string | - | Filter by role |
| isActive | bool | - | Filter by active status |

---

### Get User

```
GET /api/admin/users/{id}
```

---

### Update User

```
PUT /api/admin/users/{id}
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "status": "Active",
  "roles": ["Admin", "Manager"]
}
```

---

### Get Available Roles

```
GET /api/admin/users/roles
```

**Response:** `200 OK`
```json
[
  { "id": "...", "name": "Admin" },
  { "id": "...", "name": "Manager" },
  { "id": "...", "name": "Supervisor" },
  { "id": "...", "name": "User" }
]
```

---

### Bootstrap Admin

```
POST /api/admin/users/bootstrap-admin
```

One-time setup to make a user an admin. Works if no admin exists yet.

**Request Body:**
```json
{
  "email": "admin@company.com"
}
```

---

## Admin - Company Settings

**Required Role:** Admin

### Get Company Settings

```
GET /api/admin/company
```

**Response:** `200 OK`
```json
{
  "companyName": "Acme Construction",
  "timezone": "America/Los_Angeles",
  "dateFormat": "MM/dd/yyyy",
  "currency": "USD",
  "fiscalYearStartMonth": 1
}
```

---

### Update Company Settings

```
PUT /api/admin/company
```

**Request Body:**
```json
{
  "companyName": "Acme Construction",
  "logoUrl": "https://...",
  "primaryColor": "#1976d2",
  "address": "123 Main St",
  "city": "Los Angeles",
  "state": "CA",
  "zipCode": "90001",
  "phone": "(555) 123-4567",
  "website": "https://acme.com",
  "taxId": "12-3456789",
  "timezone": "America/Los_Angeles",
  "dateFormat": "MM/dd/yyyy",
  "currency": "USD",
  "fiscalYearStartMonth": 1
}
```

---

## Admin - Audit Logs

**Required Role:** Admin

### List Audit Logs

```
GET /api/admin/audit-logs
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| userId | guid | - | Filter by user |
| action | string | - | Filter by action type |
| resourceType | string | - | Filter by resource type |
| from | datetime | - | Start date |
| to | datetime | - | End date |
| success | bool | - | Filter by success status |
| page | int | 1 | Page number |
| pageSize | int | 50 | Items per page |

---

### Get Resource Types

```
GET /api/admin/audit-logs/resource-types
```

Returns available resource types for filtering.

---

### Get Actions

```
GET /api/admin/audit-logs/actions
```

Returns available action types for filtering.

---

## User Management

**Required Role:** Admin

### List Users

```
GET /api/users
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| search | string | - | Search name or email |
| page | int | 1 | Page number |
| pageSize | int | 20 | Items per page (max 100) |

---

### Get User

```
GET /api/users/{id}
```

---

### Assign Role to User

```
POST /api/users/{id}/roles
```

**Request Body:**
```json
{
  "role": "Manager"
}
```

---

### Remove Role from User

```
DELETE /api/users/{id}/roles/{role}
```

Cannot remove own Admin role.

---

### Get Available Roles

```
GET /api/users/roles
```

**Response:** `200 OK`
```json
[
  { "name": "Admin", "description": "Full system access..." },
  { "name": "Manager", "description": "Can manage projects..." },
  { "name": "Supervisor", "description": "Can approve time..." },
  { "name": "User", "description": "Basic access..." }
]
```

---

## Monitoring

### Get Version Info

```
GET /api/monitoring/version
```

**Response:** `200 OK`
```json
{
  "version": "1.0.0.0",
  "buildTime": "2026-02-11T12:00:00Z",
  "environment": "Production",
  "frameworkVersion": "9.0.0",
  "machineName": "server-01"
}
```

---

### Get Health Status

```
GET /api/monitoring/health
```

Returns detailed health status including database connectivity.

**Response:** `200 OK` or `503 Service Unavailable`

---

### Get Security Status

```
GET /api/monitoring/security
```

**Response:** `200 OK`
```json
{
  "rateLimitingEnabled": true,
  "httpsRedirection": true,
  "securityHeadersEnabled": true,
  "authenticationEnabled": true,
  "requestSizeLimitsEnabled": true
}
```

---

## Development

### Seed Demo Data

```
POST /api/seeddata
```

**Required Role:** Admin  
**Environment:** Development only (returns 404 in production)

Seeds realistic construction demo data. Idempotent per tenant.

**Response:** `200 OK`
```json
{
  "projectsCreated": 5,
  "bidsCreated": 10,
  "employeesCreated": 20,
  "timeEntriesCreated": 150
}
```

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

**Common HTTP Status Codes:**
| Code | Description |
|------|-------------|
| 400 | Bad Request - Validation failed |
| 401 | Unauthorized - Missing/invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 409 | Conflict - Duplicate or state conflict |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| POST /api/auth/register | 5/hour per IP |
| POST /api/auth/login | 10/minute per IP |
| All other endpoints | Standard API rate limit |
