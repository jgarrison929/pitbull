using Pitbull.HR.Domain;

namespace Pitbull.HR.Features;

public static class I9RecordMapper
{
    public static I9RecordDto ToDto(I9Record i) => new(
        i.Id, i.EmployeeId, i.Section1CompletedDate, i.CitizenshipStatus,
        i.AlienNumber, i.I94Number, i.ForeignPassportNumber, i.ForeignPassportCountry,
        i.WorkAuthorizationExpires, i.Section2CompletedDate, i.Section2CompletedBy,
        i.ListADocumentType, i.ListADocumentNumber, i.ListAExpirationDate,
        i.ListBDocumentType, i.ListBDocumentNumber, i.ListBExpirationDate,
        i.ListCDocumentType, i.ListCDocumentNumber, i.ListCExpirationDate,
        i.EmploymentStartDate, i.Section3Date, i.Section3NewDocumentType,
        i.Section3NewDocumentNumber, i.Section3NewDocumentExpiration, i.Section3RehireDate,
        i.Status.ToString(), i.EVerifyCaseNumber, i.Notes, i.RetentionEndDate, i.CreatedAt, i.UpdatedAt
    );

    public static I9RecordListDto ToListDto(I9Record i, string employeeName)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var needsReverification = i.WorkAuthorizationExpires.HasValue 
            && i.WorkAuthorizationExpires.Value <= today.AddDays(90);
        return new(i.Id, i.EmployeeId, employeeName, i.Section1CompletedDate,
            i.CitizenshipStatus, i.Status.ToString(), i.WorkAuthorizationExpires, needsReverification);
    }
}
