using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.ProjectManagement.Features;
using Pitbull.ProjectManagement.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.ProjectManagement;

public sealed class PmSubmittalServiceTests
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
    public async Task CreateSubmittal_WithNonDraftStatus_ReturnsInvalidStatusTransition()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.CreateSubmittalAsync(ProjectId,
            new PmUpsertRequest(Title: "Steel Shop Drawings", Status: "InReview"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS_TRANSITION");
    }

    [Fact]
    public async Task CreateSubmittal_WithStatusInData_ReturnsInvalidStatusTransition()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.CreateSubmittalAsync(ProjectId, new PmUpsertRequest(
            Title: "Bypass attempt",
            Data: new Dictionary<string, object?> { ["Status"] = "Approved" }));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS_TRANSITION");
    }

    [Fact]
    public async Task CreateSubmittal_WithTitle_PersistsDraftStatus()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.CreateSubmittalAsync(ProjectId,
            new PmUpsertRequest(
                Title: "Steel Shop Drawings",
                Description: "Rebar placement drawings",
                Data: new Dictionary<string, object?> { ["SpecSectionCode"] = "032000" }));

        result.IsSuccess.Should().BeTrue();
        result.Value!.ProjectId.Should().Be(ProjectId);
        result.Value.Title.Should().Be("Steel Shop Drawings");
        result.Value.Status.Should().Be("Draft");

        var entity = await db.Set<PmSubmittal>().FirstAsync(s => s.Id == result.Value.Id);
        entity.Title.Should().Be("Steel Shop Drawings");
        entity.Description.Should().Be("Rebar placement drawings");
        entity.SpecSectionCode.Should().Be("032000");
        entity.Status.Should().Be(SubmittalStatus.Draft);
    }

    [Fact]
    public async Task UpdateSubmittal_PersistsTopLevelTitleAndDescription()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var created = (await service.CreateSubmittalAsync(ProjectId,
            new PmUpsertRequest(Title: "Initial title"))).Value!;

        var result = await service.UpdateSubmittalAsync(ProjectId, created.Id, new PmUpsertRequest(
            Title: "Revised title",
            Description: "Updated scope notes"));

        result.IsSuccess.Should().BeTrue();

        var entity = await db.Set<PmSubmittal>().FirstAsync(s => s.Id == created.Id);
        entity.Title.Should().Be("Revised title");
        entity.Description.Should().Be("Updated scope notes");
    }

    [Fact]
    public async Task UpdateSubmittal_WithStatusInData_UsesTransitionGraph()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateSubmittalAsync(ProjectId,
            new PmUpsertRequest(Title: "Data status"))).Value!;

        var result = await service.UpdateSubmittalAsync(ProjectId, created.Id, new PmUpsertRequest(
            Data: new Dictionary<string, object?> { ["Status"] = "Submitted" }));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("Submitted");
    }

    [Fact]
    public async Task UpdateSubmittal_UpdatesStatusAndSetsUpdatedAt()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateSubmittalAsync(ProjectId,
            new PmUpsertRequest(Title: "Draft Package"))).Value!;

        // Follow valid transition path: Draft → Submitted → InReview → Approved
        await service.UpdateSubmittalAsync(ProjectId, created.Id, new PmUpsertRequest(Status: "Submitted"));
        await service.UpdateSubmittalAsync(ProjectId, created.Id, new PmUpsertRequest(Status: "InReview"));

        var beforeUpdate = DateTime.UtcNow;
        var result = await service.UpdateSubmittalAsync(ProjectId, created.Id,
            new PmUpsertRequest(Status: "Approved"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("Approved");
        result.Value.UpdatedAt.Should().NotBeNull();
        result.Value.UpdatedAt!.Value.Should().BeOnOrAfter(beforeUpdate);

        var entity = await db.Set<PmSubmittal>().FirstAsync(s => s.Id == created.Id);
        entity.Status.Should().Be(SubmittalStatus.Approved);
    }

    [Fact]
    public async Task AddWorkflowEvent_AssignsSubmittalIdAndParsesToStatus()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var submittal = (await service.CreateSubmittalAsync(ProjectId, new PmUpsertRequest())).Value!;

        var result = await service.AddWorkflowEventAsync(ProjectId, submittal.Id,
            new PmUpsertRequest(Data: new Dictionary<string, object?> { ["ToStatus"] = "Rejected" }));

        result.IsSuccess.Should().BeTrue();

        var workflow = await db.Set<PmSubmittalWorkflowEvent>().FirstAsync(x => x.Id == result.Value!.Id);
        workflow.SubmittalId.Should().Be(submittal.Id);
        workflow.ToStatus.Should().Be(SubmittalStatus.Rejected);
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
    public async Task ListSubmittals_ExcludesOtherProjects()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var otherProjectId = Guid.NewGuid();

        await TestDbContextFactory.SeedProjectAsync(db, otherProjectId);

        await service.CreateSubmittalAsync(ProjectId, new PmUpsertRequest(Title: "Project A"));
        await service.CreateSubmittalAsync(otherProjectId, new PmUpsertRequest(Title: "Project B"));

        var result = await service.ListSubmittalsAsync(ProjectId, new PmListQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
        result.Value.Items.Single().Title.Should().Be("Project A");
    }

    [Fact]
    public async Task CreateSubmittal_AutoIncrementsSubmittalNumber()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var first = (await service.CreateSubmittalAsync(ProjectId, new PmUpsertRequest(Title: "S-001"))).Value!;
        var second = (await service.CreateSubmittalAsync(ProjectId, new PmUpsertRequest(Title: "S-002"))).Value!;

        var entity1 = await db.Set<PmSubmittal>().FirstAsync(s => s.Id == first.Id);
        var entity2 = await db.Set<PmSubmittal>().FirstAsync(s => s.Id == second.Id);

        entity1.SubmittalNumber.Should().Be(1);
        entity2.SubmittalNumber.Should().Be(2);
    }

    [Fact]
    public async Task CreateSubmittal_DefaultsToDraftStatus_WhenNoStatusProvided()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.CreateSubmittalAsync(ProjectId, new PmUpsertRequest(Title: "No Status"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("Draft");

        var entity = await db.Set<PmSubmittal>().FirstAsync(s => s.Id == result.Value.Id);
        entity.Status.Should().Be(SubmittalStatus.Draft);
    }

    [Fact]
    public async Task UpdateSubmittal_ClosedSubmittal_ReturnsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateSubmittalAsync(ProjectId,
            new PmUpsertRequest(Title: "Closed One"))).Value!;
        await service.UpdateSubmittalAsync(ProjectId, created.Id, new PmUpsertRequest(Status: "Submitted"));
        await service.UpdateSubmittalAsync(ProjectId, created.Id, new PmUpsertRequest(Status: "InReview"));
        await service.UpdateSubmittalAsync(ProjectId, created.Id, new PmUpsertRequest(Status: "Approved"));
        await service.UpdateSubmittalAsync(ProjectId, created.Id, new PmUpsertRequest(Status: "Closed"));

        var result = await service.UpdateSubmittalAsync(ProjectId, created.Id,
            new PmUpsertRequest(Title: "Try Edit"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
        result.Error.Should().Contain("closed");
    }

    [Fact]
    public async Task UpdateSubmittal_TransitionToSubmitted_SetsSubmittedDate()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateSubmittalAsync(ProjectId,
            new PmUpsertRequest(Title: "To Submit"))).Value!;

        var beforeSubmit = DateTime.UtcNow;
        await service.UpdateSubmittalAsync(ProjectId, created.Id,
            new PmUpsertRequest(Status: "Submitted"));

        var entity = await db.Set<PmSubmittal>().FirstAsync(s => s.Id == created.Id);
        entity.SubmittedDate.Should().NotBeNull();
        entity.SubmittedDate!.Value.Should().BeOnOrAfter(beforeSubmit);
    }

    [Fact]
    public async Task UpdateSubmittal_TransitionToApproved_SetsReturnedDate()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateSubmittalAsync(ProjectId,
            new PmUpsertRequest(Title: "To Approve"))).Value!;

        // Follow valid transition path: Draft → Submitted → InReview → Approved
        await service.UpdateSubmittalAsync(ProjectId, created.Id, new PmUpsertRequest(Status: "Submitted"));
        await service.UpdateSubmittalAsync(ProjectId, created.Id, new PmUpsertRequest(Status: "InReview"));

        var beforeReturn = DateTime.UtcNow;
        await service.UpdateSubmittalAsync(ProjectId, created.Id,
            new PmUpsertRequest(Status: "Approved"));

        var entity = await db.Set<PmSubmittal>().FirstAsync(s => s.Id == created.Id);
        entity.ReturnedDate.Should().NotBeNull();
        entity.ReturnedDate!.Value.Should().BeOnOrAfter(beforeReturn);
    }

    [Fact]
    public async Task UpdateSubmittal_ReviseAndResubmit_IncrementsRevisionNumber()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateSubmittalAsync(ProjectId,
            new PmUpsertRequest(Title: "Rev Test"))).Value!;
        await service.UpdateSubmittalAsync(ProjectId, created.Id, new PmUpsertRequest(Status: "Submitted"));
        await service.UpdateSubmittalAsync(ProjectId, created.Id, new PmUpsertRequest(Status: "InReview"));

        var entityBefore = await db.Set<PmSubmittal>().FirstAsync(s => s.Id == created.Id);
        var originalRevision = entityBefore.RevisionNumber;

        await service.UpdateSubmittalAsync(ProjectId, created.Id,
            new PmUpsertRequest(Status: "ReviseAndResubmit"));

        var entityAfter = await db.Set<PmSubmittal>().FirstAsync(s => s.Id == created.Id);
        entityAfter.RevisionNumber.Should().Be(originalRevision + 1);
    }

    [Fact]
    public async Task AddWorkflowEvent_PopulatesFromStatusFromCurrentSubmittalStatus()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var submittal = (await service.CreateSubmittalAsync(ProjectId,
            new PmUpsertRequest())).Value!;
        await service.UpdateSubmittalAsync(ProjectId, submittal.Id, new PmUpsertRequest(Status: "Submitted"));
        await service.UpdateSubmittalAsync(ProjectId, submittal.Id, new PmUpsertRequest(Status: "InReview"));

        var result = await service.AddWorkflowEventAsync(ProjectId, submittal.Id,
            new PmUpsertRequest(Data: new Dictionary<string, object?> { ["ToStatus"] = "Approved" }));

        result.IsSuccess.Should().BeTrue();

        var workflow = await db.Set<PmSubmittalWorkflowEvent>().FirstAsync(x => x.Id == result.Value!.Id);
        workflow.FromStatus.Should().Be(SubmittalStatus.InReview);
    }
}

