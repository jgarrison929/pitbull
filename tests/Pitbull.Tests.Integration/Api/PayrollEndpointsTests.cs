using System.Net;
using System.Net.Http.Json;
using Pitbull.Payroll.Domain;
using Pitbull.Payroll.Features;
using Pitbull.Payroll.Features.CreatePayPeriod;
using Pitbull.Payroll.Features.CreatePayrollBatch;
using Pitbull.Tests.Integration.Infrastructure;

namespace Pitbull.Tests.Integration.Api;

[Collection(DatabaseCollection.Name)]
public sealed class PayrollEndpointsTests(PostgresFixture db) : IAsyncLifetime
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

    #region Pay Periods

    // Each test uses unique date ranges far in the future/past to avoid overlap conflicts
    // Base is year 3000 to ensure no overlap with any real or seeded data

    private static DateOnly UniqueStartDate(int testId) => new DateOnly(3000 + testId, 1, 1);
    private static DateOnly UniqueEndDate(int testId) => new DateOnly(3000 + testId, 1, 7);
    private static DateOnly UniquePayDate(int testId) => new DateOnly(3000 + testId, 1, 14);

    [Fact]
    public async Task Get_pay_periods_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/payroll/periods");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Can_create_get_and_list_pay_periods()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var startDate = UniqueStartDate(1);
        var endDate = UniqueEndDate(1);
        var payDate = UniquePayDate(1);

        var create = new CreatePayPeriodCommand(
            StartDate: startDate,
            EndDate: endDate,
            PayDate: payDate,
            Frequency: PayFrequency.Weekly,
            Notes: "Integration test pay period");

        var createResp = await client.PostAsJsonAsync("/api/payroll/periods", create);
        if (createResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 201 Created but got {(int)createResp.StatusCode}. Body: {body}");
        }

        var created = (await createResp.Content.ReadFromJsonAsync<PayPeriodDto>())!;
        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal("Open", created.Status);
        Assert.Equal("Weekly", created.Frequency);

        // Get by ID
        var getResp = await client.GetAsync($"/api/payroll/periods/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var fetched = (await getResp.Content.ReadFromJsonAsync<PayPeriodDto>())!;
        Assert.Equal(created.Id, fetched.Id);

        // List
        var listResp = await client.GetAsync("/api/payroll/periods");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains(created.Id.ToString(), listJson);
    }

    [Fact]
    public async Task Pay_period_from_other_tenant_returns_404()
    {
        await db.ResetAsync();

        var (clientA, _, _) = await _factory.CreateAuthenticatedClientAsync();
        var (clientB, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var startDate = UniqueStartDate(2);
        var endDate = UniqueEndDate(2);
        var payDate = UniquePayDate(2);

        var create = new CreatePayPeriodCommand(startDate, endDate, payDate, PayFrequency.BiWeekly, null);

        var createResp = await clientA.PostAsJsonAsync("/api/payroll/periods", create);
        createResp.EnsureSuccessStatusCode();

        var created = (await createResp.Content.ReadFromJsonAsync<PayPeriodDto>())!;

        // Other tenant can't access
        var getResp = await clientB.GetAsync($"/api/payroll/periods/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Overlapping_pay_periods_are_rejected()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var startDate = UniqueStartDate(3);
        var endDate = UniqueEndDate(3);
        var payDate = UniquePayDate(3);

        // Create first period
        var create1 = new CreatePayPeriodCommand(startDate, endDate, payDate, PayFrequency.Weekly, null);
        var resp1 = await client.PostAsJsonAsync("/api/payroll/periods", create1);
        resp1.EnsureSuccessStatusCode();

        // Try to create overlapping period (same dates)
        var create2 = new CreatePayPeriodCommand(startDate, endDate, payDate.AddDays(1), PayFrequency.Weekly, null);
        var resp2 = await client.PostAsJsonAsync("/api/payroll/periods", create2);

        // Should be rejected with Conflict (409)
        Assert.Equal(HttpStatusCode.Conflict, resp2.StatusCode);
    }

    [Fact]
    public async Task Can_get_current_open_pay_period()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var startDate = UniqueStartDate(4);
        var endDate = UniqueEndDate(4);
        var payDate = UniquePayDate(4);

        var create = new CreatePayPeriodCommand(startDate, endDate, payDate, PayFrequency.Weekly, null);
        var createResp = await client.PostAsJsonAsync("/api/payroll/periods", create);
        createResp.EnsureSuccessStatusCode();

        // Get current open period
        var currentResp = await client.GetAsync("/api/payroll/periods/current");
        Assert.Equal(HttpStatusCode.OK, currentResp.StatusCode);

        var current = (await currentResp.Content.ReadFromJsonAsync<PayPeriodDto>())!;
        Assert.Equal("Open", current.Status);
    }

    #endregion

    #region Payroll Batches

    [Fact]
    public async Task Get_batches_without_auth_returns_401()
    {
        await db.ResetAsync();
        using var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/payroll/batches");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Can_create_get_and_list_payroll_batches()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create a pay period first - use unique date range
        var startDate = UniqueStartDate(10);
        var endDate = UniqueEndDate(10);
        var payDate = UniquePayDate(10);

        var periodResp = await client.PostAsJsonAsync("/api/payroll/periods",
            new CreatePayPeriodCommand(startDate, endDate, payDate, PayFrequency.Weekly, null));
        periodResp.EnsureSuccessStatusCode();
        var period = (await periodResp.Content.ReadFromJsonAsync<PayPeriodDto>())!;

        // Create batch for the period
        var createBatch = new CreatePayrollBatchCommand(PayPeriodId: period.Id, Notes: "Integration test batch");
        var createResp = await client.PostAsJsonAsync("/api/payroll/batches", createBatch);
        
        if (createResp.StatusCode != HttpStatusCode.Created)
        {
            var body = await createResp.Content.ReadAsStringAsync();
            Assert.Fail($"Expected 201 Created but got {(int)createResp.StatusCode}. Body: {body}");
        }

        var created = (await createResp.Content.ReadFromJsonAsync<PayrollBatchDto>())!;
        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal(period.Id, created.PayPeriodId);
        Assert.Equal("Draft", created.Status);
        // Batch number format: {EndDate:yyyyMMdd}-{count:D2}
        Assert.Matches(@"^\d{8}-\d{2}$", created.BatchNumber);

        // Get by ID
        var getResp = await client.GetAsync($"/api/payroll/batches/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var fetched = (await getResp.Content.ReadFromJsonAsync<PayrollBatchDto>())!;
        Assert.Equal(created.Id, fetched.Id);

        // List
        var listResp = await client.GetAsync("/api/payroll/batches");
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);

        var listJson = await listResp.Content.ReadAsStringAsync();
        Assert.Contains(created.BatchNumber, listJson);
    }

    [Fact]
    public async Task Batch_from_other_tenant_returns_404()
    {
        await db.ResetAsync();

        var (clientA, _, _) = await _factory.CreateAuthenticatedClientAsync();
        var (clientB, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Client A creates period and batch
        var periodResp = await clientA.PostAsJsonAsync("/api/payroll/periods",
            new CreatePayPeriodCommand(UniqueStartDate(11), UniqueEndDate(11), UniquePayDate(11), PayFrequency.Weekly, null));
        periodResp.EnsureSuccessStatusCode();
        var period = (await periodResp.Content.ReadFromJsonAsync<PayPeriodDto>())!;

        var batchResp = await clientA.PostAsJsonAsync("/api/payroll/batches",
            new CreatePayrollBatchCommand(period.Id, null));
        batchResp.EnsureSuccessStatusCode();
        var batch = (await batchResp.Content.ReadFromJsonAsync<PayrollBatchDto>())!;

        // Client B can't access
        var getResp = await clientB.GetAsync($"/api/payroll/batches/{batch.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task Cannot_create_batch_for_nonexistent_period()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        var createBatch = new CreatePayrollBatchCommand(PayPeriodId: Guid.NewGuid(), Notes: null);
        var resp = await client.PostAsJsonAsync("/api/payroll/batches", createBatch);

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Can_filter_batches_by_pay_period()
    {
        await db.ResetAsync();

        var (client, _, _) = await _factory.CreateAuthenticatedClientAsync();

        // Create two non-overlapping periods
        var period1Resp = await client.PostAsJsonAsync("/api/payroll/periods",
            new CreatePayPeriodCommand(UniqueStartDate(12), UniqueEndDate(12), UniquePayDate(12), PayFrequency.Weekly, null));
        period1Resp.EnsureSuccessStatusCode();
        var period1 = (await period1Resp.Content.ReadFromJsonAsync<PayPeriodDto>())!;

        var period2Resp = await client.PostAsJsonAsync("/api/payroll/periods",
            new CreatePayPeriodCommand(UniqueStartDate(13), UniqueEndDate(13), UniquePayDate(13), PayFrequency.Weekly, null));
        period2Resp.EnsureSuccessStatusCode();
        var period2 = (await period2Resp.Content.ReadFromJsonAsync<PayPeriodDto>())!;

        // Create batch for each
        await client.PostAsJsonAsync("/api/payroll/batches", new CreatePayrollBatchCommand(period1.Id, "Batch for P1"));
        await client.PostAsJsonAsync("/api/payroll/batches", new CreatePayrollBatchCommand(period2.Id, "Batch for P2"));

        // Filter by period1
        var filteredResp = await client.GetAsync($"/api/payroll/batches?payPeriodId={period1.Id}");
        filteredResp.EnsureSuccessStatusCode();

        var filteredJson = await filteredResp.Content.ReadAsStringAsync();
        Assert.Contains(period1.Id.ToString(), filteredJson);
        Assert.DoesNotContain(period2.Id.ToString(), filteredJson);
    }

    #endregion
}
