using FluentAssertions;
using Pitbull.Core.MultiTenancy;
using Pitbull.HR.Domain;
using Pitbull.HR.Features.CreateDeduction;
using Pitbull.HR.Features.DeleteDeduction;
using Pitbull.HR.Features.GetDeduction;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.HR;

public class DeductionHandlerTests
{
    private static Employee CreateTestEmployee(Guid tenantId) => new()
    {
        Id = Guid.NewGuid(), TenantId = tenantId, EmployeeNumber = "EMP001",
        FirstName = "John", LastName = "Doe", Email = "john@test.com",
        WorkerType = WorkerType.Field, Status = EmploymentStatus.Active, CreatedAt = DateTime.UtcNow
    };

    [Fact]
    public async Task CreateDeduction_ValidCommand_CreatesDeduction()
    {
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        var employee = CreateTestEmployee(tenantContext.TenantId);
        context.Set<Employee>().Add(employee);
        await context.SaveChangesAsync();

        var handler = new CreateDeductionHandler(context, tenantContext);
        var command = new CreateDeductionCommand(
            EmployeeId: employee.Id, DeductionCode: "401K", Description: "401(k) Retirement",
            Method: DeductionMethod.PercentOfGross, Amount: 6.0m, MaxPerPeriod: null,
            AnnualMax: 22500m, Priority: 30, IsPreTax: true, EmployerMatch: 3.0m,
            EmployerMatchMax: 500m, EffectiveDate: DateOnly.FromDateTime(DateTime.UtcNow),
            CaseNumber: null, GarnishmentPayee: null, Notes: null
        );

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.DeductionCode.Should().Be("401K");
        result.Value.Method.Should().Be("PercentOfGross");
        result.Value.IsPreTax.Should().BeTrue();
    }

    [Fact]
    public async Task CreateDeduction_Garnishment_SetsGarnishmentFields()
    {
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        var employee = CreateTestEmployee(tenantContext.TenantId);
        context.Set<Employee>().Add(employee);
        await context.SaveChangesAsync();

        var handler = new CreateDeductionHandler(context, tenantContext);
        var command = new CreateDeductionCommand(
            EmployeeId: employee.Id, DeductionCode: "CHILD_SUPPORT", Description: "Child Support Garnishment",
            Method: DeductionMethod.FlatAmount, Amount: 400m, MaxPerPeriod: null,
            AnnualMax: null, Priority: 1, IsPreTax: false, EmployerMatch: null,
            EmployerMatchMax: null, EffectiveDate: DateOnly.FromDateTime(DateTime.UtcNow),
            CaseNumber: "CS-2026-12345", GarnishmentPayee: "CA Child Support Services", Notes: "Court order dated 2026-01-15"
        );

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.CaseNumber.Should().Be("CS-2026-12345");
        result.Value.GarnishmentPayee.Should().Be("CA Child Support Services");
        result.Value.Priority.Should().Be(1); // Garnishments get top priority
    }

    [Fact]
    public async Task GetDeduction_ExistingDeduction_ReturnsDeduction()
    {
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var deduction = new Deduction
        {
            Id = Guid.NewGuid(), TenantId = TestDbContextFactory.TestTenantId, EmployeeId = employee.Id,
            DeductionCode = "HEALTH", Description = "Health Insurance", Method = DeductionMethod.FlatAmount,
            Amount = 250m, Priority = 20, IsPreTax = true, EffectiveDate = DateOnly.FromDateTime(DateTime.UtcNow),
            CreatedAt = DateTime.UtcNow
        };
        context.Set<Deduction>().Add(deduction);
        await context.SaveChangesAsync();

        var handler = new GetDeductionHandler(context);
        var result = await handler.Handle(new GetDeductionQuery(deduction.Id), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.DeductionCode.Should().Be("HEALTH");
    }

    [Fact]
    public async Task DeleteDeduction_ExistingDeduction_SoftDeletes()
    {
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var deduction = new Deduction
        {
            Id = Guid.NewGuid(), TenantId = TestDbContextFactory.TestTenantId, EmployeeId = employee.Id,
            DeductionCode = "UNION", Description = "Union Dues", Method = DeductionMethod.FlatAmount,
            Amount = 50m, Priority = 40, IsPreTax = false, EffectiveDate = DateOnly.FromDateTime(DateTime.UtcNow),
            CreatedAt = DateTime.UtcNow
        };
        context.Set<Deduction>().Add(deduction);
        await context.SaveChangesAsync();

        var handler = new DeleteDeductionHandler(context);
        var result = await handler.Handle(new DeleteDeductionCommand(deduction.Id), CancellationToken.None);

        result.Should().BeTrue();
        var deleted = await context.Set<Deduction>().FindAsync(deduction.Id);
        deleted!.IsDeleted.Should().BeTrue();
    }
}
