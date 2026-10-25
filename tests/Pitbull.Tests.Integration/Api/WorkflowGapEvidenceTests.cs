using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit.Abstractions;
using Pitbull.Api.Controllers;
using Pitbull.Billing.Services;
using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.Tests.Integration.Infrastructure;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;
using Pitbull.TimeTracking.Features.CreateEmployee;

namespace Pitbull.Tests.Integration.Api;

/// <summary>
/// Captures workflow-gap evidence (L2 phases/team/activate, L3 report OT settings) with
/// structured assertion output for scripts/capture-workflow-evidence.ps1.
/// Payroll line OT derivation is additionally covered by PayrollRunServiceTests and role E2E L3b.
/// </summary>
[Collection(DatabaseCollection.Name)]
public sealed class WorkflowGapEvidenceTests(PostgresFixture db, ITestOutputHelper output) : IAsyncLifetime
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

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
    public async Task L2_CreateWithPhasesAndTeam_Activate_PersistsEvidence()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var employeeResp = await client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber = $"EV-{Guid.NewGuid():N}"[..15],
            firstName = "Phase",
            LastName = "Manager",
            classification = (int)EmployeeClassification.Hourly,
            baseHourlyRate = 45m
        });
        employeeResp.EnsureSuccessStatusCode();
        var employee = await employeeResp.Content.ReadFromJsonAsync<EmployeeDto>(TestJsonOptions.Default);

        var createCommand = new CreateProjectCommand(
            Name: "Evidence L2 Project",
            Number: $"EV-L2-{Guid.NewGuid():N}"[..16],
            Description: "Workflow gap evidence",
            Type: ProjectType.Commercial,
            Address: null,
            City: null,
            State: null,
            ZipCode: null,
            ClientName: null,
            ClientContact: null,
            ClientEmail: null,
            ClientPhone: null,
            StartDate: DateTime.UtcNow,
            EstimatedCompletionDate: null,
            ContractAmount: 500_000m,
            ProjectManagerId: null,
            SuperintendentId: null,
            SourceBidId: null,
            Phases:
            [
                new CreateProjectPhaseInput("Foundation", "03000", 100_000m),
                new CreateProjectPhaseInput("Framing", "06000", 150_000m)
            ],
            TeamMembers:
            [
                new CreateProjectTeamMemberInput(employee!.Id, "Project Manager", AssignmentRole.Manager)
            ]);

        var createResp = await client.PostAsJsonAsync("/api/projects", createCommand);
        createResp.EnsureSuccessStatusCode();
        var project = await createResp.Content.ReadFromJsonAsync<ProjectDto>(TestJsonOptions.Default);

        var activateResp = await client.PostAsync($"/api/projects/{project!.Id}/activate", content: null);
        activateResp.EnsureSuccessStatusCode();
        var activated = await activateResp.Content.ReadFromJsonAsync<ProjectDto>(TestJsonOptions.Default);

        var phasesResp = await client.GetAsync($"/api/projects/{project.Id}/phases");
        phasesResp.EnsureSuccessStatusCode();
        var phasesJson = await phasesResp.Content.ReadAsStringAsync();

        var assignResp = await client.GetAsync($"/api/project-assignments/by-project/{project.Id}?activeOnly=true");
        assignResp.EnsureSuccessStatusCode();
        var assignJson = await assignResp.Content.ReadAsStringAsync();

        var evidence = new
        {
            projectId = project.Id,
            status = activated!.Status.ToString(),
            projectManagerId = activated.ProjectManagerId,
            phases = phasesJson,
            assignments = assignJson
        };

        Assert.Equal(ProjectStatus.Active, activated.Status);
        Assert.Equal(employee.Id, activated.ProjectManagerId);
        Assert.Contains("Foundation", phasesJson);
        Assert.Contains("Framing", phasesJson);
        Assert.Contains(employee.Id.ToString(), assignJson);

        output.WriteLine($"L2_EVIDENCE {JsonSerializer.Serialize(evidence, JsonOptions)}");
    }

    [Fact]
    public async Task L3_ReportSettings_CaliforniaThreshold_PersistedForPayrollPolicy()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var reportPut = await client.PutAsJsonAsync("/api/companies/settings/reports", new
        {
            overtimeRules = "California",
            overtimeEnabled = true,
            dailyOvertimeThreshold = 6m,
            dailyDoubletimeThreshold = 10m,
            weeklyOvertimeThreshold = 40m,
            saturdayRule = "overtime",
            sundayRule = "doubletime",
            holidayRule = "overtime",
            holidaysJson = "[]",
            reportBrandingName = "",
            reportLogoUrl = "",
            fiscalYearStartMonth = 1
        });
        reportPut.EnsureSuccessStatusCode();
        var putJson = await reportPut.Content.ReadAsStringAsync();

        var getResp = await client.GetAsync("/api/companies/settings/reports");
        getResp.EnsureSuccessStatusCode();
        var getJson = await getResp.Content.ReadAsStringAsync();

        Assert.Contains("California", getJson, StringComparison.OrdinalIgnoreCase);

        OvertimeSettings policy = CompanyOvertimePolicy.Resolve(new Company
        {
            ReportSettings = new ReportSettings
            {
                OvertimeRules = "California",
                OvertimeEnabled = true,
                DailyOvertimeThreshold = 6m,
                DailyDoubletimeThreshold = 10m,
                WeeklyOvertimeThreshold = 40m
            }
        });
        Assert.Equal(6m, policy.DailyOtThreshold);
        Assert.True(policy.CaliforniaOtRules);

        output.WriteLine(
            $"L3_EVIDENCE reportSettingsPut={putJson} reportSettingsGet={getJson} policyDailyOt={policy.DailyOtThreshold}");
    }

    [Fact]
    public async Task L3_PayrollRun_Generate_LinesReflectOvertime()
    {
        await db.ResetAsync();
        var approverEmail = $"payroll-{Guid.NewGuid():N}@example.com";
        var (client, auth, _) = await _factory.CreateAuthenticatedClientAsync(email: approverEmail);

        await client.PutAsJsonAsync("/api/companies/settings/reports", new
        {
            overtimeRules = "California",
            overtimeEnabled = true,
            dailyOvertimeThreshold = 6m,
            dailyDoubletimeThreshold = 10m,
            weeklyOvertimeThreshold = 40m,
            saturdayRule = "overtime",
            sundayRule = "doubletime",
            holidayRule = "overtime",
            holidaysJson = "[]",
            reportBrandingName = "",
            reportLogoUrl = "",
            fiscalYearStartMonth = 1
        }).ContinueWith(t => t.Result.EnsureSuccessStatusCode());

        await SetupWeeklyPayPeriodsAsync(client);
        var currentResp = await client.GetAsync("/api/pay-periods/current");
        currentResp.EnsureSuccessStatusCode();
        var period = await currentResp.Content.ReadFromJsonAsync<PayPeriodDto>(TestJsonOptions.Default);
        var projectStart = period!.StartDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var workerResp = await client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber = $"OT-{Guid.NewGuid():N}"[..15],
            firstName = "Overtime",
            lastName = "Worker",
            classification = (int)EmployeeClassification.Hourly,
            baseHourlyRate = 40m
        });
        workerResp.EnsureSuccessStatusCode();
        var worker = await workerResp.Content.ReadFromJsonAsync<EmployeeDto>(TestJsonOptions.Default);

        var approverResp = await client.PostAsJsonAsync("/api/employees", new
        {
            employeeNumber = $"PM-{Guid.NewGuid():N}"[..15],
            firstName = "Payroll",
            LastName = "Manager",
            email = auth.Email,
            classification = (int)EmployeeClassification.Salaried,
            baseHourlyRate = 55m
        });
        approverResp.EnsureSuccessStatusCode();
        var approver = await approverResp.Content.ReadFromJsonAsync<EmployeeDto>(TestJsonOptions.Default);

        var projectCommand = new CreateProjectCommand(
            Name: "Payroll OT Evidence",
            Number: $"EV-L3-{Guid.NewGuid():N}"[..16],
            Description: null,
            Type: ProjectType.Commercial,
            Address: null,
            City: null,
            State: null,
            ZipCode: null,
            ClientName: null,
            ClientContact: null,
            ClientEmail: null,
            ClientPhone: null,
            StartDate: projectStart,
            EstimatedCompletionDate: null,
            ContractAmount: 100_000m,
            ProjectManagerId: null,
            SuperintendentId: null,
            SourceBidId: null,
            TeamMembers:
            [
                new CreateProjectTeamMemberInput(approver!.Id, "Project Manager", AssignmentRole.Manager),
                new CreateProjectTeamMemberInput(worker!.Id, "Worker", AssignmentRole.Worker)
            ],
            ActivateOnCreate: true);
        var projectResp = await client.PostAsJsonAsync("/api/projects", projectCommand);
        projectResp.EnsureSuccessStatusCode();
        var project = await projectResp.Content.ReadFromJsonAsync<ProjectDto>(TestJsonOptions.Default);

        var assignCheck = await client.GetAsync($"/api/project-assignments/by-project/{project!.Id}?activeOnly=true");
        assignCheck.EnsureSuccessStatusCode();
        var assignJson = await assignCheck.Content.ReadAsStringAsync();
        Assert.Contains(worker.Id.ToString(), assignJson);

        Guid costCodeId = await EnsureCostCodeAsync(client);
        var entryDate = period.EndDate >= DateOnly.FromDateTime(DateTime.UtcNow)
            ? DateTime.UtcNow.ToString("yyyy-MM-dd")
            : period.StartDate.ToString("yyyy-MM-dd");

        var batchResp = await client.PostAsJsonAsync("/api/time-entries/batch", new
        {
            entries = new[]
            {
                new
                {
                    date = entryDate,
                    employeeId = worker.Id,
                    projectId = project!.Id,
                    costCodeId,
                    regularHours = 10m,
                    overtimeHours = 0m,
                    doubletimeHours = 0m,
                    description = "L3 payroll OT evidence"
                }
            },
            isDraft = false,
            allowPartialSuccess = false
        });
        if (batchResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await batchResp.Content.ReadAsStringAsync();
            Assert.Fail($"Batch time entry failed: {(int)batchResp.StatusCode}. Body: {body}");
        }
        var batchBody = await batchResp.Content.ReadAsStringAsync();
        using var batchDoc = JsonDocument.Parse(batchBody);
        var entryId = batchDoc.RootElement.GetProperty("results")[0].GetProperty("timeEntryId").GetGuid();

        var reviewResp = await client.PostAsJsonAsync("/api/time-entries/review", new
        {
            decisions = new[] { new { timeEntryId = entryId, decision = "Approve", comment = "L3 evidence" } }
        });
        reviewResp.EnsureSuccessStatusCode();
        var reviewBody = await reviewResp.Content.ReadAsStringAsync();
        using (var reviewDoc = JsonDocument.Parse(reviewBody))
        {
            int approved = reviewDoc.RootElement.GetProperty("approved").GetInt32();
            Assert.True(approved > 0, $"Review approved 0 entries. Body: {reviewBody}");
        }

        var lockResp = await client.PostAsync($"/api/pay-periods/{period.Id}/lock", content: null);
        lockResp.EnsureSuccessStatusCode();

        var generateResp = await client.PostAsJsonAsync("/api/payroll/runs/generate", new
        {
            runDate = DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyy-MM-dd"),
            payPeriodId = period.Id
        });
        if (!generateResp.IsSuccessStatusCode)
        {
            var body = await generateResp.Content.ReadAsStringAsync();
            Assert.Fail($"Payroll generate failed: {(int)generateResp.StatusCode}. Body: {body}");
        }
        var runJson = await generateResp.Content.ReadAsStringAsync();

        using var runDoc = JsonDocument.Parse(runJson);
        decimal totalOt = 0m;
        foreach (var line in runDoc.RootElement.GetProperty("lines").EnumerateArray())
        {
            if (line.TryGetProperty("overtimeHours", out var otProp))
                totalOt += otProp.GetDecimal();
        }

        Assert.True(totalOt > 0, $"Expected overtimeHours > 0. Body: {runJson}");
        output.WriteLine($"L3_PAYROLL_EVIDENCE payPeriodId={period.Id} totalOvertimeHours={totalOt} run={runJson}");
    }

    [Fact]
    public async Task L2_CreateWithAutoCreatePhases_CreatesDefaultPhases()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var createCommand = new CreateProjectCommand(
            Name: "Evidence L2 Auto Phases",
            Number: $"EV-L2A-{Guid.NewGuid():N}"[..16],
            Description: "AutoCreatePhases evidence",
            Type: ProjectType.Commercial,
            Address: null,
            City: null,
            State: null,
            ZipCode: null,
            ClientName: null,
            ClientContact: null,
            ClientEmail: null,
            ClientPhone: null,
            StartDate: DateTime.UtcNow,
            EstimatedCompletionDate: null,
            ContractAmount: 250_000m,
            ProjectManagerId: null,
            SuperintendentId: null,
            SourceBidId: null,
            Phases: null);

        var createResp = await client.PostAsJsonAsync("/api/projects", createCommand);
        createResp.EnsureSuccessStatusCode();
        var project = await createResp.Content.ReadFromJsonAsync<ProjectDto>(TestJsonOptions.Default);

        var phasesResp = await client.GetAsync($"/api/projects/{project!.Id}/phases");
        phasesResp.EnsureSuccessStatusCode();
        var phasesJson = await phasesResp.Content.ReadAsStringAsync();

        Assert.Contains("Preconstruction", phasesJson, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Construction", phasesJson, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Closeout", phasesJson, StringComparison.OrdinalIgnoreCase);

        output.WriteLine($"L2_EVIDENCE autoCreatePhases projectId={project.Id} phases={phasesJson}");
    }

    [Fact]
    public async Task L4_BillingApplication_Workflow_ReachesPaid()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();
        var projectId = await CreateEvidenceProjectAsync(client);

        var contractResp = await client.PostAsJsonAsync("/api/owner-contracts", new
        {
            projectId,
            contractNumber = $"EV-OC-{Guid.NewGuid():N}"[..14],
            projectName = "L4 Evidence Project",
            originalContractSum = 500_000m
        });
        contractResp.EnsureSuccessStatusCode();
        using var contractDoc = JsonDocument.Parse(await contractResp.Content.ReadAsStringAsync());
        var contractId = contractDoc.RootElement.GetProperty("id").GetGuid();

        var sovResp = await client.PostAsJsonAsync($"/api/owner-contracts/{contractId}/sov", new
        {
            projectId,
            name = "L4 Evidence SOV"
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

        foreach (var path in new[]
                 {
                     $"submit-for-review", "approve", "submit-to-owner",
                     "architect-certified", "payment-due", "paid"
                 })
        {
            var stepResp = await client.PostAsync($"/api/billing-applications/{appId}/{path}", content: null);
            if (!stepResp.IsSuccessStatusCode)
            {
                var body = await stepResp.Content.ReadAsStringAsync();
                Assert.Fail($"Billing workflow step '{path}' failed: {(int)stepResp.StatusCode}. Body: {body}");
            }
        }

        var finalResp = await client.GetAsync($"/api/billing-applications/{appId}");
        finalResp.EnsureSuccessStatusCode();
        var finalJson = await finalResp.Content.ReadAsStringAsync();
        Assert.Contains("Paid", finalJson, StringComparison.OrdinalIgnoreCase);

        output.WriteLine($"L4_EVIDENCE billingApplicationId={appId} status=Paid final={finalJson}");
    }

    [Fact]
    public async Task L6_OwnerChangeOrder_Create_Succeeds()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();
        var projectId = await CreateEvidenceProjectAsync(client);
        var suffix = Guid.NewGuid().ToString("N")[..10];

        var createResp = await client.PostAsJsonAsync("/api/owner-change-orders", new
        {
            projectId,
            number = $"OCO-EV-{suffix}",
            title = $"Owner CO evidence {suffix}",
            description = "Owner-directed scope",
            amount = 12_500m
        });
        createResp.EnsureSuccessStatusCode();
        var body = await createResp.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        var coId = doc.RootElement.GetProperty("id").GetGuid();

        output.WriteLine($"L6_EVIDENCE ownerChangeOrderId={coId} projectId={projectId} body={body}");
    }

    [Fact]
    public async Task L9_VendorInvoice_Approve_PostsAccrualJournalEntry()
    {
        await db.ResetAsync();
        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        await EnsureGlAccounts5200And2000Async(client);

        var vendorResp = await client.PostAsJsonAsync("/api/vendors", new
        {
            name = $"L9 Vendor {Guid.NewGuid():N}"[..20],
            code = $"V9-{Guid.NewGuid():N}"[..12],
            isActive = true
        });
        vendorResp.EnsureSuccessStatusCode();
        using var vendorDoc = JsonDocument.Parse(await vendorResp.Content.ReadAsStringAsync());
        var vendorId = vendorDoc.RootElement.GetProperty("id").GetGuid();

        var invNum = $"VI-EV-{Guid.NewGuid():N}"[..16];
        var createResp = await client.PostAsJsonAsync("/api/vendor-invoices", new
        {
            vendorId,
            invoiceNumber = invNum,
            invoiceDate = "2026-03-01",
            dueDate = "2026-04-01",
            totalAmount = 2750m
        });
        createResp.EnsureSuccessStatusCode();
        using var invDoc = JsonDocument.Parse(await createResp.Content.ReadAsStringAsync());
        var invoiceId = invDoc.RootElement.GetProperty("id").GetGuid();

        var approveResp = await client.PutAsJsonAsync($"/api/vendor-invoices/{invoiceId}", new
        {
            status = (int)VendorInvoiceStatus.Approved
        });
        if (!approveResp.IsSuccessStatusCode)
        {
            var body = await approveResp.Content.ReadAsStringAsync();
            Assert.Fail($"Approve vendor invoice failed: {(int)approveResp.StatusCode}. Body: {body}");
        }
        var approvedJson = await approveResp.Content.ReadAsStringAsync();

        using var approvedDoc = JsonDocument.Parse(approvedJson);
        Guid jeId = Guid.Empty;
        var hasAccrual = approvedDoc.RootElement.TryGetProperty("accrualJournalEntryId", out var jeProp)
                         && jeProp.ValueKind != JsonValueKind.Null
                         && jeProp.TryGetGuid(out jeId)
                         && jeId != Guid.Empty;
        Assert.True(hasAccrual, $"Expected accrualJournalEntryId on approve. Body: {approvedJson}");

        output.WriteLine($"L9_EVIDENCE vendorInvoiceId={invoiceId} accrualJournalEntryId={jeId} approved={approvedJson}");
    }

    private static async Task<Guid> CreateEvidenceProjectAsync(HttpClient client)
    {
        var createResp = await client.PostAsJsonAsync("/api/projects", new
        {
            name = "Workflow Evidence Project",
            number = $"EV-{Guid.NewGuid():N}"[..14],
            type = 0,
            contractAmount = 100_000m,
            activateOnCreate = true
        });
        createResp.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await createResp.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task EnsureGlAccounts5200And2000Async(HttpClient client)
    {
        async Task EnsureAccount(string number, string name, int accountType, int normalBalance)
        {
            var listResp = await client.GetAsync($"/api/chart-of-accounts?search={number}&pageSize=5");
            listResp.EnsureSuccessStatusCode();
            var listJson = await listResp.Content.ReadAsStringAsync();
            if (listJson.Contains(number, StringComparison.Ordinal))
                return;

            var createResp = await client.PostAsJsonAsync("/api/chart-of-accounts", new
            {
                accountNumber = number,
                accountName = name,
                accountType,
                normalBalance,
                isActive = true
            });
            createResp.EnsureSuccessStatusCode();
        }

        await EnsureAccount("5200", "Materials", 5, 1);
        await EnsureAccount("2000", "Accounts Payable", 2, 2);
    }

    private static async Task SetupWeeklyPayPeriodsAsync(HttpClient client)
    {
        var configReq = new UpdatePayPeriodConfigurationRequest(
            Type: PayPeriodType.Weekly,
            WeekStartDay: DayOfWeek.Monday,
            SemiMonthlyFirstDay: 1,
            SemiMonthlySecondDay: 16,
            AutoLockEnabled: false,
            AutoLockDaysAfterEnd: 3,
            PeriodsToGenerateAhead: 8,
            BiWeeklyReferenceDate: null,
            EnforcementEnabled: true);
        (await client.PutAsJsonAsync("/api/pay-periods/configuration", configReq)).EnsureSuccessStatusCode();

        var generateReq = new GeneratePayPeriodsRequest(
            FromDate: DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-1)),
            PeriodsToGenerate: 8);
        (await client.PostAsJsonAsync("/api/pay-periods/generate", generateReq)).EnsureSuccessStatusCode();
    }

    private static async Task<Guid> EnsureCostCodeAsync(HttpClient client)
    {
        var costCodesResp = await client.GetAsync("/api/cost-codes?page=1&pageSize=5");
        costCodesResp.EnsureSuccessStatusCode();
        var costCodesPage = await costCodesResp.Content.ReadFromJsonAsync<PagedCostCodes>(TestJsonOptions.Default);
        if (costCodesPage?.Items is { Count: > 0 })
            return costCodesPage.Items[0].Id;

        var createResp = await client.PostAsJsonAsync("/api/cost-codes", new
        {
            code = $"EV{Guid.NewGuid():N}"[..8],
            description = "L3 evidence labor",
            costType = (int)CostType.Labor
        });
        createResp.EnsureSuccessStatusCode();
        var created = await createResp.Content.ReadFromJsonAsync<CostCodeItem>(TestJsonOptions.Default);
        return created!.Id;
    }

    private sealed record PagedCostCodes(List<CostCodeItem> Items, int TotalCount);
    private sealed record CostCodeItem(Guid Id, string Code);
}