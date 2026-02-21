using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.CreateEmployee;
using Pitbull.TimeTracking.Features.ListEmployees;
using Pitbull.TimeTracking.Services;

namespace Pitbull.Tests.Unit.Modules.TimeTracking;

public sealed class EmployeeServiceTests
{
    private static EmployeeService CreateService(Pitbull.Core.Data.PitbullDbContext db) =>
        new(db, NullLogger<EmployeeService>.Instance);

    [Fact]
    public async Task CreateEmployee_WithoutEmployeeNumber_AutoGeneratesNextNumber()
    {
        using var db = TestDbContextFactory.Create();
        await SeedEmployeeAsync(db, "EMP-00003", isDeleted: false);
        await SeedEmployeeAsync(db, "EMP-00010", isDeleted: false);
        await SeedEmployeeAsync(db, "MANUAL-77", isDeleted: false);
        var service = CreateService(db);

        var result = await service.CreateEmployeeAsync(new CreateEmployeeCommand(
            FirstName: "New",
            LastName: "Hire",
            EmployeeNumber: null,
            BaseHourlyRate: 30m));

        result.IsSuccess.Should().BeTrue();
        result.Value!.EmployeeNumber.Should().Be("EMP-00011");
    }

    [Fact]
    public async Task CreateEmployee_CustomNumberDuplicateActive_ReturnsDuplicate()
    {
        using var db = TestDbContextFactory.Create();
        await SeedEmployeeAsync(db, "EMP-CUSTOM", isDeleted: false);
        var service = CreateService(db);

        var result = await service.CreateEmployeeAsync(new CreateEmployeeCommand(
            FirstName: "Dup",
            LastName: "Case",
            EmployeeNumber: "EMP-CUSTOM",
            BaseHourlyRate: 25m));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("DUPLICATE");
    }

    [Fact]
    public async Task CreateEmployee_CustomNumberMatchingDeletedRecord_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        await SeedEmployeeAsync(db, "EMP-REUSE", isDeleted: true);
        var service = CreateService(db);

        var result = await service.CreateEmployeeAsync(new CreateEmployeeCommand(
            FirstName: "Reuse",
            LastName: "Allowed",
            EmployeeNumber: "EMP-REUSE",
            BaseHourlyRate: 28m));

        result.IsSuccess.Should().BeTrue();
        result.Value!.EmployeeNumber.Should().Be("EMP-REUSE");
    }

    [Fact]
    public async Task GetEmployee_DeletedEmployee_ReturnsNotFound()
    {
        using var db = TestDbContextFactory.Create();
        var deletedId = await SeedEmployeeAsync(db, "EMP-DEL", isDeleted: true);
        var service = CreateService(db);

        var result = await service.GetEmployeeAsync(deletedId);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task GetEmployees_ExcludesSoftDeletedEmployees()
    {
        using var db = TestDbContextFactory.Create();
        await SeedEmployeeAsync(db, "EMP-ACTIVE", isDeleted: false);
        await SeedEmployeeAsync(db, "EMP-REMOVED", isDeleted: true);
        var service = CreateService(db);

        var result = await service.GetEmployeesAsync(new ListEmployeesQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().ContainSingle(e => e.EmployeeNumber == "EMP-ACTIVE");
        result.Value.Items.Should().NotContain(e => e.EmployeeNumber == "EMP-REMOVED");
    }

    [Fact]
    public async Task GetEmployeeStats_NonExistentEmployee_ReturnsNotFound()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.GetEmployeeStatsAsync(Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("EMPLOYEE_NOT_FOUND");
    }

    [Fact]
    public async Task GetEmployeeStats_InMemoryProvider_ReturnsHandledStatsError()
    {
        using var db = TestDbContextFactory.Create();
        var employeeId = await SeedEmployeeAsync(db, "EMP-STATS", isDeleted: false);
        var service = CreateService(db);

        var result = await service.GetEmployeeStatsAsync(employeeId);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("EMPLOYEE_STATS_ERROR");
        result.Error.Should().Contain("Failed to retrieve employee statistics");
    }

    private static async Task<Guid> SeedEmployeeAsync(
        Pitbull.Core.Data.PitbullDbContext db,
        string employeeNumber,
        bool isDeleted)
    {
        var employee = new Employee
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeNumber = employeeNumber,
            FirstName = "Test",
            LastName = "Employee",
            BaseHourlyRate = 30m,
            Classification = EmployeeClassification.Hourly,
            IsDeleted = isDeleted,
            DeletedAt = isDeleted ? DateTime.UtcNow : null,
            CreatedAt = DateTime.UtcNow
        };

        db.Set<Employee>().Add(employee);
        await db.SaveChangesAsync();
        return employee.Id;
    }
}