public sealed class PmCommunicationServiceTests
{
    private static readonly Guid ProjectId = Guid.NewGuid();

    private static CommunicationService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        var companyContext = new CompanyContext
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            CompanyCode = "01",
            CompanyName = "Test Company"
        };
        return new CommunicationService(db, companyContext);
    }

    [Fact]
    public async Task CreateCommunication_WithStatus_ParsesEnum()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.CreateCommunicationAsync(ProjectId,
            new PmUpsertRequest(Status: "Closed"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("Closed");

        var entity = await db.Set<PmCommunication>().FirstAsync(x => x.Id == result.Value.Id);
        entity.Status.Should().Be(CommunicationStatus.Closed);
    }

    [Fact]
    public async Task UpdateCommunication_UpdatesStatusAndUpdatedAt()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var created = (await service.CreateCommunicationAsync(ProjectId,
            new PmUpsertRequest(Status: "Open"))).Value!;

        var beforeUpdate = DateTime.UtcNow;
        var result = await service.UpdateCommunicationAsync(ProjectId, created.Id,
            new PmUpsertRequest(Status: "FollowUpRequired"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("FollowUpRequired");
        result.Value.UpdatedAt.Should().NotBeNull();
        result.Value.UpdatedAt!.Value.Should().BeOnOrAfter(beforeUpdate);
    }

    [Fact]
    public async Task AddAttachment_AssignsCommunicationIdFromReferenceId()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var communication = (await service.CreateCommunicationAsync(ProjectId,
            new PmUpsertRequest())).Value!;

        var result = await service.AddAttachmentAsync(ProjectId, communication.Id,
            new PmUpsertRequest(Data: new Dictionary<string, object?> { ["DocumentId"] = Guid.NewGuid() }));

        result.IsSuccess.Should().BeTrue();

        var attachment = await db.Set<PmCommunicationAttachment>().FirstAsync(x => x.Id == result.Value!.Id);
        attachment.CommunicationId.Should().Be(communication.Id);
    }

    [Fact]
    public async Task ListCommunications_ExcludesOtherProjects()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var otherProjectId = Guid.NewGuid();

        await TestDbContextFactory.SeedProjectAsync(db, otherProjectId);

        await service.CreateCommunicationAsync(ProjectId, new PmUpsertRequest(Status: "Open"));
        await service.CreateCommunicationAsync(otherProjectId, new PmUpsertRequest(Status: "Open"));

        var result = await service.ListCommunicationsAsync(ProjectId, new PmListQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
    }
}

