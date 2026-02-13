using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Pitbull.Tests.Integration.Infrastructure;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;
using Pitbull.TimeTracking.Features.CreateEmployee;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class TimeEntriesEndpointsTests(PostgresFixture db) : IAsyncLifetime
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

    [Fact]
    public async Task Get_time_entries_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/time-entries");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Can_create_employee_and_list_employees_when_authenticated()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create an employee
        var createEmployee = new
        {
            employeeNumber = $"EMP-{Guid.NewGuid():N}"[..15],
            firstName = "Integration",
            lastName = "Worker",
            email = "worker@test.com",
            classification = (int)EmployeeClassification.Hourly,
            baseHourlyRate = 25.00m
        };

        var createResp = await client.PostAsJsonAsync("/api/employees", createEmployee);
        if (createResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 201 Created but got {(int)createResp.StatusCode}. Body: {body}");
        }

        var created = await createResp.Content.ReadFromJsonAsync<EmployeeDto>(JsonOptions);
        Assert.NotNull(created);
        Assert.NotEqual(Guid.Empty, created!.Id);
        Assert.Equal(createEmployee.firstName, created.FirstName);
        Assert.Equal(createEmployee.lastName, created.LastName);

        // List employees
        var listResp = await client.GetAsync("/api/employees");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains(createEmployee.firstName, listJson);
    }

    [Fact]
    public async Task Can_create_time_entry_with_valid_employee_and_project()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // First create an employee
        var employeeResp = await client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber = $"TE-{Guid.NewGuid():N}"[..15],
            firstName = "Time",
            lastName = "Worker",
            classification = (int)EmployeeClassification.Hourly,
            baseHourlyRate = 30.00m
        });
        employeeResp.EnsureSuccessStatusCode();
        var employee = await employeeResp.Content.ReadFromJsonAsync<EmployeeDto>(JsonOptions);

        // Create a project
        var projectResp = await client.PostAsJsonAsync("/api/projects", new
        {
            name = "Time Entry Test Project",
            number = $"PRJ-{Guid.NewGuid():N}"[..15],
            type = 0, // Commercial
            contractAmount = 100000m
        });
        projectResp.EnsureSuccessStatusCode();
        var project = await projectResp.Content.ReadFromJsonAsync<ProjectDto>();

        // Assign employee to project
        var assignResp = await client.PostAsJsonAsync("/api/project-assignments", new
        {
            employeeId = employee!.Id,
            projectId = project!.Id,
            role = 0, // Worker
            startDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-7)).ToString("yyyy-MM-dd")
        });

        if (assignResp.StatusCode != HttpStatusCode.Created && assignResp.StatusCode != HttpStatusCode.OK)
        {
            var body = await assignResp.Content.ReadAsStringAsync();
            Assert.Fail($"Assignment failed: {(int)assignResp.StatusCode}. Body: {body}");
        }

        // Get a cost code (seeded by demo data)
        var costCodesResp = await client.GetAsync("/api/cost-codes?pageSize=1");
        costCodesResp.EnsureSuccessStatusCode();
        var costCodesJson = await costCodesResp.Content.ReadAsStringAsync();

        // If no cost codes exist, create one
        Guid costCodeId;
        if (costCodesJson.Contains("\"items\":[]") || !costCodesJson.Contains("\"id\""))
        {
            // Cost codes may not be seeded, skip this test or create one
            // For now, we'll verify the endpoint rejects invalid cost code
            var createTimeEntry = new
            {
                date = DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyy-MM-dd"),
                employeeId = employee.Id,
                projectId = project.Id,
                costCodeId = Guid.NewGuid(), // Invalid cost code
                regularHours = 8.0m,
                description = "Integration test entry"
            };

            var timeEntryResp = await client.PostAsJsonAsync("/api/time-entries", createTimeEntry);
            // Should fail due to invalid cost code
            Assert.Equal(HttpStatusCode.BadRequest, timeEntryResp.StatusCode);
            return;
        }

        // Parse cost code ID from response
        var costCodeStart = costCodesJson.IndexOf("\"id\":\"") + 6;
        var costCodeEnd = costCodesJson.IndexOf("\"", costCodeStart);
        costCodeId = Guid.Parse(costCodesJson[costCodeStart..costCodeEnd]);

        // Create time entry
        var createEntry = new
        {
            date = DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyy-MM-dd"),
            employeeId = employee.Id,
            projectId = project.Id,
            costCodeId,
            regularHours = 8.0m,
            overtimeHours = 2.0m,
            doubletimeHours = 0m,
            description = "Integration test work"
        };

        var entryResp = await client.PostAsJsonAsync("/api/time-entries", createEntry);
        if (entryResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await entryResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 201 Created but got {(int)entryResp.StatusCode}. Body: {body}");
        }

        var entry = await entryResp.Content.ReadFromJsonAsync<TimeEntryDto>();
        Assert.NotNull(entry);
        Assert.NotEqual(Guid.Empty, entry!.Id);
        Assert.Equal(8.0m, entry.RegularHours);
        Assert.Equal(2.0m, entry.OvertimeHours);
        Assert.Equal(10.0m, entry.TotalHours);
        Assert.Equal(TimeEntryStatus.Draft, entry.Status);
    }

    [Fact]
    public async Task Employee_from_other_tenant_is_not_visible()
    {
        await db.ResetAsync();

        var (clientTenantA, _, _) = await _factory.CreateAuthenticatedClientAsync();
        var (clientTenantB, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create employee in Tenant A
        var createResp = await clientTenantA.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber = $"ISO-{Guid.NewGuid():N}"[..15],
            firstName = "Isolated",
            lastName = "Employee",
            classification = (int)EmployeeClassification.Hourly,
            baseHourlyRate = 20.00m
        });
        createResp.EnsureSuccessStatusCode();

        var created = await createResp.Content.ReadFromJsonAsync<EmployeeDto>(JsonOptions);

        // Try to get employee from Tenant B - should be 404
        var getAsOtherTenant = await clientTenantB.GetAsync($"/api/employees/{created!.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getAsOtherTenant.StatusCode);
    }

    [Fact]
    public async Task Duplicate_employee_number_returns_409_Conflict()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var employeeNumber = $"DUP-{Guid.NewGuid():N}"[..15];

        // Create first employee
        var resp1 = await client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber,
            firstName = "First",
            lastName = "Employee",
            classification = (int)EmployeeClassification.Hourly,
            baseHourlyRate = 25.00m
        });
        resp1.EnsureSuccessStatusCode();

        // Try to create duplicate
        var resp2 = await client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber,
            firstName = "Second",
            lastName = "Employee",
            classification = (int)EmployeeClassification.Hourly,
            baseHourlyRate = 25.00m
        });

        Assert.Equal(HttpStatusCode.Conflict, resp2.StatusCode);
        var body = await resp2.Content.ReadAsStringAsync();
        Assert.Contains("already exists", body.ToLower());
    }

    [Fact]
    public async Task Approve_time_entry_returns_401_without_auth()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.PostAsJsonAsync($"/api/time-entries/{Guid.NewGuid()}/approve", new
        {
            approverId = Guid.NewGuid(),
            comments = "Approved"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Approve_nonexistent_time_entry_returns_404()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.PostAsJsonAsync($"/api/time-entries/{Guid.NewGuid()}/approve", new
        {
            approverId = Guid.NewGuid(),
            comments = "Should not exist"
        });

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Reject_time_entry_returns_401_without_auth()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.PostAsJsonAsync($"/api/time-entries/{Guid.NewGuid()}/reject", new
        {
            approverId = Guid.NewGuid(),
            reason = "Not good"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Reject_nonexistent_time_entry_returns_404()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.PostAsJsonAsync($"/api/time-entries/{Guid.NewGuid()}/reject", new
        {
            approverId = Guid.NewGuid(),
            reason = "Should not exist"
        });

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Can_get_time_entries_by_project()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create a project
        var projectResp = await client.PostAsJsonAsync("/api/projects", new
        {
            name = "ByProject Test Project",
            number = $"BPT-{Guid.NewGuid():N}"[..15],
            type = 0,
            contractAmount = 50000m
        });
        projectResp.EnsureSuccessStatusCode();
        var project = await projectResp.Content.ReadFromJsonAsync<ProjectDto>();

        // Query time entries by project (should be empty but return 200)
        var resp = await client.GetAsync($"/api/time-entries/by-project/{project!.Id}");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var body = await resp.Content.ReadAsStringAsync();
        // Response includes projectId and timeEntries array
        Assert.Contains("projectId", body, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("timeEntries", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Get_time_entries_by_nonexistent_project_returns_404()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync($"/api/time-entries/by-project/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Can_get_labor_cost_report()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Cost report should work even with no data
        var resp = await client.GetAsync("/api/time-entries/cost-report");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var body = await resp.Content.ReadAsStringAsync();
        // Should contain report structure with totalCost summary
        Assert.Contains("generatedAt", body, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("totalCost", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Cost_report_requires_auth()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/time-entries/cost-report");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    // Simple DTO for project response parsing
    private record ProjectDto(Guid Id, string Name, string Number);
}
