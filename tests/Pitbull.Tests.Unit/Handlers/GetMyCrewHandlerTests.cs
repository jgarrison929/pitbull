using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.GetMyCrew;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class GetMyCrewHandlerTests
{
    [Fact]
    public async Task Handle_ValidSupervisor_ReturnsCrewMembers()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (supervisor, crew) = await SetupCrewData(db, 3);
        var handler = new GetMyCrewHandler(db);
        
        var query = new GetMyCrewQuery(supervisor.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.SupervisorId.Should().Be(supervisor.Id);
        result.Value.SupervisorName.Should().Be(supervisor.FullName);
        result.Value.CrewCount.Should().Be(3);
        result.Value.CrewMembers.Should().HaveCount(3);
    }

    [Fact]
    public async Task Handle_SupervisorNotFound_ReturnsError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new GetMyCrewHandler(db);
        
        var query = new GetMyCrewQuery(Guid.NewGuid());

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("SUPERVISOR_NOT_FOUND");
    }

    [Fact]
    public async Task Handle_NoCrew_ReturnsEmptyList()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        
        // Create supervisor with no crew
        var supervisor = new Employee
        {
            EmployeeNumber = "SUP001",
            FirstName = "Jane",
            LastName = "Foreman",
            IsActive = true,
            Classification = EmployeeClassification.Supervisor
        };
        db.Set<Employee>().Add(supervisor);
        await db.SaveChangesAsync();
        
        var handler = new GetMyCrewHandler(db);
        var query = new GetMyCrewQuery(supervisor.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.CrewCount.Should().Be(0);
        result.Value.CrewMembers.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_ActiveOnlyTrue_ExcludesInactiveEmployees()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (supervisor, _) = await SetupCrewData(db, 2);
        
        // Add inactive crew member
        var inactiveMember = new Employee
        {
            EmployeeNumber = "E999",
            FirstName = "Inactive",
            LastName = "Worker",
            IsActive = false,
            SupervisorId = supervisor.Id
        };
        db.Set<Employee>().Add(inactiveMember);
        await db.SaveChangesAsync();
        
        var handler = new GetMyCrewHandler(db);
        var query = new GetMyCrewQuery(supervisor.Id, ActiveOnly: true);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.CrewCount.Should().Be(2); // Only active members
        result.Value.CrewMembers.Should().NotContain(m => m.FullName == "Inactive Worker");
    }

    [Fact]
    public async Task Handle_ActiveOnlyFalse_IncludesInactiveEmployees()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (supervisor, _) = await SetupCrewData(db, 2);
        
        // Add inactive crew member
        var inactiveMember = new Employee
        {
            EmployeeNumber = "E999",
            FirstName = "Inactive",
            LastName = "Worker",
            IsActive = false,
            SupervisorId = supervisor.Id
        };
        db.Set<Employee>().Add(inactiveMember);
        await db.SaveChangesAsync();
        
        var handler = new GetMyCrewHandler(db);
        var query = new GetMyCrewQuery(supervisor.Id, ActiveOnly: false);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.CrewCount.Should().Be(3); // Including inactive
    }

    [Fact]
    public async Task Handle_IncludesProjectAssignments()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (supervisor, crew) = await SetupCrewData(db, 1);
        
        // Create a project and assign crew member
        var project = new Project
        {
            Name = "Test Project",
            Number = "PRJ-001",
            Status = ProjectStatus.Active
        };
        db.Set<Project>().Add(project);
        await db.SaveChangesAsync();
        
        var assignment = new ProjectAssignment
        {
            EmployeeId = crew[0].Id,
            ProjectId = project.Id,
            Role = AssignmentRole.Worker,
            StartDate = DateOnly.FromDateTime(DateTime.Today.AddDays(-30)),
            IsActive = true
        };
        db.Set<ProjectAssignment>().Add(assignment);
        await db.SaveChangesAsync();
        
        var handler = new GetMyCrewHandler(db);
        var query = new GetMyCrewQuery(supervisor.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var crewMember = result.Value!.CrewMembers.First();
        crewMember.AssignedProjects.Should().HaveCount(1);
        crewMember.AssignedProjects[0].ProjectNumber.Should().Be("PRJ-001");
        crewMember.AssignedProjects[0].IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_ExcludesExpiredAssignments()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (supervisor, crew) = await SetupCrewData(db, 1);
        
        var project = new Project
        {
            Name = "Test Project",
            Number = "PRJ-001",
            Status = ProjectStatus.Active
        };
        db.Set<Project>().Add(project);
        await db.SaveChangesAsync();
        
        // Create expired assignment
        var assignment = new ProjectAssignment
        {
            EmployeeId = crew[0].Id,
            ProjectId = project.Id,
            Role = AssignmentRole.Worker,
            StartDate = DateOnly.FromDateTime(DateTime.Today.AddDays(-60)),
            EndDate = DateOnly.FromDateTime(DateTime.Today.AddDays(-30)), // Expired
            IsActive = true
        };
        db.Set<ProjectAssignment>().Add(assignment);
        await db.SaveChangesAsync();
        
        var handler = new GetMyCrewHandler(db);
        var query = new GetMyCrewQuery(supervisor.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var crewMember = result.Value!.CrewMembers.First();
        crewMember.AssignedProjects.Should().BeEmpty(); // Expired assignment excluded
    }

    [Fact]
    public async Task Handle_ReturnsCrewSortedByLastNameThenFirstName()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        
        var supervisor = new Employee
        {
            EmployeeNumber = "SUP001",
            FirstName = "Jane",
            LastName = "Foreman",
            IsActive = true,
            Classification = EmployeeClassification.Supervisor
        };
        db.Set<Employee>().Add(supervisor);
        await db.SaveChangesAsync();
        
        // Add crew members in non-alphabetical order
        var crew = new[]
        {
            new Employee { EmployeeNumber = "E001", FirstName = "Zack", LastName = "Adams", IsActive = true, SupervisorId = supervisor.Id },
            new Employee { EmployeeNumber = "E002", FirstName = "Alice", FirstName = "Demo", IsActive = true, SupervisorId = supervisor.Id },
            new Employee { EmployeeNumber = "E003", FirstName = "Bob", LastName = "Adams", IsActive = true, SupervisorId = supervisor.Id },
        };
        db.Set<Employee>().AddRange(crew);
        await db.SaveChangesAsync();
        
        var handler = new GetMyCrewHandler(db);
        var query = new GetMyCrewQuery(supervisor.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var names = result.Value!.CrewMembers.Select(c => c.FullName).ToList();
        names[0].Should().Be("Bob Adams"); // Adams, Bob
        names[1].Should().Be("Zack Adams"); // Adams, Zack
        names[2].Should().Be("Alice Wilson"); // Wilson, Alice
    }

    private static async Task<(Employee Supervisor, List<Employee> Crew)> SetupCrewData(
        Pitbull.Core.Data.PitbullDbContext db, int crewCount)
    {
        var supervisor = new Employee
        {
            EmployeeNumber = "SUP001",
            FirstName = "Jane",
            LastName = "Foreman",
            IsActive = true,
            Classification = EmployeeClassification.Supervisor
        };
        db.Set<Employee>().Add(supervisor);
        await db.SaveChangesAsync();

        var crew = new List<Employee>();
        for (int i = 1; i <= crewCount; i++)
        {
            var employee = new Employee
            {
                EmployeeNumber = $"E00{i}",
                FirstName = "John",
                LastName = $"Worker{i}",
                IsActive = true,
                Classification = EmployeeClassification.Hourly,
                BaseHourlyRate = 35m,
                SupervisorId = supervisor.Id
            };
            crew.Add(employee);
            db.Set<Employee>().Add(employee);
        }

        await db.SaveChangesAsync();
        return (supervisor, crew);
    }
}
