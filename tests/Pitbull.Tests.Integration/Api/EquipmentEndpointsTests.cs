using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Pitbull.Core.Domain;
using Pitbull.Core.Features.Equipment;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class EquipmentEndpointsTests(PostgresFixture db) : IAsyncLifetime
{
    private static readonly JsonSerializerOptions JsonOptions = TestJsonOptions.Default;

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

    #region Authentication Tests

    [Fact]
    public async Task Get_equipment_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/equipment");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Create_equipment_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.PostAsJsonAsync("/api/equipment", new
        {
            code = "EX-001",
            name = "Test Excavator"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    #endregion

    #region CRUD Tests

    [Fact]
    public async Task Can_create_equipment()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var createEquipment = new
        {
            code = $"EX-{Guid.NewGuid():N}".Substring(0, 10),
            name = "CAT 320 Excavator",
            description = "Heavy excavator for earthwork",
            type = (int)EquipmentType.HeavyEquipment,
            hourlyRate = 150.00m,
            billingRate = 185.00m,
            isActive = true,
            serialNumber = "CAT0320001"
        };

        var createResp = await client.PostAsJsonAsync("/api/equipment", createEquipment);

        if (createResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 201 Created but got {(int)createResp.StatusCode}. Body: {body}");
        }

        var created = await createResp.Content.ReadFromJsonAsync<EquipmentDto>(JsonOptions);
        Assert.NotNull(created);
        Assert.NotEqual(Guid.Empty, created!.Id);
        Assert.Equal(createEquipment.code, created.Code);
        Assert.Equal(createEquipment.name, created.Name);
        Assert.Equal(EquipmentType.HeavyEquipment, created.Type);
        Assert.Equal(createEquipment.hourlyRate, created.HourlyRate);
    }

    [Fact]
    public async Task Can_get_equipment_by_id()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create equipment
        var code = $"EX-{Guid.NewGuid():N}".Substring(0, 10);
        var createResp = await client.PostAsJsonAsync("/api/equipment", new
        {
            code,
            name = "Test Excavator"
        });
        createResp.EnsureSuccessStatusCode();
        var created = await createResp.Content.ReadFromJsonAsync<EquipmentDto>(JsonOptions);

        // Get by ID
        var getResp = await client.GetAsync($"/api/equipment/{created!.Id}");
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var retrieved = await getResp.Content.ReadFromJsonAsync<EquipmentDto>(JsonOptions);
        Assert.NotNull(retrieved);
        Assert.Equal(created.Id, retrieved!.Id);
        Assert.Equal(code, retrieved.Code);
    }

    [Fact]
    public async Task Get_nonexistent_equipment_returns_404()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync($"/api/equipment/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Can_list_equipment()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create multiple equipment
        await client.PostAsJsonAsync("/api/equipment", new { code = "EX-001", name = "Excavator 1" });
        await client.PostAsJsonAsync("/api/equipment", new { code = "EX-002", name = "Excavator 2" });
        await client.PostAsJsonAsync("/api/equipment", new { code = "TR-001", name = "Truck 1" });

        var listResp = await client.GetAsync("/api/equipment");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var result = await listResp.Content.ReadFromJsonAsync<ListEquipmentResult>(JsonOptions);
        Assert.NotNull(result);
        Assert.Equal(3, result!.TotalCount);
        Assert.Equal(3, result.Items.Count);
    }

    [Fact]
    public async Task Can_filter_equipment_by_active_status()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        await client.PostAsJsonAsync("/api/equipment", new { code = "EX-001", name = "Active", isActive = true });
        await client.PostAsJsonAsync("/api/equipment", new { code = "EX-002", name = "Inactive", isActive = false });

        var activeResp = await client.GetAsync("/api/equipment?isActive=true");
        var activeResult = await activeResp.Content.ReadFromJsonAsync<ListEquipmentResult>(JsonOptions);
        Assert.Equal(1, activeResult!.TotalCount);
        Assert.All(activeResult.Items, item => Assert.True(item.IsActive));
    }

    [Fact]
    public async Task Can_search_equipment()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        await client.PostAsJsonAsync("/api/equipment", new { code = "EX-001", name = "CAT 320 Excavator" });
        await client.PostAsJsonAsync("/api/equipment", new { code = "LR-001", name = "John Deere Loader" });

        var searchResp = await client.GetAsync("/api/equipment?searchTerm=CAT");
        var searchResult = await searchResp.Content.ReadFromJsonAsync<ListEquipmentResult>(JsonOptions);
        Assert.Equal(1, searchResult!.TotalCount);
        Assert.Contains("CAT", searchResult.Items[0].Name);
    }

    [Fact]
    public async Task Can_update_equipment()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create equipment
        var createResp = await client.PostAsJsonAsync("/api/equipment", new
        {
            code = "EX-001",
            name = "Original Name",
            hourlyRate = 100m
        });
        createResp.EnsureSuccessStatusCode();
        var created = await createResp.Content.ReadFromJsonAsync<EquipmentDto>(JsonOptions);

        // Update equipment
        var updateResp = await client.PutAsJsonAsync($"/api/equipment/{created!.Id}", new
        {
            name = "Updated Name",
            hourlyRate = 150m
        });
        Assert.Equal(HttpStatusCode.OK, updateResp.StatusCode);

        var updated = await updateResp.Content.ReadFromJsonAsync<EquipmentDto>(JsonOptions);
        Assert.NotNull(updated);
        Assert.Equal("Updated Name", updated!.Name);
        Assert.Equal(150m, updated.HourlyRate);
        Assert.Equal("EX-001", updated.Code); // Unchanged
    }

    [Fact]
    public async Task Can_delete_equipment()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create equipment
        var createResp = await client.PostAsJsonAsync("/api/equipment", new
        {
            code = "EX-DEL",
            name = "To Delete"
        });
        createResp.EnsureSuccessStatusCode();
        var created = await createResp.Content.ReadFromJsonAsync<EquipmentDto>(JsonOptions);

        // Delete equipment
        var deleteResp = await client.DeleteAsync($"/api/equipment/{created!.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        // Verify it's deleted
        var getResp = await client.GetAsync($"/api/equipment/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    #endregion

    #region Validation Tests

    [Fact]
    public async Task Create_equipment_with_duplicate_code_returns_400()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var code = $"EX-{Guid.NewGuid():N}".Substring(0, 10);

        // Create first equipment
        var resp1 = await client.PostAsJsonAsync("/api/equipment", new
        {
            code,
            name = "First Equipment"
        });
        resp1.EnsureSuccessStatusCode();

        // Try to create with duplicate code
        var resp2 = await client.PostAsJsonAsync("/api/equipment", new
        {
            code,
            name = "Second Equipment"
        });

        Assert.Equal(HttpStatusCode.BadRequest, resp2.StatusCode);
        var body = await resp2.Content.ReadAsStringAsync();
        Assert.Contains("DUPLICATE_CODE", body);
    }

    [Fact]
    public async Task Create_equipment_with_empty_code_returns_400()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.PostAsJsonAsync("/api/equipment", new
        {
            code = "",
            name = "Test Equipment"
        });

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Create_equipment_with_negative_hourly_rate_returns_400()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.PostAsJsonAsync("/api/equipment", new
        {
            code = "EX-001",
            name = "Test Equipment",
            hourlyRate = -10m
        });

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var body = await resp.Content.ReadAsStringAsync();
        Assert.Contains("negative", body, StringComparison.OrdinalIgnoreCase);
    }

    #endregion

    #region Tenant Isolation Tests

    [Fact]
    public async Task Equipment_from_other_tenant_is_not_visible()
    {
        await db.ResetAsync();

        var (clientTenantA, _, _) = await _factory.CreateAuthenticatedClientAsync();
        var (clientTenantB, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create equipment in Tenant A
        var createResp = await clientTenantA.PostAsJsonAsync("/api/equipment", new
        {
            code = $"ISO-{Guid.NewGuid():N}".Substring(0, 10),
            name = "Isolated Equipment"
        });
        createResp.EnsureSuccessStatusCode();
        var created = await createResp.Content.ReadFromJsonAsync<EquipmentDto>(JsonOptions);

        // Try to get equipment from Tenant B - should be 404
        var getAsOtherTenant = await clientTenantB.GetAsync($"/api/equipment/{created!.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getAsOtherTenant.StatusCode);
    }

    #endregion
}
