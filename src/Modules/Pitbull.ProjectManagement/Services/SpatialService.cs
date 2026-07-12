using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.ProjectManagement.Features;
using Pitbull.Projects.Domain;
using Pitbull.RFIs.Domain;

namespace Pitbull.ProjectManagement.Services;

public class SpatialService : PmServiceBase, ISpatialService
{
    public SpatialService(
        PitbullDbContext db,
        ICompanyContext companyContext,
        IHttpContextAccessor? httpContextAccessor = null)
        : base(db, companyContext, httpContextAccessor)
    {
    }

    public async Task<Result<SpatialGraphResponse>> GetGraphAsync(
        Guid projectId,
        CancellationToken cancellationToken = default)
    {
        if (!await ProjectExistsAsync(projectId, cancellationToken))
            return Result.Failure<SpatialGraphResponse>("Project not found.", "NOT_FOUND");

        var graph = await Db.Set<SpatialGraph>()
            .Where(g => g.ProjectId == projectId
                        && g.Status == SpatialGraphStatus.Published
                        && !g.IsDeleted)
            .OrderByDescending(g => g.Version)
            .FirstOrDefaultAsync(cancellationToken);

        if (graph is null)
        {
            return Result.Success(new SpatialGraphResponse(
                HasGraph: false,
                Message: "No published spatial graph for this project. Seed a zones tree or import geometry later — overlays will stay insufficient until zones exist.",
                GraphId: null,
                ProjectId: projectId,
                GraphName: null,
                Version: null,
                Status: null,
                Nodes: Array.Empty<SpatialNodeDto>()));
        }

        var nodes = await Db.Set<SpatialNode>()
            .Where(n => n.GraphId == graph.Id && !n.IsDeleted)
            .OrderBy(n => n.SortOrder)
            .ThenBy(n => n.Code)
            .ToListAsync(cancellationToken);

        return Result.Success(ToGraphResponse(graph, nodes));
    }

    public async Task<Result<SpatialGraphResponse>> EnsureSeededGraphAsync(
        Guid projectId,
        CancellationToken cancellationToken = default)
    {
        if (!await ProjectExistsAsync(projectId, cancellationToken))
            return Result.Failure<SpatialGraphResponse>("Project not found.", "NOT_FOUND");

        var existing = await GetGraphAsync(projectId, cancellationToken);
        if (existing.IsSuccess && existing.Value!.HasGraph)
            return existing;

        var project = await Db.Set<Project>()
            .FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted, cancellationToken);
        if (project is null)
            return Result.Failure<SpatialGraphResponse>("Project not found.", "NOT_FOUND");

        var companyId = CurrentCompanyId != Guid.Empty
            ? CurrentCompanyId
            : project.CompanyId;

        var graph = new SpatialGraph
        {
            CompanyId = companyId,
            ProjectId = projectId,
            Name = "Primary",
            Version = 1,
            Status = SpatialGraphStatus.Published,
            LengthUnit = SpatialLengthUnit.Meters,
            OriginLatitude = null,
            OriginLongitude = null,
            PublishedAt = DateTime.UtcNow,
            PublishedBy = "system-seed",
            CreatedBy = "system-seed"
        };
        Db.Set<SpatialGraph>().Add(graph);

        // SCB-style zones-first demo tree (no BIM)
        var site = Node(graph, companyId, projectId, null, SpatialNodeType.Site, "SITE", "Jobsite", 0, null);
        var bld = Node(graph, companyId, projectId, site.Id, SpatialNodeType.Building, "BLDG-A", "Building A", 1, null);
        var l1 = Node(graph, companyId, projectId, bld.Id, SpatialNodeType.Storey, "L1", "Level 1", 2, 0);
        var l2 = Node(graph, companyId, projectId, bld.Id, SpatialNodeType.Storey, "L2", "Level 2", 3, 1);
        var z1 = Node(graph, companyId, projectId, l1.Id, SpatialNodeType.Zone, "L1-EAST", "L1 East pour", 4, 0);
        var z2 = Node(graph, companyId, projectId, l1.Id, SpatialNodeType.Zone, "L1-WEST", "L1 West core", 5, 0);
        var z3 = Node(graph, companyId, projectId, l2.Id, SpatialNodeType.Zone, "L2-DECK", "L2 Deck", 6, 1);
        var z4 = Node(graph, companyId, projectId, l2.Id, SpatialNodeType.Zone, "L2-MECH", "L2 Mechanical", 7, 1);

        Db.Set<SpatialNode>().AddRange(site, bld, l1, l2, z1, z2, z3, z4);
        await Db.SaveChangesAsync(cancellationToken);

