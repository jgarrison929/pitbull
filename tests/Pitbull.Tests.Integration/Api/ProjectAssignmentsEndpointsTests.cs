using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class ProjectAssignmentsEndpointsTests(PostgresFixture db) : IAsyncLifetime
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

    private static CreateProjectCommand CreateTestProjectCommand(string suffix) => new(
        Name: $"Test Project {suffix}",
        Number: $"PRJ-{Guid.NewGuid():N}".Substring(0, 15),
        Description: "Integration test project",
        Type: ProjectType.Commercial,
        Address: null,
        City: null,
        State: null,
        ZipCode: null,
        ClientName: null,
        ClientContact: null,
        ClientEmail: null,
        ClientPhone: null,
        StartDate: null,
        EstimatedCompletionDate: null,
        ContractAmount: 100000m,
        ProjectManagerId: null,
        SuperintendentId: null,
        SourceBidId: null
    );

    #region Auth Tests

    [Fact]
    public async Task Get_assignments_by_project_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync($"/api/project-assignments/by-project/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Get_assignments_by_employee_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync($"/api/project-assignments/by-employee/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Create_assignment_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.PostAsJsonAsync("/api/project-assignments", new
        {
            employeeId = Guid.NewGuid(),
            projectId = Guid.NewGuid(),
            role = (int)AssignmentRole.Worker
        });

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Delete_assignment_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.DeleteAsync($"/api/project-assignments/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    #endregion

    #region CRUD Tests

    [Fact]
    public async Task Can_assign_employee_to_project_and_retrieve()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create an employee
        var employeeResp = await client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber = $"PA-{Guid.NewGuid():N}".Substring(0, 15),
            firstName = "Assignment",
            lastName = "Test",
            classification = (int)EmployeeClassification.Hourly,
            baseHourlyRate = 25.00m
        });
        employeeResp.EnsureSuccessStatusCode();
        var employee = await employeeResp.Content.ReadFromJsonAsync<EmployeeDto>();

        // Create a project using proper command
        var projectCommand = CreateTestProjectCommand("Assignment");
        var projectResp = await client.PostAsJsonAsync("/api/projects", projectCommand);
        if (projectResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await projectResp.Content.ReadAsStringAsync();
            Assert.Fail($"Project create failed: {(int)projectResp.StatusCode}. Body: {body}");
        }
        var project = await projectResp.Content.ReadFromJsonAsync<ProjectDto>();

        // Assign employee to project
        var assignResp = await client.PostAsJsonAsync("/api/project-assignments", new
        {
            employeeId = employee!.Id,
            projectId = project!.Id,
            role = (int)AssignmentRole.Worker,
            notes = "Integration test assignment"
        });

        if (assignResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await assignResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 201 Created but got {(int)assignResp.StatusCode}. Body: {body}");
        }

        var assignment = await assignResp.Content.ReadFromJsonAsync<ProjectAssignmentDto>();
        Assert.NotNull(assignment);
        Assert.NotEqual(Guid.Empty, assignment!.Id);
        Assert.Equal(employee.Id, assignment.EmployeeId);
        Assert.Equal(project.Id, assignment.ProjectId);
        Assert.Equal(AssignmentRole.Worker, assignment.Role);
        Assert.True(assignment.IsActive);
        Assert.Equal("Integration test assignment", assignment.Notes);

        // Verify by getting assignments for the project
        var byProjectResp = await client.GetAsync($"/api/project-assignments/by-project/{project.Id}");
        Assert.Equal(HttpStatusCode.OK, byProjectResp.StatusCode);
        var projectAssignments = await byProjectResp.Content.ReadFromJsonAsync<List<ProjectAssignmentDto>>();
        Assert.NotNull(projectAssignments);
        Assert.Contains(projectAssignments, a => a.Id == assignment.Id);

        // Verify by getting assignments for the employee
        var byEmployeeResp = await client.GetAsync($"/api/project-assignments/by-employee/{employee.Id}");
        Assert.Equal(HttpStatusCode.OK, byEmployeeResp.StatusCode);
        var employeeAssignments = await byEmployeeResp.Content.ReadFromJsonAsync<List<ProjectAssignmentDto>>();
        Assert.NotNull(employeeAssignments);
        Assert.Contains(employeeAssignments, a => a.Id == assignment.Id);
    }

    [Fact]
    public async Task Can_remove_assignment_by_id()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create employee
        var employeeResp = await client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber = $"RM-{Guid.NewGuid():N}".Substring(0, 15),
            firstName = "Remove",
            lastName = "Test",
            classification = (int)EmployeeClassification.Hourly,
            baseHourlyRate = 25.00m
        });
        employeeResp.EnsureSuccessStatusCode();
        var employee = await employeeResp.Content.ReadFromJsonAsync<EmployeeDto>();

        // Create project
        var projectCommand = CreateTestProjectCommand("Remove");
        var projectResp = await client.PostAsJsonAsync("/api/projects", projectCommand);
        projectResp.EnsureSuccessStatusCode();
        var project = await projectResp.Content.ReadFromJsonAsync<ProjectDto>();

        // Assign
        var assignResp = await client.PostAsJsonAsync("/api/project-assignments", new
        {
            employeeId = employee!.Id,
            projectId = project!.Id,
            role = (int)AssignmentRole.Worker
        });
        assignResp.EnsureSuccessStatusCode();
        var assignment = await assignResp.Content.ReadFromJsonAsync<ProjectAssignmentDto>();

        // Remove by assignment ID
        var deleteResp = await client.DeleteAsync($"/api/project-assignments/{assignment!.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        // Verify assignment is no longer active (activeOnly=true should not return it)
        var byProjectResp = await client.GetAsync($"/api/project-assignments/by-project/{project.Id}?activeOnly=true");
        Assert.Equal(HttpStatusCode.OK, byProjectResp.StatusCode);
        var assignments = await byProjectResp.Content.ReadFromJsonAsync<List<ProjectAssignmentDto>>();
        Assert.DoesNotContain(assignments!, a => a.Id == assignment.Id && a.IsActive);
    }

    #endregion

    #region Error Cases

    [Fact]
    public async Task Assign_nonexistent_employee_returns_404()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create a valid project
        var projectCommand = CreateTestProjectCommand("NonExistEmp");
        var projectResp = await client.PostAsJsonAsync("/api/projects", projectCommand);
        projectResp.EnsureSuccessStatusCode();
        var project = await projectResp.Content.ReadFromJsonAsync<ProjectDto>();

        // Try to assign nonexistent employee
        var assignResp = await client.PostAsJsonAsync("/api/project-assignments", new
        {
            employeeId = Guid.NewGuid(), // Doesn't exist
            projectId = project!.Id,
            role = (int)AssignmentRole.Worker
        });

        Assert.Equal(HttpStatusCode.NotFound, assignResp.StatusCode);
    }

    [Fact]
    public async Task Assign_nonexistent_project_returns_404()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create a valid employee
        var employeeResp = await client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber = $"NP-{Guid.NewGuid():N}".Substring(0, 15),
            firstName = "No",
            lastName = "Project",
            classification = (int)EmployeeClassification.Hourly,
            baseHourlyRate = 25.00m
        });
        employeeResp.EnsureSuccessStatusCode();
        var employee = await employeeResp.Content.ReadFromJsonAsync<EmployeeDto>();

        // Try to assign to nonexistent project
        var assignResp = await client.PostAsJsonAsync("/api/project-assignments", new
        {
            employeeId = employee!.Id,
            projectId = Guid.NewGuid(), // Doesn't exist
            role = (int)AssignmentRole.Worker
        });

        Assert.Equal(HttpStatusCode.NotFound, assignResp.StatusCode);
    }

    [Fact]
    public async Task Delete_nonexistent_assignment_returns_404()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var deleteResp = await client.DeleteAsync($"/api/project-assignments/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, deleteResp.StatusCode);
    }

    #endregion
}
