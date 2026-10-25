using DotNetCore.CAP;
using Microsoft.Extensions.Logging;
using Pitbull.TimeTracking.Messages;

namespace Pitbull.TimeTracking.Consumers;

public class TimeEntriesDraftSavedConsumer : ICapSubscribe
{
    private readonly ILogger<TimeEntriesDraftSavedConsumer> _logger;

    public TimeEntriesDraftSavedConsumer(ILogger<TimeEntriesDraftSavedConsumer> logger)
    {
        _logger = logger;
    }

    [CapSubscribe("timeentries.draftsaved")]
    public Task Handle(TimeEntriesDraftSaved msg)
    {
        _logger.LogInformation(
            "Draft time entries saved: BatchId={BatchId}, Count={Count}, SavedBy={SavedById}",
            msg.BatchId, msg.Count, msg.SavedById);
        return Task.CompletedTask;
    }
}
