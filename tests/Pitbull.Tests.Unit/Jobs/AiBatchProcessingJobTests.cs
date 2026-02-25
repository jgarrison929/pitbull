using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Api.Jobs;
using Pitbull.Core.Jobs;
using Pitbull.Core.MultiTenancy;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Jobs;

public class AiBatchProcessingJobTests
{
    private static readonly Guid TenantId = TestDbContextFactory.TestTenantId;
    private static readonly Guid CompanyId = TestDbContextFactory.TestCompanyId;

    private static JobContext CreateJobContext() => new()
    {
        TenantId = TenantId,
        CompanyId = CompanyId,
        UserId = "test-user"
    };

    [Fact]
    public async Task RunOperationAsync_CostToCompleteRecalc_SucceedsWithNoProjects()
    {
        using var db = TestDbContextFactory.Create();

        var job = new AiBatchProcessingJob(
            new TenantContext(), new CompanyContext(),
            db, NullLogger<AiBatchProcessingJob>.Instance);

        var result = await job.RunOperationAsync(
            CreateJobContext(),
            new AiBatchParams { OperationType = AiBatchOperationType.CostToCompleteRecalc },
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task RunOperationAsync_CostToCompleteRecalc_ProcessesActiveProjects()
    {
        using var db = TestDbContextFactory.Create();
        var projectId = Guid.NewGuid();
        await TestDbContextFactory.SeedProjectAsync(db, projectId);

        var job = new AiBatchProcessingJob(
            new TenantContext(), new CompanyContext(),
            db, NullLogger<AiBatchProcessingJob>.Instance);

        var result = await job.RunOperationAsync(
            CreateJobContext(),
            new AiBatchParams
            {
                OperationType = AiBatchOperationType.CostToCompleteRecalc,
                ProjectId = projectId
            },
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task RunOperationAsync_DailyBriefing_SucceedsWithNoProjects()
    {
        using var db = TestDbContextFactory.Create();

        var job = new AiBatchProcessingJob(
            new TenantContext(), new CompanyContext(),
            db, NullLogger<AiBatchProcessingJob>.Instance);

        var result = await job.RunOperationAsync(
            CreateJobContext(),
            new AiBatchParams { OperationType = AiBatchOperationType.DailyBriefingGeneration },
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task RunOperationAsync_SetsTenantContext()
    {
        using var db = TestDbContextFactory.Create();
        var tenantContext = new TenantContext();
        var companyContext = new CompanyContext();

        var job = new AiBatchProcessingJob(
            tenantContext, companyContext,
            db, NullLogger<AiBatchProcessingJob>.Instance);

        await job.RunOperationAsync(
            CreateJobContext(),
            new AiBatchParams { OperationType = AiBatchOperationType.DailyBriefingGeneration },
            CancellationToken.None);

        tenantContext.TenantId.Should().Be(TenantId);
        companyContext.CompanyId.Should().Be(CompanyId);
    }

    [Fact]
    public void InheritsFromBackgroundJobBase()
    {
        typeof(AiBatchProcessingJob).BaseType.Should().Be(typeof(BackgroundJobBase));
    }
}
