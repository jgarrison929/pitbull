using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;
using Pitbull.HR.Domain;

namespace Pitbull.HR.Features.CreatePayRate;

public class CreatePayRateHandler : IRequestHandler<CreatePayRateCommand, Result<PayRateDto>>
{
    private readonly PitbullDbContext _context;
    private readonly ITenantContext _tenantContext;

    public CreatePayRateHandler(PitbullDbContext context, ITenantContext tenantContext)
    {
        _context = context;
        _tenantContext = tenantContext;
    }

    public async Task<Result<PayRateDto>> Handle(CreatePayRateCommand request, CancellationToken cancellationToken)
    {
        // Verify employee exists and belongs to tenant
        var employee = await _context.Set<Employee>()
            .FirstOrDefaultAsync(e => e.Id == request.EmployeeId && !e.IsDeleted, cancellationToken);

        if (employee == null)
        {
            return Result.Failure<PayRateDto>("Employee not found", "EMPLOYEE_NOT_FOUND");
        }

        var payRate = new PayRate
        {
            Id = Guid.NewGuid(),
            TenantId = _tenantContext.TenantId,
            EmployeeId = request.EmployeeId,
            Description = request.Description,
            RateType = request.RateType,
            Amount = request.Amount,
            Currency = request.Currency ?? "USD",
            EffectiveDate = request.EffectiveDate,
            ExpirationDate = request.ExpirationDate,
            ProjectId = request.ProjectId,
            ShiftCode = request.ShiftCode,
            WorkState = request.WorkState,
            Priority = request.Priority ?? 10,
            IncludesFringe = request.IncludesFringe,
            FringeRate = request.FringeRate,
            HealthWelfareRate = request.HealthWelfareRate,
            PensionRate = request.PensionRate,
            TrainingRate = request.TrainingRate,
            OtherFringeRate = request.OtherFringeRate,
            Source = request.Source ?? RateSource.Manual,
            Notes = request.Notes,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Set<PayRate>().Add(payRate);
        await _context.SaveChangesAsync(cancellationToken);

        return Result.Success(PayRateMapper.ToDto(payRate));
    }
}
