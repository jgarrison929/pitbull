using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.ProjectManagement.Features;
using Pitbull.ProjectManagement.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.ProjectManagement;

public sealed class ScheduleServiceTests
{
    private static readonly Guid ProjectId = Guid.NewGuid();

    private static ScheduleService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        var companyContext = new CompanyContext
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            CompanyCode = "01",
            CompanyName = "Test Company"
        };
        return new ScheduleService(db, companyContext);
    }

    #region CRUD

    [Fact]
    public async Task CreateSchedule_ReturnsSuccessWithDto()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.CreateScheduleAsync(ProjectId,
            new PmUpsertRequest(Name: "Master Schedule", Status: "Draft"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Name.Should().Be("Master Schedule");
        result.Value.Status.Should().Be("Draft");
        result.Value.ProjectId.Should().Be(ProjectId);
        result.Value.Id.Should().NotBeEmpty();
    }

    [Fact]
    public async Task GetSchedule_Existing_ReturnsSuccess()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var created = (await service.CreateScheduleAsync(ProjectId,
            new PmUpsertRequest(Name: "Test Schedule"))).Value!;

        var result = await service.GetScheduleAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(created.Id);
        result.Value.Name.Should().Be("Test Schedule");
    }

    [Fact]
    public async Task GetSchedule_NotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.GetScheduleAsync(ProjectId, Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task UpdateSchedule_SetsNameAndUpdatedAt()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var created = (await service.CreateScheduleAsync(ProjectId,
            new PmUpsertRequest(Name: "Original"))).Value!;

        var beforeUpdate = DateTime.UtcNow;
        var result = await service.UpdateScheduleAsync(ProjectId, created.Id,
            new PmUpsertRequest(Name: "Renamed"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Name.Should().Be("Renamed");
        result.Value.UpdatedAt.Should().NotBeNull();
        result.Value.UpdatedAt!.Value.Should().BeOnOrAfter(beforeUpdate);
    }

    [Fact]
    public async Task UpdateSchedule_NotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.UpdateScheduleAsync(ProjectId, Guid.NewGuid(),
            new PmUpsertRequest(Name: "Nope"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task DeleteSchedule_SoftDeletes()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var created = (await service.CreateScheduleAsync(ProjectId,
            new PmUpsertRequest(Name: "To Delete"))).Value!;

        var deleteResult = await service.DeleteScheduleAsync(ProjectId, created.Id);
        deleteResult.IsSuccess.Should().BeTrue();

        var getResult = await service.GetScheduleAsync(ProjectId, created.Id);
        getResult.IsSuccess.Should().BeFalse();
        getResult.ErrorCode.Should().Be("NOT_FOUND");

        var raw = await db.Set<PmSchedule>().IgnoreQueryFilters().FirstOrDefaultAsync(s => s.Id == created.Id);
        raw.Should().NotBeNull();
        raw!.IsDeleted.Should().BeTrue();
        raw.DeletedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task DeleteSchedule_NotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.DeleteScheduleAsync(ProjectId, Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region List and Pagination

    [Fact]
    public async Task ListSchedules_ReturnsPaginatedResults()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        for (var i = 0; i < 5; i++)
            await service.CreateScheduleAsync(ProjectId, new PmUpsertRequest(Name: $"Schedule {i}"));

        var result = await service.ListSchedulesAsync(ProjectId,
            new PmListQuery { Page = 1, PageSize = 3 });

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(3);
        result.Value.TotalCount.Should().Be(5);
        result.Value.Page.Should().Be(1);
        result.Value.PageSize.Should().Be(3);
    }

    [Fact]
    public async Task ListSchedules_SearchByName_FiltersResults()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        await service.CreateScheduleAsync(ProjectId, new PmUpsertRequest(Name: "Master Schedule"));
        await service.CreateScheduleAsync(ProjectId, new PmUpsertRequest(Name: "Baseline Schedule"));
        await service.CreateScheduleAsync(ProjectId, new PmUpsertRequest(Name: "Recovery Plan"));

        var result = await service.ListSchedulesAsync(ProjectId,
            new PmListQuery { Search = "schedule" });

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task ListSchedules_ExcludesOtherProjects()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var otherProjectId = Guid.NewGuid();

        await service.CreateScheduleAsync(ProjectId, new PmUpsertRequest(Name: "Our Schedule"));
        await service.CreateScheduleAsync(otherProjectId, new PmUpsertRequest(Name: "Other Schedule"));

        var result = await service.ListSchedulesAsync(ProjectId, new PmListQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
        result.Value.Items.First().Name.Should().Be("Our Schedule");
    }

    [Fact]
    public async Task ListSchedules_ExcludesSoftDeleted()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var created = (await service.CreateScheduleAsync(ProjectId,
            new PmUpsertRequest(Name: "Deleted Schedule"))).Value!;
        await service.DeleteScheduleAsync(ProjectId, created.Id);
        await service.CreateScheduleAsync(ProjectId, new PmUpsertRequest(Name: "Active Schedule"));

        var result = await service.ListSchedulesAsync(ProjectId, new PmListQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
        result.Value.Items.First().Name.Should().Be("Active Schedule");
    }

    #endregion

    #region RecalculateCriticalPath

    [Fact]
    public async Task RecalculateCriticalPath_SetsTimestampAndReturnsAction()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var schedule = (await service.CreateScheduleAsync(ProjectId,
            new PmUpsertRequest(Name: "CPM Schedule"))).Value!;

        var beforeAction = DateTime.UtcNow;
        var result = await service.RecalculateCriticalPathAsync(ProjectId, schedule.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Success.Should().BeTrue();
        result.Value.Message.Should().Contain("Critical path");
        result.Value.Id.Should().Be(schedule.Id);

        var entity = await db.Set<PmSchedule>().FirstAsync(s => s.Id == schedule.Id);
        entity.LastCriticalPathRunAt.Should().NotBeNull();
        entity.LastCriticalPathRunAt!.Value.Should().BeOnOrAfter(beforeAction);
        entity.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task RecalculateCriticalPath_NotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.RecalculateCriticalPathAsync(ProjectId, Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region CreateBaseline

    [Fact]
    public async Task CreateBaseline_CreatesBaselineWithDefaults()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var schedule = (await service.CreateScheduleAsync(ProjectId,
            new PmUpsertRequest(Name: "Baseline Target"))).Value!;

        var result = await service.CreateBaselineAsync(ProjectId, schedule.Id,
            new PmUpsertRequest());

        result.IsSuccess.Should().BeTrue();
        result.Value!.Success.Should().BeTrue();
        result.Value.Id.Should().NotBeNull();

        var baseline = await db.Set<PmScheduleBaseline>().FirstAsync();
        baseline.ScheduleId.Should().Be(schedule.Id);
        baseline.ProjectId.Should().Be(ProjectId);
        baseline.BaselineType.Should().Be(ScheduleBaselineType.Initial);
        baseline.Name.Should().StartWith("Baseline ");
        baseline.CapturedAt.Should().BeOnOrAfter(DateTime.UtcNow.AddSeconds(-5));
    }

    [Fact]
    public async Task CreateBaseline_WithCustomNameAndType_AppliesThem()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var schedule = (await service.CreateScheduleAsync(ProjectId,
            new PmUpsertRequest(Name: "Schedule"))).Value!;

        var result = await service.CreateBaselineAsync(ProjectId, schedule.Id,
            new PmUpsertRequest(Name: "Recovery Baseline", Status: "Recovery"));

        result.IsSuccess.Should().BeTrue();

        var baseline = await db.Set<PmScheduleBaseline>().FirstAsync();
        baseline.Name.Should().Be("Recovery Baseline");
        baseline.BaselineType.Should().Be(ScheduleBaselineType.Recovery);
    }

    [Fact]
    public async Task CreateBaseline_ScheduleNotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.CreateBaselineAsync(ProjectId, Guid.NewGuid(),
            new PmUpsertRequest());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region Dependencies

    [Fact]
    public async Task DeleteDependency_SoftDeletesCorrectEntity()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var schedule = (await service.CreateScheduleAsync(ProjectId,
            new PmUpsertRequest(Name: "Schedule"))).Value!;
        var dependency = (await service.AddDependencyAsync(ProjectId, schedule.Id,
            new PmUpsertRequest(Name: "FS Link"))).Value!;

        var result = await service.DeleteDependencyAsync(ProjectId, schedule.Id, dependency.Id);

        result.IsSuccess.Should().BeTrue();
        var raw = await db.Set<PmScheduleDependency>().IgnoreQueryFilters().FirstAsync(d => d.Id == dependency.Id);
        raw.IsDeleted.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteDependency_WrongSchedule_ReturnsNotFound()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var schedule = (await service.CreateScheduleAsync(ProjectId,
            new PmUpsertRequest(Name: "Schedule A"))).Value!;
        var dependency = (await service.AddDependencyAsync(ProjectId, schedule.Id,
            new PmUpsertRequest(Name: "Link"))).Value!;

        var otherSchedule = (await service.CreateScheduleAsync(ProjectId,
            new PmUpsertRequest(Name: "Schedule B"))).Value!;

        var result = await service.DeleteDependencyAsync(ProjectId, otherSchedule.Id, dependency.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region Status via ApplyUpsert

    [Fact]
    public async Task UpdateSchedule_WithStatus_ParsesEnum()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var created = (await service.CreateScheduleAsync(ProjectId,
            new PmUpsertRequest(Name: "Schedule", Status: "Draft"))).Value!;

        var result = await service.UpdateScheduleAsync(ProjectId, created.Id,
            new PmUpsertRequest(Status: "Active"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("Active");

        var entity = await db.Set<PmSchedule>().FirstAsync(s => s.Id == created.Id);
        entity.Status.Should().Be(ScheduleStatus.Active);
    }

    #endregion

    #region Activities

    [Fact]
    public async Task AddActivity_CreatesActivityLinkedToSchedule()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var schedule = (await service.CreateScheduleAsync(ProjectId,
            new PmUpsertRequest(Name: "Master"))).Value!;

        var result = await service.AddActivityAsync(ProjectId, schedule.Id,
            new PmUpsertRequest(Name: "Pour Foundation"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Name.Should().Be("Pour Foundation");
        result.Value.Id.Should().NotBeEmpty();

        var activity = await db.Set<PmScheduleActivity>().FirstAsync();
        activity.ScheduleId.Should().Be(schedule.Id);
        activity.ProjectId.Should().Be(ProjectId);
        activity.CompanyId.Should().Be(TestDbContextFactory.TestCompanyId);
    }

    [Fact]
    public async Task AddActivity_ScheduleNotFound_ReturnsNotFound()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.AddActivityAsync(ProjectId, Guid.NewGuid(),
            new PmUpsertRequest(Name: "Orphan Activity"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task UpdateActivity_SetsNameAndUpdatedAt()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var schedule = (await service.CreateScheduleAsync(ProjectId,
            new PmUpsertRequest(Name: "Schedule"))).Value!;
        var activity = (await service.AddActivityAsync(ProjectId, schedule.Id,
            new PmUpsertRequest(Name: "Original Activity"))).Value!;

        var beforeUpdate = DateTime.UtcNow;
        var result = await service.UpdateActivityAsync(ProjectId, schedule.Id, activity.Id,
            new PmUpsertRequest(Name: "Renamed Activity"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Name.Should().Be("Renamed Activity");
        result.Value.UpdatedAt.Should().NotBeNull();
        result.Value.UpdatedAt!.Value.Should().BeOnOrAfter(beforeUpdate);
    }

    [Fact]
    public async Task UpdateActivity_NotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var schedule = (await service.CreateScheduleAsync(ProjectId,
            new PmUpsertRequest(Name: "Schedule"))).Value!;

        var result = await service.UpdateActivityAsync(ProjectId, schedule.Id, Guid.NewGuid(),
            new PmUpsertRequest(Name: "Nope"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region Import

    [Fact]
    public async Task ImportSchedule_CreatesImportLogEntry()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.ImportScheduleAsync(ProjectId,
            new PmUpsertRequest(Name: "Import-Jan.csv"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.ProjectId.Should().Be(ProjectId);
        result.Value.Id.Should().NotBeEmpty();

        var log = await db.Set<PmScheduleImportLog>().FirstAsync();
        log.ProjectId.Should().Be(ProjectId);
        log.CompanyId.Should().Be(TestDbContextFactory.TestCompanyId);
    }

    [Fact]
    public async Task ListImports_ReturnsPaginatedResults()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        for (var i = 0; i < 4; i++)
            await service.ImportScheduleAsync(ProjectId, new PmUpsertRequest(Name: $"Import {i}"));

        var result = await service.ListImportsAsync(ProjectId,
            new PmListQuery { Page = 1, PageSize = 2 });

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2);
        result.Value.TotalCount.Should().Be(4);
    }

    [Fact]
    public async Task ListImports_ExcludesOtherProjects()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var otherProjectId = Guid.NewGuid();

        await service.ImportScheduleAsync(ProjectId, new PmUpsertRequest(Name: "Our Import"));
        await service.ImportScheduleAsync(otherProjectId, new PmUpsertRequest(Name: "Other Import"));

        var result = await service.ListImportsAsync(ProjectId, new PmListQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
    }

    #endregion

    #region Baseline SourceVersion

    [Fact]
    public async Task CreateBaseline_WithSourceVersion_StoresIt()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var schedule = (await service.CreateScheduleAsync(ProjectId,
            new PmUpsertRequest(Name: "Schedule"))).Value!;

        var result = await service.CreateBaselineAsync(ProjectId, schedule.Id,
            new PmUpsertRequest(Name: "v2 Baseline", Data: new Dictionary<string, object?>
            {
                { "SourceVersion", "Rev-2.1" }
            }));

        result.IsSuccess.Should().BeTrue();

        var baseline = await db.Set<PmScheduleBaseline>().FirstAsync();
        baseline.SourceVersion.Should().Be("Rev-2.1");
    }

    #endregion

    #region CompanyId and Timestamps

    [Fact]
    public async Task CreateSchedule_SetsCompanyId()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.CreateScheduleAsync(ProjectId,
            new PmUpsertRequest(Name: "Company Test"));

        result.IsSuccess.Should().BeTrue();

        var entity = await db.Set<PmSchedule>().FirstAsync(s => s.Id == result.Value!.Id);
        entity.CompanyId.Should().Be(TestDbContextFactory.TestCompanyId);
    }

    [Fact]
    public async Task CreateSchedule_SetsCreatedAtToUtcNow()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var before = DateTime.UtcNow;
        var result = await service.CreateScheduleAsync(ProjectId,
            new PmUpsertRequest(Name: "Timestamp Test"));
        var after = DateTime.UtcNow;

        result.IsSuccess.Should().BeTrue();
        result.Value!.CreatedAt.Should().BeOnOrAfter(before);
        result.Value.CreatedAt.Should().BeOnOrBefore(after);
    }

    [Fact]
    public async Task ListSchedules_Page2_ReturnsRemainingItems()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        for (var i = 0; i < 5; i++)
            await service.CreateScheduleAsync(ProjectId, new PmUpsertRequest(Name: $"Schedule {i}"));

        var result = await service.ListSchedulesAsync(ProjectId,
            new PmListQuery { Page = 2, PageSize = 3 });

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2);
        result.Value.TotalCount.Should().Be(5);
        result.Value.Page.Should().Be(2);
    }

    [Fact]
    public async Task DeleteSchedule_SetsDeletedAtTimestamp()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var created = (await service.CreateScheduleAsync(ProjectId,
            new PmUpsertRequest(Name: "Timestamp Delete"))).Value!;

        var beforeDelete = DateTime.UtcNow;
        await service.DeleteScheduleAsync(ProjectId, created.Id);

        var raw = await db.Set<PmSchedule>().IgnoreQueryFilters().FirstAsync(s => s.Id == created.Id);
        raw.DeletedAt.Should().NotBeNull();
        raw.DeletedAt!.Value.Should().BeOnOrAfter(beforeDelete);
        raw.UpdatedAt.Should().NotBeNull();
        raw.UpdatedAt!.Value.Should().BeOnOrAfter(beforeDelete);
    }

    #endregion
}
