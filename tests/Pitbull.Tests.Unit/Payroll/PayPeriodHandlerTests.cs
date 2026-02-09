using FluentAssertions;
using Pitbull.Core.MultiTenancy;
using Pitbull.Payroll.Domain;
using Pitbull.Payroll.Features.CreatePayPeriod;
using Pitbull.Payroll.Features.GetPayPeriod;
using Pitbull.Payroll.Features.ClosePayPeriod;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Payroll;

public class PayPeriodHandlerTests
{
    [Fact]
    public async Task CreatePayPeriod_ValidCommand_CreatesPeriod()
    {
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };

        var handler = new CreatePayPeriodHandler(context, tenantContext);
        var command = new CreatePayPeriodCommand(
            StartDate: DateOnly.FromDateTime(DateTime.UtcNow),
            EndDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(6)),
            PayDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10)),
            Frequency: PayFrequency.Weekly,
            Notes: "Week 1 2026"
        );

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Frequency.Should().Be("Weekly");
        result.Value.Status.Should().Be("Open");
    }

    [Fact]
    public async Task CreatePayPeriod_OverlappingPeriod_ReturnsFailure()
    {
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        
        var start = DateOnly.FromDateTime(DateTime.UtcNow);
        var end = start.AddDays(6);
        
        // Add existing period
        context.Set<PayPeriod>().Add(new PayPeriod
        {
            Id = Guid.NewGuid(), TenantId = tenantContext.TenantId,
            StartDate = start, EndDate = end, PayDate = end.AddDays(4),
            Frequency = PayFrequency.Weekly, Status = PayPeriodStatus.Open, CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var handler = new CreatePayPeriodHandler(context, tenantContext);
        var command = new CreatePayPeriodCommand(
            StartDate: start.AddDays(3), // Overlaps!
            EndDate: end.AddDays(7),
            PayDate: end.AddDays(11),
            Frequency: PayFrequency.Weekly,
            Notes: null
        );

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("OVERLAP");
    }

    [Fact]
    public async Task GetPayPeriod_ExistingPeriod_ReturnsPeriod()
    {
        using var context = TestDbContextFactory.Create();
        
        var period = new PayPeriod
        {
            Id = Guid.NewGuid(), TenantId = TestDbContextFactory.TestTenantId,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow), EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(13)),
            PayDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(17)), Frequency = PayFrequency.BiWeekly,
            Status = PayPeriodStatus.Open, CreatedAt = DateTime.UtcNow
        };
        context.Set<PayPeriod>().Add(period);
        await context.SaveChangesAsync();

        var handler = new GetPayPeriodHandler(context);
        var result = await handler.Handle(new GetPayPeriodQuery(period.Id), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Frequency.Should().Be("BiWeekly");
    }

    [Fact]
    public async Task ClosePayPeriod_NoBatches_ClosesPeriod()
    {
        using var context = TestDbContextFactory.Create();
        
        var period = new PayPeriod
        {
            Id = Guid.NewGuid(), TenantId = TestDbContextFactory.TestTenantId,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-7)), EndDate = DateOnly.FromDateTime(DateTime.UtcNow),
            PayDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)), Frequency = PayFrequency.Weekly,
            Status = PayPeriodStatus.Approved, CreatedAt = DateTime.UtcNow
        };
        context.Set<PayPeriod>().Add(period);
        await context.SaveChangesAsync();

        var handler = new ClosePayPeriodHandler(context);
        var result = await handler.Handle(new ClosePayPeriodCommand(period.Id, "admin@test.com"), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("Closed");
    }
}
