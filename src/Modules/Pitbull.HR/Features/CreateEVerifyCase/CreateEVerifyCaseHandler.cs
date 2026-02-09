using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.CreateEVerifyCase;

public class CreateEVerifyCaseHandler : IRequestHandler<CreateEVerifyCaseCommand, Result<EVerifyCaseDto>>
{
    private readonly PitbullDbContext _context;
    private readonly ITenantContext _tenantContext;

    public CreateEVerifyCaseHandler(PitbullDbContext context, ITenantContext tenantContext)
    {
        _context = context;
        _tenantContext = tenantContext;
    }

    public async Task<Result<EVerifyCaseDto>> Handle(CreateEVerifyCaseCommand request, CancellationToken cancellationToken)
    {
        var employee = await _context.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId && !e.IsDeleted, cancellationToken);
        if (employee == null)
            return Result.Failure<EVerifyCaseDto>("Employee not found", "EMPLOYEE_NOT_FOUND");

        // Verify I-9 record if specified
        if (request.I9RecordId.HasValue)
        {
            var i9Exists = await _context.Set<I9Record>()
                .AnyAsync(i => i.Id == request.I9RecordId.Value && !i.IsDeleted, cancellationToken);
            if (!i9Exists)
                return Result.Failure<EVerifyCaseDto>("I-9 record not found", "I9_NOT_FOUND");
        }

        var evCase = new EVerifyCase
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            EmployeeId = request.EmployeeId,
            I9RecordId = request.I9RecordId,
            CaseNumber = request.CaseNumber,
            SubmittedDate = request.SubmittedDate,
            Status = EVerifyStatus.Pending,
            SubmittedBy = request.SubmittedBy,
            Notes = request.Notes,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Set<EVerifyCase>().Add(evCase);
        await _context.SaveChangesAsync(cancellationToken);

        return Result.Success(EVerifyCaseMapper.ToDto(evCase));
    }
}
