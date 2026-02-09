using FluentAssertions;
using Pitbull.Core.MultiTenancy;
using Pitbull.HR.Domain;
using Pitbull.HR.Features.CreateUnionMembership;
using Pitbull.HR.Features.DeleteUnionMembership;
using Pitbull.HR.Features.GetUnionMembership;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.HR;

public class UnionMembershipHandlerTests
{
    private static Employee CreateTestEmployee(Guid tenantId) => new()
    {
        Id = Guid.NewGuid(), TenantId = tenantId, EmployeeNumber = "EMP001",
        FirstName = "John", LastName = "Doe", Email = "john@test.com",
        WorkerType = WorkerType.Field, Status = EmploymentStatus.Active, CreatedAt = DateTime.UtcNow
    };

    [Fact]
    public async Task CreateUnionMembership_ValidCommand_CreatesMembership()
    {
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        var employee = CreateTestEmployee(tenantContext.TenantId);
        context.Set<Employee>().Add(employee);
        await context.SaveChangesAsync();

        var handler = new CreateUnionMembershipHandler(context, tenantContext);
        var command = new CreateUnionMembershipCommand(
            EmployeeId: employee.Id, UnionLocal: "IBEW Local 11", MembershipNumber: "123456",
            Classification: "Journeyman Electrician", ApprenticeLevel: null,
            JoinDate: DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-5)), DuesPaid: true,
            DuesPaidThrough: DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(3)),
            DispatchNumber: "DISP-2026-001", DispatchDate: DateOnly.FromDateTime(DateTime.UtcNow),
            DispatchListPosition: null, FringeRate: 8.50m, HealthWelfareRate: 12.00m,
            PensionRate: 9.25m, TrainingRate: 0.75m, EffectiveDate: DateOnly.FromDateTime(DateTime.UtcNow),
            Notes: null
        );

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.UnionLocal.Should().Be("IBEW Local 11");
        result.Value.Classification.Should().Be("Journeyman Electrician");
        result.Value.DuesPaid.Should().BeTrue();
    }

    [Fact]
    public async Task CreateUnionMembership_Apprentice_TracksApprenticeLevel()
    {
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        var employee = CreateTestEmployee(tenantContext.TenantId);
        context.Set<Employee>().Add(employee);
        await context.SaveChangesAsync();

        var handler = new CreateUnionMembershipHandler(context, tenantContext);
        var command = new CreateUnionMembershipCommand(
            EmployeeId: employee.Id, UnionLocal: "UA Local 78", MembershipNumber: "A-789",
            Classification: "Apprentice Plumber", ApprenticeLevel: 2,
            JoinDate: DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-1)), DuesPaid: true,
            DuesPaidThrough: DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(1)),
            DispatchNumber: null, DispatchDate: null, DispatchListPosition: 15,
            FringeRate: 5.00m, HealthWelfareRate: 8.00m, PensionRate: 6.00m, TrainingRate: 1.50m,
            EffectiveDate: DateOnly.FromDateTime(DateTime.UtcNow), Notes: "2nd year apprentice"
        );

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Classification.Should().Be("Apprentice Plumber");
        result.Value.ApprenticeLevel.Should().Be(2);
    }

    [Fact]
    public async Task GetUnionMembership_ExistingMembership_ReturnsMembership()
    {
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var membership = new UnionMembership
        {
            Id = Guid.NewGuid(), TenantId = TestDbContextFactory.TestTenantId, EmployeeId = employee.Id,
            UnionLocal = "Carpenters Local 22", MembershipNumber = "C-555", Classification = "Foreman",
            DuesPaid = true, EffectiveDate = DateOnly.FromDateTime(DateTime.UtcNow), CreatedAt = DateTime.UtcNow
        };
        context.Set<UnionMembership>().Add(membership);
        await context.SaveChangesAsync();

        var handler = new GetUnionMembershipHandler(context);
        var result = await handler.Handle(new GetUnionMembershipQuery(membership.Id), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.UnionLocal.Should().Be("Carpenters Local 22");
    }

    [Fact]
    public async Task DeleteUnionMembership_ExistingMembership_SoftDeletes()
    {
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var membership = new UnionMembership
        {
            Id = Guid.NewGuid(), TenantId = TestDbContextFactory.TestTenantId, EmployeeId = employee.Id,
            UnionLocal = "Laborers Local 300", MembershipNumber = "L-999", Classification = "Laborer",
            DuesPaid = false, EffectiveDate = DateOnly.FromDateTime(DateTime.UtcNow), CreatedAt = DateTime.UtcNow
        };
        context.Set<UnionMembership>().Add(membership);
        await context.SaveChangesAsync();

        var handler = new DeleteUnionMembershipHandler(context);
        var result = await handler.Handle(new DeleteUnionMembershipCommand(membership.Id), CancellationToken.None);

        result.Should().BeTrue();
        var deleted = await context.Set<UnionMembership>().FindAsync(membership.Id);
        deleted!.IsDeleted.Should().BeTrue();
    }
}
