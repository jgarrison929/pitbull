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

public sealed class TimeEntryCertifiedClassificationTests
{
    [Fact]
    public async Task Create_CertifiedProjectWithoutClassification_ReturnsMissingWorkClassification()
    {
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupCertified(db);
        var service = CreateService(db);

        var command = new CreateTimeEntryCommand(
            Date: DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 8m);

        var result = await service.CreateTimeEntryAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("MISSING_WORK_CLASSIFICATION");
    }

    [Fact]
    public async Task Create_CertifiedProjectWithClassification_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupCertified(db);
        var service = CreateService(db);
        var classificationId = Guid.NewGuid();

        var command = new CreateTimeEntryCommand(
            Date: DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 8m,
            WorkClassificationId: classificationId);

        var result = await service.CreateTimeEntryAsync(command);

        result.IsSuccess.Should().BeTrue();
        result.Value!.WorkClassificationId.Should().Be(classificationId);
    }

    [Fact]
    public async Task Update_CertifiedProjectWithoutClassification_ReturnsMissingWorkClassification()
    {
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupCertified(db);
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

        var result = await service.UpdateTimeEntryAsync(new UpdateTimeEntryCommand(
            TimeEntryId: entry.Id,
            RegularHours: 7m));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("MISSING_WORK_CLASSIFICATION");
    }

    [Fact]
    public async Task Update_CertifiedProject_ExistingClassification_AllowsHoursChange()
    {
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupCertified(db);
        var service = CreateService(db);
        var classificationId = Guid.NewGuid();

        var entry = new TimeEntry
        {
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            CostCodeId = costCode.Id,
            RegularHours = 8m,
            Status = TimeEntryStatus.Draft,
            WorkClassificationId = classificationId
        };
        db.Set<TimeEntry>().Add(entry);
        await db.SaveChangesAsync();

        var result = await service.UpdateTimeEntryAsync(new UpdateTimeEntryCommand(
            TimeEntryId: entry.Id,
            RegularHours: 7m));

        result.IsSuccess.Should().BeTrue();
        result.Value!.RegularHours.Should().Be(7m);
        result.Value.WorkClassificationId.Should().Be(classificationId);
    }

    [Fact]
    public async Task Update_CertifiedProject_SuppliesClassification_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupCertified(db);
        var service = CreateService(db);
        var classificationId = Guid.NewGuid();

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

        var result = await service.UpdateTimeEntryAsync(new UpdateTimeEntryCommand(
            TimeEntryId: entry.Id,
            WorkClassificationId: classificationId));

        result.IsSuccess.Should().BeTrue();
        result.Value!.WorkClassificationId.Should().Be(classificationId);
    }

    [Fact]
    public async Task BatchCreate_CertifiedProjectWithoutClassification_ReturnsMissingWorkClassification()
    {
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupCertified(db);
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
            IsDraft: true);

        var result = await service.BatchCreateTimeEntriesAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("MISSING_WORK_CLASSIFICATION");
    }

    [Fact]
    public async Task BatchCreate_CertifiedProjectWithClassification_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupCertified(db);
        var service = CreateService(db);
        var classificationId = Guid.NewGuid();

        var command = new BatchCreateTimeEntriesCommand(
            Entries:
            [
                new BatchTimeEntryItem(
                    Date: DateOnly.FromDateTime(DateTime.UtcNow),
                    EmployeeId: employee.Id,
                    ProjectId: project.Id,
                    CostCodeId: costCode.Id,
                    RegularHours: 8m,
                    WorkClassificationId: classificationId)
            ],
            IsDraft: true);

        var result = await service.BatchCreateTimeEntriesAsync(command);

        result.IsSuccess.Should().BeTrue();
        result.Value!.SuccessCount.Should().Be(1);
        db.Set<TimeEntry>().Single().WorkClassificationId.Should().Be(classificationId);
    }

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
            NullLogger<TimeEntryService>.Instance);
    }

    private static IPayPeriodService CreatePayPeriodServiceMock()
    {
        var mock = new Mock<IPayPeriodService>();
        mock.Setup(x => x.GetCurrentPeriodAsync(It.IsAny<DateOnly?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success(new PayPeriodDto
            {
                Id = Guid.NewGuid(),
                StartDate = DateOnly.MinValue,
                EndDate = DateOnly.MaxValue,
                Status = PayPeriodStatus.Open
            }));
        mock.Setup(x => x.ValidateTimeEntryDateAsync(It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string?)null);
        return mock.Object;
    }

    private static async Task<(Employee employee, Project project, CostCode costCode)> SetupCertified(
        Pitbull.Core.Data.PitbullDbContext db)
    {
        var employee = new Employee
        {
            FirstName = "Casey",
            LastName = "Laborer",
            EmployeeNumber = "EMP-CERT-001",
            Email = "casey.cert@test.com",
            IsActive = true,
            Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 42m
        };
        db.Set<Employee>().Add(employee);

        var project = new Project
        {
            Name = "Federal Retrofit",
            Number = "P-CERT-1",
            Status = ProjectStatus.Active,
            CertifiedPayroll = true
        };
        db.Set<Project>().Add(project);

        var costCode = new CostCode
        {
            Code = "03-200",
            Description = "Certified Labor",
            IsActive = true,
            CostType = CostType.Labor
        };
        db.Set<CostCode>().Add(costCode);

        db.Set<ProjectAssignment>().Add(new ProjectAssignment
        {
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)),
            IsActive = true,
            Role = AssignmentRole.Worker
        });

        await db.SaveChangesAsync();
        return (employee, project, costCode);
    }
}
