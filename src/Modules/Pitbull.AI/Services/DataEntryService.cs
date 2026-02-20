using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.AI.Providers;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.AI.Services;

public record ParsedDataEntry
{
    public string EntityType { get; init; } = string.Empty;
    public Dictionary<string, JsonElement> Fields { get; init; } = new();
    public decimal ConfidenceScore { get; init; }
    public string OriginalText { get; init; } = string.Empty;
    public string Summary { get; init; } = string.Empty;
    public List<string> Warnings { get; init; } = [];
    public bool RequiresConfirmation { get; init; } = true;
}

public record DataEntryParseRequest(string Text);

public record DataEntryExecuteRequest(string EntityType, Dictionary<string, JsonElement> Fields);

public record DataEntryResult(string EntityType, Guid EntityId, string Summary);

public interface IDataEntryService
{
    Task<ParsedDataEntry> ParseAsync(string text, CancellationToken ct);
    Task<DataEntryResult> ExecuteAsync(DataEntryExecuteRequest request, CancellationToken ct);
}

public sealed class DataEntryService(
    PitbullDbContext db,
    IAiService aiService,
    ITenantContext tenantContext,
    ICompanyContext companyContext,
    IHttpContextAccessor httpContextAccessor,
    ILogger<DataEntryService> logger) : IDataEntryService
{
    private const string SystemPrompt = """
        You are a data extraction assistant for a construction management ERP.
        Parse the user's natural language into structured JSON for creating entities.

        SUPPORTED ENTITY TYPES:
        1. "TimeEntry" - Log hours for an employee on a project
           Fields: employeeName (string), projectName (string), costCodeCode (string), date (YYYY-MM-DD, default today), regularHours (number), overtimeHours (number, default 0), doubletimeHours (number, default 0), description (string, optional)
        2. "DailyReport" - Create a daily field report
           Fields: projectName (string), date (YYYY-MM-DD, default today), weatherSummary (string), temperatureHigh (number, optional), temperatureLow (number, optional), manpower (number, optional), workNarrative (string), safetyNarrative (string, optional)

        RULES:
        - Return ONLY valid JSON, no markdown fences, no explanation.
        - Use the exact field names above.
        - If hours are mentioned without specifying type, assume regularHours.
        - If "OT" or "overtime" is mentioned, put those hours in overtimeHours.
        - If no date is specified, omit the date field (we'll default to today).
        - If you cannot determine the entity type, set entityType to "Unknown".

        RESPONSE FORMAT:
        {"entityType": "TimeEntry", "fields": { ... }, "summary": "Log 8 regular hours for John on Downtown project"}

        EXAMPLES:
        Input: "log 8 hours for John on Downtown project, labor, cost code 310"
        Output: {"entityType":"TimeEntry","fields":{"employeeName":"John","projectName":"Downtown","costCodeCode":"310","regularHours":8},"summary":"Log 8 regular hours for John on Downtown project, cost code 310"}

        Input: "daily report for Downtown: weather sunny 75F, 12 workers on site, poured concrete deck level 3"
        Output: {"entityType":"DailyReport","fields":{"projectName":"Downtown","weatherSummary":"Sunny","temperatureHigh":75,"manpower":12,"workNarrative":"Poured concrete deck level 3"},"summary":"Daily report for Downtown: sunny 75F, 12 workers, poured concrete deck level 3"}

        Input: "John worked 8 regular and 2 OT on Main St project yesterday, code 200"
        Output: {"entityType":"TimeEntry","fields":{"employeeName":"John","projectName":"Main St","costCodeCode":"200","regularHours":8,"overtimeHours":2},"summary":"Log 8 regular + 2 OT hours for John on Main St project, cost code 200"}
        """;

    public async Task<ParsedDataEntry> ParseAsync(string text, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;

        var aiRequest = new AiCompletionRequest(
            SystemPrompt: SystemPrompt,
            UserPrompt: text,
            Capability: AiCapability.Analysis,
            MaxTokens: 1024,
            Temperature: 0.1m);

        var aiResult = await aiService.CompleteAsync(tenantId, aiRequest, ct: ct);

        if (!aiResult.IsSuccess)
        {
            return new ParsedDataEntry
            {
                EntityType = "Unknown",
                OriginalText = text,
                Summary = "Failed to parse input. AI service unavailable.",
                ConfidenceScore = 0,
                Warnings = [$"AI error: {aiResult.Error}"]
            };
        }

        var content = aiResult.Value!.Content.Trim();
        var aiConfidence = aiResult.Value.ConfidenceScore;

        // Parse the AI response JSON
        JsonElement parsed;
        try
        {
            parsed = JsonDocument.Parse(content).RootElement;
        }
        catch (JsonException)
        {
            return new ParsedDataEntry
            {
                EntityType = "Unknown",
                OriginalText = text,
                Summary = "Could not parse AI response.",
                ConfidenceScore = 0,
                Warnings = ["AI returned invalid JSON."]
            };
        }

        var entityType = parsed.TryGetProperty("entityType", out var et) ? et.GetString() ?? "Unknown" : "Unknown";
        var summary = parsed.TryGetProperty("summary", out var s) ? s.GetString() ?? "" : "";
        var fields = new Dictionary<string, JsonElement>();
        if (parsed.TryGetProperty("fields", out var fieldsElement) && fieldsElement.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in fieldsElement.EnumerateObject())
            {
                fields[prop.Name] = prop.Value.Clone();
            }
        }

        // Resolve entity references and collect warnings
        var warnings = new List<string>();
        decimal resolutionConfidence = 1.0m;

        if (entityType == "TimeEntry")
        {
            resolutionConfidence = await ResolveTimeEntryFieldsAsync(fields, warnings, ct);
        }
        else if (entityType == "DailyReport")
        {
            resolutionConfidence = await ResolveDailyReportFieldsAsync(fields, warnings, ct);
        }

        var combinedConfidence = Math.Clamp(aiConfidence * resolutionConfidence, 0m, 1m);

        return new ParsedDataEntry
        {
            EntityType = entityType,
            Fields = fields,
            ConfidenceScore = Math.Round(combinedConfidence, 4),
            OriginalText = text,
            Summary = summary,
            Warnings = warnings,
            RequiresConfirmation = true
        };
    }

    public async Task<DataEntryResult> ExecuteAsync(DataEntryExecuteRequest request, CancellationToken ct)
    {
        return request.EntityType switch
        {
            "TimeEntry" => await ExecuteTimeEntryAsync(request.Fields, ct),
            "DailyReport" => await ExecuteDailyReportAsync(request.Fields, ct),
            _ => throw new ArgumentException($"Unsupported entity type: {request.EntityType}")
        };
    }

    private async Task<decimal> ResolveTimeEntryFieldsAsync(
        Dictionary<string, JsonElement> fields, List<string> warnings, CancellationToken ct)
    {
        var confidence = 1.0m;

        // Resolve employee
        if (fields.TryGetValue("employeeName", out var empNameEl))
        {
            var empName = empNameEl.GetString() ?? "";
            var employees = await db.Set<Employee>()
                .AsNoTracking()
                .Where(e => e.IsActive)
                .Select(e => new { e.Id, e.FirstName, e.LastName, e.EmployeeNumber })
                .ToListAsync(ct);

            var matches = employees
                .Where(e => e.FirstName.Contains(empName, StringComparison.OrdinalIgnoreCase)
                         || e.LastName.Contains(empName, StringComparison.OrdinalIgnoreCase)
                         || $"{e.FirstName} {e.LastName}".Contains(empName, StringComparison.OrdinalIgnoreCase)
                         || e.EmployeeNumber.Contains(empName, StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (matches.Count == 1)
            {
                fields["employeeId"] = JsonDocument.Parse($"\"{matches[0].Id}\"").RootElement.Clone();
                warnings.Add($"Employee '{empName}' matched to '{matches[0].FirstName} {matches[0].LastName}' ({matches[0].EmployeeNumber})");
            }
            else if (matches.Count > 1)
            {
                var names = string.Join(", ", matches.Select(m => $"{m.FirstName} {m.LastName} ({m.EmployeeNumber})"));
                warnings.Add($"Ambiguous employee '{empName}': matches {names}");
                confidence *= 0.5m;
            }
            else
            {
                warnings.Add($"Employee '{empName}' not found.");
                confidence *= 0.3m;
            }
        }

        // Resolve project
        if (fields.TryGetValue("projectName", out var projNameEl))
        {
            var projName = projNameEl.GetString() ?? "";
            confidence *= await ResolveProjectAsync(fields, warnings, projName, ct);
        }

        // Resolve cost code
        if (fields.TryGetValue("costCodeCode", out var ccEl))
        {
            var ccCode = ccEl.GetString() ?? "";
            var costCodes = await db.Set<CostCode>()
                .AsNoTracking()
                .Where(c => c.IsActive)
                .Select(c => new { c.Id, c.Code, c.Description })
                .ToListAsync(ct);

            var match = costCodes.FirstOrDefault(c =>
                c.Code.Equals(ccCode, StringComparison.OrdinalIgnoreCase)
                || c.Code.Contains(ccCode, StringComparison.OrdinalIgnoreCase));

            if (match is not null)
            {
                fields["costCodeId"] = JsonDocument.Parse($"\"{match.Id}\"").RootElement.Clone();
                warnings.Add($"Cost code '{ccCode}' matched to '{match.Code} - {match.Description}'");
            }
            else
            {
                warnings.Add($"Cost code '{ccCode}' not found.");
                confidence *= 0.4m;
            }
        }

        return confidence;
    }

    private async Task<decimal> ResolveDailyReportFieldsAsync(
        Dictionary<string, JsonElement> fields, List<string> warnings, CancellationToken ct)
    {
        var confidence = 1.0m;

        if (fields.TryGetValue("projectName", out var projNameEl))
        {
            var projName = projNameEl.GetString() ?? "";
            confidence *= await ResolveProjectAsync(fields, warnings, projName, ct);
        }

        return confidence;
    }

    private async Task<decimal> ResolveProjectAsync(
        Dictionary<string, JsonElement> fields, List<string> warnings, string projName, CancellationToken ct)
    {
        var projects = await db.Set<Project>()
            .AsNoTracking()
            .Where(p => p.Status == ProjectStatus.Active)
            .Select(p => new { p.Id, p.Name, p.Number })
            .ToListAsync(ct);

        var matches = projects
            .Where(p => p.Name.Contains(projName, StringComparison.OrdinalIgnoreCase)
                     || p.Number.Contains(projName, StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (matches.Count == 1)
        {
            fields["projectId"] = JsonDocument.Parse($"\"{matches[0].Id}\"").RootElement.Clone();
            warnings.Add($"Project '{projName}' matched to '{matches[0].Name}' ({matches[0].Number})");
            return 1.0m;
        }
        else if (matches.Count > 1)
        {
            var names = string.Join(", ", matches.Select(m => $"{m.Name} ({m.Number})"));
            warnings.Add($"Ambiguous project '{projName}': matches {names}");
            return 0.5m;
        }
        else
        {
            warnings.Add($"Project '{projName}' not found.");
            return 0.3m;
        }
    }

    private async Task<DataEntryResult> ExecuteTimeEntryAsync(Dictionary<string, JsonElement> fields, CancellationToken ct)
    {
        var employeeId = GetGuidField(fields, "employeeId")
            ?? throw new ArgumentException("Employee not resolved. Cannot create time entry.");
        var projectId = GetGuidField(fields, "projectId")
            ?? throw new ArgumentException("Project not resolved. Cannot create time entry.");
        var costCodeId = GetGuidField(fields, "costCodeId")
            ?? throw new ArgumentException("Cost code not resolved. Cannot create time entry.");

        var date = fields.TryGetValue("date", out var dateEl) && dateEl.ValueKind == JsonValueKind.String
            ? DateOnly.Parse(dateEl.GetString()!)
            : DateOnly.FromDateTime(DateTime.UtcNow);

        var regularHours = GetDecimalField(fields, "regularHours");
        var overtimeHours = GetDecimalField(fields, "overtimeHours");
        var doubletimeHours = GetDecimalField(fields, "doubletimeHours");
        var description = fields.TryGetValue("description", out var descEl) && descEl.ValueKind == JsonValueKind.String
            ? descEl.GetString()
            : null;

        var timeEntry = new TimeEntry
        {
            CompanyId = companyContext.CompanyId,
            TenantId = tenantContext.TenantId,
            EmployeeId = employeeId,
            ProjectId = projectId,
            CostCodeId = costCodeId,
            Date = date,
            RegularHours = regularHours,
            OvertimeHours = overtimeHours,
            DoubletimeHours = doubletimeHours,
            Description = description,
            Status = TimeEntryStatus.Draft
        };

        db.Set<TimeEntry>().Add(timeEntry);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Created time entry {TimeEntryId} via AI data entry for employee {EmployeeId}", timeEntry.Id, employeeId);

        return new DataEntryResult(
            "TimeEntry",
            timeEntry.Id,
            $"Created draft time entry: {regularHours}h regular{(overtimeHours > 0 ? $" + {overtimeHours}h OT" : "")} on {date:yyyy-MM-dd}");
    }

    private async Task<DataEntryResult> ExecuteDailyReportAsync(Dictionary<string, JsonElement> fields, CancellationToken ct)
    {
        var projectId = GetGuidField(fields, "projectId")
            ?? throw new ArgumentException("Project not resolved. Cannot create daily report.");

        var date = fields.TryGetValue("date", out var dateEl) && dateEl.ValueKind == JsonValueKind.String
            ? DateTime.Parse(dateEl.GetString()!).ToUniversalTime()
            : DateTime.UtcNow.Date;
        date = DateTime.SpecifyKind(date, DateTimeKind.Utc);

        var weatherSummary = GetStringField(fields, "weatherSummary");
        var workNarrative = GetStringField(fields, "workNarrative");
        var safetyNarrative = GetStringField(fields, "safetyNarrative");
        var tempHigh = fields.TryGetValue("temperatureHigh", out var thEl) ? GetDecimalFromElement(thEl) : (decimal?)null;
        var tempLow = fields.TryGetValue("temperatureLow", out var tlEl) ? GetDecimalFromElement(tlEl) : (decimal?)null;

        var userId = GetCurrentUserId();

        var report = new Pitbull.ProjectManagement.Domain.PmDailyReport
        {
            CompanyId = companyContext.CompanyId,
            TenantId = tenantContext.TenantId,
            ProjectId = projectId,
            ReportDate = date,
            ReportType = Pitbull.ProjectManagement.Domain.DailyReportType.Foreman,
            Status = Pitbull.ProjectManagement.Domain.DailyReportStatus.Draft,
            WeatherSummary = weatherSummary,
            TemperatureHigh = tempHigh,
            TemperatureLow = tempLow,
            WorkNarrative = workNarrative,
            SafetyNarrative = safetyNarrative,
            PreparedByUserId = userId
        };

        db.Set<Pitbull.ProjectManagement.Domain.PmDailyReport>().Add(report);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Created daily report {ReportId} via AI data entry for project {ProjectId}", report.Id, projectId);

        return new DataEntryResult(
            "DailyReport",
            report.Id,
            $"Created draft daily report for {date:yyyy-MM-dd}");
    }

    private Guid GetCurrentUserId()
    {
        var userIdStr = httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier)
                        ?? httpContextAccessor.HttpContext?.User.FindFirstValue("sub");
        return Guid.TryParse(userIdStr, out var uid) ? uid : Guid.Empty;
    }

    private static Guid? GetGuidField(Dictionary<string, JsonElement> fields, string key)
    {
        if (fields.TryGetValue(key, out var el) && el.ValueKind == JsonValueKind.String)
            return Guid.TryParse(el.GetString(), out var g) ? g : null;
        return null;
    }

    private static decimal GetDecimalField(Dictionary<string, JsonElement> fields, string key)
    {
        if (fields.TryGetValue(key, out var el))
            return GetDecimalFromElement(el);
        return 0m;
    }

    private static decimal GetDecimalFromElement(JsonElement el)
    {
        return el.ValueKind switch
        {
            JsonValueKind.Number => el.GetDecimal(),
            JsonValueKind.String => decimal.TryParse(el.GetString(), out var d) ? d : 0m,
            _ => 0m
        };
    }

    private static string? GetStringField(Dictionary<string, JsonElement> fields, string key)
    {
        if (fields.TryGetValue(key, out var el) && el.ValueKind == JsonValueKind.String)
            return el.GetString();
        return null;
    }
}
