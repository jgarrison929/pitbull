using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.CreateCertification;

public class CreateCertificationHandler : IRequestHandler<CreateCertificationCommand, Result<CertificationDto>>
{
    private readonly PitbullDbContext _context;
    private readonly ITenantContext _tenantContext;

    public CreateCertificationHandler(PitbullDbContext context, ITenantContext tenantContext)
    {
        _context = context;
        _tenantContext = tenantContext;
    }

    public async Task<Result<CertificationDto>> Handle(CreateCertificationCommand request, CancellationToken cancellationToken)
    {
        // Verify employee exists and belongs to tenant
        var employee = await _context.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId && !e.IsDeleted, cancellationToken);

        if (employee == null)
        {
            return Result.Failure<CertificationDto>("Employee not found", "EMPLOYEE_NOT_FOUND");
        }

        // Check for duplicate certification (same type + employee)
        var exists = await _context.Set<Certification>()
            .AnyAsync(c => c.EmployeeId == request.EmployeeId 
                && c.CertificationTypeCode == request.CertificationTypeCode 
                && !c.IsDeleted, cancellationToken);

        if (exists)
        {
            return Result.Failure<CertificationDto>(
                "Employee already has this certification type",
                "DUPLICATE_CERTIFICATION");
        }

        var certification = new Certification
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            EmployeeId = request.EmployeeId,
            CertificationTypeCode = request.CertificationTypeCode,
            CertificationName = request.CertificationName,
            CertificateNumber = request.CertificateNumber,
            IssuingAuthority = request.IssuingAuthority,
            IssueDate = request.IssueDate,
            ExpirationDate = request.ExpirationDate,
            Status = CertificationStatus.Pending,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Set<Certification>().Add(certification);
        await _context.SaveChangesAsync(cancellationToken);

        return Result.Success(CertificationMapper.ToDto(certification));
    }
}
