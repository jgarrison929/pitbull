using System.Net;
using System.Net.Http.Json;
using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;
using Pitbull.HR.Features;
using Pitbull.HR.Features.CreateEmployee;
using Pitbull.HR.Features.CreateI9Record;
using Pitbull.HR.Features.UpdateI9Record;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class HRI9RecordsEndpointsTests(PostgresFixture db) : IAsyncLifetime
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

    private static CreateI9RecordCommand CreateValidI9RecordCommand(Guid employeeId) => new(
        EmployeeId: employeeId,
        Section1CompletedDate: DateOnly.FromDateTime(DateTime.UtcNow),
        CitizenshipStatus: "Citizen",
        AlienNumber: null,
        I94Number: null,
        ForeignPassportNumber: null,
        ForeignPassportCountry: null,
        WorkAuthorizationExpires: null,
        EmploymentStartDate: DateOnly.FromDateTime(DateTime.UtcNow),
        Notes: "Standard I-9 for US citizen"
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
    public async Task Get_i9_records_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/hr/i9-records");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Can_create_get_and_list_i9_records()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        var create = CreateValidI9RecordCommand(employee.Id);

        var createResp = await client.PostAsJsonAsync("/api/hr/i9-records", create);
        if (createResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 201 Created but got {(int)createResp.StatusCode}. Body: {body}");
        }

        var created = (await createResp.Content.ReadFromJsonAsync<I9RecordDto>())!;
        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal(employee.Id, created.EmployeeId);
        Assert.Equal("Citizen", created.CitizenshipStatus);
        Assert.Equal("Section1Complete", created.Status);

        // Get by ID
        var getResp = await client.GetAsync($"/api/hr/i9-records/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var fetched = (await getResp.Content.ReadFromJsonAsync<I9RecordDto>())!;
        Assert.Equal(created.Id, fetched.Id);

        // List all
        var listResp = await client.GetAsync("/api/hr/i9-records");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains(created.Id.ToString(), listJson);
    }

    [Fact]
    public async Task I9_record_from_other_tenant_returns_404()
    {
        await db.ResetAsync();

        var (clientA, employeeA) = await CreateAuthenticatedClientWithEmployeeAsync();
        var (clientB, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var create = CreateValidI9RecordCommand(employeeA.Id);
        var createResp = await clientA.PostAsJsonAsync("/api/hr/i9-records", create);
        createResp.EnsureSuccessStatusCode();

        var created = (await createResp.Content.ReadFromJsonAsync<I9RecordDto>())!;

        // Other tenant can't access
        var getResp = await clientB.GetAsync($"/api/hr/i9-records/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Can_create_i9_for_work_authorization_expiring()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create a fresh employee specifically for this test
        var empCmd = CreateValidEmployeeCommand($"EMP-WA-{Guid.NewGuid():N}"[..20]);
        var empResp = await client.PostAsJsonAsync("/api/hr/employees", empCmd);
        empResp.EnsureSuccessStatusCode();
        var employee = (await empResp.Content.ReadFromJsonAsync<EmployeeDto>())!;

        var create = new CreateI9RecordCommand(
            EmployeeId: employee.Id,
            Section1CompletedDate: DateOnly.FromDateTime(DateTime.UtcNow),
            CitizenshipStatus: "Alien", // Valid status: Citizen, NationalUS, LPR, or Alien
            AlienNumber: "A123456789",
            I94Number: "I94-2026-12345",
            ForeignPassportNumber: "AB1234567",
            ForeignPassportCountry: "Mexico",
            WorkAuthorizationExpires: DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(6)),
            EmploymentStartDate: DateOnly.FromDateTime(DateTime.UtcNow),
            Notes: "Work permit employee"
        );

        var createResp = await client.PostAsJsonAsync("/api/hr/i9-records", create);
        if (createResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 201 Created but got {(int)createResp.StatusCode}. Body: {body}");
        }

        var created = (await createResp.Content.ReadFromJsonAsync<I9RecordDto>())!;
        Assert.Equal("A123456789", created.AlienNumber);
        Assert.Equal("Mexico", created.ForeignPassportCountry);
        Assert.NotNull(created.WorkAuthorizationExpires);
    }

    [Fact]
    public async Task Can_filter_i9_records_by_employee()
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

        // Create I-9 records for both
        var i9_1 = CreateValidI9RecordCommand(emp1.Id);
        var i9_2 = CreateValidI9RecordCommand(emp2.Id);

        await client.PostAsJsonAsync("/api/hr/i9-records", i9_1);
        await client.PostAsJsonAsync("/api/hr/i9-records", i9_2);

        // Filter by employee 1
        var filteredResp = await client.GetAsync($"/api/hr/i9-records?employeeId={emp1.Id}");
        filteredResp.EnsureSuccessStatusCode();

        var filteredJson = await filteredResp.Content.ReadAsStringAsync();
        Assert.Contains(emp1.Id.ToString(), filteredJson);
        Assert.DoesNotContain(emp2.Id.ToString(), filteredJson);
    }

    [Fact]
    public async Task Can_get_i9_by_employee_endpoint()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create I-9 record
        var create = CreateValidI9RecordCommand(employee.Id);
        var createResp = await client.PostAsJsonAsync("/api/hr/i9-records", create);
        createResp.EnsureSuccessStatusCode();

        // Get by employee endpoint
        var listResp = await client.GetAsync($"/api/hr/i9-records/employee/{employee.Id}");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains(employee.Id.ToString(), listJson);
    }

    [Fact]
    public async Task Can_update_i9_record_with_section2()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create I-9 record
        var create = CreateValidI9RecordCommand(employee.Id);
        var createResp = await client.PostAsJsonAsync("/api/hr/i9-records", create);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<I9RecordDto>())!;

        // Complete Section 2
        var update = new UpdateI9RecordCommand(
            Id: created.Id,
            Section2CompletedDate: DateOnly.FromDateTime(DateTime.UtcNow),
            Section2CompletedBy: "John HR Manager",
            ListADocumentType: "US Passport",
            ListADocumentNumber: "123456789",
            ListAExpirationDate: DateOnly.FromDateTime(DateTime.UtcNow.AddYears(10)),
            ListBDocumentType: null,
            ListBDocumentNumber: null,
            ListBExpirationDate: null,
            ListCDocumentType: null,
            ListCDocumentNumber: null,
            ListCExpirationDate: null,
            Section3Date: null,
            Section3NewDocumentType: null,
            Section3NewDocumentNumber: null,
            Section3NewDocumentExpiration: null,
            Section3RehireDate: null,
            Status: I9Status.Section2Complete,
            EVerifyCaseNumber: null,
            Notes: "Section 2 verified"
        );

        var updateResp = await client.PutAsJsonAsync($"/api/hr/i9-records/{created.Id}", update);
        if (updateResp.StatusCode != HttpStatusCode.OK)
        {
            var body = await updateResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 200 OK but got {(int)updateResp.StatusCode}. Body: {body}");
        }

        var updated = (await updateResp.Content.ReadFromJsonAsync<I9RecordDto>())!;
        Assert.Equal("Section2Complete", updated.Status);
        Assert.Equal("John HR Manager", updated.Section2CompletedBy);
        Assert.Equal("US Passport", updated.ListADocumentType);
    }

    [Fact]
    public async Task Can_delete_i9_record()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create I-9 record
        var create = CreateValidI9RecordCommand(employee.Id);
        var createResp = await client.PostAsJsonAsync("/api/hr/i9-records", create);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<I9RecordDto>())!;

        // Delete it
        var deleteResp = await client.DeleteAsync($"/api/hr/i9-records/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        // Deleted record should return 404 on GET
        var getResp = await client.GetAsync($"/api/hr/i9-records/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Cannot_create_i9_record_for_nonexistent_employee()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var create = CreateValidI9RecordCommand(Guid.NewGuid()); // Non-existent employee

        var createResp = await client.PostAsJsonAsync("/api/hr/i9-records", create);
        Assert.Equal(HttpStatusCode.NotFound, createResp.StatusCode);
    }
}
