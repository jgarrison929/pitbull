using System.Net;
using System.Net.Http.Json;
using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;
using Pitbull.HR.Features;
using Pitbull.HR.Features.CreateEmployee;
using Pitbull.HR.Features.CreateEmploymentEpisode;
using Pitbull.HR.Features.UpdateEmploymentEpisode;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class HREmploymentEpisodesEndpointsTests(PostgresFixture db) : IAsyncLifetime
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

    private static CreateEmploymentEpisodeCommand CreateValidEmploymentEpisodeCommand(Guid employeeId) => new(
        EmployeeId: employeeId,
        HireDate: DateOnly.FromDateTime(DateTime.UtcNow),
        UnionDispatchReference: "LOCAL-42-DISPATCH-123",
        JobClassificationAtHire: "Journeyman Carpenter",
        HourlyRateAtHire: 45.00m,
        PositionAtHire: "Lead Carpenter"
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
    public async Task Get_employment_episodes_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/hr/employment-episodes");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Can_list_employment_episodes()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Employee already has an initial employment episode from hire
        // List episodes for employee
        var listResp = await client.GetAsync($"/api/hr/employment-episodes?employeeId={employee.Id}");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains(employee.Id.ToString(), listJson);
    }

    [Fact]
    public async Task Can_get_existing_employment_episode()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Get existing episodes for this employee
        var listResp = await client.GetAsync($"/api/hr/employment-episodes?employeeId={employee.Id}");
        listResp.EnsureSuccessStatusCode();
        var episodes = await listResp.Content.ReadFromJsonAsync<PagedResult<EmploymentEpisodeListDto>>();
        Assert.NotNull(episodes);
        Assert.True(episodes.Items.Count > 0);

        var episodeId = episodes.Items[0].Id;

        // Get by ID
        var getResp = await client.GetAsync($"/api/hr/employment-episodes/{episodeId}");
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var fetched = (await getResp.Content.ReadFromJsonAsync<EmploymentEpisodeDto>())!;
        Assert.Equal(episodeId, fetched.Id);
        Assert.Equal(employee.Id, fetched.EmployeeId);
        Assert.True(fetched.IsCurrent);
    }

    [Fact]
    public async Task Employment_episode_from_other_tenant_returns_404()
    {
        await db.ResetAsync();

        var (clientA, employeeA) = await CreateAuthenticatedClientWithEmployeeAsync();
        var (clientB, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Get existing episode for employee A
        var listResp = await clientA.GetAsync($"/api/hr/employment-episodes?employeeId={employeeA.Id}");
        listResp.EnsureSuccessStatusCode();
        var episodes = await listResp.Content.ReadFromJsonAsync<PagedResult<EmploymentEpisodeListDto>>();
        var episodeId = episodes!.Items[0].Id;

        // Other tenant can't access
        var getResp = await clientB.GetAsync($"/api/hr/employment-episodes/{episodeId}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Can_filter_employment_episodes_by_employee()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create two employees (each gets an initial employment episode)
        var emp1Cmd = CreateValidEmployeeCommand($"EMP1-{Guid.NewGuid():N}"[..20]);
        var emp1Resp = await client.PostAsJsonAsync("/api/hr/employees", emp1Cmd);
        emp1Resp.EnsureSuccessStatusCode();
        var emp1 = (await emp1Resp.Content.ReadFromJsonAsync<EmployeeDto>())!;

        var emp2Cmd = CreateValidEmployeeCommand($"EMP2-{Guid.NewGuid():N}"[..20]);
        var emp2Resp = await client.PostAsJsonAsync("/api/hr/employees", emp2Cmd);
        emp2Resp.EnsureSuccessStatusCode();
        var emp2 = (await emp2Resp.Content.ReadFromJsonAsync<EmployeeDto>())!;

        // Filter by employee 1 - should see emp1's episode
        var filteredResp = await client.GetAsync($"/api/hr/employment-episodes?employeeId={emp1.Id}");
        filteredResp.EnsureSuccessStatusCode();

        var filteredJson = await filteredResp.Content.ReadAsStringAsync();
        Assert.Contains(emp1.Id.ToString(), filteredJson);
        Assert.DoesNotContain(emp2.Id.ToString(), filteredJson);
    }

    [Fact]
    public async Task Can_get_employment_history_by_employee_endpoint()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Get employment history by employee endpoint (employee already has initial episode)
        var listResp = await client.GetAsync($"/api/hr/employment-episodes/employee/{employee.Id}");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains(employee.Id.ToString(), listJson);
    }

    [Fact]
    public async Task Can_terminate_employment_episode()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Get existing episode for this employee
        var listResp = await client.GetAsync($"/api/hr/employment-episodes?employeeId={employee.Id}");
        listResp.EnsureSuccessStatusCode();
        var episodes = await listResp.Content.ReadFromJsonAsync<PagedResult<EmploymentEpisodeListDto>>();
        var episodeId = episodes!.Items[0].Id;

        // Terminate the episode
        var update = new UpdateEmploymentEpisodeCommand(
            Id: episodeId,
            TerminationDate: DateOnly.FromDateTime(DateTime.UtcNow),
            SeparationReason: SeparationReason.Layoff,
            EligibleForRehire: true,
            SeparationNotes: "End of project - good worker",
            WasVoluntary: false,
            PositionAtTermination: "Lead Carpenter"
        );

        var updateResp = await client.PutAsJsonAsync($"/api/hr/employment-episodes/{episodeId}", update);
        if (updateResp.StatusCode != HttpStatusCode.OK)
        {
            var body = await updateResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 200 OK but got {(int)updateResp.StatusCode}. Body: {body}");
        }

        var updated = (await updateResp.Content.ReadFromJsonAsync<EmploymentEpisodeDto>())!;
        Assert.NotNull(updated.TerminationDate);
        Assert.Equal("Layoff", updated.SeparationReason);
        Assert.True(updated.EligibleForRehire);
        Assert.Equal("End of project - good worker", updated.SeparationNotes);
        Assert.False(updated.IsCurrent);
    }

    [Fact]
    public async Task Can_delete_employment_episode()
    {
        await db.ResetAsync();

        var (client, employee) = await CreateAuthenticatedClientWithEmployeeAsync();

        // Get existing episode for this employee
        var listResp = await client.GetAsync($"/api/hr/employment-episodes?employeeId={employee.Id}");
        listResp.EnsureSuccessStatusCode();
        var episodes = await listResp.Content.ReadFromJsonAsync<PagedResult<EmploymentEpisodeListDto>>();
        var episodeId = episodes!.Items[0].Id;

        // Delete it
        var deleteResp = await client.DeleteAsync($"/api/hr/employment-episodes/{episodeId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        // Deleted episode should return 404 on GET
        var getResp = await client.GetAsync($"/api/hr/employment-episodes/{episodeId}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Cannot_create_employment_episode_for_nonexistent_employee()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var create = CreateValidEmploymentEpisodeCommand(Guid.NewGuid()); // Non-existent employee

        var createResp = await client.PostAsJsonAsync("/api/hr/employment-episodes", create);
        Assert.Equal(HttpStatusCode.NotFound, createResp.StatusCode);
    }
}
