using FluentAssertions;
using FluentValidation;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.BatchCreateTimeEntries;
using Pitbull.TimeTracking.Features.CreateTimeEntry;
using Pitbull.TimeTracking.Features.UpdateTimeEntry;
using Pitbull.TimeTracking.Services;

namespace Pitbull.Tests.Unit.Services;

/// <summary>
/// Tests for TimeEntry Phase and Equipment functionality
/// </summary>
public sealed class TimeEntryPhaseEquipmentTests
{
    #region Phase Validation Tests

    [Fact]
    public async Task CreateTimeEntry_WithValidPhase_Succeeds()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var phase = await CreatePhase(db, project.Id, "Foundation");
        var service = CreateService(db);

        var command = new CreateTimeEntryCommand(
            Date: DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 8m,
            PhaseId: phase.Id
        );

        // Act
        var result = await service.CreateTimeEntryAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.PhaseId.Should().Be(phase.Id);
        result.Value.PhaseName.Should().Be("Foundation");
    }

    [Fact]
    public async Task CreateTimeEntry_WithInvalidPhase_ReturnsPhaseMismatchError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project1, costCode) = await SetupTestData(db);

        // Create a second project and a phase for it
        var project2 = await CreateProject(db, "Other Project");
        var phaseOnProject2 = await CreatePhase(db, project2.Id, "Other Phase");

        var service = CreateService(db);

        // Try to create time entry on project1 with phase from project2
        var command = new CreateTimeEntryCommand(
            Date: DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId: employee.Id,
            ProjectId: project1.Id,
            CostCodeId: costCode.Id,
            RegularHours: 8m,
            PhaseId: phaseOnProject2.Id  // Phase belongs to project2, not project1
        );

        // Act
        var result = await service.CreateTimeEntryAsync(command);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("PHASE_PROJECT_MISMATCH");
        result.Error.Should().Contain("Phase does not belong to the specified project");
    }

    [Fact]
    public async Task CreateTimeEntry_WithNonExistentPhase_ReturnsNotFoundError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);

        var command = new CreateTimeEntryCommand(
            Date: DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 8m,
            PhaseId: Guid.NewGuid()  // Non-existent phase
        );

        // Act
        var result = await service.CreateTimeEntryAsync(command);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("PHASE_NOT_FOUND");
    }

    [Fact]
    public async Task CreateTimeEntry_WithoutPhase_Succeeds()
    {
        // Arrange - Phase is optional for backward compatibility
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);

        var command = new CreateTimeEntryCommand(
            Date: DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 8m,
            PhaseId: null
        );

        // Act
        var result = await service.CreateTimeEntryAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.PhaseId.Should().BeNull();
    }

    #endregion

    #region Equipment Validation Tests

    [Fact]
    public async Task CreateTimeEntry_WithValidEquipment_Succeeds()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var equipment = await CreateEquipment(db, "EX-001", "CAT 320 Excavator");
        var service = CreateService(db);

        var command = new CreateTimeEntryCommand(
            Date: DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 8m,
            EquipmentId: equipment.Id,
            EquipmentHours: 6m
        );

        // Act
        var result = await service.CreateTimeEntryAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.EquipmentId.Should().Be(equipment.Id);
        result.Value.EquipmentCode.Should().Be("EX-001");
        result.Value.EquipmentName.Should().Be("CAT 320 Excavator");
        result.Value.EquipmentHours.Should().Be(6m);
    }

    [Fact]
    public async Task CreateTimeEntry_WithInactiveEquipment_ReturnsNotFoundError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var equipment = await CreateEquipment(db, "EX-001", "Inactive Excavator", isActive: false);
        var service = CreateService(db);

        var command = new CreateTimeEntryCommand(
            Date: DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 8m,
            EquipmentId: equipment.Id,
            EquipmentHours: 6m
        );

        // Act
        var result = await service.CreateTimeEntryAsync(command);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("EQUIPMENT_NOT_FOUND");
        result.Error.Should().Contain("inactive");
    }

    [Fact]
    public async Task CreateTimeEntry_WithNonExistentEquipment_ReturnsNotFoundError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);

        var command = new CreateTimeEntryCommand(
            Date: DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 8m,
            EquipmentId: Guid.NewGuid(),  // Non-existent
            EquipmentHours: 6m
        );

        // Act
        var result = await service.CreateTimeEntryAsync(command);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("EQUIPMENT_NOT_FOUND");
    }

    #endregion

    #region Duplicate Check with PhaseId Tests

    [Fact]
    public async Task CreateTimeEntry_SameProjectCostCodeDifferentPhase_BothSucceed()
    {
        // Arrange - Same employee, project, cost code, date but DIFFERENT phases = allowed
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var phase1 = await CreatePhase(db, project.Id, "Phase 1");
        var phase2 = await CreatePhase(db, project.Id, "Phase 2");
        var service = CreateService(db);

        var date = DateOnly.FromDateTime(DateTime.UtcNow);

        // Create first entry with phase1
        var command1 = new CreateTimeEntryCommand(
            Date: date,
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 4m,
            PhaseId: phase1.Id
        );
        var result1 = await service.CreateTimeEntryAsync(command1);

        // Create second entry with phase2
        var command2 = new CreateTimeEntryCommand(
            Date: date,
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 4m,
            PhaseId: phase2.Id
        );

        // Act
        var result2 = await service.CreateTimeEntryAsync(command2);

        // Assert
        result1.IsSuccess.Should().BeTrue();
        result2.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task CreateTimeEntry_SameProjectCostCodeSamePhase_ReturnsDuplicateError()
    {
        // Arrange - Same employee, project, cost code, date AND same phase = duplicate
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var phase = await CreatePhase(db, project.Id, "Phase 1");
        var service = CreateService(db);

        var date = DateOnly.FromDateTime(DateTime.UtcNow);

        // Create first entry
        var command1 = new CreateTimeEntryCommand(
            Date: date,
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 4m,
            PhaseId: phase.Id
        );
        await service.CreateTimeEntryAsync(command1);

        // Try to create duplicate
        var command2 = new CreateTimeEntryCommand(
            Date: date,
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 4m,
            PhaseId: phase.Id  // Same phase
        );

        // Act
        var result2 = await service.CreateTimeEntryAsync(command2);

        // Assert
        result2.IsSuccess.Should().BeFalse();
        result2.ErrorCode.Should().Be("DUPLICATE_ENTRY");
    }

    [Fact]
    public async Task CreateTimeEntry_SameProjectCostCodeNoPhase_ReturnsDuplicateError()
    {
        // Arrange - Multiple entries without phase should still be unique per cost code
        using var db = TestDbContextFactory.Create();
        var (employee, project, costCode) = await SetupTestData(db);
        var service = CreateService(db);

        var date = DateOnly.FromDateTime(DateTime.UtcNow);

        // Create first entry without phase
        var command1 = new CreateTimeEntryCommand(
            Date: date,
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 4m,
            PhaseId: null
        );
        await service.CreateTimeEntryAsync(command1);

        // Try to create another entry without phase
        var command2 = new CreateTimeEntryCommand(
            Date: date,
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: costCode.Id,
            RegularHours: 4m,
            PhaseId: null
        );

        // Act
        var result2 = await service.CreateTimeEntryAsync(command2);

        // Assert
        result2.IsSuccess.Should().BeFalse();
        result2.ErrorCode.Should().Be("DUPLICATE_ENTRY");
    }

    #endregion

    #region Helper Methods

    private static TimeEntryService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        return new TimeEntryService(
            db,
            new CreateTimeEntryValidator(),
            new UpdateTimeEntryValidator(),
            new BatchCreateTimeEntriesValidator(),
            new LaborCostCalculator(),
            NullLogger<TimeEntryService>.Instance
        );
    }

    private static async Task<(Employee employee, Project project, CostCode costCode)> SetupTestData(
        Pitbull.Core.Data.PitbullDbContext db)
    {
        // Create employee with classification for approval
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

        // Create project
        var project = new Project
        {
            Name = "Test Project",
            Number = "P-001",
            Status = ProjectStatus.Active
        };
        db.Set<Project>().Add(project);

        // Create project assignment for the employee
        var assignment = new ProjectAssignment
        {
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)),
            IsActive = true,
            Role = AssignmentRole.Worker
        };
        db.Set<ProjectAssignment>().Add(assignment);

        // Create cost code
        var costCode = new CostCode
        {
            Code = "03-100",
            Description = "Concrete Work",
            IsActive = true,
            CostType = CostType.Labor
        };
        db.Set<CostCode>().Add(costCode);

        await db.SaveChangesAsync();
        return (employee, project, costCode);
    }

    private static async Task<Phase> CreatePhase(
        Pitbull.Core.Data.PitbullDbContext db,
        Guid projectId,
        string name)
    {
        var phase = new Phase
        {
            ProjectId = projectId,
            Name = name,
            CostCode = $"PH-{name.Substring(0, 3).ToUpper()}",
            Status = PhaseStatus.InProgress,
            SortOrder = 1
        };
        db.Set<Phase>().Add(phase);
        await db.SaveChangesAsync();
        return phase;
    }

    private static async Task<Project> CreateProject(
        Pitbull.Core.Data.PitbullDbContext db,
        string name)
    {
        var project = new Project
        {
            Name = name,
            Number = $"P-{Guid.NewGuid().ToString().Substring(0, 8)}",
            Status = ProjectStatus.Active
        };
        db.Set<Project>().Add(project);
        await db.SaveChangesAsync();
        return project;
    }

    private static async Task<Equipment> CreateEquipment(
        Pitbull.Core.Data.PitbullDbContext db,
        string code,
        string name,
        bool isActive = true)
    {
        var equipment = new Equipment
        {
            Code = code,
            Name = name,
            Type = EquipmentType.HeavyEquipment,
            HourlyRate = 150m,
            IsActive = isActive
        };
        db.Set<Equipment>().Add(equipment);
        await db.SaveChangesAsync();
        return equipment;
    }

    #endregion
}
