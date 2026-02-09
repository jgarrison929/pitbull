using Pitbull.HR.Domain;

namespace Pitbull.HR.Features;

public static class EVerifyCaseMapper
{
    public static EVerifyCaseDto ToDto(EVerifyCase e) => new(
        e.Id, e.EmployeeId, e.I9RecordId, e.CaseNumber, e.SubmittedDate,
        e.Status.ToString(), e.LastStatusDate, e.Result?.ToString(), e.ClosedDate,
        e.TNCDeadline, e.TNCContested, e.PhotoMatched,
        e.SSAResult?.ToString(), e.DHSResult?.ToString(), e.SubmittedBy, e.Notes,
        e.CreatedAt, e.UpdatedAt
    );

    public static EVerifyCaseListDto ToListDto(EVerifyCase e, string employeeName)
    {
        // Needs action if: TNC pending response, or pending verification
        var needsAction = e.Status == EVerifyStatus.TNCPending && e.TNCDeadline.HasValue
            && e.TNCDeadline.Value >= DateOnly.FromDateTime(DateTime.UtcNow);
        return new(e.Id, e.EmployeeId, employeeName, e.CaseNumber, e.SubmittedDate,
            e.Status.ToString(), e.Result?.ToString(), needsAction);
    }
}
