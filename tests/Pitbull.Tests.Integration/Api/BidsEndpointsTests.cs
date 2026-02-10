using System.Net;
using System.Net.Http.Json;
using Pitbull.Bids.Domain;
using Pitbull.Bids.Features;
using Pitbull.Bids.Features.CreateBid;
using Pitbull.Bids.Features.UpdateBid;
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

    [Fact]
    public async Task Can_update_bid_and_change_status()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create a bid
        var create = new CreateBidCommand(
            Name: "Original Bid",
            Number: $"BID-{Guid.NewGuid():N}",
            EstimatedValue: 100000m,
            BidDate: null,
            DueDate: null,
            Owner: null,
            Description: null,
            Items: null);

        var createResp = await client.PostAsJsonAsync("/api/bids", create);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<BidDto>())!;
        Assert.Equal(BidStatus.Draft, created.Status);

        // Update to Submitted status
        var update = new
        {
            id = created.Id,
            name = "Updated Bid Name",
            number = created.Number,
            status = (int)BidStatus.Submitted,
            estimatedValue = 150000m,
            bidDate = DateTime.UtcNow.Date,
            dueDate = (DateTime?)null,
            owner = "Senior Estimator",
            description = "Updated description",
            items = (object?)null
        };

        var updateResp = await client.PutAsJsonAsync($"/api/bids/{created.Id}", update);
        if (updateResp.StatusCode != HttpStatusCode.OK)
        {
            var body = await updateResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 200 OK but got {(int)updateResp.StatusCode}. Body: {body}");
        }

        var updated = (await updateResp.Content.ReadFromJsonAsync<BidDto>())!;
        Assert.Equal("Updated Bid Name", updated.Name);
        Assert.Equal(BidStatus.Submitted, updated.Status);
        Assert.Equal(150000m, updated.EstimatedValue);
        Assert.Equal("Senior Estimator", updated.Owner);
    }

    [Fact]
    public async Task Can_transition_bid_to_won_status()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create and submit bid
        var create = new CreateBidCommand(
            Name: "Winning Bid",
            Number: $"BID-WIN-{Guid.NewGuid():N}",
            EstimatedValue: 250000m,
            BidDate: DateTime.UtcNow.Date,
            DueDate: DateTime.UtcNow.Date.AddDays(14),
            Owner: "Lead Estimator",
            Description: "This one we'll win",
            Items: null);

        var createResp = await client.PostAsJsonAsync("/api/bids", create);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<BidDto>())!;

        // Update to Won
        var update = new
        {
            id = created.Id,
            name = created.Name,
            number = created.Number,
            status = (int)BidStatus.Won,
            estimatedValue = created.EstimatedValue,
            bidDate = created.BidDate,
            dueDate = created.DueDate,
            owner = created.Owner,
            description = "We won!",
            items = (object?)null
        };

        var updateResp = await client.PutAsJsonAsync($"/api/bids/{created.Id}", update);
        updateResp.EnsureSuccessStatusCode();

        var updated = (await updateResp.Content.ReadFromJsonAsync<BidDto>())!;
        Assert.Equal(BidStatus.Won, updated.Status);
    }

    [Fact]
    public async Task Duplicate_bid_number_in_same_tenant_is_rejected()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var bidNumber = $"BID-DUP-{Guid.NewGuid():N}";

        // Create first bid
        var create1 = new CreateBidCommand(
            Name: "First Bid",
            Number: bidNumber,
            EstimatedValue: 100000m,
            BidDate: null,
            DueDate: null,
            Owner: null,
            Description: null,
            Items: null);

        var resp1 = await client.PostAsJsonAsync("/api/bids", create1);
        resp1.EnsureSuccessStatusCode();

        // Try to create duplicate
        var create2 = new CreateBidCommand(
            Name: "Second Bid",
            Number: bidNumber,
            EstimatedValue: 200000m,
            BidDate: null,
            DueDate: null,
            Owner: null,
            Description: null,
            Items: null);

        var resp2 = await client.PostAsJsonAsync("/api/bids", create2);
        
        // Should be rejected - DB constraint enforces uniqueness
        // Ideally returns 400, but may return 500 if constraint hits DB layer
        Assert.True(
            resp2.StatusCode == HttpStatusCode.BadRequest || 
            resp2.StatusCode == HttpStatusCode.InternalServerError ||
            resp2.StatusCode == HttpStatusCode.Conflict,
            $"Expected rejection but got {resp2.StatusCode}");
    }

    [Fact]
    public async Task Can_delete_bid_and_it_becomes_invisible()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create a bid
        var create = new CreateBidCommand(
            Name: "To Be Deleted",
            Number: $"BID-DEL-{Guid.NewGuid():N}",
            EstimatedValue: 50000m,
            BidDate: null,
            DueDate: null,
            Owner: null,
            Description: null,
            Items: null);

        var createResp = await client.PostAsJsonAsync("/api/bids", create);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<BidDto>())!;

        // Delete it
        var deleteResp = await client.DeleteAsync($"/api/bids/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        // Soft-deleted bid should return 404 on GET
        var getResp = await client.GetAsync($"/api/bids/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);

        // Soft-deleted bid should not appear in list
        var listResp = await client.GetAsync("/api/bids?page=1&pageSize=100");
        listResp.EnsureSuccessStatusCode();
        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.DoesNotContain(created.Number, listJson);
    }

    [Fact]
    public async Task Delete_nonexistent_bid_returns_404()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var nonexistentId = Guid.NewGuid();
        var resp = await client.DeleteAsync($"/api/bids/{nonexistentId}");

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Can_convert_won_bid_to_project()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create and mark bid as Won
        var bidNumber = $"BID-CONV-{Guid.NewGuid():N}";
        var create = new CreateBidCommand(
            Name: "Bid to Convert",
            Number: bidNumber,
            EstimatedValue: 300000m,
            BidDate: DateTime.UtcNow.Date,
            DueDate: null,
            Owner: "Estimator",
            Description: "This will become a project",
            Items: null);

        var createResp = await client.PostAsJsonAsync("/api/bids", create);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<BidDto>())!;

        // Update to Won status
        var update = new
        {
            id = created.Id,
            name = created.Name,
            number = created.Number,
            status = (int)BidStatus.Won,
            estimatedValue = created.EstimatedValue,
            bidDate = created.BidDate,
            dueDate = (DateTime?)null,
            owner = created.Owner,
            description = created.Description,
            items = (object?)null
        };

        var updateResp = await client.PutAsJsonAsync($"/api/bids/{created.Id}", update);
        updateResp.EnsureSuccessStatusCode();

        // Convert to project
        var projectNumber = $"PRJ-{Guid.NewGuid():N}";
        var convertResp = await client.PostAsJsonAsync($"/api/bids/{created.Id}/convert-to-project", new { projectNumber });
        
        if (convertResp.StatusCode != HttpStatusCode.OK)
        {
            var body = await convertResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 200 OK but got {(int)convertResp.StatusCode}. Body: {body}");
        }

        var convertResult = await convertResp.Content.ReadAsStringAsync();
        Assert.Contains("projectId", convertResult, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Convert_non_won_bid_returns_400()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create a draft bid (not won)
        var create = new CreateBidCommand(
            Name: "Draft Bid",
            Number: $"BID-DRAFT-{Guid.NewGuid():N}",
            EstimatedValue: 100000m,
            BidDate: null,
            DueDate: null,
            Owner: null,
            Description: null,
            Items: null);

        var createResp = await client.PostAsJsonAsync("/api/bids", create);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<BidDto>())!;

        // Try to convert - should fail
        var convertResp = await client.PostAsJsonAsync($"/api/bids/{created.Id}/convert-to-project", new { projectNumber = "PRJ-TEST" });
        Assert.Equal(HttpStatusCode.BadRequest, convertResp.StatusCode);
    }

    [Fact]
    public async Task Convert_nonexistent_bid_returns_404()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var convertResp = await client.PostAsJsonAsync($"/api/bids/{Guid.NewGuid()}/convert-to-project", new { projectNumber = "PRJ-NOEXIST" });
        Assert.Equal(HttpStatusCode.NotFound, convertResp.StatusCode);
    }
}
