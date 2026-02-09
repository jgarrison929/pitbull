using Pitbull.HR.Domain;

namespace Pitbull.HR.Features;

/// <summary>
/// Maps EmergencyContact domain entities to DTOs.
/// </summary>
public static class EmergencyContactMapper
{
    public static EmergencyContactDto ToDto(EmergencyContact contact)
    {
        return new EmergencyContactDto(
            Id: contact.Id,
            EmployeeId: contact.EmployeeId,
            Name: contact.Name,
            Relationship: contact.Relationship,
            PrimaryPhone: contact.PrimaryPhone,
            SecondaryPhone: contact.SecondaryPhone,
            Email: contact.Email,
            Priority: contact.Priority,
            Notes: contact.Notes,
            CreatedAt: contact.CreatedAt,
            UpdatedAt: contact.UpdatedAt
        );
    }

    public static EmergencyContactListDto ToListDto(EmergencyContact contact, string employeeName)
    {
        return new EmergencyContactListDto(
            Id: contact.Id,
            EmployeeId: contact.EmployeeId,
            EmployeeName: employeeName,
            Name: contact.Name,
            Relationship: contact.Relationship,
            PrimaryPhone: contact.PrimaryPhone,
            Priority: contact.Priority
        );
    }
}
