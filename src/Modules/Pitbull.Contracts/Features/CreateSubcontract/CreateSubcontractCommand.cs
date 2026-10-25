using Pitbull.Contracts.Domain;
using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Features.CreateSubcontract;

public record CreateSubcontractCommand(
    Guid ProjectId,
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
    DateTime? StartDate,
    DateTime? CompletionDate,
    string? LicenseNumber,
    string? Notes
) : ICommand<SubcontractDto>;

public record SubcontractDto(
    Guid Id,
    Guid ProjectId,
    string SubcontractNumber,
    string SubcontractorName,
    string? SubcontractorContact,
    string? SubcontractorEmail,
    string? SubcontractorPhone,
    string? SubcontractorAddress,
    string ScopeOfWork,
    string? TradeCode,
    decimal OriginalValue,
    decimal CurrentValue,
    decimal BilledToDate,
    decimal PaidToDate,
    decimal RetainagePercent,
    decimal RetainageHeld,
    DateTime? ExecutionDate,
    DateTime? StartDate,
    DateTime? CompletionDate,
    DateTime? ActualCompletionDate,
    SubcontractStatus Status,
    DateTime? InsuranceExpirationDate,
    bool InsuranceCurrent,
    string? LicenseNumber,
    string? Notes,
    DateTime CreatedAt
);
