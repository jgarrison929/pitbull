using Pitbull.TimeTracking.Domain;

namespace Pitbull.TimeTracking.Features;

/// <summary>
/// Time entry data transfer object for API responses
/// </summary>
public record TimeEntryDto(
    Guid Id,
    DateOnly Date,
    Guid EmployeeId,
    string EmployeeName,
    Guid ProjectId,
    string ProjectName,
    string ProjectNumber,
    Guid CostCodeId,
    string CostCodeDescription,
    Guid? PhaseId,
    string? PhaseName,
    Guid? EquipmentId,
    string? EquipmentName,
    string? EquipmentCode,
    decimal EquipmentHours,
    decimal RegularHours,
    decimal OvertimeHours,
    decimal DoubletimeHours,
    decimal TotalHours,
    string? Description,
    TimeEntryStatus Status,
    Guid? ApprovedById,
    string? ApprovedByName,
    DateTime? ApprovedAt,
    string? ApprovalComments,
    string? RejectionReason,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);
