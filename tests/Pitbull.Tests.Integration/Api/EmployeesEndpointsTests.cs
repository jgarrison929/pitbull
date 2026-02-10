using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

/// <summary>
/// Integration tests for /api/employees endpoints (TimeTracking module).
/// Tests auth, CRUD operations, filtering, search, and tenant isolation.
/// </summary>
[Collection(DatabaseCollection.Name)]
public sealed class EmployeesEndpointsTests(PostgresFixture db) : IAsyncLifetime
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };
    
    private PitbullApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        _factory = new PitbullApiFactory(db.AppConnectionString);

        using var client = _factory.CreateClient();
        var resp = await client.GetAsync("/health/live");
        resp.EnsureSuccessStatusCode();
    }

    public async Task DisposeAsync()
    {
        _factory.Dispose();
        await Task.CompletedTask;
    }

    #region Auth Tests

    [Fact]
    public async Task Get_employees_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/employees");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Create_employee_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber = "EMP-001",
            firstName = "Test",
            lastName = "User"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Update_employee_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.PutAsJsonAsync($"/api/employees/{Guid.NewGuid()}", new
        {
            firstName = "Test",
            lastName = "User"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    #endregion

    #region CRUD Tests

    [Fact]
    public async Task Can_create_employee_with_all_fields()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var employeeNumber = $"EMP-{Guid.NewGuid():N}"[..15];
        var createResp = await client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber,
            firstName = "John",
            lastName = "Carpenter",
            email = "john.carpenter@test.com",
            phone = "(555) 123-4567",
            title = "Senior Carpenter",
            classification = (int)EmployeeClassification.Hourly,
            baseHourlyRate = 45.00m,
            hireDate = "2026-01-15",
            notes = "Experienced framing specialist"
        });

        Assert.Equal(HttpStatusCode.Created, createResp.StatusCode);

        var created = await createResp.Content.ReadFromJsonAsync<EmployeeDto>(JsonOptions);
        Assert.NotNull(created);
        Assert.NotEqual(Guid.Empty, created!.Id);
        Assert.Equal(employeeNumber, created.EmployeeNumber);
        Assert.Equal("John", created.FirstName);
        Assert.Equal("Carpenter", created.LastName);
        Assert.Equal("john.carpenter@test.com", created.Email);
        Assert.Equal("(555) 123-4567", created.Phone);
        Assert.Equal("Senior Carpenter", created.Title);
        Assert.Equal(EmployeeClassification.Hourly, created.Classification);
        Assert.Equal(45.00m, created.BaseHourlyRate);
        Assert.True(created.IsActive);
    }

    [Fact]
    public async Task Can_get_employee_by_id()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create
        var employeeNumber = $"EMP-{Guid.NewGuid():N}"[..15];
        var createResp = await client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber,
            firstName = "GetTest",
            lastName = "Employee"
        });
        var created = (await createResp.Content.ReadFromJsonAsync<EmployeeDto>(JsonOptions))!;

        // Get
        var getResp = await client.GetAsync($"/api/employees/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var fetched = await getResp.Content.ReadFromJsonAsync<EmployeeDto>(JsonOptions);
        Assert.NotNull(fetched);
        Assert.Equal(created.Id, fetched!.Id);
        Assert.Equal("GetTest", fetched.FirstName);
    }

    [Fact]
    public async Task Can_list_employees()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create two employees
        await client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber = $"EMP-{Guid.NewGuid():N}"[..15],
            firstName = "List",
            lastName = "First"
        });
        await client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber = $"EMP-{Guid.NewGuid():N}"[..15],
            firstName = "List",
            lastName = "Second"
        });

        var listResp = await client.GetAsync("/api/employees");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains("List", listJson);
        Assert.Contains("First", listJson);
        Assert.Contains("Second", listJson);
    }

    [Fact]
    public async Task Can_update_employee()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create
        var employeeNumber = $"EMP-{Guid.NewGuid():N}"[..15];
        var createResp = await client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber,
            firstName = "Original",
            lastName = "Name",
            baseHourlyRate = 25.00m
        });
        var created = (await createResp.Content.ReadFromJsonAsync<EmployeeDto>(JsonOptions))!;

        // Update
        var updateResp = await client.PutAsJsonAsync($"/api/employees/{created.Id}", new
        {
            firstName = "Updated",
            lastName = "Name",
            baseHourlyRate = 30.00m,
            title = "Lead Carpenter"
        });

        Assert.Equal(HttpStatusCode.OK, updateResp.StatusCode);

        var updated = await updateResp.Content.ReadFromJsonAsync<EmployeeDto>(JsonOptions);
        Assert.NotNull(updated);
        Assert.Equal("Updated", updated!.FirstName);
        Assert.Equal(30.00m, updated.BaseHourlyRate);
        Assert.Equal("Lead Carpenter", updated.Title);
    }

    #endregion

    #region Error Handling Tests

    [Fact]
    public async Task Get_nonexistent_employee_returns_404()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync($"/api/employees/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Update_nonexistent_employee_returns_404()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.PutAsJsonAsync($"/api/employees/{Guid.NewGuid()}", new
        {
            firstName = "Test",
            lastName = "User"
        });

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Create_duplicate_employee_number_returns_409()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var employeeNumber = $"EMP-{Guid.NewGuid():N}"[..15];

        // Create first
        await client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber,
            firstName = "First",
            lastName = "Employee"
        });

        // Try duplicate
        var dupResp = await client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber, // Same number
            firstName = "Second",
            lastName = "Employee"
        });

        // Controller maps ErrorCode=="DUPLICATE" to 409 Conflict
        Assert.Equal(HttpStatusCode.Conflict, dupResp.StatusCode);
        var body = await dupResp.Content.ReadAsStringAsync();
        Assert.Contains("Employee number already exists", body);
    }

    #endregion

    #region Filtering & Search Tests

    [Fact]
    public async Task Can_filter_employees_by_active_status()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create active employee
        var activeEmpNum = $"ACT-{Guid.NewGuid():N}"[..15];
        await client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber = activeEmpNum,
            firstName = "Active",
            lastName = "Employee"
        });

        // Create and deactivate another
        var inactiveEmpNum = $"INA-{Guid.NewGuid():N}"[..15];
        var createResp = await client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber = inactiveEmpNum,
            firstName = "Inactive",
            lastName = "Employee"
        });
        var inactive = (await createResp.Content.ReadFromJsonAsync<EmployeeDto>(JsonOptions))!;

        await client.PutAsJsonAsync($"/api/employees/{inactive.Id}", new
        {
            firstName = "Inactive",
            lastName = "Employee",
            isActive = false
        });

        // Filter active only
        var activeResp = await client.GetAsync("/api/employees?isActive=true");
        var activeJson = await activeResp.Content.ReadAsStringAsync();
        Assert.Contains("Active", activeJson);
        Assert.DoesNotContain("Inactive", activeJson);

        // Filter inactive only
        var inactiveResp = await client.GetAsync("/api/employees?isActive=false");
        var inactiveJson = await inactiveResp.Content.ReadAsStringAsync();
        Assert.Contains("Inactive", inactiveJson);
        Assert.DoesNotContain(activeEmpNum, inactiveJson);
    }

    [Fact]
    public async Task Can_search_employees_by_name()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        await client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber = $"S1-{Guid.NewGuid():N}"[..15],
            firstName = "Alice",
            lastName = "Johnson"
        });
        await client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber = $"S2-{Guid.NewGuid():N}"[..15],
            firstName = "Bob",
            lastName = "Smith"
        });

        var searchResp = await client.GetAsync("/api/employees?search=Alice");
        var searchJson = await searchResp.Content.ReadAsStringAsync();

        Assert.Contains("Alice", searchJson);
        Assert.DoesNotContain("Bob", searchJson);
    }

    [Fact]
    public async Task Can_filter_employees_by_classification()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        await client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber = $"HR-{Guid.NewGuid():N}"[..15],
            firstName = "Hourly",
            lastName = "Worker",
            classification = (int)EmployeeClassification.Hourly
        });
        await client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber = $"SAL-{Guid.NewGuid():N}"[..15],
            firstName = "Salaried",
            lastName = "Manager",
            classification = (int)EmployeeClassification.Salaried
        });

        var hourlyResp = await client.GetAsync($"/api/employees?classification={(int)EmployeeClassification.Hourly}");
        var hourlyJson = await hourlyResp.Content.ReadAsStringAsync();

        Assert.Contains("Hourly", hourlyJson);
        Assert.DoesNotContain("Salaried", hourlyJson);
    }

    #endregion

    #region Tenant Isolation Tests

    [Fact]
    public async Task Employee_from_other_tenant_returns_404()
    {
        await db.ResetAsync();

        // Create two separate tenants
        var (clientA, _, _) = await _factory.CreateAuthenticatedClientAsync();
        var (clientB, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create employee in tenant A
        var createResp = await clientA.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber = $"ISO-{Guid.NewGuid():N}"[..15],
            firstName = "Isolated",
            lastName = "Employee"
        });
        var employee = (await createResp.Content.ReadFromJsonAsync<EmployeeDto>(JsonOptions))!;

        // Try to access from tenant B
        var getResp = await clientB.GetAsync($"/api/employees/{employee.Id}");

        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Cannot_update_employee_from_other_tenant()
    {
        await db.ResetAsync();

        // Create two separate tenants
        var (clientA, _, _) = await _factory.CreateAuthenticatedClientAsync();
        var (clientB, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create employee in tenant A
        var createResp = await clientA.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber = $"UPD-{Guid.NewGuid():N}"[..15],
            firstName = "TenantA",
            lastName = "Employee"
        });
        var employee = (await createResp.Content.ReadFromJsonAsync<EmployeeDto>(JsonOptions))!;

        // Try to update from tenant B
        var updateResp = await clientB.PutAsJsonAsync($"/api/employees/{employee.Id}", new
        {
            firstName = "Hacked",
            lastName = "Employee"
        });

        Assert.Equal(HttpStatusCode.NotFound, updateResp.StatusCode);
    }

    #endregion

    #region Stats Endpoint Tests

    [Fact]
    public async Task Can_get_employee_stats()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create employee
        var createResp = await client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber = $"STAT-{Guid.NewGuid():N}"[..15],
            firstName = "Stats",
            lastName = "Employee"
        });
        
        if (createResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 201 Created but got {(int)createResp.StatusCode}. Body: {body}");
        }
        
        var employee = (await createResp.Content.ReadFromJsonAsync<EmployeeDto>(JsonOptions))!;

        // Get stats
        var statsResp = await client.GetAsync($"/api/employees/{employee.Id}/stats");

        if (statsResp.StatusCode != HttpStatusCode.OK)
        {
            var body = await statsResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 200 OK but got {(int)statsResp.StatusCode}. Body: {body}");
        }

        var statsJson = await statsResp.Content.ReadAsStringAsync();
        // Verify response contains expected properties (camelCase JSON)
        Assert.Contains("regularHours", statsJson);
        Assert.Contains("totalHours", statsJson);
        Assert.Contains("employeeId", statsJson);
    }

    [Fact]
    public async Task Get_stats_for_nonexistent_employee_returns_404()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var statsResp = await client.GetAsync($"/api/employees/{Guid.NewGuid()}/stats");

        Assert.Equal(HttpStatusCode.NotFound, statsResp.StatusCode);
    }

    #endregion
}
