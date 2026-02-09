using Pitbull.HR.Domain;

namespace Pitbull.HR.Features;

public static class DeductionMapper
{
    public static DeductionDto ToDto(Deduction d) => new(
        d.Id, d.EmployeeId, d.DeductionCode, d.Description, d.Method.ToString(),
        d.Amount, d.MaxPerPeriod, d.AnnualMax, d.YtdAmount, d.Priority, d.IsPreTax,
        d.EmployerMatch, d.EmployerMatchMax, d.EffectiveDate, d.ExpirationDate,
        d.CaseNumber, d.GarnishmentPayee, d.Notes, d.IsActive, d.CreatedAt, d.UpdatedAt
    );

    public static DeductionListDto ToListDto(Deduction d, string employeeName) => new(
        d.Id, d.EmployeeId, employeeName, d.DeductionCode, d.Description,
        d.Method.ToString(), d.Amount, d.Priority, d.IsPreTax, d.IsActive
    );
}
