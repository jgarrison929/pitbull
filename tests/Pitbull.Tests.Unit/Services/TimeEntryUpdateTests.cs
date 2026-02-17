using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.BatchCreateTimeEntries;
using Pitbull.TimeTracking.Features.CreateTimeEntry;
using Pitbull.TimeTracking.Features.UpdateTimeEntry;
using Pitbull.TimeTracking.Services;

namespace Pitbull.Tests.Unit.Services;

public sealed class TimeEntryUpdateTests
{
    [Fact]
    public async Task Update_DraftToSubmitted_SetsSubmittedMetadata()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);

        var draft = new TimeEntry
        {
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            CostCodeId = costCode.Id,
            RegularHours = 8m,
            Status = TimeEntryStatus.Draft
        };
        db.Set<TimeEntry>().Add(draft);
        await db.SaveChangesAsync();

        var submitterId = Guid.NewGuid();
        var beforeSubmit = DateTime.UtcNow;
        var command = new UpdateTimeEntryCommand(
            TimeEntryId: draft.Id,
            NewStatus: TimeEntryStatus.Submitted,
            SubmittedById: submitterId);

        // Act
        var result = await service.UpdateTimeEntryAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();

        var updated = db.Set<TimeEntry>().Single(te => te.Id == draft.Id);
        updated.Status.Should().Be(TimeEntryStatus.Submitted);
        updated.SubmittedById.Should().Be(submitterId);
        updated.SubmittedAt.Should().NotBeNull();
        updated.SubmittedAt!.Value.Should().BeOnOrAfter(beforeSubmit);
    }

    private static TimeEntryService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        return new TimeEntryService(
            db,
            new CreateTimeEntryValidator(),
            new UpdateTimeEntryValidator(),
            new BatchCreateTimeEntriesValidator(),
            new LaborCostCalculator(),
            Mock.Of<IPayPeriodService>(),
            NullLogger<TimeEntryService>.Instance
        );
    }

    private static async Task<(Employee employee, Project project, CostCode costCode)> SetupTestData(
        Pitbull.Core.Data.PitbullDbContext db)
    {
        var employee = new Employee
        {
            FirstName = "Alex",
            LastName = "Foreman",
            EmployeeNumber = "EMP010",
            Email = "alex@test.com",
            IsActive = true,
            Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 35m
        };
        db.Set<Employee>().Add(employee);

        var project = new Project
        {
            Name = "Bridge Retrofit",
            Number = "P-010",
            Status = ProjectStatus.Active
        };
        db.Set<Project>().Add(project);

        var costCode = new CostCode
        {
            Code = "03-100",
            Description = "Concrete Work",
            IsActive = true,
            CostType = CostType.Labor
        };
        db.Set<CostCode>().Add(costCode);

        var assignment = new ProjectAssignment
        {
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)),
            IsActive = true,
            Role = AssignmentRole.Worker
        };
        db.Set<ProjectAssignment>().Add(assignment);

        await db.SaveChangesAsync();
        return (employee, project, costCode);
    }
}
