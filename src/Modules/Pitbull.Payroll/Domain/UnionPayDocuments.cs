using Pitbull.Core.Domain;

namespace Pitbull.Payroll.Domain;

public enum UnionAgreementStatus
{
    Active = 1,
    Expired = 2,
    Superseded = 3
}

public enum PayComponentKind
{
    Earning = 1,
    Deduction = 2,
    EmployerContribution = 3
}

public enum WageRateUnit
{
    PerHour = 1,
    PerDay = 2,
    PerMile = 3,
    PerShift = 4
}

public enum FringeMethod
{
    Cash = 1,
    Benefit = 2,
    Split = 3
}

public enum PayStructureStatus
{
    Draft = 1,
    Active = 2
}

public enum PayStructureSource
{
    UnionPackage = 1,
    PrevailingWage = 2,
    CompanyDefault = 3
}

public class UnionAgreement : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }
    public string UnionName { get; set; } = string.Empty;
    public string LocalNumber { get; set; } = string.Empty;
    public string? InternationalBody { get; set; }
    public string? AgreementNumber { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Jurisdiction { get; set; }
    public string? State { get; set; }
    public DateOnly EffectiveDate { get; set; }
    public DateOnly? ExpirationDate { get; set; }
    public UnionAgreementStatus Status { get; set; } = UnionAgreementStatus.Active;

    public List<WagePackage> Packages { get; set; } = [];
}

public class WagePackage : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }
    public Guid UnionAgreementId { get; set; }
    public UnionAgreement UnionAgreement { get; set; } = null!;
    public Guid WorkClassificationId { get; set; }
    public WorkClassification WorkClassification { get; set; } = null!;
    public string ScaleCode { get; set; } = "Journeyman";
    public string? ZoneCode { get; set; }
    public string? ShiftCode { get; set; }
    public DateOnly EffectiveDate { get; set; }
    public DateOnly? ExpirationDate { get; set; }

    public List<WagePackageRate> Rates { get; set; } = [];
}

public class WagePackageRate : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }
    public Guid WagePackageId { get; set; }
    public WagePackage WagePackage { get; set; } = null!;
    public Guid PayComponentId { get; set; }
    public PayComponent PayComponent { get; set; } = null!;
    public decimal HourlyRate { get; set; }
    public decimal Amount { get; set; }
    public WageRateUnit Unit { get; set; } = WageRateUnit.PerHour;
    public FringeMethod FringeMethod { get; set; } = FringeMethod.Cash;
}

public class PayComponent : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public PayComponentKind Kind { get; set; } = PayComponentKind.Earning;
    public bool IsTaxable { get; set; }
    public bool IsReportableOnCertified { get; set; }
    public bool IsFringe { get; set; }
    public bool IsCash { get; set; }
    public string OverlayPack { get; set; } = "core";
}

public class PayStructure : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }
    public string Name { get; set; } = string.Empty;
    public PayStructureStatus Status { get; set; } = PayStructureStatus.Active;
    public PayStructureSource Source { get; set; } = PayStructureSource.CompanyDefault;
    public Guid? UnionAgreementId { get; set; }
    public Guid? WageDeterminationId { get; set; }
    public DateOnly EffectiveDate { get; set; }
    public DateOnly? ExpirationDate { get; set; }
    public decimal OvertimeMultiplier { get; set; } = 1.5m;
    public decimal DoubletimeMultiplier { get; set; } = 2.0m;

    public List<PayStructureLine> Lines { get; set; } = [];
}

public class PayStructureLine : BaseEntity, ICompanyScoped, ITenantScoped
{
    public Guid CompanyId { get; set; }
    public Guid PayStructureId { get; set; }
    public PayStructure PayStructure { get; set; } = null!;
    public Guid PayComponentId { get; set; }
    public PayComponent PayComponent { get; set; } = null!;
    public int Sequence { get; set; }
    public decimal Multiplier { get; set; } = 1.0m;
    public string? FormulaKey { get; set; }
}
