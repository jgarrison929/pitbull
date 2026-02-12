using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.GetYesterdayCrewEntries;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class GetYesterdayCrewEntriesHandlerTests
{
    [Fact]
    public async Task Handle_ValidForeman_ReturnsYesterdayEntries()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (foreman, crew, project, costCode) = await SetupTestData(db);
        
        var yesterday = DateOnly.FromDateTime(DateTime.Today.AddDays(-1));
        
        // Create time entries for yesterday
        foreach (var member in crew)
        {
            var entry = new TimeEntry
            {
                Date = yesterday,
                EmployeeId = member.Id,
                ProjectId = project.Id,
                CostCodeId = costCode.Id,
                RegularHours = 8m,
                Status = TimeEntryStatus.Submitted
            };
            db.Set<TimeEntry>().Add(entry);
        }
        await db.SaveChangesAsync();
        
        var handler = new GetYesterdayCrewEntriesHandler(db);
        var query = new GetYesterdayCrewEntriesQuery(foreman.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.EntriesDate.Should().Be(yesterday);
        result.Value.EmployeeCount.Should().Be(2);
        result.Value.EntryCount.Should().Be(2);
        result.Value.TotalHours.Should().Be(16m);
    }

    [Fact]
    public async Task Handle_ForemanNotFound_ReturnsError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new GetYesterdayCrewEntriesHandler(db);
        var query = new GetYesterdayCrewEntriesQuery(Guid.NewGuid());

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("FOREMAN_NOT_FOUND");
    }

    [Fact]
    public async Task Handle_NoCrewMembers_ReturnsEmptyResult()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        
        var foreman = new Employee
        {
            EmployeeNumber = "FOR001",
            FirstName = "Jane",
            LastName = "Foreman",
            IsActive = true,
            Classification = EmployeeClassification.Supervisor
        };
        db.Set<Employee>().Add(foreman);
        await db.SaveChangesAsync();
        
        var handler = new GetYesterdayCrewEntriesHandler(db);
        var query = new GetYesterdayCrewEntriesQuery(foreman.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.EmployeeCount.Should().Be(0);
        result.Value.EntryCount.Should().Be(0);
        result.Value.EmployeeEntries.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_NoEntriesYesterday_ReturnsEmptyEntries()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (foreman, _, _, _) = await SetupTestData(db);
        // No time entries created
        
        var handler = new GetYesterdayCrewEntriesHandler(db);
        var query = new GetYesterdayCrewEntriesQuery(foreman.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.EntryCount.Should().Be(0);
        result.Value.EmployeeEntries.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_CustomTargetDate_ReturnsEntriesForThatDate()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (foreman, crew, project, costCode) = await SetupTestData(db);
        
        var targetDate = new DateOnly(2026, 2, 1); // Specific date
        
        // Create time entry for target date only
        var entry = new TimeEntry
        {
            Date = targetDate,
            EmployeeId = crew[0].Id,
            ProjectId = project.Id,
            CostCodeId = costCode.Id,
            RegularHours = 8m,
            OvertimeHours = 2m,
            Status = TimeEntryStatus.Submitted
        };
        db.Set<TimeEntry>().Add(entry);
        await db.SaveChangesAsync();
        
        var handler = new GetYesterdayCrewEntriesHandler(db);
        var query = new GetYesterdayCrewEntriesQuery(foreman.Id, TargetDate: targetDate);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.EntriesDate.Should().Be(targetDate);
        result.Value.EntryCount.Should().Be(1);
        result.Value.TotalHours.Should().Be(10m);
    }

    [Fact]
    public async Task Handle_MultipleEntriesPerEmployee_ReturnsAll()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (foreman, crew, project, costCode) = await SetupTestData(db);
        
        // Create second cost code
        var costCode2 = new CostCode
        {
            Code = "02-200",
            Description = "Equipment Operation",
            IsActive = true
        };
        db.Set<CostCode>().Add(costCode2);
        await db.SaveChangesAsync();
        
        var yesterday = DateOnly.FromDateTime(DateTime.Today.AddDays(-1));
        
        // Create two entries for same employee on same day
        var entry1 = new TimeEntry
        {
            Date = yesterday,
            EmployeeId = crew[0].Id,
            ProjectId = project.Id,
            CostCodeId = costCode.Id,
            RegularHours = 4m,
            Status = TimeEntryStatus.Submitted
        };
        var entry2 = new TimeEntry
        {
            Date = yesterday,
            EmployeeId = crew[0].Id,
            ProjectId = project.Id,
            CostCodeId = costCode2.Id,
            RegularHours = 4m,
            Status = TimeEntryStatus.Submitted
        };
        db.Set<TimeEntry>().AddRange(entry1, entry2);
        await db.SaveChangesAsync();
        
        var handler = new GetYesterdayCrewEntriesHandler(db);
        var query = new GetYesterdayCrewEntriesQuery(foreman.Id, TargetDate: yesterday);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.EntryCount.Should().Be(2);
        result.Value.EmployeeCount.Should().Be(1); // Still one employee
        result.Value.EmployeeEntries[0].Entries.Should().HaveCount(2);
    }

    [Fact]
    public async Task Handle_ReturnsProjectAndCostCodeDetails()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (foreman, crew, project, costCode) = await SetupTestData(db);
        
        var yesterday = DateOnly.FromDateTime(DateTime.Today.AddDays(-1));
        
        var entry = new TimeEntry
        {
            Date = yesterday,
            EmployeeId = crew[0].Id,
            ProjectId = project.Id,
            CostCodeId = costCode.Id,
            RegularHours = 8m,
            OvertimeHours = 2m,
            DoubletimeHours = 1m,
            Description = "Test work",
            Status = TimeEntryStatus.Submitted
        };
        db.Set<TimeEntry>().Add(entry);
        await db.SaveChangesAsync();
        
        var handler = new GetYesterdayCrewEntriesHandler(db);
        var query = new GetYesterdayCrewEntriesQuery(foreman.Id, TargetDate: yesterday);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var entryDto = result.Value!.EmployeeEntries[0].Entries[0];
        
        entryDto.ProjectId.Should().Be(project.Id);
        entryDto.ProjectName.Should().Be(project.Name);
        entryDto.ProjectNumber.Should().Be(project.Number);
        entryDto.CostCodeId.Should().Be(costCode.Id);
        entryDto.CostCodeCode.Should().Be(costCode.Code);
        entryDto.CostCodeDescription.Should().Be(costCode.Description);
        entryDto.RegularHours.Should().Be(8m);
        entryDto.OvertimeHours.Should().Be(2m);
        entryDto.DoubletimeHours.Should().Be(1m);
        entryDto.TotalHours.Should().Be(11m);
        entryDto.Description.Should().Be("Test work");
    }

    [Fact]
    public async Task Handle_ExcludesNonCrewMembers()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (foreman, crew, project, costCode) = await SetupTestData(db);
        
        // Create another employee NOT supervised by this foreman
        var otherEmployee = new Employee
        {
            EmployeeNumber = "E999",
            FirstName = "Other",
            LastName = "Worker",
            IsActive = true,
            SupervisorId = null // No supervisor or different supervisor
        };
        db.Set<Employee>().Add(otherEmployee);
        await db.SaveChangesAsync();
        
        var yesterday = DateOnly.FromDateTime(DateTime.Today.AddDays(-1));
        
        // Create entries for both crew and non-crew
        var crewEntry = new TimeEntry
        {
            Date = yesterday,
            EmployeeId = crew[0].Id,
            ProjectId = project.Id,
            CostCodeId = costCode.Id,
            RegularHours = 8m,
            Status = TimeEntryStatus.Submitted
        };
        var otherEntry = new TimeEntry
        {
            Date = yesterday,
            EmployeeId = otherEmployee.Id,
            ProjectId = project.Id,
            CostCodeId = costCode.Id,
            RegularHours = 8m,
            Status = TimeEntryStatus.Submitted
        };
        db.Set<TimeEntry>().AddRange(crewEntry, otherEntry);
        await db.SaveChangesAsync();
        
        var handler = new GetYesterdayCrewEntriesHandler(db);
        var query = new GetYesterdayCrewEntriesQuery(foreman.Id, TargetDate: yesterday);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.EntryCount.Should().Be(1); // Only crew member's entry
        result.Value.EmployeeEntries.Should().NotContain(e => e.EmployeeName == "Other Worker");
    }

    private static async Task<(Employee Foreman, List<Employee> Crew, Project Project, CostCode CostCode)> SetupTestData(
        Pitbull.Core.Data.PitbullDbContext db)
    {
        var foreman = new Employee
        {
            EmployeeNumber = "FOR001",
            FirstName = "Jane",
            LastName = "Foreman",
            IsActive = true,
            Classification = EmployeeClassification.Supervisor
        };
        db.Set<Employee>().Add(foreman);
        await db.SaveChangesAsync();

        var crew = new List<Employee>();
        for (int i = 1; i <= 2; i++)
        {
            var employee = new Employee
            {
                EmployeeNumber = $"E00{i}",
                FirstName = "John",
                LastName = $"Worker{i}",
                IsActive = true,
                Classification = EmployeeClassification.Hourly,
                BaseHourlyRate = 35m,
                SupervisorId = foreman.Id
            };
            crew.Add(employee);
            db.Set<Employee>().Add(employee);
        }

        var project = new Project
        {
            Name = "Test Bridge Project",
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
        return (foreman, crew, project, costCode);
    }
}
