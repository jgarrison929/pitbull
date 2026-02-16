using FluentAssertions;
using MassTransit;
using MassTransit.Testing;
using Microsoft.Extensions.DependencyInjection;
using Pitbull.TimeTracking.Consumers;
using Pitbull.TimeTracking.Messages;

namespace Pitbull.Tests.Unit.Consumers;

public sealed class TimeEntriesSubmittedConsumerTests
{
    [Fact]
    public async Task Consumer_ReceivesPublishedMessage()
    {
        // Arrange
        await using var provider = new ServiceCollection()
            .AddMassTransitTestHarness(cfg =>
            {
                cfg.AddConsumer<TimeEntriesSubmittedConsumer>();
            })
            .BuildServiceProvider(true);

        var harness = provider.GetRequiredService<ITestHarness>();
        await harness.Start();

        var message = new TimeEntriesSubmitted
        {
            BatchId = Guid.NewGuid(),
            SubmittedById = Guid.NewGuid(),
            TimeEntryIds = [Guid.NewGuid(), Guid.NewGuid()],
            Count = 2,
            SubmittedAt = DateTime.UtcNow
        };

        // Act
        await harness.Bus.Publish(message);

        // Assert
        (await harness.Consumed.Any<TimeEntriesSubmitted>()).Should().BeTrue();

        var consumerHarness = harness.GetConsumerHarness<TimeEntriesSubmittedConsumer>();
        (await consumerHarness.Consumed.Any<TimeEntriesSubmitted>()).Should().BeTrue();

        await harness.Stop();
    }

    [Fact]
    public async Task DraftSavedConsumer_ReceivesPublishedMessage()
    {
        // Arrange
        await using var provider = new ServiceCollection()
            .AddMassTransitTestHarness(cfg =>
            {
                cfg.AddConsumer<TimeEntriesDraftSavedConsumer>();
            })
            .BuildServiceProvider(true);

        var harness = provider.GetRequiredService<ITestHarness>();
        await harness.Start();

        var message = new TimeEntriesDraftSaved
        {
            BatchId = Guid.NewGuid(),
            SavedById = Guid.NewGuid(),
            Count = 5,
            SavedAt = DateTime.UtcNow
        };

        // Act
        await harness.Bus.Publish(message);

        // Assert
        (await harness.Consumed.Any<TimeEntriesDraftSaved>()).Should().BeTrue();

        var consumerHarness = harness.GetConsumerHarness<TimeEntriesDraftSavedConsumer>();
        (await consumerHarness.Consumed.Any<TimeEntriesDraftSaved>()).Should().BeTrue();

        await harness.Stop();
    }
}
