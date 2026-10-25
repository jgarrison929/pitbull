namespace Pitbull.Api.Services;

/// <summary>
/// AI-powered insights service for project analysis.
/// Uses Claude to generate intelligent project summaries.
/// </summary>
public interface IAiInsightsService
{
    /// <summary>
    /// Generate an AI-powered summary and health assessment for a project.
    /// </summary>
    /// <param name="projectId">The project to analyze</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>AI-generated project insights</returns>
    Task<AiProjectSummaryResult> GetProjectSummaryAsync(Guid projectId, CancellationToken cancellationToken = default);
}

/// <summary>
/// AI-generated project insights and health assessment.
/// </summary>
public record AiProjectSummaryResult
{
    /// <summary>
    /// Whether the AI analysis was successful
    /// </summary>
    public bool Success { get; init; }

    /// <summary>
    /// Error message if analysis failed
    /// </summary>
    public string? Error { get; init; }

    /// <summary>
    /// Natural language summary of the project status
    /// </summary>
    public string? Summary { get; init; }

    /// <summary>
    /// Overall health score from 0-100
    /// </summary>
    public int HealthScore { get; init; }

    /// <summary>
    /// Health status category (Excellent, Good, AtRisk, Critical)
    /// </summary>
    public string? HealthStatus { get; init; }

    /// <summary>
    /// Positive highlights about the project
    /// </summary>
    public List<string> Highlights { get; init; } = [];

    /// <summary>
    /// Potential concerns or issues
    /// </summary>
    public List<string> Concerns { get; init; } = [];

    /// <summary>
    /// AI-generated recommendations
    /// </summary>
    public List<string> Recommendations { get; init; } = [];

    /// <summary>
    /// Key metrics used in the analysis
    /// </summary>
    public ProjectMetrics? Metrics { get; init; }

    /// <summary>
    /// Timestamp when analysis was generated
    /// </summary>
    public DateTime GeneratedAt { get; init; } = DateTime.UtcNow;
}

/// <summary>
/// Key project metrics used in AI analysis
/// </summary>
public record ProjectMetrics
{
    public decimal TotalHoursLogged { get; init; }
    public decimal TotalLaborCost { get; init; }
    public int TotalTimeEntries { get; init; }
    public int PendingApprovals { get; init; }
    public int AssignedEmployees { get; init; }
    public int DaysUntilDeadline { get; init; }
    public decimal? BudgetUtilization { get; init; }
    public decimal? DailyAverageHours { get; init; }
}
