using FluentAssertions;
using FluentValidation;
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

public sealed class TimeEntryBatchCreateTests
{
    [Fact]
    public async Task BatchCreate_DraftMode_SetsStatusToDraft()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);

        var command = new BatchCreateTimeEntriesCommand(
            Entries:
            [
                new BatchTimeEntryItem(
                    Date: DateOnly.FromDateTime(DateTime.UtcNow),
                    EmployeeId: employee.Id,
                    ProjectId: project.Id,
                    CostCodeId: costCode.Id,
                    RegularHours: 8m)
            ],
            IsDraft: true
        );

        // Act
        var result = await service.BatchCreateTimeEntriesAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.SuccessCount.Should().Be(1);

        var entry = db.Set<TimeEntry>().First();
        entry.Status.Should().Be(TimeEntryStatus.Draft);
        entry.SubmittedAt.Should().BeNull();
        entry.SubmittedById.Should().BeNull();
    }

    [Fact]
    public async Task BatchCreate_SubmitMode_SetsStatusToSubmitted()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);
        var submitterId = Guid.NewGuid();

        var command = new BatchCreateTimeEntriesCommand(
            Entries:
            [
                new BatchTimeEntryItem(
                    Date: DateOnly.FromDateTime(DateTime.UtcNow),
                    EmployeeId: employee.Id,
                    ProjectId: project.Id,
                    CostCodeId: costCode.Id,
                    RegularHours: 8m)
            ],
            IsDraft: false,
            SubmittedById: submitterId
        );

        // Act
        var result = await service.BatchCreateTimeEntriesAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.SuccessCount.Should().Be(1);

        var entry = db.Set<TimeEntry>().First();
        entry.Status.Should().Be(TimeEntryStatus.Submitted);
    }

    [Fact]
    public async Task BatchCreate_SubmitMode_SetsSubmittedAtAndSubmittedById()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);
        var submitterId = Guid.NewGuid();
        var beforeSubmit = DateTime.UtcNow;

        var command = new BatchCreateTimeEntriesCommand(
            Entries:
            [
                new BatchTimeEntryItem(
                    Date: DateOnly.FromDateTime(DateTime.UtcNow),
                    EmployeeId: employee.Id,
                    ProjectId: project.Id,
                    CostCodeId: costCode.Id,
                    RegularHours: 8m)
            ],
            IsDraft: false,
            SubmittedById: submitterId
        );

        // Act
        var result = await service.BatchCreateTimeEntriesAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();

        var entry = db.Set<TimeEntry>().First();
        entry.SubmittedById.Should().Be(submitterId);
        entry.SubmittedAt.Should().NotBeNull();
        entry.SubmittedAt!.Value.Should().BeOnOrAfter(beforeSubmit);
    }

    [Fact]
    public async Task BatchCreate_DraftMode_AllowsZeroHours()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);

        var command = new BatchCreateTimeEntriesCommand(
            Entries:
            [
                new BatchTimeEntryItem(
                    Date: DateOnly.FromDateTime(DateTime.UtcNow),
                    EmployeeId: employee.Id,
                    ProjectId: project.Id,
                    CostCodeId: costCode.Id,
                    RegularHours: 0,
                    OvertimeHours: 0,
                    DoubletimeHours: 0)
            ],
            IsDraft: true
        );

        // Act
        var result = await service.BatchCreateTimeEntriesAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.SuccessCount.Should().Be(1);
    }

    [Fact]
    public async Task BatchCreate_InvalidEmployee_ReturnsPerEntryError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (_, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);

        var command = new BatchCreateTimeEntriesCommand(
            Entries:
            [
                new BatchTimeEntryItem(
                    Date: DateOnly.FromDateTime(DateTime.UtcNow),
                    EmployeeId: Guid.NewGuid(), // non-existent employee
                    ProjectId: project.Id,
                    CostCodeId: costCode.Id,
                    RegularHours: 8m)
            ],
            AllowPartialSuccess: true,
            IsDraft: false
        );

        // Act
        var result = await service.BatchCreateTimeEntriesAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.FailureCount.Should().Be(1);
        result.Value.Results[0].Success.Should().BeFalse();
        result.Value.Results[0].ErrorCode.Should().Be("EMPLOYEE_NOT_FOUND");
    }

    [Fact]
    public async Task BatchCreate_DuplicateEntries_RejectsWithError()
    {
        // Arrange - create an existing entry first
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);
        var date = DateOnly.FromDateTime(DateTime.UtcNow);

        // Pre-create an entry
        db.Set<TimeEntry>().Add(new TimeEntry
        {
            Date = date,
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            CostCodeId = costCode.Id,
            RegularHours = 4m,
            Status = TimeEntryStatus.Submitted
        });
        await db.SaveChangesAsync();

        var command = new BatchCreateTimeEntriesCommand(
            Entries:
            [
                new BatchTimeEntryItem(
                    Date: date,
                    EmployeeId: employee.Id,
                    ProjectId: project.Id,
                    CostCodeId: costCode.Id,
                    RegularHours: 8m)
            ],
            AllowPartialSuccess: true,
            IsDraft: false
        );

        // Act
        var result = await service.BatchCreateTimeEntriesAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.FailureCount.Should().Be(1);
        result.Value.Results[0].ErrorCode.Should().Be("DUPLICATE_ENTRY");
    }

    [Fact]
    public async Task BatchCreate_AutoAssignsCostCode_WhenEmpty()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, _) = await SetupTestData(db);
        var labCostCode = new CostCode
        {
            Code = "LAB",
            Description = "Labor",
            CostType = CostType.Labor,
            IsActive = true
        };
        db.Set<CostCode>().Add(labCostCode);
        await db.SaveChangesAsync();

        var service = CreateService(db);

        var command = new BatchCreateTimeEntriesCommand(
            Entries:
            [
                new BatchTimeEntryItem(
                    Date: DateOnly.FromDateTime(DateTime.UtcNow),
                    EmployeeId: employee.Id,
                    ProjectId: project.Id,
                    CostCodeId: Guid.Empty, // should auto-assign LAB
                    RegularHours: 8m)
            ],
            IsDraft: false
        );

        // Act
        var result = await service.BatchCreateTimeEntriesAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();

        var entry = db.Set<TimeEntry>().First();
        entry.CostCodeId.Should().Be(labCostCode.Id);
    }

    [Fact]
    public async Task BatchCreate_NullPhaseId_UpsertsExistingDraft()
    {
        // Verifies that the service layer correctly finds an existing draft when
        // PhaseId is null (PostgreSQL NULL != NULL in unique indexes means the DB
        // index alone wouldn't catch this — the service layer query handles it).
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);
        var date = DateOnly.FromDateTime(DateTime.UtcNow);

        // Pre-create a draft entry with null PhaseId
        db.Set<TimeEntry>().Add(new TimeEntry
        {
            Date = date,
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            CostCodeId = costCode.Id,
            RegularHours = 4m,
            Status = TimeEntryStatus.Draft
        });
        await db.SaveChangesAsync();

        // Batch-create with same key + null PhaseId — should upsert the existing draft
        var command = new BatchCreateTimeEntriesCommand(
            Entries:
            [
                new BatchTimeEntryItem(
                    Date: date,
                    EmployeeId: employee.Id,
                    ProjectId: project.Id,
                    CostCodeId: costCode.Id,
                    RegularHours: 8m)
            ],
            AllowPartialSuccess: true,
            IsDraft: true
        );

        // Act
        var result = await service.BatchCreateTimeEntriesAsync(command);

        // Assert - service layer found the existing draft and updated it
        result.IsSuccess.Should().BeTrue();
        result.Value!.SuccessCount.Should().Be(1);
        db.Set<TimeEntry>().Count().Should().Be(1); // no duplicate created
        db.Set<TimeEntry>().Single().RegularHours.Should().Be(8m); // updated to new value
    }

    [Fact]
    public async Task BatchCreate_NullPhaseId_SubmittedEntry_ReturnsDuplicateError()
    {
        // Verifies that the service layer prevents duplicates when the existing entry
        // is Submitted (not Draft) and PhaseId is null — this is the defense-in-depth
        // scenario where the DB unique index can't help.
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);
        var date = DateOnly.FromDateTime(DateTime.UtcNow);

        // Pre-create a Submitted entry with null PhaseId
        db.Set<TimeEntry>().Add(new TimeEntry
        {
            Date = date,
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            CostCodeId = costCode.Id,
            RegularHours = 4m,
            Status = TimeEntryStatus.Submitted
        });
        await db.SaveChangesAsync();

        var command = new BatchCreateTimeEntriesCommand(
            Entries:
            [
                new BatchTimeEntryItem(
                    Date: date,
                    EmployeeId: employee.Id,
                    ProjectId: project.Id,
                    CostCodeId: costCode.Id,
                    RegularHours: 8m)
            ],
            AllowPartialSuccess: true,
            IsDraft: false
        );

        // Act
        var result = await service.BatchCreateTimeEntriesAsync(command);

        // Assert - service layer rejects the duplicate even though PhaseId is null
        result.IsSuccess.Should().BeTrue();
        result.Value!.FailureCount.Should().Be(1);
        result.Value.Results[0].ErrorCode.Should().Be("DUPLICATE_ENTRY");
    }

    [Fact]
    public async Task BatchCreate_WhenMatchingDraftExists_UpdatesDraftInsteadOfDuplicating()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);
        var date = DateOnly.FromDateTime(DateTime.UtcNow);

        var existingDraft = new TimeEntry
        {
            Date = date,
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            CostCodeId = costCode.Id,
            RegularHours = 2m,
            OvertimeHours = 0m,
            DoubletimeHours = 0m,
            Description = "Original draft",
            Status = TimeEntryStatus.Draft
        };
        db.Set<TimeEntry>().Add(existingDraft);
        await db.SaveChangesAsync();

        var command = new BatchCreateTimeEntriesCommand(
            Entries:
            [
                new BatchTimeEntryItem(
                    Date: date,
                    EmployeeId: employee.Id,
                    ProjectId: project.Id,
                    CostCodeId: costCode.Id,
                    RegularHours: 8m,
                    Description: "Updated draft",
                    TimeEntryId: existingDraft.Id)
            ],
            IsDraft: false,
            SubmittedById: Guid.NewGuid()
        );

        // Act
        var result = await service.BatchCreateTimeEntriesAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.SuccessCount.Should().Be(1);

        db.Set<TimeEntry>().Count().Should().Be(1);
        var updated = db.Set<TimeEntry>().Single();
        updated.Id.Should().Be(existingDraft.Id);
        updated.RegularHours.Should().Be(8m);
        updated.Description.Should().Be("Updated draft");
        updated.Status.Should().Be(TimeEntryStatus.Submitted);
    }

    #region Helper Methods

    private static TimeEntryService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        return new TimeEntryService(
            db,
            new CreateTimeEntryValidator(),
            new UpdateTimeEntryValidator(),
            new BatchCreateTimeEntriesValidator(),
            new LaborCostCalculator(),
            Mock.Of<IPayPeriodService>(),
            new GeofenceService(),
            NullLogger<TimeEntryService>.Instance
        );
    }

    private static async Task<(Employee employee, Project project, CostCode costCode)> SetupTestData(
        Pitbull.Core.Data.PitbullDbContext db)
    {
        var employee = new Employee
        {
            FirstName = "John",
            LastName = "Worker",
            EmployeeNumber = "EMP001",
            Email = "john@test.com",
            IsActive = true,
            Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 35m
        };
        db.Set<Employee>().Add(employee);

        var project = new Project
        {
            Name = "Highway 99 Interchange",
            Number = "P-099",
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

    #endregion
}
