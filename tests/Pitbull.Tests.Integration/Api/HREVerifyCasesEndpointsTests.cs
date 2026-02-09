using System.Net;
using System.Net.Http.Json;
using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;
using Pitbull.HR.Features;
using Pitbull.HR.Features.CreateEmployee;
using Pitbull.HR.Features.CreateEVerifyCase;
using Pitbull.HR.Features.UpdateEVerifyCase;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class HREVerifyCasesEndpointsTests(PostgresFixture db) : IAsyncLifetime
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
        EmployeeNumber: empNumber ?? $"EMP-{Guid.NewGuid():N}"[..20],
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

    private static CreateEVerifyCaseCommand CreateValidEVerifyCaseCommand(Guid employeeId) => new(
        EmployeeId: employeeId,
        I9RecordId: null,
        CaseNumber: $"EVF-{Guid.NewGuid():N}"[..15],
        SubmittedDate: DateOnly.FromDateTime(DateTime.UtcNow),
        SubmittedBy: "HR Admin",
        Notes: "Initial E-Verify case submission"
    );

    private async Task<(HttpClient client, EmployeeDto employee)> CreateAuthenticatedClientWithEmployeeAsync()
    {
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();
        
        var empCmd = CreateValidEmployeeCommand();
        var empResp = await client.PostAsJsonAsync("/api/hr/employees", empCmd);
        empResp.EnsureSuccessStatusCode();
        var employee = (await empResp.Content.ReadFromJsonAsync<EmployeeDto>())!;
        
        return (client, employee);
    }

    [Fact]
    public async Task Get_everify_cases_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/hr/everify-cases");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Can_create_get_and_list_everify_cases()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        var create = CreateValidEVerifyCaseCommand(employee.Id);

        var createResp = await client.PostAsJsonAsync("/api/hr/everify-cases", create);
        if (createResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 201 Created but got {(int)createResp.StatusCode}. Body: {body}");
        }

        var created = (await createResp.Content.ReadFromJsonAsync<EVerifyCaseDto>())!;
        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal(employee.Id, created.EmployeeId);
        Assert.Equal("Pending", created.Status);
        Assert.Equal("HR Admin", created.SubmittedBy);

        // Get by ID
        var getResp = await client.GetAsync($"/api/hr/everify-cases/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var fetched = (await getResp.Content.ReadFromJsonAsync<EVerifyCaseDto>())!;
        Assert.Equal(created.Id, fetched.Id);

        // List all
        var listResp = await client.GetAsync("/api/hr/everify-cases");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains(created.Id.ToString(), listJson);
    }

    [Fact]
    public async Task EVerify_case_from_other_tenant_returns_404()
    {
        await db.ResetAsync();

        var (clientA, employeeA) = await CreateAuthenticatedClientWithEmployeeAsync();
        var (clientB, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var create = CreateValidEVerifyCaseCommand(employeeA.Id);
        var createResp = await clientA.PostAsJsonAsync("/api/hr/everify-cases", create);
        createResp.EnsureSuccessStatusCode();

        var created = (await createResp.Content.ReadFromJsonAsync<EVerifyCaseDto>())!;

        // Other tenant can't access
        var getResp = await clientB.GetAsync($"/api/hr/everify-cases/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Can_filter_everify_cases_by_employee()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create two employees
        var emp1Cmd = CreateValidEmployeeCommand($"EMP1-{Guid.NewGuid():N}"[..20]);
        var emp1Resp = await client.PostAsJsonAsync("/api/hr/employees", emp1Cmd);
        emp1Resp.EnsureSuccessStatusCode();
        var emp1 = (await emp1Resp.Content.ReadFromJsonAsync<EmployeeDto>())!;

        var emp2Cmd = CreateValidEmployeeCommand($"EMP2-{Guid.NewGuid():N}"[..20]);
        var emp2Resp = await client.PostAsJsonAsync("/api/hr/employees", emp2Cmd);
        emp2Resp.EnsureSuccessStatusCode();
        var emp2 = (await emp2Resp.Content.ReadFromJsonAsync<EmployeeDto>())!;

        // Create E-Verify cases for both
        var ev1 = CreateValidEVerifyCaseCommand(emp1.Id);
        var ev2 = CreateValidEVerifyCaseCommand(emp2.Id) with { SubmittedBy = "Payroll Admin" };

        var create1Resp = await client.PostAsJsonAsync("/api/hr/everify-cases", ev1);
        create1Resp.EnsureSuccessStatusCode();
        var create2Resp = await client.PostAsJsonAsync("/api/hr/everify-cases", ev2);
        create2Resp.EnsureSuccessStatusCode();

        // Filter by employee 1
        var filteredResp = await client.GetAsync($"/api/hr/everify-cases?employeeId={emp1.Id}");
        filteredResp.EnsureSuccessStatusCode();

        var filteredJson = await filteredResp.Content.ReadAsStringAsync();
        Assert.Contains(emp1.Id.ToString(), filteredJson);
        Assert.DoesNotContain(emp2.Id.ToString(), filteredJson);
    }

    [Fact]
    public async Task Can_get_cases_by_employee_endpoint()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create E-Verify case
        var create = CreateValidEVerifyCaseCommand(employee.Id);
        await client.PostAsJsonAsync("/api/hr/everify-cases", create);

        // Get by employee endpoint
        var listResp = await client.GetAsync($"/api/hr/everify-cases/employee/{employee.Id}");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains(employee.Id.ToString(), listJson);
    }

    [Fact]
    public async Task Can_get_needs_action_cases()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create E-Verify case
        var create = CreateValidEVerifyCaseCommand(employee.Id);
        await client.PostAsJsonAsync("/api/hr/everify-cases", create);

        // Get needs-action endpoint (new pending cases may or may not appear depending on logic)
        var listResp = await client.GetAsync("/api/hr/everify-cases/needs-action");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);
    }

    [Fact]
    public async Task Can_update_everify_case_status()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create E-Verify case
        var create = CreateValidEVerifyCaseCommand(employee.Id);
        var createResp = await client.PostAsJsonAsync("/api/hr/everify-cases", create);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<EVerifyCaseDto>())!;

        // Update to Employment Authorized
        var update = new UpdateEVerifyCaseCommand(
            Id: created.Id,
            Status: EVerifyStatus.EmploymentAuthorized,
            Result: EVerifyResult.EmploymentAuthorized,
            LastStatusDate: DateOnly.FromDateTime(DateTime.UtcNow),
            ClosedDate: DateOnly.FromDateTime(DateTime.UtcNow),
            TNCDeadline: null,
            TNCContested: null,
            PhotoMatched: true,
            SSAResult: EVerifySSAResult.SSAMatch,
            DHSResult: EVerifyDHSResult.DHSMatch,
            Notes: "Verified - employment authorized"
        );

        var updateResp = await client.PutAsJsonAsync($"/api/hr/everify-cases/{created.Id}", update);
        if (updateResp.StatusCode != HttpStatusCode.OK)
        {
            var body = await updateResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 200 OK but got {(int)updateResp.StatusCode}. Body: {body}");
        }

        var updated = (await updateResp.Content.ReadFromJsonAsync<EVerifyCaseDto>())!;
        Assert.Equal("EmploymentAuthorized", updated.Status);
        Assert.Equal("EmploymentAuthorized", updated.Result);
        Assert.True(updated.PhotoMatched);
    }

    [Fact]
    public async Task Can_delete_everify_case()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create E-Verify case
        var create = CreateValidEVerifyCaseCommand(employee.Id);
        var createResp = await client.PostAsJsonAsync("/api/hr/everify-cases", create);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<EVerifyCaseDto>())!;

        // Delete it
        var deleteResp = await client.DeleteAsync($"/api/hr/everify-cases/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        // Deleted should return 404 on GET
        var getResp = await client.GetAsync($"/api/hr/everify-cases/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Cannot_create_everify_case_for_nonexistent_employee()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var create = CreateValidEVerifyCaseCommand(Guid.NewGuid()); // Non-existent employee

        var createResp = await client.PostAsJsonAsync("/api/hr/everify-cases", create);
        Assert.Equal(HttpStatusCode.NotFound, createResp.StatusCode);
    }
}
