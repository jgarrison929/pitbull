using System.Net;
using System.Net.Http.Json;
using Pitbull.HR.Domain;
using Pitbull.HR.Features;
using Pitbull.HR.Features.CreateEmployee;
using Pitbull.HR.Features.CreatePayRate;
using Pitbull.HR.Features.UpdatePayRate;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class HRPayRatesEndpointsTests(PostgresFixture db) : IAsyncLifetime
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

    private static CreatePayRateCommand CreateValidPayRateCommand(Guid employeeId) => new(
        EmployeeId: employeeId,
        Description: "Standard hourly rate",
        RateType: RateType.Hourly,
        Amount: 45.00m,
        Currency: "USD",
        EffectiveDate: DateOnly.FromDateTime(DateTime.UtcNow),
        ExpirationDate: null,
        ProjectId: null,
        ShiftCode: "DAY",
        WorkState: "CA",
        Priority: 10,
        IncludesFringe: false,
        FringeRate: null,
        HealthWelfareRate: null,
        PensionRate: null,
        TrainingRate: null,
        OtherFringeRate: null,
        Source: RateSource.Manual,
        Notes: "Test pay rate"
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
    public async Task Get_pay_rates_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/hr/pay-rates");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Can_create_get_and_list_pay_rates()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        var create = CreateValidPayRateCommand(employee.Id);

        var createResp = await client.PostAsJsonAsync("/api/hr/pay-rates", create);
        if (createResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 201 Created but got {(int)createResp.StatusCode}. Body: {body}");
        }

        var created = (await createResp.Content.ReadFromJsonAsync<PayRateDto>())!;
        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal(employee.Id, created.EmployeeId);
        Assert.Equal("Hourly", created.RateType);
        Assert.Equal(45.00m, created.Amount);
        Assert.Equal("DAY", created.ShiftCode);

        // Get by ID
        var getResp = await client.GetAsync($"/api/hr/pay-rates/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var fetched = (await getResp.Content.ReadFromJsonAsync<PayRateDto>())!;
        Assert.Equal(created.Id, fetched.Id);

        // List all
        var listResp = await client.GetAsync("/api/hr/pay-rates");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains(created.Id.ToString(), listJson);
    }

    [Fact]
    public async Task Pay_rate_from_other_tenant_returns_404()
    {
        await db.ResetAsync();

        var (clientA, employeeA) = await CreateAuthenticatedClientWithEmployeeAsync();
        var (clientB, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var create = CreateValidPayRateCommand(employeeA.Id);
        var createResp = await clientA.PostAsJsonAsync("/api/hr/pay-rates", create);
        createResp.EnsureSuccessStatusCode();

        var created = (await createResp.Content.ReadFromJsonAsync<PayRateDto>())!;

        // Other tenant can't access
        var getResp = await clientB.GetAsync($"/api/hr/pay-rates/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Can_create_pay_rate_with_fringe_benefits()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        var create = CreateValidPayRateCommand(employee.Id) with
        {
            Description = "Union rate with full fringe",
            IncludesFringe = true,
            FringeRate = 5.00m,
            HealthWelfareRate = 8.50m,
            PensionRate = 7.25m,
            TrainingRate = 0.75m,
            Source = RateSource.UnionScale
        };

        var createResp = await client.PostAsJsonAsync("/api/hr/pay-rates", create);
        createResp.EnsureSuccessStatusCode();

        var created = (await createResp.Content.ReadFromJsonAsync<PayRateDto>())!;
        Assert.True(created.IncludesFringe);
        Assert.Equal(5.00m, created.FringeRate);
        Assert.Equal(8.50m, created.HealthWelfareRate);
        Assert.Equal(7.25m, created.PensionRate);
        Assert.Equal(0.75m, created.TrainingRate);
    }

    [Fact]
    public async Task Can_filter_pay_rates_by_employee()
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

        // Create pay rates for both
        var rate1 = CreateValidPayRateCommand(emp1.Id) with { Amount = 50.00m };
        var rate2 = CreateValidPayRateCommand(emp2.Id) with { Amount = 55.00m };

        var rate1Resp = await client.PostAsJsonAsync("/api/hr/pay-rates", rate1);
        rate1Resp.EnsureSuccessStatusCode();
        var rate2Resp = await client.PostAsJsonAsync("/api/hr/pay-rates", rate2);
        rate2Resp.EnsureSuccessStatusCode();

        // Filter by employee 1
        var filteredResp = await client.GetAsync($"/api/hr/pay-rates?employeeId={emp1.Id}");
        filteredResp.EnsureSuccessStatusCode();

        var filteredJson = await filteredResp.Content.ReadAsStringAsync();
        Assert.Contains("50.00", filteredJson);
        Assert.DoesNotContain("55.00", filteredJson);
    }

    [Fact]
    public async Task Can_get_active_pay_rates_by_employee()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create active rate
        var activeRate = CreateValidPayRateCommand(employee.Id) with
        {
            Description = "Active rate",
            Amount = 50.00m
        };
        var activeResp = await client.PostAsJsonAsync("/api/hr/pay-rates", activeRate);
        activeResp.EnsureSuccessStatusCode();

        // Get active rates for employee
        var listResp = await client.GetAsync($"/api/hr/pay-rates/employee/{employee.Id}/active");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains("Active rate", listJson);
    }

    [Fact]
    public async Task Can_update_pay_rate()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create pay rate
        var create = CreateValidPayRateCommand(employee.Id);
        var createResp = await client.PostAsJsonAsync("/api/hr/pay-rates", create);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<PayRateDto>())!;

        // Update pay rate
        var update = new UpdatePayRateCommand(
            Id: created.Id,
            Description: "Updated rate",
            RateType: RateType.Hourly,
            Amount: 55.00m,
            Currency: "USD",
            EffectiveDate: DateOnly.FromDateTime(DateTime.UtcNow),
            ExpirationDate: DateOnly.FromDateTime(DateTime.UtcNow.AddYears(1)),
            ProjectId: null,
            ShiftCode: "SWING",
            WorkState: "CA",
            Priority: 20,
            IncludesFringe: false,
            FringeRate: null,
            HealthWelfareRate: null,
            PensionRate: null,
            TrainingRate: null,
            OtherFringeRate: null,
            Source: RateSource.Manual,
            Notes: "Updated notes"
        );

        var updateResp = await client.PutAsJsonAsync($"/api/hr/pay-rates/{created.Id}", update);
        if (updateResp.StatusCode != HttpStatusCode.OK)
        {
            var body = await updateResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 200 OK but got {(int)updateResp.StatusCode}. Body: {body}");
        }

        var updated = (await updateResp.Content.ReadFromJsonAsync<PayRateDto>())!;
        Assert.Equal("Updated rate", updated.Description);
        Assert.Equal(55.00m, updated.Amount);
        Assert.Equal("SWING", updated.ShiftCode);
        Assert.Equal(20, updated.Priority);
    }

    [Fact]
    public async Task Can_delete_pay_rate()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create pay rate
        var create = CreateValidPayRateCommand(employee.Id);
        var createResp = await client.PostAsJsonAsync("/api/hr/pay-rates", create);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<PayRateDto>())!;

        // Delete it
        var deleteResp = await client.DeleteAsync($"/api/hr/pay-rates/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        // Deleted pay rate should return 404 on GET
        var getResp = await client.GetAsync($"/api/hr/pay-rates/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Cannot_create_pay_rate_for_nonexistent_employee()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var create = CreateValidPayRateCommand(Guid.NewGuid()); // Non-existent employee

        var createResp = await client.PostAsJsonAsync("/api/hr/pay-rates", create);
        Assert.Equal(HttpStatusCode.NotFound, createResp.StatusCode);
    }
}
