using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit.Abstractions;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateChangeOrder;
using Pitbull.Contracts.Features.CreateSubcontract;
using Pitbull.Contracts.Features.UpdateChangeOrder;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class WorkflowApprovalTests(PostgresFixture db, ITestOutputHelper output) : IAsyncLifetime
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
    public async Task ChangeOrderWorkflow_DefineApprove_CompletesWithApprovedStatus()
    {
        await db.ResetAsync();
        var (client, auth, _) = await _factory.CreateAuthenticatedClientAsync();
        var (_, _, subcontractId) = await SetupProjectAndSubcontractAsync(client);

        var definitionResp = await client.PostAsJsonAsync("/api/workflow-definitions", new
        {
            entityType = "ChangeOrder",
            triggerStatus = "UnderReview",
            approvedStatus = "Approved",
            rejectedStatus = "Rejected",
            name = "Integration CO Approval",
            description = "E2E workflow test",
            isActive = true,
            amountThreshold = (decimal?)null,
            mode = (int)ApprovalMode.Sequential,
            priority = 1,
            projectId = (Guid?)null,
            steps = new[]
            {
                new
                {
                    stepOrder = 1,
                    name = "PM Review",
                    approverType = (int)ApproverType.User,
                    approverRole = (string?)null,
                    approverUserId = auth.UserId,
                    approverRelationship = (string?)null,
                    isOptional = false
                }
            }
        });
        definitionResp.EnsureSuccessStatusCode();

        var coCmd = new CreateChangeOrderCommand(
            SubcontractId: subcontractId,
            ChangeOrderNumber: $"CO-WF-{Guid.NewGuid():N}"[..12],
            Title: "Workflow Test CO",
            Description: "Integration workflow",
            Reason: null,
            Amount: 12_500m,
            DaysExtension: null,
            ReferenceNumber: null);

        var createResp = await client.PostAsJsonAsync("/api/changeorders", coCmd);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<ChangeOrderDto>(TestJsonOptions.Default))!;

        var reviewCmd = new UpdateChangeOrderCommand(
            Id: created.Id,
            ChangeOrderNumber: created.ChangeOrderNumber,
            Title: created.Title,
            Description: created.Description,
            Reason: created.Reason,
            Amount: created.Amount,
            DaysExtension: created.DaysExtension,
            Status: ChangeOrderStatus.UnderReview,
            ReferenceNumber: created.ReferenceNumber);

        var reviewResp = await client.PutAsJsonAsync($"/api/changeorders/{created.Id}", reviewCmd);
        reviewResp.EnsureSuccessStatusCode();

        var pendingResp = await client.GetAsync("/api/workflow-approvals/pending");
        pendingResp.EnsureSuccessStatusCode();
        var pending = await pendingResp.Content.ReadFromJsonAsync<List<PendingApprovalResponse>>(TestJsonOptions.Default);
        Assert.NotNull(pending);
        Assert.Single(pending!);
        Assert.Equal("ChangeOrder", pending[0].EntityType);
        Assert.Equal(created.Id, pending[0].EntityId);

        var approveResp = await client.PostAsJsonAsync(
            $"/api/workflow-approvals/{pending[0].Id}/approve",
            new { comment = "Approved via My Approvals" });
        approveResp.EnsureSuccessStatusCode();

        var getResp = await client.GetAsync($"/api/changeorders/{created.Id}");
        getResp.EnsureSuccessStatusCode();
        var finalCo = await getResp.Content.ReadFromJsonAsync<ChangeOrderDto>(TestJsonOptions.Default);
        Assert.NotNull(finalCo);
        Assert.Equal(ChangeOrderStatus.Approved, finalCo!.Status);

        var transitionsResp = await client.GetAsync($"/api/workflow-transitions/ChangeOrder/{created.Id}");
        transitionsResp.EnsureSuccessStatusCode();
        var transitions = await transitionsResp.Content.ReadFromJsonAsync<List<WorkflowTransitionResponse>>(TestJsonOptions.Default);
        Assert.NotNull(transitions);
        Assert.Contains(transitions!, t =>
            t.FromStatus == "UnderReview" && t.ToStatus == "Approved");
    }

    [Fact]
    public async Task ChangeOrderWorkflow_BlocksDirectApproveWhilePending()
    {
        await db.ResetAsync();
        var (client, auth, _) = await _factory.CreateAuthenticatedClientAsync();
        var (_, _, subcontractId) = await SetupProjectAndSubcontractAsync(client);

        var defResp = await client.PostAsJsonAsync("/api/workflow-definitions", new
        {
            entityType = "ChangeOrder",
            triggerStatus = "UnderReview",
            approvedStatus = "Approved",
            rejectedStatus = "Rejected",
            name = "Block bypass test",
            isActive = true,
            mode = 0,
            priority = 0,
            steps = new[]
            {
                new
                {
                    stepOrder = 1,
                    name = "Review",
                    approverType = 1,
                    approverUserId = auth.UserId,
                    isOptional = false
                }
            }
        });
        defResp.EnsureSuccessStatusCode();

        var coCmd = new CreateChangeOrderCommand(
            SubcontractId: subcontractId,
            ChangeOrderNumber: $"CO-BP-{Guid.NewGuid():N}"[..12],
            Title: "Bypass Test",
            Description: "Should block",
            Reason: null,
            Amount: 1_000m,
            DaysExtension: null,
            ReferenceNumber: null);

        var createResp = await client.PostAsJsonAsync("/api/changeorders", coCmd);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<ChangeOrderDto>(TestJsonOptions.Default))!;

        var toReview = new UpdateChangeOrderCommand(
            created.Id, created.ChangeOrderNumber, created.Title, created.Description,
            created.Reason, created.Amount, created.DaysExtension,
            ChangeOrderStatus.UnderReview, created.ReferenceNumber);
        var reviewResp = await client.PutAsJsonAsync($"/api/changeorders/{created.Id}", toReview);
        reviewResp.EnsureSuccessStatusCode();

        var bypass = new UpdateChangeOrderCommand(
            created.Id, created.ChangeOrderNumber, created.Title, created.Description,
            created.Reason, created.Amount, created.DaysExtension,
            ChangeOrderStatus.Approved, created.ReferenceNumber);
        var bypassResp = await client.PutAsJsonAsync($"/api/changeorders/{created.Id}", bypass);

        Assert.Equal(HttpStatusCode.BadRequest, bypassResp.StatusCode);
        var body = await bypassResp.Content.ReadAsStringAsync();
        Assert.Contains("WORKFLOW_APPROVAL_REQUIRED", body);
    }

    [Fact]
    public async Task ChangeOrderWorkflow_BlocksWithdrawWhilePending()
    {
        await db.ResetAsync();
        var (client, auth, _) = await _factory.CreateAuthenticatedClientAsync();
        var (_, _, subcontractId) = await SetupProjectAndSubcontractAsync(client);

        var defResp = await client.PostAsJsonAsync("/api/workflow-definitions", new
        {
            entityType = "ChangeOrder",
            triggerStatus = "UnderReview",
            approvedStatus = "Approved",
            rejectedStatus = "Rejected",
            name = "Withdraw block test",
            isActive = true,
            mode = 0,
            priority = 0,
            steps = new[]
            {
                new
                {
                    stepOrder = 1,
                    name = "Review",
                    approverType = 1,
                    approverUserId = auth.UserId,
                    isOptional = false
                }
            }
        });
        defResp.EnsureSuccessStatusCode();

        var coCmd = new CreateChangeOrderCommand(
            SubcontractId: subcontractId,
            ChangeOrderNumber: $"CO-WD-{Guid.NewGuid():N}"[..12],
            Title: "Withdraw Block",
            Description: "Should block withdraw",
            Reason: null,
            Amount: 2_000m,
            DaysExtension: null,
            ReferenceNumber: null);

        var createResp = await client.PostAsJsonAsync("/api/changeorders", coCmd);
        createResp.EnsureSuccessStatusCode();
        var created = (await createResp.Content.ReadFromJsonAsync<ChangeOrderDto>(TestJsonOptions.Default))!;

        var toReview = new UpdateChangeOrderCommand(
            created.Id, created.ChangeOrderNumber, created.Title, created.Description,
            created.Reason, created.Amount, created.DaysExtension,
            ChangeOrderStatus.UnderReview, created.ReferenceNumber);
        (await client.PutAsJsonAsync($"/api/changeorders/{created.Id}", toReview)).EnsureSuccessStatusCode();

        var withdraw = new UpdateChangeOrderCommand(
            created.Id, created.ChangeOrderNumber, created.Title, created.Description,
            created.Reason, created.Amount, created.DaysExtension,
            ChangeOrderStatus.Withdrawn, created.ReferenceNumber);
        var withdrawResp = await client.PutAsJsonAsync($"/api/changeorders/{created.Id}", withdraw);

        Assert.Equal(HttpStatusCode.BadRequest, withdrawResp.StatusCode);
        var body = await withdrawResp.Content.ReadAsStringAsync();
        Assert.Contains("WORKFLOW_APPROVAL_REQUIRED", body);
    }

    [Fact]
    public async Task BillingApplicationWorkflow_DefineApprove_CompletesWithReadyToSubmit()
    {
        await db.ResetAsync();
        var (client, auth, _) = await _factory.CreateAuthenticatedClientAsync();
        var projectId = await SetupBillingProjectAsync(client);

        var definitionBody = JsonSerializer.Serialize(new
        {
            entityType = "BillingApplication",
            triggerStatus = "PmReview",
            approvedStatus = "ReadyToSubmit",
            rejectedStatus = "PmRejected",
            name = "Integration Billing Approval",
            description = "E2E billing workflow test",
            isActive = true,
            amountThreshold = (decimal?)null,
            mode = (int)ApprovalMode.Sequential,
            priority = 1,
            projectId = (Guid?)null,
            steps = new[]
            {
                new
                {
                    stepOrder = 1,
                    name = "PM Review",
                    approverType = (int)ApproverType.User,
                    approverRole = (string?)null,
                    approverUserId = auth.UserId,
                    approverRelationship = (string?)null,
                    isOptional = false
                }
            }
        });
        output.WriteLine($"WF_E2E definitionRequest={definitionBody}");

        var definitionResp = await client.PostAsJsonAsync("/api/workflow-definitions", new
        {
            entityType = "BillingApplication",
            triggerStatus = "PmReview",
            approvedStatus = "ReadyToSubmit",
            rejectedStatus = "PmRejected",
            name = "Integration Billing Approval",
            description = "E2E billing workflow test",
            isActive = true,
            amountThreshold = (decimal?)null,
            mode = (int)ApprovalMode.Sequential,
            priority = 1,
            projectId = (Guid?)null,
            steps = new[]
            {
                new
                {
                    stepOrder = 1,
                    name = "PM Review",
                    approverType = (int)ApproverType.User,
                    approverRole = (string?)null,
                    approverUserId = auth.UserId,
                    approverRelationship = (string?)null,
                    isOptional = false
                }
            }
        });
        var definitionJson = await definitionResp.Content.ReadAsStringAsync();
        output.WriteLine($"WF_E2E definitionResponse status={(int)definitionResp.StatusCode} body={definitionJson}");
        definitionResp.EnsureSuccessStatusCode();

        var (contractId, sovId, appId) = await CreateBillingApplicationAsync(client, projectId);

        var submitResp = await client.PostAsync($"/api/billing-applications/{appId}/submit-for-review", content: null);
        var submitJson = await submitResp.Content.ReadAsStringAsync();
        output.WriteLine($"WF_E2E submitForReview status={(int)submitResp.StatusCode} body={submitJson}");
        submitResp.EnsureSuccessStatusCode();

        var pendingResp = await client.GetAsync("/api/workflow-approvals/pending");
        var pendingJson = await pendingResp.Content.ReadAsStringAsync();
        output.WriteLine($"WF_E2E pending status={(int)pendingResp.StatusCode} body={pendingJson}");
        pendingResp.EnsureSuccessStatusCode();
        var pending = await pendingResp.Content.ReadFromJsonAsync<List<PendingApprovalResponse>>(TestJsonOptions.Default);
        Assert.NotNull(pending);
        Assert.Single(pending!);
        Assert.Equal("BillingApplication", pending[0].EntityType);
        Assert.Equal(appId, pending[0].EntityId);

        var approveResp = await client.PostAsJsonAsync(
            $"/api/workflow-approvals/{pending[0].Id}/approve",
            new { comment = "Approved billing app" });
        var approveJson = await approveResp.Content.ReadAsStringAsync();
        output.WriteLine($"WF_E2E approve status={(int)approveResp.StatusCode} body={approveJson}");
        approveResp.EnsureSuccessStatusCode();

        var finalResp = await client.GetAsync($"/api/billing-applications/{appId}");
        var finalJson = await finalResp.Content.ReadAsStringAsync();
        output.WriteLine($"WF_E2E finalBillingApp status={(int)finalResp.StatusCode} body={finalJson}");
        finalResp.EnsureSuccessStatusCode();
        Assert.Contains("ReadyToSubmit", finalJson, StringComparison.OrdinalIgnoreCase);

        var transitionsResp = await client.GetAsync($"/api/workflow-transitions/BillingApplication/{appId}");
        var transitionsJson = await transitionsResp.Content.ReadAsStringAsync();
        output.WriteLine($"WF_E2E transitions status={(int)transitionsResp.StatusCode} body={transitionsJson}");
        transitionsResp.EnsureSuccessStatusCode();
        var transitions = await transitionsResp.Content.ReadFromJsonAsync<List<WorkflowTransitionResponse>>(TestJsonOptions.Default);
        Assert.NotNull(transitions);
        Assert.Contains(transitions!, t =>
            t.FromStatus == "PmReview" && t.ToStatus == "ReadyToSubmit");
    }

    private static async Task<Guid> SetupBillingProjectAsync(HttpClient client)
    {
        var projectCmd = new CreateProjectCommand(
            Name: "Billing Workflow Project",
            Number: $"PRJ-BA-{Guid.NewGuid():N}"[..14],
            Description: null,
            Type: ProjectType.Commercial,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null,
            ContractAmount: 500_000m,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null);

        var projectResp = await client.PostAsJsonAsync("/api/projects", projectCmd);
        projectResp.EnsureSuccessStatusCode();
        var project = (await projectResp.Content.ReadFromJsonAsync<ProjectDto>(TestJsonOptions.Default))!;
        return project.Id;
    }

    private static async Task<(Guid contractId, Guid sovId, Guid appId)> CreateBillingApplicationAsync(
        HttpClient client, Guid projectId)
    {
        var contractResp = await client.PostAsJsonAsync("/api/owner-contracts", new
        {
            projectId,
            contractNumber = $"WF-OC-{Guid.NewGuid():N}"[..14],
            projectName = "WF Billing Project",
            originalContractSum = 500_000m
        });
        contractResp.EnsureSuccessStatusCode();
        using var contractDoc = JsonDocument.Parse(await contractResp.Content.ReadAsStringAsync());
        var contractId = contractDoc.RootElement.GetProperty("id").GetGuid();

        var sovResp = await client.PostAsJsonAsync($"/api/owner-contracts/{contractId}/sov", new
        {
            projectId,
            name = "WF Billing SOV"
        });
        sovResp.EnsureSuccessStatusCode();
        using var sovDoc = JsonDocument.Parse(await sovResp.Content.ReadAsStringAsync());
        var sovId = sovDoc.RootElement.GetProperty("id").GetGuid();

        (await client.PostAsJsonAsync($"/api/owner-contracts/sov/{sovId}/lines", new
        {
            itemNumber = "1",
            description = "General",
            scheduledValue = 500_000m,
            sortOrder = 1
        })).EnsureSuccessStatusCode();

        (await client.PostAsync($"/api/owner-contracts/sov/{sovId}/activate", content: null))
            .EnsureSuccessStatusCode();

        var appResp = await client.PostAsJsonAsync("/api/billing-applications", new
        {
            ownerContractId = contractId,
            ownerScheduleOfValuesId = sovId,
            periodFrom = "2026-03-01",
            periodThrough = "2026-03-31",
            applicationDate = "2026-03-31"
        });
        appResp.EnsureSuccessStatusCode();
        using var appDoc = JsonDocument.Parse(await appResp.Content.ReadAsStringAsync());
        var appId = appDoc.RootElement.GetProperty("id").GetGuid();

        return (contractId, sovId, appId);
    }

    private static async Task<(HttpClient client, Guid projectId, Guid subcontractId)> SetupProjectAndSubcontractAsync(HttpClient client)
    {
        var projectCmd = new CreateProjectCommand(
            Name: "Workflow Project",
            Number: $"PRJ-WF-{Guid.NewGuid():N}"[..14],
            Description: null,
            Type: ProjectType.Commercial,
            Address: null, City: null, State: null, ZipCode: null,
            ClientName: null, ClientContact: null, ClientEmail: null, ClientPhone: null,
            StartDate: null, EstimatedCompletionDate: null,
            ContractAmount: 500_000m,
            ProjectManagerId: null, SuperintendentId: null, SourceBidId: null);

        var projectResp = await client.PostAsJsonAsync("/api/projects", projectCmd);
        projectResp.EnsureSuccessStatusCode();
        var project = (await projectResp.Content.ReadFromJsonAsync<ProjectDto>(TestJsonOptions.Default))!;

        var subcontractCmd = new CreateSubcontractCommand(
            ProjectId: project.Id,
            SubcontractNumber: $"SC-WF-{Guid.NewGuid():N}"[..12],
            SubcontractorName: "WF Sub",
            SubcontractorContact: null,
            SubcontractorEmail: null,
            SubcontractorPhone: null,
            SubcontractorAddress: null,
            ScopeOfWork: "Scope",
            TradeCode: null,
            OriginalValue: 100_000m,
            RetainagePercent: 10m,
            StartDate: null,
            CompletionDate: null,
            LicenseNumber: null,
            Notes: null);

        var scResp = await client.PostAsJsonAsync("/api/subcontracts", subcontractCmd);
        scResp.EnsureSuccessStatusCode();
        var subcontract = (await scResp.Content.ReadFromJsonAsync<SubcontractDto>(TestJsonOptions.Default))!;

        return (client, project.Id, subcontract.Id);
    }

    private sealed record PendingApprovalResponse(
        Guid Id,
        string EntityType,
        Guid EntityId,
        string WorkflowName,
        string StepName,
        int StepOrder,
        string TriggerStatus,
        string ApprovedStatus,
        string RejectedStatus,
        string Status,
        DateTime CreatedAtUtc,
        string? EntityTitle);

    private sealed record WorkflowTransitionResponse(
        Guid Id,
        string EntityType,
        Guid EntityId,
        string? FromStatus,
        string ToStatus,
        Guid ChangedByUserId,
        string? ChangedByName,
        DateTime ChangedAt,
        string? Comment);

    private sealed record ProjectDto(Guid Id);
    private sealed record SubcontractDto(Guid Id);
}