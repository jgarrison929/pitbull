using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;
using Pitbull.Bids.Features.CreateBid;
using Pitbull.Projects.Features.CreateProject;
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

    static TestDbContextFactory()
    {
        // Register module assemblies so EF discovers entity configurations
        PitbullDbContext.RegisterModuleAssembly(typeof(CreateProjectCommand).Assembly);
        PitbullDbContext.RegisterModuleAssembly(typeof(CreateBidCommand).Assembly);
        PitbullDbContext.RegisterModuleAssembly(typeof(CreateTimeEntryCommand).Assembly);
    }

    public static PitbullDbContext Create(Guid? tenantId = null, string? dbName = null)
    {
        var effectiveTenantId = tenantId ?? TestTenantId;
        var effectiveDbName = dbName ?? Guid.NewGuid().ToString();

        var tenantContext = new TenantContext
        {
            TenantId = effectiveTenantId,
            TenantName = "Test Tenant"
        };

        var options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(effectiveDbName)
            .Options;

        var context = new PitbullDbContext(options, tenantContext);
        context.Database.EnsureCreated();
        return context;
    }

    /// <summary>
    /// Creates a second DbContext pointing to the same in-memory database
    /// but with a different tenant, useful for tenant isolation tests.
    /// </summary>
    public static PitbullDbContext CreateWithSameDb(string dbName, Guid tenantId)
    {
        var tenantContext = new TenantContext
        {
            TenantId = tenantId,
            TenantName = "Other Tenant"
        };

        var options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;

        return new PitbullDbContext(options, tenantContext);
    }
}
