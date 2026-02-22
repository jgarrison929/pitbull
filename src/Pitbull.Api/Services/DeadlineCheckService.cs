using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Pitbull.Core.Data;
using Pitbull.Notifications.Domain;
using Pitbull.Notifications.Services;
using Pitbull.ProjectManagement.Domain;
using Pitbull.RFIs.Domain;

namespace Pitbull.Api.Services;

/// <summary>
/// Background service that periodically checks for upcoming and overdue
/// RFI and submittal deadlines and sends notifications.
/// </summary>
public class DeadlineCheckService(
    IServiceScopeFactory scopeFactory,
    IOptions<DeadlineCheckOptions> options,
    ILogger<DeadlineCheckService> logger) : IHostedService, IDisposable
{
    private PeriodicTimer? _timer;
    private Task? _executingTask;
    private CancellationTokenSource? _cts;

    public Task StartAsync(CancellationToken cancellationToken)
    {
        logger.LogInformation("DeadlineCheckService starting. Interval: {IntervalHours}h", options.Value.IntervalHours);
        _cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        _timer = new PeriodicTimer(TimeSpan.FromHours(options.Value.IntervalHours));
        _executingTask = ExecuteAsync(_cts.Token);
        return Task.CompletedTask;
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        logger.LogInformation("DeadlineCheckService stopping.");
        _cts?.Cancel();
        if (_executingTask is not null)
            await Task.WhenAny(_executingTask, Task.Delay(Timeout.Infinite, cancellationToken));
        _timer?.Dispose();
    }

    private async Task ExecuteAsync(CancellationToken ct)
    {
        await RunCheckAsync(ct);
        while (_timer is not null && await _timer.WaitForNextTickAsync(ct))
            await RunCheckAsync(ct);
    }

    public async Task RunCheckAsync(CancellationToken ct)
    {
        try
        {
            logger.LogInformation("Running deadline check...");
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PitbullDbContext>();
            var tracker = scope.ServiceProvider.GetRequiredService<IDeadlineNotificationTracker>();
            var notifSvc = scope.ServiceProvider.GetRequiredService<INotificationService>();
            var prefSvc = scope.ServiceProvider.GetRequiredService<INotificationPreferenceService>();

            var now = DateTime.UtcNow;
            var tomorrow = now.AddHours(24);

            await CheckRfiDeadlinesAsync(db, tracker, notifSvc, prefSvc, now, tomorrow, ct);
            await CheckSubmittalDeadlinesAsync(db, tracker, notifSvc, prefSvc, now, tomorrow, ct);
            await CheckSubmittalReviewStalenessAsync(db, tracker, notifSvc, prefSvc, now, ct);

            logger.LogInformation("Deadline check complete.");
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error during deadline check.");
        }
    }

    private async Task CheckRfiDeadlinesAsync(PitbullDbContext db, IDeadlineNotificationTracker tracker,
        INotificationService notifSvc, INotificationPreferenceService prefSvc, DateTime now, DateTime tomorrow, CancellationToken ct)
    {
        var openRfis = await db.Set<Rfi>()
            .IgnoreQueryFilters()
            .Where(r => !r.IsDeleted && r.Status == RfiStatus.Open && r.DueDate.HasValue)
            .Select(r => new { r.Id, r.Number, r.DueDate, r.AssignedToUserId, r.BallInCourtUserId, r.CompanyId, r.TenantId })
            .ToListAsync(ct);

        foreach (var rfi in openRfis)
        {
            var dueDate = rfi.DueDate!.Value;
            var userId = rfi.AssignedToUserId ?? rfi.BallInCourtUserId;
            if (userId is null) continue;

            if (dueDate <= now && !await tracker.HasBeenNotifiedAsync("Rfi", rfi.Id, "Overdue", ct))
            {
                if (!await prefSvc.IsNotificationEnabledAsync(userId.Value, rfi.TenantId, "overdue_rfi", ct))
                    continue;

                await notifSvc.CreateAsync(new CreateNotificationCommand(
                    UserId: userId.Value, Title: $"RFI #{rfi.Number} is overdue",
                    Message: $"RFI #{rfi.Number} was due on {dueDate:MMM d, yyyy} and is still open.",
                    Type: NotificationType.OverdueRfi, RelatedEntityType: "Rfi", RelatedEntityId: rfi.Id), ct);
                await tracker.RecordNotificationAsync("Rfi", rfi.Id, "Overdue", ct);
                logger.LogInformation("Sent overdue notification for RFI #{Number}", rfi.Number);
            }
            else if (dueDate > now && dueDate <= tomorrow && !await tracker.HasBeenNotifiedAsync("Rfi", rfi.Id, "Upcoming", ct))
            {
                if (!await prefSvc.IsNotificationEnabledAsync(userId.Value, rfi.TenantId, "rfi_deadline_approaching", ct))
                    continue;

                await notifSvc.CreateAsync(new CreateNotificationCommand(
                    UserId: userId.Value, Title: $"RFI #{rfi.Number} due tomorrow",
                    Message: $"RFI #{rfi.Number} is due on {dueDate:MMM d, yyyy}. Please respond before the deadline.",
                    Type: NotificationType.UpcomingRfi, RelatedEntityType: "Rfi", RelatedEntityId: rfi.Id), ct);
                await tracker.RecordNotificationAsync("Rfi", rfi.Id, "Upcoming", ct);
                logger.LogInformation("Sent upcoming deadline notification for RFI #{Number}", rfi.Number);
            }
        }
    }

    private static readonly SubmittalStatus[] TerminalStatuses =
        [SubmittalStatus.Approved, SubmittalStatus.ApprovedAsNoted, SubmittalStatus.Rejected, SubmittalStatus.Closed];

    private async Task CheckSubmittalDeadlinesAsync(PitbullDbContext db, IDeadlineNotificationTracker tracker,
        INotificationService notifSvc, INotificationPreferenceService prefSvc, DateTime now, DateTime tomorrow, CancellationToken ct)
    {
        var submittals = await db.Set<PmSubmittal>()
            .IgnoreQueryFilters()
            .Where(s => !s.IsDeleted && !TerminalStatuses.Contains(s.Status))
            .Where(s => s.FinalDueDate.HasValue || s.RequiredByDate.HasValue)
            .Select(s => new { s.Id, s.SubmittalNumber, s.FinalDueDate, s.RequiredByDate, s.CompanyId, s.TenantId, s.CreatedBy })
            .ToListAsync(ct);

        foreach (var sub in submittals)
        {
            var dueDate = sub.FinalDueDate ?? sub.RequiredByDate;
            if (dueDate is null) continue;
            if (!Guid.TryParse(sub.CreatedBy, out var userId) || userId == Guid.Empty) continue;

            if (dueDate.Value <= now && !await tracker.HasBeenNotifiedAsync("Submittal", sub.Id, "Overdue", ct))
            {
                if (!await prefSvc.IsNotificationEnabledAsync(userId, sub.TenantId, "overdue_submittal", ct))
                    continue;

                await notifSvc.CreateAsync(new CreateNotificationCommand(
                    UserId: userId, Title: $"Submittal #{sub.SubmittalNumber} is overdue",
                    Message: $"Submittal #{sub.SubmittalNumber} was due on {dueDate.Value:MMM d, yyyy} and is still outstanding.",
                    Type: NotificationType.OverdueSubmittal, RelatedEntityType: "Submittal", RelatedEntityId: sub.Id), ct);
                await tracker.RecordNotificationAsync("Submittal", sub.Id, "Overdue", ct);
                logger.LogInformation("Sent overdue notification for Submittal #{Number}", sub.SubmittalNumber);
            }
            else if (dueDate.Value > now && dueDate.Value <= tomorrow && !await tracker.HasBeenNotifiedAsync("Submittal", sub.Id, "Upcoming", ct))
            {
                if (!await prefSvc.IsNotificationEnabledAsync(userId, sub.TenantId, "submittal_deadline_approaching", ct))
                    continue;

                await notifSvc.CreateAsync(new CreateNotificationCommand(
                    UserId: userId, Title: $"Submittal #{sub.SubmittalNumber} due tomorrow",
                    Message: $"Submittal #{sub.SubmittalNumber} is due on {dueDate.Value:MMM d, yyyy}. Please ensure it's submitted on time.",
                    Type: NotificationType.UpcomingSubmittal, RelatedEntityType: "Submittal", RelatedEntityId: sub.Id), ct);
                await tracker.RecordNotificationAsync("Submittal", sub.Id, "Upcoming", ct);
                logger.LogInformation("Sent upcoming deadline notification for Submittal #{Number}", sub.SubmittalNumber);
            }
        }
    }

    /// <summary>
    /// Checks for submittals in Submitted or InReview status that have been waiting 48+ hours.
    /// Uses SubmittedDate as the staleness anchor for both statuses because PmSubmittal does not
    /// track a separate "entered InReview" timestamp. For InReview submittals this may overstate
    /// staleness if review started significantly after submission, but it's the best available
    /// proxy and errs on the side of follow-up.
    ///
    /// Dedup uses a 24-hour window (via IDeadlineNotificationTracker), so stale submittals
    /// generate daily reminder notifications until resolved — this is intentional to keep
    /// the submitter informed while awaiting review.
    /// </summary>
    private async Task CheckSubmittalReviewStalenessAsync(PitbullDbContext db, IDeadlineNotificationTracker tracker,
        INotificationService notifSvc, INotificationPreferenceService prefSvc, DateTime now, CancellationToken ct)
    {
        var staleThreshold = now.AddHours(-48);

        var staleSubmittals = await db.Set<PmSubmittal>()
            .AsNoTracking()
            .IgnoreQueryFilters()
            .Where(s => !s.IsDeleted
                && (s.Status == SubmittalStatus.Submitted || s.Status == SubmittalStatus.InReview)
                && s.SubmittedDate.HasValue && s.SubmittedDate.Value <= staleThreshold)
            .Select(s => new { s.Id, s.SubmittalNumber, s.SubmittedDate, s.TenantId, s.CreatedBy })
            .ToListAsync(ct);

        foreach (var sub in staleSubmittals)
        {
            if (!Guid.TryParse(sub.CreatedBy, out var userId) || userId == Guid.Empty) continue;
            if (await tracker.HasBeenNotifiedAsync("Submittal", sub.Id, "ReviewStale", ct)) continue;
            if (!await prefSvc.IsNotificationEnabledAsync(userId, sub.TenantId, "submittal_review_stale", ct)) continue;

            var daysSince = (int)(now - sub.SubmittedDate!.Value).TotalDays;
            await notifSvc.CreateAsync(new CreateNotificationCommand(
                UserId: userId,
                Title: $"Submittal #{sub.SubmittalNumber} awaiting review for {daysSince} days",
                Message: $"Submittal #{sub.SubmittalNumber} was submitted {daysSince} days ago and is still awaiting review. Consider following up.",
                Type: NotificationType.SubmittalReviewStale,
                RelatedEntityType: "Submittal",
                RelatedEntityId: sub.Id), ct);
            await tracker.RecordNotificationAsync("Submittal", sub.Id, "ReviewStale", ct);
            logger.LogInformation("Sent stale review notification for Submittal #{Number} ({Days} days)", sub.SubmittalNumber, daysSince);
        }
    }

    public void Dispose()
    {
        _timer?.Dispose();
        _cts?.Dispose();
    }
}

public class DeadlineCheckOptions
{
    public const string SectionName = "DeadlineCheck";
    public double IntervalHours { get; set; } = 1;
}
