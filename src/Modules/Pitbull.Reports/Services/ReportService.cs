using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.Reports.DTOs;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Reports.Services;

public interface IReportService
{
    Task<LaborCostReportResponse> GetLaborCostReportAsync(
        Guid? projectId,
        DateOnly? from,
        DateOnly? to,
        string groupBy,
        CancellationToken cancellationToken = default);

    Task<ProjectProfitabilityReportResponse> GetProjectProfitabilityReportAsync(
        DateOnly? from,
        DateOnly? to,
        CancellationToken cancellationToken = default);

    Task<EquipmentUtilizationReportResponse> GetEquipmentUtilizationReportAsync(
        DateOnly? from,
        DateOnly? to,
        CancellationToken cancellationToken = default);

    Task<WeeklySummaryReportResponse> GetWeeklySummaryReportAsync(
        DateOnly weekOf,
        Guid? projectId,
        CancellationToken cancellationToken = default);
}

public sealed class ReportService(PitbullDbContext db) : IReportService
{
    public async Task<LaborCostReportResponse> GetLaborCostReportAsync(
        Guid? projectId,
        DateOnly? from,
        DateOnly? to,
        string groupBy,
        CancellationToken cancellationToken = default)
    {
        var (rangeFrom, rangeTo) = ResolveRange(from, to);

        var baseQuery = db.Set<TimeEntry>()
            .AsNoTracking()
            .Where(te => te.Status == TimeEntryStatus.Approved)
            .Where(te => te.Date >= rangeFrom && te.Date <= rangeTo);

        if (projectId.HasValue)
        {
            baseQuery = baseQuery.Where(te => te.ProjectId == projectId.Value);
        }

        // Use a flat projection that avoids complex ternary expressions inside SQL.
        // Employee navigation is required (EmployeeId is non-nullable FK), so null
        // checks are not needed. CostCode is also required.  Phase is optional.
        var projection = baseQuery.Select(te => new
        {
            te.ProjectId,
            ProjectName = te.Project.Name,
            te.EmployeeId,
            te.Employee.EmployeeNumber,
            EmployeeFirstName = te.Employee.FirstName,
            EmployeeLastName = te.Employee.LastName,
            te.CostCodeId,
            CostCodeCode = te.CostCode.Code,
            te.CostCode.Description,
            te.PhaseId,
            PhaseName = te.Phase != null ? te.Phase.Name : null,
            te.RegularHours,
            te.OvertimeHours,
            te.DoubletimeHours,
            te.Employee.BaseHourlyRate
        });

        var normalizedGroupBy = groupBy.Trim().ToLowerInvariant();

        // Materialize grouped aggregates with SQL-safe expressions, then format labels in-memory.
        List<LaborCostReportRow> rows;
        switch (normalizedGroupBy)
        {
            case "employee":
            {
                var raw = await projection
                    .GroupBy(x => new { x.EmployeeId, x.EmployeeNumber, x.EmployeeFirstName, x.EmployeeLastName })
                    .Select(g => new
                    {
                        g.Key.EmployeeId,
                        g.Key.EmployeeNumber,
                        g.Key.EmployeeFirstName,
                        g.Key.EmployeeLastName,
                        TotalHours = g.Sum(x => x.RegularHours + x.OvertimeHours + x.DoubletimeHours),
                        RegularHours = g.Sum(x => x.RegularHours),
                        OvertimeHours = g.Sum(x => x.OvertimeHours + x.DoubletimeHours),
                        TotalCost = g.Sum(x =>
                            x.RegularHours * x.BaseHourlyRate
                            + x.OvertimeHours * x.BaseHourlyRate * 1.5m
                            + x.DoubletimeHours * x.BaseHourlyRate * 2.0m)
                    })
                    .OrderBy(r => r.EmployeeLastName).ThenBy(r => r.EmployeeFirstName)
                    .ToListAsync(cancellationToken);

                rows = raw.Select(r => new LaborCostReportRow(
                    r.EmployeeId.ToString(),
                    $"{r.EmployeeNumber} - {r.EmployeeFirstName} {r.EmployeeLastName}",
                    r.TotalHours, r.RegularHours, r.OvertimeHours, r.TotalCost
                )).ToList();
                break;
            }
            case "costcode":
            {
                var raw = await projection
                    .GroupBy(x => new { x.CostCodeId, x.CostCodeCode, x.Description })
                    .Select(g => new
                    {
                        g.Key.CostCodeId,
                        g.Key.CostCodeCode,
                        g.Key.Description,
                        TotalHours = g.Sum(x => x.RegularHours + x.OvertimeHours + x.DoubletimeHours),
                        RegularHours = g.Sum(x => x.RegularHours),
                        OvertimeHours = g.Sum(x => x.OvertimeHours + x.DoubletimeHours),
                        TotalCost = g.Sum(x =>
                            x.RegularHours * x.BaseHourlyRate
                            + x.OvertimeHours * x.BaseHourlyRate * 1.5m
                            + x.DoubletimeHours * x.BaseHourlyRate * 2.0m)
                    })
                    .OrderBy(r => r.CostCodeCode)
                    .ToListAsync(cancellationToken);

                rows = raw.Select(r => new LaborCostReportRow(
                    r.CostCodeId.ToString(),
                    $"{r.CostCodeCode} - {r.Description}",
                    r.TotalHours, r.RegularHours, r.OvertimeHours, r.TotalCost
                )).ToList();
                break;
            }
            case "phase":
            {
                var raw = await projection
                    .GroupBy(x => new { x.PhaseId, x.PhaseName })
                    .Select(g => new
                    {
                        g.Key.PhaseId,
                        g.Key.PhaseName,
                        TotalHours = g.Sum(x => x.RegularHours + x.OvertimeHours + x.DoubletimeHours),
                        RegularHours = g.Sum(x => x.RegularHours),
                        OvertimeHours = g.Sum(x => x.OvertimeHours + x.DoubletimeHours),
                        TotalCost = g.Sum(x =>
                            x.RegularHours * x.BaseHourlyRate
                            + x.OvertimeHours * x.BaseHourlyRate * 1.5m
                            + x.DoubletimeHours * x.BaseHourlyRate * 2.0m)
                    })
                    .OrderBy(r => r.PhaseName)
                    .ToListAsync(cancellationToken);

                rows = raw.Select(r => new LaborCostReportRow(
                    r.PhaseId?.ToString() ?? "none",
                    string.IsNullOrWhiteSpace(r.PhaseName) ? "(No Phase)" : r.PhaseName,
                    r.TotalHours, r.RegularHours, r.OvertimeHours, r.TotalCost
                )).ToList();
                break;
            }
            default:
                throw new ArgumentException("groupBy must be one of: employee, costCode, phase", nameof(groupBy));
        }

        // Compute totals — use a simple aggregate to avoid GroupBy-on-constant translation issues.
        var totalData = await baseQuery.Select(te => new
            {
                te.RegularHours,
                te.OvertimeHours,
                te.DoubletimeHours,
                te.Employee.BaseHourlyRate
            })
            .GroupBy(_ => 1)
            .Select(g => new
            {
                TotalHours = g.Sum(x => x.RegularHours + x.OvertimeHours + x.DoubletimeHours),
                RegularHours = g.Sum(x => x.RegularHours),
                OvertimeHours = g.Sum(x => x.OvertimeHours + x.DoubletimeHours),
                TotalCost = g.Sum(x =>
                    x.RegularHours * x.BaseHourlyRate
                    + x.OvertimeHours * x.BaseHourlyRate * 1.5m
                    + x.DoubletimeHours * x.BaseHourlyRate * 2.0m)
            })
            .FirstOrDefaultAsync(cancellationToken);

        var totals = totalData != null
            ? new LaborCostSummary(totalData.TotalHours, totalData.RegularHours, totalData.OvertimeHours, totalData.TotalCost)
            : new LaborCostSummary(0m, 0m, 0m, 0m);

        var subtotalData = await baseQuery.Select(te => new
            {
                te.ProjectId,
                ProjectName = te.Project.Name,
                te.RegularHours,
                te.OvertimeHours,
                te.DoubletimeHours,
                te.Employee.BaseHourlyRate
            })
            .GroupBy(x => new { x.ProjectId, x.ProjectName })
            .Select(g => new
            {
                g.Key.ProjectName,
                TotalHours = g.Sum(x => x.RegularHours + x.OvertimeHours + x.DoubletimeHours),
                RegularHours = g.Sum(x => x.RegularHours),
                OvertimeHours = g.Sum(x => x.OvertimeHours + x.DoubletimeHours),
                TotalCost = g.Sum(x =>
                    x.RegularHours * x.BaseHourlyRate
                    + x.OvertimeHours * x.BaseHourlyRate * 1.5m
                    + x.DoubletimeHours * x.BaseHourlyRate * 2.0m)
            })
            .OrderBy(s => s.ProjectName)
            .ToListAsync(cancellationToken);

        var subtotals = subtotalData
            .Select(s => new LaborCostSubtotal(s.ProjectName, s.TotalHours, s.RegularHours, s.OvertimeHours, s.TotalCost))
            .ToList();

        return new LaborCostReportResponse(
            rangeFrom,
            rangeTo,
            normalizedGroupBy,
            projectId,
            rows,
            totals,
            subtotals);
    }

