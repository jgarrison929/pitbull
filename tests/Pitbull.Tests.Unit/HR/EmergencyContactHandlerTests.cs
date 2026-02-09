using FluentAssertions;
using Pitbull.Core.MultiTenancy;
using Pitbull.HR.Domain;
using Pitbull.HR.Features.CreateEmergencyContact;
using Pitbull.HR.Features.DeleteEmergencyContact;
using Pitbull.HR.Features.GetEmergencyContact;
using Pitbull.HR.Features.UpdateEmergencyContact;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.HR;

public class EmergencyContactHandlerTests
{
    private static Employee CreateTestEmployee(Guid tenantId)
    {
        return new Employee
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EmployeeNumber = "EMP001",
            FirstName = "John",
            LastName = "Doe",
            Email = "john@test.com",
            WorkerType = WorkerType.Field,
            Status = EmploymentStatus.Active,
            CreatedAt = DateTime.UtcNow
        };
    }

    #region CreateEmergencyContact

    [Fact]
    public async Task CreateEmergencyContact_ValidCommand_CreatesContact()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        var employee = CreateTestEmployee(tenantContext.TenantId);
        context.Set<Employee>().Add(employee);
        await context.SaveChangesAsync();

        var handler = new CreateEmergencyContactHandler(context, tenantContext);
        var command = new CreateEmergencyContactCommand(
            EmployeeId: employee.Id,
            Name: "Jane Doe",
            Relationship: "Spouse",
            PrimaryPhone: "555-123-4567",
            SecondaryPhone: "555-987-6543",
            Email: "jane@example.com",
            Priority: 1,
            Notes: "Primary contact"
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Name.Should().Be("Jane Doe");
        result.Value.Relationship.Should().Be("Spouse");
        result.Value.PrimaryPhone.Should().Be("555-123-4567");
        result.Value.Priority.Should().Be(1);
    }

    [Fact]
    public async Task CreateEmergencyContact_AutoAssignsPriority()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        var employee = CreateTestEmployee(tenantContext.TenantId);
        context.Set<Employee>().Add(employee);
        
        // Add existing contact with priority 1
        var existingContact = new EmergencyContact
        {
            Id = Guid.NewGuid(),
            TenantId = tenantContext.TenantId,
            EmployeeId = employee.Id,
            Name = "First Contact",
            Relationship = "Parent",
            PrimaryPhone = "555-111-1111",
            Priority = 1,
            CreatedAt = DateTime.UtcNow
        };
        context.Set<EmergencyContact>().Add(existingContact);
        await context.SaveChangesAsync();

        var handler = new CreateEmergencyContactHandler(context, tenantContext);
        var command = new CreateEmergencyContactCommand(
            EmployeeId: employee.Id,
            Name: "Second Contact",
            Relationship: "Sibling",
            PrimaryPhone: "555-222-2222",
            SecondaryPhone: null,
            Email: null,
            Priority: null, // Auto-assign
            Notes: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Priority.Should().Be(2); // Auto-assigned as next priority
    }

    [Fact]
    public async Task CreateEmergencyContact_NonExistentEmployee_ReturnsFailure()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        var handler = new CreateEmergencyContactHandler(context, tenantContext);
        var command = new CreateEmergencyContactCommand(
            EmployeeId: Guid.NewGuid(),
            Name: "Contact",
            Relationship: "Parent",
            PrimaryPhone: "555-123-4567",
            SecondaryPhone: null,
            Email: null,
            Priority: null,
            Notes: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("EMPLOYEE_NOT_FOUND");
    }

    #endregion

    #region GetEmergencyContact

    [Fact]
    public async Task GetEmergencyContact_ExistingContact_ReturnsContact()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var contact = new EmergencyContact
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeId = employee.Id,
            Name = "Emergency Contact",
            Relationship = "Parent",
            PrimaryPhone = "555-123-4567",
            Priority = 1,
            CreatedAt = DateTime.UtcNow
        };
        context.Set<EmergencyContact>().Add(contact);
        await context.SaveChangesAsync();

        var handler = new GetEmergencyContactHandler(context);

        // Act
        var result = await handler.Handle(new GetEmergencyContactQuery(contact.Id), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Name.Should().Be("Emergency Contact");
    }

    [Fact]
    public async Task GetEmergencyContact_NonExistent_ReturnsNotFound()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var handler = new GetEmergencyContactHandler(context);

        // Act
        var result = await handler.Handle(new GetEmergencyContactQuery(Guid.NewGuid()), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task GetEmergencyContact_DeletedContact_ReturnsNotFound()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var contact = new EmergencyContact
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeId = employee.Id,
            Name = "Deleted Contact",
            Relationship = "Parent",
            PrimaryPhone = "555-123-4567",
            Priority = 1,
            IsDeleted = true,
            CreatedAt = DateTime.UtcNow
        };
        context.Set<EmergencyContact>().Add(contact);
        await context.SaveChangesAsync();

        var handler = new GetEmergencyContactHandler(context);

        // Act
        var result = await handler.Handle(new GetEmergencyContactQuery(contact.Id), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region UpdateEmergencyContact

    [Fact]
    public async Task UpdateEmergencyContact_ValidCommand_UpdatesContact()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var contact = new EmergencyContact
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeId = employee.Id,
            Name = "Original Name",
            Relationship = "Parent",
            PrimaryPhone = "555-111-1111",
            Priority = 1,
            CreatedAt = DateTime.UtcNow
        };
        context.Set<EmergencyContact>().Add(contact);
        await context.SaveChangesAsync();

        var handler = new UpdateEmergencyContactHandler(context);
        var command = new UpdateEmergencyContactCommand(
            Id: contact.Id,
            Name: "Updated Name",
            Relationship: "Spouse",
            PrimaryPhone: "555-222-2222",
            SecondaryPhone: "555-333-3333",
            Email: "updated@example.com",
            Priority: 2,
            Notes: "Updated notes"
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Name.Should().Be("Updated Name");
        result.Value.Relationship.Should().Be("Spouse");
        result.Value.PrimaryPhone.Should().Be("555-222-2222");
        result.Value.Priority.Should().Be(2);
    }

    [Fact]
    public async Task UpdateEmergencyContact_NonExistent_ReturnsNotFound()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var handler = new UpdateEmergencyContactHandler(context);
        var command = new UpdateEmergencyContactCommand(
            Id: Guid.NewGuid(),
            Name: "Test",
            Relationship: "Parent",
            PrimaryPhone: "555-123-4567",
            SecondaryPhone: null,
            Email: null,
            Priority: null,
            Notes: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region DeleteEmergencyContact

    [Fact]
    public async Task DeleteEmergencyContact_ExistingContact_SoftDeletes()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var contact = new EmergencyContact
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeId = employee.Id,
            Name = "To Delete",
            Relationship = "Parent",
            PrimaryPhone = "555-123-4567",
            Priority = 1,
            CreatedAt = DateTime.UtcNow
        };
        context.Set<EmergencyContact>().Add(contact);
        await context.SaveChangesAsync();

        var handler = new DeleteEmergencyContactHandler(context);

        // Act
        var result = await handler.Handle(new DeleteEmergencyContactCommand(contact.Id), CancellationToken.None);

        // Assert
        result.Should().BeTrue();
        var deleted = await context.Set<EmergencyContact>().FindAsync(contact.Id);
        deleted!.IsDeleted.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteEmergencyContact_NonExistent_ReturnsFalse()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var handler = new DeleteEmergencyContactHandler(context);

        // Act
        var result = await handler.Handle(new DeleteEmergencyContactCommand(Guid.NewGuid()), CancellationToken.None);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteEmergencyContact_AlreadyDeleted_ReturnsFalse()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var contact = new EmergencyContact
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeId = employee.Id,
            Name = "Already Deleted",
            Relationship = "Parent",
            PrimaryPhone = "555-123-4567",
            Priority = 1,
            IsDeleted = true,
            CreatedAt = DateTime.UtcNow
        };
        context.Set<EmergencyContact>().Add(contact);
        await context.SaveChangesAsync();

        var handler = new DeleteEmergencyContactHandler(context);

        // Act
        var result = await handler.Handle(new DeleteEmergencyContactCommand(contact.Id), CancellationToken.None);

        // Assert
        result.Should().BeFalse();
    }

    #endregion
}
