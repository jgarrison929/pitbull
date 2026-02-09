using FluentAssertions;
using Pitbull.Core.MultiTenancy;
using Pitbull.HR.Domain;
using Pitbull.HR.Features.CreateWithholdingElection;
using Pitbull.HR.Features.DeleteWithholdingElection;
using Pitbull.HR.Features.GetWithholdingElection;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.HR;

public class WithholdingElectionHandlerTests
{
    private static Employee CreateTestEmployee(Guid tenantId) => new()
    {
        Id = Guid.NewGuid(), TenantId = tenantId, EmployeeNumber = "EMP001",
        FirstName = "John", LastName = "Doe", Email = "john@test.com",
        WorkerType = WorkerType.Field, Status = EmploymentStatus.Active, CreatedAt = DateTime.UtcNow
    };

    [Fact]
    public async Task CreateWithholdingElection_ValidCommand_CreatesElection()
    {
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        var employee = CreateTestEmployee(tenantContext.TenantId);
        context.Set<Employee>().Add(employee);
        await context.SaveChangesAsync();

        var handler = new CreateWithholdingElectionHandler(context, tenantContext);
        var command = new CreateWithholdingElectionCommand(
            EmployeeId: employee.Id, TaxJurisdiction: "FEDERAL", FilingStatus: FilingStatus.MarriedFilingJointly,
            Allowances: 2, AdditionalWithholding: 50.00m, IsExempt: false, MultipleJobsOrSpouseWorks: true,
            DependentCredits: 2000m, OtherIncome: null, Deductions: null,
            EffectiveDate: DateOnly.FromDateTime(DateTime.UtcNow), SignedDate: DateOnly.FromDateTime(DateTime.UtcNow), Notes: null
        );

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.TaxJurisdiction.Should().Be("FEDERAL");
        result.Value.FilingStatus.Should().Be("MarriedFilingJointly");
        result.Value.IsCurrent.Should().BeTrue();
    }

    [Fact]
    public async Task CreateWithholdingElection_ExpiresExistingElection()
    {
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        var employee = CreateTestEmployee(tenantContext.TenantId);
        context.Set<Employee>().Add(employee);
        
        var existingElection = new WithholdingElection
        {
            Id = Guid.NewGuid(), TenantId = tenantContext.TenantId, EmployeeId = employee.Id,
            TaxJurisdiction = "FEDERAL", FilingStatus = FilingStatus.Single, Allowances = 1,
            EffectiveDate = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-1)),
            CreatedAt = DateTime.UtcNow
        };
        context.Set<WithholdingElection>().Add(existingElection);
        await context.SaveChangesAsync();

        var handler = new CreateWithholdingElectionHandler(context, tenantContext);
        var newEffectiveDate = DateOnly.FromDateTime(DateTime.UtcNow);
        var command = new CreateWithholdingElectionCommand(
            EmployeeId: employee.Id, TaxJurisdiction: "FEDERAL", FilingStatus: FilingStatus.MarriedFilingJointly,
            Allowances: 3, AdditionalWithholding: 0, IsExempt: false, MultipleJobsOrSpouseWorks: false,
            DependentCredits: null, OtherIncome: null, Deductions: null,
            EffectiveDate: newEffectiveDate, SignedDate: null, Notes: "Updated W-4"
        );

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        
        var oldElection = await context.Set<WithholdingElection>().FindAsync(existingElection.Id);
        oldElection!.ExpirationDate.Should().Be(newEffectiveDate.AddDays(-1));
    }

    [Fact]
    public async Task GetWithholdingElection_ExistingElection_ReturnsElection()
    {
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var election = new WithholdingElection
        {
            Id = Guid.NewGuid(), TenantId = TestDbContextFactory.TestTenantId, EmployeeId = employee.Id,
            TaxJurisdiction = "CA", FilingStatus = FilingStatus.Single, Allowances = 0,
            EffectiveDate = DateOnly.FromDateTime(DateTime.UtcNow), CreatedAt = DateTime.UtcNow
        };
        context.Set<WithholdingElection>().Add(election);
        await context.SaveChangesAsync();

        var handler = new GetWithholdingElectionHandler(context);
        var result = await handler.Handle(new GetWithholdingElectionQuery(election.Id), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.TaxJurisdiction.Should().Be("CA");
    }

    [Fact]
    public async Task DeleteWithholdingElection_ExistingElection_SoftDeletes()
    {
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var election = new WithholdingElection
        {
            Id = Guid.NewGuid(), TenantId = TestDbContextFactory.TestTenantId, EmployeeId = employee.Id,
            TaxJurisdiction = "TX", FilingStatus = FilingStatus.Single, Allowances = 0,
            EffectiveDate = DateOnly.FromDateTime(DateTime.UtcNow), CreatedAt = DateTime.UtcNow
        };
        context.Set<WithholdingElection>().Add(election);
        await context.SaveChangesAsync();

        var handler = new DeleteWithholdingElectionHandler(context);
        var result = await handler.Handle(new DeleteWithholdingElectionCommand(election.Id), CancellationToken.None);

        result.Should().BeTrue();
        var deleted = await context.Set<WithholdingElection>().FindAsync(election.Id);
        deleted!.IsDeleted.Should().BeTrue();
    }
}
