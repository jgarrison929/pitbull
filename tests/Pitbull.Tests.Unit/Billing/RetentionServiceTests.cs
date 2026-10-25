using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Billing.Features.Retention;
using Pitbull.Billing.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Tests.Unit.Billing;

public class RetentionServiceTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestCompanyId = Guid.NewGuid();
    private static readonly Guid TestProjectId = Guid.NewGuid();
    private readonly PitbullDbContext _db;
    private readonly RetentionService _service;

    public RetentionServiceTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new() { CompanyId = TestCompanyId };

        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);
        _service = new RetentionService(_db, NullLogger<RetentionService>.Instance);
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    private async Task<RetentionHoldDto> CreateTestHold(
        decimal originalAmount = 100_000m,
        decimal retainagePercent = 10m)
    {
        CreateRetentionHoldCommand command = new(
            ProjectId: TestProjectId,
            ContractId: null,
            OriginalAmount: originalAmount,
            RetainagePercent: retainagePercent,
            Description: "Test hold");

        var result = await _service.CreateHoldAsync(command);
        result.IsSuccess.Should().BeTrue();
        return result.Value!;
    }

    // ── Create Hold ──

    [Fact]
    public async Task CreateHold_ValidInput_CalculatesRetainedAmount()
    {
        var hold = await CreateTestHold(100_000m, 10m);

        hold.OriginalAmount.Should().Be(100_000m);
        hold.RetainedAmount.Should().Be(10_000m);  // 10% of 100K
        hold.ReleasedAmount.Should().Be(0m);
        hold.Status.Should().Be(RetentionHoldStatus.Held);
        hold.RetainagePercent.Should().Be(10m);
    }

    [Fact]
    public async Task CreateHold_ZeroAmount_ReturnsValidationError()
    {
        CreateRetentionHoldCommand command = new(
            ProjectId: TestProjectId,
            ContractId: null,
            OriginalAmount: 0m,
            RetainagePercent: 10m);

        var result = await _service.CreateHoldAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task CreateHold_InvalidRetainagePercent_ReturnsValidationError()
    {
        CreateRetentionHoldCommand command = new(
            ProjectId: TestProjectId,
            ContractId: null,
            OriginalAmount: 100_000m,
            RetainagePercent: 150m);  // > 100%

        var result = await _service.CreateHoldAsync(command);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task CreateHold_WithPolicyMaxAmount_CapsRetained()
    {
        // Create policy with max amount of $5,000
        var policyResult = await _service.CreatePolicyAsync(new CreateRetentionPolicyCommand(
            Name: "Capped Policy",
            PercentageRate: 10m,
            MaxAmount: 5_000m));
        policyResult.IsSuccess.Should().BeTrue();

        // 10% of 100K = 10K, but max is 5K
        CreateRetentionHoldCommand command = new(
            ProjectId: TestProjectId,
            ContractId: null,
            OriginalAmount: 100_000m,
            RetainagePercent: 10m,
            RetentionPolicyId: policyResult.Value!.Id);

        var result = await _service.CreateHoldAsync(command);

        result.IsSuccess.Should().BeTrue();
        result.Value!.RetainedAmount.Should().Be(5_000m);  // Capped
    }

    // ── Release ──

    [Fact]
    public async Task Release_PartialAmount_SetsPartiallyReleasedStatus()
    {
        var hold = await CreateTestHold();

        var result = await _service.ReleaseRetentionAsync(new ReleaseRetentionCommand(
            HoldId: hold.Id,
            ReleaseAmount: 3_000m,
            ReleasedByUserId: Guid.NewGuid()));

        result.IsSuccess.Should().BeTrue();
        result.Value!.ReleasedAmount.Should().Be(3_000m);
        result.Value!.Status.Should().Be(RetentionHoldStatus.PartiallyReleased);
    }

    [Fact]
    public async Task Release_FullAmount_SetsReleasedStatus()
    {
        var hold = await CreateTestHold();

        var result = await _service.ReleaseRetentionAsync(new ReleaseRetentionCommand(
            HoldId: hold.Id,
            ReleaseAmount: 10_000m,
            ReleasedByUserId: Guid.NewGuid()));

        result.IsSuccess.Should().BeTrue();
        result.Value!.ReleasedAmount.Should().Be(10_000m);
        result.Value!.Status.Should().Be(RetentionHoldStatus.Released);
    }

    [Fact]
    public async Task Release_ExceedsRemaining_ReturnsExceedsBalance()
    {
        var hold = await CreateTestHold();

        var result = await _service.ReleaseRetentionAsync(new ReleaseRetentionCommand(
            HoldId: hold.Id,
            ReleaseAmount: 15_000m,  // More than 10K retained
            ReleasedByUserId: Guid.NewGuid()));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("EXCEEDS_BALANCE");
    }

    [Fact]
    public async Task Release_AlreadyFullyReleased_ReturnsInvalidStatus()
    {
        var hold = await CreateTestHold();
        // Release everything
        await _service.ReleaseRetentionAsync(new ReleaseRetentionCommand(
            HoldId: hold.Id,
            ReleaseAmount: 10_000m,
            ReleasedByUserId: Guid.NewGuid()));

        // Try to release more
        var result = await _service.ReleaseRetentionAsync(new ReleaseRetentionCommand(
            HoldId: hold.Id,
            ReleaseAmount: 1m,
            ReleasedByUserId: Guid.NewGuid()));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task Release_ZeroAmount_ReturnsValidationError()
    {
        var hold = await CreateTestHold();

        var result = await _service.ReleaseRetentionAsync(new ReleaseRetentionCommand(
            HoldId: hold.Id,
            ReleaseAmount: 0m,
            ReleasedByUserId: Guid.NewGuid()));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task Release_MultiplePartialReleases_AccumulatesCorrectly()
    {
        var hold = await CreateTestHold(); // 10K retained

        // First release: 3K
        var r1 = await _service.ReleaseRetentionAsync(new ReleaseRetentionCommand(
            HoldId: hold.Id,
            ReleaseAmount: 3_000m,
            ReleasedByUserId: Guid.NewGuid()));
        r1.IsSuccess.Should().BeTrue();
        r1.Value!.ReleasedAmount.Should().Be(3_000m);
        r1.Value!.Status.Should().Be(RetentionHoldStatus.PartiallyReleased);

        // Second release: 5K
        var r2 = await _service.ReleaseRetentionAsync(new ReleaseRetentionCommand(
            HoldId: hold.Id,
            ReleaseAmount: 5_000m,
            ReleasedByUserId: Guid.NewGuid()));
        r2.IsSuccess.Should().BeTrue();
        r2.Value!.ReleasedAmount.Should().Be(8_000m);
        r2.Value!.Status.Should().Be(RetentionHoldStatus.PartiallyReleased);

        // Third release: remaining 2K
        var r3 = await _service.ReleaseRetentionAsync(new ReleaseRetentionCommand(
            HoldId: hold.Id,
            ReleaseAmount: 2_000m,
            ReleasedByUserId: Guid.NewGuid()));
        r3.IsSuccess.Should().BeTrue();
        r3.Value!.ReleasedAmount.Should().Be(10_000m);
        r3.Value!.Status.Should().Be(RetentionHoldStatus.Released);
    }

    [Fact]
    public async Task Release_SecondExceedsRemaining_ReturnsExceedsBalance()
    {
        var hold = await CreateTestHold(); // 10K retained

        // First release: 8K
        await _service.ReleaseRetentionAsync(new ReleaseRetentionCommand(
            HoldId: hold.Id,
            ReleaseAmount: 8_000m,
            ReleasedByUserId: Guid.NewGuid()));

        // Second release: 5K (only 2K remaining)
        var result = await _service.ReleaseRetentionAsync(new ReleaseRetentionCommand(
            HoldId: hold.Id,
            ReleaseAmount: 5_000m,
            ReleasedByUserId: Guid.NewGuid()));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("EXCEEDS_BALANCE");
    }

    // ── Policies ──

    [Fact]
    public async Task CreatePolicy_ValidInput_Succeeds()
    {
        var result = await _service.CreatePolicyAsync(new CreateRetentionPolicyCommand(
            Name: "Standard 10%",
            PercentageRate: 10m));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Name.Should().Be("Standard 10%");
        result.Value!.PercentageRate.Should().Be(10m);
    }

    [Fact]
    public async Task CreatePolicy_DuplicateName_ReturnsDuplicate()
    {
        await _service.CreatePolicyAsync(new CreateRetentionPolicyCommand(
            Name: "Standard 10%",
            PercentageRate: 10m));

        var result = await _service.CreatePolicyAsync(new CreateRetentionPolicyCommand(
            Name: "Standard 10%",
            PercentageRate: 5m));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("DUPLICATE");
    }

    [Fact]
    public async Task DeletePolicy_WithHolds_ReturnsHasDependencies()
    {
        var policy = await _service.CreatePolicyAsync(new CreateRetentionPolicyCommand(
            Name: "Test Policy",
            PercentageRate: 5m));
        policy.IsSuccess.Should().BeTrue();

        // Create a hold using this policy
        await _service.CreateHoldAsync(new CreateRetentionHoldCommand(
            ProjectId: TestProjectId,
            ContractId: null,
            OriginalAmount: 50_000m,
            RetainagePercent: 5m,
            RetentionPolicyId: policy.Value!.Id));

        var result = await _service.DeletePolicyAsync(policy.Value!.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("HAS_DEPENDENCIES");
    }
}
