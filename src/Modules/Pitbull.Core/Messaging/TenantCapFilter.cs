using DotNetCore.CAP.Filter;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Core.Messaging;

public class TenantCapFilter : SubscribeFilter
{
    private readonly TenantContext _tenantContext;
    private readonly CompanyContext _companyContext;

    public TenantCapFilter(TenantContext tenantContext, CompanyContext companyContext)
    {
        _tenantContext = tenantContext;
        _companyContext = companyContext;
    }

    public override Task OnSubscribeExecutingAsync(ExecutingContext context)
    {
        if (context.DeliverMessage.Headers.TryGetValue("X-Tenant-Id", out var tenantHeader)
            && Guid.TryParse(tenantHeader?.ToString(), out var tenantId))
        {
            _tenantContext.TenantId = tenantId;
        }

        if (context.DeliverMessage.Headers.TryGetValue("X-Company-Id", out var companyHeader)
            && Guid.TryParse(companyHeader?.ToString(), out var companyId))
        {
            _companyContext.CompanyId = companyId;
        }

        return Task.CompletedTask;
    }

    public override Task OnSubscribeExecutedAsync(ExecutedContext context)
    {
        return Task.CompletedTask;
    }

    public override Task OnSubscribeExceptionAsync(ExceptionContext context)
    {
        return Task.CompletedTask;
    }
}
