using Pitbull.HR.Domain;

namespace Pitbull.HR.Features;

/// <summary>
/// Maps PayRate domain entities to DTOs.
/// </summary>
public static class PayRateMapper
{
    public static PayRateDto ToDto(PayRate rate)
    {
        return new PayRateDto(
            Id: rate.Id,
            EmployeeId: rate.EmployeeId,
            Description: rate.Description,
            RateType: rate.RateType.ToString(),
            Amount: rate.Amount,
            Currency: rate.Currency,
            EffectiveDate: rate.EffectiveDate,
            ExpirationDate: rate.ExpirationDate,
            ProjectId: rate.ProjectId,
            ShiftCode: rate.ShiftCode,
            WorkState: rate.WorkState,
            Priority: rate.Priority,
            IncludesFringe: rate.IncludesFringe,
            FringeRate: rate.FringeRate,
            HealthWelfareRate: rate.HealthWelfareRate,
            PensionRate: rate.PensionRate,
            TrainingRate: rate.TrainingRate,
            OtherFringeRate: rate.OtherFringeRate,
            TotalHourlyCost: rate.TotalHourlyCost,
            Source: rate.Source.ToString(),
            Notes: rate.Notes,
            CreatedAt: rate.CreatedAt,
            UpdatedAt: rate.UpdatedAt
        );
    }

    public static PayRateListDto ToListDto(PayRate rate, string employeeName)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return new PayRateListDto(
            Id: rate.Id,
            EmployeeId: rate.EmployeeId,
            EmployeeName: employeeName,
            Description: rate.Description,
            RateType: rate.RateType.ToString(),
            Amount: rate.Amount,
            TotalHourlyCost: rate.TotalHourlyCost,
            EffectiveDate: rate.EffectiveDate,
            ExpirationDate: rate.ExpirationDate,
            IsActive: rate.IsActive(today)
        );
    }
}
