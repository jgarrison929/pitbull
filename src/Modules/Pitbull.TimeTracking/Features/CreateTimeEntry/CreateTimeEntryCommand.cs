using Pitbull.Core.CQRS;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;

namespace Pitbull.TimeTracking.Features.CreateTimeEntry;

/// <summary>
/// Create a new time entry for an employee
/// </summary>
public record CreateTimeEntryCommand(
    DateOnly Date,
    Guid EmployeeId,
    Guid ProjectId,
    Guid CostCodeId,
    decimal RegularHours,
    decimal OvertimeHours = 0,
    decimal DoubletimeHours = 0,
    string? Description = null,
    Guid? PhaseId = null,
    Guid? EquipmentId = null,
    decimal EquipmentHours = 0
) : ICommand<TimeEntryDto>;
