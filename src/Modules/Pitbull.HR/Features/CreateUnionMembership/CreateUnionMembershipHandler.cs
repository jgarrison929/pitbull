using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.CreateUnionMembership;

public class CreateUnionMembershipHandler : IRequestHandler<CreateUnionMembershipCommand, Result<UnionMembershipDto>>
{
    private readonly PitbullDbContext _context;
    private readonly ITenantContext _tenantContext;

    public CreateUnionMembershipHandler(PitbullDbContext context, ITenantContext tenantContext)
    {
        _context = context;
        _tenantContext = tenantContext;
    }

    public async Task<Result<UnionMembershipDto>> Handle(CreateUnionMembershipCommand request, CancellationToken cancellationToken)
    {
        var employee = await _context.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId && !e.IsDeleted, cancellationToken);
        if (employee == null)
            return Result.Failure<UnionMembershipDto>("Employee not found", "EMPLOYEE_NOT_FOUND");

        var membership = new UnionMembership
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            EmployeeId = request.EmployeeId,
            UnionLocal = request.UnionLocal,
            MembershipNumber = request.MembershipNumber,
            Classification = request.Classification,
            ApprenticeLevel = request.ApprenticeLevel,
            JoinDate = request.JoinDate,
            DuesPaid = request.DuesPaid,
            DuesPaidThrough = request.DuesPaidThrough,
            DispatchNumber = request.DispatchNumber,
            DispatchDate = request.DispatchDate,
            DispatchListPosition = request.DispatchListPosition,
            FringeRate = request.FringeRate,
            HealthWelfareRate = request.HealthWelfareRate,
            PensionRate = request.PensionRate,
            TrainingRate = request.TrainingRate,
            EffectiveDate = request.EffectiveDate,
            Notes = request.Notes,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Set<UnionMembership>().Add(membership);
        await _context.SaveChangesAsync(cancellationToken);

        return Result.Success(UnionMembershipMapper.ToDto(membership));
    }
}