public sealed class PmMeetingServiceTests
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

    [Fact]
    public async Task CreateMeeting_WithTitleAndStatus_ReturnsDto()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);

        var result = await service.CreateMeetingAsync(ProjectId,
            new PmUpsertRequest(Title: "Weekly OAC", Status: "Scheduled"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.ProjectId.Should().Be(ProjectId);
        result.Value.Title.Should().Be("Weekly OAC");
        result.Value.Status.Should().Be("Scheduled");
    }

    [Fact]
    public async Task AddAgendaItem_AssignsMeetingIdFromReferenceId()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = (await service.CreateMeetingAsync(ProjectId,
            new PmUpsertRequest(Title: "Kickoff"))).Value!;

        var result = await service.AddAgendaItemAsync(ProjectId, meeting.Id,
            new PmUpsertRequest(Data: new Dictionary<string, object?> { ["Topic"] = "Safety" }));

        result.IsSuccess.Should().BeTrue();

        var item = await db.Set<PmMeetingAgendaItem>().FirstAsync(x => x.Id == result.Value!.Id);
        item.MeetingId.Should().Be(meeting.Id);
        item.Topic.Should().Be("Safety");
    }

    [Fact]
    public async Task AddMinutes_AssignsMeetingIdAndMinuteText()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = (await service.CreateMeetingAsync(ProjectId,
            new PmUpsertRequest(Title: "Coordination"))).Value!;

        var result = await service.AddMinutesAsync(ProjectId, meeting.Id,
            new PmUpsertRequest(Data: new Dictionary<string, object?> { ["MinuteText"] = "Reviewed submittal log." }));

        result.IsSuccess.Should().BeTrue();

        var minute = await db.Set<PmMeetingMinute>().FirstAsync(x => x.Id == result.Value!.Id);
        minute.MeetingId.Should().Be(meeting.Id);
        minute.MinuteText.Should().Be("Reviewed submittal log.");
    }

    [Fact]
    public async Task AddActionItem_ThenUpdateActionItem_ParsesTaskStatus()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = (await service.CreateMeetingAsync(ProjectId,
            new PmUpsertRequest(Title: "Progress Review"))).Value!;
        var assigneeId = Guid.NewGuid();
        var action = (await service.AddActionItemAsync(ProjectId, meeting.Id,
            new PmUpsertRequest(DueDate: DateTime.UtcNow.AddDays(7), Data: new Dictionary<string, object?>
            {
                ["Description"] = "Issue revised plan set.",
                ["AssigneeUserId"] = assigneeId
            }))).Value!;

        var update = await service.UpdateActionItemAsync(ProjectId, meeting.Id, action.Id,
            new PmUpsertRequest(Status: "Complete"));

        update.IsSuccess.Should().BeTrue();
        update.Value!.Status.Should().Be("Complete");

        var entity = await db.Set<PmMeetingActionItem>().FirstAsync(x => x.Id == action.Id);
        entity.Status.Should().Be(Pitbull.ProjectManagement.Domain.TaskStatus.Complete);
    }

    [Fact]
    public async Task ListMyActionItems_ProjectFilter_OnlyReturnsItemsFromMeetingsInProject()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var otherProjectId = Guid.NewGuid();

        await TestDbContextFactory.SeedProjectAsync(db, otherProjectId);
        var currentUserId = Guid.NewGuid();

        var meetingA = (await service.CreateMeetingAsync(ProjectId, new PmUpsertRequest(Title: "A"))).Value!;
        var meetingB = (await service.CreateMeetingAsync(otherProjectId, new PmUpsertRequest(Title: "B"))).Value!;

        await service.AddActionItemAsync(ProjectId, meetingA.Id, new PmUpsertRequest(DueDate: DateTime.UtcNow.AddDays(7), Data: new Dictionary<string, object?>
        {
            ["Description"] = "A1",
            ["AssigneeUserId"] = currentUserId
        }));
        await service.AddActionItemAsync(otherProjectId, meetingB.Id, new PmUpsertRequest(DueDate: DateTime.UtcNow.AddDays(7), Data: new Dictionary<string, object?>
        {
            ["Description"] = "B1",
            ["AssigneeUserId"] = currentUserId
        }));

        var result = await service.ListMyActionItemsAsync(new PmListQuery(ProjectId: ProjectId), currentUserId);

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
    }

    [Fact]
    public async Task UpdateMeeting_CompletedMeeting_ReturnsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = (await service.CreateMeetingAsync(ProjectId,
            new PmUpsertRequest(Title: "Done Meeting", Status: "Scheduled"))).Value!;

        // Transition through to Completed: Scheduled -> InProgress -> Completed
        await service.UpdateMeetingAsync(ProjectId, meeting.Id, new PmUpsertRequest(Status: "InProgress"));
        await service.UpdateMeetingAsync(ProjectId, meeting.Id, new PmUpsertRequest(Status: "Completed"));

        var result = await service.UpdateMeetingAsync(ProjectId, meeting.Id,
            new PmUpsertRequest(Title: "Try Edit"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task UpdateMeeting_CanceledMeeting_ReturnsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = (await service.CreateMeetingAsync(ProjectId,
            new PmUpsertRequest(Title: "Cancel Me", Status: "Scheduled"))).Value!;

        await service.UpdateMeetingAsync(ProjectId, meeting.Id, new PmUpsertRequest(Status: "Canceled"));

        var result = await service.UpdateMeetingAsync(ProjectId, meeting.Id,
            new PmUpsertRequest(Title: "Try Edit"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task UpdateMeeting_InvalidTransition_ReturnsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = (await service.CreateMeetingAsync(ProjectId,
            new PmUpsertRequest(Title: "Meeting", Status: "Scheduled"))).Value!;

        // Scheduled -> Completed is not valid (must go through InProgress)
        var result = await service.UpdateMeetingAsync(ProjectId, meeting.Id,
            new PmUpsertRequest(Status: "Completed"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task UpdateMeeting_TransitionToInProgress_SetsActualStart()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = (await service.CreateMeetingAsync(ProjectId,
            new PmUpsertRequest(Title: "Start Me", Status: "Scheduled"))).Value!;

        var beforeTransition = DateTime.UtcNow;
        await service.UpdateMeetingAsync(ProjectId, meeting.Id, new PmUpsertRequest(Status: "InProgress"));

        var entity = await db.Set<PmMeeting>().FirstAsync(m => m.Id == meeting.Id);
        entity.ActualStart.Should().NotBeNull();
        entity.ActualStart!.Value.Should().BeOnOrAfter(beforeTransition);
    }

    [Fact]
    public async Task UpdateMeeting_TransitionToCompleted_SetsActualEnd()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = (await service.CreateMeetingAsync(ProjectId,
            new PmUpsertRequest(Title: "End Me", Status: "Scheduled"))).Value!;

        await service.UpdateMeetingAsync(ProjectId, meeting.Id, new PmUpsertRequest(Status: "InProgress"));

        var beforeComplete = DateTime.UtcNow;
        await service.UpdateMeetingAsync(ProjectId, meeting.Id, new PmUpsertRequest(Status: "Completed"));

        var entity = await db.Set<PmMeeting>().FirstAsync(m => m.Id == meeting.Id);
        entity.ActualEnd.Should().NotBeNull();
        entity.ActualEnd!.Value.Should().BeOnOrAfter(beforeComplete);
    }

    [Fact]
    public async Task AddAgendaItem_CanceledMeeting_ReturnsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = (await service.CreateMeetingAsync(ProjectId,
            new PmUpsertRequest(Title: "Canceled", Status: "Scheduled"))).Value!;

        await service.UpdateMeetingAsync(ProjectId, meeting.Id, new PmUpsertRequest(Status: "Canceled"));

        var result = await service.AddAgendaItemAsync(ProjectId, meeting.Id,
            new PmUpsertRequest(Data: new Dictionary<string, object?> { ["Topic"] = "Late Topic" }));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task AddMinutes_CanceledMeeting_ReturnsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = (await service.CreateMeetingAsync(ProjectId,
            new PmUpsertRequest(Title: "Canceled", Status: "Scheduled"))).Value!;

        await service.UpdateMeetingAsync(ProjectId, meeting.Id, new PmUpsertRequest(Status: "Canceled"));

        var result = await service.AddMinutesAsync(ProjectId, meeting.Id,
            new PmUpsertRequest(Data: new Dictionary<string, object?> { ["MinuteText"] = "Should fail" }));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task AddActionItem_CanceledMeeting_ReturnsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();

        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = CreateService(db);
        var meeting = (await service.CreateMeetingAsync(ProjectId,
            new PmUpsertRequest(Title: "Canceled", Status: "Scheduled"))).Value!;

        await service.UpdateMeetingAsync(ProjectId, meeting.Id, new PmUpsertRequest(Status: "Canceled"));

        var result = await service.AddActionItemAsync(ProjectId, meeting.Id,
            new PmUpsertRequest(Data: new Dictionary<string, object?> { ["Description"] = "Should fail" }));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }
}
