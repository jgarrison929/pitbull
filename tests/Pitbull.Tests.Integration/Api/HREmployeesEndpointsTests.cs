using System.Net;
using System.Net.Http.Json;
using Pitbull.HR.Domain;
using Pitbull.HR.Features;
using Pitbull.HR.Features.CreateEmployee;
using Pitbull.HR.Features.UpdateEmployee;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class HREmployeesEndpointsTests(PostgresFixture db) : IAsyncLifetime
{
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

    private static CreateEmployeeCommand CreateValidEmployeeCommand(string? empNumber = null) => new(
        EmployeeNumber: empNumber ?? $"EMP-{Guid.NewGuid():N}".Substring(0, 20),
        FirstName: "Test",
        LastName: "Employee",
        DateOfBirth: new DateOnly(1990, 1, 15),
        SSNEncrypted: "encrypted_ssn_value",
        SSNLast4: "1234",
        MiddleName: "Middle",
        Email: "test@example.com",
        Phone: "555-0100",
        AddressLine1: "123 Test St",
        City: "Test City",
        State: "CA",
        ZipCode: "90210",
        HireDate: DateOnly.FromDateTime(DateTime.UtcNow),
        WorkerType: WorkerType.Field,
        JobTitle: "Carpenter",
        TradeCode: "CARP",
        DefaultHourlyRate: 35.00m
    );

    [Fact]
    public async Task Get_hr_employees_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/hr/employees");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Can_create_get_and_list_hr_employees()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var create = CreateValidEmployeeCommand();

        var createResp = await client.PostAsJsonAsync("/api/hr/employees", create);
        if (createResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 201 Created but got {(int)createResp.StatusCode}. Body: {body}");
        }

        var created = (await createResp.Content.ReadFromJsonAsync<EmployeeDto>())!;
        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal(create.EmployeeNumber, created.EmployeeNumber);
        Assert.Equal(create.FirstName, created.FirstName);
        Assert.Equal(create.LastName, created.LastName);
        Assert.Equal(EmploymentStatus.Active, created.Status);

        // Get by ID
        var getResp = await client.GetAsync($"/api/hr/employees/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var fetched = (await getResp.Content.ReadFromJsonAsync<EmployeeDto>())!;
        Assert.Equal(created.Id, fetched.Id);
        Assert.Equal(created.EmployeeNumber, fetched.EmployeeNumber);

        // List
        var listResp = await client.GetAsync("/api/hr/employees");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains(created.EmployeeNumber, listJson);
    }

    [Fact]
    public async Task HR_employee_from_other_tenant_returns_404()
    {
        await db.ResetAsync();

        var (clientA, _, _) = await _factory.CreateAuthenticatedClientAsync();
        var (clientB, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var create = CreateValidEmployeeCommand();
        var createResp = await clientA.PostAsJsonAsync("/api/hr/employees", create);
        createResp.EnsureSuccessStatusCode();

        var created = (await createResp.Content.ReadFromJsonAsync<EmployeeDto>())!;

        // Other tenant can't access
        var getResp = await clientB.GetAsync($"/api/hr/employees/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Duplicate_employee_number_in_same_tenant_is_rejected()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var empNumber = $"EMP-DUP-{Guid.NewGuid():N}".Substring(0, 20);

        // Create first employee
        var create1 = CreateValidEmployeeCommand(empNumber);
        var resp1 = await client.PostAsJsonAsync("/api/hr/employees", create1);
        resp1.EnsureSuccessStatusCode();

        // Try to create duplicate
        var create2 = CreateValidEmployeeCommand(empNumber);
        var resp2 = await client.PostAsJsonAsync("/api/hr/employees", create2);

        // Should be rejected with Conflict (409)
        Assert.Equal(HttpStatusCode.Conflict, resp2.StatusCode);
    }

    [Fact]
    public async Task Can_update_hr_employee()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create employee
        var create = CreateValidEmployeeCommand();
        var createResp = await client.PostAsJsonAsync("/api/hr/employees", create);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<EmployeeDto>())!;

        // Update employee
        var update = new UpdateEmployeeCommand(
            Id: created.Id,
            FirstName: "Updated",
            LastName: "Name",
            Email: "updated@example.com",
            Phone: "555-9999",
            JobTitle: "Senior Carpenter",
            DefaultHourlyRate: 45.00m
        );

        var updateResp = await client.PutAsJsonAsync($"/api/hr/employees/{created.Id}", update);
        if (updateResp.StatusCode != HttpStatusCode.OK)
        {
            var body = await updateResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 200 OK but got {(int)updateResp.StatusCode}. Body: {body}");
        }

        var updated = (await updateResp.Content.ReadFromJsonAsync<EmployeeDto>())!;
        Assert.Equal("Updated", updated.FirstName);
        Assert.Equal("Name", updated.LastName);
        Assert.Equal("Senior Carpenter", updated.JobTitle);
    }

    [Fact]
    public async Task Can_delete_hr_employee_soft_delete()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create employee
        var create = CreateValidEmployeeCommand();
        var createResp = await client.PostAsJsonAsync("/api/hr/employees", create);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<EmployeeDto>())!;

        // Delete it
        var deleteResp = await client.DeleteAsync($"/api/hr/employees/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        // Soft-deleted employee should return 404 on GET
        var getResp = await client.GetAsync($"/api/hr/employees/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);

        // Soft-deleted employee should not appear in default list
        var listResp = await client.GetAsync("/api/hr/employees");
        listResp.EnsureSuccessStatusCode();
        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.DoesNotContain(created.EmployeeNumber, listJson);
    }

    [Fact]
    public async Task Can_filter_employees_by_worker_type()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create field worker
        var fieldEmp = CreateValidEmployeeCommand($"EMP-FIELD-{Guid.NewGuid():N}".Substring(0, 20)) 
            with { WorkerType = WorkerType.Field };
        var fieldResp = await client.PostAsJsonAsync("/api/hr/employees", fieldEmp);
        fieldResp.EnsureSuccessStatusCode();
        var field = (await fieldResp.Content.ReadFromJsonAsync<EmployeeDto>())!;

        // Create office worker
        var officeEmp = CreateValidEmployeeCommand($"EMP-OFF-{Guid.NewGuid():N}".Substring(0, 20)) 
            with { WorkerType = WorkerType.Office };
        var officeResp = await client.PostAsJsonAsync("/api/hr/employees", officeEmp);
        officeResp.EnsureSuccessStatusCode();
        var office = (await officeResp.Content.ReadFromJsonAsync<EmployeeDto>())!;

        // Filter by Field workers only
        var filteredResp = await client.GetAsync("/api/hr/employees?workerType=1"); // 1 = Field
        filteredResp.EnsureSuccessStatusCode();

        var filteredJson = await filteredResp.Content.ReadAsStringAsync();
        Assert.Contains(field.EmployeeNumber, filteredJson);
        Assert.DoesNotContain(office.EmployeeNumber, filteredJson);
    }

    [Fact]
    public async Task Can_search_employees_by_name()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create employee with unique name
        var uniqueName = $"Unique{Guid.NewGuid():N}".Substring(0, 10);
        var emp = CreateValidEmployeeCommand() with { FirstName = uniqueName };
        var createResp = await client.PostAsJsonAsync("/api/hr/employees", emp);
        createResp.EnsureSuccessStatusCode();

        // Search by unique name
        var searchResp = await client.GetAsync($"/api/hr/employees?search={uniqueName}");
        searchResp.EnsureSuccessStatusCode();

        var searchJson = await searchResp.Content.ReadAsStringAsync();
        Assert.Contains(uniqueName, searchJson);
    }
}
