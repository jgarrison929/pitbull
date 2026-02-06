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
}
