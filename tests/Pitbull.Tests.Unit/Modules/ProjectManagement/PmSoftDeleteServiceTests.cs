using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.ProjectManagement.Features;
using Pitbull.ProjectManagement.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.ProjectManagement;

/// <summary>
/// Soft-delete coverage for PM surfaces that previously had UI delete buttons without API support.
/// </summary>
public sealed class PmSoftDeleteServiceTests
{
    private static readonly Guid ProjectId = Guid.NewGuid();

    private static CompanyContext Company() => new()
    {
        CompanyId = TestDbContextFactory.TestCompanyId,
        CompanyCode = "01",
        CompanyName = "Test Company"
    };

    [Fact]
    public async Task DeleteCommunication_SoftDeletes()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = new CommunicationService(db, Company());
        var created = (await service.CreateCommunicationAsync(ProjectId, new PmUpsertRequest(Name: "Letter"))).Value!;

        var result = await service.DeleteCommunicationAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeTrue();
        (await service.GetCommunicationAsync(ProjectId, created.Id)).IsSuccess.Should().BeFalse();
        var raw = await db.Set<PmCommunication>().IgnoreQueryFilters().FirstAsync(c => c.Id == created.Id);
        raw.IsDeleted.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteMeeting_Scheduled_SoftDeletes()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = new MeetingService(db, Company());
        var created = (await service.CreateMeetingAsync(ProjectId, new PmUpsertRequest(Name: "OAC"))).Value!;

        var result = await service.DeleteMeetingAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeTrue();
        (await service.GetMeetingAsync(ProjectId, created.Id)).IsSuccess.Should().BeFalse();
        var raw = await db.Set<PmMeeting>().IgnoreQueryFilters().FirstAsync(m => m.Id == created.Id);
        raw.IsDeleted.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteMeeting_Completed_ReturnsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = new MeetingService(db, Company());
        var created = (await service.CreateMeetingAsync(ProjectId, new PmUpsertRequest(Name: "OAC"))).Value!;

        var entity = await db.Set<PmMeeting>().FirstAsync(m => m.Id == created.Id);
        entity.Status = MeetingStatus.Completed;
        await db.SaveChangesAsync();

        var result = await service.DeleteMeetingAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task DeleteNarrative_Draft_SoftDeletes()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = new NarrativeService(db, Company());
        var created = (await service.CreateNarrativeAsync(ProjectId, new PmUpsertRequest(Name: "Monthly"))).Value!;

        var result = await service.DeleteNarrativeAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeTrue();
        (await service.GetNarrativeAsync(ProjectId, created.Id)).IsSuccess.Should().BeFalse();
        var raw = await db.Set<PmProjectNarrative>().IgnoreQueryFilters().FirstAsync(n => n.Id == created.Id);
        raw.IsDeleted.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteNarrative_Published_ReturnsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = new NarrativeService(db, Company());
        var created = (await service.CreateNarrativeAsync(ProjectId, new PmUpsertRequest(Name: "Monthly"))).Value!;

        var entity = await db.Set<PmProjectNarrative>().FirstAsync(n => n.Id == created.Id);
        entity.Status = NarrativeStatus.Published;
        await db.SaveChangesAsync();

        var result = await service.DeleteNarrativeAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task DeleteMonthlyProjection_Draft_SoftDeletes()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = new ProjectionService(db, Company());
        var created = (await service.CreateMonthlyProjectionAsync(ProjectId, new PmUpsertRequest())).Value!;

        var result = await service.DeleteMonthlyProjectionAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeTrue();
        (await service.GetMonthlyProjectionAsync(ProjectId, created.Id)).IsSuccess.Should().BeFalse();
        var raw = await db.Set<PmMonthlyProjection>().IgnoreQueryFilters().FirstAsync(p => p.Id == created.Id);
        raw.IsDeleted.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteMonthlyProjection_Submitted_ReturnsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = new ProjectionService(db, Company());
        var created = (await service.CreateMonthlyProjectionAsync(ProjectId, new PmUpsertRequest())).Value!;

        var entity = await db.Set<PmMonthlyProjection>().FirstAsync(p => p.Id == created.Id);
        entity.ProjectionStatus = ProjectionStatus.Submitted;
        await db.SaveChangesAsync();

        var result = await service.DeleteMonthlyProjectionAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task DeleteSubmittal_Draft_SoftDeletes()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = new SubmittalService(db, Company());
        var created = (await service.CreateSubmittalAsync(ProjectId, new PmUpsertRequest(Title: "Shop drawings"))).Value!;

        var result = await service.DeleteSubmittalAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeTrue();
        (await service.GetSubmittalAsync(ProjectId, created.Id)).IsSuccess.Should().BeFalse();
        var raw = await db.Set<PmSubmittal>().IgnoreQueryFilters().FirstAsync(s => s.Id == created.Id);
        raw.IsDeleted.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteSubmittal_Approved_ReturnsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = new SubmittalService(db, Company());
        var created = (await service.CreateSubmittalAsync(ProjectId, new PmUpsertRequest(Title: "Shop drawings"))).Value!;

        var entity = await db.Set<PmSubmittal>().FirstAsync(s => s.Id == created.Id);
        entity.Status = SubmittalStatus.Approved;
        await db.SaveChangesAsync();

        var result = await service.DeleteSubmittalAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task DeletePlanSet_SoftDeletes()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = new PlansSpecsService(db, Company());
        var created = (await service.CreatePlanSetAsync(ProjectId, new PmUpsertRequest(Name: "Architectural"))).Value!;

        var result = await service.DeletePlanSetAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeTrue();
        (await service.GetPlanSetAsync(ProjectId, created.Id)).IsSuccess.Should().BeFalse();
        var raw = await db.Set<PmPlanSet>().IgnoreQueryFilters().FirstAsync(p => p.Id == created.Id);
        raw.IsDeleted.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteSpecSection_SoftDeletes()
    {
        using var db = TestDbContextFactory.Create();
        await TestDbContextFactory.SeedProjectAsync(db, ProjectId);
        var service = new PlansSpecsService(db, Company());
        var created = (await service.CreateSpecSectionAsync(ProjectId, new PmUpsertRequest(Name: "03 30 00"))).Value!;

        var result = await service.DeleteSpecSectionAsync(ProjectId, created.Id);

        result.IsSuccess.Should().BeTrue();
        var list = await service.ListSpecSectionsAsync(ProjectId, new PmListQuery());
        list.Value!.TotalCount.Should().Be(0);
        var raw = await db.Set<PmSpecSection>().IgnoreQueryFilters().FirstAsync(s => s.Id == created.Id);
        raw.IsDeleted.Should().BeTrue();
    }
}
