using System.Net;
using System.Net.Http.Json;
using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;
using Pitbull.HR.Features;
using Pitbull.HR.Features.CreateEmployee;
using Pitbull.HR.Features.CreateUnionMembership;
using Pitbull.HR.Features.UpdateUnionMembership;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class HRUnionMembershipsEndpointsTests(PostgresFixture db) : IAsyncLifetime
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

    private static CreateUnionMembershipCommand CreateValidUnionMembershipCommand(Guid employeeId) => new(
        EmployeeId: employeeId,
        UnionLocal: "Carpenters Local 42",
        MembershipNumber: $"M-{Guid.NewGuid():N}"[..15],
        Classification: "Journeyman",
        ApprenticeLevel: null,
        JoinDate: DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-5)),
        DuesPaid: true,
        DuesPaidThrough: DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(3)),
        DispatchNumber: "D-2026-001",
        DispatchDate: DateOnly.FromDateTime(DateTime.UtcNow),
        DispatchListPosition: 15,
        FringeRate: 15.00m,
        HealthWelfareRate: 8.50m,
        PensionRate: 7.25m,
        TrainingRate: 0.75m,
        EffectiveDate: DateOnly.FromDateTime(DateTime.UtcNow),
        Notes: "Journeyman carpenter union member"
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
    public async Task Get_union_memberships_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/hr/union-memberships");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Can_create_get_and_list_union_memberships()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        var create = CreateValidUnionMembershipCommand(employee.Id);

        var createResp = await client.PostAsJsonAsync("/api/hr/union-memberships", create);
        if (createResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 201 Created but got {(int)createResp.StatusCode}. Body: {body}");
        }

        var created = (await createResp.Content.ReadFromJsonAsync<UnionMembershipDto>())!;
        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal(employee.Id, created.EmployeeId);
        Assert.Equal("Carpenters Local 42", created.UnionLocal);
        Assert.Equal("Journeyman", created.Classification);
        Assert.True(created.IsActive);

        // Get by ID
        var getResp = await client.GetAsync($"/api/hr/union-memberships/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var fetched = (await getResp.Content.ReadFromJsonAsync<UnionMembershipDto>())!;
        Assert.Equal(created.Id, fetched.Id);

        // List all
        var listResp = await client.GetAsync("/api/hr/union-memberships");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains(created.Id.ToString(), listJson);
    }

    [Fact]
    public async Task Union_membership_from_other_tenant_returns_404()
    {
        await db.ResetAsync();

        var (clientA, employeeA) = await CreateAuthenticatedClientWithEmployeeAsync();
        var (clientB, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var create = CreateValidUnionMembershipCommand(employeeA.Id);
        var createResp = await clientA.PostAsJsonAsync("/api/hr/union-memberships", create);
        createResp.EnsureSuccessStatusCode();

        var created = (await createResp.Content.ReadFromJsonAsync<UnionMembershipDto>())!;

        // Other tenant can't access
        var getResp = await clientB.GetAsync($"/api/hr/union-memberships/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Can_filter_union_memberships_by_employee()
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

        // Create union memberships for both
        var um1 = CreateValidUnionMembershipCommand(emp1.Id);
        var um2 = CreateValidUnionMembershipCommand(emp2.Id) with { UnionLocal = "Electricians Local 11" };

        await client.PostAsJsonAsync("/api/hr/union-memberships", um1);
        await client.PostAsJsonAsync("/api/hr/union-memberships", um2);

        // Filter by employee 1
        var filteredResp = await client.GetAsync($"/api/hr/union-memberships?employeeId={emp1.Id}");
        filteredResp.EnsureSuccessStatusCode();

        var filteredJson = await filteredResp.Content.ReadAsStringAsync();
        Assert.Contains("Carpenters Local 42", filteredJson);
        Assert.DoesNotContain("Electricians Local 11", filteredJson);
    }

    [Fact]
    public async Task Can_filter_by_union_local()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create union membership
        var create = CreateValidUnionMembershipCommand(employee.Id);
        var createResp = await client.PostAsJsonAsync("/api/hr/union-memberships", create);
        createResp.EnsureSuccessStatusCode();

        // Filter by union local
        var filteredResp = await client.GetAsync("/api/hr/union-memberships?unionLocal=Carpenters%20Local%2042");
        filteredResp.EnsureSuccessStatusCode();

        var filteredJson = await filteredResp.Content.ReadAsStringAsync();
        Assert.Contains("Carpenters Local 42", filteredJson);
    }

    [Fact]
    public async Task Can_get_by_employee_endpoint()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create union membership
        var create = CreateValidUnionMembershipCommand(employee.Id);
        await client.PostAsJsonAsync("/api/hr/union-memberships", create);

        // Get by employee endpoint
        var listResp = await client.GetAsync($"/api/hr/union-memberships/employee/{employee.Id}");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains("Carpenters Local 42", listJson);
    }

    [Fact]
    public async Task Can_update_union_membership()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create union membership
        var create = CreateValidUnionMembershipCommand(employee.Id);
        var createResp = await client.PostAsJsonAsync("/api/hr/union-memberships", create);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<UnionMembershipDto>())!;

        // Update
        var update = new UpdateUnionMembershipCommand(
            Id: created.Id,
            Classification: "Foreman",
            ApprenticeLevel: null,
            DuesPaid: true,
            DuesPaidThrough: DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(6)),
            DispatchNumber: "D-2026-002",
            DispatchDate: DateOnly.FromDateTime(DateTime.UtcNow),
            DispatchListPosition: 5,
            FringeRate: 18.00m,
            HealthWelfareRate: 9.00m,
            PensionRate: 8.00m,
            TrainingRate: 1.00m,
            ExpirationDate: null,
            Notes: "Promoted to foreman"
        );

        var updateResp = await client.PutAsJsonAsync($"/api/hr/union-memberships/{created.Id}", update);
        if (updateResp.StatusCode != HttpStatusCode.OK)
        {
            var body = await updateResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 200 OK but got {(int)updateResp.StatusCode}. Body: {body}");
        }

        var updated = (await updateResp.Content.ReadFromJsonAsync<UnionMembershipDto>())!;
        Assert.Equal("Foreman", updated.Classification);
        Assert.Equal(18.00m, updated.FringeRate);
        Assert.Equal("D-2026-002", updated.DispatchNumber);
    }

    [Fact]
    public async Task Can_delete_union_membership()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Create union membership
        var create = CreateValidUnionMembershipCommand(employee.Id);
        var createResp = await client.PostAsJsonAsync("/api/hr/union-memberships", create);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<UnionMembershipDto>())!;

        // Delete it
        var deleteResp = await client.DeleteAsync($"/api/hr/union-memberships/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        // Deleted should return 404 on GET
        var getResp = await client.GetAsync($"/api/hr/union-memberships/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Cannot_create_union_membership_for_nonexistent_employee()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var create = CreateValidUnionMembershipCommand(Guid.NewGuid()); // Non-existent employee

        var createResp = await client.PostAsJsonAsync("/api/hr/union-memberships", create);
        Assert.Equal(HttpStatusCode.NotFound, createResp.StatusCode);
    }
}
