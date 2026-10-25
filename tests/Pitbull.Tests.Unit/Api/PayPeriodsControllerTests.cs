using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Core.CQRS;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Entities;
using Pitbull.TimeTracking.Features;
using Pitbull.TimeTracking.Services;

namespace Pitbull.Tests.Unit.Api;

public class PayPeriodsControllerTests
{
    private readonly Mock<IPayPeriodService> _serviceMock;
    private readonly PayPeriodsController _controller;

    private static readonly Guid TestId = Guid.NewGuid();
    private static readonly Guid TestLockedById = Guid.NewGuid();

    public PayPeriodsControllerTests()
    {
        _serviceMock = new Mock<IPayPeriodService>();
        _controller = new PayPeriodsController(_serviceMock.Object);
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
    }

    /// <summary>
    /// Helper to set up the controller with a JWT user claim so TryGetCurrentUserId succeeds.
    /// </summary>
    private void SetCurrentUser(Guid userId)
    {
        var claims = new[] { new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()) };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        _controller.ControllerContext.HttpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(identity)
        };
    }

    private static PayPeriodDto CreateTestDto(Guid? id = null) => new()
    {
        Id = id ?? TestId,
        StartDate = new DateOnly(2026, 2, 9),
        EndDate = new DateOnly(2026, 2, 15),
        Status = PayPeriodStatus.Open,
        LockedAt = null,
        LockedById = null,
        CreatedAt = DateTime.UtcNow
    };

    private static PayPeriodConfigurationDto CreateTestConfigDto(Guid? id = null) => new()
    {
        Id = id ?? Guid.NewGuid(),
        Type = PayPeriodType.BiWeekly,
        WeekStartDay = DayOfWeek.Sunday,
        SemiMonthlyFirstDay = 1,
        SemiMonthlySecondDay = 16,
        AutoLockEnabled = false,
        AutoLockDaysAfterEnd = 3,
        PeriodsToGenerateAhead = 4,
        BiWeeklyReferenceDate = new DateOnly(2026, 1, 5),
        EnforcementEnabled = true
    };

    #region List

    [Fact]
    public async Task List_Success_Returns200()
    {
        var pagedResult = new PagedResult<PayPeriodDto>(
            new[] { CreateTestDto() }, TotalCount: 1, Page: 1, PageSize: 25);
        _serviceMock
            .Setup(s => s.ListPayPeriodsAsync(null, 1, 25, default))
            .ReturnsAsync(Result.Success(pagedResult));

        var result = await _controller.List(null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(pagedResult);
    }

    [Fact]
    public async Task List_WithFilters_PassesToService()
    {
        var pagedResult = new PagedResult<PayPeriodDto>(
            Array.Empty<PayPeriodDto>(), 0, 2, 50);
        _serviceMock
            .Setup(s => s.ListPayPeriodsAsync(
                PayPeriodStatus.Locked,
                2, 50, default))
            .ReturnsAsync(Result.Success(pagedResult));

        await _controller.List(
            PayPeriodStatus.Locked,
            2, 50);

        _serviceMock.Verify(s => s.ListPayPeriodsAsync(
            PayPeriodStatus.Locked,
            2, 50, default), Times.Once);
    }

    [Fact]
    public async Task List_DefaultPagination_PassesDefaults()
    {
        var pagedResult = new PagedResult<PayPeriodDto>(
            Array.Empty<PayPeriodDto>(), 0, 1, 25);
        _serviceMock
            .Setup(s => s.ListPayPeriodsAsync(null, 1, 25, default))
            .ReturnsAsync(Result.Success(pagedResult));

        await _controller.List(null);

        _serviceMock.Verify(s => s.ListPayPeriodsAsync(
            null, 1, 25, default), Times.Once);
    }

    [Fact]
    public async Task List_NullFilters_PassesNullToService()
    {
        var pagedResult = new PagedResult<PayPeriodDto>(
            Array.Empty<PayPeriodDto>(), 0, 1, 25);
        _serviceMock
            .Setup(s => s.ListPayPeriodsAsync(null, 1, 25, default))
            .ReturnsAsync(Result.Success(pagedResult));

        await _controller.List(null);

        _serviceMock.Verify(s => s.ListPayPeriodsAsync(
            null, 1, 25, default), Times.Once);
    }

    [Fact]
    public async Task List_Error_Returns400()
    {
        _serviceMock
            .Setup(s => s.ListPayPeriodsAsync(null, 1, 25, default))
            .ReturnsAsync(Result.Failure<PagedResult<PayPeriodDto>>("Invalid query"));

        var result = await _controller.List(null);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task List_EmptyResults_Returns200WithEmptyList()
    {
        var pagedResult = new PagedResult<PayPeriodDto>(
            Array.Empty<PayPeriodDto>(), 0, 1, 25);
        _serviceMock
            .Setup(s => s.ListPayPeriodsAsync(null, 1, 25, default))
            .ReturnsAsync(Result.Success(pagedResult));

        var result = await _controller.List(null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var paged = ok.Value.Should().BeOfType<PagedResult<PayPeriodDto>>().Subject;
        paged.TotalCount.Should().Be(0);
        paged.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task List_FilterByStatus_PassesToService()
    {
        var pagedResult = new PagedResult<PayPeriodDto>(
            Array.Empty<PayPeriodDto>(), 0, 1, 25);
        _serviceMock
            .Setup(s => s.ListPayPeriodsAsync(
                PayPeriodStatus.Closed, 1, 25, default))
            .ReturnsAsync(Result.Success(pagedResult));

        await _controller.List(PayPeriodStatus.Closed);

        _serviceMock.Verify(s => s.ListPayPeriodsAsync(
            PayPeriodStatus.Closed, 1, 25, default), Times.Once);
    }

    #endregion

    #region Lock

    [Fact]
    public async Task Lock_Success_Returns200()
    {
        SetCurrentUser(TestLockedById);
        var dto = CreateTestDto() with { Status = PayPeriodStatus.Locked };
        _serviceMock
            .Setup(s => s.LockPayPeriodAsync(TestId, TestLockedById, default))
            .ReturnsAsync(Result.Success(dto));

        var result = await _controller.Lock(TestId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(dto);
    }

    [Fact]
    public async Task Lock_NotFound_Returns404()
    {
        SetCurrentUser(TestLockedById);
        _serviceMock
            .Setup(s => s.LockPayPeriodAsync(TestId, TestLockedById, default))
            .ReturnsAsync(Result.Failure<PayPeriodDto>("Pay period not found", "NOT_FOUND"));

        var result = await _controller.Lock(TestId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Lock_AlreadyLocked_Returns400()
    {
        SetCurrentUser(TestLockedById);
        _serviceMock
            .Setup(s => s.LockPayPeriodAsync(TestId, TestLockedById, default))
            .ReturnsAsync(Result.Failure<PayPeriodDto>("Pay period is already locked", "ALREADY_LOCKED"));

        var result = await _controller.Lock(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Lock_PassesUserIdFromJwt()
    {
        var lockedById = Guid.NewGuid();
        SetCurrentUser(lockedById);
        _serviceMock
            .Setup(s => s.LockPayPeriodAsync(TestId, lockedById, default))
            .ReturnsAsync(Result.Success(CreateTestDto()));

        await _controller.Lock(TestId);

        _serviceMock.Verify(s => s.LockPayPeriodAsync(
            TestId, lockedById, default), Times.Once);
    }

    [Fact]
    public async Task Lock_NoUserClaim_Returns400()
    {
        // Controller has default HttpContext with no claims
        var result = await _controller.Lock(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Lock_OtherError_Returns400()
    {
        SetCurrentUser(TestLockedById);
        _serviceMock
            .Setup(s => s.LockPayPeriodAsync(TestId, TestLockedById, default))
            .ReturnsAsync(Result.Failure<PayPeriodDto>("Unknown error", "UNKNOWN"));

        var result = await _controller.Lock(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Lock_ReturnsLockedDto()
    {
        SetCurrentUser(TestLockedById);
        var dto = CreateTestDto() with
        {
            Status = PayPeriodStatus.Locked,
            LockedAt = DateTime.UtcNow,
            LockedById = TestLockedById
        };
        _serviceMock
            .Setup(s => s.LockPayPeriodAsync(TestId, TestLockedById, default))
            .ReturnsAsync(Result.Success(dto));

        var result = await _controller.Lock(TestId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var returned = ok.Value.Should().BeOfType<PayPeriodDto>().Subject;
        returned.Status.Should().Be(PayPeriodStatus.Locked);
        returned.IsLocked.Should().BeTrue();
        returned.LockedById.Should().Be(TestLockedById);
    }

    #endregion

    #region Unlock

    [Fact]
    public async Task Unlock_Success_Returns200()
    {
        var unlockedById = Guid.NewGuid();
        SetCurrentUser(unlockedById);
        var dto = CreateTestDto() with { Status = PayPeriodStatus.Open };
        _serviceMock
            .Setup(s => s.UnlockPayPeriodAsync(TestId, unlockedById, default))
            .ReturnsAsync(Result.Success(dto));

        var result = await _controller.Unlock(TestId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(dto);
    }

    [Fact]
    public async Task Unlock_NotFound_Returns404()
    {
        var unlockedById = Guid.NewGuid();
        SetCurrentUser(unlockedById);
        _serviceMock
            .Setup(s => s.UnlockPayPeriodAsync(TestId, unlockedById, default))
            .ReturnsAsync(Result.Failure<PayPeriodDto>("Pay period not found", "NOT_FOUND"));

        var result = await _controller.Unlock(TestId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Unlock_AlreadyOpen_Returns400()
    {
        var unlockedById = Guid.NewGuid();
        SetCurrentUser(unlockedById);
        _serviceMock
            .Setup(s => s.UnlockPayPeriodAsync(TestId, unlockedById, default))
            .ReturnsAsync(Result.Failure<PayPeriodDto>("Pay period is already open", "ALREADY_OPEN"));

        var result = await _controller.Unlock(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Unlock_PassesUserIdFromJwt()
    {
        var unlockedById = Guid.NewGuid();
        SetCurrentUser(unlockedById);
        _serviceMock
            .Setup(s => s.UnlockPayPeriodAsync(TestId, unlockedById, default))
            .ReturnsAsync(Result.Success(CreateTestDto()));

        await _controller.Unlock(TestId);

        _serviceMock.Verify(s => s.UnlockPayPeriodAsync(
            TestId, unlockedById, default), Times.Once);
    }

    [Fact]
    public async Task Unlock_NoUserClaim_Returns400()
    {
        var result = await _controller.Unlock(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Unlock_OtherError_Returns400()
    {
        var unlockedById = Guid.NewGuid();
        SetCurrentUser(unlockedById);
        _serviceMock
            .Setup(s => s.UnlockPayPeriodAsync(TestId, unlockedById, default))
            .ReturnsAsync(Result.Failure<PayPeriodDto>("Unknown error", "UNKNOWN"));

        var result = await _controller.Unlock(TestId);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Unlock_ReturnsUnlockedDto()
    {
        var unlockedById = Guid.NewGuid();
        SetCurrentUser(unlockedById);
        var dto = CreateTestDto() with { Status = PayPeriodStatus.Open };
        _serviceMock
            .Setup(s => s.UnlockPayPeriodAsync(TestId, unlockedById, default))
            .ReturnsAsync(Result.Success(dto));

        var result = await _controller.Unlock(TestId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var returned = ok.Value.Should().BeOfType<PayPeriodDto>().Subject;
        returned.Status.Should().Be(PayPeriodStatus.Open);
        returned.IsLocked.Should().BeFalse();
    }

    #endregion

    #region GetConfiguration

    [Fact]
    public async Task GetConfiguration_Success_Returns200()
    {
        var configDto = CreateTestConfigDto();
        _serviceMock
            .Setup(s => s.GetConfigurationAsync(default))
            .ReturnsAsync(Result.Success(configDto));

        var result = await _controller.GetConfiguration();

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(configDto);
    }

    [Fact]
    public async Task GetConfiguration_Error_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetConfigurationAsync(default))
            .ReturnsAsync(Result.Failure<PayPeriodConfigurationDto>("Request failed"));

        var result = await _controller.GetConfiguration();

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task GetConfiguration_ReturnsFullDtoFields()
    {
        var configDto = CreateTestConfigDto();
        _serviceMock
            .Setup(s => s.GetConfigurationAsync(default))
            .ReturnsAsync(Result.Success(configDto));

        var result = await _controller.GetConfiguration();

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var returned = ok.Value.Should().BeOfType<PayPeriodConfigurationDto>().Subject;
        returned.Type.Should().Be(PayPeriodType.BiWeekly);
        returned.WeekStartDay.Should().Be(DayOfWeek.Sunday);
        returned.SemiMonthlyFirstDay.Should().Be(1);
        returned.SemiMonthlySecondDay.Should().Be(16);
        returned.AutoLockEnabled.Should().BeFalse();
        returned.AutoLockDaysAfterEnd.Should().Be(3);
        returned.PeriodsToGenerateAhead.Should().Be(4);
        returned.BiWeeklyReferenceDate.Should().Be(new DateOnly(2026, 1, 5));
        returned.EnforcementEnabled.Should().BeTrue();
    }

    #endregion

    #region UpdateConfiguration

    [Fact]
    public async Task UpdateConfiguration_Success_Returns200()
    {
        var configDto = CreateTestConfigDto();
        _serviceMock
            .Setup(s => s.UpdateConfigurationAsync(
                PayPeriodType.BiWeekly,
                DayOfWeek.Sunday,
                1, 16, false, 3, 4, null, true, default))
            .ReturnsAsync(Result.Success(configDto));

        var request = new UpdatePayPeriodConfigurationRequest(
            Type: PayPeriodType.BiWeekly,
            WeekStartDay: DayOfWeek.Sunday);

        var result = await _controller.UpdateConfiguration(request);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(configDto);
    }

    [Fact]
    public async Task UpdateConfiguration_ValidationError_Returns400()
    {
        _serviceMock
            .Setup(s => s.UpdateConfigurationAsync(
                It.IsAny<PayPeriodType>(),
                It.IsAny<DayOfWeek>(),
                It.IsAny<int>(),
                It.IsAny<int>(),
                It.IsAny<bool>(),
                It.IsAny<int>(),
                It.IsAny<int>(),
                It.IsAny<DateOnly?>(),
                It.IsAny<bool>(),
                default))
            .ReturnsAsync(Result.Failure<PayPeriodConfigurationDto>("Invalid configuration values"));

        var request = new UpdatePayPeriodConfigurationRequest(
            Type: PayPeriodType.SemiMonthly,
            WeekStartDay: DayOfWeek.Monday,
            SemiMonthlyFirstDay: 0,
            SemiMonthlySecondDay: 32);

        var result = await _controller.UpdateConfiguration(request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task UpdateConfiguration_PassesAllFieldsToService()
    {
        var refDate = new DateOnly(2026, 1, 5);
        _serviceMock
            .Setup(s => s.UpdateConfigurationAsync(
                PayPeriodType.BiWeekly,
                DayOfWeek.Monday,
                1, 16, true, 5, 6, refDate, false, default))
            .ReturnsAsync(Result.Success(CreateTestConfigDto()));

        var request = new UpdatePayPeriodConfigurationRequest(
            Type: PayPeriodType.BiWeekly,
            WeekStartDay: DayOfWeek.Monday,
            SemiMonthlyFirstDay: 1,
            SemiMonthlySecondDay: 16,
            AutoLockEnabled: true,
            AutoLockDaysAfterEnd: 5,
            PeriodsToGenerateAhead: 6,
            BiWeeklyReferenceDate: refDate,
            EnforcementEnabled: false);

        await _controller.UpdateConfiguration(request);

        _serviceMock.Verify(s => s.UpdateConfigurationAsync(
            PayPeriodType.BiWeekly,
            DayOfWeek.Monday,
            1, 16, true, 5, 6, refDate, false, default), Times.Once);
    }

    [Fact]
    public async Task UpdateConfiguration_DefaultValues_PassesDefaults()
    {
        _serviceMock
            .Setup(s => s.UpdateConfigurationAsync(
                PayPeriodType.Weekly,
                DayOfWeek.Sunday,
                1, 16, false, 3, 4, null, true, default))
            .ReturnsAsync(Result.Success(CreateTestConfigDto()));

        var request = new UpdatePayPeriodConfigurationRequest(
            Type: PayPeriodType.Weekly,
            WeekStartDay: DayOfWeek.Sunday);

        await _controller.UpdateConfiguration(request);

        _serviceMock.Verify(s => s.UpdateConfigurationAsync(
            PayPeriodType.Weekly,
            DayOfWeek.Sunday,
            1, 16, false, 3, 4, null, true, default), Times.Once);
    }

    [Fact]
    public async Task UpdateConfiguration_MonthlyType_PassesThrough()
    {
        var configDto = CreateTestConfigDto() with { Type = PayPeriodType.Monthly };
        _serviceMock
            .Setup(s => s.UpdateConfigurationAsync(
                PayPeriodType.Monthly,
                It.IsAny<DayOfWeek>(),
                It.IsAny<int>(),
                It.IsAny<int>(),
                It.IsAny<bool>(),
                It.IsAny<int>(),
                It.IsAny<int>(),
                It.IsAny<DateOnly?>(),
                It.IsAny<bool>(),
                default))
            .ReturnsAsync(Result.Success(configDto));

        var request = new UpdatePayPeriodConfigurationRequest(
            Type: PayPeriodType.Monthly,
            WeekStartDay: DayOfWeek.Sunday);

        var result = await _controller.UpdateConfiguration(request);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var returned = ok.Value.Should().BeOfType<PayPeriodConfigurationDto>().Subject;
        returned.Type.Should().Be(PayPeriodType.Monthly);
    }

    [Fact]
    public async Task UpdateConfiguration_SemiMonthlyType_PassesCustomDays()
    {
        _serviceMock
            .Setup(s => s.UpdateConfigurationAsync(
                PayPeriodType.SemiMonthly,
                DayOfWeek.Sunday,
                1, 15, false, 3, 4, null, true, default))
            .ReturnsAsync(Result.Success(CreateTestConfigDto()));

        var request = new UpdatePayPeriodConfigurationRequest(
            Type: PayPeriodType.SemiMonthly,
            WeekStartDay: DayOfWeek.Sunday,
            SemiMonthlyFirstDay: 1,
            SemiMonthlySecondDay: 15);

        await _controller.UpdateConfiguration(request);

        _serviceMock.Verify(s => s.UpdateConfigurationAsync(
            PayPeriodType.SemiMonthly,
            DayOfWeek.Sunday,
            1, 15, false, 3, 4, null, true, default), Times.Once);
    }

    #endregion

    #region Generate

    [Fact]
    public async Task Generate_Success_Returns200()
    {
        var generateResult = new GeneratePayPeriodsResult(
            PeriodsCreated: 4,
            PeriodsSkipped: 0,
            CreatedPeriods: new List<PayPeriodDto> { CreateTestDto() });
        _serviceMock
            .Setup(s => s.GeneratePayPeriodsAsync(null, null, default))
            .ReturnsAsync(Result.Success(generateResult));

        var request = new GeneratePayPeriodsRequest();
        var result = await _controller.Generate(request);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(generateResult);
    }

    [Fact]
    public async Task Generate_WithParameters_PassesToService()
    {
        var fromDate = new DateOnly(2026, 3, 1);
        var generateResult = new GeneratePayPeriodsResult(6, 0, new List<PayPeriodDto>());
        _serviceMock
            .Setup(s => s.GeneratePayPeriodsAsync(fromDate, 6, default))
            .ReturnsAsync(Result.Success(generateResult));

        var request = new GeneratePayPeriodsRequest(fromDate, 6);
        await _controller.Generate(request);

        _serviceMock.Verify(s => s.GeneratePayPeriodsAsync(
            fromDate, 6, default), Times.Once);
    }

    [Fact]
    public async Task Generate_NullParameters_PassesNullToService()
    {
        var generateResult = new GeneratePayPeriodsResult(4, 0, new List<PayPeriodDto>());
        _serviceMock
            .Setup(s => s.GeneratePayPeriodsAsync(null, null, default))
            .ReturnsAsync(Result.Success(generateResult));

        var request = new GeneratePayPeriodsRequest();
        await _controller.Generate(request);

        _serviceMock.Verify(s => s.GeneratePayPeriodsAsync(
            null, null, default), Times.Once);
    }

    [Fact]
    public async Task Generate_ConfigNotFound_Returns400()
    {
        _serviceMock
            .Setup(s => s.GeneratePayPeriodsAsync(null, null, default))
            .ReturnsAsync(Result.Failure<GeneratePayPeriodsResult>(
                "Pay period configuration not found. Please configure pay periods first.",
                "CONFIG_NOT_FOUND"));

        var request = new GeneratePayPeriodsRequest();
        var result = await _controller.Generate(request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Generate_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.GeneratePayPeriodsAsync(null, null, default))
            .ReturnsAsync(Result.Failure<GeneratePayPeriodsResult>("Generation failed", "UNKNOWN"));

        var request = new GeneratePayPeriodsRequest();
        var result = await _controller.Generate(request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Generate_ReturnsGenerationSummary()
    {
        var periods = new List<PayPeriodDto>
        {
            CreateTestDto(Guid.NewGuid()),
            CreateTestDto(Guid.NewGuid()),
            CreateTestDto(Guid.NewGuid())
        };
        var generateResult = new GeneratePayPeriodsResult(
            PeriodsCreated: 3,
            PeriodsSkipped: 2,
            CreatedPeriods: periods);
        _serviceMock
            .Setup(s => s.GeneratePayPeriodsAsync(null, null, default))
            .ReturnsAsync(Result.Success(generateResult));

        var request = new GeneratePayPeriodsRequest();
        var result = await _controller.Generate(request);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var returned = ok.Value.Should().BeOfType<GeneratePayPeriodsResult>().Subject;
        returned.PeriodsCreated.Should().Be(3);
        returned.PeriodsSkipped.Should().Be(2);
        returned.CreatedPeriods.Should().HaveCount(3);
    }

    [Fact]
    public async Task Generate_WithFromDate_PassesToService()
    {
        var fromDate = new DateOnly(2026, 6, 1);
        var generateResult = new GeneratePayPeriodsResult(4, 0, new List<PayPeriodDto>());
        _serviceMock
            .Setup(s => s.GeneratePayPeriodsAsync(fromDate, null, default))
            .ReturnsAsync(Result.Success(generateResult));

        var request = new GeneratePayPeriodsRequest(FromDate: fromDate);
        await _controller.Generate(request);

        _serviceMock.Verify(s => s.GeneratePayPeriodsAsync(
            fromDate, null, default), Times.Once);
    }

    #endregion
}
