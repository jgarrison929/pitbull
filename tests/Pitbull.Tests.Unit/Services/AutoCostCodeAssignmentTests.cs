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

/// <summary>
/// Tests for auto cost code assignment when creating time entries without a cost code.
/// Crew timecard grid entries omit cost code; the service auto-assigns LAB (labor).
/// See docs/plans/CREW-TIMECARD-GRID.md for design context.
/// </summary>
public sealed class AutoCostCodeAssignmentTests
{
    #region Auto-Assign LAB Cost Code Tests

    [Fact]
    public async Task CreateTimeEntry_WithoutCostCode_AutoAssignsLaborCostCode()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var (employee, project, _) = await SetupTestData(db);
        var labCostCode = await CreateCostCode(db, "LAB", "Labor", CostType.Labor);
        var service = CreateService(db);

        var command = new CreateTimeEntryCommand(
            Date: DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            // CostCodeId intentionally omitted (defaults to Guid.Empty)
            RegularHours: 8m
        );

        // Act
        var result = await service.CreateTimeEntryAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.CostCodeId.Should().Be(labCostCode.Id);
        result.Value.CostCodeDescription.Should().Be("Labor");
    }

    [Fact]
    public async Task CreateTimeEntry_WithEmptyCostCodeId_AutoAssignsLaborCostCode()
    {
        // Arrange - explicit Guid.Empty
        using var db = TestDbContextFactory.Create();
        var (employee, project, _) = await SetupTestData(db);
        var labCostCode = await CreateCostCode(db, "LAB", "Labor", CostType.Labor);
        var service = CreateService(db);

        var command = new CreateTimeEntryCommand(
            Date: DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: Guid.Empty,
            RegularHours: 8m
        );

        // Act
        var result = await service.CreateTimeEntryAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.CostCodeId.Should().Be(labCostCode.Id);
    }

    [Fact]
    public async Task CreateTimeEntry_WithExplicitCostCode_UsesProvidedCostCode()
    {
        // Arrange - when a cost code IS specified, it should be used as-is (no auto-assign)
        using var db = TestDbContextFactory.Create();
        var (employee, project, existingCostCode) = await SetupTestData(db);
        var labCostCode = await CreateCostCode(db, "LAB", "Labor", CostType.Labor);
        var service = CreateService(db);

        var command = new CreateTimeEntryCommand(
            Date: DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            CostCodeId: existingCostCode.Id,
            RegularHours: 8m
        );

        // Act
        var result = await service.CreateTimeEntryAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.CostCodeId.Should().Be(existingCostCode.Id, "should use the explicitly provided cost code, not auto-assign");
    }

    [Fact]
    public async Task CreateTimeEntry_WithoutCostCode_NoLabCostCodeExists_ReturnsError()
    {
        // Arrange - no LAB cost code seeded for this tenant
        using var db = TestDbContextFactory.Create();
        var (employee, project, _) = await SetupTestData(db);
        // Intentionally NOT creating a LAB cost code
        var service = CreateService(db);

        var command = new CreateTimeEntryCommand(
            Date: DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            // CostCodeId omitted
            RegularHours: 8m
        );

        // Act
        var result = await service.CreateTimeEntryAsync(command);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("COSTCODE_NOT_FOUND");
        result.Error.Should().Contain("LAB");
    }

    [Fact]
    public async Task CreateTimeEntry_WithoutCostCode_InactiveLabCostCode_ReturnsError()
    {
        // Arrange - LAB cost code exists but is inactive
        using var db = TestDbContextFactory.Create();
        var (employee, project, _) = await SetupTestData(db);
        await CreateCostCode(db, "LAB", "Labor", CostType.Labor, isActive: false);
        var service = CreateService(db);

        var command = new CreateTimeEntryCommand(
            Date: DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            RegularHours: 8m
        );

        // Act
        var result = await service.CreateTimeEntryAsync(command);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("COSTCODE_NOT_FOUND");
    }

    [Fact]
    public async Task CreateTimeEntry_WithoutCostCode_MultipleActiveCostCodes_AssignsLab()
    {
        // Arrange - multiple cost codes exist, but LAB should be picked
        using var db = TestDbContextFactory.Create();
        var (employee, project, _) = await SetupTestData(db);
        await CreateCostCode(db, "MAT", "Material", CostType.Material);
        await CreateCostCode(db, "EQP", "Equipment", CostType.Equipment);
        var labCostCode = await CreateCostCode(db, "LAB", "Labor", CostType.Labor);
        await CreateCostCode(db, "OVH", "Overhead", CostType.Overhead);
        var service = CreateService(db);

        var command = new CreateTimeEntryCommand(
            Date: DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            RegularHours: 8m
        );

        // Act
        var result = await service.CreateTimeEntryAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.CostCodeId.Should().Be(labCostCode.Id, "should specifically pick the LAB cost code");
    }

    [Fact]
    public async Task CreateTimeEntry_WithoutCostCode_WithPhaseAndEquipment_AutoAssignsLabAndSucceeds()
    {
        // Arrange - full crew entry: phase + equipment + auto cost code
        using var db = TestDbContextFactory.Create();
        var (employee, project, _) = await SetupTestData(db);
        var labCostCode = await CreateCostCode(db, "LAB", "Labor", CostType.Labor);
        var phase = await CreatePhase(db, project.Id, "Foundation");
        var equipment = await CreateEquipment(db, "EX-001", "CAT 320 Excavator");
        var service = CreateService(db);

        var command = new CreateTimeEntryCommand(
            Date: DateOnly.FromDateTime(DateTime.UtcNow),
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            RegularHours: 8m,
            OvertimeHours: 2m,
            PhaseId: phase.Id,
            EquipmentId: equipment.Id,
            EquipmentHours: 6m,
            Description: "Finished south abutment excavation"
        );

        // Act
        var result = await service.CreateTimeEntryAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.CostCodeId.Should().Be(labCostCode.Id);
        result.Value.PhaseId.Should().Be(phase.Id);
        result.Value.EquipmentId.Should().Be(equipment.Id);
        result.Value.EquipmentHours.Should().Be(6m);
        result.Value.RegularHours.Should().Be(8m);
        result.Value.OvertimeHours.Should().Be(2m);
        result.Value.TotalHours.Should().Be(10m);
        result.Value.Description.Should().Be("Finished south abutment excavation");
    }

    [Fact]
    public async Task CreateTimeEntry_WithoutCostCode_DuplicateCheckUsesAutoAssignedCode()
    {
        // Arrange - ensure duplicate detection works with auto-assigned cost codes
        using var db = TestDbContextFactory.Create();
        var (employee, project, _) = await SetupTestData(db);
        var labCostCode = await CreateCostCode(db, "LAB", "Labor", CostType.Labor);
        var service = CreateService(db);

        var date = DateOnly.FromDateTime(DateTime.UtcNow);

        // Create first entry without cost code (auto-assigns LAB)
        var command1 = new CreateTimeEntryCommand(
            Date: date,
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            RegularHours: 4m
        );
        var result1 = await service.CreateTimeEntryAsync(command1);
        result1.IsSuccess.Should().BeTrue();

        // Try to create duplicate (also without cost code, same auto-assign)
        var command2 = new CreateTimeEntryCommand(
            Date: date,
            EmployeeId: employee.Id,
            ProjectId: project.Id,
            RegularHours: 4m
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
            Mock.Of<IPayPeriodService>(),
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

        var assignment = new ProjectAssignment
        {
            EmployeeId = employee.Id,
            ProjectId = project.Id,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)),
            IsActive = true,
            Role = AssignmentRole.Worker
        };
        db.Set<ProjectAssignment>().Add(assignment);

        // A general cost code (not LAB) for tests that provide explicit cost codes
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

    private static async Task<CostCode> CreateCostCode(
        Pitbull.Core.Data.PitbullDbContext db,
        string code,
        string description,
        CostType costType,
        bool isActive = true)
    {
        var costCode = new CostCode
        {
            Code = code,
            Description = description,
            CostType = costType,
            IsActive = isActive
        };
        db.Set<CostCode>().Add(costCode);
        await db.SaveChangesAsync();
        return costCode;
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
            CostCode = $"PH-{name[..3].ToUpper()}",
            Status = PhaseStatus.InProgress,
            SortOrder = 1
        };
        db.Set<Phase>().Add(phase);
        await db.SaveChangesAsync();
        return phase;
    }

    private static async Task<Equipment> CreateEquipment(
        Pitbull.Core.Data.PitbullDbContext db,
        string code,
        string name)
    {
        var equipment = new Equipment
        {
            Code = code,
            Name = name,
            Type = EquipmentType.HeavyEquipment,
            HourlyRate = 150m,
            IsActive = true
        };
        db.Set<Equipment>().Add(equipment);
        await db.SaveChangesAsync();
        return equipment;
    }

    #endregion
}
