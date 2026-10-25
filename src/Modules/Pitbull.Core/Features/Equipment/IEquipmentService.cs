using Pitbull.Core.CQRS;

namespace Pitbull.Core.Features.Equipment;

/// <summary>
/// Service for managing equipment operations.
/// Equipment is tenant-scoped and shared across companies.
/// </summary>
public interface IEquipmentService
{
    // Query operations
    Task<Result<EquipmentDto>> GetEquipmentAsync(Guid id, CancellationToken cancellationToken = default);

    Task<Result<ListEquipmentResult>> ListEquipmentAsync(
        ListEquipmentQuery query,
        CancellationToken cancellationToken = default);

    // Command operations
    Task<Result<EquipmentDto>> CreateEquipmentAsync(
        CreateEquipmentCommand command,
        CancellationToken cancellationToken = default);

    Task<Result<EquipmentDto>> UpdateEquipmentAsync(
        UpdateEquipmentCommand command,
        CancellationToken cancellationToken = default);

    Task<Result> DeleteEquipmentAsync(
        Guid id,
        CancellationToken cancellationToken = default);
}
