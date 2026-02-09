using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.HR.Features.CreateEmergencyContact;

public record CreateEmergencyContactCommand(
    Guid EmployeeId,
    string Name,
    string Relationship,
    string PrimaryPhone,
    string? SecondaryPhone,
    string? Email,
    int? Priority,
    string? Notes
) : IRequest<Result<EmergencyContactDto>>;
