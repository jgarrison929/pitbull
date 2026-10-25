using Microsoft.Extensions.Logging;
using Moq;
using Pitbull.TimeTracking.Consumers;
using Pitbull.TimeTracking.Messages;

namespace Pitbull.Tests.Unit.Consumers;

public sealed class TimeEntriesSubmittedConsumerTests
{
    [Fact]
    public async Task Consumer_HandlesSubmittedMessage()
    {
        var message = new TimeEntriesSubmitted
        {
            BatchId = Guid.NewGuid(),
            SubmittedById = Guid.NewGuid(),
            TimeEntryIds = [Guid.NewGuid(), Guid.NewGuid()],
            Count = 2,
            SubmittedAt = DateTime.UtcNow
        };

        var logger = new Mock<ILogger<TimeEntriesSubmittedConsumer>>();
        var consumer = new TimeEntriesSubmittedConsumer(logger.Object);

        // Act
        await consumer.Handle(message);

        // Assert
        logger.Verify(
            x => x.Log(
                LogLevel.Information,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, _) => v.ToString()!.Contains("Time entries submitted")),
                It.IsAny<Exception>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [Fact]
    public async Task DraftSavedConsumer_HandlesDraftSavedMessage()
    {
        var message = new TimeEntriesDraftSaved
        {
            BatchId = Guid.NewGuid(),
            SavedById = Guid.NewGuid(),
            Count = 5,
            SavedAt = DateTime.UtcNow
        };

        var logger = new Mock<ILogger<TimeEntriesDraftSavedConsumer>>();
        var consumer = new TimeEntriesDraftSavedConsumer(logger.Object);

        // Act
        await consumer.Handle(message);

        // Assert
        logger.Verify(
            x => x.Log(
                LogLevel.Information,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, _) => v.ToString()!.Contains("Draft time entries saved")),
                It.IsAny<Exception>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }
}
