using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.UpdatePayRate;

public class UpdatePayRateHandler : IRequestHandler<UpdatePayRateCommand, Result<PayRateDto>>
{
    private readonly PitbullDbContext _context;

    public UpdatePayRateHandler(PitbullDbContext context)
    {
        _context = context;
    }

    public async Task<Result<PayRateDto>> Handle(UpdatePayRateCommand request, CancellationToken cancellationToken)
    {
        var payRate = await _context.Set<PayRate>()
            .FirstOrDefaultAsync(p => p.Id == request.Id && !p.IsDeleted, cancellationToken);

        if (payRate == null)
        {
            return Result.Failure<PayRateDto>("Pay rate not found", "NOT_FOUND");
        }

        payRate.Description = request.Description;
        payRate.RateType = request.RateType;
        payRate.Amount = request.Amount;
        payRate.Currency = request.Currency ?? "USD";
        payRate.EffectiveDate = request.EffectiveDate;
        payRate.ExpirationDate = request.ExpirationDate;
        payRate.ProjectId = request.ProjectId;
        payRate.ShiftCode = request.ShiftCode;
        payRate.WorkState = request.WorkState;
        payRate.Priority = request.Priority ?? payRate.Priority;
        payRate.IncludesFringe = request.IncludesFringe;
        payRate.FringeRate = request.FringeRate;
        payRate.HealthWelfareRate = request.HealthWelfareRate;
        payRate.PensionRate = request.PensionRate;
        payRate.TrainingRate = request.TrainingRate;
        payRate.OtherFringeRate = request.OtherFringeRate;
        payRate.Source = request.Source ?? payRate.Source;
        payRate.Notes = request.Notes;
        payRate.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return Result.Success(PayRateMapper.ToDto(payRate));
    }
}
