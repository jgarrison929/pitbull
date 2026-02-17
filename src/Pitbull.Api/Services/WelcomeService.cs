using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;

namespace Pitbull.Api.Services;

/// <summary>
/// Manages the welcome/guided tour experience for new users.
/// Tracks which tour steps have been seen and provides tour content.
/// </summary>
public interface IWelcomeService
{
    Task<WelcomeTourDto> GetTourAsync(Guid userId, CancellationToken ct = default);
    Task MarkStepSeenAsync(Guid userId, string stepId, CancellationToken ct = default);
    Task CompleteTourAsync(Guid userId, CancellationToken ct = default);
    Task ResetTourAsync(Guid userId, CancellationToken ct = default);
}

public class WelcomeService(
    PitbullDbContext db,
    ILogger<WelcomeService> logger) : IWelcomeService
{
    // Tour steps defined as static data — no need for a separate DB table
    private static readonly WelcomeTourStep[] TourSteps =
    [
        new("welcome", "Welcome to Pitbull!", "Your construction management platform is ready. Let's take a quick tour.", "dashboard", 1),
        new("projects", "Projects", "Manage all your construction projects in one place. Track budgets, schedules, and team assignments.", "projects", 2),
        new("bids", "Bid Management", "Create and track bids with cost estimation, line items, and bid-to-project conversion.", "bids", 3),
        new("contracts", "Contracts", "Manage subcontracts, change orders, and payment applications.", "contracts", 4),
        new("employees", "Team Management", "Add employees, track time, and manage certifications.", "employees", 5),
        new("reports", "Reports", "Generate certified payroll, cost reports, and project summaries.", "reports", 6),
        new("settings", "Settings", "Configure your modules, company profile, and user preferences.", "settings", 7),
    ];

    public async Task<WelcomeTourDto> GetTourAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
            return new WelcomeTourDto(false, [], [], false);

        // Tour progress is stored as a JSON string in the Tenant.Settings JSONB column
        // For now, use a simple user-level approach via a claim or separate tracking
        var seenSteps = await GetSeenStepsAsync(userId, ct);
        var isComplete = seenSteps.Count >= TourSteps.Length;

        var steps = TourSteps.Select(s => new WelcomeTourStepDto(
            Id: s.Id,
            Title: s.Title,
            Description: s.Description,
            TargetPage: s.TargetPage,
            Order: s.Order,
            IsSeen: seenSteps.Contains(s.Id)
        )).ToList();

        return new WelcomeTourDto(
            IsNewUser: !isComplete && user.CreatedAt > DateTime.UtcNow.AddDays(-7),
            Steps: steps,
            SeenStepIds: seenSteps,
            IsComplete: isComplete);
    }

    public async Task MarkStepSeenAsync(Guid userId, string stepId, CancellationToken ct = default)
    {
        var seenSteps = await GetSeenStepsAsync(userId, ct);
        if (seenSteps.Contains(stepId)) return;

        seenSteps.Add(stepId);
        await SaveSeenStepsAsync(userId, seenSteps, ct);
        logger.LogDebug("User {UserId} completed tour step {StepId}", userId, stepId);
    }

    public async Task CompleteTourAsync(Guid userId, CancellationToken ct = default)
    {
        var allStepIds = TourSteps.Select(s => s.Id).ToList();
        await SaveSeenStepsAsync(userId, allStepIds, ct);
        logger.LogInformation("User {UserId} completed the welcome tour", userId);
    }

    public async Task ResetTourAsync(Guid userId, CancellationToken ct = default)
    {
        await SaveSeenStepsAsync(userId, [], ct);
        logger.LogInformation("User {UserId} reset the welcome tour", userId);
    }

    // Tour progress is stored as a user claim for simplicity.
    // Could be moved to a dedicated table if we need richer tracking.
    private async Task<List<string>> GetSeenStepsAsync(Guid userId, CancellationToken ct)
    {
        var claim = await db.UserClaims
            .FirstOrDefaultAsync(c => c.UserId == userId && c.ClaimType == "tour_seen_steps", ct);

        if (claim?.ClaimValue is null) return [];
        return claim.ClaimValue.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();
    }

    private async Task SaveSeenStepsAsync(Guid userId, List<string> seenSteps, CancellationToken ct)
    {
        var claim = await db.UserClaims
            .FirstOrDefaultAsync(c => c.UserId == userId && c.ClaimType == "tour_seen_steps", ct);

        var value = string.Join(",", seenSteps);

        if (claim is null)
        {
            db.UserClaims.Add(new Microsoft.AspNetCore.Identity.IdentityUserClaim<Guid>
            {
                UserId = userId,
                ClaimType = "tour_seen_steps",
                ClaimValue = value
            });
        }
        else
        {
            claim.ClaimValue = value;
        }

        await db.SaveChangesAsync(ct);
    }
}

// DTOs

public record WelcomeTourStep(string Id, string Title, string Description, string TargetPage, int Order);

public record WelcomeTourStepDto(
    string Id,
    string Title,
    string Description,
    string TargetPage,
    int Order,
    bool IsSeen);

public record WelcomeTourDto(
    bool IsNewUser,
    List<WelcomeTourStepDto> Steps,
    List<string> SeenStepIds,
    bool IsComplete);
