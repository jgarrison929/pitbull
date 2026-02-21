using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Billing.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Projects.Domain;

namespace Pitbull.Tests.Unit.Services;

public class VendorPortalServiceTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestCompanyId = Guid.NewGuid();
    private static readonly Guid TestVendorId = Guid.NewGuid();
    private static readonly Guid TestProjectId = Guid.NewGuid();
    private readonly PitbullDbContext _db;
    private readonly VendorPortalService _service;

    public VendorPortalServiceTests()
    {
        var tenantContext = new TenantContext { TenantId = TestTenantId, TenantName = "Test" };
        var companyContext = new CompanyContext
        {
            CompanyId = TestCompanyId,
            CompanyCode = "01",
            CompanyName = "Test Company"
        };

        var options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);
        _db.Database.EnsureCreated();
        _service = new VendorPortalService(_db, NullLogger<VendorPortalService>.Instance);

        SeedTestData().GetAwaiter().GetResult();
    }

    private async Task SeedTestData()
    {
        // Seed company first (separate save ensures it's committed)
        _db.Companies.Add(new Company
        {
            Id = TestCompanyId,
            TenantId = TestTenantId,
            Code = "01",
            Name = "Test Company",
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        _db.Vendors.Add(new Vendor
        {
            Id = TestVendorId,
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            Name = "ABC Plumbing",
            Code = "V-001",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        });

        _db.Set<Project>().Add(new Project
        {
            Id = TestProjectId,
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            Name = "Downtown Office Tower",
            Number = "PRJ-001",
            Status = ProjectStatus.Active,
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    #region GenerateTokenAsync

    [Fact]
    public async Task GenerateTokenAsync_ValidInput_ReturnsToken()
    {
        var result = await _service.GenerateTokenAsync(TestVendorId, TestProjectId, 90);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Token.Should().NotBeNullOrEmpty();
        result.Value.VendorId.Should().Be(TestVendorId);
        result.Value.ProjectId.Should().Be(TestProjectId);
        result.Value.IsRevoked.Should().BeFalse();
        result.Value.AccessCount.Should().Be(0);
    }

    [Fact]
    public async Task GenerateTokenAsync_TokenIsUrlSafe()
    {
        var result = await _service.GenerateTokenAsync(TestVendorId, TestProjectId, 90);

        result.Value!.Token.Should().NotContain("+");
        result.Value.Token.Should().NotContain("/");
        result.Value.Token.Should().NotContain("=");
    }

    [Fact]
    public async Task GenerateTokenAsync_MultipleTokens_AreUnique()
    {
        var result1 = await _service.GenerateTokenAsync(TestVendorId, TestProjectId, 90);
        var result2 = await _service.GenerateTokenAsync(TestVendorId, TestProjectId, 90);

        result1.Value!.Token.Should().NotBe(result2.Value!.Token);
    }

    [Fact]
    public async Task GenerateTokenAsync_SetsExpirationCorrectly()
    {
        var result = await _service.GenerateTokenAsync(TestVendorId, TestProjectId, 30);

        result.Value!.ExpiresAt.Should().BeCloseTo(
            DateTime.UtcNow.AddDays(30), TimeSpan.FromMinutes(1));
    }

    [Fact]
    public async Task GenerateTokenAsync_InvalidVendor_ReturnsFailure()
    {
        var result = await _service.GenerateTokenAsync(Guid.NewGuid(), TestProjectId, 90);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task GenerateTokenAsync_ExpirationTooShort_ReturnsFailure()
    {
        var result = await _service.GenerateTokenAsync(TestVendorId, TestProjectId, 0);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task GenerateTokenAsync_ExpirationTooLong_ReturnsFailure()
    {
        var result = await _service.GenerateTokenAsync(TestVendorId, TestProjectId, 400);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task GenerateTokenAsync_IncludesVendorName()
    {
        var result = await _service.GenerateTokenAsync(TestVendorId, TestProjectId, 90);

        result.Value!.VendorName.Should().Be("ABC Plumbing");
    }

    #endregion

    #region ValidateTokenAsync

    [Fact]
    public async Task ValidateTokenAsync_ValidToken_ReturnsContext()
    {
        var generated = await _service.GenerateTokenAsync(TestVendorId, TestProjectId, 90);
        var token = generated.Value!.Token;

        var result = await _service.ValidateTokenAsync(token);

        result.IsSuccess.Should().BeTrue();
        result.Value!.VendorId.Should().Be(TestVendorId);
        result.Value.VendorName.Should().Be("ABC Plumbing");
        result.Value.ProjectId.Should().Be(TestProjectId);
        result.Value.ProjectName.Should().Be("Downtown Office Tower");
        result.Value.CompanyName.Should().Be("Test Company");
    }

    [Fact]
    public async Task ValidateTokenAsync_InvalidToken_ReturnsFailure()
    {
        var result = await _service.ValidateTokenAsync("nonexistent-token");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_TOKEN");
    }

    [Fact]
    public async Task ValidateTokenAsync_RevokedToken_ReturnsFailure()
    {
        var generated = await _service.GenerateTokenAsync(TestVendorId, TestProjectId, 90);
        await _service.RevokeTokenAsync(generated.Value!.Id);

        var result = await _service.ValidateTokenAsync(generated.Value.Token);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("TOKEN_REVOKED");
    }

    [Fact]
    public async Task ValidateTokenAsync_ExpiredToken_ReturnsFailure()
    {
        var generated = await _service.GenerateTokenAsync(TestVendorId, TestProjectId, 1);
        var token = generated.Value!.Token;

        // Manually expire the token
        var entity = await _db.VendorPortalTokens.FirstAsync(t => t.Token == token);
        entity.ExpiresAt = DateTime.UtcNow.AddDays(-1);
        await _db.SaveChangesAsync();

        var result = await _service.ValidateTokenAsync(token);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("TOKEN_EXPIRED");
    }

    [Fact]
    public async Task ValidateTokenAsync_IncrementsAccessCount()
    {
        var generated = await _service.GenerateTokenAsync(TestVendorId, TestProjectId, 90);
        var token = generated.Value!.Token;

        await _service.ValidateTokenAsync(token);
        await _service.ValidateTokenAsync(token);

        var entity = await _db.VendorPortalTokens.AsNoTracking()
            .FirstAsync(t => t.Token == token);

        // Each validate call increments access count
        entity.AccessCount.Should().BeGreaterThanOrEqualTo(2);
        entity.LastAccessedAt.Should().NotBeNull();
    }

    #endregion

    #region RevokeTokenAsync

    [Fact]
    public async Task RevokeTokenAsync_ValidToken_Succeeds()
    {
        var generated = await _service.GenerateTokenAsync(TestVendorId, TestProjectId, 90);

        var result = await _service.RevokeTokenAsync(generated.Value!.Id);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task RevokeTokenAsync_AlreadyRevoked_ReturnsFailure()
    {
        var generated = await _service.GenerateTokenAsync(TestVendorId, TestProjectId, 90);
        await _service.RevokeTokenAsync(generated.Value!.Id);

        var result = await _service.RevokeTokenAsync(generated.Value.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_STATUS");
    }

    [Fact]
    public async Task RevokeTokenAsync_NonexistentToken_ReturnsFailure()
    {
        var result = await _service.RevokeTokenAsync(Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region GetTokensForVendorAsync

    [Fact]
    public async Task GetTokensForVendorAsync_ReturnsAllTokens()
    {
        await _service.GenerateTokenAsync(TestVendorId, TestProjectId, 90);
        await _service.GenerateTokenAsync(TestVendorId, TestProjectId, 30);

        var result = await _service.GetTokensForVendorAsync(TestVendorId);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetTokensForVendorAsync_MasksToken()
    {
        var generated = await _service.GenerateTokenAsync(TestVendorId, TestProjectId, 90);
        var fullToken = generated.Value!.Token;

        var result = await _service.GetTokensForVendorAsync(TestVendorId);

        result.IsSuccess.Should().BeTrue();
        var summary = result.Value![0];
        summary.TokenHint.Should().StartWith("***");
        summary.TokenHint.Should().EndWith(fullToken[^4..]);
        summary.TokenHint.Should().NotBe(fullToken);
    }

    [Fact]
    public async Task GetTokensForVendorAsync_NoTokens_ReturnsEmptyList()
    {
        var result = await _service.GetTokensForVendorAsync(Guid.NewGuid());

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    #endregion

    #region GetLienWaiversAsync

    [Fact]
    public async Task GetLienWaiversAsync_ValidToken_ReturnsWaivers()
    {
        var generated = await _service.GenerateTokenAsync(TestVendorId, TestProjectId, 90);
        var token = generated.Value!.Token;

        // Seed a lien waiver
        _db.LienWaivers.Add(new LienWaiver
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            ProjectId = TestProjectId,
            VendorId = TestVendorId,
            WaiverType = LienWaiverType.Conditional,
            Amount = 25_000m,
            ThroughDate = new DateOnly(2026, 1, 31),
            Status = LienWaiverStatus.Requested
        });
        await _db.SaveChangesAsync();

        var result = await _service.GetLienWaiversAsync(token);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(1);
        result.Value![0].Amount.Should().Be(25_000m);
    }

    [Fact]
    public async Task GetLienWaiversAsync_InvalidToken_ReturnsFailure()
    {
        var result = await _service.GetLienWaiversAsync("bad-token");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_TOKEN");
    }

    #endregion

    #region SubmitLienWaiverAsync

    [Fact]
    public async Task SubmitLienWaiverAsync_ValidInput_CreatesWaiver()
    {
        var generated = await _service.GenerateTokenAsync(TestVendorId, TestProjectId, 90);
        var token = generated.Value!.Token;

        var dto = new SubmitLienWaiverDto(
            WaiverType: LienWaiverType.Conditional,
            Amount: 50_000m,
            ThroughDate: new DateOnly(2026, 1, 31),
            Description: "January progress payment");

        var result = await _service.SubmitLienWaiverAsync(token, dto);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Amount.Should().Be(50_000m);
        result.Value.WaiverType.Should().Be(LienWaiverType.Conditional);
        result.Value.Status.Should().Be(LienWaiverStatus.Received);
        result.Value.ProjectId.Should().Be(TestProjectId);
    }

    [Fact]
    public async Task SubmitLienWaiverAsync_ZeroAmount_ReturnsFailure()
    {
        var generated = await _service.GenerateTokenAsync(TestVendorId, TestProjectId, 90);

        var dto = new SubmitLienWaiverDto(
            WaiverType: LienWaiverType.Conditional,
            Amount: 0m,
            ThroughDate: new DateOnly(2026, 1, 31),
            Description: null);

        var result = await _service.SubmitLienWaiverAsync(generated.Value!.Token, dto);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task SubmitLienWaiverAsync_NegativeAmount_ReturnsFailure()
    {
        var generated = await _service.GenerateTokenAsync(TestVendorId, TestProjectId, 90);

        var dto = new SubmitLienWaiverDto(
            WaiverType: LienWaiverType.Conditional,
            Amount: -100m,
            ThroughDate: new DateOnly(2026, 1, 31),
            Description: null);

        var result = await _service.SubmitLienWaiverAsync(generated.Value!.Token, dto);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task SubmitLienWaiverAsync_InvalidToken_ReturnsFailure()
    {
        var dto = new SubmitLienWaiverDto(
            WaiverType: LienWaiverType.Conditional,
            Amount: 50_000m,
            ThroughDate: new DateOnly(2026, 1, 31),
            Description: null);

        var result = await _service.SubmitLienWaiverAsync("invalid-token", dto);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_TOKEN");
    }

    #endregion

    #region GetPaymentHistoryAsync

    [Fact]
    public async Task GetPaymentHistoryAsync_ReturnsOnlyApprovedWaivers()
    {
        var generated = await _service.GenerateTokenAsync(TestVendorId, TestProjectId, 90);

        // Seed waivers with different statuses
        _db.LienWaivers.AddRange(
            new LienWaiver
            {
                TenantId = TestTenantId, CompanyId = TestCompanyId,
                ProjectId = TestProjectId, VendorId = TestVendorId,
                WaiverType = LienWaiverType.Progress, Amount = 10_000m,
                ThroughDate = new DateOnly(2026, 1, 15),
                Status = LienWaiverStatus.Approved
            },
            new LienWaiver
            {
                TenantId = TestTenantId, CompanyId = TestCompanyId,
                ProjectId = TestProjectId, VendorId = TestVendorId,
                WaiverType = LienWaiverType.Progress, Amount = 20_000m,
                ThroughDate = new DateOnly(2026, 1, 31),
                Status = LienWaiverStatus.Requested
            },
            new LienWaiver
            {
                TenantId = TestTenantId, CompanyId = TestCompanyId,
                ProjectId = TestProjectId, VendorId = TestVendorId,
                WaiverType = LienWaiverType.Conditional, Amount = 5_000m,
                ThroughDate = new DateOnly(2026, 2, 15),
                Status = LienWaiverStatus.Rejected
            });
        await _db.SaveChangesAsync();

        var result = await _service.GetPaymentHistoryAsync(generated.Value!.Token);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(1);
        result.Value![0].Amount.Should().Be(10_000m);
        result.Value[0].Status.Should().Be(LienWaiverStatus.Approved);
    }

    [Fact]
    public async Task GetPaymentHistoryAsync_NoApprovedWaivers_ReturnsEmptyList()
    {
        var generated = await _service.GenerateTokenAsync(TestVendorId, TestProjectId, 90);

        var result = await _service.GetPaymentHistoryAsync(generated.Value!.Token);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GetPaymentHistoryAsync_InvalidToken_ReturnsFailure()
    {
        var result = await _service.GetPaymentHistoryAsync("bad-token");

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("INVALID_TOKEN");
    }

    #endregion
}
