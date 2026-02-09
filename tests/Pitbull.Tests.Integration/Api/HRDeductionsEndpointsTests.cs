using System.Net;
using System.Net.Http.Json;
using Pitbull.HR.Domain;
using Pitbull.HR.Features;
using Pitbull.HR.Features.CreateEmployee;
using Pitbull.HR.Features.CreateDeduction;
using Pitbull.HR.Features.UpdateDeduction;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class HRDeductionsEndpointsTests(PostgresFixture db) : IAsyncLifetime
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

    private static CreateDeductionCommand CreateValidDeductionCommand(Guid employeeId, string? code = null) => new(
        EmployeeId: employeeId,
        DeductionCode: code ?? "401K",
        Description: "401K Contribution",
        Method: DeductionMethod.PercentOfGross,
        Amount: 6.00m,
        MaxPerPeriod: 500.00m,
        AnnualMax: 23000.00m,
        Priority: 10,
        IsPreTax: true,
        EmployerMatch: 50.00m,
        EmployerMatchMax: 3.00m,
        EffectiveDate: DateOnly.FromDateTime(DateTime.UtcNow),
        CaseNumber: null,
        GarnishmentPayee: null,
        Notes: "Standard 401K enrollment"
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
    public async Task Get_deductions_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/hr/deductions");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Can_create_get_and_list_deductions()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        var create = CreateValidDeductionCommand(employee.Id);

        var createResp = await client.PostAsJsonAsync("/api/hr/deductions", create);
        if (createResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 201 Created but got {(int)createResp.StatusCode}. Body: {body}");
        }

        var created = (await createResp.Content.ReadFromJsonAsync<DeductionDto>())!;
        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal(employee.Id, created.EmployeeId);
        Assert.Equal("401K", created.DeductionCode);
        Assert.Equal("PercentOfGross", created.Method);
        Assert.Equal(6.00m, created.Amount);
        Assert.True(created.IsPreTax);

        // Get by ID
        var getResp = await client.GetAsync($"/api/hr/deductions/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var fetched = (await getResp.Content.ReadFromJsonAsync<DeductionDto>())!;
        Assert.Equal(created.Id, fetched.Id);

        // List all
        var listResp = await client.GetAsync("/api/hr/deductions");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains(created.Id.ToString(), listJson);
    }

    [Fact]
    public async Task Deduction_from_other_tenant_returns_404()
    {
        await db.ResetAsync();

        var (clientA, employeeA) = await CreateAuthenticatedClientWithEmployeeAsync();
        var (clientB, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var create = CreateValidDeductionCommand(employeeA.Id);
        var createResp = await clientA.PostAsJsonAsync("/api/hr/deductions", create);
        createResp.EnsureSuccessStatusCode();

        var created = (await createResp.Content.ReadFromJsonAsync<DeductionDto>())!;

        // Other tenant can't access
        var getResp = await clientB.GetAsync($"/api/hr/deductions/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Can_create_garnishment_deduction()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        var create = new CreateDeductionCommand(
            EmployeeId: employee.Id,
            DeductionCode: "GARN",
            Description: "Child Support Garnishment",
            Method: DeductionMethod.FlatAmount,
            Amount: 500.00m,
            MaxPerPeriod: null,
            AnnualMax: null,
            Priority: 1,
            IsPreTax: false,
            EmployerMatch: null,
            EmployerMatchMax: null,
            EffectiveDate: DateOnly.FromDateTime(DateTime.UtcNow),
            CaseNumber: "CS-2026-12345",
            GarnishmentPayee: "State Child Support Agency",
            Notes: "Court-ordered child support"
        );

        var createResp = await client.PostAsJsonAsync("/api/hr/deductions", create);
        createResp.EnsureSuccessStatusCode();

        var created = (await createResp.Content.ReadFromJsonAsync<DeductionDto>())!;
        Assert.Equal("CS-2026-12345", created.CaseNumber);
        Assert.Equal("State Child Support Agency", created.GarnishmentPayee);
        Assert.False(created.IsPreTax);
    }

    [Fact]
    public async Task Can_filter_deductions_by_employee()
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

        // Create deductions for both
        var ded1 = CreateValidDeductionCommand(emp1.Id, "401K");
        var ded2 = CreateValidDeductionCommand(emp2.Id, "HEALTH");

        await client.PostAsJsonAsync("/api/hr/deductions", ded1);
        await client.PostAsJsonAsync("/api/hr/deductions", ded2);

        // Filter by employee 1
        var filteredResp = await client.GetAsync($"/api/hr/deductions?employeeId={emp1.Id}");
        filteredResp.EnsureSuccessStatusCode();

        var filteredJson = await filteredResp.Content.ReadAsStringAsync();
        Assert.Contains("401K", filteredJson);
        Assert.DoesNotContain("HEALTH", filteredJson);
    }

    [Fact]
    public async Task Can_get_active_deductions_by_employee()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create active deduction
        var active = CreateValidDeductionCommand(employee.Id, "ACTIVE");
        var activeResp = await client.PostAsJsonAsync("/api/hr/deductions", active);
        activeResp.EnsureSuccessStatusCode();

        // Get active deductions for employee
        var listResp = await client.GetAsync($"/api/hr/deductions/employee/{employee.Id}/active");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains("ACTIVE", listJson);
    }

    [Fact]
    public async Task Can_update_deduction()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create deduction
        var create = CreateValidDeductionCommand(employee.Id);
        var createResp = await client.PostAsJsonAsync("/api/hr/deductions", create);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<DeductionDto>())!;

        // Update deduction
        var update = new UpdateDeductionCommand(
            Id: created.Id,
            Description: "Updated 401K Contribution",
            Method: DeductionMethod.PercentOfGross,
            Amount: 10.00m,
            MaxPerPeriod: 1000.00m,
            AnnualMax: 23500.00m,
            Priority: 5,
            IsPreTax: true,
            EmployerMatch: 100.00m,
            EmployerMatchMax: 5.00m,
            ExpirationDate: null,
            CaseNumber: null,
            GarnishmentPayee: null,
            Notes: "Updated contribution rate"
        );

        var updateResp = await client.PutAsJsonAsync($"/api/hr/deductions/{created.Id}", update);
        if (updateResp.StatusCode != HttpStatusCode.OK)
        {
            var body = await updateResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 200 OK but got {(int)updateResp.StatusCode}. Body: {body}");
        }

        var updated = (await updateResp.Content.ReadFromJsonAsync<DeductionDto>())!;
        Assert.Equal("Updated 401K Contribution", updated.Description);
        Assert.Equal(10.00m, updated.Amount);
        Assert.Equal(5, updated.Priority);
    }

    [Fact]
    public async Task Can_delete_deduction()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create deduction
        var create = CreateValidDeductionCommand(employee.Id);
        var createResp = await client.PostAsJsonAsync("/api/hr/deductions", create);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<DeductionDto>())!;

        // Delete it
        var deleteResp = await client.DeleteAsync($"/api/hr/deductions/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        // Deleted deduction should return 404 on GET
        var getResp = await client.GetAsync($"/api/hr/deductions/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Cannot_create_deduction_for_nonexistent_employee()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var create = CreateValidDeductionCommand(Guid.NewGuid()); // Non-existent employee

        var createResp = await client.PostAsJsonAsync("/api/hr/deductions", create);
        Assert.Equal(HttpStatusCode.NotFound, createResp.StatusCode);
    }
}
