using Pitbull.Core.Domain;

namespace Pitbull.Core.Entities;

public static class ComplianceDocumentConstants
{
    public static readonly HashSet<string> ValidEntityTypes =
    [
        "Employee",
        "Subcontractor",
        "Company"
    ];

    public static readonly HashSet<string> ValidDocumentTypes =
    [
        "OSHA10",
        "OSHA30",
        "FirstAid",
        "CPR",
        "CDL",
        "GeneralLiability",
        "WorkersComp",
        "AutoInsurance",
        "BondCapacity",
        "ContractorsLicense",
        "BusinessLicense",
        "W9",
        "COI"
    ];

    public static readonly HashSet<string> ValidStatuses =
    [
        "Active",
        "Expired",
        "ExpiringSoon",
        "Revoked"
    ];

    public static readonly IReadOnlyDictionary<string, string[]> RequiredDocumentTypesByEntityType =
        new Dictionary<string, string[]>
        {
            ["Employee"] = ["OSHA10", "OSHA30", "FirstAid", "CPR", "CDL"],
            ["Subcontractor"] =
                ["GeneralLiability", "WorkersComp", "AutoInsurance", "BondCapacity", "ContractorsLicense", "W9", "COI"],
            ["Company"] = ["BusinessLicense", "ContractorsLicense", "GeneralLiability", "WorkersComp", "W9", "COI"]
        };
}

public class ComplianceDocument : BaseEntity
{
    public string EntityType { get; set; } = string.Empty;
    public Guid EntityId { get; set; }
    public string DocumentType { get; set; } = string.Empty;
    public string DocumentNumber { get; set; } = string.Empty;
    public DateTime? IssuedDate { get; set; }
    public DateTime? ExpirationDate { get; set; }
    public string Status { get; set; } = "Active";
    public string? FileUrl { get; set; }
    public string? Notes { get; set; }
}
