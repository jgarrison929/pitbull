using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Payroll.Domain;
using Pitbull.Payroll.Services;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Tests.Unit.Payroll;

public class WageRateResolverTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestCompanyId = Guid.NewGuid();
    private readonly PitbullDbContext _db;
    private readonly WageRateResolver _resolver;

    public WageRateResolverTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new() { CompanyId = TestCompanyId };
        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new PitbullDbContext(options, tenantContext, companyContext);
        _resolver = new WageRateResolver(_db);
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    private async Task<Employee> SeedEmployee(decimal baseRate)
    {
        Employee emp = new()
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            EmployeeNumber = $"EMP-{Guid.NewGuid():N}"[..12],
            FirstName = "Pat",
            LastName = "Union",
            BaseHourlyRate = baseRate,
            IsActive = true,
            Classification = EmployeeClassification.Hourly
        };
        _db.Set<Employee>().Add(emp);
        await _db.SaveChangesAsync();
        return emp;
    }

    private async Task<(WorkClassification Classification, UnionAgreement Agreement)> SeedAgreementAndClass()
    {
        WorkClassification classification = new()
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            Code = "LABR",
            Name = "Laborer",
            IsActive = true
        };
        UnionAgreement agreement = new()
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            UnionName = "LIUNA",
            LocalNumber = "210",
            Name = "Laborers CBA",
            EffectiveDate = new DateOnly(2026, 1, 1),
            Status = UnionAgreementStatus.Active
        };
        _db.Set<WorkClassification>().Add(classification);
        _db.Set<UnionAgreement>().Add(agreement);
        await _db.SaveChangesAsync();
        return (classification, agreement);
    }

    private async Task SeedPackage(Guid agreementId, Guid classificationId, decimal hourlyRate, string scale = "Journeyman")
    {
        PayComponent st = new()
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            Code = "ST",
            Name = "Straight Time",
            Kind = PayComponentKind.Earning,
            OverlayPack = "union"
        };
        WagePackage package = new()
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            UnionAgreementId = agreementId,
            WorkClassificationId = classificationId,
            ScaleCode = scale,
            EffectiveDate = new DateOnly(2026, 1, 1)
        };
        package.Rates.Add(new WagePackageRate
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            WagePackageId = package.Id,
            PayComponentId = st.Id,
            PayComponent = st,
            HourlyRate = hourlyRate,
            Amount = hourlyRate,
            Unit = WageRateUnit.PerHour
        });
        _db.Set<PayComponent>().Add(st);
        _db.Set<WagePackage>().Add(package);
        await _db.SaveChangesAsync();
    }

    [Fact]
    public async Task Resolve_PrivateNonUnion_FallsBackToBaseHourlyRate()
    {
        Employee emp = await SeedEmployee(42.50m);
        Guid projectId = Guid.NewGuid();

        var result = await _resolver.ResolveAsync(new WageRateRequest(emp.Id, projectId, new DateOnly(2026, 2, 3), null, null, null));

        result.IsSuccess.Should().BeTrue();
        result.Value!.RegularRate.Should().Be(42.50m);
        result.Value.RateSource.Should().Be(RateSource.FallbackBaseRate);
        result.Value.OverlayPack.Should().Be("core");
        result.Value.WagePackageId.Should().BeNull();
    }

    [Fact]
    public async Task Resolve_UnionPackageMatch_UsesPackageRate()
    {
        Employee emp = await SeedEmployee(50m);
        (WorkClassification classification, UnionAgreement agreement) = await SeedAgreementAndClass();
        await SeedPackage(agreement.Id, classification.Id, 87.25m);
        _db.Set<EmployeeUnionAffiliation>().Add(new EmployeeUnionAffiliation
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            EmployeeId = emp.Id,
            UnionAgreementId = agreement.Id,
            WorkClassificationId = classification.Id,
            ScaleCode = "Journeyman",
            EffectiveDate = new DateOnly(2026, 1, 1)
        });
        await _db.SaveChangesAsync();

        var result = await _resolver.ResolveAsync(new WageRateRequest(
            emp.Id, Guid.NewGuid(), new DateOnly(2026, 2, 3), classification.Id, null, null));

        result.IsSuccess.Should().BeTrue();
        result.Value!.RegularRate.Should().Be(87.25m);
        result.Value.RateSource.Should().Be(RateSource.UnionPackage);
        result.Value.OverlayPack.Should().Be("union");
        result.Value.WorkClassificationId.Should().Be(classification.Id);
        result.Value.WagePackageId.Should().NotBeNull();
    }

    [Fact]
    public async Task Resolve_UnionAffiliationWithoutPackage_ReturnsUnionRateNotFound()
    {
        Employee emp = await SeedEmployee(50m);
        (WorkClassification classification, UnionAgreement agreement) = await SeedAgreementAndClass();
        _db.Set<EmployeeUnionAffiliation>().Add(new EmployeeUnionAffiliation
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            EmployeeId = emp.Id,
            UnionAgreementId = agreement.Id,
            WorkClassificationId = classification.Id,
            ScaleCode = "Journeyman",
            EffectiveDate = new DateOnly(2026, 1, 1)
        });
        await _db.SaveChangesAsync();

        var result = await _resolver.ResolveAsync(new WageRateRequest(
            emp.Id, Guid.NewGuid(), new DateOnly(2026, 2, 3), classification.Id, null, null));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("UNION_RATE_NOT_FOUND");
    }
}
