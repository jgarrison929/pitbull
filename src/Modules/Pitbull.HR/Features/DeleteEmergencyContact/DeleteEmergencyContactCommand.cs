using MediatR;

namespace Pitbull.HR.Features.DeleteEmergencyContact;

public record DeleteEmergencyContactCommand(Guid Id) : IRequest<bool>;
