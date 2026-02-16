using MassTransit;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Core.Messaging;

public class TenantPublishFilter<T> : IFilter<PublishContext<T>> where T : class
{
    private readonly ITenantContext _tenantContext;
    private readonly ICompanyContext _companyContext;

    public TenantPublishFilter(ITenantContext tenantContext, ICompanyContext companyContext)
    {
        _tenantContext = tenantContext;
        _companyContext = companyContext;
    }

    public async Task Send(PublishContext<T> context, IPipe<PublishContext<T>> next)
    {
        if (_tenantContext.IsResolved)
            context.Headers.Set("X-Tenant-Id", _tenantContext.TenantId.ToString());

        if (_companyContext.IsResolved)
            context.Headers.Set("X-Company-Id", _companyContext.CompanyId.ToString());

        await next.Send(context);
    }

    public void Probe(ProbeContext context) => context.CreateFilterScope("tenantPublish");
}
