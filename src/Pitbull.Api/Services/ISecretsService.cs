namespace Pitbull.Api.Services;

public record SecretStatus(string Key, string DisplayName, string Category, bool IsConfigured, string? MaskedValue);

public interface ISecretsService
{
    string? GetSecret(string key);
    bool IsConfigured(string key);
    string? GetMaskedValue(string key);
    List<SecretStatus> GetAllSecretStatuses();
}

public class SecretsService : ISecretsService
{
    private readonly IConfiguration _configuration;

    private static readonly SecretDefinition[] KnownSecrets =
    [
        new("Jwt:Key", "JWT Signing Key", "Authentication"),
        new("Email:Resend:ApiKey", "Resend Email API Key", "Email", "RESEND_API_KEY"),
        new("Anthropic:ApiKey", "Anthropic API Key", "AI", "ANTHROPIC_API_KEY"),
        new("OpenAI:ApiKey", "OpenAI API Key", "AI", "OPENAI_API_KEY"),
        new("PostHog:ProjectApiKey", "PostHog Analytics Key", "Analytics", "POSTHOG_API_KEY"),
        new("ConnectionStrings:PitbullDb", "PostgreSQL Connection", "Database"),
        new("EventBus:Redis:ConnectionString", "Redis Connection", "Infrastructure"),
    ];

    public SecretsService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public string? GetSecret(string key)
    {
        var definition = KnownSecrets.FirstOrDefault(s => s.ConfigKey == key);
        if (definition is null)
            return _configuration[key];

        // Check config first, then env var fallback
        var value = _configuration[key];
        if (string.IsNullOrWhiteSpace(value) && definition.EnvVarName is not null)
            value = Environment.GetEnvironmentVariable(definition.EnvVarName);

        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    public bool IsConfigured(string key)
    {
        return !string.IsNullOrWhiteSpace(GetSecret(key));
    }

    public string? GetMaskedValue(string key)
    {
        var value = GetSecret(key);
        if (string.IsNullOrWhiteSpace(value))
            return null;

        return MaskSecret(value, key);
    }

    public List<SecretStatus> GetAllSecretStatuses()
    {
        return KnownSecrets.Select(s => new SecretStatus(
            Key: s.ConfigKey,
            DisplayName: s.DisplayName,
            Category: s.Category,
            IsConfigured: IsConfigured(s.ConfigKey),
            MaskedValue: GetMaskedValue(s.ConfigKey)
        )).ToList();
    }

    private static string MaskSecret(string value, string key)
    {
        // Connection strings: show host only
        if (key.Contains("Connection", StringComparison.OrdinalIgnoreCase))
        {
            var hostMatch = System.Text.RegularExpressions.Regex.Match(value, @"Host=([^;]+)");
            if (hostMatch.Success)
                return $"Host={hostMatch.Groups[1].Value};***";
            return "***configured***";
        }

        // Short values: fully mask
        if (value.Length <= 8)
            return "***";

        // API keys: show prefix and last 4
        var prefix = value[..Math.Min(4, value.Length)];
        var suffix = value[^4..];
        return $"{prefix}...{suffix}";
    }

    private record SecretDefinition(string ConfigKey, string DisplayName, string Category, string? EnvVarName = null);
}
