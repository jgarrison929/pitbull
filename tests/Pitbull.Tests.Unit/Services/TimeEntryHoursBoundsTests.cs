using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;
using Pitbull.TimeTracking.Features;
using Pitbull.TimeTracking.Features.BatchCreateTimeEntries;
using Pitbull.TimeTracking.Features.CreateTimeEntry;
using Pitbull.TimeTracking.Features.UpdateTimeEntry;
using Pitbull.TimeTracking.Services;

namespace Pitbull.Tests.Unit.Services;

public sealed class TimeEntryHoursBoundsTests
{
    #region CreateTimeEntry — Negative Hours

    [Fact]
    public async Task Create_NegativeRegularHours_ReturnsValidationError()
    {
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);

        var command = new CreateTimeEntryCommand(
            Date: DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: -1m,
            OvertimeHours: 0m,
            DoubletimeHours: 0m);

        var result = await service.CreateTimeEntryAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("negative");
    }

    [Fact]
    public async Task Create_NegativeOvertimeHours_ReturnsValidationError()
    {
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);

        var command = new CreateTimeEntryCommand(
            Date: DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 8m,
            OvertimeHours: -2m,
            DoubletimeHours: 0m);

        var result = await service.CreateTimeEntryAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("negative");
    }

    [Fact]
    public async Task Create_NegativeDoubletimeHours_ReturnsValidationError()
    {
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);

        var command = new CreateTimeEntryCommand(
            Date: DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 8m,
            OvertimeHours: 0m,
            DoubletimeHours: -3m);

        var result = await service.CreateTimeEntryAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("negative");
    }

    #endregion

    #region CreateTimeEntry — Zero Total Hours

    [Fact]
    public async Task Create_ZeroTotalHours_ReturnsValidationError()
    {
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);

        var command = new CreateTimeEntryCommand(
            Date: DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 0m,
            OvertimeHours: 0m,
            DoubletimeHours: 0m);

        var result = await service.CreateTimeEntryAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("positive value");
    }

    #endregion

    #region CreateTimeEntry — Exceeds 24 Hours

    [Fact]
    public async Task Create_TotalExceeds24Hours_ReturnsValidationError()
    {
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);

        var command = new CreateTimeEntryCommand(
            Date: DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 16m,
            OvertimeHours: 6m,
            DoubletimeHours: 4m);

        var result = await service.CreateTimeEntryAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("24");
    }

    [Fact]
    public async Task Create_Exactly24Hours_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);

        var command = new CreateTimeEntryCommand(
            Date: DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 16m,
            OvertimeHours: 4m,
            DoubletimeHours: 4m);

        var result = await service.CreateTimeEntryAsync(command);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task Create_ValidHours_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);

        var command = new CreateTimeEntryCommand(
            Date: DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 8m,
            OvertimeHours: 2m,
            DoubletimeHours: 0m);

        var result = await service.CreateTimeEntryAsync(command);

        result.IsSuccess.Should().BeTrue();
        result.Value!.RegularHours.Should().Be(8m);
        result.Value.OvertimeHours.Should().Be(2m);
    }

    #endregion

    #region UpdateTimeEntry — Hours Bounds

    [Fact]
    public async Task Update_NegativeRegularHours_ReturnsValidationError()
    {
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);

        var entry = new TimeEntry
        {
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            CostCodeId = costCode.Id,
            RegularHours = 8m,
            Status = TimeEntryStatus.Draft
        };
        db.Set<TimeEntry>().Add(entry);
        await db.SaveChangesAsync();

        var command = new UpdateTimeEntryCommand(
            TimeEntryId: entry.Id,
            RegularHours: -5m);

        var result = await service.UpdateTimeEntryAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("negative");
    }

    [Fact]
    public async Task Update_TotalExceeds24Hours_ReturnsValidationError()
    {
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);

        var entry = new TimeEntry
        {
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            CostCodeId = costCode.Id,
            RegularHours = 8m,
            OvertimeHours = 4m,
            Status = TimeEntryStatus.Draft
        };
        db.Set<TimeEntry>().Add(entry);
        await db.SaveChangesAsync();

        // Update regular to 20 while OT stays at 4, total = 24+
        var command = new UpdateTimeEntryCommand(
            TimeEntryId: entry.Id,
            RegularHours: 22m);

        var result = await service.UpdateTimeEntryAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("24");
    }

    [Fact]
    public async Task Update_ZeroTotalHours_ReturnsValidationError()
    {
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);

        var entry = new TimeEntry
        {
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            CostCodeId = costCode.Id,
            RegularHours = 8m,
            Status = TimeEntryStatus.Draft
        };
        db.Set<TimeEntry>().Add(entry);
        await db.SaveChangesAsync();

        var command = new UpdateTimeEntryCommand(
            TimeEntryId: entry.Id,
            RegularHours: 0m,
            OvertimeHours: 0m,
            DoubletimeHours: 0m);

        var result = await service.UpdateTimeEntryAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("greater than zero");
    }

    [Fact]
    public async Task Update_PartialHoursUpdate_ValidatesAgainstExistingHours()
    {
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);

        var entry = new TimeEntry
        {
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            CostCodeId = costCode.Id,
            RegularHours = 8m,
            OvertimeHours = 4m,
            DoubletimeHours = 4m,
            Status = TimeEntryStatus.Draft
        };
        db.Set<TimeEntry>().Add(entry);
        await db.SaveChangesAsync();

        // Only update overtime to 14, keeping regular=8 and doubletime=4, total=26 > 24
        var command = new UpdateTimeEntryCommand(
            TimeEntryId: entry.Id,
            OvertimeHours: 14m);

        var result = await service.UpdateTimeEntryAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("24");
    }

    [Fact]
    public async Task Update_ValidHours_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);

        var entry = new TimeEntry
        {
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            CostCodeId = costCode.Id,
            RegularHours = 8m,
            Status = TimeEntryStatus.Draft
        };
        db.Set<TimeEntry>().Add(entry);
        await db.SaveChangesAsync();

        var command = new UpdateTimeEntryCommand(
            TimeEntryId: entry.Id,
            RegularHours: 10m,
            OvertimeHours: 2m);

        var result = await service.UpdateTimeEntryAsync(command);

        result.IsSuccess.Should().BeTrue();
    }

    #endregion

    #region BatchCreate — Hours Bounds

    [Fact]
    public async Task BatchCreate_NegativeHours_ReturnsError()
    {
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
                    RegularHours: -1m)
            ],
            IsDraft: true,
            AllowPartialSuccess: false
        );

        var result = await service.BatchCreateTimeEntriesAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task BatchCreate_Exceeds24Hours_ReturnsError()
    {
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
                    RegularHours: 20m,
                    OvertimeHours: 5m)
            ],
            IsDraft: true,
            AllowPartialSuccess: false
        );

        var result = await service.BatchCreateTimeEntriesAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task BatchCreate_ZeroHours_ReturnsError()
    {
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
                    RegularHours: 0m,
                    OvertimeHours: 0m,
                    DoubletimeHours: 0m)
            ],
            IsDraft: true,
            AllowPartialSuccess: false
        );

        var result = await service.BatchCreateTimeEntriesAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task BatchCreate_PartialSuccess_MarksInvalidEntriesAsFailed()
    {
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);

        // Second entry uses a non-existent employee — passes FluentValidation
        // but fails per-entry business logic (EMPLOYEE_NOT_FOUND)
        var command = new BatchCreateTimeEntriesCommand(
            Entries:
            [
                new BatchTimeEntryItem(
                    Date: DateOnly.FromDateTime(DateTime.UtcNow),
                    EmployeeId: employee.Id,
                    ProjectId: project.Id,
                    CostCodeId: costCode.Id,
                    RegularHours: 8m),
                new BatchTimeEntryItem(
                    Date: DateOnly.FromDateTime(DateTime.UtcNow),
                    EmployeeId: Guid.NewGuid(),
                    ProjectId: project.Id,
                    CostCodeId: costCode.Id,
                    RegularHours: 8m)
            ],
            IsDraft: true,
            AllowPartialSuccess: true
        );

        var result = await service.BatchCreateTimeEntriesAsync(command);

        result.IsSuccess.Should().BeTrue();
        result.Value!.SuccessCount.Should().Be(1);
        result.Value.FailureCount.Should().Be(1);
    }

    #endregion

    #region Helpers

    private static TimeEntryService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        return new TimeEntryService(
            db,
            new CreateTimeEntryValidator(),
            new UpdateTimeEntryValidator(),
            new BatchCreateTimeEntriesValidator(),
            new LaborCostCalculator(),
            CreatePayPeriodServiceMock(),
            new GeofenceService(),
            NullLogger<TimeEntryService>.Instance
        );
    }

    private static IPayPeriodService CreatePayPeriodServiceMock()
    {
        var mock = new Mock<IPayPeriodService>();
        mock.Setup(x => x.GetCurrentPeriodAsync(It.IsAny<DateOnly?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success(new PayPeriodDto { Id = Guid.NewGuid(), StartDate = DateOnly.MinValue, EndDate = DateOnly.MaxValue, Status = PayPeriodStatus.Open }));
        mock.Setup(x => x.ValidateTimeEntryDateAsync(It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string?)null);
        return mock.Object;
    }

    private static async Task<(Employee employee, Project project, CostCode costCode)> SetupTestData(
        Pitbull.Core.Data.PitbullDbContext db)
    {
        var employee = new Employee
        {
            FirstName = "Test",
            LastName = "Worker",
            EmployeeNumber = "EMP-HB-001",
            Email = "test.hb@test.com",
            IsActive = true,
            Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 30m
        };
        db.Set<Employee>().Add(employee);

        var project = new Project
        {
            Name = "Hours Bounds Test Project",
            Number = "P-HB-001",
            Status = ProjectStatus.Active
        };
        db.Set<Project>().Add(project);

        var costCode = new CostCode
        {
            Code = "03-200",
            Description = "Masonry Work",
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
