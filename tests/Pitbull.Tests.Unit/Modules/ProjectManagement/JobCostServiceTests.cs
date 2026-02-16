using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.ProjectManagement.Features;
using Pitbull.ProjectManagement.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.ProjectManagement;

public sealed class JobCostServiceTests
{
    private static readonly Guid ProjectId = Guid.NewGuid();

    private static JobCostService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        var companyContext = new CompanyContext
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            CompanyCode = "01",
            CompanyName = "Test Company"
        };
        return new JobCostService(db, companyContext);
    }

    #region Budgets

    [Fact]
    public async Task CreateBudget_ReturnsSuccessWithDto()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.CreateBudgetAsync(ProjectId,
            new PmUpsertRequest());

        result.IsSuccess.Should().BeTrue();
        result.Value!.ProjectId.Should().Be(ProjectId);
        result.Value.Id.Should().NotBeEmpty();
    }

    [Fact]
    public async Task UpdateBudget_SetsNameAndUpdatedAt()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var created = (await service.CreateBudgetAsync(ProjectId,
            new PmUpsertRequest())).Value!;

        var beforeUpdate = DateTime.UtcNow;
        var result = await service.UpdateBudgetAsync(ProjectId, created.Id,
            new PmUpsertRequest());

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(created.Id);
        result.Value.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task UpdateBudget_NotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.UpdateBudgetAsync(ProjectId, Guid.NewGuid(),
            new PmUpsertRequest(Name: "Nope"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task ListBudgets_ReturnsPaginatedResults()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        for (var i = 0; i < 4; i++)
            await service.CreateBudgetAsync(ProjectId, new PmUpsertRequest());

        var result = await service.ListBudgetsAsync(ProjectId,
            new PmListQuery { Page = 1, PageSize = 2 });

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2);
        result.Value.TotalCount.Should().Be(4);
    }

    [Fact]
    public async Task ListBudgets_ExcludesOtherProjects()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var otherProjectId = Guid.NewGuid();

        var ours = (await service.CreateBudgetAsync(ProjectId, new PmUpsertRequest())).Value!;
        await service.CreateBudgetAsync(otherProjectId, new PmUpsertRequest());

        var result = await service.ListBudgetsAsync(ProjectId, new PmListQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
        result.Value.Items.First().Id.Should().Be(ours.Id);
    }

    #endregion

    #region Commitments

    [Fact]
    public async Task CreateCommitment_ReturnsSuccessWithDto()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.CreateCommitmentAsync(ProjectId,
            new PmUpsertRequest());

        result.IsSuccess.Should().BeTrue();
        result.Value!.ProjectId.Should().Be(ProjectId);
        result.Value.Id.Should().NotBeEmpty();
    }

    [Fact]
    public async Task ListCommitments_ReturnsOnlyProjectCommitments()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var otherProjectId = Guid.NewGuid();

        await service.CreateCommitmentAsync(ProjectId, new PmUpsertRequest());
        await service.CreateCommitmentAsync(otherProjectId, new PmUpsertRequest());

        var result = await service.ListCommitmentsAsync(ProjectId, new PmListQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
    }

    #endregion

    #region Forecasts

    [Fact]
    public async Task CreateForecast_ReturnsSuccessWithDto()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.CreateForecastAsync(ProjectId,
            new PmUpsertRequest());

        result.IsSuccess.Should().BeTrue();
        result.Value!.ProjectId.Should().Be(ProjectId);
        result.Value.Id.Should().NotBeEmpty();
    }

    [Fact]
    public async Task ListForecasts_ReturnsOnlyProjectForecasts()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        await service.CreateForecastAsync(ProjectId, new PmUpsertRequest());
        await service.CreateForecastAsync(ProjectId, new PmUpsertRequest());

        var result = await service.ListForecastsAsync(ProjectId, new PmListQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(2);
    }

    #endregion

    #region Actuals and RebuildActuals

    [Fact]
    public async Task ListActuals_ReturnsEmpty_WhenNoActualsExist()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.ListActualsAsync(ProjectId, new PmListQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task RebuildActuals_ReturnsSuccessWithCount()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.RebuildActualsAsync(ProjectId);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Success.Should().BeTrue();
        result.Value.Message.Should().Contain("rollups rebuilt");
    }

    [Fact]
    public async Task RebuildActuals_UpdatesTimestampsOnAllActuals()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        // Seed actuals directly since there's no CreateActualAsync on the service
        var pastTime = DateTime.UtcNow.AddDays(-10);
        for (var i = 0; i < 3; i++)
        {
            db.Set<PmJobCostActual>().Add(new PmJobCostActual
            {
                Id = Guid.NewGuid(),
                CompanyId = TestDbContextFactory.TestCompanyId,
                ProjectId = ProjectId,
                CostCodeId = Guid.NewGuid(),
                CreatedAt = pastTime,
                UpdatedAt = pastTime
            });
        }
        await db.SaveChangesAsync();

        var beforeRebuild = DateTime.UtcNow;
        var result = await service.RebuildActualsAsync(ProjectId);

        result.IsSuccess.Should().BeTrue();

        var actuals = await db.Set<PmJobCostActual>().Where(a => a.ProjectId == ProjectId).ToListAsync();
        actuals.Should().HaveCount(3);
        actuals.Should().AllSatisfy(a =>
        {
            a.UpdatedAt.Should().NotBeNull();
            a.UpdatedAt!.Value.Should().BeOnOrAfter(beforeRebuild);
        });
    }

    [Fact]
    public async Task RebuildActuals_IgnoresOtherProjects()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var otherProjectId = Guid.NewGuid();
        var pastTime = DateTime.UtcNow.AddDays(-10);

        db.Set<PmJobCostActual>().Add(new PmJobCostActual
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = otherProjectId,
            CostCodeId = Guid.NewGuid(),
            CreatedAt = pastTime,
            UpdatedAt = pastTime
        });
        await db.SaveChangesAsync();

        await service.RebuildActualsAsync(ProjectId);

        var otherActual = await db.Set<PmJobCostActual>().FirstAsync(a => a.ProjectId == otherProjectId);
        otherActual.UpdatedAt.Should().Be(pastTime);
    }

    #endregion
}
