using System.Net;
using System.Net.Http.Json;
using Pitbull.HR.Domain;
using Pitbull.HR.Features;
using Pitbull.HR.Features.CreateEmployee;
using Pitbull.HR.Features.CreateEmergencyContact;
using Pitbull.HR.Features.UpdateEmergencyContact;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class HREmergencyContactsEndpointsTests(PostgresFixture db) : IAsyncLifetime
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

    private static CreateEmergencyContactCommand CreateValidEmergencyContactCommand(Guid employeeId, int? priority = null) => new(
        EmployeeId: employeeId,
        Name: "Jane Doe",
        Relationship: "Spouse",
        PrimaryPhone: "555-1234",
        SecondaryPhone: "555-5678",
        Email: "jane.doe@example.com",
        Priority: priority,
        Notes: "Primary emergency contact"
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
    public async Task Get_emergency_contacts_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/hr/emergency-contacts");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Can_create_get_and_list_emergency_contacts()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        var create = CreateValidEmergencyContactCommand(employee.Id);

        var createResp = await client.PostAsJsonAsync("/api/hr/emergency-contacts", create);
        if (createResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 201 Created but got {(int)createResp.StatusCode}. Body: {body}");
        }

        var created = (await createResp.Content.ReadFromJsonAsync<EmergencyContactDto>())!;
        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal(employee.Id, created.EmployeeId);
        Assert.Equal("Jane Doe", created.Name);
        Assert.Equal("Spouse", created.Relationship);
        Assert.Equal("555-1234", created.PrimaryPhone);

        // Get by ID
        var getResp = await client.GetAsync($"/api/hr/emergency-contacts/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var fetched = (await getResp.Content.ReadFromJsonAsync<EmergencyContactDto>())!;
        Assert.Equal(created.Id, fetched.Id);

        // List all
        var listResp = await client.GetAsync("/api/hr/emergency-contacts");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains(created.Id.ToString(), listJson);
    }

    [Fact]
    public async Task Emergency_contact_from_other_tenant_returns_404()
    {
        await db.ResetAsync();

        var (clientA, employeeA) = await CreateAuthenticatedClientWithEmployeeAsync();
        var (clientB, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var create = CreateValidEmergencyContactCommand(employeeA.Id);
        var createResp = await clientA.PostAsJsonAsync("/api/hr/emergency-contacts", create);
        createResp.EnsureSuccessStatusCode();

        var created = (await createResp.Content.ReadFromJsonAsync<EmergencyContactDto>())!;

        // Other tenant can't access
        var getResp = await clientB.GetAsync($"/api/hr/emergency-contacts/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Can_filter_emergency_contacts_by_employee()
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

        // Create emergency contacts for both
        var ec1 = CreateValidEmergencyContactCommand(emp1.Id) with { Name = "Contact One" };
        var ec2 = CreateValidEmergencyContactCommand(emp2.Id) with { Name = "Contact Two" };

        var ec1Resp = await client.PostAsJsonAsync("/api/hr/emergency-contacts", ec1);
        ec1Resp.EnsureSuccessStatusCode();
        var ec2Resp = await client.PostAsJsonAsync("/api/hr/emergency-contacts", ec2);
        ec2Resp.EnsureSuccessStatusCode();

        // Filter by employee 1
        var filteredResp = await client.GetAsync($"/api/hr/emergency-contacts?employeeId={emp1.Id}");
        filteredResp.EnsureSuccessStatusCode();

        var filteredJson = await filteredResp.Content.ReadAsStringAsync();
        Assert.Contains("Contact One", filteredJson);
        Assert.DoesNotContain("Contact Two", filteredJson);
    }

    [Fact]
    public async Task Can_get_emergency_contacts_by_employee_endpoint()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create multiple contacts
        var ec1 = CreateValidEmergencyContactCommand(employee.Id, 1) with { Name = "Primary Contact" };
        var ec2 = CreateValidEmergencyContactCommand(employee.Id, 2) with { Name = "Secondary Contact" };

        await client.PostAsJsonAsync("/api/hr/emergency-contacts", ec1);
        await client.PostAsJsonAsync("/api/hr/emergency-contacts", ec2);

        // Get by employee endpoint
        var listResp = await client.GetAsync($"/api/hr/emergency-contacts/employee/{employee.Id}");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains("Primary Contact", listJson);
        Assert.Contains("Secondary Contact", listJson);
    }

    [Fact]
    public async Task Can_update_emergency_contact()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create emergency contact
        var create = CreateValidEmergencyContactCommand(employee.Id);
        var createResp = await client.PostAsJsonAsync("/api/hr/emergency-contacts", create);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<EmergencyContactDto>())!;

        // Update emergency contact
        var update = new UpdateEmergencyContactCommand(
            Id: created.Id,
            Name: "Updated Contact",
            Relationship: "Parent",
            PrimaryPhone: "555-9999",
            SecondaryPhone: null,
            Email: "updated@example.com",
            Priority: 1,
            Notes: "Updated notes"
        );

        var updateResp = await client.PutAsJsonAsync($"/api/hr/emergency-contacts/{created.Id}", update);
        if (updateResp.StatusCode != HttpStatusCode.OK)
        {
            var body = await updateResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 200 OK but got {(int)updateResp.StatusCode}. Body: {body}");
        }

        var updated = (await updateResp.Content.ReadFromJsonAsync<EmergencyContactDto>())!;
        Assert.Equal("Updated Contact", updated.Name);
        Assert.Equal("Parent", updated.Relationship);
        Assert.Equal("555-9999", updated.PrimaryPhone);
    }

    [Fact]
    public async Task Can_delete_emergency_contact()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create emergency contact
        var create = CreateValidEmergencyContactCommand(employee.Id);
        var createResp = await client.PostAsJsonAsync("/api/hr/emergency-contacts", create);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<EmergencyContactDto>())!;

        // Delete it
        var deleteResp = await client.DeleteAsync($"/api/hr/emergency-contacts/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        // Deleted contact should return 404 on GET
        var getResp = await client.GetAsync($"/api/hr/emergency-contacts/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Cannot_create_emergency_contact_for_nonexistent_employee()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var create = CreateValidEmergencyContactCommand(Guid.NewGuid()); // Non-existent employee

        var createResp = await client.PostAsJsonAsync("/api/hr/emergency-contacts", create);
        Assert.Equal(HttpStatusCode.NotFound, createResp.StatusCode);
    }
}
