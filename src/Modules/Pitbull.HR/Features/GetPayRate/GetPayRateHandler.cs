using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.GetPayRate;

public class GetPayRateHandler : IRequestHandler<GetPayRateQuery, Result<PayRateDto>>
{
    private readonly PitbullDbContext _context;

    public GetPayRateHandler(PitbullDbContext context)
    {
        _context = context;
    }

    public async Task<Result<PayRateDto>> Handle(GetPayRateQuery request, CancellationToken cancellationToken)
    {
        var payRate = await _context.Set<PayRate>()
            .FirstOrDefaultAsync(p => p.Id == request.Id && !p.IsDeleted, cancellationToken);

        if (payRate == null)
        {
            return Result.Failure<PayRateDto>("Pay rate not found", "NOT_FOUND");
        }

        return Result.Success(PayRateMapper.ToDto(payRate));
    }
}
