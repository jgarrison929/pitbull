using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Pitbull.Api.Services;
using Pitbull.Bids.Domain;
using Pitbull.Billing.Features.Aging;
using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Services;

/// <summary>
/// Drives the real <see cref="BriefingService.GetMorningBriefingAsync"/> entry point
/// with seeded titles — proves CEO is never labeled PM.
/// </summary>
public class BriefingPersonaTests : IDisposable
{
    private readonly Pitbull.Core.Data.PitbullDbContext _db;
    private readonly BriefingService _service;
    private readonly Guid _companyId = TestDbContextFactory.TestCompanyId;
    private readonly Guid _tenantId = TestDbContextFactory.TestTenantId;

    public BriefingPersonaTests()
    {
        _db = TestDbContextFactory.Create();

        var company = new CompanyContext
        {
            CompanyId = _companyId,
            CompanyCode = "01",
            CompanyName = "Summit"
        };

        var aging = new Mock<IAgingReportService>();
        aging.Setup(a => a.GetAgingSummaryAsync(It.IsAny<DateOnly?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success(new AgingSummaryResult(
                AccountsPayable: new AgingBuckets(1000, 500, 0, 0, 0, 1500),
                AccountsReceivable: new AgingBuckets(2000, 1000, 500, 200, 100, 3800),
                NetPosition: 2300,
                AsOfDate: DateOnly.FromDateTime(DateTime.UtcNow))));

        _service = new BriefingService(
            _db,
            company,
            aging.Object,
            NullLogger<BriefingService>.Instance);
    }

    public void Dispose() => _db.Dispose();

    private async Task<AppUser> SeedUserAsync(string title)
    {
        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            Email = $"{Guid.NewGuid():N}@test.local",
            UserName = $"{Guid.NewGuid():N}@test.local",
            FirstName = "Demo",
            LastName = "User",
            Title = title,
            NormalizedEmail = "X",
            NormalizedUserName = "X",
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return user;
    }

    [Theory]
    [InlineData("Chief Executive Officer", "Manager", "Executive")]
    [InlineData("Chief Financial Officer", "Manager", "Controller")]
    [InlineData("Project Manager", "Supervisor", "PM")]
    [InlineData("Estimator", "User", "Estimator")]
    public async Task GetMorningBriefing_UsesTitle_NotIdentityRoleAlone(
        string title, string identityRole, string expectedBriefingRole)
    {
        var user = await SeedUserAsync(title);

        var briefing = await _service.GetMorningBriefingAsync(
            user.Id, user.FullName, new[] { identityRole });

        briefing.Role.Should().Be(expectedBriefingRole);

        switch (expectedBriefingRole)
        {
            case "Executive":
                briefing.Executive.Should().NotBeNull();
                briefing.Pm.Should().BeNull("CEO must not receive PM section");
                break;
            case "Controller":
                briefing.Controller.Should().NotBeNull();
                briefing.Pm.Should().BeNull();
                break;
            case "PM":
                briefing.Pm.Should().NotBeNull();
                briefing.Executive.Should().BeNull();
                break;
            case "Estimator":
                briefing.Estimator.Should().NotBeNull();
                briefing.Pm.Should().BeNull();
                break;
        }
    }

    [Fact]
    public async Task GetMorningBriefing_ManagerWithoutTitle_IsPmNotExecutive()
    {
        var user = await SeedUserAsync(null!);
        user.Title = null;
        await _db.SaveChangesAsync();

        var briefing = await _service.GetMorningBriefingAsync(
            user.Id, "No Title", new[] { "Manager" });

        briefing.Role.Should().Be("PM");
        briefing.Pm.Should().NotBeNull();
        briefing.Executive.Should().BeNull();
    }

    [Fact]
    public async Task GetMorningBriefing_Ceo_IncludesExpandedExecutiveMetrics()
    {
        var user = await SeedUserAsync("Chief Executive Officer");

        _db.Set<Project>().Add(new Project
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            CompanyId = _companyId,
            Name = "Tower A",
            Number = "P-1",
            Status = ProjectStatus.Active,
            ContractAmount = 1_000_000m,
        });
        _db.Set<Bid>().Add(new Bid
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantId,
            CompanyId = _companyId,
            Name = "Pipeline Bid",
            Number = "B-1",
            Status = BidStatus.Submitted,
            EstimatedValue = 250_000m,
        });
        await _db.SaveChangesAsync();

        var briefing = await _service.GetMorningBriefingAsync(
            user.Id, "Demo CEO", new[] { "Manager" });

        briefing.Role.Should().Be("Executive");
        briefing.Executive.Should().NotBeNull();
        briefing.Executive!.TotalContractValue.Should().Be(1_000_000m);
        briefing.Executive.OpenBidCount.Should().Be(1);
        briefing.Executive.BidPipelineValue.Should().Be(250_000m);
        briefing.Executive.ArOverdue.Should().Be(800m); // 500+200+100 from mock aging
    }
}
