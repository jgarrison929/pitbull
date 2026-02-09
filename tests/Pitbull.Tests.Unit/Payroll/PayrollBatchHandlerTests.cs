using FluentAssertions;
using Pitbull.Core.MultiTenancy;
using Pitbull.Payroll.Domain;
using Pitbull.Payroll.Features.CreatePayrollBatch;
using Pitbull.Payroll.Features.GetPayrollBatch;
using Pitbull.Payroll.Features.ApprovePayrollBatch;
using Pitbull.Payroll.Features.PostPayrollBatch;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Payroll;

public class PayrollBatchHandlerTests
{
    private PayPeriod CreateTestPeriod(Guid tenantId) => new()
    {
        Id = Guid.NewGuid(), TenantId = tenantId,
        StartDate = DateOnly.FromDateTime(DateTime.UtcNow), EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(6)),
        PayDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10)), Frequency = PayFrequency.Weekly,
        Status = PayPeriodStatus.Open, CreatedAt = DateTime.UtcNow
    };

    [Fact]
    public async Task CreatePayrollBatch_ValidCommand_CreatesBatch()
    {
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        var period = CreateTestPeriod(tenantContext.TenantId);
        context.Set<PayPeriod>().Add(period);
        await context.SaveChangesAsync();

        var handler = new CreatePayrollBatchHandler(context, tenantContext);
        var command = new CreatePayrollBatchCommand(PayPeriodId: period.Id, Notes: "Test batch");

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("Draft");
        result.Value.BatchNumber.Should().StartWith(period.EndDate.ToString("yyyyMMdd"));
    }

    [Fact]
    public async Task CreatePayrollBatch_ClosedPeriod_ReturnsFailure()
    {
        using var context = TestDbContextFactory.Create();
        var tenantContext = new TenantContext { TenantId = TestDbContextFactory.TestTenantId };
        var period = CreateTestPeriod(tenantContext.TenantId);
        period.Status = PayPeriodStatus.Closed;
        context.Set<PayPeriod>().Add(period);
        await context.SaveChangesAsync();

        var handler = new CreatePayrollBatchHandler(context, tenantContext);
        var result = await handler.Handle(new CreatePayrollBatchCommand(period.Id, null), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("PERIOD_CLOSED");
    }

    [Fact]
    public async Task GetPayrollBatch_ExistingBatch_ReturnsBatch()
    {
        using var context = TestDbContextFactory.Create();
        var period = CreateTestPeriod(TestDbContextFactory.TestTenantId);
        context.Set<PayPeriod>().Add(period);
        
        var batch = new PayrollBatch
        {
            Id = Guid.NewGuid(), TenantId = TestDbContextFactory.TestTenantId,
            PayPeriodId = period.Id, BatchNumber = "20260209-01",
            Status = PayrollBatchStatus.Draft, CreatedAt = DateTime.UtcNow
        };
        context.Set<PayrollBatch>().Add(batch);
        await context.SaveChangesAsync();

        var handler = new GetPayrollBatchHandler(context);
        var result = await handler.Handle(new GetPayrollBatchQuery(batch.Id), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.BatchNumber.Should().Be("20260209-01");
    }

    [Fact]
    public async Task ApprovePayrollBatch_CalculatedBatch_ApprovesBatch()
    {
        using var context = TestDbContextFactory.Create();
        var period = CreateTestPeriod(TestDbContextFactory.TestTenantId);
        context.Set<PayPeriod>().Add(period);
        
        var batch = new PayrollBatch
        {
            Id = Guid.NewGuid(), TenantId = TestDbContextFactory.TestTenantId,
            PayPeriodId = period.Id, BatchNumber = "20260209-01",
            Status = PayrollBatchStatus.Calculated, CreatedAt = DateTime.UtcNow
        };
        context.Set<PayrollBatch>().Add(batch);
        await context.SaveChangesAsync();

        var handler = new ApprovePayrollBatchHandler(context);
        var result = await handler.Handle(new ApprovePayrollBatchCommand(batch.Id, "approver@test.com"), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("Approved");
    }

    [Fact]
    public async Task PostPayrollBatch_ApprovedBatch_PostsBatch()
    {
        using var context = TestDbContextFactory.Create();
        var period = CreateTestPeriod(TestDbContextFactory.TestTenantId);
        context.Set<PayPeriod>().Add(period);
        
        var batch = new PayrollBatch
        {
            Id = Guid.NewGuid(), TenantId = TestDbContextFactory.TestTenantId,
            PayPeriodId = period.Id, BatchNumber = "20260209-01",
            Status = PayrollBatchStatus.Approved, CreatedAt = DateTime.UtcNow
        };
        context.Set<PayrollBatch>().Add(batch);
        await context.SaveChangesAsync();

        var handler = new PostPayrollBatchHandler(context);
        var result = await handler.Handle(new PostPayrollBatchCommand(batch.Id, "poster@test.com"), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("Posted");
    }
}
