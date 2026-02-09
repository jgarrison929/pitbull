using FluentAssertions;
using Pitbull.Core.MultiTenancy;
using Pitbull.HR.Domain;
using Pitbull.HR.Features.CreateEmploymentEpisode;
using Pitbull.HR.Features.DeleteEmploymentEpisode;
using Pitbull.HR.Features.GetEmploymentEpisode;
using Pitbull.HR.Features.UpdateEmploymentEpisode;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.HR;

public class EmploymentEpisodeHandlerTests
{
    private static Employee CreateTestEmployee(Guid tenantId) => new()
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

    [Fact]
    public async Task CreateEmploymentEpisode_ValidCommand_CreatesEpisode()
    {
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        var employee = CreateTestEmployee(tenantContext.TenantId);
        context.Set<Employee>().Add(employee);
        await context.SaveChangesAsync();

        var handler = new CreateEmploymentEpisodeHandler(context, tenantContext);
        var command = new CreateEmploymentEpisodeCommand(
            EmployeeId: employee.Id,
            HireDate: DateOnly.FromDateTime(DateTime.UtcNow),
            UnionDispatchReference: "DISP-001",
            JobClassificationAtHire: "Carpenter",
            HourlyRateAtHire: 45.00m,
            PositionAtHire: "Journeyman Carpenter"
        );

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.EpisodeNumber.Should().Be(1);
        result.Value.IsCurrent.Should().BeTrue();
    }

    [Fact]
    public async Task CreateEmploymentEpisode_AutoIncrementsEpisodeNumber()
    {
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        var employee = CreateTestEmployee(tenantContext.TenantId);
        context.Set<Employee>().Add(employee);
        
        // Add completed episode
        context.Set<EmploymentEpisode>().Add(new EmploymentEpisode
        {
            Id = Guid.NewGuid(),
            TenantId = tenantContext.TenantId,
            EmployeeId = employee.Id,
            EpisodeNumber = 1,
            HireDate = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-1)),
            TerminationDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-1)),
            SeparationReason = SeparationReason.EndOfProject,
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var handler = new CreateEmploymentEpisodeHandler(context, tenantContext);
        var command = new CreateEmploymentEpisodeCommand(
            EmployeeId: employee.Id,
            HireDate: DateOnly.FromDateTime(DateTime.UtcNow),
            UnionDispatchReference: null,
            JobClassificationAtHire: null,
            HourlyRateAtHire: null,
            PositionAtHire: null
        );

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.EpisodeNumber.Should().Be(2); // Rehire = episode 2
    }

    [Fact]
    public async Task CreateEmploymentEpisode_ActiveEpisodeExists_ReturnsFailure()
    {
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        var employee = CreateTestEmployee(tenantContext.TenantId);
        context.Set<Employee>().Add(employee);
        
        // Add active episode (no termination date)
        context.Set<EmploymentEpisode>().Add(new EmploymentEpisode
        {
            Id = Guid.NewGuid(),
            TenantId = tenantContext.TenantId,
            EmployeeId = employee.Id,
            EpisodeNumber = 1,
            HireDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-1)),
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var handler = new CreateEmploymentEpisodeHandler(context, tenantContext);
        var command = new CreateEmploymentEpisodeCommand(
            EmployeeId: employee.Id,
            HireDate: DateOnly.FromDateTime(DateTime.UtcNow),
            UnionDispatchReference: null,
            JobClassificationAtHire: null,
            HourlyRateAtHire: null,
            PositionAtHire: null
        );

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("ACTIVE_EPISODE_EXISTS");
    }

    [Fact]
    public async Task GetEmploymentEpisode_ExistingEpisode_ReturnsEpisode()
    {
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var episode = new EmploymentEpisode
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeId = employee.Id,
            EpisodeNumber = 1,
            HireDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-6)),
            CreatedAt = DateTime.UtcNow
        };
        context.Set<EmploymentEpisode>().Add(episode);
        await context.SaveChangesAsync();

        var handler = new GetEmploymentEpisodeHandler(context);
        var result = await handler.Handle(new GetEmploymentEpisodeQuery(episode.Id), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.EpisodeNumber.Should().Be(1);
        result.Value.DaysEmployed.Should().BeGreaterThan(100);
    }

    [Fact]
    public async Task UpdateEmploymentEpisode_TerminateEmployee_SetsTerminationFields()
    {
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var episode = new EmploymentEpisode
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeId = employee.Id,
            EpisodeNumber = 1,
            HireDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-3)),
            PositionAtHire = "Laborer",
            CreatedAt = DateTime.UtcNow
        };
        context.Set<EmploymentEpisode>().Add(episode);
        await context.SaveChangesAsync();

        var handler = new UpdateEmploymentEpisodeHandler(context);
        var command = new UpdateEmploymentEpisodeCommand(
            Id: episode.Id,
            TerminationDate: DateOnly.FromDateTime(DateTime.UtcNow),
            SeparationReason: SeparationReason.EndOfProject,
            EligibleForRehire: true,
            SeparationNotes: "Good worker, project completed",
            WasVoluntary: false,
            PositionAtTermination: "Lead Laborer"
        );

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.SeparationReason.Should().Be("EndOfProject");
        result.Value.EligibleForRehire.Should().BeTrue();
        result.Value.IsCurrent.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteEmploymentEpisode_ExistingEpisode_SoftDeletes()
    {
        using var context = TestDbContextFactory.Create();
        var employee = CreateTestEmployee(TestDbContextFactory.TestTenantId);
        context.Set<Employee>().Add(employee);
        
        var episode = new EmploymentEpisode
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeId = employee.Id,
            EpisodeNumber = 1,
            HireDate = DateOnly.FromDateTime(DateTime.UtcNow),
            CreatedAt = DateTime.UtcNow
        };
        context.Set<EmploymentEpisode>().Add(episode);
        await context.SaveChangesAsync();

        var handler = new DeleteEmploymentEpisodeHandler(context);
        var result = await handler.Handle(new DeleteEmploymentEpisodeCommand(episode.Id), CancellationToken.None);

        result.Should().BeTrue();
        var deleted = await context.Set<EmploymentEpisode>().FindAsync(episode.Id);
        deleted!.IsDeleted.Should().BeTrue();
    }
}
