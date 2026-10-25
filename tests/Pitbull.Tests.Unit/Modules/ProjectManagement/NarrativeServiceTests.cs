using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.ProjectManagement.Features;
using Pitbull.ProjectManagement.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.ProjectManagement;

public sealed class NarrativeServiceTests
{
    private static readonly Guid ProjectId = Guid.NewGuid();

    private static NarrativeService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        var companyContext = new CompanyContext
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            CompanyCode = "01",
            CompanyName = "Test Company"
        };
        return new NarrativeService(db, companyContext);
    }

    [Fact]
    public async Task CreateNarrative_ReturnsSuccess()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.CreateNarrativeAsync(ProjectId,
            new PmUpsertRequest(Data: new Dictionary<string, object?>
            {
                ["ExecutiveSummary"] = "Project on track"
            }));

        result.IsSuccess.Should().BeTrue();
        result.Value!.ProjectId.Should().Be(ProjectId);
        result.Value.Id.Should().NotBeEmpty();
    }

    [Fact]
    public async Task SubmitNarrative_FromDraft_SetsSubmittedStatus()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateNarrativeAsync(ProjectId,
            new PmUpsertRequest(Data: new Dictionary<string, object?>
            {
                ["ExecutiveSummary"] = "Project summary here"
            }))).Value!;

        var result = await service.SubmitNarrativeAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeTrue();

        var entity = await db.Set<PmProjectNarrative>().FirstAsync(n => n.Id == created.Id);
        entity.Status.Should().Be(NarrativeStatus.Submitted);
    }

    [Fact]
    public async Task ListNarrativeRevisions_ForCorrectNarrative_ReturnsRevisions()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateNarrativeAsync(ProjectId,
            new PmUpsertRequest(Title: "Narrative With Revisions"))).Value!;

        db.Set<PmProjectNarrativeRevision>().Add(new PmProjectNarrativeRevision
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            NarrativeId = created.Id,
            RevisionNumber = 1,
            ContentSnapshotJson = "{}",
            RevisedByUserId = Guid.NewGuid(),
            RevisedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        });
        db.Set<PmProjectNarrativeRevision>().Add(new PmProjectNarrativeRevision
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            NarrativeId = created.Id,
            RevisionNumber = 2,
            ContentSnapshotJson = "{}",
            RevisedByUserId = Guid.NewGuid(),
            RevisedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var result = await service.ListNarrativeRevisionsAsync(ProjectId, created.Id, new PmListQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task UpdateNarrative_PublishedNarrative_ReturnsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateNarrativeAsync(ProjectId,
            new PmUpsertRequest())).Value!;

        // Set to Published via direct entity manipulation
        var entity = await db.Set<PmProjectNarrative>().FirstAsync(n => n.Id == created.Id);
        entity.Status = NarrativeStatus.Published;
        await db.SaveChangesAsync();

        var result = await service.UpdateNarrativeAsync(ProjectId, created.Id,
            new PmUpsertRequest(Description: "Try edit published"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task SubmitNarrative_RequiresDraftStatus()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateNarrativeAsync(ProjectId,
            new PmUpsertRequest(Data: new Dictionary<string, object?>
            {
                ["ExecutiveSummary"] = "Summary text"
            }))).Value!;

        await service.SubmitNarrativeAsync(ProjectId, created.Id);

        // Try to submit again from Submitted status
        var result = await service.SubmitNarrativeAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task SubmitNarrative_RequiresExecutiveSummary()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateNarrativeAsync(ProjectId,
            new PmUpsertRequest())).Value!;

        var result = await service.SubmitNarrativeAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("ExecutiveSummary");
    }

    [Fact]
    public async Task PublishNarrative_RequiresApprovedStatus()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateNarrativeAsync(ProjectId,
            new PmUpsertRequest(Data: new Dictionary<string, object?>
            {
                ["ExecutiveSummary"] = "Summary"
            }))).Value!;

        // Still in Draft status - should fail
        var result = await service.PublishNarrativeAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task PublishNarrative_FromApproved_SetsFinalizedAt()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateNarrativeAsync(ProjectId,
            new PmUpsertRequest(Data: new Dictionary<string, object?>
            {
                ["ExecutiveSummary"] = "Summary"
            }))).Value!;

        // Manually set to Approved for publish
        var entity = await db.Set<PmProjectNarrative>().FirstAsync(n => n.Id == created.Id);
        entity.Status = NarrativeStatus.Approved;
        await db.SaveChangesAsync();

        var beforePublish = DateTime.UtcNow;
        var result = await service.PublishNarrativeAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Message.Should().Contain("published");

        var published = await db.Set<PmProjectNarrative>().FirstAsync(n => n.Id == created.Id);
        published.Status.Should().Be(NarrativeStatus.Published);
        published.FinalizedAt.Should().NotBeNull();
        published.FinalizedAt!.Value.Should().BeOnOrAfter(beforePublish);
    }
}
