using System.Net;
using System.Net.Http.Json;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreatePaymentApplication;
using Pitbull.Contracts.Features.CreateSubcontract;
using Pitbull.Contracts.Features.UpdatePaymentApplication;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class PaymentApplicationsEndpointsTests(PostgresFixture db) : IAsyncLifetime
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

    private async Task<(HttpClient client, Guid projectId, Guid subcontractId)> SetupProjectAndSubcontractAsync()
    {
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create project
        var projectCmd = new CreateProjectCommand(
            Name: "Payment Application Test Project",
            Number: $"PRJ-{Guid.NewGuid():N}",
            Description: null,
            Type: ProjectType.Commercial,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: DateTime.UtcNow.AddMonths(-1),
            EstimatedCompletionDate: DateTime.UtcNow.AddMonths(6),
            ContractAmount: 1_000_000m,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null);

        var projectResp = await client.PostAsJsonAsync("/api/projects", projectCmd);
        projectResp.EnsureSuccessStatusCode();
        var project = (await projectResp.Content.ReadFromJsonAsync<ProjectDto>())!;

        // Create subcontract
        var subcontractCmd = new CreateSubcontractCommand(
            ProjectId: project.Id,
            SubcontractNumber: $"SC-{Guid.NewGuid():N}",
            SubcontractorName: "Test Subcontractor",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "Concrete work",
            TradeCode: "03 - Concrete",
            OriginalValue: 150_000m,
            RetainagePercent: 10m,
            StartDate: DateTime.UtcNow.AddMonths(-1),
            CompletionDate: DateTime.UtcNow.AddMonths(2),
            LicenseNumber: null,
            Notes: null);

        var scResp = await client.PostAsJsonAsync("/api/subcontracts", subcontractCmd);
        scResp.EnsureSuccessStatusCode();
        var subcontract = (await scResp.Content.ReadFromJsonAsync<SubcontractDto>())!;

        return (client, project.Id, subcontract.Id);
    }

    [Fact]
    public async Task Get_paymentapplications_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/paymentapplications");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Can_create_get_and_list_payment_applications()
    {
        await db.ResetAsync();

        var (client, _, subcontractId) = await SetupProjectAndSubcontractAsync();

        // Create a payment application (first draw)
        var periodStart = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var periodEnd = new DateTime(2026, 1, 31, 0, 0, 0, DateTimeKind.Utc);
        
        var payAppCmd = new CreatePaymentApplicationCommand(
            SubcontractId: subcontractId,
            PeriodStart: periodStart,
            PeriodEnd: periodEnd,
            WorkCompletedThisPeriod: 30_000m,
            StoredMaterials: 5_000m,
            InvoiceNumber: "INV-001",
            Notes: "First monthly draw");

        var createResp = await client.PostAsJsonAsync("/api/paymentapplications", payAppCmd);
        if (createResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 201 Created but got {(int)createResp.StatusCode}. Body: {body}");
        }

        var created = (await createResp.Content.ReadFromJsonAsync<PaymentApplicationDto>())!;
        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal(1, created.ApplicationNumber); // First application
        Assert.Equal(payAppCmd.WorkCompletedThisPeriod, created.WorkCompletedThisPeriod);
        Assert.Equal(payAppCmd.StoredMaterials, created.StoredMaterials);
        Assert.Equal(PaymentApplicationStatus.Draft, created.Status);
        
        // Verify calculations
        Assert.Equal(35_000m, created.TotalCompletedAndStored); // 30K work + 5K materials
        Assert.Equal(10m, created.RetainagePercent); // From subcontract

        // Get by ID
        var getResp = await client.GetAsync($"/api/paymentapplications/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var fetched = (await getResp.Content.ReadFromJsonAsync<PaymentApplicationDto>())!;
        Assert.Equal(created.Id, fetched.Id);
        Assert.Equal(created.ApplicationNumber, fetched.ApplicationNumber);

        // List
        var listResp = await client.GetAsync("/api/paymentapplications?page=1&pageSize=25");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains(payAppCmd.InvoiceNumber!, listJson);
    }

    [Fact]
    public async Task Payment_application_from_other_tenant_is_not_visible()
    {
        await db.ResetAsync();

        // Tenant A creates project, subcontract, and payment application
        var (clientA, _, subcontractIdA) = await SetupProjectAndSubcontractAsync();

        var payAppCmd = new CreatePaymentApplicationCommand(
            SubcontractId: subcontractIdA,
            PeriodStart: new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd: new DateTime(2026, 1, 31, 0, 0, 0, DateTimeKind.Utc),
            WorkCompletedThisPeriod: 20_000m,
            StoredMaterials: 0m,
            InvoiceNumber: "A-INV-001",
            Notes: null);

        var createResp = await clientA.PostAsJsonAsync("/api/paymentapplications", payAppCmd);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<PaymentApplicationDto>())!;

        // Create Tenant B client
        var (clientB, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Tenant B should not see it
        var getAsOtherTenant = await clientB.GetAsync($"/api/paymentapplications/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getAsOtherTenant.StatusCode);

        // Tenant B's list should not contain it
        var listResp = await clientB.GetAsync("/api/paymentapplications?page=1&pageSize=100");
        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.DoesNotContain(payAppCmd.InvoiceNumber!, listJson);
    }

    [Fact]
    public async Task Payment_application_for_nonexistent_subcontract_returns_400()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var payAppCmd = new CreatePaymentApplicationCommand(
            SubcontractId: Guid.NewGuid(), // doesn't exist
            PeriodStart: new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd: new DateTime(2026, 1, 31, 0, 0, 0, DateTimeKind.Utc),
            WorkCompletedThisPeriod: 10_000m,
            StoredMaterials: 0m,
            InvoiceNumber: null,
            Notes: null);

        var resp = await client.PostAsJsonAsync("/api/paymentapplications", payAppCmd);

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        var body = await resp.Content.ReadAsStringAsync();
        Assert.Contains("not found", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Second_payment_application_increments_application_number()
    {
        await db.ResetAsync();

        var (client, _, subcontractId) = await SetupProjectAndSubcontractAsync();

        // First payment application
        var payApp1 = new CreatePaymentApplicationCommand(
            SubcontractId: subcontractId,
            PeriodStart: new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd: new DateTime(2026, 1, 31, 0, 0, 0, DateTimeKind.Utc),
            WorkCompletedThisPeriod: 30_000m,
            StoredMaterials: 0m,
            InvoiceNumber: "INV-001",
            Notes: null);

        var resp1 = await client.PostAsJsonAsync("/api/paymentapplications", payApp1);
        resp1.EnsureSuccessStatusCode();
        var created1 = (await resp1.Content.ReadFromJsonAsync<PaymentApplicationDto>())!;
        Assert.Equal(1, created1.ApplicationNumber);

        // Second payment application
        var payApp2 = new CreatePaymentApplicationCommand(
            SubcontractId: subcontractId,
            PeriodStart: new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd: new DateTime(2026, 2, 28, 0, 0, 0, DateTimeKind.Utc),
            WorkCompletedThisPeriod: 25_000m,
            StoredMaterials: 2_000m,
            InvoiceNumber: "INV-002",
            Notes: null);

        var resp2 = await client.PostAsJsonAsync("/api/paymentapplications", payApp2);
        resp2.EnsureSuccessStatusCode();
        var created2 = (await resp2.Content.ReadFromJsonAsync<PaymentApplicationDto>())!;
        
        Assert.Equal(2, created2.ApplicationNumber);
        // Previous work should carry forward
        Assert.Equal(30_000m, created2.WorkCompletedPrevious);
        Assert.Equal(55_000m, created2.WorkCompletedToDate); // 30K + 25K
    }

    [Fact]
    public async Task Can_update_payment_application()
    {
        await db.ResetAsync();

        var (client, _, subcontractId) = await SetupProjectAndSubcontractAsync();

        // Create payment application
        var createCmd = new CreatePaymentApplicationCommand(
            SubcontractId: subcontractId,
            PeriodStart: new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd: new DateTime(2026, 1, 31, 0, 0, 0, DateTimeKind.Utc),
            WorkCompletedThisPeriod: 20_000m,
            StoredMaterials: 0m,
            InvoiceNumber: "INV-001",
            Notes: "Initial draft");

        var createResp = await client.PostAsJsonAsync("/api/paymentapplications", createCmd);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<PaymentApplicationDto>())!;

        // Update it
        var updateCmd = new UpdatePaymentApplicationCommand(
            Id: created.Id,
            WorkCompletedThisPeriod: 25_000m,
            StoredMaterials: 3_000m,
            Status: PaymentApplicationStatus.Submitted,
            ApprovedBy: null,
            ApprovedAmount: null,
            InvoiceNumber: "INV-001-REV",
            CheckNumber: null,
            Notes: "Revised and submitted");

        var updateResp = await client.PutAsJsonAsync($"/api/paymentapplications/{created.Id}", updateCmd);
        Assert.Equal(HttpStatusCode.OK, updateResp.StatusCode);

        var updated = (await updateResp.Content.ReadFromJsonAsync<PaymentApplicationDto>())!;
        Assert.Equal(25_000m, updated.WorkCompletedThisPeriod);
        Assert.Equal(3_000m, updated.StoredMaterials);
        Assert.Equal(PaymentApplicationStatus.Submitted, updated.Status);
        Assert.Equal("INV-001-REV", updated.InvoiceNumber);
    }

    [Fact]
    public async Task Update_nonexistent_payment_application_returns_404()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var updateCmd = new UpdatePaymentApplicationCommand(
            Id: Guid.NewGuid(),
            WorkCompletedThisPeriod: 10_000m,
            StoredMaterials: 0m,
            Status: PaymentApplicationStatus.Draft,
            ApprovedBy: null,
            ApprovedAmount: null,
            InvoiceNumber: null,
            CheckNumber: null,
            Notes: null);

        var resp = await client.PutAsJsonAsync($"/api/paymentapplications/{updateCmd.Id}", updateCmd);

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Update_with_mismatched_id_returns_400()
    {
        await db.ResetAsync();

        var (client, _, subcontractId) = await SetupProjectAndSubcontractAsync();

        // Create payment application
        var createCmd = new CreatePaymentApplicationCommand(
            SubcontractId: subcontractId,
            PeriodStart: new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd: new DateTime(2026, 1, 31, 0, 0, 0, DateTimeKind.Utc),
            WorkCompletedThisPeriod: 20_000m,
            StoredMaterials: 0m,
            InvoiceNumber: null,
            Notes: null);

        var createResp = await client.PostAsJsonAsync("/api/paymentapplications", createCmd);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<PaymentApplicationDto>())!;

        // Try to update with different ID in body
        var updateCmd = new UpdatePaymentApplicationCommand(
            Id: Guid.NewGuid(), // Different from route
            WorkCompletedThisPeriod: 25_000m,
            StoredMaterials: 0m,
            Status: PaymentApplicationStatus.Draft,
            ApprovedBy: null,
            ApprovedAmount: null,
            InvoiceNumber: null,
            CheckNumber: null,
            Notes: null);

        var resp = await client.PutAsJsonAsync($"/api/paymentapplications/{created.Id}", updateCmd);

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Can_delete_draft_payment_application()
    {
        await db.ResetAsync();

        var (client, _, subcontractId) = await SetupProjectAndSubcontractAsync();

        // Create payment application
        var createCmd = new CreatePaymentApplicationCommand(
            SubcontractId: subcontractId,
            PeriodStart: new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd: new DateTime(2026, 1, 31, 0, 0, 0, DateTimeKind.Utc),
            WorkCompletedThisPeriod: 20_000m,
            StoredMaterials: 0m,
            InvoiceNumber: null,
            Notes: null);

        var createResp = await client.PostAsJsonAsync("/api/paymentapplications", createCmd);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<PaymentApplicationDto>())!;

        // Delete it
        var deleteResp = await client.DeleteAsync($"/api/paymentapplications/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        // Verify it's gone
        var getResp = await client.GetAsync($"/api/paymentapplications/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Delete_nonexistent_payment_application_returns_404()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var resp = await client.DeleteAsync($"/api/paymentapplications/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Cannot_delete_submitted_payment_application()
    {
        await db.ResetAsync();

        var (client, _, subcontractId) = await SetupProjectAndSubcontractAsync();

        // Create payment application
        var createCmd = new CreatePaymentApplicationCommand(
            SubcontractId: subcontractId,
            PeriodStart: new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd: new DateTime(2026, 1, 31, 0, 0, 0, DateTimeKind.Utc),
            WorkCompletedThisPeriod: 20_000m,
            StoredMaterials: 0m,
            InvoiceNumber: "INV-001",
            Notes: null);

        var createResp = await client.PostAsJsonAsync("/api/paymentapplications", createCmd);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<PaymentApplicationDto>())!;

        // Submit it
        var updateCmd = new UpdatePaymentApplicationCommand(
            Id: created.Id,
            WorkCompletedThisPeriod: 20_000m,
            StoredMaterials: 0m,
            Status: PaymentApplicationStatus.Submitted,
            ApprovedBy: null,
            ApprovedAmount: null,
            InvoiceNumber: "INV-001",
            CheckNumber: null,
            Notes: null);

        var updateResp = await client.PutAsJsonAsync($"/api/paymentapplications/{created.Id}", updateCmd);
        updateResp.EnsureSuccessStatusCode();

        // Try to delete - should fail
        var deleteResp = await client.DeleteAsync($"/api/paymentapplications/{created.Id}");
        Assert.Equal(HttpStatusCode.BadRequest, deleteResp.StatusCode);
    }
}
