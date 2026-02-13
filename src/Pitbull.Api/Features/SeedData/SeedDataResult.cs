namespace Pitbull.Api.Features.SeedData;

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
/// <param name="SubcontractsCreated">Number of subcontracts created</param>
/// <param name="ChangeOrdersCreated">Number of change orders created</param>
/// <param name="PaymentApplicationsCreated">Number of payment applications created</param>
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
    int SubcontractsCreated = 0,
    int ChangeOrdersCreated = 0,
    int PaymentApplicationsCreated = 0,
    string Summary = ""
);