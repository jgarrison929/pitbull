using MediatR;
using Pitbull.Core.CQRS;

namespace Pitbull.HR.Features.CreateEVerifyCase;

public record CreateEVerifyCaseCommand(
    Guid EmployeeId, Guid? I9RecordId, string CaseNumber, DateOnly SubmittedDate,
    string SubmittedBy, string? Notes
) : IRequest<Result<EVerifyCaseDto>>;
