namespace Pitbull.HR.Features;

/// <summary>
/// DTO for employee emergency contact data.
/// </summary>
public record EmergencyContactDto(
    Guid Id,
    Guid EmployeeId,
    string Name,
    string Relationship,
    string PrimaryPhone,
    string? SecondaryPhone,
    string? Email,
    int Priority,
    string? Notes,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

/// <summary>
/// Lightweight DTO for emergency contact lists.
/// </summary>
public record EmergencyContactListDto(
    Guid Id,
    Guid EmployeeId,
    string EmployeeName,
    string Name,
    string Relationship,
    string PrimaryPhone,
    int Priority
);
