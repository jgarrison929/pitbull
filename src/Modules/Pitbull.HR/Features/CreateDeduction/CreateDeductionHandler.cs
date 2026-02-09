using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.CreateDeduction;

public class CreateDeductionHandler : IRequestHandler<CreateDeductionCommand, Result<DeductionDto>>
{
    private readonly PitbullDbContext _context;
    private readonly ITenantContext _tenantContext;

    public CreateDeductionHandler(PitbullDbContext context, ITenantContext tenantContext)
    {
        _context = context;
        _tenantContext = tenantContext;
    }

    public async Task<Result<DeductionDto>> Handle(CreateDeductionCommand request, CancellationToken cancellationToken)
    {
        var employee = await _context.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId && !e.IsDeleted, cancellationToken);

        if (employee == null)
            return Result.Failure<DeductionDto>("Employee not found", "EMPLOYEE_NOT_FOUND");

        var deduction = new Deduction
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            EmployeeId = request.EmployeeId,
            DeductionCode = request.DeductionCode.ToUpperInvariant(),
            Description = request.Description,
            Method = request.Method,
            Amount = request.Amount,
            MaxPerPeriod = request.MaxPerPeriod,
            AnnualMax = request.AnnualMax,
            Priority = request.Priority ?? 50,
            IsPreTax = request.IsPreTax,
            EmployerMatch = request.EmployerMatch,
            EmployerMatchMax = request.EmployerMatchMax,
            EffectiveDate = request.EffectiveDate,
            CaseNumber = request.CaseNumber,
            GarnishmentPayee = request.GarnishmentPayee,
            Notes = request.Notes,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Set<Deduction>().Add(deduction);
        await _context.SaveChangesAsync(cancellationToken);

        return Result.Success(DeductionMapper.ToDto(deduction));
    }
}
