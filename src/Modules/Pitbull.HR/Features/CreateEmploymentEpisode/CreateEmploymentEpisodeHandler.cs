using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.CreateEmploymentEpisode;

public class CreateEmploymentEpisodeHandler : IRequestHandler<CreateEmploymentEpisodeCommand, Result<EmploymentEpisodeDto>>
{
    private readonly PitbullDbContext _context;
    private readonly ITenantContext _tenantContext;

    public CreateEmploymentEpisodeHandler(PitbullDbContext context, ITenantContext tenantContext)
    {
        _context = context;
        _tenantContext = tenantContext;
    }

    public async Task<Result<EmploymentEpisodeDto>> Handle(CreateEmploymentEpisodeCommand request, CancellationToken cancellationToken)
    {
        var employee = await _context.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId && !e.IsDeleted, cancellationToken);

        if (employee == null)
            return Result.Failure<EmploymentEpisodeDto>("Employee not found", "EMPLOYEE_NOT_FOUND");

        // Check for active episode
        var hasActiveEpisode = await _context.Set<EmploymentEpisode>()
            .AnyAsync(ep => ep.EmployeeId == request.EmployeeId 
                && ep.TerminationDate == null 
                && !ep.IsDeleted, cancellationToken);

        if (hasActiveEpisode)
            return Result.Failure<EmploymentEpisodeDto>("Employee already has an active employment episode", "ACTIVE_EPISODE_EXISTS");

        // Get next episode number
        var maxEpisode = await _context.Set<EmploymentEpisode>()
            .Where(ep => ep.EmployeeId == request.EmployeeId && !ep.IsDeleted)
            .MaxAsync(ep => (int?)ep.EpisodeNumber, cancellationToken) ?? 0;

        var episode = new EmploymentEpisode
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            EmployeeId = request.EmployeeId,
            EpisodeNumber = maxEpisode + 1,
            HireDate = request.HireDate,
            UnionDispatchReference = request.UnionDispatchReference,
            JobClassificationAtHire = request.JobClassificationAtHire,
            HourlyRateAtHire = request.HourlyRateAtHire,
            PositionAtHire = request.PositionAtHire,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Set<EmploymentEpisode>().Add(episode);
        await _context.SaveChangesAsync(cancellationToken);

        return Result.Success(EmploymentEpisodeMapper.ToDto(episode));
    }
}
