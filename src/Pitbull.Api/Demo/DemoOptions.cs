namespace Pitbull.Api.Demo;

/// <summary>
/// Configuration for the public demo environment (Railway).
///
/// NOTE: This is intended for a single shared demo tenant on a public URL.
/// Keep write operations constrained and prefer read-only flows.
/// </summary>
public sealed class DemoOptions
{
    public const string SectionName = "Demo";

    /// <summary>
    /// Enables demo-specific behavior (bootstrap, optional auth restrictions).
    /// </summary>
    public bool Enabled { get; init; } = false;

    /// <summary>
    /// If true, the API will ensure the demo tenant/user exist and attempt to seed
    /// demo data on application startup.
    ///
    /// Safe to run repeatedly (seeding is idempotent per tenant).
    /// </summary>
    public bool SeedOnStartup { get; init; } = false;

    /// <summary>
    /// If true, disables self-service registration endpoints (recommended for public demos).
    /// </summary>
    public bool DisableRegistration { get; init; } = true;

    public Guid? TenantId { get; init; }
    public string TenantName { get; init; } = "Pitbull Demo";
    public string TenantSlug { get; init; } = "demo";

    public string UserEmail { get; init; } = "demo@example.com";
    public string UserPassword { get; init; } = string.Empty;
    public string UserFirstName { get; init; } = "Demo";
    public string UserLastName { get; init; } = "User";

    // AI config for demo users
    public string AiModel { get; init; } = "claude-3-5-haiku-latest";
    public int AiMaxTokensPerUser { get; init; } = 10000;
    public string AiSystemPrompt { get; init; } =
        "You are the AI assistant for Pitbull Construction Solutions, an AI-native ERP platform for construction companies. " +
        "Help users understand the platform features and answer construction industry questions. " +
        "Do not discuss pricing, competitors, or internal implementation details.";
}
