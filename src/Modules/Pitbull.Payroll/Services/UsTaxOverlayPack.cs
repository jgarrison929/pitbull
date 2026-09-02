using Microsoft.Extensions.DependencyInjection;

namespace Pitbull.Payroll.Services;

/// <summary>
/// Overlay pack <c>us_tax</c>: DI registrations only. PayrollRunService must not branch on jurisdiction.
/// </summary>
public static class UsTaxOverlayPack
{
    public const string Name = "us_tax";

    public static IServiceCollection AddUsTaxOverlayPack(this IServiceCollection services)
    {
        services.AddScoped<IPayrollTaxEngine, CheckPayrollTaxEngine>();
        return services;
    }
}
