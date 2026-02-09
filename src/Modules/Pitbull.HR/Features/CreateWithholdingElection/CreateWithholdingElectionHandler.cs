using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.CreateWithholdingElection;

public class CreateWithholdingElectionHandler : IRequestHandler<CreateWithholdingElectionCommand, Result<WithholdingElectionDto>>
{
    private readonly PitbullDbContext _context;
    private readonly ITenantContext _tenantContext;

    public CreateWithholdingElectionHandler(PitbullDbContext context, ITenantContext tenantContext)
    {
        _context = context;
        _tenantContext = tenantContext;
    }

    public async Task<Result<WithholdingElectionDto>> Handle(CreateWithholdingElectionCommand request, CancellationToken cancellationToken)
    {
        var employee = await _context.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId && !e.IsDeleted, cancellationToken);

        if (employee == null)
            return Result.Failure<WithholdingElectionDto>("Employee not found", "EMPLOYEE_NOT_FOUND");

        // Expire any current election for this jurisdiction
        var currentElection = await _context.Set<WithholdingElection>()
            .FirstOrDefaultAsync(w => w.EmployeeId == request.EmployeeId 
                && w.TaxJurisdiction == request.TaxJurisdiction 
                && w.ExpirationDate == null 
                && !w.IsDeleted, cancellationToken);

        if (currentElection != null)
        {
            currentElection.ExpirationDate = request.EffectiveDate.AddDays(-1);
            currentElection.UpdatedAt = DateTime.UtcNow;
        }

        var election = new WithholdingElection
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            EmployeeId = request.EmployeeId,
            TaxJurisdiction = request.TaxJurisdiction.ToUpperInvariant(),
            FilingStatus = request.FilingStatus,
            Allowances = request.Allowances,
            AdditionalWithholding = request.AdditionalWithholding,
            IsExempt = request.IsExempt,
            MultipleJobsOrSpouseWorks = request.MultipleJobsOrSpouseWorks,
            DependentCredits = request.DependentCredits,
            OtherIncome = request.OtherIncome,
            Deductions = request.Deductions,
            EffectiveDate = request.EffectiveDate,
            SignedDate = request.SignedDate,
            Notes = request.Notes,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Set<WithholdingElection>().Add(election);
        await _context.SaveChangesAsync(cancellationToken);

        return Result.Success(WithholdingElectionMapper.ToDto(election));
    }
}
