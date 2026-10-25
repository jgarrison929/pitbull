using Serilog.Core;
using Serilog.Events;
using Pitbull.Api.Services;

namespace Pitbull.Api.Infrastructure;

public sealed class InMemorySerilogErrorSink(IErrorLogStore errorLogStore) : ILogEventSink
{
    public void Emit(LogEvent logEvent)
    {
        if (logEvent.Level < LogEventLevel.Error)
            return;

        errorLogStore.Add(new RecentErrorEntry(
            TimestampUtc: logEvent.Timestamp.UtcDateTime,
            Level: logEvent.Level.ToString(),
            Message: logEvent.RenderMessage(),
            Exception: logEvent.Exception?.Message,
            TraceId: ReadProperty(logEvent, "TraceId"),
            RequestPath: ReadProperty(logEvent, "RequestPath")));
    }

    private static string? ReadProperty(LogEvent logEvent, string name)
    {
        if (!logEvent.Properties.TryGetValue(name, out var value))
            return null;

        return value.ToString().Trim('"');
    }
}
