using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.ProjectManagement.Features;
using Pitbull.ProjectManagement.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.ProjectManagement;

public sealed class ProgressServiceTests
{
    private static readonly Guid ProjectId = Guid.NewGuid();

    private static ProgressService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        var companyContext = new CompanyContext
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            CompanyCode = "01",
            CompanyName = "Test Company"
        };
        return new ProgressService(db, companyContext);
    }

    #region CRUD

    [Fact]
    public async Task CreateProgressEntry_ReturnsSuccessWithDto()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.CreateProgressEntryAsync(ProjectId,
            new PmUpsertRequest());

        result.IsSuccess.Should().BeTrue();
        result.Value!.ProjectId.Should().Be(ProjectId);
        result.Value.Id.Should().NotBeEmpty();
    }

    [Fact]
    public async Task GetProgressEntry_Existing_ReturnsSuccess()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var created = (await service.CreateProgressEntryAsync(ProjectId,
            new PmUpsertRequest())).Value!;

        var result = await service.GetProgressEntryAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(created.Id);
    }

    [Fact]
    public async Task GetProgressEntry_NotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.GetProgressEntryAsync(ProjectId, Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task UpdateProgressEntry_SetsUpdatedAt()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var created = (await service.CreateProgressEntryAsync(ProjectId,
            new PmUpsertRequest())).Value!;

        var result = await service.UpdateProgressEntryAsync(ProjectId, created.Id,
            new PmUpsertRequest(Status: "Submitted"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("Submitted");
        result.Value.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task UpdateProgressEntry_NotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.UpdateProgressEntryAsync(ProjectId, Guid.NewGuid(),
            new PmUpsertRequest());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region List and Pagination

    [Fact]
    public async Task ListProgressEntries_ReturnsPaginatedResults()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        for (var i = 0; i < 4; i++)
            await service.CreateProgressEntryAsync(ProjectId, new PmUpsertRequest());

        var result = await service.ListProgressEntriesAsync(ProjectId,
            new PmListQuery { Page = 1, PageSize = 2 });

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2);
        result.Value.TotalCount.Should().Be(4);
    }

    [Fact]
    public async Task ListProgressEntries_ExcludesOtherProjects()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var otherProjectId = Guid.NewGuid();

        await service.CreateProgressEntryAsync(ProjectId, new PmUpsertRequest());
        await service.CreateProgressEntryAsync(otherProjectId, new PmUpsertRequest());

        var result = await service.ListProgressEntriesAsync(ProjectId, new PmListQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
    }

    #endregion

    #region Approve

    [Fact]
    public async Task ApproveProgressEntry_SetsStatusToApproved()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var created = (await service.CreateProgressEntryAsync(ProjectId,
            new PmUpsertRequest())).Value!;

        var result = await service.ApproveProgressEntryAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Success.Should().BeTrue();
        result.Value.Message.Should().Contain("approved");

        var entity = await db.Set<PmProgressEntry>().FirstAsync(p => p.Id == created.Id);
        entity.Status.Should().Be(ProgressEntryStatus.Approved);
        entity.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task ApproveProgressEntry_NotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.ApproveProgressEntryAsync(ProjectId, Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region LinkTimeEntry

    [Fact]
    public async Task LinkTimeEntry_CreatesLink()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var entry = (await service.CreateProgressEntryAsync(ProjectId,
            new PmUpsertRequest())).Value!;
        var timeEntryId = Guid.NewGuid();

        var result = await service.LinkTimeEntryAsync(ProjectId, entry.Id,
            new PmUpsertRequest(ReferenceId: timeEntryId));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Success.Should().BeTrue();
        result.Value.Message.Should().Contain("linked");

        var link = await db.Set<PmProgressTimeEntryLink>().FirstAsync();
        link.ProgressEntryId.Should().Be(entry.Id);
        link.TimeEntryId.Should().Be(timeEntryId);
    }

    [Fact]
    public async Task LinkTimeEntry_MissingReferenceId_ReturnsValidationError()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var entry = (await service.CreateProgressEntryAsync(ProjectId,
            new PmUpsertRequest())).Value!;

        var result = await service.LinkTimeEntryAsync(ProjectId, entry.Id,
            new PmUpsertRequest());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task LinkTimeEntry_ProgressEntryNotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.LinkTimeEntryAsync(ProjectId, Guid.NewGuid(),
            new PmUpsertRequest(ReferenceId: Guid.NewGuid()));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region ListEarnedValue and SCurve

    [Fact]
    public async Task ListEarnedValueSnapshots_ReturnsEmpty_WhenNoneExist()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.ListEarnedValueSnapshotsAsync(ProjectId, new PmListQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task ListSCurve_ReturnsEmpty_WhenNoneExist()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.ListSCurveAsync(ProjectId, new PmListQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(0);
    }

    #endregion

    #region Block Editing Approved Entries

    [Fact]
    public async Task UpdateProgressEntry_ApprovedEntry_ReturnsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var created = (await service.CreateProgressEntryAsync(ProjectId,
            new PmUpsertRequest())).Value!;

        await service.ApproveProgressEntryAsync(ProjectId, created.Id);

        var result = await service.UpdateProgressEntryAsync(ProjectId, created.Id,
            new PmUpsertRequest(Description: "Try edit approved"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    #endregion

    #region Approve Status Enforcement

    [Fact]
    public async Task ApproveProgressEntry_AlreadyApproved_ReturnsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var created = (await service.CreateProgressEntryAsync(ProjectId,
            new PmUpsertRequest())).Value!;

        await service.ApproveProgressEntryAsync(ProjectId, created.Id);

        var result = await service.ApproveProgressEntryAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task ApproveProgressEntry_FromSubmitted_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var created = (await service.CreateProgressEntryAsync(ProjectId,
            new PmUpsertRequest(Status: "Submitted"))).Value!;

        var result = await service.ApproveProgressEntryAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeTrue();

        var entity = await db.Set<PmProgressEntry>().FirstAsync(p => p.Id == created.Id);
        entity.Status.Should().Be(ProgressEntryStatus.Approved);
    }

    #endregion

    #region Duplicate Time Entry Link Prevention

    [Fact]
    public async Task LinkTimeEntry_DuplicateLink_ReturnsDuplicateLink()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var entry = (await service.CreateProgressEntryAsync(ProjectId,
            new PmUpsertRequest())).Value!;
        var timeEntryId = Guid.NewGuid();

        await service.LinkTimeEntryAsync(ProjectId, entry.Id,
            new PmUpsertRequest(ReferenceId: timeEntryId));

        var duplicate = await service.LinkTimeEntryAsync(ProjectId, entry.Id,
            new PmUpsertRequest(ReferenceId: timeEntryId));

        duplicate.IsSuccess.Should().BeFalse();
        duplicate.ErrorCode.Should().Be("DUPLICATE_LINK");
    }

    #endregion
}
