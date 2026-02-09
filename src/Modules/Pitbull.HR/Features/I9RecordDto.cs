namespace Pitbull.HR.Features;

public record I9RecordDto(
    Guid Id, Guid EmployeeId, DateOnly Section1CompletedDate, string CitizenshipStatus,
    string? AlienNumber, string? I94Number, string? ForeignPassportNumber, string? ForeignPassportCountry,
    DateOnly? WorkAuthorizationExpires, DateOnly? Section2CompletedDate, string? Section2CompletedBy,
    string? ListADocumentType, string? ListADocumentNumber, DateOnly? ListAExpirationDate,
    string? ListBDocumentType, string? ListBDocumentNumber, DateOnly? ListBExpirationDate,
    string? ListCDocumentType, string? ListCDocumentNumber, DateOnly? ListCExpirationDate,
    DateOnly EmploymentStartDate, DateOnly? Section3Date, string? Section3NewDocumentType,
    string? Section3NewDocumentNumber, DateOnly? Section3NewDocumentExpiration, DateOnly? Section3RehireDate,
    string Status, string? EVerifyCaseNumber, string? Notes, DateOnly? RetentionEndDate, DateTime CreatedAt, DateTime? UpdatedAt
);

public record I9RecordListDto(
    Guid Id, Guid EmployeeId, string EmployeeName, DateOnly Section1CompletedDate,
    string CitizenshipStatus, string Status, DateOnly? WorkAuthorizationExpires, bool NeedsReverification
);
