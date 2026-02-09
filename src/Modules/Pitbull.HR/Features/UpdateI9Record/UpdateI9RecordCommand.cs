using MediatR;
using Pitbull.Core.CQRS;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.UpdateI9Record;

/// <summary>
/// Complete Section 2 (employer verification) or Section 3 (reverification).
/// </summary>
public record UpdateI9RecordCommand(
    Guid Id,
    // Section 2
    DateOnly? Section2CompletedDate, string? Section2CompletedBy,
    string? ListADocumentType, string? ListADocumentNumber, DateOnly? ListAExpirationDate,
    string? ListBDocumentType, string? ListBDocumentNumber, DateOnly? ListBExpirationDate,
    string? ListCDocumentType, string? ListCDocumentNumber, DateOnly? ListCExpirationDate,
    // Section 3
    DateOnly? Section3Date, string? Section3NewDocumentType, string? Section3NewDocumentNumber,
    DateOnly? Section3NewDocumentExpiration, DateOnly? Section3RehireDate,
    // Status
    I9Status? Status, string? EVerifyCaseNumber, string? Notes
) : IRequest<Result<I9RecordDto>>;
