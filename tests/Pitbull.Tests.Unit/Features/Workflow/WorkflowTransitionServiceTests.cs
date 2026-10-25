using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Api.Features.Workflow;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Features.Workflow;

public class WorkflowTransitionServiceTests
{
    private static readonly Guid UserId = Guid.NewGuid();
    private static readonly Guid EntityId = Guid.NewGuid();

    // ── RecordTransitionAsync ───────────────────────────────────

    [Fact]
    public async Task RecordTransition_ValidEntityType_PersistsTransition()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        await service.RecordTransitionAsync(
            "TimeEntry", EntityId, "Draft", "Submitted",
            UserId, "Jane Smith", "Ready for review", CancellationToken.None);

        var transitions = await service.GetTransitionsAsync("TimeEntry", EntityId, CancellationToken.None);
        transitions.Should().HaveCount(1);
        transitions[0].FromStatus.Should().Be("Draft");
        transitions[0].ToStatus.Should().Be("Submitted");
        transitions[0].ChangedByName.Should().Be("Jane Smith");
        transitions[0].Comment.Should().Be("Ready for review");
    }

    [Fact]
    public async Task RecordTransition_InitialStatus_FromStatusIsNull()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        await service.RecordTransitionAsync(
            "ChangeOrder", EntityId, null, "Pending",
            UserId, "PM User", "New change order created", CancellationToken.None);

        var transitions = await service.GetTransitionsAsync("ChangeOrder", EntityId, CancellationToken.None);
        transitions.Should().HaveCount(1);
        transitions[0].FromStatus.Should().BeNull();
        transitions[0].ToStatus.Should().Be("Pending");
    }

    [Fact]
    public async Task RecordTransition_SameStatus_DoesNotRecord()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        await service.RecordTransitionAsync(
            "RFI", EntityId, "Open", "Open",
            UserId, "PM User", null, CancellationToken.None);

        var transitions = await service.GetTransitionsAsync("RFI", EntityId, CancellationToken.None);
        transitions.Should().BeEmpty();
    }

    [Fact]
    public async Task RecordTransition_InvalidEntityType_ThrowsArgumentException()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var act = () => service.RecordTransitionAsync(
            "FakeEntity", EntityId, null, "Active",
            UserId, "Test User", null, CancellationToken.None);

        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*Unknown entity type*");
    }

    [Theory]
    [InlineData("TimeEntry")]
    [InlineData("Submittal")]
    [InlineData("RFI")]
    [InlineData("ChangeOrder")]
    [InlineData("PaymentApplication")]
    [InlineData("VendorInvoice")]
    [InlineData("BillingApplication")]
    public async Task RecordTransition_AllValidEntityTypes_Succeeds(string entityType)
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var act = () => service.RecordTransitionAsync(
            entityType, EntityId, null, "Active",
            UserId, "Test User", null, CancellationToken.None);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task RecordTransition_NullComment_AllowedAndPersisted()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        await service.RecordTransitionAsync(
            "Submittal", EntityId, "Draft", "Submitted",
            UserId, "Architect", null, CancellationToken.None);

        var transitions = await service.GetTransitionsAsync("Submittal", EntityId, CancellationToken.None);
        transitions[0].Comment.Should().BeNull();
    }

    // ── GetTransitionsAsync ─────────────────────────────────────

    [Fact]
    public async Task GetTransitions_MultipleTransitions_ReturnedChronologically()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        await service.RecordTransitionAsync(
            "PaymentApplication", EntityId, null, "Draft",
            UserId, "AP Clerk", "Created", CancellationToken.None);
        await service.RecordTransitionAsync(
            "PaymentApplication", EntityId, "Draft", "Submitted",
            UserId, "AP Clerk", "Submitted for review", CancellationToken.None);
        await service.RecordTransitionAsync(
            "PaymentApplication", EntityId, "Submitted", "Approved",
            UserId, "CFO", "Approved", CancellationToken.None);

        var transitions = await service.GetTransitionsAsync("PaymentApplication", EntityId, CancellationToken.None);

        transitions.Should().HaveCount(3);
        transitions[0].ToStatus.Should().Be("Draft");
        transitions[1].ToStatus.Should().Be("Submitted");
        transitions[2].ToStatus.Should().Be("Approved");
        transitions[0].ChangedAt.Should().BeOnOrBefore(transitions[1].ChangedAt);
        transitions[1].ChangedAt.Should().BeOnOrBefore(transitions[2].ChangedAt);
    }

    [Fact]
    public async Task GetTransitions_DifferentEntities_IsolatedCorrectly()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var entity1 = Guid.NewGuid();
        var entity2 = Guid.NewGuid();

        await service.RecordTransitionAsync(
            "RFI", entity1, null, "Open",
            UserId, "PM", null, CancellationToken.None);
        await service.RecordTransitionAsync(
            "RFI", entity2, null, "Open",
            UserId, "PM", null, CancellationToken.None);
        await service.RecordTransitionAsync(
            "RFI", entity1, "Open", "Answered",
            UserId, "Architect", "See response attached", CancellationToken.None);

        var transitions1 = await service.GetTransitionsAsync("RFI", entity1, CancellationToken.None);
        var transitions2 = await service.GetTransitionsAsync("RFI", entity2, CancellationToken.None);

        transitions1.Should().HaveCount(2);
        transitions2.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetTransitions_NoTransitions_ReturnsEmptyList()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var transitions = await service.GetTransitionsAsync("TimeEntry", Guid.NewGuid(), CancellationToken.None);
        transitions.Should().BeEmpty();
    }

    [Fact]
    public async Task GetTransitions_DifferentEntityTypes_IsolatedCorrectly()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        await service.RecordTransitionAsync(
            "TimeEntry", EntityId, null, "Submitted",
            UserId, "Field Worker", null, CancellationToken.None);
        await service.RecordTransitionAsync(
            "ChangeOrder", EntityId, null, "Pending",
            UserId, "PM", null, CancellationToken.None);

        var timeEntryTransitions = await service.GetTransitionsAsync("TimeEntry", EntityId, CancellationToken.None);
        var changeOrderTransitions = await service.GetTransitionsAsync("ChangeOrder", EntityId, CancellationToken.None);

        timeEntryTransitions.Should().HaveCount(1);
        timeEntryTransitions[0].ToStatus.Should().Be("Submitted");
        changeOrderTransitions.Should().HaveCount(1);
        changeOrderTransitions[0].ToStatus.Should().Be("Pending");
    }

    // ── Helpers ─────────────────────────────────────────────────

    private static WorkflowTransitionService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        var tenantContext = new TenantContext
        {
            TenantId = TestDbContextFactory.TestTenantId,
            TenantName = "Test Tenant"
        };
        var companyContext = new CompanyContext
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            CompanyCode = "01",
            CompanyName = "Test Company"
        };
        return new WorkflowTransitionService(db, tenantContext, companyContext,
            NullLogger<WorkflowTransitionService>.Instance);
    }
}
