using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.GetProjectAssignments;
using Pitbull.TimeTracking.Features.GetEmployeeProjects;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class GetProjectAssignmentsHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsActiveAssignments()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (project, _) = await SetupTestDataWithAssignments(db);
        var handler = new GetProjectAssignmentsHandler(db);
        
        var query = new GetProjectAssignmentsQuery(ProjectId: project.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(2); // Only active assignments
        result.Value.Should().OnlyContain(a => a.IsActive);
    }

    [Fact]
    public async Task Handle_ActiveOnlyFalse_ReturnsAllAssignments()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (project, _) = await SetupTestDataWithAssignments(db);
        var handler = new GetProjectAssignmentsHandler(db);
        
        var query = new GetProjectAssignmentsQuery(
            ProjectId: project.Id,
            ActiveOnly: false
        );

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(3); // All assignments including inactive
    }

    [Fact]
    public async Task Handle_NoAssignments_ReturnsEmptyList()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var project = new Project
        {
            Name = "Empty Project",
            Number = "PRJ-EMPTY",
            Status = ProjectStatus.Active
        };
        db.Set<Project>().Add(project);
        await db.SaveChangesAsync();
        
        var handler = new GetProjectAssignmentsHandler(db);
        
        var query = new GetProjectAssignmentsQuery(ProjectId: project.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    private static async Task<(Project, Employee)> SetupTestDataWithAssignments(
        Pitbull.Core.Data.PitbullDbContext db)
    {
        var employee1 = new Employee
        {
            EmployeeNumber = "E001",
            FirstName = "John",
            LastName = "Worker",
            IsActive = true,
            Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 35m
        };
        var employee2 = new Employee
        {
            EmployeeNumber = "E002",
            FirstName = "Jane",
            LastName = "Manager",
            IsActive = true,
            Classification = EmployeeClassification.Supervisor,
            BaseHourlyRate = 50m
        };
        var employee3 = new Employee
        {
            EmployeeNumber = "E003",
            FirstName = "Bob",
            LastName = "Former",
            IsActive = true,
            Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 30m
        };
        db.Set<Employee>().AddRange(employee1, employee2, employee3);

        var project = new Project
        {
            Name = "Test Bridge Project",
            Number = "PRJ-2026-001",
            Status = ProjectStatus.Active
        };
        db.Set<Project>().Add(project);

        // Active assignment - Worker
        var assignment1 = new ProjectAssignment
        {
            EmployeeId = employee1.Id,
            ProjectId = project.Id,
            Role = AssignmentRole.Worker,
            StartDate = new DateOnly(2026, 1, 1),
            IsActive = true
        };
        // Active assignment - Manager  
        var assignment2 = new ProjectAssignment
        {
            EmployeeId = employee2.Id,
            ProjectId = project.Id,
            Role = AssignmentRole.Manager,
            StartDate = new DateOnly(2026, 1, 1),
            IsActive = true
        };
        // Inactive assignment
        var assignment3 = new ProjectAssignment
        {
            EmployeeId = employee3.Id,
            ProjectId = project.Id,
            Role = AssignmentRole.Worker,
            StartDate = new DateOnly(2025, 6, 1),
            EndDate = new DateOnly(2025, 12, 31),
            IsActive = false
        };
        db.Set<ProjectAssignment>().AddRange(assignment1, assignment2, assignment3);

        await db.SaveChangesAsync();
        return (project, employee1);
    }
}

public class GetEmployeeProjectsHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsActiveAssignments()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, employee) = await SetupEmployeeProjectData(db);
        var handler = new GetEmployeeProjectsHandler(db);
        
        var query = new GetEmployeeProjectsQuery(EmployeeId: employee.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(1); // Only active assignment for this employee
    }

    [Fact]
    public async Task Handle_WithAsOfDate_FiltersCorrectly()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        
        var employee = new Employee
        {
            EmployeeNumber = "E001",
            FirstName = "John",
            LastName = "Worker",
            IsActive = true,
            Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 35m
        };
        db.Set<Employee>().Add(employee);

        var project = new Project
        {
            Name = "Test Project",
            Number = "PRJ-001",
            Status = ProjectStatus.Active
        };
        db.Set<Project>().Add(project);

        // Assignment valid only in January
        var assignment = new ProjectAssignment
        {
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            Role = AssignmentRole.Worker,
            StartDate = new DateOnly(2026, 1, 1),
            EndDate = new DateOnly(2026, 1, 31),
            IsActive = true
        };
        db.Set<ProjectAssignment>().Add(assignment);
        await db.SaveChangesAsync();
        
        var handler = new GetEmployeeProjectsHandler(db);
        
        // Query for date within range
        var queryInRange = new GetEmployeeProjectsQuery(
            EmployeeId: employee.Id,
            AsOfDate: new DateOnly(2026, 1, 15)
        );

        // Query for date outside range
        var queryOutOfRange = new GetEmployeeProjectsQuery(
            EmployeeId: employee.Id,
            AsOfDate: new DateOnly(2026, 2, 15)
        );

        // Act
        var resultInRange = await handler.Handle(queryInRange, CancellationToken.None);
        var resultOutOfRange = await handler.Handle(queryOutOfRange, CancellationToken.None);

        // Assert
        resultInRange.IsSuccess.Should().BeTrue();
        resultInRange.Value.Should().HaveCount(1);
        
        resultOutOfRange.IsSuccess.Should().BeTrue();
        resultOutOfRange.Value.Should().BeEmpty();
    }

    private static async Task<(Project, Employee)> SetupEmployeeProjectData(
        Pitbull.Core.Data.PitbullDbContext db)
    {
        var employee = new Employee
        {
            EmployeeNumber = "E001",
            FirstName = "John",
            LastName = "Worker",
            IsActive = true,
            Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 35m
        };
        db.Set<Employee>().Add(employee);

        var project = new Project
        {
            Name = "Test Bridge Project",
            Number = "PRJ-2026-001",
            Status = ProjectStatus.Active
        };
        db.Set<Project>().Add(project);

        // Active assignment
        var assignment = new ProjectAssignment
        {
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            Role = AssignmentRole.Worker,
            StartDate = new DateOnly(2026, 1, 1),
            IsActive = true
        };
        db.Set<ProjectAssignment>().Add(assignment);

        await db.SaveChangesAsync();
        return (project, employee);
    }
}
