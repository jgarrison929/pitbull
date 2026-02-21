using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.ProjectManagement.Features;
using Pitbull.ProjectManagement.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.ProjectManagement;

public sealed class PmServiceDailyReportTests
{
    private static readonly Guid ProjectId = Guid.NewGuid();

    private static DailyReportService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        var companyContext = new CompanyContext
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            CompanyCode = "01",
            CompanyName = "Test Company"
        };
        return new DailyReportService(db, companyContext);
    }

    [Fact]
    public async Task CreateDailyReport_WithStatus_ParsesEnumAndReturnsDto()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.CreateDailyReportAsync(ProjectId,
            new PmUpsertRequest(Status: "Submitted"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.ProjectId.Should().Be(ProjectId);
        result.Value.Status.Should().Be("Submitted");

        var entity = await db.Set<PmDailyReport>().FirstAsync(x => x.Id == result.Value.Id);
        entity.Status.Should().Be(DailyReportStatus.Submitted);
    }

    [Fact]
    public async Task ApproveDailyReport_SetsApprovedAndUpdatedAt()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateDailyReportAsync(ProjectId, new PmUpsertRequest())).Value!;

        var beforeApprove = DateTime.UtcNow;
        var result = await service.ApproveDailyReportAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Success.Should().BeTrue();

        var entity = await db.Set<PmDailyReport>().FirstAsync(x => x.Id == created.Id);
        entity.Status.Should().Be(DailyReportStatus.Approved);
        entity.UpdatedAt.Should().NotBeNull();
        entity.UpdatedAt!.Value.Should().BeOnOrAfter(beforeApprove);
    }

    [Fact]
    public async Task RollupDailyReport_ChildInDifferentProject_ReturnsNotFound()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var otherProjectId = Guid.NewGuid();

        await TestDbContextFactory.SeedProjectAsync(db, otherProjectId);

        var parent = (await service.CreateDailyReportAsync(ProjectId, new PmUpsertRequest())).Value!;
        var childFromOtherProject = (await service.CreateDailyReportAsync(otherProjectId, new PmUpsertRequest())).Value!;

        var result = await service.RollupDailyReportAsync(ProjectId, parent.Id,
            new PmUpsertRequest(ReferenceId: childFromOtherProject.Id));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task AddPhoto_UsesReferenceIdAsDailyReportId()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var report = (await service.CreateDailyReportAsync(ProjectId, new PmUpsertRequest())).Value!;

        var result = await service.AddPhotoAsync(ProjectId, report.Id, new PmUpsertRequest());

        result.IsSuccess.Should().BeTrue();
        var photo = await db.Set<PmDailyReportPhoto>().FirstAsync(p => p.Id == result.Value!.Id);
        photo.DailyReportId.Should().Be(report.Id);
    }
}

public sealed class PmServiceSubmittalTests
{
    private static readonly Guid ProjectId = Guid.NewGuid();

    private static SubmittalService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        var companyContext = new CompanyContext
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            CompanyCode = "01",
            CompanyName = "Test Company"
        };
        return new SubmittalService(db, companyContext);
    }

    [Fact]
    public async Task CreateSubmittal_WithTitleAndStatus_ReturnsDto()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.CreateSubmittalAsync(ProjectId,
            new PmUpsertRequest(Title: "Shop Drawing A1", Status: "InReview"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.ProjectId.Should().Be(ProjectId);
        result.Value.Title.Should().Be("Shop Drawing A1");
        result.Value.Status.Should().Be("InReview");
    }

    [Fact]
    public async Task UpdateSubmittal_UpdatesTitleAndStatus()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateSubmittalAsync(ProjectId,
            new PmUpsertRequest(Title: "Initial", Status: "Draft"))).Value!;

        var result = await service.UpdateSubmittalAsync(ProjectId, created.Id,
            new PmUpsertRequest(Title: "Revised", Status: "Approved"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Title.Should().Be("Revised");
        result.Value.Status.Should().Be("Approved");
        result.Value.UpdatedAt.Should().NotBeNull();

        var entity = await db.Set<PmSubmittal>().FirstAsync(x => x.Id == created.Id);
        entity.Status.Should().Be(SubmittalStatus.Approved);
    }

    [Fact]
    public async Task ListSubmittals_ExcludesOtherProjects()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var otherProjectId = Guid.NewGuid();

        await TestDbContextFactory.SeedProjectAsync(db, otherProjectId);

        await service.CreateSubmittalAsync(ProjectId, new PmUpsertRequest(Title: "Our Submittal"));
        await service.CreateSubmittalAsync(otherProjectId, new PmUpsertRequest(Title: "Other Submittal"));

        var result = await service.ListSubmittalsAsync(ProjectId, new PmListQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
        result.Value.Items.Single().Title.Should().Be("Our Submittal");
    }

    [Fact]
    public async Task AddWorkflowEvent_AssignsSubmittalIdFromReferenceId()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var submittal = (await service.CreateSubmittalAsync(ProjectId, new PmUpsertRequest())).Value!;

        var result = await service.AddWorkflowEventAsync(ProjectId, submittal.Id,
            new PmUpsertRequest(Data: new Dictionary<string, object?> { ["ToStatus"] = "Approved" }));

        result.IsSuccess.Should().BeTrue();

        var workflow = await db.Set<PmSubmittalWorkflowEvent>().FirstAsync(x => x.Id == result.Value!.Id);
        workflow.SubmittalId.Should().Be(submittal.Id);
        workflow.ToStatus.Should().Be(SubmittalStatus.Approved);
    }

    [Fact]
    public async Task AddAttachment_AssignsSubmittalIdFromReferenceId()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var submittal = (await service.CreateSubmittalAsync(ProjectId, new PmUpsertRequest())).Value!;

        var result = await service.AddAttachmentAsync(ProjectId, submittal.Id,
            new PmUpsertRequest(Data: new Dictionary<string, object?> { ["DocumentId"] = Guid.NewGuid() }));

        result.IsSuccess.Should().BeTrue();

        var attachment = await db.Set<PmSubmittalAttachment>().FirstAsync(x => x.Id == result.Value!.Id);
        attachment.SubmittalId.Should().Be(submittal.Id);
    }

    [Fact]
    public async Task GetSubmittal_NotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.GetSubmittalAsync(ProjectId, Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }
}
