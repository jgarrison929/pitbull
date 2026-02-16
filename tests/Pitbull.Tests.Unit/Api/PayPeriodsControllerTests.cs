using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Core.CQRS;
using Pitbull.TimeTracking.Domain;
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

    private static PayPeriodDto CreateTestDto(Guid? id = null) => new()
    {
        Id = id ?? TestId,
        StartDate = new DateOnly(2026, 2, 9),
        EndDate = new DateOnly(2026, 2, 15),
        Status = PayPeriodStatus.Open,
        LockedAt = null,
        LockedById = null,
        LockedByName = null,
        Notes = null,
        ProcessedAt = null,
        ProcessedById = null,
        ProcessedByName = null,
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
            .Setup(s => s.ListPayPeriodsAsync(null, null, null, 1, 25, default))
            .ReturnsAsync(Result.Success(pagedResult));

        var result = await _controller.List(null, null, null);

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
                new DateOnly(2026, 1, 1),
                new DateOnly(2026, 3, 31),
                2, 50, default))
            .ReturnsAsync(Result.Success(pagedResult));

        await _controller.List(
            PayPeriodStatus.Locked,
            new DateOnly(2026, 1, 1),
            new DateOnly(2026, 3, 31),
            2, 50);

        _serviceMock.Verify(s => s.ListPayPeriodsAsync(
            PayPeriodStatus.Locked,
            new DateOnly(2026, 1, 1),
            new DateOnly(2026, 3, 31),
            2, 50, default), Times.Once);
    }

    [Fact]
    public async Task List_DefaultPagination_PassesDefaults()
    {
        var pagedResult = new PagedResult<PayPeriodDto>(
            Array.Empty<PayPeriodDto>(), 0, 1, 25);
        _serviceMock
            .Setup(s => s.ListPayPeriodsAsync(null, null, null, 1, 25, default))
            .ReturnsAsync(Result.Success(pagedResult));

        await _controller.List(null, null, null);

        _serviceMock.Verify(s => s.ListPayPeriodsAsync(
            null, null, null, 1, 25, default), Times.Once);
    }

    [Fact]
    public async Task List_NullFilters_PassesNullToService()
    {
        var pagedResult = new PagedResult<PayPeriodDto>(
            Array.Empty<PayPeriodDto>(), 0, 1, 25);
        _serviceMock
            .Setup(s => s.ListPayPeriodsAsync(null, null, null, 1, 25, default))
            .ReturnsAsync(Result.Success(pagedResult));

        await _controller.List(null, null, null);

        _serviceMock.Verify(s => s.ListPayPeriodsAsync(
            null, null, null, 1, 25, default), Times.Once);
    }

    [Fact]
    public async Task List_Error_Returns400()
    {
        _serviceMock
            .Setup(s => s.ListPayPeriodsAsync(null, null, null, 1, 25, default))
            .ReturnsAsync(Result.Failure<PagedResult<PayPeriodDto>>("Invalid query"));

        var result = await _controller.List(null, null, null);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task List_EmptyResults_Returns200WithEmptyList()
    {
        var pagedResult = new PagedResult<PayPeriodDto>(
            Array.Empty<PayPeriodDto>(), 0, 1, 25);
        _serviceMock
            .Setup(s => s.ListPayPeriodsAsync(null, null, null, 1, 25, default))
            .ReturnsAsync(Result.Success(pagedResult));

        var result = await _controller.List(null, null, null);

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
                PayPeriodStatus.Processed, null, null, 1, 25, default))
            .ReturnsAsync(Result.Success(pagedResult));

        await _controller.List(PayPeriodStatus.Processed, null, null);

        _serviceMock.Verify(s => s.ListPayPeriodsAsync(
            PayPeriodStatus.Processed, null, null, 1, 25, default), Times.Once);
    }

    [Fact]
    public async Task List_FilterByDateRange_PassesToService()
    {
        var pagedResult = new PagedResult<PayPeriodDto>(
            Array.Empty<PayPeriodDto>(), 0, 1, 25);
        var from = new DateOnly(2026, 1, 1);
        var to = new DateOnly(2026, 6, 30);
        _serviceMock
            .Setup(s => s.ListPayPeriodsAsync(null, from, to, 1, 25, default))
            .ReturnsAsync(Result.Success(pagedResult));

        await _controller.List(null, from, to);

        _serviceMock.Verify(s => s.ListPayPeriodsAsync(
            null, from, to, 1, 25, default), Times.Once);
    }

    #endregion

    #region GetCurrent

    [Fact]
    public async Task GetCurrent_Success_Returns200()
    {
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.GetCurrentPayPeriodAsync(null, default))
            .ReturnsAsync(Result.Success(dto));

        var result = await _controller.GetCurrent(null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(dto);
    }

    [Fact]
    public async Task GetCurrent_WithDate_PassesDateToService()
    {
        var date = new DateOnly(2026, 3, 15);
        var dto = CreateTestDto();
        _serviceMock
            .Setup(s => s.GetCurrentPayPeriodAsync(date, default))
            .ReturnsAsync(Result.Success(dto));

        await _controller.GetCurrent(date);

        _serviceMock.Verify(s => s.GetCurrentPayPeriodAsync(date, default), Times.Once);
    }

    [Fact]
    public async Task GetCurrent_NullDate_PassesNullToService()
    {
        _serviceMock
            .Setup(s => s.GetCurrentPayPeriodAsync(null, default))
            .ReturnsAsync(Result.Success(CreateTestDto()));

        await _controller.GetCurrent(null);

        _serviceMock.Verify(s => s.GetCurrentPayPeriodAsync(null, default), Times.Once);
    }

    [Fact]
    public async Task GetCurrent_Error_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetCurrentPayPeriodAsync(null, default))
            .ReturnsAsync(Result.Failure<PayPeriodDto>("Request failed"));

        var result = await _controller.GetCurrent(null);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task GetCurrent_ReturnsFullDtoFields()
    {
        var dto = CreateTestDto() with
        {
            Status = PayPeriodStatus.Locked,
            LockedAt = new DateTime(2026, 2, 16, 8, 0, 0, DateTimeKind.Utc),
            LockedById = TestLockedById,
            LockedByName = "John Admin",
            Notes = "End of sprint lock"
        };
        _serviceMock
            .Setup(s => s.GetCurrentPayPeriodAsync(null, default))
            .ReturnsAsync(Result.Success(dto));

        var result = await _controller.GetCurrent(null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var returned = ok.Value.Should().BeOfType<PayPeriodDto>().Subject;
        returned.Id.Should().Be(TestId);
        returned.StartDate.Should().Be(new DateOnly(2026, 2, 9));
        returned.EndDate.Should().Be(new DateOnly(2026, 2, 15));
        returned.Status.Should().Be(PayPeriodStatus.Locked);
        returned.LockedAt.Should().NotBeNull();
        returned.LockedById.Should().Be(TestLockedById);
        returned.LockedByName.Should().Be("John Admin");
        returned.Notes.Should().Be("End of sprint lock");
    }

    #endregion

    #region Lock

    [Fact]
    public async Task Lock_Success_Returns200()
    {
        var dto = CreateTestDto() with { Status = PayPeriodStatus.Locked };
        _serviceMock
            .Setup(s => s.LockPayPeriodAsync(TestId, TestLockedById, "Payroll processing", default))
            .ReturnsAsync(Result.Success(dto));

        var request = new LockPayPeriodRequest(TestLockedById, "Payroll processing");
        var result = await _controller.Lock(TestId, request);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(dto);
    }

    [Fact]
    public async Task Lock_NotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.LockPayPeriodAsync(TestId, TestLockedById, null, default))
            .ReturnsAsync(Result.Failure<PayPeriodDto>("Pay period not found", "NOT_FOUND"));

        var request = new LockPayPeriodRequest(TestLockedById);
        var result = await _controller.Lock(TestId, request);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Lock_AlreadyLocked_Returns400()
    {
        _serviceMock
            .Setup(s => s.LockPayPeriodAsync(TestId, TestLockedById, null, default))
            .ReturnsAsync(Result.Failure<PayPeriodDto>("Pay period is already locked", "ALREADY_LOCKED"));

        var request = new LockPayPeriodRequest(TestLockedById);
        var result = await _controller.Lock(TestId, request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Lock_PassesAllFieldsToService()
    {
        var lockedById = Guid.NewGuid();
        _serviceMock
            .Setup(s => s.LockPayPeriodAsync(TestId, lockedById, "Quarter end lock", default))
            .ReturnsAsync(Result.Success(CreateTestDto()));

        var request = new LockPayPeriodRequest(lockedById, "Quarter end lock");
        await _controller.Lock(TestId, request);

        _serviceMock.Verify(s => s.LockPayPeriodAsync(
            TestId, lockedById, "Quarter end lock", default), Times.Once);
    }

    [Fact]
    public async Task Lock_NullNotes_PassesNullToService()
    {
        _serviceMock
            .Setup(s => s.LockPayPeriodAsync(TestId, TestLockedById, null, default))
            .ReturnsAsync(Result.Success(CreateTestDto()));

        var request = new LockPayPeriodRequest(TestLockedById, null);
        await _controller.Lock(TestId, request);

        _serviceMock.Verify(s => s.LockPayPeriodAsync(
            TestId, TestLockedById, null, default), Times.Once);
    }

    [Fact]
    public async Task Lock_OtherError_Returns400()
    {
        _serviceMock
            .Setup(s => s.LockPayPeriodAsync(TestId, TestLockedById, null, default))
            .ReturnsAsync(Result.Failure<PayPeriodDto>("Unknown error", "UNKNOWN"));

        var request = new LockPayPeriodRequest(TestLockedById);
        var result = await _controller.Lock(TestId, request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Lock_ReturnsLockedDto()
    {
        var dto = CreateTestDto() with
        {
            Status = PayPeriodStatus.Locked,
            LockedAt = DateTime.UtcNow,
            LockedById = TestLockedById,
            LockedByName = "Admin User",
            Notes = "End of period"
        };
        _serviceMock
            .Setup(s => s.LockPayPeriodAsync(TestId, TestLockedById, "End of period", default))
            .ReturnsAsync(Result.Success(dto));

        var request = new LockPayPeriodRequest(TestLockedById, "End of period");
        var result = await _controller.Lock(TestId, request);

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
        var dto = CreateTestDto() with { Status = PayPeriodStatus.Open };
        _serviceMock
            .Setup(s => s.UnlockPayPeriodAsync(TestId, unlockedById, "Correction needed", default))
            .ReturnsAsync(Result.Success(dto));

        var request = new UnlockPayPeriodRequest(unlockedById, "Correction needed");
        var result = await _controller.Unlock(TestId, request);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(dto);
    }

    [Fact]
    public async Task Unlock_NotFound_Returns404()
    {
        var unlockedById = Guid.NewGuid();
        _serviceMock
            .Setup(s => s.UnlockPayPeriodAsync(TestId, unlockedById, "Correction", default))
            .ReturnsAsync(Result.Failure<PayPeriodDto>("Pay period not found", "NOT_FOUND"));

        var request = new UnlockPayPeriodRequest(unlockedById, "Correction");
        var result = await _controller.Unlock(TestId, request);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Unlock_ReasonRequired_Returns400()
    {
        var unlockedById = Guid.NewGuid();
        _serviceMock
            .Setup(s => s.UnlockPayPeriodAsync(TestId, unlockedById, "", default))
            .ReturnsAsync(Result.Failure<PayPeriodDto>("Reason is required to unlock a pay period", "REASON_REQUIRED"));

        var request = new UnlockPayPeriodRequest(unlockedById, "");
        var result = await _controller.Unlock(TestId, request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Unlock_AlreadyOpen_Returns400()
    {
        var unlockedById = Guid.NewGuid();
        _serviceMock
            .Setup(s => s.UnlockPayPeriodAsync(TestId, unlockedById, "Some reason", default))
            .ReturnsAsync(Result.Failure<PayPeriodDto>("Pay period is already open", "ALREADY_OPEN"));

        var request = new UnlockPayPeriodRequest(unlockedById, "Some reason");
        var result = await _controller.Unlock(TestId, request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Unlock_PassesAllFieldsToService()
    {
        var unlockedById = Guid.NewGuid();
        _serviceMock
            .Setup(s => s.UnlockPayPeriodAsync(TestId, unlockedById, "Employee correction request", default))
            .ReturnsAsync(Result.Success(CreateTestDto()));

        var request = new UnlockPayPeriodRequest(unlockedById, "Employee correction request");
        await _controller.Unlock(TestId, request);

        _serviceMock.Verify(s => s.UnlockPayPeriodAsync(
            TestId, unlockedById, "Employee correction request", default), Times.Once);
    }

    [Fact]
    public async Task Unlock_OtherError_Returns400()
    {
        var unlockedById = Guid.NewGuid();
        _serviceMock
            .Setup(s => s.UnlockPayPeriodAsync(TestId, unlockedById, "Reason", default))
            .ReturnsAsync(Result.Failure<PayPeriodDto>("Unknown error", "UNKNOWN"));

        var request = new UnlockPayPeriodRequest(unlockedById, "Reason");
        var result = await _controller.Unlock(TestId, request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Unlock_ReturnsUnlockedDto()
    {
        var unlockedById = Guid.NewGuid();
        var dto = CreateTestDto() with { Status = PayPeriodStatus.Open };
        _serviceMock
            .Setup(s => s.UnlockPayPeriodAsync(TestId, unlockedById, "Time entry correction", default))
            .ReturnsAsync(Result.Success(dto));

        var request = new UnlockPayPeriodRequest(unlockedById, "Time entry correction");
        var result = await _controller.Unlock(TestId, request);

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
