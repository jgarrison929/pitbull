using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Billing.Features.Aging;
using Pitbull.Core.CQRS;

namespace Pitbull.Tests.Unit.Api;

public class AgingReportsControllerTests
{
    private readonly Mock<IAgingReportService> _serviceMock = new();
    private readonly AgingReportsController _controller;

    private static readonly DateOnly TestDate = new(2026, 2, 19);

    public AgingReportsControllerTests()
    {
        _controller = new AgingReportsController(_serviceMock.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };
    }

    // ── Test data factories ──

    private static AgingBuckets CreateBuckets(
        decimal current = 10000, decimal d1to30 = 5000, decimal d31to60 = 3000,
        decimal d61to90 = 2000, decimal d90plus = 1000)
        => new(current, d1to30, d31to60, d61to90, d90plus,
            current + d1to30 + d31to60 + d61to90 + d90plus);

    private static VendorAgingResult CreateVendorResult() => new(
        Summary: CreateBuckets(),
        Vendors:
        [
            new VendorAgingLineItem(Guid.NewGuid(), "ABC Concrete", "ABC", 3,
                5000, 2000, 1500, 1000, 500, 10000),
            new VendorAgingLineItem(Guid.NewGuid(), "XYZ Electrical", "XYZ", 2,
                5000, 3000, 1500, 1000, 500, 11000),
        ],
        AsOfDate: TestDate
    );

    private static CustomerAgingResult CreateCustomerResult() => new(
        Summary: CreateBuckets(20000, 8000, 5000, 3000, 2000),
        Projects:
        [
            new CustomerAgingLineItem(Guid.NewGuid(), "City Hall Renovation", "PRJ-001", 2,
                12000, 5000, 3000, 2000, 1000, 23000),
            new CustomerAgingLineItem(Guid.NewGuid(), "School Addition", "PRJ-002", 1,
                8000, 3000, 2000, 1000, 1000, 15000),
        ],
        AsOfDate: TestDate
    );

    private static AgingSummaryResult CreateSummaryResult() => new(
        AccountsPayable: CreateBuckets(),
        AccountsReceivable: CreateBuckets(20000, 8000, 5000, 3000, 2000),
        NetPosition: 17000m,
        AsOfDate: TestDate
    );

    // ═══════════════════════════════════════════════
    //  GET /api/aging-reports/vendors
    // ═══════════════════════════════════════════════

    #region Vendor Aging

    [Fact]
    public async Task GetVendorAging_Success_Returns200()
    {
        var expected = CreateVendorResult();
        _serviceMock
            .Setup(s => s.GetVendorAgingAsync(null, default))
            .ReturnsAsync(Result.Success(expected));

        var result = await _controller.GetVendorAging(null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.StatusCode.Should().Be(200);
        ok.Value.Should().Be(expected);
    }

    [Fact]
    public async Task GetVendorAging_WithAsOfDate_PassesDateToService()
    {
        var date = new DateOnly(2026, 1, 31);
        var expected = CreateVendorResult();
        _serviceMock
            .Setup(s => s.GetVendorAgingAsync(date, default))
            .ReturnsAsync(Result.Success(expected));

        var result = await _controller.GetVendorAging(date);

        result.Should().BeOfType<OkObjectResult>();
        _serviceMock.Verify(s => s.GetVendorAgingAsync(date, default), Times.Once);
    }

    [Fact]
    public async Task GetVendorAging_ServiceError_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetVendorAgingAsync(null, default))
            .ReturnsAsync(Result.Failure<VendorAgingResult>(
                "Failed to generate vendor aging report", "DATABASE_ERROR"));

