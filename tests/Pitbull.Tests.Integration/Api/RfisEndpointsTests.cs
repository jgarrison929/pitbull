using System.Net;
using System.Net.Http.Json;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.RFIs.Domain;
using Pitbull.RFIs.Features;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class RfisEndpointsTests(PostgresFixture db) : IAsyncLifetime
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

    private async Task<(HttpClient client, Guid projectId)> CreateAuthenticatedClientWithProjectAsync()
    {
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var createProject = new CreateProjectCommand(
            Name: $"RFI Test Project {Guid.NewGuid():N}",
            Number: $"PRJ-{Guid.NewGuid():N}",
            Description: "Test project for RFI integration tests",
            Type: ProjectType.Commercial,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null,
            ContractAmount: 100000m,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null);

        var createResp = await client.PostAsJsonAsync("/api/projects", createProject);
        createResp.EnsureSuccessStatusCode();
        var project = await createResp.Content.ReadFromJsonAsync<ProjectDto>();

        return (client, project!.Id);
    }

    [Fact]
    public async Task Get_rfis_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync($"/api/projects/{Guid.NewGuid()}/rfis");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Can_create_get_and_list_rfis_when_authenticated()
    {
        await db.ResetAsync();
        var (client, projectId) = await CreateAuthenticatedClientWithProjectAsync();

        // Create RFI
        var createRequest = new
        {
            Subject = "Foundation Depth Clarification",
            Question = "Drawing A2.1 shows 36 inch depth but specification calls for 42 inch. Please clarify.",
            Priority = RfiPriority.High,
            DueDate = DateTime.UtcNow.AddDays(7),
            BallInCourtName = "John Architect"
        };

        var createResp = await client.PostAsJsonAsync($"/api/projects/{projectId}/rfis", createRequest);
        if (createResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 201 Created but got {(int)createResp.StatusCode}. Body: {body}");
        }

        var created = await createResp.Content.ReadFromJsonAsync<RfiDto>();
        Assert.NotNull(created);
        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal(1, created.Number); // First RFI in project should be number 1
        Assert.Equal("Foundation Depth Clarification", created.Subject);
        Assert.Equal(RfiStatus.Open, created.Status);
        Assert.Equal(RfiPriority.High, created.Priority);
        Assert.Equal("John Architect", created.BallInCourtName);

        // Get RFI by ID
        var getResp = await client.GetAsync($"/api/projects/{projectId}/rfis/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var fetched = await getResp.Content.ReadFromJsonAsync<RfiDto>();
        Assert.NotNull(fetched);
        Assert.Equal(created.Id, fetched.Id);
        Assert.Equal(created.Subject, fetched.Subject);

        // List RFIs
        var listResp = await client.GetAsync($"/api/projects/{projectId}/rfis?page=1&pageSize=25");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains("Foundation Depth Clarification", listJson);
    }

    [Fact]
    public async Task Can_update_rfi_and_change_status()
    {
        await db.ResetAsync();
        var (client, projectId) = await CreateAuthenticatedClientWithProjectAsync();

        // Create RFI
        var createRequest = new
        {
            Subject = "Concrete PSI Specification",
            Question = "What is the required concrete PSI for the slab?",
            Priority = RfiPriority.Normal
        };

        var createResp = await client.PostAsJsonAsync($"/api/projects/{projectId}/rfis", createRequest);
        createResp.EnsureSuccessStatusCode();
        var created = await createResp.Content.ReadFromJsonAsync<RfiDto>();

        // Update RFI with answer (should transition to Answered)
        var updateRequest = new
        {
            Subject = "Concrete PSI Specification",
            Question = "What is the required concrete PSI for the slab?",
            Answer = "Use 4000 PSI concrete per spec section 03300.",
            Status = RfiStatus.Answered,
            Priority = RfiPriority.Normal
        };

        var updateResp = await client.PutAsJsonAsync($"/api/projects/{projectId}/rfis/{created!.Id}", updateRequest);
        Assert.Equal(HttpStatusCode.OK, updateResp.StatusCode);

        var updated = await updateResp.Content.ReadFromJsonAsync<RfiDto>();
        Assert.NotNull(updated);
        Assert.Equal(RfiStatus.Answered, updated.Status);
        Assert.Equal("Use 4000 PSI concrete per spec section 03300.", updated.Answer);
        Assert.NotNull(updated.AnsweredAt);
    }

    [Fact]
    public async Task Rfi_numbers_auto_increment_within_project()
    {
        await db.ResetAsync();
        var (client, projectId) = await CreateAuthenticatedClientWithProjectAsync();

        // Create first RFI
        var rfi1Resp = await client.PostAsJsonAsync($"/api/projects/{projectId}/rfis", new
        {
            Subject = "RFI #1",
            Question = "First question"
        });
        rfi1Resp.EnsureSuccessStatusCode();
        var rfi1 = await rfi1Resp.Content.ReadFromJsonAsync<RfiDto>();

        // Create second RFI
        var rfi2Resp = await client.PostAsJsonAsync($"/api/projects/{projectId}/rfis", new
        {
            Subject = "RFI #2",
            Question = "Second question"
        });
        rfi2Resp.EnsureSuccessStatusCode();
        var rfi2 = await rfi2Resp.Content.ReadFromJsonAsync<RfiDto>();

        // Create third RFI
        var rfi3Resp = await client.PostAsJsonAsync($"/api/projects/{projectId}/rfis", new
        {
            Subject = "RFI #3",
            Question = "Third question"
        });
        rfi3Resp.EnsureSuccessStatusCode();
        var rfi3 = await rfi3Resp.Content.ReadFromJsonAsync<RfiDto>();

        Assert.Equal(1, rfi1!.Number);
        Assert.Equal(2, rfi2!.Number);
        Assert.Equal(3, rfi3!.Number);
    }

    [Fact]
    public async Task Rfi_from_other_tenant_is_not_visible()
    {
        await db.ResetAsync();

        // Create RFI as Tenant A
        var (clientA, projectIdA) = await CreateAuthenticatedClientWithProjectAsync();
        var createResp = await clientA.PostAsJsonAsync($"/api/projects/{projectIdA}/rfis", new
        {
            Subject = "Tenant A Secret RFI",
            Question = "This should not be visible to Tenant B"
        });
        createResp.EnsureSuccessStatusCode();
        var rfi = await createResp.Content.ReadFromJsonAsync<RfiDto>();

        // Try to access as Tenant B (different client = different tenant)
        var (clientB, _, _) = await _factory.CreateAuthenticatedClientAsync();
        var getAsOtherTenant = await clientB.GetAsync($"/api/projects/{projectIdA}/rfis/{rfi!.Id}");

        // Should return 404 (not found for this tenant)
        Assert.Equal(HttpStatusCode.NotFound, getAsOtherTenant.StatusCode);
    }

    [Fact]
    public async Task List_rfis_with_status_filter()
    {
        await db.ResetAsync();
        var (client, projectId) = await CreateAuthenticatedClientWithProjectAsync();

        // Create open RFI
        var openResp = await client.PostAsJsonAsync($"/api/projects/{projectId}/rfis", new
        {
            Subject = "Open RFI",
            Question = "Open question"
        });
        openResp.EnsureSuccessStatusCode();

        // Create and answer another RFI
        var answeredResp = await client.PostAsJsonAsync($"/api/projects/{projectId}/rfis", new
        {
            Subject = "Answered RFI",
            Question = "Question that will be answered"
        });
        answeredResp.EnsureSuccessStatusCode();
        var answeredRfi = await answeredResp.Content.ReadFromJsonAsync<RfiDto>();

        await client.PutAsJsonAsync($"/api/projects/{projectId}/rfis/{answeredRfi!.Id}", new
        {
            Subject = "Answered RFI",
            Question = "Question that will be answered",
            Answer = "Here is the answer",
            Status = RfiStatus.Answered,
            Priority = RfiPriority.Normal
        });

        // Filter by Open status - should return 1
        var openFilterResp = await client.GetAsync($"/api/projects/{projectId}/rfis?status=Open");
        openFilterResp.EnsureSuccessStatusCode();
        var openListJson = await openFilterResp.Content.ReadAsStringAsync();
        Assert.Contains("Open RFI", openListJson);
        Assert.DoesNotContain("Answered RFI", openListJson);

        // Filter by Answered status - should return 1
        var answeredFilterResp = await client.GetAsync($"/api/projects/{projectId}/rfis?status=Answered");
        answeredFilterResp.EnsureSuccessStatusCode();
        var answeredListJson = await answeredFilterResp.Content.ReadAsStringAsync();
        Assert.Contains("Answered RFI", answeredListJson);
        Assert.DoesNotContain("Open RFI", answeredListJson);
    }

    [Fact]
    public async Task Get_nonexistent_rfi_returns_404()
    {
        await db.ResetAsync();
        var (client, projectId) = await CreateAuthenticatedClientWithProjectAsync();

        var getResp = await client.GetAsync($"/api/projects/{projectId}/rfis/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Update_nonexistent_rfi_returns_404()
    {
        await db.ResetAsync();
        var (client, projectId) = await CreateAuthenticatedClientWithProjectAsync();

        var updateResp = await client.PutAsJsonAsync($"/api/projects/{projectId}/rfis/{Guid.NewGuid()}", new
        {
            Subject = "Updated Subject",
            Question = "Updated question",
            Status = RfiStatus.Open,
            Priority = RfiPriority.Normal
        });
        Assert.Equal(HttpStatusCode.NotFound, updateResp.StatusCode);
    }
}
