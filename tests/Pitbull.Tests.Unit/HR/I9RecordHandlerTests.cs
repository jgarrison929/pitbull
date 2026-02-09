using FluentAssertions;
using Pitbull.Core.MultiTenancy;
using Pitbull.HR.Domain;
using Pitbull.HR.Features.CreateI9Record;
using Pitbull.HR.Features.DeleteI9Record;
using Pitbull.HR.Features.GetI9Record;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.HR;

public class I9RecordHandlerTests
{
    private static Employee CreateTestEmployee(Guid tenantId) => new()
    {
        Id = Guid.NewGuid(), TenantId = tenantId, EmployeeNumber = "EMP001",
        FirstName = "John", LastName = "Doe", Email = "john@test.com",
        WorkerType = WorkerType.Field, Status = EmploymentStatus.Active, CreatedAt = DateTime.UtcNow
    };

    [Fact]
    public async Task CreateI9Record_USCitizen_CreatesRecord()
    {
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        var employee = CreateTestEmployee(tenantContext.TenantId);
        context.Set<Employee>().Add(employee);
        await context.SaveChangesAsync();

        var handler = new CreateI9RecordHandler(context, tenantContext);
        var command = new CreateI9RecordCommand(
            EmployeeId: employee.Id, Section1CompletedDate: DateOnly.FromDateTime(DateTime.UtcNow),
            CitizenshipStatus: "Citizen", AlienNumber: null, I94Number: null,
            ForeignPassportNumber: null, ForeignPassportCountry: null,
            WorkAuthorizationExpires: null, EmploymentStartDate: DateOnly.FromDateTime(DateTime.UtcNow),
            Notes: null
        );

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.CitizenshipStatus.Should().Be("Citizen");
        result.Value.Status.Should().Be("Section1Complete");
    }

    [Fact]
    public async Task CreateI9Record_Alien_TracksWorkAuth()
    {
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        var employee = CreateTestEmployee(tenantContext.TenantId);
        context.Set<Employee>().Add(employee);
        await context.SaveChangesAsync();

        var handler = new CreateI9RecordHandler(context, tenantContext);
        var expiration = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(2));
        var command = new CreateI9RecordCommand(
            EmployeeId: employee.Id, Section1CompletedDate: DateOnly.FromDateTime(DateTime.UtcNow),
            CitizenshipStatus: "Alien", AlienNumber: "A12345678", I94Number: "I94-2026",
            ForeignPassportNumber: "P123456", ForeignPassportCountry: "Mexico",
            WorkAuthorizationExpires: expiration, EmploymentStartDate: DateOnly.FromDateTime(DateTime.UtcNow),
            Notes: "H-1B visa holder"
        );

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.CitizenshipStatus.Should().Be("Alien");
        result.Value.AlienNumber.Should().Be("A12345678");
        result.Value.WorkAuthorizationExpires.Should().Be(expiration);
    }

    [Fact]
    public async Task CreateI9Record_DuplicateForEmployee_ReturnsFailure()
    {
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        var employee = CreateTestEmployee(tenantContext.TenantId);
        context.Set<Employee>().Add(employee);
        
        // Add existing I-9
        context.Set<I9Record>().Add(new I9Record
        {
            Id = Guid.NewGuid(), TenantId = tenantContext.TenantId, EmployeeId = employee.Id,
            Section1CompletedDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-1)),
            CitizenshipStatus = "Citizen", EmploymentStartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-1)),
            Status = I9Status.Section2Complete, CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var handler = new CreateI9RecordHandler(context, tenantContext);
        var command = new CreateI9RecordCommand(
            EmployeeId: employee.Id, Section1CompletedDate: DateOnly.FromDateTime(DateTime.UtcNow),
            CitizenshipStatus: "Citizen", AlienNumber: null, I94Number: null,
            ForeignPassportNumber: null, ForeignPassportCountry: null,
            WorkAuthorizationExpires: null, EmploymentStartDate: DateOnly.FromDateTime(DateTime.UtcNow), Notes: null
        );

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("I9_EXISTS");
    }

    [Fact]
    public async Task GetI9Record_ExistingRecord_ReturnsRecord()
    {
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var i9 = new I9Record
        {
            Id = Guid.NewGuid(), TenantId = TestDbContextFactory.TestTenantId, EmployeeId = employee.Id,
            Section1CompletedDate = DateOnly.FromDateTime(DateTime.UtcNow),
            CitizenshipStatus = "LPR", AlienNumber = "A987654321",
            EmploymentStartDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Status = I9Status.Verified, CreatedAt = DateTime.UtcNow
        };
        context.Set<I9Record>().Add(i9);
        await context.SaveChangesAsync();

        var handler = new GetI9RecordHandler(context);
        var result = await handler.Handle(new GetI9RecordQuery(i9.Id), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.CitizenshipStatus.Should().Be("LPR");
        result.Value.AlienNumber.Should().Be("A987654321");
    }

    [Fact]
    public async Task DeleteI9Record_ExistingRecord_SoftDeletes()
    {
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var i9 = new I9Record
        {
            Id = Guid.NewGuid(), TenantId = TestDbContextFactory.TestTenantId, EmployeeId = employee.Id,
            Section1CompletedDate = DateOnly.FromDateTime(DateTime.UtcNow), CitizenshipStatus = "Citizen",
            EmploymentStartDate = DateOnly.FromDateTime(DateTime.UtcNow), Status = I9Status.Section1Complete,
            CreatedAt = DateTime.UtcNow
        };
        context.Set<I9Record>().Add(i9);
        await context.SaveChangesAsync();

        var handler = new DeleteI9RecordHandler(context);
        var result = await handler.Handle(new DeleteI9RecordCommand(i9.Id), CancellationToken.None);

        result.Should().BeTrue();
        var deleted = await context.Set<I9Record>().FindAsync(i9.Id);
        deleted!.IsDeleted.Should().BeTrue();
    }
}
