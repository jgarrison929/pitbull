using Pitbull.ProjectManagement.Features;

namespace Pitbull.ProjectManagement.Domain;

/// <summary>
/// Shared guards for PM upsert requests — status must flow through transition graphs, not generic upsert.
/// </summary>
public static class PmUpsertRequestMapper
{
    public static bool RequestsStatusChange(PmUpsertRequest request)
    {
        if (!string.IsNullOrWhiteSpace(request.Status))
            return true;

        return request.Data is not null
               && request.Data.Keys.Any(k => k.Equals("Status", StringComparison.OrdinalIgnoreCase));
    }
}