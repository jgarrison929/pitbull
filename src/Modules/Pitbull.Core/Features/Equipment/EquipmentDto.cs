using Pitbull.Core.Domain;

namespace Pitbull.Core.Features.Equipment;

/// <summary>
/// Equipment data transfer object for API responses
/// </summary>
public record EquipmentDto(
    Guid Id,
    string Code,
    string Name,
    string? Description,
    EquipmentType Type,
    string TypeName,
    decimal HourlyRate,
    decimal? BillingRate,
    bool IsActive,
    string? SerialNumber,
    string? LicensePlate,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

/// <summary>
/// Mapper for converting Equipment entities to DTOs
/// </summary>
public static class EquipmentMapper
{
    public static EquipmentDto ToDto(Domain.Equipment equipment)
    {
        return new EquipmentDto(
            Id: equipment.Id,
            Code: equipment.Code,
            Name: equipment.Name,
            Description: equipment.Description,
            Type: equipment.Type,
            TypeName: equipment.Type.ToString(),
            HourlyRate: equipment.HourlyRate,
            BillingRate: equipment.BillingRate,
            IsActive: equipment.IsActive,
            SerialNumber: equipment.SerialNumber,
            LicensePlate: equipment.LicensePlate,
            CreatedAt: equipment.CreatedAt,
            UpdatedAt: equipment.UpdatedAt
        );
    }

    public static List<EquipmentDto> ToDto(IEnumerable<Domain.Equipment> equipment)
    {
        return equipment.Select(ToDto).ToList();
    }
}