    public async Task<ProjectProfitabilityReportResponse> GetProjectProfitabilityReportAsync(
        DateOnly? from,
        DateOnly? to,
        CancellationToken cancellationToken = default)
    {
        var (rangeFrom, rangeTo) = ResolveRange(from, to);

        var projectData = await db.Set<Project>()
            .AsNoTracking()
            .Select(p => new
            {
                p.Id,
                p.Number,
                p.Name,
                Budget = p.ContractAmount,
                Revenue = p.ContractAmount
            })
            .ToListAsync(cancellationToken);

        var costByProject = await db.Set<TimeEntry>()
            .AsNoTracking()
            .Where(te => te.Status == TimeEntryStatus.Approved)
            .Where(te => te.Date >= rangeFrom && te.Date <= rangeTo)
            .GroupBy(te => te.ProjectId)
            .Select(g => new
            {
                ProjectId = g.Key,
                LaborCost = g.Sum(te => (te.RegularHours * (te.Employee != null ? te.Employee.BaseHourlyRate : 0m))
                    + (te.OvertimeHours * (te.Employee != null ? te.Employee.BaseHourlyRate : 0m) * 1.5m)
                    + (te.DoubletimeHours * (te.Employee != null ? te.Employee.BaseHourlyRate : 0m) * 2.0m)),
                EquipmentCost = g.Sum(te => te.EquipmentId.HasValue
                    ? te.EquipmentHours * (te.Equipment != null ? te.Equipment.HourlyRate : 0m)
                    : 0m)
            })
            .ToDictionaryAsync(x => x.ProjectId, cancellationToken);

        var rows = projectData
            .Select(p =>
            {
                costByProject.TryGetValue(p.Id, out var costs);
                var laborCost = costs?.LaborCost ?? 0m;
                var equipmentCost = costs?.EquipmentCost ?? 0m;
                var actualCost = laborCost + equipmentCost;
                var profit = p.Revenue - actualCost;
                var marginPercent = p.Revenue == 0m ? 0m : (profit / p.Revenue) * 100m;

                return new ProjectProfitabilityRow(
                    p.Id,
                    p.Number,
                    p.Name,
                    p.Budget,
                    p.Revenue,
                    laborCost,
                    equipmentCost,
                    actualCost,
                    profit,
                    marginPercent);
            })
            .OrderBy(r => r.ProfitMarginPercent)
            .ThenBy(r => r.ProjectName)
            .ToList();

        var totals = new ProjectProfitabilityTotals(
            rows.Sum(r => r.Budget),
            rows.Sum(r => r.Revenue),
            rows.Sum(r => r.LaborCost),
            rows.Sum(r => r.EquipmentCost),
            rows.Sum(r => r.ActualCost),
            rows.Sum(r => r.Profit),
            rows.Sum(r => r.Revenue) == 0m ? 0m : (rows.Sum(r => r.Profit) / rows.Sum(r => r.Revenue)) * 100m);

        return new ProjectProfitabilityReportResponse(rangeFrom, rangeTo, rows, totals);
    }

