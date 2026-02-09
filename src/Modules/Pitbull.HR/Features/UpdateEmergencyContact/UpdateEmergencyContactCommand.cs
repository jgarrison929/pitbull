using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.HR.Features.UpdateEmergencyContact;

public record UpdateEmergencyContactCommand(
    Guid Id,
    string Name,
    string Relationship,
    string PrimaryPhone,
    string? SecondaryPhone,
    string? Email,
    int? Priority,
    string? Notes
) : IRequest<Result<EmergencyContactDto>>;
