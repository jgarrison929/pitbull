using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.GetI9Record;

public class GetI9RecordHandler : IRequestHandler<GetI9RecordQuery, Result<I9RecordDto>>
{
    private readonly PitbullDbContext _context;
    public GetI9RecordHandler(PitbullDbContext context) => _context = context;

    public async Task<Result<I9RecordDto>> Handle(GetI9RecordQuery request, CancellationToken cancellationToken)
    {
        var i9 = await _context.Set<I9Record>()
            .FirstOrDefaultAsync(i => i.Id == request.Id && !i.IsDeleted, cancellationToken);
        if (i9 == null)
            return Result.Failure<I9RecordDto>("I-9 record not found", "NOT_FOUND");
        return Result.Success(I9RecordMapper.ToDto(i9));
    }
}
