using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Api.Controllers;
using Pitbull.Billing.Features.Vendors;
using Pitbull.Billing.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Tests.Unit.Api;

public class VendorsControllerTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private readonly PitbullDbContext _db;
    private readonly VendorsController _controller;

    public VendorsControllerTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new();

        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);
        IVendorService service = new VendorService(_db, NullLogger<VendorService>.Instance);
        _controller = new VendorsController(service)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    private async Task<Vendor> SeedVendor(string code = "V-001", string name = "Acme Concrete")
    {
        Vendor vendor = new()
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            CompanyId = Guid.NewGuid(),
            Code = code,
            Name = name,
            ContactEmail = "ap@acme.com",
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        _db.Set<Vendor>().Add(vendor);
        await _db.SaveChangesAsync();
        return vendor;
    }

    [Fact]
    public async Task List_ReturnsOk()
    {
        await SeedVendor();

        IActionResult result = await _controller.List(null, null);

        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ListVendorsResult payload = ok.Value.Should().BeOfType<ListVendorsResult>().Subject;
        payload.TotalCount.Should().Be(1);
        payload.Items.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetById_NotFound_Returns404()
    {
        IActionResult result = await _controller.GetById(Guid.NewGuid());

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Create_ValidRequest_Returns201()
    {
        CreateVendorRequest request = new(
            Name: "River Electric",
            Code: "V-100",
            ContactName: "Jane Smith",
            ContactEmail: "billing@river.com");

        IActionResult result = await _controller.Create(request);

        CreatedAtActionResult created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        VendorDto dto = created.Value.Should().BeOfType<VendorDto>().Subject;
        dto.Name.Should().Be("River Electric");
        dto.Code.Should().Be("V-100");
    }

    [Fact]
    public async Task Update_Found_ReturnsUpdatedVendor()
    {
        Vendor seeded = await SeedVendor();
        UpdateVendorRequest request = new(Name: "Updated Name", PaymentTerms: "Net 45");

        IActionResult result = await _controller.Update(seeded.Id, request);

        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        VendorDto dto = ok.Value.Should().BeOfType<VendorDto>().Subject;
        dto.Name.Should().Be("Updated Name");
        dto.PaymentTerms.Should().Be("Net 45");
    }

    [Fact]
    public async Task Delete_SoftDeletesVendor()
    {
        Vendor seeded = await SeedVendor();

        IActionResult deleteResult = await _controller.Delete(seeded.Id);
        deleteResult.Should().BeOfType<NoContentResult>();

        IActionResult getResult = await _controller.GetById(seeded.Id);
        getResult.Should().BeOfType<NotFoundObjectResult>();
    }
}
