using Pitbull.Core.CQRS;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;

namespace Pitbull.TimeTracking.Features.CreateTimeEntry;

/// <summary>
/// Create a new time entry for an employee
/// </summary>
/// <summary>
/// CostCodeId is optional. When null/empty, the service layer auto-assigns the
/// tenant's default labor cost code (Code="LAB"). This supports crew timecard
/// grid entries where foremen never pick a cost code.
/// </summary>
public record CreateTimeEntryCommand(
    DateOnly Date,
    Guid EmployeeId,
    Guid ProjectId,
    Guid CostCodeId = default,
    decimal RegularHours = 0,
    decimal OvertimeHours = 0,
    decimal DoubletimeHours = 0,
    string? Description = null,
    Guid? PhaseId = null,
    Guid? EquipmentId = null,
    decimal EquipmentHours = 0,
    decimal? Latitude = null,
    decimal? Longitude = null,
    decimal? GpsAccuracy = null,
    DateTime? GpsCapturedAt = null
) : ICommand<TimeEntryDto>;
