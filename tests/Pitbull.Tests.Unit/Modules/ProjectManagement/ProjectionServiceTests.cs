using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.ProjectManagement.Features;
using Pitbull.ProjectManagement.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.ProjectManagement;

public sealed class ProjectionServiceTests
{
    private static readonly Guid ProjectId = Guid.NewGuid();

    private static ProjectionService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        var companyContext = new CompanyContext
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            CompanyCode = "01",
            CompanyName = "Test Company"
        };
        return new ProjectionService(db, companyContext);
    }

    #region CRUD

    [Fact]
    public async Task CreateMonthlyProjection_ReturnsSuccessWithDto()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.CreateMonthlyProjectionAsync(ProjectId,
            new PmUpsertRequest());

        result.IsSuccess.Should().BeTrue();
        result.Value!.ProjectId.Should().Be(ProjectId);
        result.Value.Id.Should().NotBeEmpty();
    }

    [Fact]
    public async Task GetMonthlyProjection_Existing_ReturnsSuccess()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var created = (await service.CreateMonthlyProjectionAsync(ProjectId,
            new PmUpsertRequest())).Value!;

        var result = await service.GetMonthlyProjectionAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(created.Id);
    }

    [Fact]
    public async Task GetMonthlyProjection_NotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.GetMonthlyProjectionAsync(ProjectId, Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task UpdateMonthlyProjection_SetsUpdatedAt()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var created = (await service.CreateMonthlyProjectionAsync(ProjectId,
            new PmUpsertRequest())).Value!;

        var result = await service.UpdateMonthlyProjectionAsync(ProjectId, created.Id,
            new PmUpsertRequest());

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(created.Id);
        result.Value.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task UpdateMonthlyProjection_NotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.UpdateMonthlyProjectionAsync(ProjectId, Guid.NewGuid(),
            new PmUpsertRequest());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region List and Pagination

    [Fact]
    public async Task ListMonthlyProjections_ReturnsPaginatedResults()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        for (var i = 0; i < 4; i++)
            await service.CreateMonthlyProjectionAsync(ProjectId, new PmUpsertRequest());

        var result = await service.ListMonthlyProjectionsAsync(ProjectId,
            new PmListQuery { Page = 1, PageSize = 2 });

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2);
        result.Value.TotalCount.Should().Be(4);
    }

    [Fact]
    public async Task ListMonthlyProjections_ExcludesOtherProjects()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var otherProjectId = Guid.NewGuid();

        await service.CreateMonthlyProjectionAsync(ProjectId, new PmUpsertRequest());
        await service.CreateMonthlyProjectionAsync(otherProjectId, new PmUpsertRequest());

        var result = await service.ListMonthlyProjectionsAsync(ProjectId, new PmListQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
    }

    #endregion

    #region Submit and Approve

    [Fact]
    public async Task SubmitMonthlyProjection_SetsStatusToSubmitted()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var created = (await service.CreateMonthlyProjectionAsync(ProjectId,
            new PmUpsertRequest())).Value!;

        var result = await service.SubmitMonthlyProjectionAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Success.Should().BeTrue();
        result.Value.Message.Should().Contain("submitted");

        var entity = await db.Set<PmMonthlyProjection>().FirstAsync(p => p.Id == created.Id);
        entity.ProjectionStatus.Should().Be(ProjectionStatus.Submitted);
        entity.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task SubmitMonthlyProjection_NotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.SubmitMonthlyProjectionAsync(ProjectId, Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task ApproveMonthlyProjection_SetsStatusToApproved()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var created = (await service.CreateMonthlyProjectionAsync(ProjectId,
            new PmUpsertRequest())).Value!;
        await service.SubmitMonthlyProjectionAsync(ProjectId, created.Id);

        var result = await service.ApproveMonthlyProjectionAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Success.Should().BeTrue();
        result.Value.Message.Should().Contain("approved");

        var entity = await db.Set<PmMonthlyProjection>().FirstAsync(p => p.Id == created.Id);
        entity.ProjectionStatus.Should().Be(ProjectionStatus.Approved);
    }

    [Fact]
    public async Task ApproveMonthlyProjection_NotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.ApproveMonthlyProjectionAsync(ProjectId, Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region Locked Projection Enforcement

    [Fact]
    public async Task UpdateMonthlyProjection_LockedProjection_ReturnsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var created = (await service.CreateMonthlyProjectionAsync(ProjectId,
            new PmUpsertRequest())).Value!;

        // Manually set to Locked via direct entity manipulation
        var entity = await db.Set<PmMonthlyProjection>().FirstAsync(p => p.Id == created.Id);
        entity.ProjectionStatus = ProjectionStatus.Locked;
        await db.SaveChangesAsync();

        var result = await service.UpdateMonthlyProjectionAsync(ProjectId, created.Id,
            new PmUpsertRequest(Description: "Try edit locked"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    #endregion

    #region Status Transition Enforcement

    [Fact]
    public async Task SubmitMonthlyProjection_NonDraft_ReturnsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var created = (await service.CreateMonthlyProjectionAsync(ProjectId,
            new PmUpsertRequest())).Value!;

        await service.SubmitMonthlyProjectionAsync(ProjectId, created.Id);

        // Try to submit again (Submitted -> should fail)
        var result = await service.SubmitMonthlyProjectionAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task ApproveMonthlyProjection_NotSubmitted_ReturnsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var created = (await service.CreateMonthlyProjectionAsync(ProjectId,
            new PmUpsertRequest())).Value!;

        // Try to approve directly from Draft (skipping Submit)
        var result = await service.ApproveMonthlyProjectionAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    #endregion

    #region Auto-Computed AdjustedContractValue

    [Fact]
    public async Task UpdateMonthlyProjection_ComputesAdjustedContractValue()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var created = (await service.CreateMonthlyProjectionAsync(ProjectId,
            new PmUpsertRequest(Data: new Dictionary<string, object?>
            {
                ["ContractValueOriginal"] = 1000000m,
                ["ApprovedChangeOrders"] = 50000m
            }))).Value!;

        await service.UpdateMonthlyProjectionAsync(ProjectId, created.Id,
            new PmUpsertRequest(Data: new Dictionary<string, object?>
            {
                ["ApprovedChangeOrders"] = 75000m
            }));

        var entity = await db.Set<PmMonthlyProjection>().FirstAsync(p => p.Id == created.Id);
        entity.AdjustedContractValue.Should().Be(entity.ContractValueOriginal + entity.ApprovedChangeOrders);
    }

    [Fact]
    public async Task SubmitMonthlyProjection_ComputesAdjustedContractValue()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var created = (await service.CreateMonthlyProjectionAsync(ProjectId,
            new PmUpsertRequest(Data: new Dictionary<string, object?>
            {
                ["ContractValueOriginal"] = 500000m,
                ["ApprovedChangeOrders"] = 25000m
            }))).Value!;

        await service.SubmitMonthlyProjectionAsync(ProjectId, created.Id);

        var entity = await db.Set<PmMonthlyProjection>().FirstAsync(p => p.Id == created.Id);
        entity.AdjustedContractValue.Should().Be(525000m);
    }

    #endregion
}
