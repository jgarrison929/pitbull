using System.Net;
using System.Net.Http.Json;
using Pitbull.HR.Domain;
using Pitbull.HR.Features;
using Pitbull.HR.Features.CreateEmployee;
using Pitbull.HR.Features.CreateCertification;
using Pitbull.HR.Features.UpdateCertification;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class HRCertificationsEndpointsTests(PostgresFixture db) : IAsyncLifetime
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

    private static CreateCertificationCommand CreateValidCertificationCommand(Guid employeeId, string? certCode = null) => new(
        EmployeeId: employeeId,
        CertificationTypeCode: certCode ?? "OSHA10",
        CertificationName: "OSHA 10-Hour Construction",
        CertificateNumber: $"CERT-{Guid.NewGuid():N}"[..20],
        IssuingAuthority: "OSHA Training Institute",
        IssueDate: DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-6)),
        ExpirationDate: DateOnly.FromDateTime(DateTime.UtcNow.AddYears(5))
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
    public async Task Get_certifications_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/hr/certifications");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Can_create_get_and_list_certifications()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        var create = CreateValidCertificationCommand(employee.Id);

        var createResp = await client.PostAsJsonAsync("/api/hr/certifications", create);
        if (createResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 201 Created but got {(int)createResp.StatusCode}. Body: {body}");
        }

        var created = (await createResp.Content.ReadFromJsonAsync<CertificationDto>())!;
        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal(employee.Id, created.EmployeeId);
        Assert.Equal("OSHA10", created.CertificationTypeCode);
        Assert.Equal("OSHA 10-Hour Construction", created.CertificationName);
        Assert.False(created.IsExpired);

        // Get by ID
        var getResp = await client.GetAsync($"/api/hr/certifications/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var fetched = (await getResp.Content.ReadFromJsonAsync<CertificationDto>())!;
        Assert.Equal(created.Id, fetched.Id);

        // List all
        var listResp = await client.GetAsync("/api/hr/certifications");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains(created.Id.ToString(), listJson);
    }

    [Fact]
    public async Task Certification_from_other_tenant_returns_404()
    {
        await db.ResetAsync();

        var (clientA, employeeA) = await CreateAuthenticatedClientWithEmployeeAsync();
        var (clientB, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var create = CreateValidCertificationCommand(employeeA.Id);
        var createResp = await clientA.PostAsJsonAsync("/api/hr/certifications", create);
        createResp.EnsureSuccessStatusCode();

        var created = (await createResp.Content.ReadFromJsonAsync<CertificationDto>())!;

        // Other tenant can't access
        var getResp = await clientB.GetAsync($"/api/hr/certifications/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Can_filter_certifications_by_employee()
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

        // Create certifications for both
        var cert1 = CreateValidCertificationCommand(emp1.Id, "OSHA10");
        var cert2 = CreateValidCertificationCommand(emp2.Id, "CDL-A");

        var cert1Resp = await client.PostAsJsonAsync("/api/hr/certifications", cert1);
        cert1Resp.EnsureSuccessStatusCode();
        var cert2Resp = await client.PostAsJsonAsync("/api/hr/certifications", cert2);
        cert2Resp.EnsureSuccessStatusCode();

        // Filter by employee 1
        var filteredResp = await client.GetAsync($"/api/hr/certifications?employeeId={emp1.Id}");
        filteredResp.EnsureSuccessStatusCode();

        var filteredJson = await filteredResp.Content.ReadAsStringAsync();
        Assert.Contains("OSHA10", filteredJson);
        Assert.DoesNotContain("CDL-A", filteredJson);
    }

    [Fact]
    public async Task Can_filter_certifications_by_type_code()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create multiple certifications
        var osha = CreateValidCertificationCommand(employee.Id, "OSHA10");
        var cdl = CreateValidCertificationCommand(employee.Id, "CDL-A");

        var oshaResp = await client.PostAsJsonAsync("/api/hr/certifications", osha);
        oshaResp.EnsureSuccessStatusCode();
        var cdlResp = await client.PostAsJsonAsync("/api/hr/certifications", cdl);
        cdlResp.EnsureSuccessStatusCode();

        // Filter by type code
        var filteredResp = await client.GetAsync("/api/hr/certifications?certificationTypeCode=OSHA10");
        filteredResp.EnsureSuccessStatusCode();

        var filteredJson = await filteredResp.Content.ReadAsStringAsync();
        Assert.Contains("OSHA10", filteredJson);
        Assert.DoesNotContain("CDL-A", filteredJson);
    }

    [Fact]
    public async Task Can_get_expiring_certifications()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create certification expiring in 30 days (within 90-day window)
        var expiringSoon = new CreateCertificationCommand(
            EmployeeId: employee.Id,
            CertificationTypeCode: "EXPIRING",
            CertificationName: "Expiring Soon Cert",
            CertificateNumber: $"EXP-{Guid.NewGuid():N}"[..20],
            IssuingAuthority: "Test Authority",
            IssueDate: DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-1)),
            ExpirationDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30))
        );

        var createResp = await client.PostAsJsonAsync("/api/hr/certifications", expiringSoon);
        createResp.EnsureSuccessStatusCode();

        // Get expiring certifications
        var expiringResp = await client.GetAsync("/api/hr/certifications/expiring");
        Assert.Equal(HttpStatusCode.OK, expiringResp.StatusCode);

        var expiringJson = await expiringResp.Content.ReadAsStringAsync();
        Assert.Contains("EXPIRING", expiringJson);
    }

    [Fact]
    public async Task Can_update_certification()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create certification
        var create = CreateValidCertificationCommand(employee.Id);
        var createResp = await client.PostAsJsonAsync("/api/hr/certifications", create);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<CertificationDto>())!;

        // Update certification
        var update = new UpdateCertificationCommand(
            Id: created.Id,
            CertificationTypeCode: "OSHA30",
            CertificationName: "OSHA 30-Hour Construction",
            CertificateNumber: "UPDATED-CERT-123",
            IssuingAuthority: "OSHA Updated",
            IssueDate: DateOnly.FromDateTime(DateTime.UtcNow),
            ExpirationDate: DateOnly.FromDateTime(DateTime.UtcNow.AddYears(10)),
            Status: CertificationStatus.Verified
        );

        var updateResp = await client.PutAsJsonAsync($"/api/hr/certifications/{created.Id}", update);
        if (updateResp.StatusCode != HttpStatusCode.OK)
        {
            var body = await updateResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 200 OK but got {(int)updateResp.StatusCode}. Body: {body}");
        }

        var updated = (await updateResp.Content.ReadFromJsonAsync<CertificationDto>())!;
        Assert.Equal("OSHA30", updated.CertificationTypeCode);
        Assert.Equal("OSHA 30-Hour Construction", updated.CertificationName);
        Assert.Equal("Verified", updated.Status);
    }

    [Fact]
    public async Task Can_delete_certification()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create certification
        var create = CreateValidCertificationCommand(employee.Id);
        var createResp = await client.PostAsJsonAsync("/api/hr/certifications", create);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<CertificationDto>())!;

        // Delete it
        var deleteResp = await client.DeleteAsync($"/api/hr/certifications/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        // Deleted certification should return 404 on GET
        var getResp = await client.GetAsync($"/api/hr/certifications/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Cannot_create_certification_for_nonexistent_employee()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var create = CreateValidCertificationCommand(Guid.NewGuid()); // Non-existent employee

        var createResp = await client.PostAsJsonAsync("/api/hr/certifications", create);
        Assert.Equal(HttpStatusCode.NotFound, createResp.StatusCode);
    }
}
