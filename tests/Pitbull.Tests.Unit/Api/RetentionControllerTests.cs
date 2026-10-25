using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Api.Controllers;
using Pitbull.Billing.Features.Retention;
using Pitbull.Billing.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Tests.Unit.Api;

public class RetentionControllerTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestUserId = Guid.NewGuid();
    private readonly PitbullDbContext _db;
    private readonly RetentionController _controller;

    public RetentionControllerTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new();

        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);
        IRetentionService service = new RetentionService(_db, NullLogger<RetentionService>.Instance);

        var claims = new[] { new Claim(ClaimTypes.NameIdentifier, TestUserId.ToString()) };
        var identity = new ClaimsIdentity(claims, "Test");

        _controller = new RetentionController(service)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
            }
        };
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    // ── Seed helpers ──

    private async Task<RetentionPolicy> SeedPolicy(
        string name = "Standard 10%",
        decimal rate = 10m,
        decimal? maxAmount = null,
        bool isDefault = false)
    {
        RetentionPolicy policy = new()
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            CompanyId = Guid.NewGuid(),
            Name = name,
            PercentageRate = rate,
            MaxAmount = maxAmount,
            AppliesTo = RetentionAppliesTo.Both,
            IsDefault = isDefault,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        _db.Set<RetentionPolicy>().Add(policy);
        await _db.SaveChangesAsync();
        return policy;
    }

    private async Task<RetentionHold> SeedHold(
        decimal originalAmount = 100_000m,
        decimal retainedAmount = 10_000m,
        decimal releasedAmount = 0m,
        RetentionHoldStatus status = RetentionHoldStatus.Held)
    {
        RetentionHold hold = new()
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            CompanyId = Guid.NewGuid(),
            ProjectId = Guid.NewGuid(),
            OriginalAmount = originalAmount,
            RetainedAmount = retainedAmount,
            ReleasedAmount = releasedAmount,
            RetainagePercent = 10m,
            Status = status,
            EffectiveDate = DateOnly.FromDateTime(DateTime.UtcNow),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        _db.Set<RetentionHold>().Add(hold);
        await _db.SaveChangesAsync();
        return hold;
    }

    // ── Policy Tests ──

    [Fact]
    public async Task ListPolicies_ReturnsOk()
    {
        await SeedPolicy();

        IActionResult result = await _controller.ListPolicies(null);

        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ListRetentionPoliciesResult payload = ok.Value.Should().BeOfType<ListRetentionPoliciesResult>().Subject;
        payload.TotalCount.Should().Be(1);
        payload.Items.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetPolicy_NotFound_Returns404()
    {
        IActionResult result = await _controller.GetPolicy(Guid.NewGuid());

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetPolicy_Found_ReturnsPolicy()
    {
        RetentionPolicy seeded = await SeedPolicy();

        IActionResult result = await _controller.GetPolicy(seeded.Id);

        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        RetentionPolicyDto dto = ok.Value.Should().BeOfType<RetentionPolicyDto>().Subject;
        dto.Name.Should().Be("Standard 10%");
        dto.PercentageRate.Should().Be(10m);
    }

    [Fact]
    public async Task CreatePolicy_ValidRequest_Returns201()
    {
        CreateRetentionPolicyRequest request = new(
            Name: "Custom 5%",
            PercentageRate: 5m,
            AppliesTo: RetentionAppliesTo.Contract);

        IActionResult result = await _controller.CreatePolicy(request);

        CreatedAtActionResult created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        RetentionPolicyDto dto = created.Value.Should().BeOfType<RetentionPolicyDto>().Subject;
        dto.Name.Should().Be("Custom 5%");
        dto.PercentageRate.Should().Be(5m);
    }

    [Fact]
    public async Task CreatePolicy_DuplicateName_ReturnsBadRequest()
    {
        await SeedPolicy("Dup Policy");

        CreateRetentionPolicyRequest request = new(Name: "Dup Policy", PercentageRate: 5m);
        IActionResult result = await _controller.CreatePolicy(request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task CreatePolicy_InvalidRate_ReturnsBadRequest()
    {
        CreateRetentionPolicyRequest request = new(Name: "Bad Rate", PercentageRate: 150m);

        IActionResult result = await _controller.CreatePolicy(request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task UpdatePolicy_Found_ReturnsUpdated()
    {
        RetentionPolicy seeded = await SeedPolicy();
        UpdateRetentionPolicyRequest request = new(Name: "Updated Policy", PercentageRate: 7.5m);

        IActionResult result = await _controller.UpdatePolicy(seeded.Id, request);

        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        RetentionPolicyDto dto = ok.Value.Should().BeOfType<RetentionPolicyDto>().Subject;
        dto.Name.Should().Be("Updated Policy");
        dto.PercentageRate.Should().Be(7.5m);
    }

    [Fact]
    public async Task DeletePolicy_SoftDeletes()
    {
        RetentionPolicy seeded = await SeedPolicy();

        IActionResult deleteResult = await _controller.DeletePolicy(seeded.Id);
        deleteResult.Should().BeOfType<NoContentResult>();

        IActionResult getResult = await _controller.GetPolicy(seeded.Id);
        getResult.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task DeletePolicy_WithHolds_ReturnsBadRequest()
    {
        RetentionPolicy policy = await SeedPolicy();

        RetentionHold hold = new()
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            CompanyId = Guid.NewGuid(),
            ProjectId = Guid.NewGuid(),
            OriginalAmount = 50_000m,
            RetainedAmount = 5_000m,
            RetainagePercent = 10m,
            RetentionPolicyId = policy.Id,
            Status = RetentionHoldStatus.Held,
            EffectiveDate = DateOnly.FromDateTime(DateTime.UtcNow),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };
        _db.Set<RetentionHold>().Add(hold);
        await _db.SaveChangesAsync();

        IActionResult result = await _controller.DeletePolicy(policy.Id);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    // ── Hold Tests ──

    [Fact]
    public async Task ListHolds_ReturnsOkWithSummary()
    {
        await SeedHold(retainedAmount: 10_000m, releasedAmount: 2_000m);

        IActionResult result = await _controller.ListHolds(null, null);

        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ListRetentionHoldsResult payload = ok.Value.Should().BeOfType<ListRetentionHoldsResult>().Subject;
        payload.TotalCount.Should().Be(1);
        payload.TotalRetained.Should().Be(10_000m);
        payload.TotalReleased.Should().Be(2_000m);
    }

    [Fact]
    public async Task GetHold_NotFound_Returns404()
    {
        IActionResult result = await _controller.GetHold(Guid.NewGuid());

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task CreateHold_CalculatesRetainedAmount()
    {
        CreateRetentionHoldRequest request = new(
            ProjectId: Guid.NewGuid(),
            ContractId: null,
            OriginalAmount: 200_000m,
            RetainagePercent: 10m,
            Description: "Phase 1 payment");

        IActionResult result = await _controller.CreateHold(request);

        CreatedAtActionResult created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        RetentionHoldDto dto = created.Value.Should().BeOfType<RetentionHoldDto>().Subject;
        dto.OriginalAmount.Should().Be(200_000m);
        dto.RetainedAmount.Should().Be(20_000m);
        dto.ReleasedAmount.Should().Be(0m);
        dto.Status.Should().Be(RetentionHoldStatus.Held);
    }

    [Fact]
    public async Task CreateHold_WithPolicyCap_CapsRetainedAmount()
    {
        RetentionPolicy policy = await SeedPolicy("Capped", rate: 10m, maxAmount: 5_000m);

        CreateRetentionHoldRequest request = new(
            ProjectId: Guid.NewGuid(),
            ContractId: null,
            OriginalAmount: 200_000m,
            RetainagePercent: 10m,
            RetentionPolicyId: policy.Id);

        IActionResult result = await _controller.CreateHold(request);

        CreatedAtActionResult created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        RetentionHoldDto dto = created.Value.Should().BeOfType<RetentionHoldDto>().Subject;
        dto.RetainedAmount.Should().Be(5_000m);
    }

    // ── Release Tests ──

    [Fact]
    public async Task ReleaseRetention_FullRelease_StatusReleased()
    {
        RetentionHold hold = await SeedHold(retainedAmount: 10_000m, releasedAmount: 0m);

        ReleaseRetentionRequest request = new(ReleaseAmount: 10_000m);
        IActionResult result = await _controller.ReleaseRetention(hold.Id, request);

        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        RetentionHoldDto dto = ok.Value.Should().BeOfType<RetentionHoldDto>().Subject;
        dto.ReleasedAmount.Should().Be(10_000m);
        dto.Status.Should().Be(RetentionHoldStatus.Released);
    }

    [Fact]
    public async Task ReleaseRetention_PartialRelease_StatusPartiallyReleased()
    {
        RetentionHold hold = await SeedHold(retainedAmount: 10_000m, releasedAmount: 0m);

        ReleaseRetentionRequest request = new(ReleaseAmount: 3_000m);
        IActionResult result = await _controller.ReleaseRetention(hold.Id, request);

        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        RetentionHoldDto dto = ok.Value.Should().BeOfType<RetentionHoldDto>().Subject;
        dto.ReleasedAmount.Should().Be(3_000m);
        dto.Status.Should().Be(RetentionHoldStatus.PartiallyReleased);
    }

    [Fact]
    public async Task ReleaseRetention_ExceedsBalance_ReturnsBadRequest()
    {
        RetentionHold hold = await SeedHold(retainedAmount: 10_000m, releasedAmount: 8_000m);

        ReleaseRetentionRequest request = new(ReleaseAmount: 5_000m);
        IActionResult result = await _controller.ReleaseRetention(hold.Id, request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task ReleaseRetention_AlreadyReleased_ReturnsBadRequest()
    {
        RetentionHold hold = await SeedHold(
            retainedAmount: 10_000m,
            releasedAmount: 10_000m,
            status: RetentionHoldStatus.Released);

        ReleaseRetentionRequest request = new(ReleaseAmount: 1_000m);
        IActionResult result = await _controller.ReleaseRetention(hold.Id, request);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task ReleaseRetention_NotFound_Returns404()
    {
        ReleaseRetentionRequest request = new(ReleaseAmount: 1_000m);
        IActionResult result = await _controller.ReleaseRetention(Guid.NewGuid(), request);

        result.Should().BeOfType<NotFoundObjectResult>();
    }
}
