using System.Net;
using System.Net.Http.Json;
using Pitbull.Bids.Domain;
using Pitbull.Bids.Features;
using Pitbull.Bids.Features.CreateBid;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class BidsEndpointsTests(PostgresFixture db) : IAsyncLifetime
{
    private PitbullApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        _factory = new PitbullApiFactory(db.AppConnectionString);

        using var client = _factory.CreateClient();
        var resp = await client.GetAsync("/health/live");
        resp.EnsureSuccessStatusCode();
    }

    public async Task DisposeAsync()
    {
        _factory.Dispose();
        await Task.CompletedTask;
    }

    [Fact]
    public async Task Get_bids_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/bids");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Can_create_get_and_list_bids_when_authenticated()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var create = new CreateBidCommand(
            Name: "Integration Test Bid",
            Number: $"BID-{Guid.NewGuid():N}",
            EstimatedValue: 500000m,
            BidDate: DateTime.UtcNow.Date,
            DueDate: DateTime.UtcNow.Date.AddDays(7),
            Owner: "Estimator",
            Description: "created by integration test",
            Items: new List<CreateBidItemDto>
            {
                new(
                    Description: "Concrete",
                    Category: BidItemCategory.Material,
                    Quantity: 10,
                    UnitCost: 12.34m)
            });

        var createResp = await client.PostAsJsonAsync("/api/bids", create);
        if (createResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 201 Created but got {(int)createResp.StatusCode} {createResp.StatusCode}. Body: {body}");
        }

        var created = (await createResp.Content.ReadFromJsonAsync<BidDto>())!;
        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal(create.Number, created.Number);
        Assert.Single(created.Items);

        var getResp = await client.GetAsync($"/api/bids/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var fetched = (await getResp.Content.ReadFromJsonAsync<BidDto>())!;
        Assert.Equal(created.Id, fetched.Id);
        Assert.Equal(create.Number, fetched.Number);

        var listResp = await client.GetAsync("/api/bids?page=1&pageSize=25");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains(create.Number, listJson);
    }

    [Fact]
    public async Task Bid_from_other_tenant_is_not_visible_returns_404()
    {
        await db.ResetAsync();

        var (clientTenantA, _, _) = await _factory.CreateAuthenticatedClientAsync();
        var (clientTenantB, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var create = new CreateBidCommand(
            Name: "Tenant A Bid",
            Number: $"BID-A-{Guid.NewGuid():N}",
            EstimatedValue: 1m,
            BidDate: null,
            DueDate: null,
            Owner: null,
            Description: null,
            Items: null);

        var createResp = await clientTenantA.PostAsJsonAsync("/api/bids", create);
        createResp.EnsureSuccessStatusCode();

        var created = (await createResp.Content.ReadFromJsonAsync<BidDto>())!;

        var getAsOtherTenant = await clientTenantB.GetAsync($"/api/bids/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getAsOtherTenant.StatusCode);
    }
}
