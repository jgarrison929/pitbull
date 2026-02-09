using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.GetCertification;

public class GetCertificationHandler : IRequestHandler<GetCertificationQuery, Result<CertificationDto>>
{
    private readonly PitbullDbContext _context;

    public GetCertificationHandler(PitbullDbContext context)
    {
        _context = context;
    }

    public async Task<Result<CertificationDto>> Handle(GetCertificationQuery request, CancellationToken cancellationToken)
    {
        var certification = await _context.Set<Certification>()
            .FirstOrDefaultAsync(c => c.Id == request.Id && !c.IsDeleted, cancellationToken);

        if (certification == null)
        {
            return Result.Failure<CertificationDto>("Certification not found", "NOT_FOUND");
        }

        return Result.Success(CertificationMapper.ToDto(certification));
    }
}
