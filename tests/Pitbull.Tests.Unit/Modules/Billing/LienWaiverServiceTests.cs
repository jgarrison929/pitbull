using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Billing.Features.LienWaivers;
using Pitbull.Billing.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.Billing;

public sealed class LienWaiverServiceTests
{
    private static LienWaiverService CreateService(PitbullDbContext db) =>
        new(db, NullLogger<LienWaiverService>.Instance);

    [Fact]
    public async Task CreateLienWaiverAsync_NonPositiveAmount_ReturnsValidationError()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        LienWaiverService service = CreateService(db);

        var result = await service.CreateLienWaiverAsync(new CreateLienWaiverCommand(
            ProjectId: Guid.NewGuid(),
            VendorId: Guid.NewGuid(),
            WaiverType: LienWaiverType.Conditional,
            Amount: 0m,
            ThroughDate: new DateOnly(2026, 2, 1)));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task MarkReceivedAsync_FromRequested_TransitionsToReceived()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        LienWaiverService service = CreateService(db);
        LienWaiver waiver = await SeedWaiverAsync(db, LienWaiverStatus.Requested);

        var result = await service.MarkReceivedAsync(waiver.Id, "/docs/lien.pdf");

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(LienWaiverStatus.Received);
        result.Value.DocumentPath.Should().Be("/docs/lien.pdf");
    }

    [Fact]
    public async Task ApproveAsync_FromReceived_TransitionsToApprovedWithMetadata()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        LienWaiverService service = CreateService(db);
        LienWaiver waiver = await SeedWaiverAsync(db, LienWaiverStatus.Received);
        Guid reviewerId = Guid.NewGuid();

        var result = await service.ApproveAsync(waiver.Id, reviewerId);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(LienWaiverStatus.Approved);
        result.Value.ReviewedByUserId.Should().Be(reviewerId);
        result.Value.ReviewedAt.Should().NotBeNull();
        result.Value.RejectionReason.Should().BeNull();
    }

    [Fact]
    public async Task MarkReceivedAsync_FromReceived_ReturnsInvalidStatus()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        LienWaiverService service = CreateService(db);
        LienWaiver waiver = await SeedWaiverAsync(db, LienWaiverStatus.Received);

        var result = await service.MarkReceivedAsync(waiver.Id, "/docs/dup.pdf");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task MarkReceivedAsync_FromApproved_ReturnsInvalidStatus()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        LienWaiverService service = CreateService(db);
        LienWaiver waiver = await SeedWaiverAsync(db, LienWaiverStatus.Approved);

        var result = await service.MarkReceivedAsync(waiver.Id, "/docs/dup.pdf");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task ApproveAsync_NotReceived_ReturnsInvalidStatus()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        LienWaiverService service = CreateService(db);
        LienWaiver waiver = await SeedWaiverAsync(db, LienWaiverStatus.Requested);

        var result = await service.ApproveAsync(waiver.Id, Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task RejectAsync_ReceivedWithoutReason_ReturnsValidationError()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        LienWaiverService service = CreateService(db);
        LienWaiver waiver = await SeedWaiverAsync(db, LienWaiverStatus.Received);

        var result = await service.RejectAsync(waiver.Id, Guid.NewGuid(), " ");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task RejectAsync_ReceivedWithReason_TransitionsToRejectedAndTrimsReason()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        LienWaiverService service = CreateService(db);
        LienWaiver waiver = await SeedWaiverAsync(db, LienWaiverStatus.Received);
        Guid reviewerId = Guid.NewGuid();

        var result = await service.RejectAsync(waiver.Id, reviewerId, "  Missing notary  ");

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(LienWaiverStatus.Rejected);
        result.Value.ReviewedByUserId.Should().Be(reviewerId);
        result.Value.RejectionReason.Should().Be("Missing notary");
        result.Value.ReviewedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task UpdateLienWaiverAsync_ApprovedWaiver_ReturnsInvalidStatus()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        LienWaiverService service = CreateService(db);
        LienWaiver waiver = await SeedWaiverAsync(db, LienWaiverStatus.Approved);

        var result = await service.UpdateLienWaiverAsync(new UpdateLienWaiverCommand(
            WaiverId: waiver.Id,
            Amount: 1200m));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task DeleteLienWaiverAsync_ApprovedWaiver_ReturnsInvalidStatus()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        LienWaiverService service = CreateService(db);
        LienWaiver waiver = await SeedWaiverAsync(db, LienWaiverStatus.Approved);

        var result = await service.DeleteLienWaiverAsync(waiver.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task ListLienWaiversAsync_PageSizeOverMax_ClampsTo100()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        LienWaiverService service = CreateService(db);
        Guid projectId = Guid.NewGuid();

        for (int i = 0; i < 3; i++)
        {
            db.Set<LienWaiver>().Add(new LienWaiver
            {
                TenantId = TestDbContextFactory.TestTenantId,
                CompanyId = TestDbContextFactory.TestCompanyId,
                ProjectId = projectId,
                WaiverType = LienWaiverType.Progress,
                Amount = 1000m + i,
                ThroughDate = new DateOnly(2026, 2, 1),
                Status = LienWaiverStatus.Requested,
                CreatedAt = DateTime.UtcNow.AddMinutes(i),
                CreatedBy = "test"
            });
        }

        await db.SaveChangesAsync();

        var result = await service.GetLienWaiversAsync(new ListLienWaiversQuery(
            ProjectId: projectId,
            VendorId: null,
            WaiverType: null,
            Status: null,
            Page: 1,
            PageSize: 250));

        result.IsSuccess.Should().BeTrue();
        result.Value!.PageSize.Should().Be(100);
        result.Value.Items.Should().HaveCount(3);
    }

    private static async Task<LienWaiver> SeedWaiverAsync(PitbullDbContext db, LienWaiverStatus status)
    {
        LienWaiver waiver = new()
        {
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = Guid.NewGuid(),
            VendorId = Guid.NewGuid(),
            WaiverType = LienWaiverType.Conditional,
            Amount = 1000m,
            ThroughDate = new DateOnly(2026, 2, 1),
            Status = status,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        db.Set<LienWaiver>().Add(waiver);
        await db.SaveChangesAsync();
        return waiver;
    }
}
