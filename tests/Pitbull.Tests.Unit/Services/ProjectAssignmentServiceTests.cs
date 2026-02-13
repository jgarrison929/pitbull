using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Services;

public class ProjectAssignmentServiceTests
{
    #region AssignEmployeeToProjectAsync Tests

    [Fact]
    public async Task AssignEmployeeToProjectAsync_ValidRequest_CreatesAssignment()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project) = await SetupTestData(db);
        var service = CreateService(db);

        // Act
        var result = await service.AssignEmployeeToProjectAsync(
            employee.Id,
            project.Id,
            AssignmentRole.Worker,
            new DateOnly(2026, 2, 1),
            notes: "Assigned to foundation work"
        );

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.EmployeeId.Should().Be(employee.Id);
        result.Value.ProjectId.Should().Be(project.Id);
        result.Value.Role.Should().Be(AssignmentRole.Worker);
        result.Value.IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task AssignEmployeeToProjectAsync_WithManagerRole_SetsCorrectRole()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project) = await SetupTestData(db);
        var service = CreateService(db);

        // Act
        var result = await service.AssignEmployeeToProjectAsync(
            employee.Id,
            project.Id,
            AssignmentRole.Manager
        );

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Role.Should().Be(AssignmentRole.Manager);
        result.Value.RoleDescription.Should().Be("Manager");
    }

    [Fact]
    public async Task AssignEmployeeToProjectAsync_EmployeeNotFound_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, project) = await SetupTestData(db);
        var service = CreateService(db);

        // Act
        var result = await service.AssignEmployeeToProjectAsync(
            Guid.NewGuid(),
            project.Id
        );

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("EMPLOYEE_NOT_FOUND");
    }

    [Fact]
    public async Task AssignEmployeeToProjectAsync_ProjectNotFound_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, _) = await SetupTestData(db);
        var service = CreateService(db);

        // Act
        var result = await service.AssignEmployeeToProjectAsync(
            employee.Id,
            Guid.NewGuid()
        );

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("PROJECT_NOT_FOUND");
    }

    [Fact]
    public async Task AssignEmployeeToProjectAsync_DuplicateAssignment_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project) = await SetupTestData(db);
        var service = CreateService(db);

        // Create first assignment
        await service.AssignEmployeeToProjectAsync(employee.Id, project.Id);

        // Act - try to create duplicate
        var result = await service.AssignEmployeeToProjectAsync(employee.Id, project.Id);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("ALREADY_ASSIGNED");
    }

    [Fact]
    public async Task AssignEmployeeToProjectAsync_InactiveEmployee_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, project) = await SetupTestData(db);
        
        // Create inactive employee
        var inactiveEmployee = new Employee
        {
            EmployeeNumber = "E999",
            FirstName = "Inactive",
            LastName = "Worker",
            IsActive = false
        };
        db.Set<Employee>().Add(inactiveEmployee);
        await db.SaveChangesAsync();
        
        var service = CreateService(db);

        // Act
        var result = await service.AssignEmployeeToProjectAsync(
            inactiveEmployee.Id,
            project.Id
        );

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("EMPLOYEE_NOT_FOUND");
    }

    [Fact]
    public async Task AssignEmployeeToProjectAsync_InvalidDateRange_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project) = await SetupTestData(db);
        var service = CreateService(db);

        // Act
        var result = await service.AssignEmployeeToProjectAsync(
            employee.Id,
            project.Id,
            startDate: new DateOnly(2026, 3, 1),
            endDate: new DateOnly(2026, 2, 1) // End before start
        );

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_DATE_RANGE");
    }

    [Fact]
    public async Task AssignEmployeeToProjectAsync_WithEndDate_SetsEndDate()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project) = await SetupTestData(db);
        var service = CreateService(db);

        // Act
        var result = await service.AssignEmployeeToProjectAsync(
            employee.Id,
            project.Id,
            startDate: new DateOnly(2026, 2, 1),
            endDate: new DateOnly(2026, 6, 30)
        );

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.StartDate.Should().Be(new DateOnly(2026, 2, 1));
        result.Value.EndDate.Should().Be(new DateOnly(2026, 6, 30));
    }

    #endregion

    #region GetProjectAssignmentsAsync Tests

    [Fact]
    public async Task GetProjectAssignmentsAsync_ReturnsActiveAssignments()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (project, _) = await SetupTestDataWithAssignments(db);
        var service = CreateService(db);

        // Act
        var result = await service.GetProjectAssignmentsAsync(project.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(2); // Only active assignments
        result.Value.Should().OnlyContain(a => a.IsActive);
    }

    [Fact]
    public async Task GetProjectAssignmentsAsync_ActiveOnlyFalse_ReturnsAllAssignments()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (project, _) = await SetupTestDataWithAssignments(db);
        var service = CreateService(db);

        // Act
        var result = await service.GetProjectAssignmentsAsync(project.Id, activeOnly: false);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(3); // All assignments including inactive
    }

    [Fact]
    public async Task GetProjectAssignmentsAsync_NoAssignments_ReturnsEmptyList()
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
        
        var service = CreateService(db);

        // Act
        var result = await service.GetProjectAssignmentsAsync(project.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    #endregion

    #region GetEmployeeProjectsAsync Tests

    [Fact]
    public async Task GetEmployeeProjectsAsync_ReturnsActiveAssignments()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, employee) = await SetupEmployeeProjectData(db);
        var service = CreateService(db);

        // Act
        var result = await service.GetEmployeeProjectsAsync(employee.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(1); // Only active assignment for this employee
    }

    [Fact]
    public async Task GetEmployeeProjectsAsync_WithAsOfDate_FiltersCorrectly()
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
        
        var service = CreateService(db);

        // Act - Query for date within range
        var resultInRange = await service.GetEmployeeProjectsAsync(
            employee.Id,
            asOfDate: new DateOnly(2026, 1, 15)
        );

        // Query for date outside range
        var resultOutOfRange = await service.GetEmployeeProjectsAsync(
            employee.Id,
            asOfDate: new DateOnly(2026, 2, 15)
        );

        // Assert
        resultInRange.IsSuccess.Should().BeTrue();
        resultInRange.Value.Should().HaveCount(1);
        
        resultOutOfRange.IsSuccess.Should().BeTrue();
        resultOutOfRange.Value.Should().BeEmpty();
    }

    #endregion

    #region RemoveAssignmentAsync Tests

    [Fact]
    public async Task RemoveAssignmentAsync_ValidAssignmentId_DeactivatesAssignment()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var assignment = await SetupAssignmentTestData(db);
        var service = CreateService(db);

        // Act
        var result = await service.RemoveAssignmentAsync(assignment.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();
        
        var updated = await db.Set<ProjectAssignment>()
            .IgnoreQueryFilters()
            .FirstAsync(a => a.Id == assignment.Id);
        updated.IsActive.Should().BeFalse();
        updated.EndDate.Should().NotBeNull();
    }

    [Fact]
    public async Task RemoveAssignmentAsync_WithEndDate_SetsSpecifiedEndDate()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var assignment = await SetupAssignmentTestData(db);
        var service = CreateService(db);
        
        var endDate = new DateOnly(2026, 6, 30);

        // Act
        var result = await service.RemoveAssignmentAsync(assignment.Id, endDate);

        // Assert
        result.IsSuccess.Should().BeTrue();
        
        var updated = await db.Set<ProjectAssignment>()
            .IgnoreQueryFilters()
            .FirstAsync(a => a.Id == assignment.Id);
        updated.EndDate.Should().Be(endDate);
    }

    [Fact]
    public async Task RemoveAssignmentAsync_AssignmentNotFound_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        await SetupAssignmentTestData(db);
        var service = CreateService(db);

        // Act
        var result = await service.RemoveAssignmentAsync(Guid.NewGuid());

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("ASSIGNMENT_NOT_FOUND");
    }

    [Fact]
    public async Task RemoveAssignmentAsync_AlreadyInactive_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var assignment = await SetupAssignmentTestData(db);
        
        // Deactivate the assignment
        assignment.IsActive = false;
        await db.SaveChangesAsync();
        
        var service = CreateService(db);

        // Act
        var result = await service.RemoveAssignmentAsync(assignment.Id);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("ASSIGNMENT_NOT_FOUND");
    }

    #endregion

    #region RemoveAssignmentByIdsAsync Tests

    [Fact]
    public async Task RemoveAssignmentByIdsAsync_ValidIds_DeactivatesAssignment()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var assignment = await SetupAssignmentTestData(db);
        var service = CreateService(db);

        // Act
        var result = await service.RemoveAssignmentByIdsAsync(
            assignment.EmployeeId,
            assignment.ProjectId
        );

        // Assert
        result.IsSuccess.Should().BeTrue();
        
        var updated = await db.Set<ProjectAssignment>()
            .IgnoreQueryFilters()
            .FirstAsync(a => a.Id == assignment.Id);
        updated.IsActive.Should().BeFalse();
    }

    [Fact]
    public async Task RemoveAssignmentByIdsAsync_NoActiveAssignment_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        await SetupAssignmentTestData(db);
        var service = CreateService(db);

        // Act
        var result = await service.RemoveAssignmentByIdsAsync(
            Guid.NewGuid(),
            Guid.NewGuid()
        );

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("ASSIGNMENT_NOT_FOUND");
    }

    #endregion

    #region Test Helpers

    private static ProjectAssignmentService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        return new ProjectAssignmentService(db, NullLogger<ProjectAssignmentService>.Instance);
    }

    private static async Task<(Employee, Project)> SetupTestData(
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

        await db.SaveChangesAsync();
        return (employee, project);
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

    private static async Task<ProjectAssignment> SetupAssignmentTestData(
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
        return assignment;
    }

    #endregion
}
