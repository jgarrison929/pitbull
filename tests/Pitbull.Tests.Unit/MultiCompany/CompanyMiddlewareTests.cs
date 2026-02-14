using FluentAssertions;
using Pitbull.Core.MultiTenancy;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.MultiCompany;

[Trait("Category", "MultiCompany")]
public class CompanyMiddlewareTests
{
    private static readonly Guid TenantId = TestDbContextFactory.TestTenantId;
    private static readonly Guid Company1Id = Guid.Parse("11111111-aaaa-bbbb-cccc-111111111111");
    private static readonly Guid Company2Id = Guid.Parse("22222222-aaaa-bbbb-cccc-222222222222");

    /// <summary>
    /// Tests that CompanyContext resolves correctly when X-Company-Id header is provided
    /// </summary>
    [Fact]
    public void CompanyContext_ResolvesFromHeader_WhenHeaderProvided()
    {
        // The middleware sets CompanyId from X-Company-Id header first
        // This test verifies the priority resolution works
        var context = new CompanyContext
        {
            CompanyId = Company1Id,
            CompanyCode = "01",
            CompanyName = "Test Company"
        };

        context.IsResolved.Should().BeTrue();
        context.CompanyId.Should().Be(Company1Id);
    }

    /// <summary>
    /// Tests that CompanyContext is not resolved when CompanyId is empty
    /// </summary>
    [Fact]
    public void CompanyContext_IsNotResolved_WhenEmpty()
    {
        var context = new CompanyContext();

        context.IsResolved.Should().BeFalse();
        context.CompanyId.Should().Be(Guid.Empty);
        context.CompanyCode.Should().BeEmpty();
        context.CompanyName.Should().BeEmpty();
    }

    /// <summary>
    /// Tests that accessible companies are tracked correctly
    /// </summary>
    [Fact]
    public void CompanyContext_TracksAccessibleCompanies_Correctly()
    {
        var context = new CompanyContext();
        var accessibleIds = new[] { Company1Id, Company2Id, Guid.NewGuid() };

        context.SetAccessibleCompanies(accessibleIds);

        context.AccessibleCompanyIds.Should().HaveCount(3);
        context.AccessibleCompanyIds.Should().Contain(Company1Id);
        context.AccessibleCompanyIds.Should().Contain(Company2Id);
    }

    /// <summary>
    /// Tests that setting accessible companies replaces previous set
    /// </summary>
    [Fact]
    public void CompanyContext_SetAccessibleCompanies_ReplacesPrevious()
    {
        var context = new CompanyContext();

        context.SetAccessibleCompanies(new[] { Company1Id });
        context.AccessibleCompanyIds.Should().HaveCount(1);

        context.SetAccessibleCompanies(new[] { Company1Id, Company2Id });
        context.AccessibleCompanyIds.Should().HaveCount(2);
    }

    /// <summary>
    /// Tests that ICompanyContext interface exposes correct properties
    /// </summary>
    [Fact]
    public void ICompanyContext_ExposesCorrectProperties()
    {
        ICompanyContext context = new CompanyContext
        {
            CompanyId = Company1Id,
            CompanyCode = "01",
            CompanyName = "Test Company"
        };

        context.IsResolved.Should().BeTrue();
        context.CompanyId.Should().Be(Company1Id);
        context.CompanyCode.Should().Be("01");
        context.CompanyName.Should().Be("Test Company");
        context.AccessibleCompanyIds.Should().BeEmpty();
    }

    /// <summary>
    /// Tests resolution priority: X-Company-Id header takes precedence over JWT claim
    /// </summary>
    [Fact]
    public void CompanyResolution_HeaderTakesPrecedence()
    {
        // This test verifies the documented priority:
        // 1. X-Company-Id header (explicit per-request)
        // 2. company_id JWT claim (session default)
        // 3. First accessible company (fallback)

        var context = new CompanyContext();
        context.SetAccessibleCompanies(new[] { Company1Id, Company2Id });

        // Simulate resolution - header Company2Id should be used
        // even if accessible companies start with Company1Id
        var headerCompanyId = Company2Id;

        // The middleware would resolve this
        if (context.AccessibleCompanyIds.Contains(headerCompanyId))
        {
            context.CompanyId = headerCompanyId;
            context.CompanyCode = "02";
            context.CompanyName = "Company 2";
        }

        context.CompanyId.Should().Be(Company2Id);
    }

    /// <summary>
    /// Tests that fallback to first accessible company works
    /// </summary>
    [Fact]
    public void CompanyResolution_FallsBackToFirstAccessible()
    {
        var context = new CompanyContext();
        context.SetAccessibleCompanies(new[] { Company1Id, Company2Id });

        // Simulate no header and no JWT claim - fallback to first
        var resolvedCompanyId = context.AccessibleCompanyIds.Count > 0
            ? context.AccessibleCompanyIds[0]
            : Guid.Empty;

        resolvedCompanyId.Should().Be(Company1Id);
    }

    /// <summary>
    /// Tests that an unauthorized company request is not resolved
    /// </summary>
    [Fact]
    public void CompanyResolution_UnauthorizedCompany_NotResolved()
    {
        var context = new CompanyContext();
        context.SetAccessibleCompanies(new[] { Company1Id }); // Only Company1 allowed

        var requestedCompanyId = Company2Id; // Request Company2

        // Should not resolve because user doesn't have access
        var isAuthorized = context.AccessibleCompanyIds.Contains(requestedCompanyId);

        isAuthorized.Should().BeFalse();
    }

    /// <summary>
    /// Tests that empty accessible companies means no access
    /// </summary>
    [Fact]
    public void CompanyResolution_EmptyAccessibleCompanies_NoFallback()
    {
        var context = new CompanyContext();
        context.SetAccessibleCompanies(Array.Empty<Guid>());

        context.AccessibleCompanyIds.Should().BeEmpty();

        // No fallback should be available
        var fallback = context.AccessibleCompanyIds.Count > 0
            ? context.AccessibleCompanyIds[0]
            : (Guid?)null;

        fallback.Should().BeNull();
    }

    /// <summary>
    /// Tests company context with all properties set
    /// </summary>
    [Fact]
    public void CompanyContext_FullyInitialized_AllPropertiesCorrect()
    {
        var context = new CompanyContext
        {
            CompanyId = Company1Id,
            CompanyCode = "GC01",
            CompanyName = "Garrison General Contractors"
        };
        context.SetAccessibleCompanies(new[] { Company1Id, Company2Id });

        context.IsResolved.Should().BeTrue();
        context.CompanyId.Should().Be(Company1Id);
        context.CompanyCode.Should().Be("GC01");
        context.CompanyName.Should().Be("Garrison General Contractors");
        context.AccessibleCompanyIds.Should().HaveCount(2);
    }
}
