using Pitbull.Core.CQRS;

namespace Pitbull.Bids.Features.ConvertBidToProject;

public record ConvertBidToProjectCommand(
    Guid BidId,
    string ProjectNumber,
    string? ProjectName = null,
    string? Description = null,
    int ProjectType = 0,
    string? Address = null,
    string? City = null,
    string? State = null,
    string? ZipCode = null,
    string? ClientName = null,
    string? ClientContact = null,
    string? ClientEmail = null,
    string? ClientPhone = null,
    DateTime? StartDate = null,
    DateTime? EstimatedCompletionDate = null,
    bool CreateBudget = true,
    bool CreateSubcontracts = false,
    List<CostCodeMappingDto>? CostCodeMappings = null
) : ICommand<ConvertBidToProjectResult>;

public record CostCodeMappingDto(
    Guid BidItemId,
    string CostCode,
    string? Description = null
);

public record ConvertBidToProjectResult(
    Guid ProjectId,
    Guid BidId,
    string ProjectName,
    string ProjectNumber,
    Guid? BudgetId = null,
    int SubcontractsCreated = 0,
    int CostCodesMapped = 0
);
