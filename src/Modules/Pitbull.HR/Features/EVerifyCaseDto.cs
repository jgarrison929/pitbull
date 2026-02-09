namespace Pitbull.HR.Features;

public record EVerifyCaseDto(
    Guid Id, Guid EmployeeId, Guid? I9RecordId, string CaseNumber, DateOnly SubmittedDate,
    string Status, DateOnly? LastStatusDate, string? Result, DateOnly? ClosedDate,
    DateOnly? TNCDeadline, bool? TNCContested, bool? PhotoMatched,
    string? SSAResult, string? DHSResult, string SubmittedBy, string? Notes,
    DateTime CreatedAt, DateTime? UpdatedAt
);

public record EVerifyCaseListDto(
    Guid Id, Guid EmployeeId, string EmployeeName, string CaseNumber,
    DateOnly SubmittedDate, string Status, string? Result, bool NeedsAction
);