        return await GetGraphAsync(projectId, cancellationToken);
    }

    public async Task<Result<SpatialOverlayResponse>> GetOverlayAsync(
        Guid projectId,
        string mode,
        DateTime? asOf = null,
        CancellationToken cancellationToken = default)
    {
        var graphResult = await GetGraphAsync(projectId, cancellationToken);
        if (!graphResult.IsSuccess)
            return Result.Failure<SpatialOverlayResponse>(graphResult.Error ?? "Failed to load graph.", graphResult.ErrorCode);

        var asOfDate = (asOf ?? DateTime.UtcNow).ToString("yyyy-MM-dd");
        if (!graphResult.Value!.HasGraph)
        {
            return Result.Success(new SpatialOverlayResponse(
                HasGraph: false,
                Message: graphResult.Value.Message,
                Mode: mode,
                AsOf: asOfDate,
                TruthNote: "No graph — no zone colors (not green by default).",
                Nodes: Array.Empty<SpatialOverlayNodeDto>()));
        }

        // RFI counts: only when RFIs carry SpatialNodeId (column may be null for all legacy rows)
        var rfiCounts = new Dictionary<Guid, int>();
        // Progress / schedule zone links not yet on domain — leave null (honest insufficient)

        // Count open RFIs on project only as context; without zone FK they do not paint zones.
        _ = await Db.Set<Rfi>()
            .Where(r => r.ProjectId == projectId && !r.IsDeleted)
            .CountAsync(cancellationToken);

        var inputs = graphResult.Value.Nodes.Select(n =>
        {
            int? openRfis = null;
            if (n.NodeType == nameof(SpatialNodeType.Zone) && rfiCounts.TryGetValue(n.Id, out var c))
                openRfis = c;
            return new SpatialOverlayCalculator.OverlayInput(
                n.Id,
                n.NodeType,
                OpenRfiCount: openRfis,
                ProgressPercent: null,
                IsScheduleCritical: null,
                DaysBehind: null);
        });

        var computed = SpatialOverlayCalculator.ComputeMany(mode, inputs);
        var dtos = computed.Select(c => new SpatialOverlayNodeDto(
            c.SpatialNodeId,
            c.Band.ToString(),
            c.Label,
            c.Source,
            c.IsProxy,
            c.Formula,
            c.InsufficientReason)).ToList();

        return Result.Success(new SpatialOverlayResponse(
            HasGraph: true,
            Message: null,
            Mode: mode,
            AsOf: asOfDate,
            TruthNote: "Bands marked with * are proxies or insufficient-data labels — never invent default-green health.",
            Nodes: dtos));
    }

    public async Task<Result<IReadOnlyList<SpatialZoneOptionDto>>> ListZonesAsync(
        Guid projectId,
        CancellationToken cancellationToken = default)
    {
        var graphResult = await GetGraphAsync(projectId, cancellationToken);
        if (!graphResult.IsSuccess)
            return Result.Failure<IReadOnlyList<SpatialZoneOptionDto>>(graphResult.Error ?? "Failed.", graphResult.ErrorCode);

        if (!graphResult.Value!.HasGraph)
            return Result.Success<IReadOnlyList<SpatialZoneOptionDto>>(Array.Empty<SpatialZoneOptionDto>());

        var byId = graphResult.Value.Nodes.ToDictionary(n => n.Id);
        IReadOnlyList<SpatialZoneOptionDto> zones = graphResult.Value.Nodes
            .Where(n => n.NodeType == nameof(SpatialNodeType.Zone) && n.IsActive)
            .Select(z =>
            {
                var path = BuildPath(z, byId);
                return new SpatialZoneOptionDto(z.Id, z.Code, z.Name, path);
            })
            .OrderBy(z => z.PathLabel)
            .ToList();

        return Result.Success(zones);
    }

    static string BuildPath(SpatialNodeDto node, Dictionary<Guid, SpatialNodeDto> byId)
    {
        var parts = new List<string> { node.Name };
        var cur = node;
        var guard = 0;
        while (cur.ParentNodeId is Guid pid && byId.TryGetValue(pid, out var parent) && guard++ < 16)
        {
            parts.Add(parent.Name);
            cur = parent;
        }
        parts.Reverse();
        return string.Join(" / ", parts);
    }

    static SpatialNode Node(
        SpatialGraph graph,
        Guid companyId,
        Guid projectId,
        Guid? parentId,
        SpatialNodeType type,
        string code,
        string name,
        int sort,
        int? level)
        => new()
        {
            CompanyId = companyId,
            GraphId = graph.Id,
            ProjectId = projectId,
            ParentNodeId = parentId,
            NodeType = type,
            Code = code,
            Name = name,
            SortOrder = sort,
            LevelIndex = level,
            IsActive = true,
            CreatedBy = "system-seed"
        };

    static SpatialGraphResponse ToGraphResponse(SpatialGraph graph, List<SpatialNode> nodes)
        => new(
            HasGraph: true,
            Message: null,
            GraphId: graph.Id,
            ProjectId: graph.ProjectId,
            GraphName: graph.Name,
            Version: graph.Version,
            Status: graph.Status.ToString(),
            Nodes: nodes.Select(n => new SpatialNodeDto(
                n.Id,
                n.ParentNodeId,
                n.NodeType.ToString(),
                n.Code,
                n.Name,
                n.SortOrder,
                n.LevelIndex,
                n.IsActive,
                n.CentroidX,
                n.CentroidY,
                n.CentroidZ)).ToList());

    async Task<bool> ProjectExistsAsync(Guid projectId, CancellationToken ct)
        => await Db.Set<Project>().AnyAsync(p => p.Id == projectId && !p.IsDeleted, ct);
}
