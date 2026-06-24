# API Developer Quickstart Guide

**Note:** This is a general guide. API surface has expanded significantly (see CHANGELOG for 0.14–0.15 additions). For exact current endpoints/DTOs use Swagger or read controller code + corresponding DTOs. Base patterns (JWT, tenant isolation, rate limits, PagedResult) remain valid.

---

## Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
- [Making Requests](#making-requests)
- [API Reference](#api-reference)
- [Common Patterns](#common-patterns)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)
- [Multi-Tenancy](#multi-tenancy)
- [Examples](#examples)

---

## Base URL

| Environment | URL |
|-------------|-----|
| Local Development | `http://localhost:5000/api` |
| Production | `https://your-api-host.example.com/api` (self-hosted) |

**Interactive Docs:** Swagger UI is available at `/swagger` in all environments.

---

## Authentication

The API uses JWT Bearer tokens. All endpoints (except `/api/auth/*`) require authentication.

### 1. Register a New Account

```bash
curl -X POST https://api.example.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@acmeconstruction.com",
    "password": "SecurePass123",
    "firstName": "John",
    "lastName": "Doe",
    "companyName": "Acme Construction"
  }'
```

**Response:**
```json
{
  "token": "REDACTED",
  "userId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "fullName": "John Doe",
  "email": "john@acmeconstruction.com",
  "roles": ["Admin"]
}
```

### 2. Log In

```bash
curl -X POST https://api.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@acmeconstruction.com",
    "password": "SecurePass123"
  }'
```

### 3. Use the Token

Include the token in the `Authorization` header for all subsequent requests:

```bash
curl https://api.example.com/api/projects \
  -H "Authorization: Bearer REDACTED"
```

### Token Contents (JWT Claims)

| Claim | Description |
|-------|-------------|
| `sub` | User ID (GUID) |
| `email` | User's email address |
| `tenant_id` | Tenant/organization ID |
| `full_name` | User's display name |
| `user_type` | Internal user type |
| `role` | User's role(s): Admin, Manager, Supervisor, User |

**Token expiration:** Default is 60 minutes. Refresh by calling `/api/auth/login` again.

---

## Making Requests

### Content Types

- **Request:** `Content-Type: application/json`
- **Response:** `application/json`

### Standard Headers

```http
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json
```

---

## API Reference

### Core Resources

| Resource | Endpoints | Description |
|----------|-----------|-------------|
| **Auth** | `/api/auth/*` | Registration, login, profile |
| **Projects** | `/api/projects` | Construction projects |
| **Bids** | `/api/bids` | Bid/estimate tracking |
| **Time Entries** | `/api/timeentries` | Labor time tracking |
| **Employees** | `/api/employees` | Workforce management |
| **Cost Codes** | `/api/costcodes` | Job cost code library |
| **RFIs** | `/api/rfis` | Requests for Information |
| **Subcontracts** | `/api/subcontracts` | Subcontractor agreements |
| **Change Orders** | `/api/changeorders` | Contract modifications |
| **Payment Apps** | `/api/paymentapplications` | Progress billing (AIA G702) |

### Standard Operations

Every resource supports standard CRUD operations:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/{resource}` | List with pagination/filtering |
| `GET` | `/api/{resource}/{id}` | Get single item by ID |
| `POST` | `/api/{resource}` | Create new item |
| `PUT` | `/api/{resource}/{id}` | Update existing item |
| `DELETE` | `/api/{resource}/{id}` | Soft delete item |

---

## Common Patterns

### Pagination

All list endpoints return paginated results:

```bash
GET /api/projects?page=1&pageSize=25
```

**Response:**
```json
{
  "items": [...],
  "page": 1,
  "pageSize": 25,
  "totalCount": 142,
  "totalPages": 6,
  "hasNextPage": true,
  "hasPreviousPage": false
}
```

**Parameters:**
- `page` - Page number (default: 1)
- `pageSize` - Items per page (default: 10, max: 100)

### Filtering

Filter by status, type, or search text:

```bash
# Filter by status
GET /api/projects?status=Active

# Filter by type
GET /api/projects?type=Commercial

# Free-text search
GET /api/projects?search=highway

# Combine filters
GET /api/projects?status=Active&type=Commercial&search=highway&page=1&pageSize=25
```

### Enum Values

Enum values can be passed as either strings or integers:

| Type | String Values | Integer Values |
|------|---------------|----------------|
| ProjectStatus | `Active`, `Completed`, `OnHold`, `Cancelled` | 0, 1, 2, 3 |
| ProjectType | `Commercial`, `Residential`, `Industrial`, `Infrastructure` | 0, 1, 2, 3 |
| TimeEntryStatus | `Draft`, `Submitted`, `Approved`, `Rejected` | 0, 1, 2, 3 |
| BidStatus | `Prospect`, `Invited`, `Estimating`, `Submitted`, `Won`, `Lost`, `NoGo` | 0, 1, 2, 3, 4, 5, 6 |

**Note:** JSON request bodies use integer values by default with System.Text.Json. Query parameters accept both formats.

---

## Error Handling

### Error Response Format

All errors return a consistent JSON structure:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "errors": {
    "fieldName": ["Validation error 1", "Validation error 2"]
  }
}
```

### HTTP Status Codes

| Code | Meaning | When It Happens |
|------|---------|-----------------|
| 200 | OK | Successful GET/PUT |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Validation failed, business rule violated |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist or not in your tenant |
| 409 | Conflict | Concurrent modification (optimistic locking) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Unexpected error (report as bug) |

### Common Error Codes

| Code | Description |
|------|-------------|
| `NOT_FOUND` | Resource doesn't exist |
| `VALIDATION_ERROR` | Request failed validation |
| `DUPLICATE` | Unique constraint violated (e.g., duplicate project number) |
| `INVALID_STATUS` | Invalid status transition |
| `INVALID_TRANSITION` | Business rule prevents state change |
| `UNAUTHORIZED` | User lacks permission for this action |
| `CONFLICT` | Optimistic concurrency conflict |
| `ALREADY_APPROVED` | Cannot modify approved record |

---

## Rate Limits

Rate limiting protects the API from abuse:

| Endpoint | Limit |
|----------|-------|
| `/api/auth/register` | 5 requests/hour/IP |
| `/api/auth/login` | 10 requests/minute/IP |
| All other endpoints | 100 requests/minute/user |

When rate limited, you'll receive a `429 Too Many Requests` response with a `Retry-After` header.

---

## Multi-Tenancy

Pitbull is a multi-tenant SaaS application. Key points:

1. **Automatic Scoping:** All queries are automatically filtered by your tenant ID (from the JWT)
2. **Data Isolation:** You can only see/modify data belonging to your organization
3. **No Cross-Tenant Access:** Even with a valid ID, you cannot access another tenant's data (returns 404)

The tenant ID is embedded in your JWT token and applied automatically — you never need to specify it in requests.

---

## Examples

### Create a Project

```bash
curl -X POST https://api.example.com/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Downtown Office Tower",
    "number": "PRJ-2026-042",
    "type": 0,
    "status": 0,
    "contractAmount": 15000000.00,
    "clientName": "Apex Development Corp",
    "clientContact": "Demo Contact",
    "address": "123 Main Street",
    "city": "Seattle",
    "state": "WA",
    "startDate": "2026-03-15",
    "estimatedEndDate": "2027-06-30"
  }'
```

### Record Time Entry

```bash
curl -X POST https://api.example.com/api/timeentries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "projectId": "8b7c9d1e-2f3a-4b5c-6d7e-8f9a0b1c2d3e",
    "costCodeId": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "date": "2026-02-11",
    "regularHours": 8.0,
    "overtimeHours": 1.5,
    "notes": "Poured foundation section A"
  }'
```

### List Time Entries for a Project

```bash
curl "https://api.example.com/api/timeentries?projectId=8b7c9d1e-2f3a-4b5c-6d7e-8f9a0b1c2d3e&status=Submitted" \
  -H "Authorization: Bearer $TOKEN"
```

### Approve a Time Entry

```bash
curl -X POST https://api.example.com/api/timeentries/approve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "timeEntryId": "abc12345-6789-0def-ghij-klmnopqrstuv",
    "approvedById": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "comments": "Verified on-site"
  }'
```

### Get AI-Powered Project Insights

```bash
curl https://api.example.com/api/projects/8b7c9d1e-2f3a-4b5c-6d7e-8f9a0b1c2d3e/ai-summary \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "success": true,
  "projectId": "8b7c9d1e-2f3a-4b5c-6d7e-8f9a0b1c2d3e",
  "projectName": "Downtown Office Tower",
  "healthScore": 78,
  "healthStatus": "Good",
  "summary": "Project is progressing well with strong labor utilization...",
  "highlights": [
    "Time entries are being submitted promptly",
    "Labor costs are within budget"
  ],
  "concerns": [
    "3 time entries pending approval for over 5 days"
  ],
  "recommendations": [
    "Review and approve pending time entries to maintain workflow"
  ],
  "metrics": {
    "totalHoursLogged": 1250.5,
    "totalLaborCost": 62525.00,
    "budgetUtilization": 0.42,
    "pendingApprovals": 3
  }
}
```

---

## SDK / Client Libraries

Currently there are no official SDKs. The API follows RESTful conventions and works with any HTTP client.

**Recommended approaches:**
- **TypeScript/JavaScript:** Use the `fetch` API or Axios
- **C#/.NET:** Use `HttpClient` with `System.Text.Json`
- **Python:** Use `requests` library

---

## Getting Help

- **Swagger UI:** Interactive API docs at `/swagger`
- **Source Code:** [GitHub Repository](https://github.com/jgarrison929/pitbull)
- **Issues:** Report bugs via GitHub Issues

---

## Changelog

See [CHANGELOG.md](../CHANGELOG.md) for version history and API changes.
