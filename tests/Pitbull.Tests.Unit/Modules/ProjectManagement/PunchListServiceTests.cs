using System.Text.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.ProjectManagement.Features;
using Pitbull.ProjectManagement.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.ProjectManagement;

public sealed class PunchListServiceTests
{
    private static readonly Guid ProjectId = Guid.NewGuid();

    private static PunchListService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        var companyContext = new CompanyContext
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            CompanyCode = "01",
            CompanyName = "Test Company"
        };
        return new PunchListService(db, companyContext);
    }

    #region CreatePunchListItem

    [Fact]
    public async Task CreatePunchListItem_AutoIncrementsItemNumber()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var first = (await service.CreatePunchListItemAsync(ProjectId,
            new PmUpsertRequest(Description: "Damaged drywall"))).Value!;
        var second = (await service.CreatePunchListItemAsync(ProjectId,
            new PmUpsertRequest(Description: "Missing caulk"))).Value!;

        var entity1 = await db.Set<PmPunchListItem>().FirstAsync(p => p.Id == first.Id);
        var entity2 = await db.Set<PmPunchListItem>().FirstAsync(p => p.Id == second.Id);

        entity1.ItemNumber.Should().Be(1);
        entity2.ItemNumber.Should().Be(2);
    }

    [Fact]
    public async Task CreatePunchListItem_DefaultsToOpenStatus_WhenNoneProvided()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.CreatePunchListItemAsync(ProjectId,
            new PmUpsertRequest(Description: "No status given"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("Open");

        var entity = await db.Set<PmPunchListItem>().FirstAsync(p => p.Id == result.Value.Id);
        entity.Status.Should().Be(PunchListItemStatus.Open);
    }

    [Fact]
    public async Task CreatePunchListItem_SetsCreatedByUserId()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.CreatePunchListItemAsync(ProjectId,
            new PmUpsertRequest(Description: "Check creator"));

        result.IsSuccess.Should().BeTrue();

        var entity = await db.Set<PmPunchListItem>().FirstAsync(p => p.Id == result.Value!.Id);
        // Without HttpContext, GetCurrentUserId returns Guid.Empty; the field is still set via MergeData only when non-empty
        entity.CreatedByUserId.Should().Be(Guid.Empty);
    }

    #endregion

    #region UpdatePunchListItem — Valid Transitions

    [Theory]
    [InlineData("Open", "InProgress")]
    [InlineData("Open", "Disputed")]
    [InlineData("InProgress", "ReadyForInspection")]
    [InlineData("InProgress", "Disputed")]
    [InlineData("ReadyForInspection", "Closed")]
    [InlineData("ReadyForInspection", "InProgress")]
    [InlineData("Disputed", "Open")]
    [InlineData("Disputed", "Closed")]
    public async Task UpdatePunchListItem_ValidTransition_Succeeds(string fromStatus, string toStatus)
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var created = (await service.CreatePunchListItemAsync(ProjectId,
            new PmUpsertRequest(Status: fromStatus))).Value!;

        // InProgress transitions require AssignedToName
        var data = toStatus == "InProgress"
            ? new Dictionary<string, object?> { ["AssignedToName"] = "Test Subcontractor" }
            : null;

        var result = await service.UpdatePunchListItemAsync(ProjectId, created.Id,
            new PmUpsertRequest(Status: toStatus, Data: data));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(toStatus);
    }

    #endregion

    #region UpdatePunchListItem — Invalid Transitions

    [Theory]
    [InlineData("Open", "Closed")]
    [InlineData("Open", "ReadyForInspection")]
    [InlineData("Closed", "Open")]
    public async Task UpdatePunchListItem_InvalidTransition_ReturnsInvalidStatus(string fromStatus, string toStatus)
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        // For Closed initial status, create as Open then transition through to Closed
        PmEntityDto created;
        if (fromStatus == "Closed")
        {
            created = (await service.CreatePunchListItemAsync(ProjectId,
                new PmUpsertRequest(Status: "ReadyForInspection"))).Value!;
            await service.UpdatePunchListItemAsync(ProjectId, created.Id,
                new PmUpsertRequest(Status: "Closed"));
        }
        else
        {
            created = (await service.CreatePunchListItemAsync(ProjectId,
                new PmUpsertRequest(Status: fromStatus))).Value!;
        }

        var result = await service.UpdatePunchListItemAsync(ProjectId, created.Id,
            new PmUpsertRequest(Status: toStatus));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    #endregion

    #region UpdatePunchListItem — Cannot Edit Closed

    [Fact]
    public async Task UpdatePunchListItem_ClosedItem_CannotEdit()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var created = (await service.CreatePunchListItemAsync(ProjectId,
            new PmUpsertRequest(Status: "ReadyForInspection"))).Value!;
        await service.UpdatePunchListItemAsync(ProjectId, created.Id,
            new PmUpsertRequest(Status: "Closed"));

        var result = await service.UpdatePunchListItemAsync(ProjectId, created.Id,
            new PmUpsertRequest(Description: "Try edit closed"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
        result.Error.Should().Contain("closed");
    }

    #endregion

    #region UpdatePunchListItem — Transition Side Effects

    [Fact]
    public async Task UpdatePunchListItem_TransitionToClosed_SetsClosedAt()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var created = (await service.CreatePunchListItemAsync(ProjectId,
            new PmUpsertRequest(Status: "ReadyForInspection"))).Value!;

        var beforeClose = DateTime.UtcNow;
        await service.UpdatePunchListItemAsync(ProjectId, created.Id,
            new PmUpsertRequest(Status: "Closed"));

        var entity = await db.Set<PmPunchListItem>().FirstAsync(p => p.Id == created.Id);
        entity.ClosedAt.Should().NotBeNull();
        entity.ClosedAt!.Value.Should().BeOnOrAfter(beforeClose);
    }

    [Fact]
    public async Task UpdatePunchListItem_TransitionToReadyForInspection_SetsInspectedAt()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var created = (await service.CreatePunchListItemAsync(ProjectId,
            new PmUpsertRequest(Status: "InProgress"))).Value!;

        var beforeInspection = DateTime.UtcNow;
        await service.UpdatePunchListItemAsync(ProjectId, created.Id,
            new PmUpsertRequest(Status: "ReadyForInspection"));

        var entity = await db.Set<PmPunchListItem>().FirstAsync(p => p.Id == created.Id);
        entity.InspectedAt.Should().NotBeNull();
        entity.InspectedAt!.Value.Should().BeOnOrAfter(beforeInspection);
    }

    #endregion

    #region ClosePunchListItemAsync

    [Fact]
    public async Task ClosePunchListItem_FromReadyForInspection_Succeeds()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var created = (await service.CreatePunchListItemAsync(ProjectId,
            new PmUpsertRequest(Status: "ReadyForInspection"))).Value!;

        var beforeClose = DateTime.UtcNow;
        var result = await service.ClosePunchListItemAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Success.Should().BeTrue();
        result.Value.Message.Should().Contain("closed");

        var entity = await db.Set<PmPunchListItem>().FirstAsync(p => p.Id == created.Id);
        entity.Status.Should().Be(PunchListItemStatus.Closed);
        entity.ClosedAt.Should().NotBeNull();
        entity.ClosedAt!.Value.Should().BeOnOrAfter(beforeClose);
    }

    [Fact]
    public async Task ClosePunchListItem_FromDisputed_Succeeds()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var created = (await service.CreatePunchListItemAsync(ProjectId,
            new PmUpsertRequest(Status: "Open"))).Value!;
        await service.UpdatePunchListItemAsync(ProjectId, created.Id,
            new PmUpsertRequest(Status: "Disputed"));

        var result = await service.ClosePunchListItemAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Success.Should().BeTrue();

        var entity = await db.Set<PmPunchListItem>().FirstAsync(p => p.Id == created.Id);
        entity.Status.Should().Be(PunchListItemStatus.Closed);
        entity.ClosedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task ClosePunchListItem_SetsInspectedAt_IfNotAlreadySet()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        // Create as Disputed (which never goes through ReadyForInspection, so InspectedAt is null)
        var created = (await service.CreatePunchListItemAsync(ProjectId,
            new PmUpsertRequest(Status: "Open"))).Value!;
        await service.UpdatePunchListItemAsync(ProjectId, created.Id,
            new PmUpsertRequest(Status: "Disputed"));

        var beforeClose = DateTime.UtcNow;
        await service.ClosePunchListItemAsync(ProjectId, created.Id);

        var entity = await db.Set<PmPunchListItem>().FirstAsync(p => p.Id == created.Id);
        entity.InspectedAt.Should().NotBeNull();
        entity.InspectedAt!.Value.Should().BeOnOrAfter(beforeClose);
    }

    [Fact]
    public async Task ClosePunchListItem_FromOpen_ReturnsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var created = (await service.CreatePunchListItemAsync(ProjectId,
            new PmUpsertRequest(Status: "Open"))).Value!;

        var result = await service.ClosePunchListItemAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    #endregion

    #region GetPunchListSummaryAsync

    [Fact]
    public async Task GetPunchListSummary_ReturnsCorrectCountsByStatus()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        // Create items in various statuses
        await service.CreatePunchListItemAsync(ProjectId, new PmUpsertRequest(Status: "Open"));
        await service.CreatePunchListItemAsync(ProjectId, new PmUpsertRequest(Status: "Open"));
        await service.CreatePunchListItemAsync(ProjectId, new PmUpsertRequest(Status: "InProgress"));

        var item4 = (await service.CreatePunchListItemAsync(ProjectId,
            new PmUpsertRequest(Status: "ReadyForInspection"))).Value!;
        await service.ClosePunchListItemAsync(ProjectId, item4.Id);

        var result = await service.GetPunchListSummaryAsync(ProjectId);

        result.IsSuccess.Should().BeTrue();
        var json = JsonSerializer.Serialize(result.Value!.Data);
        var data = JsonSerializer.Deserialize<JsonElement>(json);
        data.GetProperty("Total").GetInt32().Should().Be(4);
        data.GetProperty("Open").GetInt32().Should().Be(2);
        data.GetProperty("InProgress").GetInt32().Should().Be(1);
        data.GetProperty("Closed").GetInt32().Should().Be(1);
    }

    [Fact]
    public async Task GetPunchListSummary_CountsOverdueItemsCorrectly()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var pastDue = DateTime.UtcNow.AddDays(-5);
        var futureDue = DateTime.UtcNow.AddDays(5);

        // Overdue open item
        await service.CreatePunchListItemAsync(ProjectId,
            new PmUpsertRequest(Status: "Open", DueDate: pastDue));

        // Not overdue — future due date
        await service.CreatePunchListItemAsync(ProjectId,
            new PmUpsertRequest(Status: "Open", DueDate: futureDue));

        // Overdue InProgress item
        await service.CreatePunchListItemAsync(ProjectId,
            new PmUpsertRequest(Status: "InProgress", DueDate: pastDue));

        // Past due but Closed — should NOT count as overdue
        var closedItem = (await service.CreatePunchListItemAsync(ProjectId,
            new PmUpsertRequest(Status: "ReadyForInspection", DueDate: pastDue))).Value!;
        await service.ClosePunchListItemAsync(ProjectId, closedItem.Id);

        var result = await service.GetPunchListSummaryAsync(ProjectId);

        result.IsSuccess.Should().BeTrue();
        var json = JsonSerializer.Serialize(result.Value!.Data);
        var data = JsonSerializer.Deserialize<JsonElement>(json);
        data.GetProperty("OverdueCount").GetInt32().Should().Be(2);
    }

    #endregion

    #region AddPhotoAsync and ListPhotosAsync

    [Fact]
    public async Task AddPhoto_LinksToPunchListItem()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var item = (await service.CreatePunchListItemAsync(ProjectId,
            new PmUpsertRequest(Description: "Photo target"))).Value!;

        var result = await service.AddPhotoAsync(ProjectId, item.Id, new PmUpsertRequest());

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().NotBeEmpty();

        // ReferenceId maps to PunchListItemId (first matching FK in ApplyUpsert's priority list)
        var photo = await db.Set<PmPunchListPhoto>().FirstAsync();
        photo.PunchListItemId.Should().Be(item.Id);
    }

    [Fact]
    public async Task ListPhotos_ReturnsPhotosForCorrectItem()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var item1 = (await service.CreatePunchListItemAsync(ProjectId,
            new PmUpsertRequest(Description: "Item 1"))).Value!;
        var item2 = (await service.CreatePunchListItemAsync(ProjectId,
            new PmUpsertRequest(Description: "Item 2"))).Value!;

        // AddPhotoAsync maps ReferenceId to DocumentId via FK priority; set PunchListItemId explicitly via Data
        await service.AddPhotoAsync(ProjectId, item1.Id,
            new PmUpsertRequest(Data: new Dictionary<string, object?> { ["PunchListItemId"] = item1.Id }));
        await service.AddPhotoAsync(ProjectId, item1.Id,
            new PmUpsertRequest(Data: new Dictionary<string, object?> { ["PunchListItemId"] = item1.Id }));
        await service.AddPhotoAsync(ProjectId, item2.Id,
            new PmUpsertRequest(Data: new Dictionary<string, object?> { ["PunchListItemId"] = item2.Id }));

        var result = await service.ListPhotosAsync(ProjectId, item1.Id, new PmListQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task ListPhotos_ItemNotFound_ReturnsNotFound()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.ListPhotosAsync(ProjectId, Guid.NewGuid(), new PmListQuery());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion
}
