using MediatR;
using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.UpdateEVerifyCase;

/// <summary>
/// Update E-Verify case status (typically from DHS response).
/// </summary>
public record UpdateEVerifyCaseCommand(
    Guid Id, EVerifyStatus? Status, EVerifyResult? Result, DateOnly? LastStatusDate,
    DateOnly? ClosedDate, DateOnly? TNCDeadline, bool? TNCContested,
    bool? PhotoMatched, EVerifySSAResult? SSAResult, EVerifyDHSResult? DHSResult, string? Notes
) : IRequest<Result<EVerifyCaseDto>>;
