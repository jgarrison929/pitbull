using FluentAssertions;
using Pitbull.HR.Domain;
using Pitbull.HR.Features.DeleteEmployee;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.HR;

public class DeleteEmployeeHandlerTests
{
    [Fact]
    public async Task Handle_ExistingEmployee_SoftDeletes()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var employee = new Employee
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeNumber = "EMP001",
            FirstName = "John",
            LastName = "Doe",
            Email = "john@test.com",
            WorkerType = WorkerType.Field,
            Status = EmploymentStatus.Active,
            IsDeleted = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.Set<Employee>().Add(employee);
        await context.SaveChangesAsync();

        var handler = new DeleteEmployeeHandler(context);

        // Act
        var result = await handler.Handle(new DeleteEmployeeCommand(employee.Id), CancellationToken.None);

        // Assert
        result.Should().BeTrue();
        var deleted = await context.Set<Employee>().FindAsync(employee.Id);
        deleted.Should().NotBeNull();
        deleted!.IsDeleted.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_NonExistentEmployee_ReturnsFalse()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var handler = new DeleteEmployeeHandler(context);

        // Act
        var result = await handler.Handle(new DeleteEmployeeCommand(Guid.NewGuid()), CancellationToken.None);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task Handle_AlreadyDeletedEmployee_ReturnsFalse()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var employee = new Employee
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeNumber = "EMP002",
            FirstName = "Jane",
            LastName = "Doe",
            Email = "jane@test.com",
            WorkerType = WorkerType.Office,
            Status = EmploymentStatus.Active,
            IsDeleted = true, // Already deleted
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.Set<Employee>().Add(employee);
        await context.SaveChangesAsync();

        var handler = new DeleteEmployeeHandler(context);

        // Act
        var result = await handler.Handle(new DeleteEmployeeCommand(employee.Id), CancellationToken.None);

        // Assert
        result.Should().BeFalse();
    }
}
