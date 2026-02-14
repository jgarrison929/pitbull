using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Features.Equipment;

/// <summary>
/// Create a new equipment item
/// </summary>
public record CreateEquipmentCommand(
    string Code,
    string Name,
    string? Description = null,
    EquipmentType Type = EquipmentType.Other,
    decimal HourlyRate = 0,
    decimal? BillingRate = null,
    bool IsActive = true,
    string? SerialNumber = null,
    string? LicensePlate = null
) : ICommand<EquipmentDto>;

/// <summary>
/// Update an existing equipment item
/// </summary>
public record UpdateEquipmentCommand(
    Guid EquipmentId,
    string? Code = null,
    string? Name = null,
    string? Description = null,
    EquipmentType? Type = null,
    decimal? HourlyRate = null,
    decimal? BillingRate = null,
    bool? IsActive = null,
    string? SerialNumber = null,
    string? LicensePlate = null
) : ICommand<EquipmentDto>;

/// <summary>
/// List equipment with optional filters
/// </summary>
public record ListEquipmentQuery(
    bool? IsActive = null,
    EquipmentType? Type = null,
    string? SearchTerm = null,
    int Page = 1,
    int PageSize = 25
) : IQuery<ListEquipmentResult>;

/// <summary>
/// Result of equipment list query
/// </summary>
public record ListEquipmentResult(
    IReadOnlyList<EquipmentDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);
