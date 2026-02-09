using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.GetWithholdingElection;

public class GetWithholdingElectionHandler : IRequestHandler<GetWithholdingElectionQuery, Result<WithholdingElectionDto>>
{
    private readonly PitbullDbContext _context;

    public GetWithholdingElectionHandler(PitbullDbContext context) => _context = context;

    public async Task<Result<WithholdingElectionDto>> Handle(GetWithholdingElectionQuery request, CancellationToken cancellationToken)
    {
        var election = await _context.Set<WithholdingElection>()
            .FirstOrDefaultAsync(w => w.Id == request.Id && !w.IsDeleted, cancellationToken);

        if (election == null)
            return Result.Failure<WithholdingElectionDto>("Withholding election not found", "NOT_FOUND");

        return Result.Success(WithholdingElectionMapper.ToDto(election));
    }
}
