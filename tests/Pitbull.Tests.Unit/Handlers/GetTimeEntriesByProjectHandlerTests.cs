using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.GetTimeEntriesByProject;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class GetTimeEntriesByProjectHandlerTests
{
    [Fact]
    public async Task Handle_ProjectWithEntries_ReturnsEntries()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (project, _) = await SetupTestData(db);
        var handler = new GetTimeEntriesByProjectHandler(db);
        
        var query = new GetTimeEntriesByProjectQuery(project.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.ProjectId.Should().Be(project.Id);
        result.Value.ProjectName.Should().Be("Test Project");
        result.Value.TimeEntries.Should().HaveCount(3);
        result.Value.TotalCount.Should().Be(3);
    }

    [Fact]
    public async Task Handle_WithDateFilter_ReturnsFilteredEntries()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (project, _) = await SetupTestData(db);
        var handler = new GetTimeEntriesByProjectHandler(db);
        
        var query = new GetTimeEntriesByProjectQuery(
            project.Id,
            StartDate: new DateOnly(2026, 2, 3),
            EndDate: new DateOnly(2026, 2, 4)
        );

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TimeEntries.Should().HaveCount(2);
    }

    [Fact]
    public async Task Handle_WithStatusFilter_ReturnsFilteredEntries()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (project, _) = await SetupTestData(db);
        var handler = new GetTimeEntriesByProjectHandler(db);
        
        var query = new GetTimeEntriesByProjectQuery(
            project.Id,
            Status: TimeEntryStatus.Approved
        );

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TimeEntries.Should().HaveCount(1);
        result.Value.TimeEntries.All(te => te.Status == TimeEntryStatus.Approved).Should().BeTrue();
    }

    [Fact]
    public async Task Handle_WithSummary_IncludesSummaryData()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (project, _) = await SetupTestData(db);
        var handler = new GetTimeEntriesByProjectHandler(db);
        
        var query = new GetTimeEntriesByProjectQuery(
            project.Id,
            IncludeSummary: true
        );

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Summary.Should().NotBeNull();
        result.Value.Summary!.TotalRegularHours.Should().Be(24m); // 8 + 8 + 8
        result.Value.Summary.TotalOvertimeHours.Should().Be(4m); // 2 + 2 + 0
        result.Value.Summary.TotalHours.Should().Be(28m);
        result.Value.Summary.SubmittedCount.Should().Be(1);
        result.Value.Summary.ApprovedCount.Should().Be(1);
        result.Value.Summary.DraftCount.Should().Be(1);
    }

    [Fact]
    public async Task Handle_ProjectNotFound_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new GetTimeEntriesByProjectHandler(db);
        
        var query = new GetTimeEntriesByProjectQuery(Guid.NewGuid());

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task Handle_Pagination_Works()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (project, _) = await SetupTestData(db);
        var handler = new GetTimeEntriesByProjectHandler(db);
        
        var query = new GetTimeEntriesByProjectQuery(project.Id)
        {
            Page = 1,
            PageSize = 2
        };

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TimeEntries.Should().HaveCount(2);
        result.Value.TotalCount.Should().Be(3);
        result.Value.TotalPages.Should().Be(2);
        result.Value.Page.Should().Be(1);
    }

    private static async Task<(Project, Employee)> SetupTestData(
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
            Name = "Test Project",
            Number = "PRJ-2026-001",
            Status = ProjectStatus.Active
        };
        db.Set<Project>().Add(project);

        var costCode = new CostCode
        {
            Code = "01-100",
            Description = "General Labor",
            IsActive = true
        };
        db.Set<CostCode>().Add(costCode);

        await db.SaveChangesAsync();

        // Create multiple time entries
        var entries = new[]
        {
            new TimeEntry
            {
                Date = new DateOnly(2026, 2, 3),
                EmployeeId = employee.Id,
                ProjectId = project.Id,
                CostCodeId = costCode.Id,
                RegularHours = 8m,
                OvertimeHours = 2m,
                Status = TimeEntryStatus.Submitted
            },
            new TimeEntry
            {
                Date = new DateOnly(2026, 2, 4),
                EmployeeId = employee.Id,
                ProjectId = project.Id,
                CostCodeId = costCode.Id,
                RegularHours = 8m,
                OvertimeHours = 2m,
                Status = TimeEntryStatus.Approved
            },
            new TimeEntry
            {
                Date = new DateOnly(2026, 2, 5),
                EmployeeId = employee.Id,
                ProjectId = project.Id,
                CostCodeId = costCode.Id,
                RegularHours = 8m,
                OvertimeHours = 0m,
                Status = TimeEntryStatus.Draft
            }
        };

        db.Set<TimeEntry>().AddRange(entries);
        await db.SaveChangesAsync();

        return (project, employee);
    }
}
