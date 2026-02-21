using System.Runtime.CompilerServices;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.DependencyInjection;
using Pitbull.AI.Features;
using Pitbull.Bids.Features.CreateBid;
using Pitbull.Billing.Features;
using Pitbull.Contracts.Features.CreateSubcontract;
using Pitbull.Core.Data;
using Pitbull.Core.Services;
using Pitbull.ProjectManagement.Features;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.RFIs.Features.CreateRfi;
using Pitbull.SystemAdmin.Features;
using Pitbull.TimeTracking.Features.CreateTimeEntry;

namespace Pitbull.Tests.Unit.Helpers;

/// <summary>
/// Registers all module assemblies with PitbullDbContext at assembly load time.
/// This runs before any test code, preventing race conditions where a test
/// creates a PitbullDbContext before module assemblies are registered.
/// EF Core caches the model globally per context type, so the first DbContext
/// to trigger OnModelCreating determines the model for ALL subsequent instances.
/// </summary>
internal static class ModuleInit
{
    [ModuleInitializer]
    internal static void Initialize()
    {
        PitbullDbContext.RegisterModuleAssembly(typeof(CreateProjectCommand).Assembly);
        PitbullDbContext.RegisterModuleAssembly(typeof(CreateBidCommand).Assembly);
        PitbullDbContext.RegisterModuleAssembly(typeof(CreateTimeEntryCommand).Assembly);
        PitbullDbContext.RegisterModuleAssembly(typeof(CreateSubcontractCommand).Assembly);
        PitbullDbContext.RegisterModuleAssembly(typeof(CreateRfiCommand).Assembly);
        PitbullDbContext.RegisterModuleAssembly(typeof(CreateProjectManagementModuleCommand).Assembly);
        PitbullDbContext.RegisterModuleAssembly(typeof(CreateAiModuleCommand).Assembly);
        PitbullDbContext.RegisterModuleAssembly(typeof(BillingModuleMarker).Assembly);
        PitbullDbContext.RegisterModuleAssembly(typeof(SystemAdminModuleMarker).Assembly);

        // Register field encryption service for [Encrypted] attribute auto-discovery
        var services = new ServiceCollection();
        services.AddDataProtection().UseEphemeralDataProtectionProvider();
        var sp = services.BuildServiceProvider();
        var provider = sp.GetRequiredService<IDataProtectionProvider>();
        PitbullDbContext.RegisterEncryptionService(new FieldEncryptionService(provider));
    }
}
