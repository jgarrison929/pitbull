using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateSubcontract;
using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Features.UpdateSubcontract;

public record UpdateSubcontractCommand(
    Guid Id,
    string SubcontractNumber,
    string SubcontractorName,
    string? SubcontractorContact,
    string? SubcontractorEmail,
    string? SubcontractorPhone,
    string? SubcontractorAddress,
    string ScopeOfWork,
    string? TradeCode,
    decimal OriginalValue,
    decimal RetainagePercent,
    DateTime? ExecutionDate,
    DateTime? StartDate,
    DateTime? CompletionDate,
    SubcontractStatus Status,
    DateTime? InsuranceExpirationDate,
    bool InsuranceCurrent,
    string? LicenseNumber,
    string? Notes
) : ICommand<SubcontractDto>;
