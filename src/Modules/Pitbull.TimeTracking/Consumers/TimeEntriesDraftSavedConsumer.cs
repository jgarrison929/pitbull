using MassTransit;
using Microsoft.Extensions.Logging;
using Pitbull.TimeTracking.Messages;

namespace Pitbull.TimeTracking.Consumers;

public class TimeEntriesDraftSavedConsumer : IConsumer<TimeEntriesDraftSaved>
{
    private readonly ILogger<TimeEntriesDraftSavedConsumer> _logger;

    public TimeEntriesDraftSavedConsumer(ILogger<TimeEntriesDraftSavedConsumer> logger)
    {
        _logger = logger;
    }

    public Task Consume(ConsumeContext<TimeEntriesDraftSaved> context)
    {
        var msg = context.Message;
        _logger.LogInformation(
            "Draft time entries saved: BatchId={BatchId}, Count={Count}, SavedBy={SavedById}",
            msg.BatchId, msg.Count, msg.SavedById);
        return Task.CompletedTask;
    }
}
