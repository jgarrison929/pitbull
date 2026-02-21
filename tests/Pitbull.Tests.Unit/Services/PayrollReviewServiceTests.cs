using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Billing.Features.PayrollReviews;
using Pitbull.Billing.Services;
using Pitbull.Core.Domain;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Services;

public sealed class PayrollReviewServiceTests
{
    [Fact]
    public async Task Submit_ValidRun_CreatesReviewAndSetsRunUnderReview()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var run = await SeedPayrollRun(db, PayrollRunStatus.Submitted);

        var command = new SubmitPayrollRunForReviewCommand(
            PayrollRunId: run.Id,
            ReviewerUserId: "reviewer@test.com",
            Comments: "Please review");

        var result = await service.SubmitAsync(command);

        result.IsSuccess.Should().BeTrue();
        result.Value!.PayrollRunId.Should().Be(run.Id);
        result.Value.Status.Should().Be(PayrollReviewStatus.Submitted);
        result.Value.ReviewerUserId.Should().Be("reviewer@test.com");
        result.Value.SubmittedAt.Should().NotBeNull();

        // Verify run status updated
        var updatedRun = db.Set<PayrollRun>().First(r => r.Id == run.Id);
        updatedRun.Status.Should().Be(PayrollRunStatus.UnderReview);
    }

    [Fact]
    public async Task Submit_ExportedRun_ReturnsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var run = await SeedPayrollRun(db, PayrollRunStatus.Exported);

        var command = new SubmitPayrollRunForReviewCommand(
            PayrollRunId: run.Id,
            ReviewerUserId: "reviewer@test.com",
            Comments: null);

        var result = await service.SubmitAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task Submit_NonexistentRun_ReturnsNotFound()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var command = new SubmitPayrollRunForReviewCommand(
            PayrollRunId: Guid.NewGuid(),
            ReviewerUserId: "reviewer@test.com",
            Comments: null);

        var result = await service.SubmitAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task Approve_SubmittedReview_SetsApprovedAndUpdatesRun()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var run = await SeedPayrollRun(db, PayrollRunStatus.Submitted);
        var review = await SeedReview(db, run.Id, PayrollReviewStatus.Submitted);

        var command = new ApprovePayrollRunReviewCommand(
            ReviewId: review.Id,
            ReviewerUserId: "approver@test.com",
            Comments: "Looks good");

        var result = await service.ApproveAsync(command);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PayrollReviewStatus.Approved);
        result.Value.ReviewedAt.Should().NotBeNull();

        var updatedRun = db.Set<PayrollRun>().First(r => r.Id == run.Id);
        updatedRun.Status.Should().Be(PayrollRunStatus.Approved);
    }

    [Fact]
    public async Task Approve_AlreadyApproved_ReturnsInvalidStatus()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var run = await SeedPayrollRun(db, PayrollRunStatus.Approved);
        var review = await SeedReview(db, run.Id, PayrollReviewStatus.Approved);

        var command = new ApprovePayrollRunReviewCommand(
            ReviewId: review.Id,
            ReviewerUserId: "approver@test.com",
            Comments: null);

        var result = await service.ApproveAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task Reject_SubmittedReview_SetsRejectedAndResetsRunStatus()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var run = await SeedPayrollRun(db, PayrollRunStatus.UnderReview);
        var review = await SeedReview(db, run.Id, PayrollReviewStatus.Submitted);

        var command = new RejectPayrollRunReviewCommand(
            ReviewId: review.Id,
            ReviewerUserId: "reviewer@test.com",
            Comments: "Incorrect overtime calculation");

        var result = await service.RejectAsync(command);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PayrollReviewStatus.Rejected);
        result.Value.ReviewedAt.Should().NotBeNull();

        var updatedRun = db.Set<PayrollRun>().First(r => r.Id == run.Id);
        updatedRun.Status.Should().Be(PayrollRunStatus.Submitted);
    }

    [Fact]
    public async Task Reject_NonexistentReview_ReturnsNotFound()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var command = new RejectPayrollRunReviewCommand(
            ReviewId: Guid.NewGuid(),
            ReviewerUserId: "reviewer@test.com",
            Comments: "Issue found");

        var result = await service.RejectAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task Escalate_SubmittedReview_SetsEscalatedStatus()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var run = await SeedPayrollRun(db, PayrollRunStatus.UnderReview);
        var review = await SeedReview(db, run.Id, PayrollReviewStatus.Submitted);

        var command = new EscalatePayrollRunReviewCommand(
            ReviewId: review.Id,
            ReviewerUserId: "escalator@test.com",
            Comments: "Needs CFO review");

        var result = await service.EscalateAsync(command);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PayrollReviewStatus.Escalated);
        result.Value.EscalatedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task Get_ExistingReview_ReturnsDto()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var run = await SeedPayrollRun(db, PayrollRunStatus.UnderReview);
        var review = await SeedReview(db, run.Id, PayrollReviewStatus.Submitted);

        var result = await service.GetAsync(review.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(review.Id);
        result.Value.Status.Should().Be(PayrollReviewStatus.Submitted);
    }

    [Fact]
    public async Task Get_NonexistentReview_ReturnsNotFound()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.GetAsync(Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task List_PendingOnly_FiltersCorrectly()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var run = await SeedPayrollRun(db, PayrollRunStatus.UnderReview);

        await SeedReview(db, run.Id, PayrollReviewStatus.Submitted);
        await SeedReview(db, run.Id, PayrollReviewStatus.Approved);
        await SeedReview(db, run.Id, PayrollReviewStatus.Pending);

        var query = new ListPayrollRunReviewsQuery(PendingOnly: true);
        var result = await service.ListAsync(query);

        result.IsSuccess.Should().BeTrue();
        // PendingOnly includes Pending, Submitted, and Escalated
        result.Value!.Items.Should().HaveCount(2);
    }

    #region Helpers

    private static PayrollReviewService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        return new PayrollReviewService(db, NullLogger<PayrollReviewService>.Instance);
    }

    private static async Task<PayrollRun> SeedPayrollRun(
        Pitbull.Core.Data.PitbullDbContext db, PayrollRunStatus status)
    {
        var run = new PayrollRun
        {
            RunDate = DateOnly.FromDateTime(DateTime.UtcNow),
            PayPeriodId = Guid.NewGuid(),
            Status = status,
            TotalGross = 10000m,
            TotalNet = 8000m,
            EmployeeCount = 5
        };
        db.Set<PayrollRun>().Add(run);
        await db.SaveChangesAsync();
        return run;
    }

    private static async Task<PayrollRunReview> SeedReview(
        Pitbull.Core.Data.PitbullDbContext db, Guid payrollRunId, PayrollReviewStatus status)
    {
        var review = new PayrollRunReview
        {
            PayrollRunId = payrollRunId,
            ReviewerUserId = "default@test.com",
            Status = status,
            SubmittedAt = DateTime.UtcNow
        };
        db.Set<PayrollRunReview>().Add(review);
        await db.SaveChangesAsync();
        return review;
    }

    #endregion
}
