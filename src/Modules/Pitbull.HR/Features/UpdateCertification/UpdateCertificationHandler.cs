using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.UpdateCertification;

public class UpdateCertificationHandler : IRequestHandler<UpdateCertificationCommand, Result<CertificationDto>>
{
    private readonly PitbullDbContext _context;

    public UpdateCertificationHandler(PitbullDbContext context)
    {
        _context = context;
    }

    public async Task<Result<CertificationDto>> Handle(UpdateCertificationCommand request, CancellationToken cancellationToken)
    {
        var certification = await _context.Set<Certification>()
            .FirstOrDefaultAsync(c => c.Id == request.Id && !c.IsDeleted, cancellationToken);

        if (certification == null)
        {
            return Result.Failure<CertificationDto>("Certification not found", "NOT_FOUND");
        }

        // Check for duplicate if changing type
        if (request.CertificationTypeCode != certification.CertificationTypeCode)
        {
            var exists = await _context.Set<Certification>()
                .AnyAsync(c => c.EmployeeId == certification.EmployeeId 
                    && c.CertificationTypeCode == request.CertificationTypeCode 
                    && c.Id != request.Id
                    && !c.IsDeleted, cancellationToken);

            if (exists)
            {
                return Result.Failure<CertificationDto>(
                    "Employee already has this certification type",
                    "DUPLICATE_CERTIFICATION");
            }
        }

        certification.CertificationTypeCode = request.CertificationTypeCode;
        certification.CertificationName = request.CertificationName;
        certification.CertificateNumber = request.CertificateNumber;
        certification.IssuingAuthority = request.IssuingAuthority;
        certification.IssueDate = request.IssueDate;
        certification.ExpirationDate = request.ExpirationDate;
        
        if (request.Status.HasValue)
        {
            certification.Status = request.Status.Value;
        }
        
        certification.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return Result.Success(CertificationMapper.ToDto(certification));
    }
}
