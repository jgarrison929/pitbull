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
/// <param name="CustomersCreated">Number of customers created</param>
/// <param name="VendorsCreated">Number of vendors created</param>
/// <param name="VendorInvoicesCreated">Number of vendor invoices created</param>
/// <param name="OwnerContractsCreated">Number of owner contracts created</param>
/// <param name="BillingApplicationsCreated">Number of billing applications (AR) created</param>
/// <param name="WipReportsCreated">Number of WIP reports created</param>
/// <param name="RetentionHoldsCreated">Number of retention holds created</param>
/// <param name="PayPeriodsCreated">Number of pay periods created</param>
/// <param name="PayrollRunsCreated">Number of payroll runs created</param>
/// <param name="SubmittalsCreated">Number of submittals created</param>
/// <param name="PunchListItemsCreated">Number of punch list items created</param>
/// <param name="OwnerScheduleOfValuesCreated">Number of owner schedule of values created</param>
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
    int CustomersCreated = 0,
    int VendorsCreated = 0,
    int VendorInvoicesCreated = 0,
    int OwnerContractsCreated = 0,
    int BillingApplicationsCreated = 0,
    int WipReportsCreated = 0,
    int RetentionHoldsCreated = 0,
    int PayPeriodsCreated = 0,
    int PayrollRunsCreated = 0,
    int SubmittalsCreated = 0,
    int PunchListItemsCreated = 0,
    int OwnerScheduleOfValuesCreated = 0,
    string Summary = ""
);
