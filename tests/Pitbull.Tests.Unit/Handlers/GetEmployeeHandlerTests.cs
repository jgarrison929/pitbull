using FluentAssertions;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.GetEmployee;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class GetEmployeeHandlerTests
{
    [Fact]
    public async Task Handle_ExistingEmployee_ReturnsEmployee()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var employee = new Employee
        {
            EmployeeNumber = "EMP-001",
            FirstName = "John",
            LastName = "Doe",
            Classification = EmployeeClassification.Hourly,
            BaseHourlyRate = 35.00m,
            HireDate = new DateOnly(2025, 1, 15),
            Email = "john.doe@example.com",
            Phone = "555-1234",
            Title = "Carpenter"
        };
        db.Set<Employee>().Add(employee);
        await db.SaveChangesAsync();

        var handler = new GetEmployeeHandler(db);
        var query = new GetEmployeeQuery(employee.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Id.Should().Be(employee.Id);
        result.Value.EmployeeNumber.Should().Be("EMP-001");
        result.Value.FirstName.Should().Be("John");
        result.Value.LastName.Should().Be("Doe");
        result.Value.FullName.Should().Be("John Doe");
    }

    [Fact]
    public async Task Handle_NonExistentEmployee_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new GetEmployeeHandler(db);
        var query = new GetEmployeeQuery(Guid.NewGuid());

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
        result.Error.Should().Contain("not found");
    }

    [Fact]
    public async Task Handle_EmployeeWithSupervisor_IncludesSupervisorName()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        
        var supervisor = new Employee
        {
            EmployeeNumber = "EMP-000",
            FirstName = "Jane",
            LastName = "Manager",
            Classification = EmployeeClassification.Salaried
        };
        db.Set<Employee>().Add(supervisor);
        await db.SaveChangesAsync();
        
        var employee = new Employee
        {
            EmployeeNumber = "EMP-001",
            FirstName = "John",
            LastName = "Doe",
            Classification = EmployeeClassification.Hourly,
            SupervisorId = supervisor.Id
        };
        db.Set<Employee>().Add(employee);
        await db.SaveChangesAsync();

        var handler = new GetEmployeeHandler(db);
        var query = new GetEmployeeQuery(employee.Id);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.SupervisorId.Should().Be(supervisor.Id);
        result.Value.SupervisorName.Should().Be("Jane Manager");
    }
}
