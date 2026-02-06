using Pitbull.Core.CQRS;

namespace Pitbull.Api.Features.SeedData;

/// <summary>
/// Command to seed the database with sample data for testing and demos
/// </summary>
public record SeedDataCommand : ICommand<SeedDataResult>;

/// <summary>
/// Result of seed data operation
/// </summary>
/// <param name="ProjectsCreated">Number of projects created</param>
/// <param name="BidsCreated">Number of bids created</param>
/// <param name="BidItemsCreated">Number of bid items created</param>
/// <param name="PhasesCreated">Number of project phases created</param>
/// <param name="CostCodesCreated">Number of cost codes created</param>
/// <param name="EmployeesCreated">Number of employees created</param>
/// <param name="ProjectAssignmentsCreated">Number of project assignments created</param>
/// <param name="TimeEntriesCreated">Number of time entries created</param>
/// <param name="Summary">Summary message of the operation</param>
public record SeedDataResult(
    int ProjectsCreated,
    int BidsCreated,
    int BidItemsCreated,
    int PhasesCreated,
    int CostCodesCreated,
    int EmployeesCreated,
    int ProjectAssignmentsCreated,
    int TimeEntriesCreated,
    string Summary
);