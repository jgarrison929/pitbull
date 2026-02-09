using Pitbull.HR.Domain;

namespace Pitbull.HR.Features;

public static class WithholdingElectionMapper
{
    public static WithholdingElectionDto ToDto(WithholdingElection w)
    {
        return new WithholdingElectionDto(
            Id: w.Id,
            EmployeeId: w.EmployeeId,
            TaxJurisdiction: w.TaxJurisdiction,
            FilingStatus: w.FilingStatus.ToString(),
            Allowances: w.Allowances,
            AdditionalWithholding: w.AdditionalWithholding,
            IsExempt: w.IsExempt,
            MultipleJobsOrSpouseWorks: w.MultipleJobsOrSpouseWorks,
            DependentCredits: w.DependentCredits,
            OtherIncome: w.OtherIncome,
            Deductions: w.Deductions,
            EffectiveDate: w.EffectiveDate,
            ExpirationDate: w.ExpirationDate,
            SignedDate: w.SignedDate,
            Notes: w.Notes,
            IsCurrent: w.IsCurrent,
            CreatedAt: w.CreatedAt,
            UpdatedAt: w.UpdatedAt
        );
    }

    public static WithholdingElectionListDto ToListDto(WithholdingElection w, string employeeName)
    {
        return new WithholdingElectionListDto(
            Id: w.Id,
            EmployeeId: w.EmployeeId,
            EmployeeName: employeeName,
            TaxJurisdiction: w.TaxJurisdiction,
            FilingStatus: w.FilingStatus.ToString(),
            EffectiveDate: w.EffectiveDate,
            ExpirationDate: w.ExpirationDate,
            IsCurrent: w.IsCurrent
        );
    }
}
