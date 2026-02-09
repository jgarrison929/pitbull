using FluentAssertions;
using Pitbull.Core.MultiTenancy;
using Pitbull.HR.Domain;
using Pitbull.HR.Features.CreateEVerifyCase;
using Pitbull.HR.Features.DeleteEVerifyCase;
using Pitbull.HR.Features.GetEVerifyCase;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.HR;

public class EVerifyCaseHandlerTests
{
    private static Employee CreateTestEmployee(Guid tenantId) => new()
    {
        Id = Guid.NewGuid(), TenantId = tenantId, EmployeeNumber = "EMP001",
        FirstName = "John", LastName = "Doe", Email = "john@test.com",
        WorkerType = WorkerType.Field, Status = EmploymentStatus.Active, CreatedAt = DateTime.UtcNow
    };

    [Fact]
    public async Task CreateEVerifyCase_ValidCommand_CreatesCase()
    {
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        var employee = CreateTestEmployee(tenantContext.TenantId);
        context.Set<Employee>().Add(employee);
        await context.SaveChangesAsync();

        var handler = new CreateEVerifyCaseHandler(context, tenantContext);
        var command = new CreateEVerifyCaseCommand(
            EmployeeId: employee.Id, I9RecordId: null, CaseNumber: "EV-2026-12345",
            SubmittedDate: DateOnly.FromDateTime(DateTime.UtcNow), SubmittedBy: "hr@company.com", Notes: null
        );

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.CaseNumber.Should().Be("EV-2026-12345");
        result.Value.Status.Should().Be("Pending");
    }

    [Fact]
    public async Task CreateEVerifyCase_WithI9Link_CreatesCase()
    {
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        var employee = CreateTestEmployee(tenantContext.TenantId);
        context.Set<Employee>().Add(employee);
        
        var i9 = new I9Record
        {
            Id = Guid.NewGuid(), TenantId = tenantContext.TenantId, EmployeeId = employee.Id,
            Section1CompletedDate = DateOnly.FromDateTime(DateTime.UtcNow), CitizenshipStatus = "Citizen",
            EmploymentStartDate = DateOnly.FromDateTime(DateTime.UtcNow), Status = I9Status.Section2Complete,
            CreatedAt = DateTime.UtcNow
        };
        context.Set<I9Record>().Add(i9);
        await context.SaveChangesAsync();

        var handler = new CreateEVerifyCaseHandler(context, tenantContext);
        var command = new CreateEVerifyCaseCommand(
            EmployeeId: employee.Id, I9RecordId: i9.Id, CaseNumber: "EV-2026-67890",
            SubmittedDate: DateOnly.FromDateTime(DateTime.UtcNow), SubmittedBy: "hr@company.com", Notes: "Federal contract requirement"
        );

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.I9RecordId.Should().Be(i9.Id);
    }

    [Fact]
    public async Task GetEVerifyCase_ExistingCase_ReturnsCase()
    {
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var evCase = new EVerifyCase
        {
            Id = Guid.NewGuid(), TenantId = TestDbContextFactory.TestTenantId, EmployeeId = employee.Id,
            CaseNumber = "EV-2026-AUTH", SubmittedDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Status = EVerifyStatus.EmploymentAuthorized, Result = EVerifyResult.EmploymentAuthorized,
            ClosedDate = DateOnly.FromDateTime(DateTime.UtcNow), SubmittedBy = "hr@test.com", CreatedAt = DateTime.UtcNow
        };
        context.Set<EVerifyCase>().Add(evCase);
        await context.SaveChangesAsync();

        var handler = new GetEVerifyCaseHandler(context);
        var result = await handler.Handle(new GetEVerifyCaseQuery(evCase.Id), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("EmploymentAuthorized");
        result.Value.Result.Should().Be("EmploymentAuthorized");
    }

    [Fact]
    public async Task DeleteEVerifyCase_ExistingCase_SoftDeletes()
    {
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var evCase = new EVerifyCase
        {
            Id = Guid.NewGuid(), TenantId = TestDbContextFactory.TestTenantId, EmployeeId = employee.Id,
            CaseNumber = "EV-2026-DEL", SubmittedDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Status = EVerifyStatus.Pending, SubmittedBy = "hr@test.com", CreatedAt = DateTime.UtcNow
        };
        context.Set<EVerifyCase>().Add(evCase);
        await context.SaveChangesAsync();

        var handler = new DeleteEVerifyCaseHandler(context);
        var result = await handler.Handle(new DeleteEVerifyCaseCommand(evCase.Id), CancellationToken.None);

        result.Should().BeTrue();
        var deleted = await context.Set<EVerifyCase>().FindAsync(evCase.Id);
        deleted!.IsDeleted.Should().BeTrue();
    }
}
