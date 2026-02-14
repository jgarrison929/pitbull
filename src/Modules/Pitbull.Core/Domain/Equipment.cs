namespace Pitbull.Core.Domain;

/// <summary>
/// Equipment that can be tracked on time entries for job costing.
/// Equipment is tenant-scoped (NOT company-scoped) because equipment is shared
/// across companies - a CAT 320 excavator doesn't belong to one legal entity,
/// it moves between jobsites across companies.
/// </summary>
public class Equipment : BaseEntity
{
    /// <summary>
    /// Unique equipment code within the tenant (e.g., "EX-001", "CR-003")
    /// </summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>
    /// Descriptive name (e.g., "CAT 320 Excavator")
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional longer description
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Category of equipment
    /// </summary>
    public EquipmentType Type { get; set; }

    /// <summary>
    /// Internal hourly charge rate for job costing
    /// </summary>
    public decimal HourlyRate { get; set; }

    /// <summary>
    /// Optional billing rate for T&M contracts (may differ from internal rate)
    /// </summary>
    public decimal? BillingRate { get; set; }

    /// <summary>
    /// Whether the equipment is available for use
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Equipment serial number for tracking
    /// </summary>
    public string? SerialNumber { get; set; }

    /// <summary>
    /// License plate for vehicles
    /// </summary>
    public string? LicensePlate { get; set; }
}

/// <summary>
/// Categories of construction equipment
/// </summary>
public enum EquipmentType
{
    /// <summary>
    /// Excavators, loaders, dozers, cranes
    /// </summary>
    HeavyEquipment = 0,

    /// <summary>
    /// Compactors, generators, pumps
    /// </summary>
    LightEquipment = 1,

    /// <summary>
    /// Trucks, trailers, forklifts
    /// </summary>
    Vehicles = 2,

    /// <summary>
    /// Concrete saws, welders, power tools
    /// </summary>
    Tools = 3,

    /// <summary>
    /// Miscellaneous equipment
    /// </summary>
    Other = 4
}
