using System.Runtime.CompilerServices;
using Pitbull.Bids.Features.CreateBid;
using Pitbull.Contracts.Features.CreateSubcontract;
using Pitbull.Core.Data;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.RFIs.Features.CreateRfi;
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
    }
}
