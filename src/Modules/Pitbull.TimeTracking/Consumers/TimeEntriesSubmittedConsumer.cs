using DotNetCore.CAP;
using Microsoft.Extensions.Logging;
using Pitbull.TimeTracking.Messages;

namespace Pitbull.TimeTracking.Consumers;

public class TimeEntriesSubmittedConsumer : ICapSubscribe
{
    private readonly ILogger<TimeEntriesSubmittedConsumer> _logger;

    public TimeEntriesSubmittedConsumer(ILogger<TimeEntriesSubmittedConsumer> logger)
    {
        _logger = logger;
    }

    [CapSubscribe("timeentries.submitted")]
    public Task Handle(TimeEntriesSubmitted msg)
    {
        _logger.LogInformation(
            "Time entries submitted: BatchId={BatchId}, Count={Count}, SubmittedBy={SubmittedById}",
            msg.BatchId, msg.Count, msg.SubmittedById);
        return Task.CompletedTask;
    }
}
