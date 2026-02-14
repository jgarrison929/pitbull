using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Pitbull.Api.Controllers;

namespace Pitbull.Tests.Integration.Infrastructure;

public sealed class PitbullApiFactory(string connectionString) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:PitbullDb"] = connectionString
            });
        });
    }

    public async Task<(HttpClient Client, AuthResponse Auth, Guid TenantId)> CreateAuthenticatedClientAsync(
        string? email = null,
        string password = "SecurePass123",
        string firstName = "Test",
        string lastName = "User",
        string? companyName = null)
    {
        var client = CreateClient();

        email ??= $"test-{Guid.NewGuid():N}@example.com";
        companyName ??= $"TestCo-{Guid.NewGuid():N}";

        var registerResponse = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(
            Email: email,
            Password: password,
            FirstName: firstName,
            LastName: lastName,
            TenantId: default,
            CompanyName: companyName));

        registerResponse.EnsureSuccessStatusCode();

        var auth = (await registerResponse.Content.ReadFromJsonAsync<AuthResponse>())
            ?? throw new InvalidOperationException("Registration returned empty body");

        var tenantId = ExtractTenantId(auth.Token);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.Token);
        // Also attach X-Tenant-Id so tenant resolution is deterministic in tests.
        client.DefaultRequestHeaders.Add("X-Tenant-Id", tenantId.ToString());

        return (client, auth, tenantId);
    }

    private static Guid ExtractTenantId(string jwt)
    {
        var handler = new JwtSecurityTokenHandler();
        var token = handler.ReadJwtToken(jwt);
        var claim = token.Claims.FirstOrDefault(c => c.Type == "tenant_id")?.Value;

        if (!Guid.TryParse(claim, out var tenantId))
            throw new InvalidOperationException("JWT did not contain a valid tenant_id claim");

        return tenantId;
    }

    /// <summary>
    /// Extracts the company_id claim from a JWT token.
    /// </summary>
    public static Guid? ExtractCompanyId(string jwt)
    {
        var handler = new JwtSecurityTokenHandler();
        var token = handler.ReadJwtToken(jwt);
        var claim = token.Claims.FirstOrDefault(c => c.Type == "company_id")?.Value;

        if (string.IsNullOrEmpty(claim) || !Guid.TryParse(claim, out var companyId))
            return null;

        return companyId;
    }

    /// <summary>
    /// Extracts the company_ids claim (comma-separated) from a JWT token.
    /// </summary>
    public static List<Guid> ExtractCompanyIds(string jwt)
    {
        var handler = new JwtSecurityTokenHandler();
        var token = handler.ReadJwtToken(jwt);
        var claim = token.Claims.FirstOrDefault(c => c.Type == "company_ids")?.Value;

        if (string.IsNullOrEmpty(claim))
            return [];

        return claim.Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(s => Guid.TryParse(s, out var id) ? id : Guid.Empty)
            .Where(id => id != Guid.Empty)
            .ToList();
    }

    /// <summary>
    /// Creates an HttpClient with X-Company-Id header set.
    /// </summary>
    public HttpClient CreateClientWithCompanyHeader(HttpClient existingClient, Guid companyId)
    {
        // Clone headers to a new client
        var newClient = CreateClient();
        foreach (var header in existingClient.DefaultRequestHeaders)
        {
            if (header.Key != "X-Company-Id")
                newClient.DefaultRequestHeaders.TryAddWithoutValidation(header.Key, header.Value);
        }
        newClient.DefaultRequestHeaders.Add("X-Company-Id", companyId.ToString());
        return newClient;
    }
}
