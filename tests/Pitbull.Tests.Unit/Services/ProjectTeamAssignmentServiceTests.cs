using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Core.Domain;
using Pitbull.Core.Services;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Services;

namespace Pitbull.Tests.Unit.Services;

public class ProjectTeamAssignmentServiceTests
{
    [Fact]
    public async Task AssignTeamMembersAsync_StagesAssignmentsForOuterSave()
    {
        await using Pitbull.Core.Data.PitbullDbContext db = TestDbContextFactory.Create();
        Guid projectId = Guid.NewGuid();
        Guid employeeId = Guid.NewGuid();

        db.Set<Project>().Add(new Project
        {
            Id = projectId,
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            Name = "Team Assign",
            Number = "PRJ-TA-001",
            Status = ProjectStatus.PreConstruction,
            Type = ProjectType.Commercial,
            CreatedAt = DateTime.UtcNow
        });
        db.Set<Employee>().Add(new Employee
        {
            Id = employeeId,
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeNumber = "EMP-TA-1",
            FirstName = "Pat",
            LastName = "Manager",
            Email = "pat@example.com",
            IsActive = true
        });
        await db.SaveChangesAsync();

        var service = new ProjectTeamAssignmentService(db, NullLogger<ProjectTeamAssignmentService>.Instance);
        var members = new List<ProjectTeamMemberRequest>
        {
            new(employeeId, "Project Manager", AssignmentRole.Manager)
        };

        var result = await service.AssignTeamMembersAsync(projectId, members, DateTime.UtcNow);

        result.IsSuccess.Should().BeTrue();
        result.Value.ProjectManagerId.Should().Be(employeeId);

        (await db.Set<ProjectAssignment>().CountAsync()).Should().Be(0);

        await db.SaveChangesAsync();

        var assignments = await db.Set<ProjectAssignment>()
            .Where(a => a.ProjectId == projectId)
            .ToListAsync();
        assignments.Should().HaveCount(1);
        assignments[0].EmployeeId.Should().Be(employeeId);
        assignments[0].Role.Should().Be(AssignmentRole.Manager);
        assignments[0].IsActive.Should().BeTrue();
    }
}