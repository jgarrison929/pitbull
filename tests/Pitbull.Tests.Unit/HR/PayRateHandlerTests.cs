using FluentAssertions;
using Pitbull.Core.MultiTenancy;
using Pitbull.HR.Domain;
using Pitbull.HR.Features.CreatePayRate;
using Pitbull.HR.Features.DeletePayRate;
using Pitbull.HR.Features.GetPayRate;
using Pitbull.HR.Features.UpdatePayRate;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.HR;

public class PayRateHandlerTests
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

    #region CreatePayRate

    [Fact]
    public async Task CreatePayRate_ValidCommand_CreatesPayRate()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        var employee = CreateTestEmployee(tenantContext.TenantId);
        context.Set<Employee>().Add(employee);
        await context.SaveChangesAsync();

        var handler = new CreatePayRateHandler(context, tenantContext);
        var command = new CreatePayRateCommand(
            EmployeeId: employee.Id,
            Description: "Standard hourly rate",
            RateType: RateType.Hourly,
            Amount: 45.00m,
            Currency: "USD",
            EffectiveDate: DateOnly.FromDateTime(DateTime.UtcNow),
            ExpirationDate: null,
            ProjectId: null,
            ShiftCode: null,
            WorkState: "CA",
            Priority: 10,
            IncludesFringe: false,
            FringeRate: null,
            HealthWelfareRate: null,
            PensionRate: null,
            TrainingRate: null,
            OtherFringeRate: null,
            Source: RateSource.Manual,
            Notes: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Amount.Should().Be(45.00m);
        result.Value.RateType.Should().Be("Hourly");
        result.Value.WorkState.Should().Be("CA");
    }

    [Fact]
    public async Task CreatePayRate_WithFringe_CalculatesTotalCost()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        var employee = CreateTestEmployee(tenantContext.TenantId);
        context.Set<Employee>().Add(employee);
        await context.SaveChangesAsync();

        var handler = new CreatePayRateHandler(context, tenantContext);
        var command = new CreatePayRateCommand(
            EmployeeId: employee.Id,
            Description: "Union scale with fringe",
            RateType: RateType.Hourly,
            Amount: 50.00m,
            Currency: "USD",
            EffectiveDate: DateOnly.FromDateTime(DateTime.UtcNow),
            ExpirationDate: null,
            ProjectId: null,
            ShiftCode: null,
            WorkState: null,
            Priority: 80,
            IncludesFringe: true,
            FringeRate: 5.00m,
            HealthWelfareRate: 8.50m,
            PensionRate: 6.25m,
            TrainingRate: 0.75m,
            OtherFringeRate: 1.00m,
            Source: RateSource.UnionScale,
            Notes: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Amount.Should().Be(50.00m);
        // Total = 50 + 5 + 8.5 + 6.25 + 0.75 + 1 = 71.50
        result.Value.TotalHourlyCost.Should().Be(71.50m);
    }

    [Fact]
    public async Task CreatePayRate_NonExistentEmployee_ReturnsFailure()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        var handler = new CreatePayRateHandler(context, tenantContext);
        var command = new CreatePayRateCommand(
            EmployeeId: Guid.NewGuid(),
            Description: "Test rate",
            RateType: RateType.Hourly,
            Amount: 25.00m,
            Currency: null,
            EffectiveDate: DateOnly.FromDateTime(DateTime.UtcNow),
            ExpirationDate: null,
            ProjectId: null,
            ShiftCode: null,
            WorkState: null,
            Priority: null,
            IncludesFringe: false,
            FringeRate: null,
            HealthWelfareRate: null,
            PensionRate: null,
            TrainingRate: null,
            OtherFringeRate: null,
            Source: null,
            Notes: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("EMPLOYEE_NOT_FOUND");
    }

    #endregion

    #region GetPayRate

    [Fact]
    public async Task GetPayRate_ExistingPayRate_ReturnsPayRate()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var payRate = new PayRate
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeId = employee.Id,
            Description = "Day shift rate",
            RateType = RateType.Hourly,
            Amount = 40.00m,
            Currency = "USD",
            EffectiveDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-1)),
            ShiftCode = "DAY",
            Priority = 50,
            CreatedAt = DateTime.UtcNow
        };
        context.Set<PayRate>().Add(payRate);
        await context.SaveChangesAsync();

        var handler = new GetPayRateHandler(context);

        // Act
        var result = await handler.Handle(new GetPayRateQuery(payRate.Id), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Amount.Should().Be(40.00m);
        result.Value.ShiftCode.Should().Be("DAY");
    }

    [Fact]
    public async Task GetPayRate_NonExistent_ReturnsNotFound()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var handler = new GetPayRateHandler(context);

        // Act
        var result = await handler.Handle(new GetPayRateQuery(Guid.NewGuid()), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task GetPayRate_DeletedPayRate_ReturnsNotFound()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var payRate = new PayRate
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeId = employee.Id,
            RateType = RateType.Hourly,
            Amount = 35.00m,
            EffectiveDate = DateOnly.FromDateTime(DateTime.UtcNow),
            IsDeleted = true,
            CreatedAt = DateTime.UtcNow
        };
        context.Set<PayRate>().Add(payRate);
        await context.SaveChangesAsync();

        var handler = new GetPayRateHandler(context);

        // Act
        var result = await handler.Handle(new GetPayRateQuery(payRate.Id), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region UpdatePayRate

    [Fact]
    public async Task UpdatePayRate_ValidCommand_UpdatesPayRate()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var payRate = new PayRate
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeId = employee.Id,
            Description = "Old description",
            RateType = RateType.Hourly,
            Amount = 30.00m,
            Currency = "USD",
            EffectiveDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-1)),
            Priority = 10,
            CreatedAt = DateTime.UtcNow
        };
        context.Set<PayRate>().Add(payRate);
        await context.SaveChangesAsync();

        var handler = new UpdatePayRateHandler(context);
        var command = new UpdatePayRateCommand(
            Id: payRate.Id,
            Description: "Updated description",
            RateType: RateType.Hourly,
            Amount: 35.00m,
            Currency: "USD",
            EffectiveDate: DateOnly.FromDateTime(DateTime.UtcNow),
            ExpirationDate: null,
            ProjectId: null,
            ShiftCode: "DAY",
            WorkState: "CA",
            Priority: 50,
            IncludesFringe: false,
            FringeRate: null,
            HealthWelfareRate: null,
            PensionRate: null,
            TrainingRate: null,
            OtherFringeRate: null,
            Source: null,
            Notes: "Rate increase approved"
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Description.Should().Be("Updated description");
        result.Value.Amount.Should().Be(35.00m);
        result.Value.ShiftCode.Should().Be("DAY");
        result.Value.Notes.Should().Be("Rate increase approved");
    }

    [Fact]
    public async Task UpdatePayRate_NonExistent_ReturnsNotFound()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var handler = new UpdatePayRateHandler(context);
        var command = new UpdatePayRateCommand(
            Id: Guid.NewGuid(),
            Description: "Test",
            RateType: RateType.Hourly,
            Amount: 30.00m,
            Currency: "USD",
            EffectiveDate: DateOnly.FromDateTime(DateTime.UtcNow),
            ExpirationDate: null,
            ProjectId: null,
            ShiftCode: null,
            WorkState: null,
            Priority: null,
            IncludesFringe: false,
            FringeRate: null,
            HealthWelfareRate: null,
            PensionRate: null,
            TrainingRate: null,
            OtherFringeRate: null,
            Source: null,
            Notes: null
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region DeletePayRate

    [Fact]
    public async Task DeletePayRate_ExistingPayRate_SoftDeletes()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var payRate = new PayRate
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeId = employee.Id,
            RateType = RateType.Hourly,
            Amount = 35.00m,
            EffectiveDate = DateOnly.FromDateTime(DateTime.UtcNow),
            CreatedAt = DateTime.UtcNow
        };
        context.Set<PayRate>().Add(payRate);
        await context.SaveChangesAsync();

        var handler = new DeletePayRateHandler(context);

        // Act
        var result = await handler.Handle(new DeletePayRateCommand(payRate.Id), CancellationToken.None);

        // Assert
        result.Should().BeTrue();
        var deleted = await context.Set<PayRate>().FindAsync(payRate.Id);
        deleted!.IsDeleted.Should().BeTrue();
    }

    [Fact]
    public async Task DeletePayRate_NonExistent_ReturnsFalse()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var handler = new DeletePayRateHandler(context);

        // Act
        var result = await handler.Handle(new DeletePayRateCommand(Guid.NewGuid()), CancellationToken.None);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task DeletePayRate_AlreadyDeleted_ReturnsFalse()
    {
        // Arrange
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var payRate = new PayRate
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeId = employee.Id,
            RateType = RateType.Hourly,
            Amount = 35.00m,
            EffectiveDate = DateOnly.FromDateTime(DateTime.UtcNow),
            IsDeleted = true,
            CreatedAt = DateTime.UtcNow
        };
        context.Set<PayRate>().Add(payRate);
        await context.SaveChangesAsync();

        var handler = new DeletePayRateHandler(context);

        // Act
        var result = await handler.Handle(new DeletePayRateCommand(payRate.Id), CancellationToken.None);

        // Assert
        result.Should().BeFalse();
    }

    #endregion
}
