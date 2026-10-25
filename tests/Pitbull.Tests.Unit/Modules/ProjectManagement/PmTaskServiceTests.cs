using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.ProjectManagement.Features;
using Pitbull.ProjectManagement.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.ProjectManagement;

public sealed class PmTaskServiceTests
{
    private static readonly Guid ProjectId = Guid.NewGuid();

    private static TaskService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        var companyContext = new CompanyContext
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            CompanyCode = "01",
            CompanyName = "Test Company"
        };
        return new TaskService(db, companyContext);
    }

    #region CRUD

    [Fact]
    public async Task CreateTask_ReturnsSuccessWithTitle()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.CreateTaskAsync(ProjectId,
            new PmUpsertRequest(Title: "Review RFI-042"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Title.Should().Be("Review RFI-042");
        result.Value.Id.Should().NotBeEmpty();
    }

    [Fact]
    public async Task GetTask_Existing_ReturnsSuccess()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateTaskAsync(ProjectId,
            new PmUpsertRequest(Title: "Task A"))).Value!;

        var result = await service.GetTaskAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(created.Id);
        result.Value.Title.Should().Be("Task A");
    }

    [Fact]
    public async Task GetTask_NotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.GetTaskAsync(ProjectId, Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task UpdateTask_SetsTitleAndUpdatedAt()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateTaskAsync(ProjectId,
            new PmUpsertRequest(Title: "Original"))).Value!;

        var result = await service.UpdateTaskAsync(ProjectId, created.Id,
            new PmUpsertRequest(Title: "Renamed Task"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Title.Should().Be("Renamed Task");
        result.Value.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task UpdateTask_NotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.UpdateTaskAsync(ProjectId, Guid.NewGuid(),
            new PmUpsertRequest(Title: "Nope"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task DeleteTask_SoftDeletes()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateTaskAsync(ProjectId,
            new PmUpsertRequest(Title: "To Delete"))).Value!;

        var deleteResult = await service.DeleteTaskAsync(ProjectId, created.Id);
        deleteResult.IsSuccess.Should().BeTrue();

        var getResult = await service.GetTaskAsync(ProjectId, created.Id);
        getResult.IsSuccess.Should().BeFalse();
        getResult.ErrorCode.Should().Be("NOT_FOUND");

        var raw = await db.Set<PmTask>().IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == created.Id);
        raw.Should().NotBeNull();
        raw!.IsDeleted.Should().BeTrue();
        raw.DeletedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task DeleteTask_NotFound_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.DeleteTaskAsync(ProjectId, Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task UpdateTask_WithStatus_ParsesEnum()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateTaskAsync(ProjectId,
            new PmUpsertRequest(Title: "Task"))).Value!;

        var result = await service.UpdateTaskAsync(ProjectId, created.Id,
            new PmUpsertRequest(Status: "InProgress"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("InProgress");

        var entity = await db.Set<PmTask>().FirstAsync(t => t.Id == created.Id);
        entity.Status.Should().Be(Pitbull.ProjectManagement.Domain.TaskStatus.InProgress);
    }

    [Fact]
    public async Task UpdateTask_WithDescription_SetsField()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateTaskAsync(ProjectId,
            new PmUpsertRequest(Title: "Task"))).Value!;

        await service.UpdateTaskAsync(ProjectId, created.Id,
            new PmUpsertRequest(Description: "Detailed notes here"));

        var entity = await db.Set<PmTask>().FirstAsync(t => t.Id == created.Id);
        entity.Description.Should().Be("Detailed notes here");
    }

    [Fact]
    public async Task UpdateTask_WithDueDate_SetsField()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateTaskAsync(ProjectId,
            new PmUpsertRequest(Title: "Task"))).Value!;

        var dueDate = new DateTime(2026, 3, 15, 0, 0, 0, DateTimeKind.Utc);
        await service.UpdateTaskAsync(ProjectId, created.Id,
            new PmUpsertRequest(DueDate: dueDate));

        var entity = await db.Set<PmTask>().FirstAsync(t => t.Id == created.Id);
        entity.DueDate.Should().Be(dueDate);
    }

    #endregion

    #region List and Pagination

    [Fact]
    public async Task ListTasks_ReturnsPaginatedResults()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        for (var i = 0; i < 5; i++)
            await service.CreateTaskAsync(ProjectId, new PmUpsertRequest(Title: $"Task {i}"));

        var result = await service.ListTasksAsync(ProjectId,
            new PmListQuery { Page = 1, PageSize = 3 });

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(3);
        result.Value.TotalCount.Should().Be(5);
    }

    [Fact]
    public async Task ListTasks_ExcludesOtherProjects()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var otherProjectId = Guid.NewGuid();

        await TestDbContextFactory.SeedProjectAsync(db, otherProjectId);

        await service.CreateTaskAsync(ProjectId, new PmUpsertRequest(Title: "Our Task"));
        await service.CreateTaskAsync(otherProjectId, new PmUpsertRequest(Title: "Other Task"));

        var result = await service.ListTasksAsync(ProjectId, new PmListQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
        result.Value.Items.First().Title.Should().Be("Our Task");
    }

    [Fact]
    public async Task ListMyTasks_FiltersByAssignedUserAcrossProjects()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var otherProjectId = Guid.NewGuid();

        await TestDbContextFactory.SeedProjectAsync(db, otherProjectId);
        var currentUserId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();

        await service.CreateTaskAsync(ProjectId, new PmUpsertRequest(
            Title: "Task A",
            Data: new Dictionary<string, object?> { ["AssignedToUserId"] = currentUserId }));
        await service.CreateTaskAsync(otherProjectId, new PmUpsertRequest(
            Title: "Task B",
            Data: new Dictionary<string, object?> { ["AssignedToUserId"] = currentUserId }));
        await service.CreateTaskAsync(otherProjectId, new PmUpsertRequest(
            Title: "Task C",
            Data: new Dictionary<string, object?> { ["AssignedToUserId"] = otherUserId }));

        var result = await service.ListMyTasksAsync(new PmListQuery(), currentUserId);

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task ListMyTasks_WithProjectFilter_ReturnsOnlyThatProject()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var otherProjectId = Guid.NewGuid();

        await TestDbContextFactory.SeedProjectAsync(db, otherProjectId);
        var currentUserId = Guid.NewGuid();

        await service.CreateTaskAsync(ProjectId, new PmUpsertRequest(
            Title: "Task A",
            Data: new Dictionary<string, object?> { ["AssignedToUserId"] = currentUserId }));
        await service.CreateTaskAsync(otherProjectId, new PmUpsertRequest(
            Title: "Task B",
            Data: new Dictionary<string, object?> { ["AssignedToUserId"] = currentUserId }));

        var result = await service.ListMyTasksAsync(new PmListQuery(ProjectId: ProjectId), currentUserId);

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
        result.Value.Items.First().Title.Should().Be("Task A");
    }

    #endregion

    #region AddTaskComment

    [Fact]
    public async Task AddTaskComment_CreatesCommentLinkedToTask()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var task = (await service.CreateTaskAsync(ProjectId,
            new PmUpsertRequest(Title: "Task"))).Value!;

        var result = await service.AddTaskCommentAsync(ProjectId, task.Id,
            new PmUpsertRequest());

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().NotBeEmpty();

        var comment = await db.Set<PmTaskComment>().FirstAsync();
        comment.TaskId.Should().Be(task.Id);
    }

    #endregion
}
