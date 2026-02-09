using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.CreateEmergencyContact;

public class CreateEmergencyContactHandler : IRequestHandler<CreateEmergencyContactCommand, Result<EmergencyContactDto>>
{
    private readonly PitbullDbContext _context;
    private readonly ITenantContext _tenantContext;

    public CreateEmergencyContactHandler(PitbullDbContext context, ITenantContext tenantContext)
    {
        _context = context;
        _tenantContext = tenantContext;
    }

    public async Task<Result<EmergencyContactDto>> Handle(CreateEmergencyContactCommand request, CancellationToken cancellationToken)
    {
        // Verify employee exists
        var employee = await _context.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId && !e.IsDeleted, cancellationToken);

        if (employee == null)
        {
            return Result.Failure<EmergencyContactDto>("Employee not found", "EMPLOYEE_NOT_FOUND");
        }

        // Auto-assign priority if not specified
        var priority = request.Priority ?? 1;
        if (request.Priority == null)
        {
            var maxPriority = await _context.Set<EmergencyContact>()
                .Where(c => c.EmployeeId == request.EmployeeId && !c.IsDeleted)
                .MaxAsync(c => (int?)c.Priority, cancellationToken) ?? 0;
            priority = maxPriority + 1;
        }

        var contact = new EmergencyContact
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            EmployeeId = request.EmployeeId,
            Name = request.Name,
            Relationship = request.Relationship,
            PrimaryPhone = request.PrimaryPhone,
            SecondaryPhone = request.SecondaryPhone,
            Email = request.Email,
            Priority = priority,
            Notes = request.Notes,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Set<EmergencyContact>().Add(contact);
        await _context.SaveChangesAsync(cancellationToken);

        return Result.Success(EmergencyContactMapper.ToDto(contact));
    }
}
