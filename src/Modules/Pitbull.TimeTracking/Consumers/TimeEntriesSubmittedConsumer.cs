using MassTransit;
using Microsoft.Extensions.Logging;
using Pitbull.TimeTracking.Messages;

namespace Pitbull.TimeTracking.Consumers;

public class TimeEntriesSubmittedConsumer : IConsumer<TimeEntriesSubmitted>
{
    private readonly ILogger<TimeEntriesSubmittedConsumer> _logger;

    public TimeEntriesSubmittedConsumer(ILogger<TimeEntriesSubmittedConsumer> logger)
    {
        _logger = logger;
    }

    public Task Consume(ConsumeContext<TimeEntriesSubmitted> context)
    {
        var msg = context.Message;
        _logger.LogInformation(
            "Time entries submitted: BatchId={BatchId}, Count={Count}, SubmittedBy={SubmittedById}",
            msg.BatchId, msg.Count, msg.SubmittedById);
        return Task.CompletedTask;
    }
}
