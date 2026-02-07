using FluentAssertions;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features.CreateEmployee;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

public class CreateEmployeeHandlerTests
{
    [Fact]
    public async Task Handle_ValidCommand_CreatesEmployee()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateEmployeeHandler(db);
        
        var command = new CreateEmployeeCommand(
            EmployeeNumber: "E001",
            FirstName: "John",
            LastName: "Doe",
            Email: "john.doe@example.com",
            Phone: "555-1234",
            Title: "Carpenter",
            Classification: EmployeeClassification.Hourly,
            BaseHourlyRate: 35.00m,
            HireDate: new DateOnly(2026, 2, 1));

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.EmployeeNumber.Should().Be("E001");
        result.Value.FirstName.Should().Be("John");
        result.Value.LastName.Should().Be("Doe");
        result.Value.FullName.Should().Be("John Doe");
        result.Value.Email.Should().Be("john.doe@example.com");
        result.Value.Phone.Should().Be("555-1234");
        result.Value.Title.Should().Be("Carpenter");
        result.Value.Classification.Should().Be(EmployeeClassification.Hourly);
        result.Value.BaseHourlyRate.Should().Be(35.00m);
        result.Value.HireDate.Should().Be(new DateOnly(2026, 2, 1));
        result.Value.IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_MinimalCommand_CreatesEmployeeWithDefaults()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateEmployeeHandler(db);
        
        var command = new CreateEmployeeCommand(
            EmployeeNumber: "E001",
            FirstName: "John",
            LastName: "Doe");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Classification.Should().Be(EmployeeClassification.Hourly);
        result.Value.BaseHourlyRate.Should().Be(0);
        result.Value.Email.Should().BeNull();
        result.Value.Phone.Should().BeNull();
        result.Value.Title.Should().BeNull();
        result.Value.HireDate.Should().BeNull();
        result.Value.SupervisorId.Should().BeNull();
    }

    [Fact]
    public async Task Handle_SalariedClassification_CreatesCorrectly()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateEmployeeHandler(db);
        
        var command = new CreateEmployeeCommand(
            EmployeeNumber: "E001",
            FirstName: "Jane",
            LastName: "Manager",
            Classification: EmployeeClassification.Salaried,
            BaseHourlyRate: 75.00m,
            Title: "Project Manager");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Classification.Should().Be(EmployeeClassification.Salaried);
    }

    [Fact]
    public async Task Handle_DuplicateEmployeeNumber_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        
        // Create existing employee
        var existingEmployee = new Employee
        {
            EmployeeNumber = "E001",
            FirstName = "Existing",
            LastName = "Employee",
            Classification = EmployeeClassification.Hourly
        };
        db.Set<Employee>().Add(existingEmployee);
        await db.SaveChangesAsync();

        var handler = new CreateEmployeeHandler(db);
        var command = new CreateEmployeeCommand(
            EmployeeNumber: "E001", // Same employee number
            FirstName: "New",
            LastName: "Employee");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Be("DUPLICATE");
        // Note: The handler passes error code as first param to Result.Failure
    }

    [Fact]
    public async Task Handle_WithValidSupervisor_CreatesEmployeeWithSupervisor()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        
        // Create supervisor
        var supervisor = new Employee
        {
            EmployeeNumber = "E000",
            FirstName = "Jane",
            LastName = "Manager",
            Classification = EmployeeClassification.Salaried
        };
        db.Set<Employee>().Add(supervisor);
        await db.SaveChangesAsync();

        var handler = new CreateEmployeeHandler(db);
        var command = new CreateEmployeeCommand(
            EmployeeNumber: "E001",
            FirstName: "John",
            LastName: "Worker",
            SupervisorId: supervisor.Id);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.SupervisorId.Should().Be(supervisor.Id);
    }

    [Fact]
    public async Task Handle_WithInvalidSupervisor_ReturnsFailure()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateEmployeeHandler(db);
        
        var command = new CreateEmployeeCommand(
            EmployeeNumber: "E001",
            FirstName: "John",
            LastName: "Worker",
            SupervisorId: Guid.NewGuid()); // Non-existent supervisor

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Be("INVALID_SUPERVISOR");
        // Note: The handler passes error code as first param to Result.Failure
    }

    [Fact]
    public async Task Handle_AssignsNewId()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateEmployeeHandler(db);
        
        var command = new CreateEmployeeCommand(
            EmployeeNumber: "E001",
            FirstName: "John",
            LastName: "Doe");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public async Task Handle_SetsCreatedAtTimestamp()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateEmployeeHandler(db);
        var beforeCreate = DateTime.UtcNow;
        
        var command = new CreateEmployeeCommand(
            EmployeeNumber: "E001",
            FirstName: "John",
            LastName: "Doe");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.CreatedAt.Should().BeOnOrAfter(beforeCreate);
    }

    [Fact]
    public async Task Handle_NewEmployeeIsActive()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateEmployeeHandler(db);
        
        var command = new CreateEmployeeCommand(
            EmployeeNumber: "E001",
            FirstName: "John",
            LastName: "Doe");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_MultipleEmployees_EachGetsUniqueId()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateEmployeeHandler(db);
        
        var command1 = new CreateEmployeeCommand(
            EmployeeNumber: "E001",
            FirstName: "John",
            LastName: "Doe");
        
        var command2 = new CreateEmployeeCommand(
            EmployeeNumber: "E002",
            FirstName: "Jane",
            LastName: "Smith");

        // Act
        var result1 = await handler.Handle(command1, CancellationToken.None);
        var result2 = await handler.Handle(command2, CancellationToken.None);

        // Assert
        result1.IsSuccess.Should().BeTrue();
        result2.IsSuccess.Should().BeTrue();
        result1.Value!.Id.Should().NotBe(result2.Value!.Id);
    }

    [Fact]
    public async Task Handle_ContractorClassification_CreatesCorrectly()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new CreateEmployeeHandler(db);
        
        var command = new CreateEmployeeCommand(
            EmployeeNumber: "C001",
            FirstName: "Bob",
            LastName: "Contractor",
            Classification: EmployeeClassification.Contractor,
            BaseHourlyRate: 95.00m,
            Title: "Consultant");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Classification.Should().Be(EmployeeClassification.Contractor);
    }
}
