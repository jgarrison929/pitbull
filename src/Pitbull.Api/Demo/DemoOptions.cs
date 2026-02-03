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

    public string UserEmail { get; init; } = "demo@pitbullconstructionsolutions.com";
    public string UserPassword { get; init; } = string.Empty;
    public string UserFirstName { get; init; } = "Demo";
    public string UserLastName { get; init; } = "User";
}
