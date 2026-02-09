using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.UpdateEVerifyCase;

public class UpdateEVerifyCaseHandler : IRequestHandler<UpdateEVerifyCaseCommand, Result<EVerifyCaseDto>>
{
    private readonly PitbullDbContext _context;
    public UpdateEVerifyCaseHandler(PitbullDbContext context) => _context = context;

    public async Task<Result<EVerifyCaseDto>> Handle(UpdateEVerifyCaseCommand request, CancellationToken cancellationToken)
    {
        var evCase = await _context.Set<EVerifyCase>()
            .FirstOrDefaultAsync(e => e.Id == request.Id && !e.IsDeleted, cancellationToken);
        if (evCase == null)
            return Result.Failure<EVerifyCaseDto>("E-Verify case not found", "NOT_FOUND");

        if (request.Status.HasValue) evCase.Status = request.Status.Value;
        if (request.Result.HasValue) evCase.Result = request.Result.Value;
        if (request.LastStatusDate.HasValue) evCase.LastStatusDate = request.LastStatusDate;
        if (request.ClosedDate.HasValue) evCase.ClosedDate = request.ClosedDate;
        if (request.TNCDeadline.HasValue) evCase.TNCDeadline = request.TNCDeadline;
        if (request.TNCContested.HasValue) evCase.TNCContested = request.TNCContested;
        if (request.PhotoMatched.HasValue) evCase.PhotoMatched = request.PhotoMatched;
        if (request.SSAResult.HasValue) evCase.SSAResult = request.SSAResult;
        if (request.DHSResult.HasValue) evCase.DHSResult = request.DHSResult;
        if (request.Notes != null) evCase.Notes = request.Notes;
        evCase.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return Result.Success(EVerifyCaseMapper.ToDto(evCase));
    }
}