    public async Task<EquipmentUtilizationReportResponse> GetEquipmentUtilizationReportAsync(
        DateOnly? from,
        DateOnly? to,
        CancellationToken cancellationToken = default)
    {
        var (rangeFrom, rangeTo) = ResolveRange(from, to);
        var workDays = CountWeekdays(rangeFrom, rangeTo);

        var equipmentList = await db.Set<Equipment>()
            .AsNoTracking()
            .OrderBy(e => e.Code)
            .Select(e => new
            {
                e.Id,
                e.Code,
                e.Name,
                e.Type,
                e.HourlyRate
            })
            .ToListAsync(cancellationToken);

        var usageByEquipment = await db.Set<TimeEntry>()
            .AsNoTracking()
            .Where(te => te.Status == TimeEntryStatus.Approved)
            .Where(te => te.EquipmentId.HasValue && te.EquipmentHours > 0m)
            .Where(te => te.Date >= rangeFrom && te.Date <= rangeTo)
            .GroupBy(te => te.EquipmentId!.Value)
            .Select(g => new
            {
                EquipmentId = g.Key,
                TotalHoursUsed = g.Sum(te => te.EquipmentHours),
                DaysAssigned = g.Select(te => te.Date).Distinct().Count()
            })
            .ToDictionaryAsync(x => x.EquipmentId, cancellationToken);

        var rows = equipmentList
            .Select(equip =>
            {
                usageByEquipment.TryGetValue(equip.Id, out var usage);
                var totalHours = usage?.TotalHoursUsed ?? 0m;
                var daysAssigned = usage?.DaysAssigned ?? 0;
                var utilizationPercent = workDays == 0 ? 0m : (decimal)daysAssigned / workDays * 100m;
                var cost = totalHours * equip.HourlyRate;

                return new EquipmentUtilizationRow(
                    equip.Id,
                    equip.Code,
                    equip.Name,
                    equip.Type.ToString(),
                    totalHours,
                    daysAssigned,
                    utilizationPercent,
                    cost);
            })
            .OrderByDescending(r => r.UtilizationPercent)
            .ThenBy(r => r.EquipmentCode)
            .ToList();

        var totals = new EquipmentUtilizationTotals(
            rows.Sum(r => r.TotalHoursUsed),
            rows.Sum(r => r.DaysAssigned),
            rows.Sum(r => r.Cost),
            rows.Count == 0 ? 0m : rows.Average(r => r.UtilizationPercent));

        return new EquipmentUtilizationReportResponse(rangeFrom, rangeTo, workDays, rows, totals);
    }

