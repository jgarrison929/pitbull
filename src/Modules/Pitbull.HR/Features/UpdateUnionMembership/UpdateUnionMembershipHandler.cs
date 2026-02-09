using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.UpdateUnionMembership;

public class UpdateUnionMembershipHandler : IRequestHandler<UpdateUnionMembershipCommand, Result<UnionMembershipDto>>
{
    private readonly PitbullDbContext _context;
    public UpdateUnionMembershipHandler(PitbullDbContext context) => _context = context;

    public async Task<Result<UnionMembershipDto>> Handle(UpdateUnionMembershipCommand request, CancellationToken cancellationToken)
    {
        var membership = await _context.Set<UnionMembership>()
            .FirstOrDefaultAsync(u => u.Id == request.Id && !u.IsDeleted, cancellationToken);
        if (membership == null)
            return Result.Failure<UnionMembershipDto>("Union membership not found", "NOT_FOUND");

        membership.Classification = request.Classification;
        membership.ApprenticeLevel = request.ApprenticeLevel;
        membership.DuesPaid = request.DuesPaid;
        membership.DuesPaidThrough = request.DuesPaidThrough;
        membership.DispatchNumber = request.DispatchNumber;
        membership.DispatchDate = request.DispatchDate;
        membership.DispatchListPosition = request.DispatchListPosition;
        membership.FringeRate = request.FringeRate;
        membership.HealthWelfareRate = request.HealthWelfareRate;
        membership.PensionRate = request.PensionRate;
        membership.TrainingRate = request.TrainingRate;
        membership.ExpirationDate = request.ExpirationDate;
        membership.Notes = request.Notes;
        membership.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return Result.Success(UnionMembershipMapper.ToDto(membership));
    }
}