        var result = await _controller.GetVendorAging(null);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task GetVendorAging_ReturnsSummaryWithBuckets()
    {
        var expected = CreateVendorResult();
        _serviceMock
            .Setup(s => s.GetVendorAgingAsync(null, default))
            .ReturnsAsync(Result.Success(expected));

        var result = await _controller.GetVendorAging(null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var aging = ok.Value.Should().BeOfType<VendorAgingResult>().Subject;
        aging.Summary.Current.Should().Be(10000);
        aging.Summary.Days1To30.Should().Be(5000);
        aging.Summary.Days31To60.Should().Be(3000);
        aging.Summary.Days61To90.Should().Be(2000);
        aging.Summary.Days90Plus.Should().Be(1000);
        aging.Summary.Total.Should().Be(21000);
    }

    [Fact]
    public async Task GetVendorAging_ReturnsVendorBreakdown()
    {
        var expected = CreateVendorResult();
        _serviceMock
            .Setup(s => s.GetVendorAgingAsync(null, default))
            .ReturnsAsync(Result.Success(expected));

        var result = await _controller.GetVendorAging(null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var aging = ok.Value.Should().BeOfType<VendorAgingResult>().Subject;
        aging.Vendors.Should().HaveCount(2);
        aging.Vendors[0].VendorName.Should().Be("ABC Concrete");
        aging.Vendors[1].VendorCode.Should().Be("XYZ");
    }

    [Fact]
    public async Task GetVendorAging_ReturnsAsOfDate()
    {
        var expected = CreateVendorResult();
        _serviceMock
            .Setup(s => s.GetVendorAgingAsync(null, default))
            .ReturnsAsync(Result.Success(expected));

        var result = await _controller.GetVendorAging(null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var aging = ok.Value.Should().BeOfType<VendorAgingResult>().Subject;
        aging.AsOfDate.Should().Be(TestDate);
    }

    #endregion

    // ═══════════════════════════════════════════════
    //  GET /api/aging-reports/customers
    // ═══════════════════════════════════════════════

    #region Customer Aging

    [Fact]
    public async Task GetCustomerAging_Success_Returns200()
    {
        var expected = CreateCustomerResult();
        _serviceMock
            .Setup(s => s.GetCustomerAgingAsync(null, default))
            .ReturnsAsync(Result.Success(expected));

        var result = await _controller.GetCustomerAging(null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.StatusCode.Should().Be(200);
        ok.Value.Should().Be(expected);
    }

    [Fact]
    public async Task GetCustomerAging_WithAsOfDate_PassesDateToService()
    {
        var date = new DateOnly(2026, 1, 15);
        var expected = CreateCustomerResult();
        _serviceMock
            .Setup(s => s.GetCustomerAgingAsync(date, default))
            .ReturnsAsync(Result.Success(expected));

        var result = await _controller.GetCustomerAging(date);

        result.Should().BeOfType<OkObjectResult>();
        _serviceMock.Verify(s => s.GetCustomerAgingAsync(date, default), Times.Once);
    }

    [Fact]
    public async Task GetCustomerAging_ServiceError_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetCustomerAgingAsync(null, default))
            .ReturnsAsync(Result.Failure<CustomerAgingResult>(
                "Failed to generate customer aging report", "DATABASE_ERROR"));

        var result = await _controller.GetCustomerAging(null);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task GetCustomerAging_ReturnsSummaryWithBuckets()
    {
        var expected = CreateCustomerResult();
        _serviceMock
            .Setup(s => s.GetCustomerAgingAsync(null, default))
            .ReturnsAsync(Result.Success(expected));

        var result = await _controller.GetCustomerAging(null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var aging = ok.Value.Should().BeOfType<CustomerAgingResult>().Subject;
        aging.Summary.Current.Should().Be(20000);
        aging.Summary.Total.Should().Be(38000);
    }

    [Fact]
    public async Task GetCustomerAging_ReturnsProjectBreakdown()
    {
        var expected = CreateCustomerResult();
        _serviceMock
            .Setup(s => s.GetCustomerAgingAsync(null, default))
            .ReturnsAsync(Result.Success(expected));

        var result = await _controller.GetCustomerAging(null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var aging = ok.Value.Should().BeOfType<CustomerAgingResult>().Subject;
        aging.Projects.Should().HaveCount(2);
        aging.Projects[0].ProjectName.Should().Be("City Hall Renovation");
        aging.Projects[0].ProjectNumber.Should().Be("PRJ-001");
        aging.Projects[0].ApplicationCount.Should().Be(2);
    }

    #endregion

    // ═══════════════════════════════════════════════
    //  GET /api/aging-reports/summary
    // ═══════════════════════════════════════════════

    #region Summary

    [Fact]
    public async Task GetSummary_Success_Returns200()
    {
        var expected = CreateSummaryResult();
        _serviceMock
            .Setup(s => s.GetAgingSummaryAsync(null, default))
            .ReturnsAsync(Result.Success(expected));

        var result = await _controller.GetSummary(null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.StatusCode.Should().Be(200);
        ok.Value.Should().Be(expected);
    }

    [Fact]
    public async Task GetSummary_WithAsOfDate_PassesDateToService()
    {
        var date = new DateOnly(2025, 12, 31);
        var expected = CreateSummaryResult();
        _serviceMock
            .Setup(s => s.GetAgingSummaryAsync(date, default))
            .ReturnsAsync(Result.Success(expected));

        var result = await _controller.GetSummary(date);

        result.Should().BeOfType<OkObjectResult>();
        _serviceMock.Verify(s => s.GetAgingSummaryAsync(date, default), Times.Once);
    }

    [Fact]
    public async Task GetSummary_ServiceError_Returns400()
    {
        _serviceMock
            .Setup(s => s.GetAgingSummaryAsync(null, default))
            .ReturnsAsync(Result.Failure<AgingSummaryResult>(
                "Failed to generate aging summary", "DATABASE_ERROR"));

        var result = await _controller.GetSummary(null);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task GetSummary_ReturnsNetPosition()
    {
        var expected = CreateSummaryResult();
        _serviceMock
            .Setup(s => s.GetAgingSummaryAsync(null, default))
            .ReturnsAsync(Result.Success(expected));

        var result = await _controller.GetSummary(null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var summary = ok.Value.Should().BeOfType<AgingSummaryResult>().Subject;
        summary.NetPosition.Should().Be(17000m);
    }

    [Fact]
    public async Task GetSummary_ReturnsBothApAndAr()
    {
        var expected = CreateSummaryResult();
        _serviceMock
            .Setup(s => s.GetAgingSummaryAsync(null, default))
            .ReturnsAsync(Result.Success(expected));

        var result = await _controller.GetSummary(null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var summary = ok.Value.Should().BeOfType<AgingSummaryResult>().Subject;
        summary.AccountsPayable.Total.Should().Be(21000);
        summary.AccountsReceivable.Total.Should().Be(38000);
        summary.AsOfDate.Should().Be(TestDate);
    }

    #endregion
}
