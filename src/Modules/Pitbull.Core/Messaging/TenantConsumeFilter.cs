using MassTransit;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Core.Messaging;

public class TenantConsumeFilter<T> : IFilter<ConsumeContext<T>> where T : class
{
    private readonly TenantContext _tenantContext;
    private readonly CompanyContext _companyContext;

    public TenantConsumeFilter(TenantContext tenantContext, CompanyContext companyContext)
    {
        _tenantContext = tenantContext;
        _companyContext = companyContext;
    }

    public async Task Send(ConsumeContext<T> context, IPipe<ConsumeContext<T>> next)
    {
        if (context.Headers.TryGetHeader("X-Tenant-Id", out var tenantHeader)
            && Guid.TryParse(tenantHeader?.ToString(), out var tenantId))
        {
            _tenantContext.TenantId = tenantId;
        }

        if (context.Headers.TryGetHeader("X-Company-Id", out var companyHeader)
            && Guid.TryParse(companyHeader?.ToString(), out var companyId))
        {
            _companyContext.CompanyId = companyId;
        }

        await next.Send(context);
    }

    public void Probe(ProbeContext context) => context.CreateFilterScope("tenantConsume");
}
