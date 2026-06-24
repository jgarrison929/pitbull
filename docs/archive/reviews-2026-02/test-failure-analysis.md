# Test Failure Analysis: Commit df2c592

**Reviewer:** Gemini CLI Agent
**Date:** 2026-02-16

---

### 1. Summary

**Finding:** The 198 test failures reported for commit `df2c592` in the `Pitbull.Tests.Unit` project could not be reproduced in the current test execution environment. Both the unit test suite and the integration test suite completed with **0 failures**.

**Diagnosis:** The root cause of this discrepancy is almost certainly an **environment-dependent test setup**. The unit tests are configured to run against an in-memory database provider, while the failures seen by the user are characteristic of tests running against a real PostgreSQL database with Row-Level Security (RLS) policies enabled.

---

### 2. Evidence and Analysis

#### 2.1 Test Execution Results

-   **`dotnet test tests/Pitbull.Tests.Unit/`**:
    -   **Result:** `Passed: 1365`, `Failed: 0`, `Skipped: 2`
-   **`dotnet test tests/Pitbull.Tests.Integration/`**:
    -   **Result:** `Passed: 248`, `Failed: 0`, `Skipped: 0`

These results confirm that in an environment using the default in-memory provider, the tests pass.

#### 2.2 Key Log Messages

Running the unit tests with normal verbosity revealed numerous `DEBUG` messages that pinpoint the issue:

```
[DEBUG] Could not set PostgreSQL session variable: Relational-specific methods can only be used when the context is using a relational database provider.
```

This log entry appears repeatedly throughout the test run. It indicates that code within the services or DbContext setup is attempting to execute PostgreSQL-specific commands (likely `SET app.current_tenant_id = ...` or similar, to activate RLS policies). Because the tests are running against a non-relational in-memory provider, these commands fail silently (as a DEBUG log), and the tests proceed without the security policies being enforced.

#### 2.3 Skipped Tests

The test runner explicitly skips two tests with a revealing message:

```
[xUnit.net 00:00:01.41] Pitbull.Tests.Unit.MultiCompany.CompanyIsolationTests.CrossTenant_CompanyIsolation_StillWorks [SKIP]
[xUnit.net 00:00:01.41] Company query filters use Expression.Constant(this) which doesn't work across InMemory DbContext instances. Verified via integration tests with PostgreSQL RLS.
```

This explicitly states that some tests are incompatible with the in-memory provider and are skipped, with the verification deferred to integration tests that use PostgreSQL.

---

### 3. Inferred Pattern of Failures

Based on the evidence, the 198 test failures seen in the other environment likely follow this pattern:

1.  **The Test Environment**: The tests are being run against a live PostgreSQL database where RLS policies are active.
2.  **Test Setup**: A test creates data across different tenants or companies (e.g., Tenant A and Tenant B).
3.  **Service Call**: The test calls a service method to list or retrieve data (e.g., `ListProjectsAsync`, `GetEmployeeStatsAsync`).
4.  **RLS Policy Enforcement**: The DbContext sets the current tenant context (e.g., to Tenant A) for the database session. The PostgreSQL RLS policy is activated and filters all queries to return only data for Tenant A.
5.  **Assertion Failure**: The test, which has access to the in-memory `DbContext` and can "see" data for both Tenant A and Tenant B, asserts that a certain number of records should be returned or that a specific record from Tenant B should be accessible/inaccessible. Because the database query was filtered by RLS, the service method returns fewer records than the test expects, or fails to find a record it expects to be there, causing the assertion to fail.

The failures are likely concentrated in tests for services that perform reads across multiple entities, especially within the `MultiCompany` and `Authorization` test suites, and any service tests that rely on cross-tenant or cross-company data setup.

### 4. Conclusion

No action should be taken to "fix" the tests within the `Pitbull.Tests.Unit` project in its current configuration. The tests are passing as expected given the limitations of the in-memory database.

The failures reported by the user are valid and indicate that a recent change in commit `df2c592` (or a preceding commit) has broken the logic that works in conjunction with PostgreSQL RLS policies. The development team (`Claude Code`) is correctly focused on fixing the application logic on `main` to work with the real database environment, not on altering the tests to pass against an in-memory provider.
