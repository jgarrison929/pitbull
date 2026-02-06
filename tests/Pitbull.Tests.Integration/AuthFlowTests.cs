using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace Pitbull.Tests.Integration;

public class AuthFlowTests(PitbullTestContainersFactory factory) : IClassFixture<PitbullTestContainersFactory>
{
    private HttpClient CreateClient() => factory.CreateClient();

    [Fact]
    public async Task Protected_endpoint_returns_401_without_token()
    {
        using var client = CreateClient();
        var resp = await client.GetAsync("/api/dashboard/stats");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Register_returns_jwt_with_expected_claims_and_allows_access_to_protected_endpoint()
    {
        var email = $"it-{Guid.NewGuid():N}@example.com";

        using var client = CreateClient();
        var registerResp = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password = "SecurePass123",
            firstName = "Integration",
            lastName = "Test",
            companyName = "Integration Test Co"
        });

        registerResp.EnsureSuccessStatusCode();
        var auth = await registerResp.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        Assert.False(string.IsNullOrWhiteSpace(auth!.Token));

        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(auth.Token);

        var sub = jwt.Claims.SingleOrDefault(c => c.Type == JwtRegisteredClaimNames.Sub)?.Value;
        var tenantId = jwt.Claims.SingleOrDefault(c => c.Type == "tenant_id")?.Value;

        Assert.Equal(auth.UserId.ToString(), sub);
        Assert.True(Guid.TryParse(tenantId, out _));

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.Token);
        var protectedResp = await client.GetAsync("/api/dashboard/stats");

        Assert.Equal(HttpStatusCode.OK, protectedResp.StatusCode);
    }

    [Fact]
    public async Task Login_returns_token_and_invalid_token_is_rejected()
    {
        var email = $"it-{Guid.NewGuid():N}@example.com";
        const string password = "SecurePass123";

        using var client = CreateClient();

        // Register
        var registerResp = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password,
            firstName = "Integration",
            lastName = "Test",
            companyName = "Integration Test Co"
        });
        registerResp.EnsureSuccessStatusCode();

        // Login
        var loginResp = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        loginResp.EnsureSuccessStatusCode();

        var login = await loginResp.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(login);
        Assert.False(string.IsNullOrWhiteSpace(login!.Token));

        // Invalid token should be rejected
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "not-a-real-jwt");
        var protectedResp = await client.GetAsync("/api/dashboard/stats");
        Assert.Equal(HttpStatusCode.Unauthorized, protectedResp.StatusCode);
    }

    private sealed record AuthResponse(string Token, Guid UserId, string FullName, string Email);
}
