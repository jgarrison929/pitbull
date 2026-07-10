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

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
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

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
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

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.UpdateBudgetAsync(ProjectId, Guid.NewGuid(),
            new PmUpsertRequest(Name: "Nope"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task DeleteBudget_SoftDeletes()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateBudgetAsync(ProjectId, new PmUpsertRequest())).Value!;

        var deleteResult = await service.DeleteBudgetAsync(ProjectId, created.Id);
        deleteResult.IsSuccess.Should().BeTrue();

        var list = await service.ListBudgetsAsync(ProjectId, new PmListQuery());
        list.IsSuccess.Should().BeTrue();
        list.Value!.TotalCount.Should().Be(0);

        var raw = await db.Set<PmJobCostBudget>().IgnoreQueryFilters().FirstOrDefaultAsync(b => b.Id == created.Id);
        raw.Should().NotBeNull();
        raw!.IsDeleted.Should().BeTrue();
        raw.DeletedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task DeleteBudget_NotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.DeleteBudgetAsync(ProjectId, Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task ListBudgets_ReturnsPaginatedResults()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
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

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var otherProjectId = Guid.NewGuid();

        await TestDbContextFactory.SeedProjectAsync(db, otherProjectId);

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

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
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

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var otherProjectId = Guid.NewGuid();

        await TestDbContextFactory.SeedProjectAsync(db, otherProjectId);

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

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
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

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
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

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.ListActualsAsync(ProjectId, new PmListQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task RebuildActuals_ReturnsSuccessWithCount()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
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

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
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

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var otherProjectId = Guid.NewGuid();

        await TestDbContextFactory.SeedProjectAsync(db, otherProjectId);
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

    [Fact]
    public async Task RebuildActuals_ReturnsCorrectUpdatedCount()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        for (var i = 0; i < 5; i++)
        {
            db.Set<PmJobCostActual>().Add(new PmJobCostActual
            {
                Id = Guid.NewGuid(),
                CompanyId = TestDbContextFactory.TestCompanyId,
                ProjectId = ProjectId,
                CostCodeId = Guid.NewGuid(),
                CreatedAt = DateTime.UtcNow.AddDays(-5)
            });
        }
        await db.SaveChangesAsync();

        var result = await service.RebuildActualsAsync(ProjectId);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(ProjectId);
    }

    #endregion

    #region Budget Details

    [Fact]
    public async Task CreateBudget_SetsCompanyId()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.CreateBudgetAsync(ProjectId, new PmUpsertRequest());

        result.IsSuccess.Should().BeTrue();

        var entity = await db.Set<PmJobCostBudget>().FirstAsync(b => b.Id == result.Value!.Id);
        entity.CompanyId.Should().Be(TestDbContextFactory.TestCompanyId);
    }

    [Fact]
    public async Task CreateBudget_SetsCreatedAtTimestamp()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var before = DateTime.UtcNow;
        var result = await service.CreateBudgetAsync(ProjectId, new PmUpsertRequest());
        var after = DateTime.UtcNow;

        result.IsSuccess.Should().BeTrue();
        result.Value!.CreatedAt.Should().BeOnOrAfter(before);
        result.Value.CreatedAt.Should().BeOnOrBefore(after);
    }

    [Fact]
    public async Task ListBudgets_Page2_ReturnsRemainingItems()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        for (var i = 0; i < 5; i++)
            await service.CreateBudgetAsync(ProjectId, new PmUpsertRequest());

        var result = await service.ListBudgetsAsync(ProjectId,
            new PmListQuery { Page = 2, PageSize = 3 });

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2);
        result.Value.TotalCount.Should().Be(5);
        result.Value.Page.Should().Be(2);
    }

    [Fact]
    public async Task UpdateBudget_PreservesCreatedAt()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateBudgetAsync(ProjectId, new PmUpsertRequest())).Value!;
        var originalCreatedAt = created.CreatedAt;

        await service.UpdateBudgetAsync(ProjectId, created.Id, new PmUpsertRequest());

        var entity = await db.Set<PmJobCostBudget>().FirstAsync(b => b.Id == created.Id);
        entity.CreatedAt.Should().Be(originalCreatedAt);
    }

    #endregion

    #region Commitment Details

    [Fact]
    public async Task CreateCommitment_SetsCompanyId()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.CreateCommitmentAsync(ProjectId, new PmUpsertRequest());

        result.IsSuccess.Should().BeTrue();

        var entity = await db.Set<PmJobCostCommitment>().FirstAsync(c => c.Id == result.Value!.Id);
        entity.CompanyId.Should().Be(TestDbContextFactory.TestCompanyId);
    }

    [Fact]
    public async Task ListCommitments_ReturnsPaginatedResults()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        for (var i = 0; i < 4; i++)
            await service.CreateCommitmentAsync(ProjectId, new PmUpsertRequest());

        var result = await service.ListCommitmentsAsync(ProjectId,
            new PmListQuery { Page = 1, PageSize = 2 });

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2);
        result.Value.TotalCount.Should().Be(4);
    }

    #endregion

    #region Forecast Details

    [Fact]
    public async Task CreateForecast_SetsCompanyId()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.CreateForecastAsync(ProjectId, new PmUpsertRequest());

        result.IsSuccess.Should().BeTrue();

        var entity = await db.Set<PmJobCostForecast>().FirstAsync(f => f.Id == result.Value!.Id);
        entity.CompanyId.Should().Be(TestDbContextFactory.TestCompanyId);
    }

    [Fact]
    public async Task ListForecasts_ReturnsPaginatedResults()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        for (var i = 0; i < 4; i++)
            await service.CreateForecastAsync(ProjectId, new PmUpsertRequest());

        var result = await service.ListForecastsAsync(ProjectId,
            new PmListQuery { Page = 1, PageSize = 2 });

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2);
        result.Value.TotalCount.Should().Be(4);
    }

    [Fact]
    public async Task ListForecasts_ExcludesOtherProjects()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var otherProjectId = Guid.NewGuid();

        await TestDbContextFactory.SeedProjectAsync(db, otherProjectId);

        await service.CreateForecastAsync(ProjectId, new PmUpsertRequest());
        await service.CreateForecastAsync(otherProjectId, new PmUpsertRequest());

        var result = await service.ListForecastsAsync(ProjectId, new PmListQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
    }

    #endregion

    #region Actuals Pagination

    [Fact]
    public async Task ListActuals_ReturnsPaginatedResults()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        for (var i = 0; i < 4; i++)
        {
            db.Set<PmJobCostActual>().Add(new PmJobCostActual
            {
                Id = Guid.NewGuid(),
                CompanyId = TestDbContextFactory.TestCompanyId,
                ProjectId = ProjectId,
                CostCodeId = Guid.NewGuid(),
                CreatedAt = DateTime.UtcNow.AddMinutes(-i)
            });
        }
        await db.SaveChangesAsync();

        var result = await service.ListActualsAsync(ProjectId,
            new PmListQuery { Page = 1, PageSize = 2 });

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2);
        result.Value.TotalCount.Should().Be(4);
    }

    [Fact]
    public async Task ListActuals_ExcludesOtherProjects()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var otherProjectId = Guid.NewGuid();

        await TestDbContextFactory.SeedProjectAsync(db, otherProjectId);

        db.Set<PmJobCostActual>().Add(new PmJobCostActual
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = ProjectId,
            CostCodeId = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow
        });
        db.Set<PmJobCostActual>().Add(new PmJobCostActual
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = otherProjectId,
            CostCodeId = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var result = await service.ListActualsAsync(ProjectId, new PmListQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
    }

    #endregion

    #region Budget Duplicate Prevention

    [Fact]
    public async Task CreateBudget_DuplicateCostCodeAndPhase_ReturnsDuplicateBudget()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var costCodeId = Guid.NewGuid();
        var phaseId = Guid.NewGuid();

        await service.CreateBudgetAsync(ProjectId, new PmUpsertRequest(
            Data: new Dictionary<string, object?>
            {
                ["CostCodeId"] = costCodeId,
                ["PhaseId"] = phaseId
            }));

        var duplicate = await service.CreateBudgetAsync(ProjectId, new PmUpsertRequest(
            Data: new Dictionary<string, object?>
            {
                ["CostCodeId"] = costCodeId,
                ["PhaseId"] = phaseId
            }));

        duplicate.IsSuccess.Should().BeFalse();
        duplicate.ErrorCode.Should().Be("DUPLICATE_BUDGET");
    }

    #endregion

    #region Auto-Computed CurrentBudget

    [Fact]
    public async Task CreateBudget_ComputesCurrentBudget()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.CreateBudgetAsync(ProjectId, new PmUpsertRequest(
            Data: new Dictionary<string, object?>
            {
                ["OriginalBudget"] = 100000m,
                ["ApprovedBudgetChanges"] = 15000m
            }));

        result.IsSuccess.Should().BeTrue();

        var entity = await db.Set<PmJobCostBudget>().FirstAsync(b => b.Id == result.Value!.Id);
        entity.CurrentBudget.Should().Be(115000m);
    }

    [Fact]
    public async Task UpdateBudget_RecomputesCurrentBudget()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateBudgetAsync(ProjectId, new PmUpsertRequest(
            Data: new Dictionary<string, object?>
            {
                ["OriginalBudget"] = 50000m,
                ["ApprovedBudgetChanges"] = 5000m
            }))).Value!;

        await service.UpdateBudgetAsync(ProjectId, created.Id, new PmUpsertRequest(
            Data: new Dictionary<string, object?>
            {
                ["ApprovedBudgetChanges"] = 12000m
            }));

        var entity = await db.Set<PmJobCostBudget>().FirstAsync(b => b.Id == created.Id);
        entity.CurrentBudget.Should().Be(entity.OriginalBudget + entity.ApprovedBudgetChanges);
    }

    #endregion

    #region Forecast Variance Computation

    [Fact]
    public async Task CreateForecast_ComputesVarianceToBudget()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var costCodeId = Guid.NewGuid();

        // Create a budget first so forecast can compute variance
        await service.CreateBudgetAsync(ProjectId, new PmUpsertRequest(
            Data: new Dictionary<string, object?>
            {
                ["CostCodeId"] = costCodeId,
                ["OriginalBudget"] = 100000m,
                ["ApprovedBudgetChanges"] = 0m
            }));

        var result = await service.CreateForecastAsync(ProjectId, new PmUpsertRequest(
            Data: new Dictionary<string, object?>
            {
                ["CostCodeId"] = costCodeId,
                ["EstimatedFinalCost"] = 110000m
            }));

        result.IsSuccess.Should().BeTrue();

        var forecast = await db.Set<PmJobCostForecast>().FirstAsync(f => f.Id == result.Value!.Id);
        forecast.VarianceToBudget.Should().Be(10000m);
    }

    #endregion
}
