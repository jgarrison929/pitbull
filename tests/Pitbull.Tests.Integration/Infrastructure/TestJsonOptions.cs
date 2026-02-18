using System.Text.Json;
using System.Text.Json.Serialization;

namespace Pitbull.Tests.Integration.Infrastructure;

/// <summary>
/// Shared JSON serializer options for integration tests.
/// Mirrors the API's configuration (camelCase + string enums) so that
/// ReadFromJsonAsync can correctly deserialize response payloads.
/// </summary>
public static class TestJsonOptions
{
    public static readonly JsonSerializerOptions Default = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };
}
