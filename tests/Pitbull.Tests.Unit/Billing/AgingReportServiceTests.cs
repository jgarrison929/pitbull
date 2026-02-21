using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Billing.Features.Aging;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Tests.Unit.Billing;

public class AgingReportServiceTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestCompanyId = Guid.NewGuid();
    private readonly PitbullDbContext _db;
    private readonly AgingReportService _service;

    public AgingReportServiceTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new() { CompanyId = TestCompanyId };

        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);
        _service = new AgingReportService(_db, NullLogger<AgingReportService>.Instance);
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    private Vendor CreateVendor(string name = "Test Vendor", string code = "TV")
    {
        var vendor = new Vendor
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            Name = name,
            Code = code,
        };
        _db.Set<Vendor>().Add(vendor);
        return vendor;
    }

    private VendorInvoice CreateInvoice(Guid vendorId, DateOnly dueDate, decimal amount,
        VendorInvoiceStatus status = VendorInvoiceStatus.Pending)
    {
        var invoice = new VendorInvoice
        {
            TenantId = TestTenantId,
            CompanyId = TestCompanyId,
            VendorId = vendorId,
            InvoiceNumber = $"INV-{Guid.NewGuid():N}".Substring(0, 12),
            InvoiceDate = dueDate.AddDays(-30),
            DueDate = dueDate,
            TotalAmount = amount,
            Status = status,
        };
        _db.Set<VendorInvoice>().Add(invoice);
        return invoice;
    }

    // ── Same month calculation ──

    [Fact]
    public async Task GetVendorAging_SameMonth_CorrectBucket()
    {
        var asOf = new DateOnly(2026, 2, 20);
        var vendor = CreateVendor();
        CreateInvoice(vendor.Id, asOf.AddDays(-15), 5000m); // 15 days overdue → 1-30 bucket
        await _db.SaveChangesAsync();

        var result = await _service.GetVendorAgingAsync(asOf);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Summary.Current.Should().Be(0m);
        result.Value.Summary.Days1To30.Should().Be(5000m);
    }

    // ── Cross-year boundary (Dec → Jan) ──

    [Fact]
    public async Task GetVendorAging_CrossYearBoundary_CorrectDayCount()
    {
        var asOf = new DateOnly(2026, 1, 2);
        var vendor = CreateVendor();
        // Due Dec 1, 2025 → 32 days overdue from Jan 2, 2026 → 31-60 bucket
        CreateInvoice(vendor.Id, new DateOnly(2025, 12, 1), 3000m);
        await _db.SaveChangesAsync();

        var result = await _service.GetVendorAgingAsync(asOf);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Summary.Days31To60.Should().Be(3000m);
        result.Value.Summary.Days1To30.Should().Be(0m);
    }

    // ── Future-dated items → Current ──

    [Fact]
    public async Task GetVendorAging_FutureDatedItem_ClassifiedAsCurrent()
    {
        var asOf = new DateOnly(2026, 2, 20);
        var vendor = CreateVendor();
        // Due in the future (not yet overdue) → Current bucket
        CreateInvoice(vendor.Id, asOf.AddDays(10), 2000m);
        await _db.SaveChangesAsync();

        var result = await _service.GetVendorAgingAsync(asOf);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Summary.Current.Should().Be(2000m);
    }

    // ── Exact bucket boundaries ──

    [Fact]
    public async Task GetVendorAging_ExactlyOnDueDate_ClassifiedAsCurrent()
    {
        var asOf = new DateOnly(2026, 2, 20);
        var vendor = CreateVendor();
        // Due today (0 days overdue) → Current bucket
        CreateInvoice(vendor.Id, asOf, 1000m);
        await _db.SaveChangesAsync();

        var result = await _service.GetVendorAgingAsync(asOf);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Summary.Current.Should().Be(1000m);
    }

    [Fact]
    public async Task GetVendorAging_OneDayOverdue_Goes1To30Bucket()
    {
        var asOf = new DateOnly(2026, 2, 20);
        var vendor = CreateVendor();
        // 1 day overdue → 1-30 bucket
        CreateInvoice(vendor.Id, asOf.AddDays(-1), 1000m);
        await _db.SaveChangesAsync();

        var result = await _service.GetVendorAgingAsync(asOf);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Summary.Days1To30.Should().Be(1000m);
    }

    [Fact]
    public async Task GetVendorAging_Exactly30DaysOverdue_Stays1To30Bucket()
    {
        var asOf = new DateOnly(2026, 2, 20);
        var vendor = CreateVendor();
        // 30 days overdue → still in 1-30 bucket
        CreateInvoice(vendor.Id, asOf.AddDays(-30), 1000m);
        await _db.SaveChangesAsync();

        var result = await _service.GetVendorAgingAsync(asOf);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Summary.Days1To30.Should().Be(1000m);
    }

    [Fact]
    public async Task GetVendorAging_Exactly31DaysOverdue_Goes31To60Bucket()
    {
        var asOf = new DateOnly(2026, 2, 20);
        var vendor = CreateVendor();
        // 31 days overdue → 31-60 bucket
        CreateInvoice(vendor.Id, asOf.AddDays(-31), 1000m);
        await _db.SaveChangesAsync();

        var result = await _service.GetVendorAgingAsync(asOf);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Summary.Days31To60.Should().Be(1000m);
    }

    [Fact]
    public async Task GetVendorAging_Exactly60DaysOverdue_Stays31To60Bucket()
    {
        var asOf = new DateOnly(2026, 2, 20);
        var vendor = CreateVendor();
        CreateInvoice(vendor.Id, asOf.AddDays(-60), 1000m);
        await _db.SaveChangesAsync();

        var result = await _service.GetVendorAgingAsync(asOf);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Summary.Days31To60.Should().Be(1000m);
    }

    [Fact]
    public async Task GetVendorAging_Exactly61DaysOverdue_Goes61To90Bucket()
    {
        var asOf = new DateOnly(2026, 2, 20);
        var vendor = CreateVendor();
        CreateInvoice(vendor.Id, asOf.AddDays(-61), 1000m);
        await _db.SaveChangesAsync();

        var result = await _service.GetVendorAgingAsync(asOf);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Summary.Days61To90.Should().Be(1000m);
    }

    [Fact]
    public async Task GetVendorAging_Exactly90DaysOverdue_Stays61To90Bucket()
    {
        var asOf = new DateOnly(2026, 2, 20);
        var vendor = CreateVendor();
        CreateInvoice(vendor.Id, asOf.AddDays(-90), 1000m);
        await _db.SaveChangesAsync();

        var result = await _service.GetVendorAgingAsync(asOf);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Summary.Days61To90.Should().Be(1000m);
    }

    [Fact]
    public async Task GetVendorAging_Exactly91DaysOverdue_Goes90PlusBucket()
    {
        var asOf = new DateOnly(2026, 2, 20);
        var vendor = CreateVendor();
        CreateInvoice(vendor.Id, asOf.AddDays(-91), 1000m);
        await _db.SaveChangesAsync();

        var result = await _service.GetVendorAgingAsync(asOf);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Summary.Days90Plus.Should().Be(1000m);
    }

    // ── Multiple invoices across buckets ──

    [Fact]
    public async Task GetVendorAging_MultipleInvoices_CorrectlyDistributed()
    {
        var asOf = new DateOnly(2026, 2, 20);
        var vendor = CreateVendor();
        CreateInvoice(vendor.Id, asOf.AddDays(5), 1000m);    // Current (future)
        CreateInvoice(vendor.Id, asOf.AddDays(-10), 2000m);   // 1-30
        CreateInvoice(vendor.Id, asOf.AddDays(-45), 3000m);   // 31-60
        CreateInvoice(vendor.Id, asOf.AddDays(-75), 4000m);   // 61-90
        CreateInvoice(vendor.Id, asOf.AddDays(-120), 5000m);  // 90+
        await _db.SaveChangesAsync();

        var result = await _service.GetVendorAgingAsync(asOf);

        result.IsSuccess.Should().BeTrue();
        var summary = result.Value!.Summary;
        summary.Current.Should().Be(1000m);
        summary.Days1To30.Should().Be(2000m);
        summary.Days31To60.Should().Be(3000m);
        summary.Days61To90.Should().Be(4000m);
        summary.Days90Plus.Should().Be(5000m);
        summary.Total.Should().Be(15000m);
    }

    // ── Paid invoices excluded ──

    [Fact]
    public async Task GetVendorAging_PaidInvoices_AreExcluded()
    {
        var asOf = new DateOnly(2026, 2, 20);
        var vendor = CreateVendor();
        CreateInvoice(vendor.Id, asOf.AddDays(-10), 5000m, VendorInvoiceStatus.Paid);
        await _db.SaveChangesAsync();

        var result = await _service.GetVendorAgingAsync(asOf);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Summary.Total.Should().Be(0m);
    }

    // ── No invoices ──

    [Fact]
    public async Task GetVendorAging_NoInvoices_ReturnsEmptyResult()
    {
        var asOf = new DateOnly(2026, 2, 20);

        var result = await _service.GetVendorAgingAsync(asOf);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Vendors.Should().BeEmpty();
        result.Value.Summary.Total.Should().Be(0m);
    }

    // ── Vendor info populated correctly ──

    [Fact]
    public async Task GetVendorAging_VendorInfo_PopulatedCorrectly()
    {
        var asOf = new DateOnly(2026, 2, 20);
        var vendor = CreateVendor("ABC Concrete", "ABC");
        CreateInvoice(vendor.Id, asOf.AddDays(-5), 1000m);
        await _db.SaveChangesAsync();

        var result = await _service.GetVendorAgingAsync(asOf);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Vendors.Should().HaveCount(1);
        result.Value.Vendors[0].VendorName.Should().Be("ABC Concrete");
        result.Value.Vendors[0].VendorCode.Should().Be("ABC");
        result.Value.Vendors[0].InvoiceCount.Should().Be(1);
    }

    // ── Cross-year: invoice from previous year, report in new year ──

    [Fact]
    public async Task GetVendorAging_InvoiceFromPreviousYear_CorrectAgeBucket()
    {
        // Dec 15, 2025 → Feb 20, 2026 = 67 days → 61-90 bucket
        var asOf = new DateOnly(2026, 2, 20);
        var vendor = CreateVendor();
        CreateInvoice(vendor.Id, new DateOnly(2025, 12, 15), 8000m);
        await _db.SaveChangesAsync();

        var result = await _service.GetVendorAgingAsync(asOf);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Summary.Days61To90.Should().Be(8000m);
    }
}
