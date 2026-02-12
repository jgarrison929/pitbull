using Pitbull.Core.Domain;

namespace Pitbull.Contracts.Domain;

/// <summary>
/// Subcontract agreement with a subcontractor for a specific project.
/// Tracks scope, value, and status of the agreement.
/// </summary>
public class Subcontract : BaseEntity
{
    public Guid ProjectId { get; set; }
    public string SubcontractNumber { get; set; } = string.Empty; // e.g. "SC-2026-001"

    // Subcontractor info
    public string SubcontractorName { get; set; } = string.Empty;
    public string? SubcontractorContact { get; set; }
    public string? SubcontractorEmail { get; set; }
    public string? SubcontractorPhone { get; set; }
    public string? SubcontractorAddress { get; set; }

    // Scope
    public string ScopeOfWork { get; set; } = string.Empty;
    public string? TradeCode { get; set; } // e.g. "03 - Concrete", "09 - Finishes"

    // Contract values
    public decimal OriginalValue { get; set; }
    public decimal CurrentValue { get; set; } // Original + approved change orders
    public decimal BilledToDate { get; set; }
    public decimal PaidToDate { get; set; }
    public decimal RetainagePercent { get; set; } = 10m; // Default 10%
    public decimal RetainageHeld { get; set; }

    // Dates
    public DateTime? ExecutionDate { get; set; } // When signed
    public DateTime? StartDate { get; set; }
    public DateTime? CompletionDate { get; set; }
    public DateTime? ActualCompletionDate { get; set; }

    // Status
    public SubcontractStatus Status { get; set; } = SubcontractStatus.Draft;

    // Insurance/compliance
    public DateTime? InsuranceExpirationDate { get; set; }
    public bool InsuranceCurrent { get; set; }
    public string? LicenseNumber { get; set; }

    // Notes
    public string? Notes { get; set; }

    // Navigation
    public ICollection<ChangeOrder> ChangeOrders { get; set; } = [];
}
