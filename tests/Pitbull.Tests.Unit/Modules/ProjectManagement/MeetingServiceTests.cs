using System.Text.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.ProjectManagement.Features;
using Pitbull.ProjectManagement.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.ProjectManagement;

public sealed class MeetingServiceTests
{
    private static readonly Guid ProjectId = Guid.NewGuid();

    private static MeetingService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        var companyContext = new CompanyContext
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            CompanyCode = "01",
            CompanyName = "Test Company"
        };
        return new MeetingService(db, companyContext);
    }

    private static async Task<PmMeeting> SeedMeeting(
        Pitbull.Core.Data.PitbullDbContext db,
        MeetingStatus status = MeetingStatus.Scheduled)
    {
        var meeting = new PmMeeting
        {
            Id = Guid.NewGuid(),
            ProjectId = ProjectId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            Title = "OAC Meeting #1",
            Status = status,
            MeetingType = MeetingType.Oac,
            ScheduledStart = DateTime.UtcNow.AddDays(1),
            ScheduledEnd = DateTime.UtcNow.AddDays(1).AddHours(1),
            Location = "Conference Room A",
            CreatedAt = DateTime.UtcNow
        };
        db.Set<PmMeeting>().Add(meeting);
        await db.SaveChangesAsync();
        return meeting;
    }

    #region CreateMeeting

    [Fact]
    public async Task CreateMeeting_ReturnsSuccess()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.CreateMeetingAsync(ProjectId,
            new PmUpsertRequest(Title: "Weekly Sync", Data: new Dictionary<string, object?>
            {
                ["Location"] = "Site Trailer",
                ["MeetingType"] = "Oac"
            }));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Title.Should().Be("Weekly Sync");
    }

    #endregion

    #region UpdateMeeting — Status Transitions

    [Fact]
    public async Task UpdateMeeting_Scheduled_To_InProgress_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = await SeedMeeting(db, MeetingStatus.Scheduled);

        var result = await service.UpdateMeetingAsync(ProjectId, meeting.Id,
            new PmUpsertRequest(Status: "InProgress"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("InProgress");

        var entity = await db.Set<PmMeeting>().FirstAsync(m => m.Id == meeting.Id);
        entity.ActualStart.Should().NotBeNull();
    }

    [Fact]
    public async Task UpdateMeeting_Scheduled_To_Canceled_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = await SeedMeeting(db, MeetingStatus.Scheduled);

        var result = await service.UpdateMeetingAsync(ProjectId, meeting.Id,
            new PmUpsertRequest(Status: "Canceled"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("Canceled");
    }

    [Fact]
    public async Task UpdateMeeting_InProgress_To_Completed_SetsActualEnd()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = await SeedMeeting(db, MeetingStatus.InProgress);

        var result = await service.UpdateMeetingAsync(ProjectId, meeting.Id,
            new PmUpsertRequest(Status: "Completed"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("Completed");

        var entity = await db.Set<PmMeeting>().FirstAsync(m => m.Id == meeting.Id);
        entity.ActualEnd.Should().NotBeNull();
    }

    [Fact]
    public async Task UpdateMeeting_InProgress_To_Canceled_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = await SeedMeeting(db, MeetingStatus.InProgress);

        var result = await service.UpdateMeetingAsync(ProjectId, meeting.Id,
            new PmUpsertRequest(Status: "Canceled"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("Canceled");
    }

    [Theory]
    [InlineData("Scheduled", "Completed")]
    [InlineData("Completed", "Scheduled")]
    [InlineData("Completed", "InProgress")]
    [InlineData("Canceled", "Scheduled")]
    [InlineData("Canceled", "InProgress")]
    public async Task UpdateMeeting_InvalidTransition_ReturnsError(string currentStatus, string newStatus)
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var status = Enum.Parse<MeetingStatus>(currentStatus);
        var meeting = await SeedMeeting(db, status);

        var result = await service.UpdateMeetingAsync(ProjectId, meeting.Id,
            new PmUpsertRequest(Status: newStatus));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task UpdateMeeting_CompletedMeeting_RejectsEdit()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = await SeedMeeting(db, MeetingStatus.Completed);

        var result = await service.UpdateMeetingAsync(ProjectId, meeting.Id,
            new PmUpsertRequest(Title: "Attempt to edit completed"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task UpdateMeeting_CanceledMeeting_RejectsEdit()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = await SeedMeeting(db, MeetingStatus.Canceled);

        var result = await service.UpdateMeetingAsync(ProjectId, meeting.Id,
            new PmUpsertRequest(Title: "Attempt to edit canceled"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task UpdateMeeting_NotFound_ReturnsNotFound()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.UpdateMeetingAsync(ProjectId, Guid.NewGuid(),
            new PmUpsertRequest(Title: "Ghost meeting"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region AddAgendaItem — Canceled Meeting Guard

    [Fact]
    public async Task AddAgendaItem_ActiveMeeting_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = await SeedMeeting(db, MeetingStatus.Scheduled);

        var result = await service.AddAgendaItemAsync(ProjectId, meeting.Id,
            new PmUpsertRequest(Title: "Review safety plan"));

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task AddAgendaItem_CanceledMeeting_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = await SeedMeeting(db, MeetingStatus.Canceled);

        var result = await service.AddAgendaItemAsync(ProjectId, meeting.Id,
            new PmUpsertRequest(Title: "Late agenda item"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task AddAgendaItem_MeetingNotFound_ReturnsNotFound()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.AddAgendaItemAsync(ProjectId, Guid.NewGuid(),
            new PmUpsertRequest(Title: "Orphan item"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region AddMinutes — Canceled Meeting Guard

    [Fact]
    public async Task AddMinutes_InProgressMeeting_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = await SeedMeeting(db, MeetingStatus.InProgress);

        var result = await service.AddMinutesAsync(ProjectId, meeting.Id,
            new PmUpsertRequest(Description: "Discussed RFI #42 response timeline"));

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task AddMinutes_CanceledMeeting_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = await SeedMeeting(db, MeetingStatus.Canceled);

        var result = await service.AddMinutesAsync(ProjectId, meeting.Id,
            new PmUpsertRequest(Description: "Ghost minutes"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task AddMinutes_MeetingNotFound_ReturnsNotFound()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.AddMinutesAsync(ProjectId, Guid.NewGuid(),
            new PmUpsertRequest(Description: "Orphan minutes"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region AddActionItem — Canceled Meeting Guard

    [Fact]
    public async Task AddActionItem_ScheduledMeeting_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = await SeedMeeting(db, MeetingStatus.Scheduled);

        var assigneeId = Guid.NewGuid();
        var result = await service.AddActionItemAsync(ProjectId, meeting.Id,
            new PmUpsertRequest(Description: "Submit revised shop drawings",
                DueDate: DateTime.UtcNow.AddDays(7),
                Data: new Dictionary<string, object?>
                {
                    ["AssigneeUserId"] = assigneeId.ToString()
                }));

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task AddActionItem_CanceledMeeting_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = await SeedMeeting(db, MeetingStatus.Canceled);

        var result = await service.AddActionItemAsync(ProjectId, meeting.Id,
            new PmUpsertRequest(Description: "Late action item"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task AddActionItem_MeetingNotFound_ReturnsNotFound()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.AddActionItemAsync(ProjectId, Guid.NewGuid(),
            new PmUpsertRequest(Description: "Orphan action"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region ListMyActionItems

    [Fact]
    public async Task ListMyActionItems_FiltersToAssignedUser()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = await SeedMeeting(db, MeetingStatus.InProgress);

        var userId1 = Guid.NewGuid();
        var userId2 = Guid.NewGuid();

        db.Set<PmMeetingActionItem>().AddRange(
            new PmMeetingActionItem
            {
                Id = Guid.NewGuid(),
                CompanyId = TestDbContextFactory.TestCompanyId,
                MeetingId = meeting.Id,
                Description = "My action",
                AssigneeUserId = userId1,
                DueDate = DateTime.UtcNow.AddDays(7),
                Status = Pitbull.ProjectManagement.Domain.TaskStatus.Open,
                CreatedAt = DateTime.UtcNow
            },
            new PmMeetingActionItem
            {
                Id = Guid.NewGuid(),
                CompanyId = TestDbContextFactory.TestCompanyId,
                MeetingId = meeting.Id,
                Description = "Someone else's action",
                AssigneeUserId = userId2,
                DueDate = DateTime.UtcNow.AddDays(7),
                Status = Pitbull.ProjectManagement.Domain.TaskStatus.Open,
                CreatedAt = DateTime.UtcNow
            });
        await db.SaveChangesAsync();

        var result = await service.ListMyActionItemsAsync(
            new PmListQuery(), userId1);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(1);
    }

    [Fact]
    public async Task ListMyActionItems_WithProjectFilter_NarrowsResults()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);

        var otherProjectId = Guid.NewGuid();
        await TestDbContextFactory.SeedProjectAsync(db, otherProjectId);

        var service = CreateService(db);
        var meeting1 = await SeedMeeting(db, MeetingStatus.InProgress);

        var meeting2 = new PmMeeting
        {
            Id = Guid.NewGuid(),
            ProjectId = otherProjectId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            Title = "Other project meeting",
            Status = MeetingStatus.InProgress,
            MeetingType = MeetingType.Oac,
            ScheduledStart = DateTime.UtcNow.AddDays(1),
            CreatedAt = DateTime.UtcNow
        };
        db.Set<PmMeeting>().Add(meeting2);

        var userId = Guid.NewGuid();
        db.Set<PmMeetingActionItem>().AddRange(
            new PmMeetingActionItem
            {
                Id = Guid.NewGuid(),
                CompanyId = TestDbContextFactory.TestCompanyId,
                MeetingId = meeting1.Id,
                Description = "Project A action",
                AssigneeUserId = userId,
                Status = Pitbull.ProjectManagement.Domain.TaskStatus.Open,
                CreatedAt = DateTime.UtcNow
            },
            new PmMeetingActionItem
            {
                Id = Guid.NewGuid(),
                CompanyId = TestDbContextFactory.TestCompanyId,
                MeetingId = meeting2.Id,
                Description = "Project B action",
                AssigneeUserId = userId,
                Status = Pitbull.ProjectManagement.Domain.TaskStatus.Open,
                CreatedAt = DateTime.UtcNow
            });
        await db.SaveChangesAsync();

        var result = await service.ListMyActionItemsAsync(
            new PmListQuery(ProjectId: ProjectId), userId);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(1);
    }

    [Fact]
    public async Task ListMyActionItems_NoItems_ReturnsEmpty()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.ListMyActionItemsAsync(
            new PmListQuery(), Guid.NewGuid());

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().BeEmpty();
        result.Value.TotalCount.Should().Be(0);
    }

    #endregion

    #region MeetingSeries

    [Fact]
    public async Task CreateMeetingSeries_ReturnsSuccess()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.CreateMeetingSeriesAsync(ProjectId,
            new PmUpsertRequest(Title: "Weekly OAC", Data: new Dictionary<string, object?>
            {
                ["MeetingType"] = "Oac"
            }));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Title.Should().Be("Weekly OAC");
    }

    [Fact]
    public async Task ListMeetingSeries_ReturnsPagedResults()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        for (int i = 0; i < 3; i++)
        {
            db.Set<PmMeetingSeries>().Add(new PmMeetingSeries
            {
                Id = Guid.NewGuid(),
                ProjectId = ProjectId,
                CompanyId = TestDbContextFactory.TestCompanyId,
                Title = $"Series {i}",
                MeetingType = MeetingType.Oac,
                StartDate = DateTime.UtcNow,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
        }
        await db.SaveChangesAsync();

        var result = await service.ListMeetingSeriesAsync(ProjectId,
            new PmListQuery { PageSize = 2 });

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(2);
        result.Value.TotalCount.Should().Be(3);
    }

    #endregion

    #region UpdateActionItem

    [Fact]
    public async Task UpdateActionItem_ChangesFields()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = await SeedMeeting(db, MeetingStatus.InProgress);

        var actionItem = new PmMeetingActionItem
        {
            Id = Guid.NewGuid(),
            CompanyId = TestDbContextFactory.TestCompanyId,
            MeetingId = meeting.Id,
            Description = "Original description",
            AssigneeUserId = Guid.NewGuid(),
            Status = Pitbull.ProjectManagement.Domain.TaskStatus.Open,
            CreatedAt = DateTime.UtcNow
        };
        db.Set<PmMeetingActionItem>().Add(actionItem);
        await db.SaveChangesAsync();

        var result = await service.UpdateActionItemAsync(ProjectId, meeting.Id, actionItem.Id,
            new PmUpsertRequest(Description: "Updated description"));

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task UpdateActionItem_NotFound_ReturnsNotFound()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = await SeedMeeting(db, MeetingStatus.InProgress);

        var result = await service.UpdateActionItemAsync(ProjectId, meeting.Id, Guid.NewGuid(),
            new PmUpsertRequest(Description: "Ghost item"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region Edge Cases

    [Fact]
    public async Task UpdateMeeting_NonExistentProject_ReturnsNotFound()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.UpdateMeetingAsync(Guid.NewGuid(), Guid.NewGuid(),
            new PmUpsertRequest(Title: "No project meeting"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task UpdateMeeting_ScheduledToInProgress_SetsActualStartTimestamp()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = await SeedMeeting(db, MeetingStatus.Scheduled);

        var beforeUpdate = DateTime.UtcNow;
        var result = await service.UpdateMeetingAsync(ProjectId, meeting.Id,
            new PmUpsertRequest(Status: "InProgress"));

        result.IsSuccess.Should().BeTrue();
        var entity = await db.Set<PmMeeting>().FirstAsync(m => m.Id == meeting.Id);
        entity.ActualStart.Should().BeOnOrAfter(beforeUpdate);
    }

    [Fact]
    public async Task AddMinutes_CompletedMeeting_StillAllowed()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = await SeedMeeting(db, MeetingStatus.Completed);

        // AddMinutes only checks for Canceled status — completed meetings allow adding minutes
        // (common in construction: minutes are written after the meeting)
        var result = await service.AddMinutesAsync(ProjectId, meeting.Id,
            new PmUpsertRequest(Description: "Post-meeting notes"));

        result.IsSuccess.Should().BeTrue();
    }

    #endregion
}
