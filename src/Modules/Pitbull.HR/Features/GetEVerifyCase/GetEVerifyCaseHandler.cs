using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.GetEVerifyCase;

public class GetEVerifyCaseHandler : IRequestHandler<GetEVerifyCaseQuery, Result<EVerifyCaseDto>>
{
    private readonly PitbullDbContext _context;
    public GetEVerifyCaseHandler(PitbullDbContext context) => _context = context;

    public async Task<Result<EVerifyCaseDto>> Handle(GetEVerifyCaseQuery request, CancellationToken cancellationToken)
    {
        var evCase = await _context.Set<EVerifyCase>()
            .FirstOrDefaultAsync(e => e.Id == request.Id && !e.IsDeleted, cancellationToken);
        if (evCase == null)
            return Result.Failure<EVerifyCaseDto>("E-Verify case not found", "NOT_FOUND");
        return Result.Success(EVerifyCaseMapper.ToDto(evCase));
    }
}
