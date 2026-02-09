using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.GetDeduction;

public class GetDeductionHandler : IRequestHandler<GetDeductionQuery, Result<DeductionDto>>
{
    private readonly PitbullDbContext _context;
    public GetDeductionHandler(PitbullDbContext context) => _context = context;

    public async Task<Result<DeductionDto>> Handle(GetDeductionQuery request, CancellationToken cancellationToken)
    {
        var deduction = await _context.Set<Deduction>()
            .FirstOrDefaultAsync(d => d.Id == request.Id && !d.IsDeleted, cancellationToken);

        if (deduction == null)
            return Result.Failure<DeductionDto>("Deduction not found", "NOT_FOUND");

        return Result.Success(DeductionMapper.ToDto(deduction));
    }
}
