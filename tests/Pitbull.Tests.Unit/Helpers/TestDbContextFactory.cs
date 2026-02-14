using Microsoft.EntityFrameworkCore;
using Pitbull.Bids.Features.CreateBid;
using Pitbull.Contracts.Features.CreateSubcontract;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.RFIs.Features.CreateRfi;
using Pitbull.TimeTracking.Features.CreateTimeEntry;

namespace Pitbull.Tests.Unit.Helpers;

/// <summary>
/// Factory for creating in-memory PitbullDbContext instances for unit testing.
/// Each test gets a unique database name to ensure isolation.
/// </summary>
public static class TestDbContextFactory
{
    public static readonly Guid TestTenantId = Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    public static readonly Guid OtherTenantId = Guid.Parse("11111111-2222-3333-4444-555555555555");
    public static readonly Guid TestCompanyId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");

    static TestDbContextFactory()
    {
        // Register module assemblies so EF discovers entity configurations
        PitbullDbContext.RegisterModuleAssembly(typeof(CreateProjectCommand).Assembly);
        PitbullDbContext.RegisterModuleAssembly(typeof(CreateBidCommand).Assembly);
        PitbullDbContext.RegisterModuleAssembly(typeof(CreateTimeEntryCommand).Assembly);
        PitbullDbContext.RegisterModuleAssembly(typeof(CreateSubcontractCommand).Assembly);
        PitbullDbContext.RegisterModuleAssembly(typeof(CreateRfiCommand).Assembly);
    }

    public static PitbullDbContext Create(Guid? tenantId = null, string? dbName = null, Guid? companyId = null)
    {
        var effectiveTenantId = tenantId ?? TestTenantId;
        var effectiveDbName = dbName ?? Guid.NewGuid().ToString();
        var effectiveCompanyId = companyId ?? TestCompanyId;

        var tenantContext = new TenantContext
        {
            TenantId = effectiveTenantId,
            TenantName = "Test Tenant"
        };

        var companyContext = new CompanyContext
        {
            CompanyId = effectiveCompanyId,
            CompanyCode = "01",
            CompanyName = "Test Company"
        };

        var options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(effectiveDbName)
            .Options;

        var context = new PitbullDbContext(options, tenantContext, companyContext);
        context.Database.EnsureCreated();
        return context;
    }

    /// <summary>
    /// Creates a second DbContext pointing to the same in-memory database
    /// but with a different tenant, useful for tenant isolation tests.
    /// </summary>
    public static PitbullDbContext CreateWithSameDb(string dbName, Guid tenantId, Guid? companyId = null)
    {
        var tenantContext = new TenantContext
        {
            TenantId = tenantId,
            TenantName = "Other Tenant"
        };

        var companyContext = new CompanyContext
        {
            CompanyId = companyId ?? Guid.NewGuid(),
            CompanyCode = "01",
            CompanyName = "Other Company"
        };

        var options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;

        return new PitbullDbContext(options, tenantContext, companyContext);
    }
}
