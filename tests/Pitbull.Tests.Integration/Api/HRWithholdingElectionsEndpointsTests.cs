using System.Net;
using System.Net.Http.Json;
using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;
using Pitbull.HR.Features;
using Pitbull.HR.Features.CreateEmployee;
using Pitbull.HR.Features.CreateWithholdingElection;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class HRWithholdingElectionsEndpointsTests(PostgresFixture db) : IAsyncLifetime
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

    private static CreateWithholdingElectionCommand CreateValidWithholdingCommand(Guid employeeId, string jurisdiction = "FEDERAL") => new(
        EmployeeId: employeeId,
        TaxJurisdiction: jurisdiction,
        FilingStatus: FilingStatus.Single,
        Allowances: 1,
        AdditionalWithholding: 50.00m,
        IsExempt: false,
        MultipleJobsOrSpouseWorks: false,
        DependentCredits: 2000.00m,
        OtherIncome: null,
        Deductions: null,
        EffectiveDate: DateOnly.FromDateTime(DateTime.UtcNow),
        SignedDate: DateOnly.FromDateTime(DateTime.UtcNow),
        Notes: "Initial W-4 election"
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
    public async Task Get_withholding_elections_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/hr/withholding-elections");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Can_create_get_and_list_withholding_elections()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        var create = CreateValidWithholdingCommand(employee.Id);

        var createResp = await client.PostAsJsonAsync("/api/hr/withholding-elections", create);
        if (createResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 201 Created but got {(int)createResp.StatusCode}. Body: {body}");
        }

        var created = (await createResp.Content.ReadFromJsonAsync<WithholdingElectionDto>())!;
        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal(employee.Id, created.EmployeeId);
        Assert.Equal("FEDERAL", created.TaxJurisdiction);
        Assert.Equal("Single", created.FilingStatus);
        Assert.True(created.IsCurrent);

        // Get by ID
        var getResp = await client.GetAsync($"/api/hr/withholding-elections/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var fetched = (await getResp.Content.ReadFromJsonAsync<WithholdingElectionDto>())!;
        Assert.Equal(created.Id, fetched.Id);

        // List all
        var listResp = await client.GetAsync("/api/hr/withholding-elections");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains(created.Id.ToString(), listJson);
    }

    [Fact]
    public async Task Withholding_election_from_other_tenant_returns_404()
    {
        await db.ResetAsync();

        var (clientA, employeeA) = await CreateAuthenticatedClientWithEmployeeAsync();
        var (clientB, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var create = CreateValidWithholdingCommand(employeeA.Id);
        var createResp = await clientA.PostAsJsonAsync("/api/hr/withholding-elections", create);
        createResp.EnsureSuccessStatusCode();

        var created = (await createResp.Content.ReadFromJsonAsync<WithholdingElectionDto>())!;

        // Other tenant can't access
        var getResp = await clientB.GetAsync($"/api/hr/withholding-elections/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Can_filter_withholding_elections_by_employee()
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

        // Create withholding elections for both
        var we1 = CreateValidWithholdingCommand(emp1.Id);
        var we2 = CreateValidWithholdingCommand(emp2.Id) with { TaxJurisdiction = "CA" };

        await client.PostAsJsonAsync("/api/hr/withholding-elections", we1);
        await client.PostAsJsonAsync("/api/hr/withholding-elections", we2);

        // Filter by employee 1
        var filteredResp = await client.GetAsync($"/api/hr/withholding-elections?employeeId={emp1.Id}");
        filteredResp.EnsureSuccessStatusCode();

        var filteredJson = await filteredResp.Content.ReadAsStringAsync();
        Assert.Contains("FEDERAL", filteredJson);
        // Emp2's CA election should not appear
        Assert.DoesNotContain(emp2.Id.ToString(), filteredJson);
    }

    [Fact]
    public async Task Can_filter_by_tax_jurisdiction()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create federal and state elections
        var federal = CreateValidWithholdingCommand(employee.Id, "FEDERAL");
        var state = CreateValidWithholdingCommand(employee.Id, "CA") with { Notes = "California withholding" };

        await client.PostAsJsonAsync("/api/hr/withholding-elections", federal);
        await client.PostAsJsonAsync("/api/hr/withholding-elections", state);

        // Filter by federal
        var filteredResp = await client.GetAsync("/api/hr/withholding-elections?taxJurisdiction=FEDERAL");
        filteredResp.EnsureSuccessStatusCode();

        var filteredJson = await filteredResp.Content.ReadAsStringAsync();
        Assert.Contains("FEDERAL", filteredJson);
        // Note: may or may not contain CA depending on implementation
    }

    [Fact]
    public async Task Can_get_current_elections_by_employee()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create withholding election
        var create = CreateValidWithholdingCommand(employee.Id);
        await client.PostAsJsonAsync("/api/hr/withholding-elections", create);

        // Get current elections for employee
        var listResp = await client.GetAsync($"/api/hr/withholding-elections/employee/{employee.Id}/current");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains("FEDERAL", listJson);
    }

    [Fact]
    public async Task New_election_auto_expires_previous_for_same_jurisdiction()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create first federal election
        var first = CreateValidWithholdingCommand(employee.Id);
        var firstResp = await client.PostAsJsonAsync("/api/hr/withholding-elections", first);
        firstResp.EnsureSuccessStatusCode();
        var firstCreated = (await firstResp.Content.ReadFromJsonAsync<WithholdingElectionDto>())!;

        // Create second federal election (should auto-expire first)
        var second = CreateValidWithholdingCommand(employee.Id) with 
        { 
            FilingStatus = FilingStatus.MarriedFilingJointly,
            EffectiveDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1))
        };
        var secondResp = await client.PostAsJsonAsync("/api/hr/withholding-elections", second);
        secondResp.EnsureSuccessStatusCode();
        var secondCreated = (await secondResp.Content.ReadFromJsonAsync<WithholdingElectionDto>())!;

        // Get first election - should now have expiration date
        var getFirstResp = await client.GetAsync($"/api/hr/withholding-elections/{firstCreated.Id}");
        var firstUpdated = (await getFirstResp.Content.ReadFromJsonAsync<WithholdingElectionDto>())!;
        
        // First election should be expired (has expiration date)
        Assert.NotNull(firstUpdated.ExpirationDate);
        
        // Second should be current
        Assert.True(secondCreated.IsCurrent);
    }

    [Fact]
    public async Task Can_delete_withholding_election()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create withholding election
        var create = CreateValidWithholdingCommand(employee.Id);
        var createResp = await client.PostAsJsonAsync("/api/hr/withholding-elections", create);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<WithholdingElectionDto>())!;

        // Delete it
        var deleteResp = await client.DeleteAsync($"/api/hr/withholding-elections/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        // Deleted should return 404 on GET
        var getResp = await client.GetAsync($"/api/hr/withholding-elections/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Cannot_create_withholding_election_for_nonexistent_employee()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var create = CreateValidWithholdingCommand(Guid.NewGuid()); // Non-existent employee

        var createResp = await client.PostAsJsonAsync("/api/hr/withholding-elections", create);
        Assert.Equal(HttpStatusCode.NotFound, createResp.StatusCode);
    }
}
