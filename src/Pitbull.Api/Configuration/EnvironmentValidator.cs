using System.ComponentModel.DataAnnotations;

namespace Pitbull.Api.Configuration;

/// <summary>
/// Validates required environment variables and configuration at startup.
/// Prevents runtime failures from missing/invalid configuration.
/// </summary>
public static class EnvironmentValidator
{
    /// <summary>
    /// Validates all critical configuration values are present and valid.
    /// Throws InvalidOperationException with detailed messages if validation fails.
    /// </summary>
    public static void ValidateRequiredConfiguration(IConfiguration configuration)
    {
        var errors = new List<string>();

        // Database configuration
        ValidateConnectionString(configuration, "ConnectionStrings:PitbullDb", errors);
        
        // JWT configuration (required for auth)
        ValidateJwtConfiguration(configuration, errors);
        
        // CORS configuration (required for web app)
        ValidateCorsConfiguration(configuration, errors);
        
        // Demo configuration validation (when demo is enabled)
        ValidateDemoConfiguration(configuration, errors);

        if (errors.Any())
        {
            var message = "Configuration validation failed:\n" + string.Join("\n", errors.Select(e => $"  - {e}"));
            throw new InvalidOperationException(message);
        }
    }

    private static void ValidateConnectionString(IConfiguration configuration, string key, List<string> errors)
    {
        var connectionString = configuration[key];
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            errors.Add($"Missing required connection string: {key}");
            return;
        }

        // Basic connection string validation
        if (!connectionString.Contains("Database=") && !connectionString.Contains("Initial Catalog="))
        {
            errors.Add($"Invalid connection string format: {key} (missing database name)");
        }
    }

    private static void ValidateJwtConfiguration(IConfiguration configuration, List<string> errors)
    {
        var jwtKey = configuration["Jwt:Key"];
        var jwtIssuer = configuration["Jwt:Issuer"];
        var jwtAudience = configuration["Jwt:Audience"];

        if (string.IsNullOrWhiteSpace(jwtKey))
        {
            errors.Add("Missing required JWT key: Jwt:Key");
        }
        else if (jwtKey.Length < 32)
        {
            errors.Add("JWT key too short: Jwt:Key must be at least 32 characters for security");
        }

        if (string.IsNullOrWhiteSpace(jwtIssuer))
        {
            errors.Add("Missing required JWT issuer: Jwt:Issuer");
        }

        if (string.IsNullOrWhiteSpace(jwtAudience))
        {
            errors.Add("Missing required JWT audience: Jwt:Audience");
        }
    }

    private static void ValidateCorsConfiguration(IConfiguration configuration, List<string> errors)
    {
        var corsSection = configuration.GetSection("Cors:AllowedOrigins");
        var allowedOrigins = corsSection.GetChildren().Select(x => x.Value).Where(x => !string.IsNullOrWhiteSpace(x));

        if (!allowedOrigins.Any())
        {
            errors.Add("Missing CORS configuration: At least one allowed origin must be configured in Cors:AllowedOrigins");
        }

        foreach (var origin in allowedOrigins)
        {
            if (!Uri.IsWellFormedUriString(origin, UriKind.Absolute))
            {
                errors.Add($"Invalid CORS origin format: '{origin}' is not a valid absolute URI");
            }
        }
    }

    private static void ValidateDemoConfiguration(IConfiguration configuration, List<string> errors)
    {
        var demoEnabled = configuration.GetValue<bool>("Demo:Enabled");
        if (!demoEnabled)
        {
            return; // Demo config only matters when demo is enabled
        }

        var requiredDemoKeys = new[]
        {
            "Demo:TenantSlug",
            "Demo:TenantName", 
            "Demo:UserEmail",
            "Demo:UserPassword"
        };

        foreach (var key in requiredDemoKeys)
        {
            var value = configuration[key];
            if (string.IsNullOrWhiteSpace(value))
            {
                errors.Add($"Missing required demo configuration: {key} (required when Demo:Enabled=true)");
            }
        }

        // Validate demo user email format
        var demoEmail = configuration["Demo:UserEmail"];
        if (!string.IsNullOrWhiteSpace(demoEmail))
        {
            var emailAttribute = new EmailAddressAttribute();
            if (!emailAttribute.IsValid(demoEmail))
            {
                errors.Add($"Invalid demo email format: Demo:UserEmail '{demoEmail}' is not a valid email address");
            }
        }

        // Validate demo password strength
        var demoPassword = configuration["Demo:UserPassword"];
        if (!string.IsNullOrWhiteSpace(demoPassword) && demoPassword.Length < 8)
        {
            errors.Add("Demo password too weak: Demo:UserPassword must be at least 8 characters");
        }
    }
}