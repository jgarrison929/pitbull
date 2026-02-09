using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.UpdateDeduction;

public class UpdateDeductionHandler : IRequestHandler<UpdateDeductionCommand, Result<DeductionDto>>
{
    private readonly PitbullDbContext _context;
    public UpdateDeductionHandler(PitbullDbContext context) => _context = context;

    public async Task<Result<DeductionDto>> Handle(UpdateDeductionCommand request, CancellationToken cancellationToken)
    {
        var deduction = await _context.Set<Deduction>()
            .FirstOrDefaultAsync(d => d.Id == request.Id && !d.IsDeleted, cancellationToken);

        if (deduction == null)
            return Result.Failure<DeductionDto>("Deduction not found", "NOT_FOUND");

        deduction.Description = request.Description;
        deduction.Method = request.Method;
        deduction.Amount = request.Amount;
        deduction.MaxPerPeriod = request.MaxPerPeriod;
        deduction.AnnualMax = request.AnnualMax;
        deduction.Priority = request.Priority ?? deduction.Priority;
        deduction.IsPreTax = request.IsPreTax;
        deduction.EmployerMatch = request.EmployerMatch;
        deduction.EmployerMatchMax = request.EmployerMatchMax;
        deduction.ExpirationDate = request.ExpirationDate;
        deduction.CaseNumber = request.CaseNumber;
        deduction.GarnishmentPayee = request.GarnishmentPayee;
        deduction.Notes = request.Notes;
        deduction.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return Result.Success(DeductionMapper.ToDto(deduction));
    }
}
