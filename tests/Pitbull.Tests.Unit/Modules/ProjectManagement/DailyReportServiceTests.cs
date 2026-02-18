using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.ProjectManagement.Features;
using Pitbull.ProjectManagement.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.ProjectManagement;

public sealed class DailyReportServiceTests
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

    #region CRUD

    [Fact]
    public async Task CreateDailyReport_ReturnsSuccessWithDto()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.CreateDailyReportAsync(ProjectId,
            new PmUpsertRequest(Status: "Draft"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.ProjectId.Should().Be(ProjectId);
        result.Value.Id.Should().NotBeEmpty();
        result.Value.Status.Should().Be("Draft");
    }

    [Fact]
    public async Task GetDailyReport_Existing_ReturnsSuccess()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateDailyReportAsync(ProjectId,
            new PmUpsertRequest())).Value!;

        var result = await service.GetDailyReportAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(created.Id);
    }

    [Fact]
    public async Task GetDailyReport_NotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.GetDailyReportAsync(ProjectId, Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task UpdateDailyReport_SetsUpdatedAt()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateDailyReportAsync(ProjectId,
            new PmUpsertRequest())).Value!;

        var result = await service.UpdateDailyReportAsync(ProjectId, created.Id,
            new PmUpsertRequest(Status: "Submitted"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(created.Id);
        result.Value.Status.Should().Be("Submitted");
        result.Value.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task UpdateDailyReport_NotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.UpdateDailyReportAsync(ProjectId, Guid.NewGuid(),
            new PmUpsertRequest());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task ListDailyReports_ReturnsPaginatedResults()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        for (var i = 0; i < 5; i++)
            await service.CreateDailyReportAsync(ProjectId, new PmUpsertRequest());

        var result = await service.ListDailyReportsAsync(ProjectId,
            new PmListQuery { Page = 1, PageSize = 3 });

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(3);
        result.Value.TotalCount.Should().Be(5);
    }

    [Fact]
    public async Task ListDailyReports_ExcludesOtherProjects()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var otherProjectId = Guid.NewGuid();

        await TestDbContextFactory.SeedProjectAsync(db, otherProjectId);

        await service.CreateDailyReportAsync(ProjectId, new PmUpsertRequest());
        await service.CreateDailyReportAsync(otherProjectId, new PmUpsertRequest());

        var result = await service.ListDailyReportsAsync(ProjectId, new PmListQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
    }

    #endregion

    #region Submit and Approve

    [Fact]
    public async Task SubmitDailyReport_SetsStatusToSubmitted()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateDailyReportAsync(ProjectId,
            new PmUpsertRequest())).Value!;

        var result = await service.SubmitDailyReportAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Success.Should().BeTrue();
        result.Value.Message.Should().Contain("submitted");

        var entity = await db.Set<PmDailyReport>().FirstAsync(r => r.Id == created.Id);
        entity.Status.Should().Be(DailyReportStatus.Submitted);
        entity.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task SubmitDailyReport_NotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.SubmitDailyReportAsync(ProjectId, Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task ApproveDailyReport_SetsStatusToApproved()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateDailyReportAsync(ProjectId,
            new PmUpsertRequest())).Value!;
        await service.SubmitDailyReportAsync(ProjectId, created.Id);

        var result = await service.ApproveDailyReportAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Success.Should().BeTrue();
        result.Value.Message.Should().Contain("approved");

        var entity = await db.Set<PmDailyReport>().FirstAsync(r => r.Id == created.Id);
        entity.Status.Should().Be(DailyReportStatus.Approved);
    }

    [Fact]
    public async Task ApproveDailyReport_NotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.ApproveDailyReportAsync(ProjectId, Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region AddPhoto

    [Fact]
    public async Task AddPhoto_CreatesPhotoLinkedToReport()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var report = (await service.CreateDailyReportAsync(ProjectId,
            new PmUpsertRequest())).Value!;

        var result = await service.AddPhotoAsync(ProjectId, report.Id,
            new PmUpsertRequest());

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().NotBeEmpty();

        // ReferenceId maps to DocumentId (first matching FK in ApplyUpsert's priority list)
        var photo = await db.Set<PmDailyReportPhoto>().FirstAsync();
        photo.DocumentId.Should().Be(report.Id);
    }

    #endregion

    #region Rollup

    [Fact]
    public async Task RollupDailyReport_CreatesRollupBetweenReports()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var parent = (await service.CreateDailyReportAsync(ProjectId,
            new PmUpsertRequest())).Value!;
        var child = (await service.CreateDailyReportAsync(ProjectId,
            new PmUpsertRequest())).Value!;

        var result = await service.RollupDailyReportAsync(ProjectId, parent.Id,
            new PmUpsertRequest(ReferenceId: child.Id));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Success.Should().BeTrue();
        result.Value.Message.Should().Contain("rollup");

        var rollup = await db.Set<PmDailyReportRollup>().FirstAsync();
        rollup.ParentDailyReportId.Should().Be(parent.Id);
        rollup.ChildDailyReportId.Should().Be(child.Id);
    }

    [Fact]
    public async Task RollupDailyReport_MissingReferenceId_ReturnsValidationError()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var parent = (await service.CreateDailyReportAsync(ProjectId,
            new PmUpsertRequest())).Value!;

        var result = await service.RollupDailyReportAsync(ProjectId, parent.Id,
            new PmUpsertRequest());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task RollupDailyReport_ParentNotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var child = (await service.CreateDailyReportAsync(ProjectId,
            new PmUpsertRequest())).Value!;

        var result = await service.RollupDailyReportAsync(ProjectId, Guid.NewGuid(),
            new PmUpsertRequest(ReferenceId: child.Id));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task RollupDailyReport_ChildNotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var parent = (await service.CreateDailyReportAsync(ProjectId,
            new PmUpsertRequest())).Value!;

        var result = await service.RollupDailyReportAsync(ProjectId, parent.Id,
            new PmUpsertRequest(ReferenceId: Guid.NewGuid()));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region CompanyId and Timestamps

    [Fact]
    public async Task CreateDailyReport_SetsCompanyId()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.CreateDailyReportAsync(ProjectId, new PmUpsertRequest());

        result.IsSuccess.Should().BeTrue();

        var entity = await db.Set<PmDailyReport>().FirstAsync(r => r.Id == result.Value!.Id);
        entity.CompanyId.Should().Be(TestDbContextFactory.TestCompanyId);
    }

    [Fact]
    public async Task CreateDailyReport_SetsCreatedAtTimestamp()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var before = DateTime.UtcNow;
        var result = await service.CreateDailyReportAsync(ProjectId, new PmUpsertRequest());
        var after = DateTime.UtcNow;

        result.IsSuccess.Should().BeTrue();
        result.Value!.CreatedAt.Should().BeOnOrAfter(before);
        result.Value.CreatedAt.Should().BeOnOrBefore(after);
    }

    [Fact]
    public async Task UpdateDailyReport_PreservesCreatedAt()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateDailyReportAsync(ProjectId, new PmUpsertRequest())).Value!;
        var originalCreatedAt = created.CreatedAt;

        await service.UpdateDailyReportAsync(ProjectId, created.Id,
            new PmUpsertRequest(Status: "Submitted"));

        var entity = await db.Set<PmDailyReport>().FirstAsync(r => r.Id == created.Id);
        entity.CreatedAt.Should().Be(originalCreatedAt);
    }

    #endregion

    #region Soft Delete

    [Fact]
    public async Task ListDailyReports_ExcludesSoftDeleted()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var toDelete = (await service.CreateDailyReportAsync(ProjectId, new PmUpsertRequest())).Value!;
        await service.CreateDailyReportAsync(ProjectId, new PmUpsertRequest());

        // Soft-delete via direct entity manipulation (no DeleteAsync on this service)
        var entity = await db.Set<PmDailyReport>().FirstAsync(r => r.Id == toDelete.Id);
        entity.IsDeleted = true;
        entity.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var result = await service.ListDailyReportsAsync(ProjectId, new PmListQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
    }

    [Fact]
    public async Task GetDailyReport_SoftDeleted_ReturnsNotFound()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateDailyReportAsync(ProjectId, new PmUpsertRequest())).Value!;

        var entity = await db.Set<PmDailyReport>().FirstAsync(r => r.Id == created.Id);
        entity.IsDeleted = true;
        entity.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var result = await service.GetDailyReportAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region Submit and Approve Timestamps

    [Fact]
    public async Task SubmitDailyReport_SetsUpdatedAtTimestamp()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateDailyReportAsync(ProjectId, new PmUpsertRequest())).Value!;

        var before = DateTime.UtcNow;
        await service.SubmitDailyReportAsync(ProjectId, created.Id);

        var entity = await db.Set<PmDailyReport>().FirstAsync(r => r.Id == created.Id);
        entity.UpdatedAt.Should().NotBeNull();
        entity.UpdatedAt!.Value.Should().BeOnOrAfter(before);
    }

    [Fact]
    public async Task ApproveDailyReport_SetsUpdatedAtTimestamp()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateDailyReportAsync(ProjectId, new PmUpsertRequest())).Value!;
        await service.SubmitDailyReportAsync(ProjectId, created.Id);

        var before = DateTime.UtcNow;
        await service.ApproveDailyReportAsync(ProjectId, created.Id);

        var entity = await db.Set<PmDailyReport>().FirstAsync(r => r.Id == created.Id);
        entity.UpdatedAt.Should().NotBeNull();
        entity.UpdatedAt!.Value.Should().BeOnOrAfter(before);
    }

    #endregion

    #region Pagination Edge Cases

    [Fact]
    public async Task ListDailyReports_Page2_ReturnsRemainingItems()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        for (var i = 0; i < 5; i++)
            await service.CreateDailyReportAsync(ProjectId, new PmUpsertRequest());

        var result = await service.ListDailyReportsAsync(ProjectId,
            new PmListQuery { Page = 2, PageSize = 3 });

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2);
        result.Value.TotalCount.Should().Be(5);
        result.Value.Page.Should().Be(2);
    }

    [Fact]
    public async Task ListDailyReports_EmptyProject_ReturnsEmptyPage()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.ListDailyReportsAsync(ProjectId, new PmListQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(0);
        result.Value.Items.Should().BeEmpty();
    }

    #endregion

    #region Photo Details

    [Fact]
    public async Task AddPhoto_MultiplePhotos_AllLinkedToSameReport()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var report = (await service.CreateDailyReportAsync(ProjectId, new PmUpsertRequest())).Value!;

        await service.AddPhotoAsync(ProjectId, report.Id, new PmUpsertRequest());
        await service.AddPhotoAsync(ProjectId, report.Id, new PmUpsertRequest());
        await service.AddPhotoAsync(ProjectId, report.Id, new PmUpsertRequest());

        var photos = await db.Set<PmDailyReportPhoto>().ToListAsync();
        photos.Should().HaveCount(3);
        photos.Should().AllSatisfy(p => p.DocumentId.Should().Be(report.Id));
    }

    [Fact]
    public async Task AddPhoto_SetsCompanyId()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var report = (await service.CreateDailyReportAsync(ProjectId, new PmUpsertRequest())).Value!;

        await service.AddPhotoAsync(ProjectId, report.Id, new PmUpsertRequest());

        var photo = await db.Set<PmDailyReportPhoto>().FirstAsync();
        photo.CompanyId.Should().Be(TestDbContextFactory.TestCompanyId);
    }

    #endregion

    #region Rollup Details

    [Fact]
    public async Task RollupDailyReport_SetsCompanyIdOnRollup()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var parent = (await service.CreateDailyReportAsync(ProjectId, new PmUpsertRequest())).Value!;
        var child = (await service.CreateDailyReportAsync(ProjectId, new PmUpsertRequest())).Value!;

        await service.RollupDailyReportAsync(ProjectId, parent.Id,
            new PmUpsertRequest(ReferenceId: child.Id));

        var rollup = await db.Set<PmDailyReportRollup>().FirstAsync();
        rollup.CompanyId.Should().Be(TestDbContextFactory.TestCompanyId);
    }

    [Fact]
    public async Task RollupDailyReport_BothNotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.RollupDailyReportAsync(ProjectId, Guid.NewGuid(),
            new PmUpsertRequest(ReferenceId: Guid.NewGuid()));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region New Business Logic Validation

    [Fact]
    public async Task CreateDailyReport_DuplicateDateAndType_ReturnsDuplicateReport()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var reportDate = new DateTime(2026, 2, 15, 0, 0, 0, DateTimeKind.Utc);
        await service.CreateDailyReportAsync(ProjectId, new PmUpsertRequest(
            Data: new Dictionary<string, object?>
            {
                ["ReportDate"] = reportDate,
                ["ReportType"] = "Foreman"
            }));

        var duplicate = await service.CreateDailyReportAsync(ProjectId, new PmUpsertRequest(
            Data: new Dictionary<string, object?>
            {
                ["ReportDate"] = reportDate,
                ["ReportType"] = "Foreman"
            }));

        duplicate.IsSuccess.Should().BeFalse();
        duplicate.ErrorCode.Should().Be("DUPLICATE_REPORT");
    }

    [Fact]
    public async Task UpdateDailyReport_ApprovedReport_ReturnsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateDailyReportAsync(ProjectId, new PmUpsertRequest())).Value!;

        await service.ApproveDailyReportAsync(ProjectId, created.Id);

        var result = await service.UpdateDailyReportAsync(ProjectId, created.Id,
            new PmUpsertRequest(Description: "Try edit approved"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task SubmitDailyReport_NonDraftStatus_ReturnsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateDailyReportAsync(ProjectId, new PmUpsertRequest())).Value!;

        // Submit once (Draft -> Submitted)
        await service.SubmitDailyReportAsync(ProjectId, created.Id);

        // Try to submit again (Submitted -> should fail)
        var result = await service.SubmitDailyReportAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task ApproveDailyReport_AlreadyApproved_ReturnsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateDailyReportAsync(ProjectId, new PmUpsertRequest())).Value!;

        await service.ApproveDailyReportAsync(ProjectId, created.Id);

        var result = await service.ApproveDailyReportAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    #endregion
}
