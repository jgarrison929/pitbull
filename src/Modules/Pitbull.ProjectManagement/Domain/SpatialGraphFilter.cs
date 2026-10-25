namespace Pitbull.ProjectManagement.Domain;

/// <summary>
/// Pure filter helpers for twin tree / overlay scope (storey + date window).
/// No I/O — unit-tested with fixtures.
/// </summary>
public static class SpatialGraphFilter
{
    public sealed record NodeRef(
        Guid Id,
        Guid? ParentNodeId,
        string NodeType,
        string Code);

    /// <summary>
    /// When storeyNodeId is null, return all zone ids.
    /// When set, return zone ids whose ancestor chain includes that storey.
    /// </summary>
    public static HashSet<Guid> ZoneIdsUnderStorey(
        IReadOnlyList<NodeRef> nodes,
        Guid? storeyNodeId)
    {
        if (storeyNodeId is null)
            return nodes.Where(n => n.NodeType == nameof(SpatialNodeType.Zone)).Select(n => n.Id).ToHashSet();

        var byId = nodes.ToDictionary(n => n.Id);
        if (!byId.ContainsKey(storeyNodeId.Value))
            return new HashSet<Guid>();

        var under = new HashSet<Guid>();
        // BFS descendants of storey
        var queue = new Queue<Guid>();
        queue.Enqueue(storeyNodeId.Value);
        while (queue.Count > 0)
        {
            var cur = queue.Dequeue();
            foreach (var child in nodes.Where(n => n.ParentNodeId == cur))
            {
                if (under.Add(child.Id))
                    queue.Enqueue(child.Id);
            }
        }

        return nodes
            .Where(n => n.NodeType == nameof(SpatialNodeType.Zone) && under.Contains(n.Id))
            .Select(n => n.Id)
            .ToHashSet();
    }

    /// <summary>
    /// Inclusive calendar-day window in UTC. Null bounds are open-ended.
    /// </summary>
    public static bool DateInWindow(DateTime dateUtc, DateTime? fromUtc, DateTime? toUtc)
    {
        var d = dateUtc.Date;
        if (fromUtc is DateTime f && d < f.ToUniversalTime().Date)
            return false;
        if (toUtc is DateTime t && d > t.ToUniversalTime().Date)
            return false;
        return true;
    }
}
