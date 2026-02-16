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
    public async Task CreateSubmittal_WithTitleAndStatus_PersistsAndReturnsDto()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.CreateSubmittalAsync(ProjectId,
            new PmUpsertRequest(Title: "Steel Shop Drawings", Status: "InReview"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.ProjectId.Should().Be(ProjectId);
        result.Value.Title.Should().Be("Steel Shop Drawings");
        result.Value.Status.Should().Be("InReview");
    }

    [Fact]
    public async Task UpdateSubmittal_UpdatesStatusAndSetsUpdatedAt()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var created = (await service.CreateSubmittalAsync(ProjectId,
            new PmUpsertRequest(Title: "Draft Package", Status: "Draft"))).Value!;

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
        var service = CreateService(db);
        var otherProjectId = Guid.NewGuid();

        await service.CreateSubmittalAsync(ProjectId, new PmUpsertRequest(Title: "Project A"));
        await service.CreateSubmittalAsync(otherProjectId, new PmUpsertRequest(Title: "Project B"));

        var result = await service.ListSubmittalsAsync(ProjectId, new PmListQuery());

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
        result.Value.Items.Single().Title.Should().Be("Project A");
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
        var service = CreateService(db);
        var otherProjectId = Guid.NewGuid();

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
        var service = CreateService(db);
        var meeting = (await service.CreateMeetingAsync(ProjectId,
            new PmUpsertRequest(Title: "Progress Review"))).Value!;
        var action = (await service.AddActionItemAsync(ProjectId, meeting.Id,
            new PmUpsertRequest(Data: new Dictionary<string, object?> { ["Description"] = "Issue revised plan set." }))).Value!;

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
        var service = CreateService(db);
        var otherProjectId = Guid.NewGuid();

        var meetingA = (await service.CreateMeetingAsync(ProjectId, new PmUpsertRequest(Title: "A"))).Value!;
        var meetingB = (await service.CreateMeetingAsync(otherProjectId, new PmUpsertRequest(Title: "B"))).Value!;

        await service.AddActionItemAsync(ProjectId, meetingA.Id, new PmUpsertRequest(Data: new Dictionary<string, object?> { ["Description"] = "A1" }));
        await service.AddActionItemAsync(otherProjectId, meetingB.Id, new PmUpsertRequest(Data: new Dictionary<string, object?> { ["Description"] = "B1" }));

        var result = await service.ListMyActionItemsAsync(new PmListQuery(ProjectId: ProjectId));

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
    }
}
