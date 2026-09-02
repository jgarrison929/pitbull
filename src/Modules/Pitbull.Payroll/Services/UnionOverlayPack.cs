using Microsoft.Extensions.DependencyInjection;

namespace Pitbull.Payroll.Services;

/// <summary>
/// Overlay pack <c>union</c>: DI registrations only. No jurisdiction if-branches in PayrollRunService.
/// </summary>
public static class UnionOverlayPack
{
    public const string Name = "union";

    public static IServiceCollection AddUnionOverlayPack(this IServiceCollection services)
    {
        services.AddScoped<IWageRateResolver, WageRateResolver>();
        services.AddScoped<Pitbull.TimeTracking.Services.ILaborCostRateSource, PayrollLaborCostRateSource>();
        return services;
    }
}
