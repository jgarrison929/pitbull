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
        {
            // Still ensure demo fuel links exist for overlay paint demos
            await EnsureDemoOverlayFuelAsync(projectId, existing.Value, cancellationToken);
            return await GetGraphAsync(projectId, cancellationToken);
        }

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

        var seeded = await GetGraphAsync(projectId, cancellationToken);
        if (seeded.IsSuccess && seeded.Value is not null)
            await EnsureDemoOverlayFuelAsync(projectId, seeded.Value, cancellationToken);

        return await GetGraphAsync(projectId, cancellationToken);
    }

    public async Task<Result<SpatialOverlayResponse>> GetOverlayAsync(
        Guid projectId,
        string mode,
        DateTime? asOf = null,
        Guid? storeyNodeId = null,
        DateTime? from = null,
        DateTime? to = null,
        CancellationToken cancellationToken = default)
    {
        var graphResult = await GetGraphAsync(projectId, cancellationToken);
        if (!graphResult.IsSuccess)
            return Result.Failure<SpatialOverlayResponse>(graphResult.Error ?? "Failed to load graph.", graphResult.ErrorCode);

        var asOfUtc = asOf?.ToUniversalTime() ?? DateTime.UtcNow;
        var asOfDate = asOfUtc.ToString("yyyy-MM-dd");
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

        var nodeRefs = graphResult.Value.Nodes
            .Select(n => new SpatialGraphFilter.NodeRef(n.Id, n.ParentNodeId, n.NodeType, n.Code))
            .ToList();
        var zoneIds = SpatialGraphFilter.ZoneIdsUnderStorey(nodeRefs, storeyNodeId);

        var rfiCounts = await LoadOpenRfiCountsByZoneAsync(projectId, zoneIds, from, to, cancellationToken);
        var progressByZone = await LoadProgressPercentByZoneAsync(projectId, zoneIds, asOfUtc, from, to, cancellationToken);
        var scheduleByZone = await LoadScheduleSignalsByZoneAsync(projectId, zoneIds, asOfUtc, cancellationToken);

        // Only emit overlay rows for in-scope zones (+ ancestors for tree context as Insufficient)
        var inputs = graphResult.Value.Nodes
            .Where(n => n.NodeType != nameof(SpatialNodeType.Zone) || zoneIds.Contains(n.Id))
            .Select(n =>
            {
                int? openRfis = null;
                decimal? progress = null;
                bool? critical = null;
                int? daysBehind = null;

                if (n.NodeType == nameof(SpatialNodeType.Zone) && zoneIds.Contains(n.Id))
                {
                    if (rfiCounts.TryGetValue(n.Id, out var c))
                        openRfis = c;
                    if (progressByZone.TryGetValue(n.Id, out var p))
                        progress = p;
                    if (scheduleByZone.TryGetValue(n.Id, out var s))
                    {
                        critical = s.IsCritical;
                        daysBehind = s.DaysBehind;
                    }
                }

                return new SpatialOverlayCalculator.OverlayInput(
                    n.Id,
                    n.NodeType,
                    OpenRfiCount: openRfis,
                    ProgressPercent: progress,
                    IsScheduleCritical: critical,
                    DaysBehind: daysBehind);
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

        var filterNote = storeyNodeId is null && from is null && to is null
            ? ""
            : " Filtered by storey and/or date window when provided.";

        return Result.Success(new SpatialOverlayResponse(
            HasGraph: true,
            Message: null,
            Mode: mode,
            AsOf: asOfDate,
            TruthNote: "Bands marked with * are proxies or insufficient-data labels — never invent default-green health. Colors only appear when RFIs/progress/schedule rows carry SpatialNodeId (or PrimarySpatialNodeId)." + filterNote,
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

    public Task<Result<TwinPhotoPinsResponse>> ListPhotoPinsAsync(
        Guid projectId,
        Guid? spatialNodeId = null,
        CancellationToken cancellationToken = default)
    {
        // 2.15.3 stub: contract + honest empty. Aggregation of real GPS/zone photos lands 2.15.5+.
        _ = cancellationToken;
        return Task.FromResult(Result.Success(TwinPhotoPinAggregation.Empty(projectId, spatialNodeId)));
    }

    public async Task<Result<SpatialZoneDetailResponse>> GetZoneDetailAsync(
        Guid projectId,
        Guid spatialNodeId,
        CancellationToken cancellationToken = default)
    {
        var graphResult = await GetGraphAsync(projectId, cancellationToken);
        if (!graphResult.IsSuccess)
            return Result.Failure<SpatialZoneDetailResponse>(graphResult.Error ?? "Failed.", graphResult.ErrorCode);
        if (!graphResult.Value!.HasGraph)
            return Result.Failure<SpatialZoneDetailResponse>("No spatial graph for this project.", "NOT_FOUND");

        var byId = graphResult.Value.Nodes.ToDictionary(n => n.Id);
        if (!byId.TryGetValue(spatialNodeId, out var node))
            return Result.Failure<SpatialZoneDetailResponse>("Spatial node not found on this project graph.", "NOT_FOUND");

        var path = BuildPath(node, byId);

        var rfis = await Db.Set<Rfi>()
            .Where(r => r.ProjectId == projectId && !r.IsDeleted && r.SpatialNodeId == spatialNodeId)
            .OrderByDescending(r => r.CreatedAt)
            .Take(25)
            .Select(r => new SpatialLinkedItemDto(
                r.Id,
                "rfi",
                $"RFI #{r.Number}: {r.Subject}",
                r.Status.ToString(),
                r.CreatedAt,
                r.Priority.ToString()))
            .ToListAsync(cancellationToken);

        var reports = await Db.Set<PmDailyReport>()
            .Where(d => d.ProjectId == projectId && !d.IsDeleted && d.SpatialNodeId == spatialNodeId)
            .OrderByDescending(d => d.ReportDate)
            .Take(25)
            .Select(d => new SpatialLinkedItemDto(
                d.Id,
                "daily_report",
                d.Title ?? $"Daily report {d.ReportDate:yyyy-MM-dd}",
                d.Status.ToString(),
                d.ReportDate,
                d.WorkNarrative))
            .ToListAsync(cancellationToken);

        var progress = await (
            from pe in Db.Set<PmProgressEntry>()
            join ap in Db.Set<PmActivityProgress>() on pe.Id equals ap.ProgressEntryId into aps
            from ap in aps.DefaultIfEmpty()
            where pe.ProjectId == projectId
                  && !pe.IsDeleted
                  && (pe.SpatialNodeId == spatialNodeId
                      || (ap != null && !ap.IsDeleted && ap.SpatialNodeId == spatialNodeId))
            orderby pe.ProgressDate descending
            select new { pe, ap }
        ).Take(25).ToListAsync(cancellationToken);

        var progressDtos = progress
            .GroupBy(x => x.pe.Id)
            .Select(g =>
            {
                var pe = g.First().pe;
                var pct = g.Where(x => x.ap != null).Select(x => (decimal?)x.ap!.PercentComplete).FirstOrDefault();
                return new SpatialLinkedItemDto(
                    pe.Id,
                    "progress",
                    $"Progress {pe.ProgressDate:yyyy-MM-dd}",
                    pe.Status.ToString(),
                    pe.ProgressDate,
                    pct is null ? null : $"{pct:0}% complete*");
            })
            .ToList();

        var activities = await Db.Set<PmScheduleActivity>()
            .Where(a => a.ProjectId == projectId && !a.IsDeleted && a.PrimarySpatialNodeId == spatialNodeId)
            .OrderBy(a => a.SortOrder)
            .Take(25)
            .Select(a => new SpatialLinkedItemDto(
                a.Id,
                "schedule_activity",
                a.Name,
                a.Status.ToString(),
                a.PlannedFinish,
                a.IsCritical ? "Critical path*" : null))
            .ToListAsync(cancellationToken);

        var planLinks = await (
            from link in Db.Set<SpatialPlanLink>()
            join sheet in Db.Set<PmPlanSheet>() on link.PlanSheetId equals sheet.Id
            where link.ProjectId == projectId
                  && !link.IsDeleted
                  && !sheet.IsDeleted
                  && link.SpatialNodeId == spatialNodeId
            orderby sheet.DrawingNumber
            select new SpatialLinkedItemDto(
                sheet.Id,
                "plan_sheet",
                $"{sheet.DrawingNumber} — {sheet.Title}",
                sheet.CurrentRevision,
                null,
                sheet.Discipline))
            .Take(25)
            .ToListAsync(cancellationToken);

        var anyLinks = rfis.Count + reports.Count + progressDtos.Count + activities.Count + planLinks.Count > 0;
        var message = anyLinks
            ? "Linked artifacts for this zone (SpatialNodeId / PrimarySpatialNodeId / plan links)."
            : "No linked RFIs, daily reports, progress, schedule, or plan sheets for this zone yet — not empty green health.";

        return Result.Success(new SpatialZoneDetailResponse(
            spatialNodeId,
            node.Code,
            node.Name,
            node.NodeType,
            path,
            message,
            rfis,
            reports,
            progressDtos,
            activities,
            planLinks));
    }

    /// <summary>
    /// Seeds fixture-known overlay fuel (RFIs + progress + schedule) on named demo zones.
    /// Idempotent: skips if open RFIs already linked for the project.
    /// </summary>
    async Task EnsureDemoOverlayFuelAsync(
        Guid projectId,
        SpatialGraphResponse graph,
        CancellationToken ct)
    {
        var zones = graph.Nodes
            .Where(n => n.NodeType == nameof(SpatialNodeType.Zone))
            .ToDictionary(n => n.Code, n => n.Id, StringComparer.OrdinalIgnoreCase);
        if (zones.Count == 0) return;

        if (!zones.TryGetValue("L1-EAST", out var eastId)) return;
        if (!zones.TryGetValue("L1-WEST", out var westId)) return;
        if (!zones.TryGetValue("L2-DECK", out var deckId)) return;
        // L2-MECH intentionally left unlinked → remains InsufficientData

        var anyLinkedRfi = await Db.Set<Rfi>()
            .AnyAsync(r => r.ProjectId == projectId && !r.IsDeleted && r.SpatialNodeId != null, ct);
        if (anyLinkedRfi) return;

        var companyId = CurrentCompanyId != Guid.Empty
            ? CurrentCompanyId
            : (await Db.Set<Project>().Where(p => p.Id == projectId).Select(p => p.CompanyId).FirstAsync(ct));

        // 3 open RFIs on L1-EAST → Risk band for RFI mode
        var nextNumber = await Db.Set<Rfi>()
            .Where(r => r.ProjectId == projectId)
            .Select(r => (int?)r.Number)
            .MaxAsync(ct) ?? 0;

        for (var i = 0; i < 3; i++)
        {
            Db.Set<Rfi>().Add(new Rfi
            {
                CompanyId = companyId,
                ProjectId = projectId,
                Number = ++nextNumber,
                Subject = $"[Twin seed] Zone link RFI {i + 1}",
                Question = "Seeded for spatial overlay fixture — not a real field question.",
                Status = RfiStatus.Open,
                Priority = RfiPriority.Normal,
                SpatialNodeId = eastId,
                CreatedBy = "system-seed"
            });
        }

        // 1 open RFI on L1-WEST → Watch band
        Db.Set<Rfi>().Add(new Rfi
        {
            CompanyId = companyId,
            ProjectId = projectId,
            Number = ++nextNumber,
            Subject = "[Twin seed] West core detail",
            Question = "Seeded RFI on L1-WEST.",
            Status = RfiStatus.Open,
            Priority = RfiPriority.Normal,
            SpatialNodeId = westId,
            CreatedBy = "system-seed"
        });

        // Progress needs EnteredByUserId FK on relational DBs; in-memory unit tests allow empty.
        var userId = GetCurrentUserId();
        if (userId == Guid.Empty && Db.Database.IsRelational())
        {
            await Db.SaveChangesAsync(ct); // RFIs only — still paints RFI overlay mode
            return;
        }
        if (userId == Guid.Empty)
            userId = Guid.Parse("11111111-1111-1111-1111-111111111111");

        var entry = new PmProgressEntry
        {
            CompanyId = companyId,
            ProjectId = projectId,
            ProgressDate = DateTime.UtcNow.Date,
            EnteredByUserId = userId,
            EntryType = ProgressEntryType.Activity,
            Status = ProgressEntryStatus.Submitted,
            SpatialNodeId = westId,
            CreatedBy = "system-seed"
        };
        Db.Set<PmProgressEntry>().Add(entry);

        var activityId = await Db.Set<PmScheduleActivity>()
            .Where(a => a.ProjectId == projectId && !a.IsDeleted)
            .Select(a => a.Id)
            .FirstOrDefaultAsync(ct);

        if (activityId == Guid.Empty)
        {
            var schedule = new PmSchedule
            {
                CompanyId = companyId,
                ProjectId = projectId,
                Name = "Twin seed schedule",
                Status = ScheduleStatus.Active,
                DataDate = DateTime.UtcNow.Date,
                CreatedBy = "system-seed"
            };
            Db.Set<PmSchedule>().Add(schedule);
            var act = new PmScheduleActivity
            {
                CompanyId = companyId,
                ScheduleId = schedule.Id,
                ProjectId = projectId,
                ActivityCode = "TWIN-1",
                Name = "Deck formwork",
                ActivityType = ScheduleActivityType.Task,
                Status = ScheduleActivityStatus.InProgress,
                PercentComplete = 40,
                IsCritical = true,
                PrimarySpatialNodeId = deckId,
                PlannedStart = DateTime.UtcNow.Date.AddDays(-10),
                PlannedFinish = DateTime.UtcNow.Date.AddDays(-2),
                CreatedBy = "system-seed"
            };
            Db.Set<PmScheduleActivity>().Add(act);
            activityId = act.Id;
        }
        else
        {
            var act = await Db.Set<PmScheduleActivity>().FirstAsync(a => a.Id == activityId, ct);
            if (act.PrimarySpatialNodeId is null)
            {
                act.PrimarySpatialNodeId = deckId;
                act.IsCritical = true;
                if (act.PlannedFinish is null || act.PlannedFinish > DateTime.UtcNow)
                    act.PlannedFinish = DateTime.UtcNow.Date.AddDays(-2);
            }
        }

        Db.Set<PmActivityProgress>().Add(new PmActivityProgress
        {
            CompanyId = companyId,
            ProgressEntryId = entry.Id,
            ScheduleActivityId = activityId,
            PercentComplete = 85,
            SpatialNodeId = westId,
            CreatedBy = "system-seed"
        });

        // Optional plan sheet link for L1-EAST when a sheet exists on the project
        var sheetId = await Db.Set<PmPlanSheet>()
            .Where(s => s.ProjectId == projectId && !s.IsDeleted)
            .Select(s => s.Id)
            .FirstOrDefaultAsync(ct);
        if (sheetId != Guid.Empty)
        {
            var hasLink = await Db.Set<SpatialPlanLink>()
                .AnyAsync(l => l.SpatialNodeId == eastId && l.PlanSheetId == sheetId && !l.IsDeleted, ct);
            if (!hasLink)
            {
                Db.Set<SpatialPlanLink>().Add(new SpatialPlanLink
                {
                    CompanyId = companyId,
                    ProjectId = projectId,
                    SpatialNodeId = eastId,
                    PlanSheetId = sheetId,
                    Notes = "Twin seed plan link",
                    CreatedBy = "system-seed"
                });
            }
        }

        await Db.SaveChangesAsync(ct);
    }

    async Task<Dictionary<Guid, int>> LoadOpenRfiCountsByZoneAsync(
        Guid projectId,
        HashSet<Guid> zoneIds,
        DateTime? fromUtc,
        DateTime? toUtc,
        CancellationToken ct)
    {
        if (zoneIds.Count == 0) return new Dictionary<Guid, int>();

        var q = Db.Set<Rfi>()
            .Where(r => r.ProjectId == projectId
                        && !r.IsDeleted
                        && r.SpatialNodeId != null
                        && r.Status != RfiStatus.Closed
                        && zoneIds.Contains(r.SpatialNodeId.Value));
        if (fromUtc is DateTime f)
            q = q.Where(r => r.CreatedAt >= f.ToUniversalTime().Date);
        if (toUtc is DateTime t)
        {
            var end = t.ToUniversalTime().Date.AddDays(1);
            q = q.Where(r => r.CreatedAt < end);
        }

        var rows = await q
            .GroupBy(r => r.SpatialNodeId!.Value)
            .Select(g => new { ZoneId = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return rows.ToDictionary(x => x.ZoneId, x => x.Count);
    }

    async Task<Dictionary<Guid, decimal>> LoadProgressPercentByZoneAsync(
        Guid projectId,
        HashSet<Guid> zoneIds,
        DateTime asOfUtc,
        DateTime? fromUtc,
        DateTime? toUtc,
        CancellationToken ct)
    {
        if (zoneIds.Count == 0) return new Dictionary<Guid, decimal>();

        var asOfDate = asOfUtc.Date;
        var fromDate = fromUtc?.ToUniversalTime().Date;
        var toDate = toUtc?.ToUniversalTime().Date;

        var entryLinked = await (
            from pe in Db.Set<PmProgressEntry>()
            join ap in Db.Set<PmActivityProgress>() on pe.Id equals ap.ProgressEntryId
            where pe.ProjectId == projectId
                  && !pe.IsDeleted
                  && !ap.IsDeleted
                  && pe.SpatialNodeId != null
                  && zoneIds.Contains(pe.SpatialNodeId.Value)
                  && pe.ProgressDate <= asOfDate
                  && (fromDate == null || pe.ProgressDate >= fromDate)
                  && (toDate == null || pe.ProgressDate <= toDate)
            group ap by pe.SpatialNodeId!.Value
            into g
            select new { ZoneId = g.Key, Avg = g.Average(x => x.PercentComplete) }
        ).ToListAsync(ct);

        var map = entryLinked.ToDictionary(x => x.ZoneId, x => x.Avg);

        var activityLinked = await (
            from pe in Db.Set<PmProgressEntry>()
            join ap in Db.Set<PmActivityProgress>() on pe.Id equals ap.ProgressEntryId
            where pe.ProjectId == projectId
                  && !pe.IsDeleted
                  && !ap.IsDeleted
                  && ap.SpatialNodeId != null
                  && zoneIds.Contains(ap.SpatialNodeId.Value)
                  && pe.ProgressDate <= asOfDate
                  && (fromDate == null || pe.ProgressDate >= fromDate)
                  && (toDate == null || pe.ProgressDate <= toDate)
            group ap by ap.SpatialNodeId!.Value
            into g
            select new { ZoneId = g.Key, Avg = g.Average(x => x.PercentComplete) }
        ).ToListAsync(ct);

        foreach (var row in activityLinked)
        {
            if (!map.ContainsKey(row.ZoneId))
                map[row.ZoneId] = row.Avg;
        }

        return map;
    }

    async Task<Dictionary<Guid, (bool IsCritical, int DaysBehind)>> LoadScheduleSignalsByZoneAsync(
        Guid projectId,
        HashSet<Guid> zoneIds,
        DateTime asOfUtc,
        CancellationToken ct)
    {
        if (zoneIds.Count == 0) return new Dictionary<Guid, (bool, int)>();

        var activities = await Db.Set<PmScheduleActivity>()
            .Where(a => a.ProjectId == projectId
                        && !a.IsDeleted
                        && a.PrimarySpatialNodeId != null
                        && zoneIds.Contains(a.PrimarySpatialNodeId.Value))
            .ToListAsync(ct);

        var result = new Dictionary<Guid, (bool IsCritical, int DaysBehind)>();
        foreach (var group in activities.GroupBy(a => a.PrimarySpatialNodeId!.Value))
        {
            var critical = group.Any(a => a.IsCritical);
            var maxBehind = 0;
            foreach (var a in group)
            {
                if (a.ActualFinish is not null) continue;
                if (a.Status == ScheduleActivityStatus.Completed) continue;
                if (a.PlannedFinish is DateTime pf && pf.Date < asOfUtc.Date)
                {
                    var days = (int)(asOfUtc.Date - pf.Date).TotalDays;
                    if (days > maxBehind) maxBehind = days;
                }
            }

            // Only emit signal when we have critical flag or delay — pure presence of link with no delay still paints OnTrack
            result[group.Key] = (critical, maxBehind);
        }

        return result;
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
