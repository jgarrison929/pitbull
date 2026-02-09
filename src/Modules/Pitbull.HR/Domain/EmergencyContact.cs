using Pitbull.Core.Domain;

namespace Pitbull.HR.Domain;

/// <summary>
/// Employee emergency contact information.
/// </summary>
public class EmergencyContact : BaseEntity
{
    /// <summary>
    /// Parent employee.
    /// </summary>
    public Guid EmployeeId { get; set; }
    
    /// <summary>
    /// Contact's full name.
    /// </summary>
    public string Name { get; set; } = string.Empty;
    
    /// <summary>
    /// Relationship to employee (e.g., "Spouse", "Parent", "Sibling").
    /// </summary>
    public string Relationship { get; set; } = string.Empty;
    
    /// <summary>
    /// Primary phone number.
    /// </summary>
    public string PrimaryPhone { get; set; } = string.Empty;
    
    /// <summary>
    /// Secondary phone number.
    /// </summary>
    public string? SecondaryPhone { get; set; }
    
    /// <summary>
    /// Email address.
    /// </summary>
    public string? Email { get; set; }
    
    /// <summary>
    /// Contact priority (1 = primary, 2 = secondary, etc.)
    /// </summary>
    public int Priority { get; set; } = 1;
    
    /// <summary>
    /// Notes about this contact.
    /// </summary>
    public string? Notes { get; set; }
    
    // Navigation
    public Employee Employee { get; set; } = null!;
}
