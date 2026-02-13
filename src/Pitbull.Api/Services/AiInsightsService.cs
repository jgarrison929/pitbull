using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Api.Services;

/// <summary>
/// AI-powered insights service using Claude for project analysis.
/// </summary>
public class AiInsightsService(
    PitbullDbContext db,
    IConfiguration configuration,
    ILogger<AiInsightsService> logger,
    IHttpClientFactory httpClientFactory) : IAiInsightsService
{
    private readonly PitbullDbContext _db = db;
    private readonly IConfiguration _configuration = configuration;
    private readonly ILogger<AiInsightsService> _logger = logger;
    private readonly HttpClient _httpClient = httpClientFactory.CreateClient("Anthropic");

    private const string AnthropicApiUrl = "https://api.anthropic.com/v1/messages";
    private const string ModelId = "claude-sonnet-4-20250514";

    public async Task<AiProjectSummaryResult> GetProjectSummaryAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        var apiKey = _configuration["ANTHROPIC_API_KEY"]
            ?? _configuration["Anthropic:ApiKey"]
            ?? Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY");

        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogWarning("Anthropic API key not configured");
            return new AiProjectSummaryResult
            {
                Success = false,
                Error = "AI features not configured. Please set ANTHROPIC_API_KEY environment variable."
            };
        }

        try
        {
            // Gather all project data
            var projectData = await GatherProjectDataAsync(projectId, cancellationToken);

            if (projectData == null)
            {
                return new AiProjectSummaryResult
                {
                    Success = false,
                    Error = "Project not found"
                };
            }

            // Call Claude API
            var aiResponse = await CallClaudeAsync(projectData, apiKey, cancellationToken);

            return aiResponse;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating AI summary for project {ProjectId}", projectId);
            return new AiProjectSummaryResult
            {
                Success = false,
                Error = $"AI analysis failed: {ex.Message}"
            };
        }
    }

    private async Task<ProjectAnalysisData?> GatherProjectDataAsync(Guid projectId, CancellationToken cancellationToken)
    {
        var project = await _db.Set<Project>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == projectId, cancellationToken);

        if (project == null)
            return null;

        // Get time entries for this project
        var timeEntries = await _db.Set<TimeEntry>()
            .AsNoTracking()
            .Where(t => t.ProjectId == projectId)
            .Include(t => t.Employee)
            .Include(t => t.CostCode)
            .ToListAsync(cancellationToken);

        // Get project assignments
        var assignments = await _db.Set<ProjectAssignment>()
            .AsNoTracking()
            .Where(a => a.ProjectId == projectId && a.IsActive)
            .Include(a => a.Employee)
            .ToListAsync(cancellationToken);

        // Calculate metrics
        var totalHours = timeEntries.Sum(t => t.TotalHours);
        var totalLaborCost = timeEntries.Sum(t =>
            (t.RegularHours * t.Employee.BaseHourlyRate) +
            (t.OvertimeHours * t.Employee.BaseHourlyRate * 1.5m) +
            (t.DoubletimeHours * t.Employee.BaseHourlyRate * 2.0m));

        var pendingApprovals = timeEntries.Count(t => t.Status == TimeEntryStatus.Submitted);
        var oldPendingApprovals = timeEntries
            .Where(t => t.Status == TimeEntryStatus.Submitted)
            .Count(t => t.CreatedAt < DateTime.UtcNow.AddDays(-7));

        var daysActive = timeEntries.Count != 0
            ? (int)(timeEntries.Max(t => t.Date).ToDateTime(TimeOnly.MinValue) -
                    timeEntries.Min(t => t.Date).ToDateTime(TimeOnly.MinValue)).TotalDays + 1
            : 0;

        var dailyAverageHours = daysActive > 0 ? totalHours / daysActive : 0;

        var daysUntilDeadline = project.EstimatedCompletionDate.HasValue
            ? (int)(project.EstimatedCompletionDate.Value - DateTime.UtcNow).TotalDays
            : -1;

        var budgetUtilization = project.ContractAmount > 0
            ? (totalLaborCost / project.ContractAmount) * 100
            : (decimal?)null;

        // Get hours by employee
        var hoursByEmployee = timeEntries
            .GroupBy(t => t.Employee.FullName)
            .Select(g => new { Name = g.Key, Hours = g.Sum(t => t.TotalHours) })
            .OrderByDescending(x => x.Hours)
            .Take(5)
            .ToList();

        // Get hours by cost code
        var hoursByCostCode = timeEntries
            .GroupBy(t => $"{t.CostCode.Code} - {t.CostCode.Description}")
            .Select(g => new { Name = g.Key, Hours = g.Sum(t => t.TotalHours) })
            .OrderByDescending(x => x.Hours)
            .Take(5)
            .ToList();

        // Recent trends (last 7 days vs previous 7 days)
        var recentEntries = timeEntries.Where(t => t.Date >= DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-7)));
        var previousEntries = timeEntries.Where(t =>
            t.Date >= DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-14)) &&
            t.Date < DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-7)));

        var recentHours = recentEntries.Sum(t => t.TotalHours);
        var previousHours = previousEntries.Sum(t => t.TotalHours);
        var hoursTrend = previousHours > 0 ? ((recentHours - previousHours) / previousHours) * 100 : 0;

        return new ProjectAnalysisData
        {
            Project = project,
            Metrics = new ProjectMetrics
            {
                TotalHoursLogged = totalHours,
                TotalLaborCost = totalLaborCost,
                TotalTimeEntries = timeEntries.Count,
                PendingApprovals = pendingApprovals,
                AssignedEmployees = assignments.Count,
                DaysUntilDeadline = daysUntilDeadline,
                BudgetUtilization = budgetUtilization,
                DailyAverageHours = dailyAverageHours
            },
            HoursByEmployee = hoursByEmployee.ToDictionary(x => x.Name, x => x.Hours),
            HoursByCostCode = hoursByCostCode.ToDictionary(x => x.Name, x => x.Hours),
            OldPendingApprovals = oldPendingApprovals,
            HoursTrendPercent = hoursTrend,
            AssignedEmployeeNames = [.. assignments.Select(a => $"{a.Employee.FullName} ({a.Role})")]
        };
    }

    private async Task<AiProjectSummaryResult> CallClaudeAsync(
        ProjectAnalysisData data,
        string apiKey,
        CancellationToken cancellationToken)
    {
        var prompt = BuildPrompt(data);

        var requestBody = new
        {
            model = ModelId,
            max_tokens = 1024,
            messages = new[]
            {
                new { role = "user", content = prompt }
            }
        };

        var request = new HttpRequestMessage(HttpMethod.Post, AnthropicApiUrl)
        {
            Content = new StringContent(
                JsonSerializer.Serialize(requestBody),
                Encoding.UTF8,
                "application/json")
        };

        request.Headers.Add("x-api-key", apiKey);
        request.Headers.Add("anthropic-version", "2023-06-01");

        var response = await _httpClient.SendAsync(request, cancellationToken);
        var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Anthropic API error: {StatusCode} - {Response}", response.StatusCode, responseContent);
            return new AiProjectSummaryResult
            {
                Success = false,
                Error = $"AI service error: {response.StatusCode}"
            };
        }

        return ParseClaudeResponse(responseContent, data.Metrics);
    }

    private static string BuildPrompt(ProjectAnalysisData data)
    {
        var sb = new StringBuilder();
        sb.AppendLine("You are a construction project analyst AI. Analyze this project data and provide insights.");
        sb.AppendLine();
        sb.AppendLine("PROJECT DETAILS:");
        sb.AppendLine($"- Name: {data.Project.Name}");
        sb.AppendLine($"- Number: {data.Project.Number}");
        sb.AppendLine($"- Status: {data.Project.Status}");
        sb.AppendLine($"- Type: {data.Project.Type}");
        sb.AppendLine($"- Client: {data.Project.ClientName ?? "Not specified"}");
        sb.AppendLine($"- Contract Amount: ${data.Project.ContractAmount:N2}");
        sb.AppendLine($"- Start Date: {data.Project.StartDate?.ToString("yyyy-MM-dd") ?? "Not set"}");
        sb.AppendLine($"- Est. Completion: {data.Project.EstimatedCompletionDate?.ToString("yyyy-MM-dd") ?? "Not set"}");
        sb.AppendLine($"- Location: {data.Project.City}, {data.Project.State}");
        sb.AppendLine();
        sb.AppendLine("TIME TRACKING METRICS:");
        sb.AppendLine($"- Total Hours Logged: {data.Metrics.TotalHoursLogged:N1}");
        sb.AppendLine($"- Total Labor Cost: ${data.Metrics.TotalLaborCost:N2}");
        sb.AppendLine($"- Total Time Entries: {data.Metrics.TotalTimeEntries}");
        sb.AppendLine($"- Daily Average Hours: {data.Metrics.DailyAverageHours:N1}");
        sb.AppendLine($"- Pending Approvals: {data.Metrics.PendingApprovals}");
        sb.AppendLine($"- Old Pending (>7 days): {data.OldPendingApprovals}");
        sb.AppendLine($"- Recent Hours Trend: {data.HoursTrendPercent:+0.0;-0.0;0}%");
        if (data.Metrics.BudgetUtilization.HasValue)
            sb.AppendLine($"- Budget Utilization (labor only): {data.Metrics.BudgetUtilization:N1}%");
        if (data.Metrics.DaysUntilDeadline >= 0)
            sb.AppendLine($"- Days Until Deadline: {data.Metrics.DaysUntilDeadline}");
        sb.AppendLine();
        sb.AppendLine("TEAM:");
        sb.AppendLine($"- Assigned Employees: {data.Metrics.AssignedEmployees}");
        foreach (var emp in data.AssignedEmployeeNames.Take(5))
            sb.AppendLine($"  - {emp}");
        sb.AppendLine();
        sb.AppendLine("TOP CONTRIBUTORS (by hours):");
        foreach (var kvp in data.HoursByEmployee.Take(5))
            sb.AppendLine($"  - {kvp.Key}: {kvp.Value:N1} hrs");
        sb.AppendLine();
        sb.AppendLine("WORK BREAKDOWN (by cost code):");
        foreach (var kvp in data.HoursByCostCode.Take(5))
            sb.AppendLine($"  - {kvp.Key}: {kvp.Value:N1} hrs");
        sb.AppendLine();
        sb.AppendLine("Respond with a JSON object (no markdown, just pure JSON) in this exact format:");
        sb.AppendLine(@"{
  ""summary"": ""A 2-3 sentence executive summary of project health and status"",
  ""healthScore"": 85,
  ""healthStatus"": ""Good"",
  ""highlights"": [""Positive finding 1"", ""Positive finding 2""],
  ""concerns"": [""Concern 1"", ""Concern 2""],
  ""recommendations"": [""Actionable recommendation 1"", ""Actionable recommendation 2""]
}");
        sb.AppendLine();
        sb.AppendLine("Health score guidelines:");
        sb.AppendLine("- 90-100 = Excellent (on track, under budget, no issues)");
        sb.AppendLine("- 70-89 = Good (minor issues but manageable)");
        sb.AppendLine("- 50-69 = At Risk (needs attention)");
        sb.AppendLine("- 0-49 = Critical (immediate action required)");
        sb.AppendLine();
        sb.AppendLine("Be specific and actionable. Use actual numbers from the data. If data is limited, note that.");

        return sb.ToString();
    }

    private AiProjectSummaryResult ParseClaudeResponse(string responseContent, ProjectMetrics metrics)
    {
        try
        {
            using var doc = JsonDocument.Parse(responseContent);
            var root = doc.RootElement;

            // Extract the text content from Claude's response
            var content = root.GetProperty("content")[0].GetProperty("text").GetString();

            if (string.IsNullOrEmpty(content))
            {
                return new AiProjectSummaryResult
                {
                    Success = false,
                    Error = "Empty response from AI"
                };
            }

            // Parse the JSON from Claude's response
            // Handle potential markdown code blocks
            var jsonContent = content.Trim();
            if (jsonContent.StartsWith("```"))
            {
                var startIndex = jsonContent.IndexOf('{');
                var endIndex = jsonContent.LastIndexOf('}');
                if (startIndex >= 0 && endIndex > startIndex)
                {
                    jsonContent = jsonContent.Substring(startIndex, endIndex - startIndex + 1);
                }
            }

            using var aiDoc = JsonDocument.Parse(jsonContent);
            var aiRoot = aiDoc.RootElement;

            var healthScore = aiRoot.TryGetProperty("healthScore", out var hs) ? hs.GetInt32() : 50;
            var healthStatus = healthScore switch
            {
                >= 90 => "Excellent",
                >= 70 => "Good",
                >= 50 => "AtRisk",
                _ => "Critical"
            };

            return new AiProjectSummaryResult
            {
                Success = true,
                Summary = aiRoot.TryGetProperty("summary", out var s) ? s.GetString() : null,
                HealthScore = healthScore,
                HealthStatus = aiRoot.TryGetProperty("healthStatus", out var hst) ? hst.GetString() : healthStatus,
                Highlights = ParseStringArray(aiRoot, "highlights"),
                Concerns = ParseStringArray(aiRoot, "concerns"),
                Recommendations = ParseStringArray(aiRoot, "recommendations"),
                Metrics = metrics,
                GeneratedAt = DateTime.UtcNow
            };
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Failed to parse Claude response: {Response}", responseContent);
            return new AiProjectSummaryResult
            {
                Success = false,
                Error = "Failed to parse AI response"
            };
        }
    }

    private static List<string> ParseStringArray(JsonElement root, string propertyName)
    {
        var list = new List<string>();
        if (root.TryGetProperty(propertyName, out var prop) && prop.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in prop.EnumerateArray())
            {
                var str = item.GetString();
                if (!string.IsNullOrEmpty(str))
                    list.Add(str);
            }
        }
        return list;
    }

    private class ProjectAnalysisData
    {
        public Project Project { get; init; } = null!;
        public ProjectMetrics Metrics { get; init; } = null!;
        public Dictionary<string, decimal> HoursByEmployee { get; init; } = [];
        public Dictionary<string, decimal> HoursByCostCode { get; init; } = [];
        public int OldPendingApprovals { get; init; }
        public decimal HoursTrendPercent { get; init; }
        public List<string> AssignedEmployeeNames { get; init; } = [];
    }
}
