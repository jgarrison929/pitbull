using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Billing.Features.Wip;
using Pitbull.Billing.Services;
using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;
using System.Security.Claims;

namespace Pitbull.Tests.Unit.Api;

public class WipReportsControllerTests
{
    private readonly Mock<IWipReportService> _wipReportService = new();
    private readonly Mock<IWipGlPostingService> _wipGlPostingService = new();
    private readonly WipReportsController _controller;

    private static readonly Guid TestReportId = Guid.NewGuid();
    private static readonly Guid TestJournalEntryId = Guid.NewGuid();
    private static readonly string TestUserId = Guid.NewGuid().ToString();

    public WipReportsControllerTests()
    {
        _controller = new WipReportsController(
            _wipReportService.Object,
            _wipGlPostingService.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                    [
                        new Claim(ClaimTypes.NameIdentifier, TestUserId)
                    ], "test"))
                }
            }
        };
    }

    // ── Test data factories ──

    private static WipGlPostResult CreatePostResult() => new(
        WipReportId: TestReportId,
        JournalEntryId: TestJournalEntryId,
        JournalEntryNumber: "JE-2026-000001",
        TotalDebits: 15000m,
        TotalCredits: 15000m,
        LineCount: 4
    );

    private static WipReportDto CreateWipReportDto(
        WipReportStatus status = WipReportStatus.Final,
        Guid? glJournalEntryId = null) => new(
        Id: TestReportId,
        ReportDate: new DateOnly(2026, 2, 1),
        FiscalYear: 2026,
        PeriodNumber: 2,
        Status: status,
        StatusName: status.ToString(),
        GeneratedById: TestUserId,
        CreatedAt: DateTime.UtcNow,
        UpdatedAt: null,
        Lines:
        [
            new WipReportLineDto(
                Id: Guid.NewGuid(),
                WipReportId: TestReportId,
                ProjectId: Guid.NewGuid(),
                ProjectNumber: "PRJ-001",
                ProjectName: "City Hall Renovation",
                ContractAmount: 500000m,
                ApprovedChangeOrders: 25000m,
                RevisedContractAmount: 525000m,
                TotalCostToDate: 200000m,
                EstimatedCostToComplete: 250000m,
                EstimatedTotalCost: 450000m,
                PercentComplete: 0.4444m,
                EarnedRevenue: 233333m,
                BilledToDate: 220000m,
                OverUnderBilling: 13333m,
                OverUnderClassification: WipOverUnderClassification.UnderBilled),
        ],
        GlJournalEntryId: glJournalEntryId,
        PostedToGlAt: glJournalEntryId.HasValue ? DateTime.UtcNow : null,
        PostedToGlBy: glJournalEntryId.HasValue ? TestUserId : null
    );

    // ═══════════════════════════════════════════════
    //  POST /api/wip-reports/{id}/post-to-gl
    // ═══════════════════════════════════════════════

    #region PostToGl

    [Fact]
    public async Task PostToGl_Success_Returns200WithResult()
    {
        var expected = CreatePostResult();
        _wipGlPostingService
            .Setup(s => s.PostToGlAsync(TestReportId, TestUserId, default))
            .ReturnsAsync(Result.Success(expected));

        var result = await _controller.PostToGl(TestReportId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.StatusCode.Should().Be(200);
        ok.Value.Should().Be(expected);
    }

    [Fact]
    public async Task PostToGl_NotFound_Returns404()
    {
        _wipGlPostingService
            .Setup(s => s.PostToGlAsync(TestReportId, TestUserId, default))
            .ReturnsAsync(Result.Failure<WipGlPostResult>(
                "WIP report not found", "NOT_FOUND"));

        var result = await _controller.PostToGl(TestReportId);

        var notFound = result.Should().BeOfType<NotFoundObjectResult>().Subject;
        notFound.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task PostToGl_InvalidStatus_Returns400()
    {
        _wipGlPostingService
            .Setup(s => s.PostToGlAsync(TestReportId, TestUserId, default))
            .ReturnsAsync(Result.Failure<WipGlPostResult>(
                "Only finalized WIP reports can be posted to GL", "INVALID_STATUS"));

        var result = await _controller.PostToGl(TestReportId);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task PostToGl_AlreadyPosted_Returns400()
    {
        _wipGlPostingService
            .Setup(s => s.PostToGlAsync(TestReportId, TestUserId, default))
            .ReturnsAsync(Result.Failure<WipGlPostResult>(
                "This WIP report has already been posted to GL", "ALREADY_POSTED"));

        var result = await _controller.PostToGl(TestReportId);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task PostToGl_NoLines_Returns400()
    {
        _wipGlPostingService
            .Setup(s => s.PostToGlAsync(TestReportId, TestUserId, default))
            .ReturnsAsync(Result.Failure<WipGlPostResult>(
                "WIP report has no lines to post", "VALIDATION_ERROR"));

        var result = await _controller.PostToGl(TestReportId);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task PostToGl_AccountsNotFound_Returns400()
    {
        _wipGlPostingService
            .Setup(s => s.PostToGlAsync(TestReportId, TestUserId, default))
            .ReturnsAsync(Result.Failure<WipGlPostResult>(
                "Required GL accounts not found", "ACCOUNTS_NOT_FOUND"));

        var result = await _controller.PostToGl(TestReportId);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task PostToGl_NoAdjustments_Returns400()
    {
        _wipGlPostingService
            .Setup(s => s.PostToGlAsync(TestReportId, TestUserId, default))
            .ReturnsAsync(Result.Failure<WipGlPostResult>(
                "No over/under billing adjustments to post", "NO_ADJUSTMENTS"));

        var result = await _controller.PostToGl(TestReportId);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task PostToGl_DatabaseError_Returns400()
    {
        _wipGlPostingService
            .Setup(s => s.PostToGlAsync(TestReportId, TestUserId, default))
            .ReturnsAsync(Result.Failure<WipGlPostResult>(
                "Failed to post WIP report to GL", "DATABASE_ERROR"));

        var result = await _controller.PostToGl(TestReportId);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task PostToGl_PassesUserIdToService()
    {
        var expected = CreatePostResult();
        _wipGlPostingService
            .Setup(s => s.PostToGlAsync(TestReportId, TestUserId, default))
            .ReturnsAsync(Result.Success(expected));

        await _controller.PostToGl(TestReportId);

        _wipGlPostingService.Verify(
            s => s.PostToGlAsync(TestReportId, TestUserId, default),
            Times.Once);
    }

    [Fact]
    public async Task PostToGl_ReturnsCorrectJournalEntryDetails()
    {
        var expected = CreatePostResult();
        _wipGlPostingService
            .Setup(s => s.PostToGlAsync(TestReportId, TestUserId, default))
            .ReturnsAsync(Result.Success(expected));

        var result = await _controller.PostToGl(TestReportId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var postResult = ok.Value.Should().BeOfType<WipGlPostResult>().Subject;
        postResult.WipReportId.Should().Be(TestReportId);
        postResult.JournalEntryId.Should().Be(TestJournalEntryId);
        postResult.JournalEntryNumber.Should().Be("JE-2026-000001");
        postResult.TotalDebits.Should().Be(15000m);
        postResult.TotalCredits.Should().Be(15000m);
        postResult.LineCount.Should().Be(4);
    }

    [Fact]
    public async Task PostToGl_BalancedEntry_DebitsEqualCredits()
    {
        var expected = CreatePostResult();
        _wipGlPostingService
            .Setup(s => s.PostToGlAsync(TestReportId, TestUserId, default))
            .ReturnsAsync(Result.Success(expected));

        var result = await _controller.PostToGl(TestReportId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var postResult = ok.Value.Should().BeOfType<WipGlPostResult>().Subject;
        postResult.TotalDebits.Should().Be(postResult.TotalCredits);
    }

    #endregion

    // ═══════════════════════════════════════════════
    //  GET /api/wip-reports/{id} - verify GL fields
    // ═══════════════════════════════════════════════

    #region GetById with GL fields

    [Fact]
    public async Task GetById_PostedReport_ReturnsGlFields()
    {
        var expected = CreateWipReportDto(
            status: WipReportStatus.Final,
            glJournalEntryId: TestJournalEntryId);
        _wipReportService
            .Setup(s => s.GetWipReportAsync(TestReportId, default))
            .ReturnsAsync(Result.Success(expected));

        var result = await _controller.GetById(TestReportId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = ok.Value.Should().BeOfType<WipReportDto>().Subject;
        dto.GlJournalEntryId.Should().Be(TestJournalEntryId);
        dto.PostedToGlAt.Should().NotBeNull();
        dto.PostedToGlBy.Should().Be(TestUserId);
    }

    [Fact]
    public async Task GetById_UnpostedReport_GlFieldsAreNull()
    {
        var expected = CreateWipReportDto(status: WipReportStatus.Final);
        _wipReportService
            .Setup(s => s.GetWipReportAsync(TestReportId, default))
            .ReturnsAsync(Result.Success(expected));

        var result = await _controller.GetById(TestReportId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = ok.Value.Should().BeOfType<WipReportDto>().Subject;
        dto.GlJournalEntryId.Should().BeNull();
        dto.PostedToGlAt.Should().BeNull();
        dto.PostedToGlBy.Should().BeNull();
    }

    #endregion
}
