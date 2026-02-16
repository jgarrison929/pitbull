using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Core.CQRS;
using Pitbull.Core.Features.Dashboard;

namespace Pitbull.Tests.Unit.Api;

public class DashboardControllerTests
{
    private readonly Mock<IDashboardService> _serviceMock;
    private readonly DashboardController _controller;

    private static readonly Guid TestUserId = Guid.NewGuid();

    public DashboardControllerTests()
    {
        _serviceMock = new Mock<IDashboardService>();
        _controller = new DashboardController(_serviceMock.Object);
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
    }

    /// <summary>
    /// Sets up the controller's HttpContext with a "sub" claim for user identification.
    /// </summary>
    private void SetUserClaim(Guid userId)
    {
        var claims = new[] { new Claim("sub", userId.ToString()) };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);
        _controller.ControllerContext.HttpContext = new DefaultHttpContext
        {
            User = principal
        };
    }

    private static DashboardStatsResponse CreateTestStatsResponse() => new(
        ProjectCount: 12,
        BidCount: 25,
        TotalProjectValue: 15_000_000m,
        TotalBidValue: 8_500_000m,
        PendingChangeOrders: 3,
        LastActivityDate: DateTime.UtcNow,
        EmployeeCount: 42,
        PendingTimeApprovals: 7,
        RecentActivity: new List<RecentActivityItem>
        {
            new("1", "project", "Office Building", "Project PRJ-001 created", DateTime.UtcNow, "🏗️"),
            new("2", "bid", "Highway Bridge", "Bid BID-001 created", DateTime.UtcNow.AddHours(-1), "📋")
        }
    );

    private static WeeklyHoursResponse CreateTestWeeklyHoursResponse() => new(
        Data: new List<WeeklyHoursDataPoint>
        {
            new("Jan 6", new DateOnly(2026, 1, 6), 320m, 45.5m, 8m, 373.5m),
            new("Jan 13", new DateOnly(2026, 1, 13), 300m, 40m, 0m, 340m)
        },
        TotalHours: 713.5m,
        AverageHoursPerWeek: 356.75m
    );

    private static RfisNeedingAttentionResponse CreateTestRfisResponse() => new(
        OverdueCount: 3,
        BallInCourtCount: 2,
        TotalCount: 5,
        Items: new List<RfiAttentionItem>
        {
            new(
                Id: Guid.NewGuid(),
                Number: 42,
                Subject: "Foundation depth clarification",
                ProjectId: Guid.NewGuid().ToString(),
                ProjectName: "Office Building",
                ProjectNumber: "P-2026-001",
                Priority: "High",
                DueDate: DateTime.UtcNow.AddDays(-3),
                DaysOverdue: 3,
                IsOverdue: true,
                IsBallInCourt: false,
                BallInCourtName: "John Architect"
            ),
            new(
                Id: Guid.NewGuid(),
                Number: 15,
                Subject: "HVAC routing change",
                ProjectId: Guid.NewGuid().ToString(),
                ProjectName: "Office Building",
                ProjectNumber: "P-2026-001",
                Priority: "Medium",
                DueDate: DateTime.UtcNow.AddDays(5),
                DaysOverdue: 0,
                IsOverdue: false,
                IsBallInCourt: true,
                BallInCourtName: "Current User"
            )
        }
    );

    #region GetStats

    [Fact]
    public async Task GetStats_Success_Returns200WithStats()
    {
        var stats = CreateTestStatsResponse();
        _serviceMock
            .Setup(s => s.GetStatsAsync(default))
            .ReturnsAsync(Result.Success(stats));

        var result = await _controller.GetStats();

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.StatusCode.Should().Be(200);
        ok.Value.Should().Be(stats);
    }

    [Fact]
    public async Task GetStats_Success_ReturnsCorrectProjectCount()
    {
        var stats = CreateTestStatsResponse();
        _serviceMock
            .Setup(s => s.GetStatsAsync(default))
            .ReturnsAsync(Result.Success(stats));

        var result = await _controller.GetStats();

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<DashboardStatsResponse>().Subject;
        response.ProjectCount.Should().Be(12);
        response.BidCount.Should().Be(25);
        response.TotalProjectValue.Should().Be(15_000_000m);
        response.TotalBidValue.Should().Be(8_500_000m);
    }

    [Fact]
    public async Task GetStats_Error_Returns400WithErrorDetails()
    {
        _serviceMock
            .Setup(s => s.GetStatsAsync(default))
            .ReturnsAsync(Result.Failure<DashboardStatsResponse>(
                "Failed to retrieve dashboard statistics: timeout",
                "DASHBOARD_STATS_ERROR"));

        var result = await _controller.GetStats();

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task GetStats_ServiceError_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetStatsAsync(default))
            .ReturnsAsync(Result.Failure<DashboardStatsResponse>("Database error", "DB_ERROR"));

        var result = await _controller.GetStats();

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task GetStats_CallsServiceOnce()
    {
        _serviceMock
            .Setup(s => s.GetStatsAsync(default))
            .ReturnsAsync(Result.Success(CreateTestStatsResponse()));

        await _controller.GetStats();

        _serviceMock.Verify(s => s.GetStatsAsync(default), Times.Once);
    }

    #endregion

    #region GetWeeklyHours

    [Fact]
    public async Task GetWeeklyHours_Success_Returns200()
    {
        var weeklyHours = CreateTestWeeklyHoursResponse();
        _serviceMock
            .Setup(s => s.GetWeeklyHoursAsync(8, default))
            .ReturnsAsync(Result.Success(weeklyHours));

        var result = await _controller.GetWeeklyHours(8);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.StatusCode.Should().Be(200);
        ok.Value.Should().Be(weeklyHours);
    }

    [Fact]
    public async Task GetWeeklyHours_DefaultWeeks_PassesDefaultToService()
    {
        _serviceMock
            .Setup(s => s.GetWeeklyHoursAsync(8, default))
            .ReturnsAsync(Result.Success(CreateTestWeeklyHoursResponse()));

        await _controller.GetWeeklyHours();

        _serviceMock.Verify(s => s.GetWeeklyHoursAsync(8, default), Times.Once);
    }

    [Fact]
    public async Task GetWeeklyHours_CustomWeeks_PassesToService()
    {
        _serviceMock
            .Setup(s => s.GetWeeklyHoursAsync(12, default))
            .ReturnsAsync(Result.Success(CreateTestWeeklyHoursResponse()));

        await _controller.GetWeeklyHours(12);

        _serviceMock.Verify(s => s.GetWeeklyHoursAsync(12, default), Times.Once);
    }

    [Fact]
    public async Task GetWeeklyHours_ReturnsCorrectData()
    {
        var weeklyHours = CreateTestWeeklyHoursResponse();
        _serviceMock
            .Setup(s => s.GetWeeklyHoursAsync(8, default))
            .ReturnsAsync(Result.Success(weeklyHours));

        var result = await _controller.GetWeeklyHours(8);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<WeeklyHoursResponse>().Subject;
        response.Data.Should().HaveCount(2);
        response.TotalHours.Should().Be(713.5m);
        response.AverageHoursPerWeek.Should().Be(356.75m);
    }

    [Fact]
    public async Task GetWeeklyHours_Error_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetWeeklyHoursAsync(8, default))
            .ReturnsAsync(Result.Failure<WeeklyHoursResponse>(
                "Failed to retrieve weekly hours: connection refused",
                "WEEKLY_HOURS_ERROR"));

        var result = await _controller.GetWeeklyHours(8);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task GetWeeklyHours_ServiceError_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetWeeklyHoursAsync(It.IsAny<int>(), default))
            .ReturnsAsync(Result.Failure<WeeklyHoursResponse>("Database error", "DB_ERROR"));

        var result = await _controller.GetWeeklyHours(4);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task GetWeeklyHours_MinWeeks_PassesToService()
    {
        _serviceMock
            .Setup(s => s.GetWeeklyHoursAsync(1, default))
            .ReturnsAsync(Result.Success(CreateTestWeeklyHoursResponse()));

        await _controller.GetWeeklyHours(1);

        _serviceMock.Verify(s => s.GetWeeklyHoursAsync(1, default), Times.Once);
    }

    [Fact]
    public async Task GetWeeklyHours_MaxWeeks_PassesToService()
    {
        _serviceMock
            .Setup(s => s.GetWeeklyHoursAsync(52, default))
            .ReturnsAsync(Result.Success(CreateTestWeeklyHoursResponse()));

        await _controller.GetWeeklyHours(52);

        _serviceMock.Verify(s => s.GetWeeklyHoursAsync(52, default), Times.Once);
    }

    #endregion

    #region GetRfisNeedingAttention

    [Fact]
    public async Task GetRfisNeedingAttention_Success_Returns200()
    {
        var rfisResponse = CreateTestRfisResponse();
        _serviceMock
            .Setup(s => s.GetRfisNeedingAttentionAsync(null, 5, default))
            .ReturnsAsync(Result.Success(rfisResponse));

        var result = await _controller.GetRfisNeedingAttention();

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.StatusCode.Should().Be(200);
        ok.Value.Should().Be(rfisResponse);
    }

    [Fact]
    public async Task GetRfisNeedingAttention_WithUserClaim_PassesUserId()
    {
        SetUserClaim(TestUserId);

        _serviceMock
            .Setup(s => s.GetRfisNeedingAttentionAsync(TestUserId, 5, default))
            .ReturnsAsync(Result.Success(CreateTestRfisResponse()));

        await _controller.GetRfisNeedingAttention();

        _serviceMock.Verify(
            s => s.GetRfisNeedingAttentionAsync(TestUserId, 5, default),
            Times.Once);
    }

    [Fact]
    public async Task GetRfisNeedingAttention_WithoutUserClaim_PassesNullUserId()
    {
        // Default controller context has no claims
        _serviceMock
            .Setup(s => s.GetRfisNeedingAttentionAsync(null, 5, default))
            .ReturnsAsync(Result.Success(CreateTestRfisResponse()));

        await _controller.GetRfisNeedingAttention();

        _serviceMock.Verify(
            s => s.GetRfisNeedingAttentionAsync(null, 5, default),
            Times.Once);
    }

    [Fact]
    public async Task GetRfisNeedingAttention_WithNameIdentifierClaim_ParsesUserId()
    {
        // Test the fallback to ClaimTypes.NameIdentifier when "sub" is not present
        var claims = new[] { new Claim(ClaimTypes.NameIdentifier, TestUserId.ToString()) };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);
        _controller.ControllerContext.HttpContext = new DefaultHttpContext { User = principal };

        _serviceMock
            .Setup(s => s.GetRfisNeedingAttentionAsync(TestUserId, 5, default))
            .ReturnsAsync(Result.Success(CreateTestRfisResponse()));

        await _controller.GetRfisNeedingAttention();

        _serviceMock.Verify(
            s => s.GetRfisNeedingAttentionAsync(TestUserId, 5, default),
            Times.Once);
    }

    [Fact]
    public async Task GetRfisNeedingAttention_WithInvalidClaimValue_PassesNullUserId()
    {
        // If the claim value is not a valid GUID, userId should be null
        var claims = new[] { new Claim("sub", "not-a-guid") };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);
        _controller.ControllerContext.HttpContext = new DefaultHttpContext { User = principal };

        _serviceMock
            .Setup(s => s.GetRfisNeedingAttentionAsync(null, 5, default))
            .ReturnsAsync(Result.Success(CreateTestRfisResponse()));

        await _controller.GetRfisNeedingAttention();

        _serviceMock.Verify(
            s => s.GetRfisNeedingAttentionAsync(null, 5, default),
            Times.Once);
    }

    [Fact]
    public async Task GetRfisNeedingAttention_CustomLimit_PassesToService()
    {
        _serviceMock
            .Setup(s => s.GetRfisNeedingAttentionAsync(null, 10, default))
            .ReturnsAsync(Result.Success(CreateTestRfisResponse()));

        await _controller.GetRfisNeedingAttention(10);

        _serviceMock.Verify(
            s => s.GetRfisNeedingAttentionAsync(null, 10, default),
            Times.Once);
    }

    [Fact]
    public async Task GetRfisNeedingAttention_DefaultLimit_PassesFive()
    {
        _serviceMock
            .Setup(s => s.GetRfisNeedingAttentionAsync(null, 5, default))
            .ReturnsAsync(Result.Success(CreateTestRfisResponse()));

        await _controller.GetRfisNeedingAttention();

        _serviceMock.Verify(
            s => s.GetRfisNeedingAttentionAsync(null, 5, default),
            Times.Once);
    }

    [Fact]
    public async Task GetRfisNeedingAttention_ReturnsCorrectCounts()
    {
        var rfisResponse = CreateTestRfisResponse();
        _serviceMock
            .Setup(s => s.GetRfisNeedingAttentionAsync(null, 5, default))
            .ReturnsAsync(Result.Success(rfisResponse));

        var result = await _controller.GetRfisNeedingAttention();

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<RfisNeedingAttentionResponse>().Subject;
        response.OverdueCount.Should().Be(3);
        response.BallInCourtCount.Should().Be(2);
        response.TotalCount.Should().Be(5);
        response.Items.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetRfisNeedingAttention_Error_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetRfisNeedingAttentionAsync(null, 5, default))
            .ReturnsAsync(Result.Failure<RfisNeedingAttentionResponse>(
                "Failed to retrieve RFIs", "RFI_ERROR"));

        var result = await _controller.GetRfisNeedingAttention();

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task GetRfisNeedingAttention_ServiceError_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetRfisNeedingAttentionAsync(It.IsAny<Guid?>(), It.IsAny<int>(), default))
            .ReturnsAsync(Result.Failure<RfisNeedingAttentionResponse>("Database error", "DB_ERROR"));

        var result = await _controller.GetRfisNeedingAttention();

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task GetRfisNeedingAttention_WithUserAndCustomLimit_PassesBoth()
    {
        SetUserClaim(TestUserId);

        _serviceMock
            .Setup(s => s.GetRfisNeedingAttentionAsync(TestUserId, 15, default))
            .ReturnsAsync(Result.Success(CreateTestRfisResponse()));

        await _controller.GetRfisNeedingAttention(15);

        _serviceMock.Verify(
            s => s.GetRfisNeedingAttentionAsync(TestUserId, 15, default),
            Times.Once);
    }

    [Fact]
    public async Task GetRfisNeedingAttention_EmptyResult_Returns200WithEmptyItems()
    {
        var emptyResponse = new RfisNeedingAttentionResponse(
            OverdueCount: 0,
            BallInCourtCount: 0,
            TotalCount: 0,
            Items: new List<RfiAttentionItem>()
        );

        _serviceMock
            .Setup(s => s.GetRfisNeedingAttentionAsync(null, 5, default))
            .ReturnsAsync(Result.Success(emptyResponse));

        var result = await _controller.GetRfisNeedingAttention();

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeOfType<RfisNeedingAttentionResponse>().Subject;
        response.TotalCount.Should().Be(0);
        response.Items.Should().BeEmpty();
    }

    #endregion
}