    public async Task<WeeklySummaryReportResponse> GetWeeklySummaryReportAsync(
        DateOnly weekOf,
        Guid? projectId,
        CancellationToken cancellationToken = default)
    {
        var weekStart = StartOfWeekMonday(weekOf);
        var weekEnd = weekStart.AddDays(6);

        var query = db.Set<TimeEntry>()
            .AsNoTracking()
            .Where(te => te.Date >= weekStart && te.Date <= weekEnd)
            .Where(te => te.Status != TimeEntryStatus.Rejected)
            .Select(te => new
            {
                te.EmployeeId,
                EmployeeNumber = te.Employee != null ? te.Employee.EmployeeNumber : "N/A",
                EmployeeName = te.Employee != null ? te.Employee.FirstName + " " + te.Employee.LastName : "Unknown",
                te.Date,
                Hours = te.RegularHours + te.OvertimeHours + te.DoubletimeHours,
                te.ProjectId
            });

        if (projectId.HasValue)
        {
            query = query.Where(x => x.ProjectId == projectId.Value);
        }

        var dailyHours = await query
            .GroupBy(x => new { x.EmployeeId, x.EmployeeNumber, x.EmployeeName, x.Date })
            .Select(g => new
            {
                g.Key.EmployeeId,
                g.Key.EmployeeNumber,
                g.Key.EmployeeName,
                g.Key.Date,
                Hours = g.Sum(x => x.Hours)
            })
            .ToListAsync(cancellationToken);

        var rows = dailyHours
            .GroupBy(x => new { x.EmployeeId, x.EmployeeNumber, x.EmployeeName })
            .Select(g =>
            {
                var dayBuckets = new decimal[7];
                foreach (var day in g)
                {
                    var index = day.Date.DayNumber - weekStart.DayNumber;
                    if (index >= 0 && index < 7)
                    {
                        dayBuckets[index] += day.Hours;
                    }
                }

                var dayHours = dayBuckets.ToList();
                return new WeeklySummaryRow(
                    g.Key.EmployeeId,
                    g.Key.EmployeeNumber,
                    g.Key.EmployeeName,
                    dayHours,
                    dayHours.Sum());
            })
            .OrderBy(r => r.EmployeeName)
            .ToList();

        var totalsByDay = Enumerable.Range(0, 7)
            .Select(i => rows.Sum(r => r.DayHours[i]))
            .ToList();

        var totals = new WeeklySummaryTotals(totalsByDay, totalsByDay.Sum());

        var days = Enumerable.Range(0, 7)
            .Select(i =>
            {
                var date = weekStart.AddDays(i);
                return new WeeklySummaryDay(date.DayOfWeek switch
                {
                    DayOfWeek.Monday => "Mon",
                    DayOfWeek.Tuesday => "Tue",
                    DayOfWeek.Wednesday => "Wed",
                    DayOfWeek.Thursday => "Thu",
                    DayOfWeek.Friday => "Fri",
                    DayOfWeek.Saturday => "Sat",
                    _ => "Sun"
                }, date);
            })
            .ToList();

        return new WeeklySummaryReportResponse(weekOf, weekStart, weekEnd, projectId, days, rows, totals);
    }

    private static (DateOnly From, DateOnly To) ResolveRange(DateOnly? from, DateOnly? to)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var resolvedTo = to ?? today;
        var resolvedFrom = from ?? resolvedTo.AddDays(-29);

        if (resolvedFrom > resolvedTo)
        {
            throw new ArgumentException("from must be less than or equal to to.");
        }

        return (resolvedFrom, resolvedTo);
    }

    private static DateOnly StartOfWeekMonday(DateOnly date)
    {
        var dayOffset = ((int)date.DayOfWeek + 6) % 7;
        return date.AddDays(-dayOffset);
    }

    private static int CountWeekdays(DateOnly from, DateOnly to)
    {
        var count = 0;
        for (var date = from; date <= to; date = date.AddDays(1))
        {
            if (date.DayOfWeek is not DayOfWeek.Saturday and not DayOfWeek.Sunday)
            {
                count++;
            }
        }

        return count;
    }
}
