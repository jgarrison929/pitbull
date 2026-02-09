using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.CreateI9Record;

public class CreateI9RecordHandler : IRequestHandler<CreateI9RecordCommand, Result<I9RecordDto>>
{
    private readonly PitbullDbContext _context;
    private readonly ITenantContext _tenantContext;

    public CreateI9RecordHandler(PitbullDbContext context, ITenantContext tenantContext)
    {
        _context = context;
        _tenantContext = tenantContext;
    }

    public async Task<Result<I9RecordDto>> Handle(CreateI9RecordCommand request, CancellationToken cancellationToken)
    {
        var employee = await _context.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId && !e.IsDeleted, cancellationToken);
        if (employee == null)
            return Result.Failure<I9RecordDto>("Employee not found", "EMPLOYEE_NOT_FOUND");

        // Check if employee already has an active I-9
        var existingI9 = await _context.Set<I9Record>()
            .AnyAsync(i => i.EmployeeId == request.EmployeeId && !i.IsDeleted, cancellationToken);
        if (existingI9)
            return Result.Failure<I9RecordDto>("Employee already has an I-9 record", "I9_EXISTS");

        var i9 = new I9Record
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            EmployeeId = request.EmployeeId,
            Section1CompletedDate = request.Section1CompletedDate,
            CitizenshipStatus = request.CitizenshipStatus,
            AlienNumber = request.AlienNumber,
            I94Number = request.I94Number,
            ForeignPassportNumber = request.ForeignPassportNumber,
            ForeignPassportCountry = request.ForeignPassportCountry,
            WorkAuthorizationExpires = request.WorkAuthorizationExpires,
            EmploymentStartDate = request.EmploymentStartDate,
            Status = I9Status.Section1Complete,
            Notes = request.Notes,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Set<I9Record>().Add(i9);
        await _context.SaveChangesAsync(cancellationToken);

        return Result.Success(I9RecordMapper.ToDto(i9));
    }
}
