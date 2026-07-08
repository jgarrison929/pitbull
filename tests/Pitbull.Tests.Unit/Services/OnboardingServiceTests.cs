using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Api.Services;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Services;

public sealed class OnboardingServiceTests
{
    [Fact]
    public async Task GetOnboardingStatus_NewOwnerWithNamedCompany_IsNotSetupComplete()
    {
        var tenantId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        using var db = TestDbContextFactory.Create(tenantId, companyId: companyId);
        db.Set<Company>().Add(new Company
        {
            Id = companyId,
            TenantId = tenantId,
            Name = "Acme Construction LLC",
            Code = "01",
            IsDefault = true,
            CreatedAt = DateTime.UtcNow,
        });
        db.Users.Add(new AppUser
        {
            Id = userId,
            TenantId = tenantId,
            Email = "owner@example.com",
            UserName = "owner@example.com",
            FirstName = "Test",
            LastName = "Owner",
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var tenantContext = new TenantContext { TenantId = tenantId };
        var service = new OnboardingService(db, tenantContext, NullLogger<OnboardingService>.Instance);

        var status = await service.GetOnboardingStatusAsync(userId);

        status.HasCompany.Should().BeTrue();
        status.IsSetupComplete.Should().BeFalse();
        status.Checklist.Should().NotBeNull();
        status.Checklist!.CompanyProfileCompleted.Should().BeFalse();
    }

    [Fact]
    public async Task GetOnboardingStatus_AfterWizardChecklistMarked_IsSetupComplete()
    {
        var tenantId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        using var db = TestDbContextFactory.Create(tenantId, companyId: companyId);
        db.Set<Company>().Add(new Company
        {
            Id = companyId,
            TenantId = tenantId,
            Name = "Acme Construction LLC",
            Code = "01",
            IsDefault = true,
            CreatedAt = DateTime.UtcNow,
        });
        db.Users.Add(new AppUser
        {
            Id = userId,
            TenantId = tenantId,
            Email = "owner@example.com",
            UserName = "owner@example.com",
            FirstName = "Test",
            LastName = "Owner",
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var tenantContext = new TenantContext { TenantId = tenantId };
        var service = new OnboardingService(db, tenantContext, NullLogger<OnboardingService>.Instance);

        await service.GetOnboardingStatusAsync(userId);

        await service.UpdateChecklistItemAsync(userId, companyId, "company_profile", true);
        await service.UpdateChecklistItemAsync(userId, companyId, "contractor_type", true);
        await service.UpdateChecklistItemAsync(userId, companyId, "modules_activated", true);
        await service.UpdateChecklistItemAsync(userId, companyId, "modules_configured", true);

        var status = await service.GetOnboardingStatusAsync(userId);

        status.IsSetupComplete.Should().BeTrue();
    }
}