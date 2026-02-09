using MediatR;
using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.CreateI9Record;

public record CreateI9RecordCommand(
    Guid EmployeeId, DateOnly Section1CompletedDate, string CitizenshipStatus,
    string? AlienNumber, string? I94Number, string? ForeignPassportNumber, string? ForeignPassportCountry,
    DateOnly? WorkAuthorizationExpires, DateOnly EmploymentStartDate, string? Notes
) : IRequest<Result<I9RecordDto>>;
