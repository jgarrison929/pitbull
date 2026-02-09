using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.HR.Features.GetEmergencyContact;

public record GetEmergencyContactQuery(Guid Id) : IRequest<Result<EmergencyContactDto>>;
