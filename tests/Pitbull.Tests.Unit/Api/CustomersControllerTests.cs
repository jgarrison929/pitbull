using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Api.Controllers;
using Pitbull.Billing.Features.Customers;
using Pitbull.Billing.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Tests.Unit.Api;

public class CustomersControllerTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private readonly PitbullDbContext _db;
    private readonly CustomersController _controller;

    public CustomersControllerTests()
    {
        TenantContext tenantContext = new() { TenantId = TestTenantId, TenantName = "Test" };
        CompanyContext companyContext = new();

        DbContextOptions<PitbullDbContext> options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);
        ICustomerService service = new CustomerService(_db, NullLogger<CustomerService>.Instance);
        _controller = new CustomersController(service)
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

    private async Task<Customer> SeedCustomer(string code = "C-001", string name = "City of Austin")
    {
        Customer customer = new()
        {
            Id = Guid.NewGuid(),
            TenantId = TestTenantId,
            CompanyId = Guid.NewGuid(),
            Code = code,
            Name = name,
            ContactEmail = "ap@city.gov",
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        _db.Set<Customer>().Add(customer);
        await _db.SaveChangesAsync();
        return customer;
    }

    [Fact]
    public async Task List_ReturnsOk()
    {
        await SeedCustomer();

        IActionResult result = await _controller.List(null, null);

        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ListCustomersResult payload = ok.Value.Should().BeOfType<ListCustomersResult>().Subject;
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
        CreateCustomerRequest request = new(
            Name: "Campus Owner LLC",
            Code: "C-100",
            ContactName: "A. Manager",
            ContactEmail: "billing@owner.com");

        IActionResult result = await _controller.Create(request);

        CreatedAtActionResult created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        CustomerDto dto = created.Value.Should().BeOfType<CustomerDto>().Subject;
        dto.Name.Should().Be("Campus Owner LLC");
        dto.Code.Should().Be("C-100");
    }

    [Fact]
    public async Task Update_Found_ReturnsUpdatedCustomer()
    {
        Customer seeded = await SeedCustomer();
        UpdateCustomerRequest request = new(Name: "Updated Owner", PaymentTerms: "Net 60");

        IActionResult result = await _controller.Update(seeded.Id, request);

        OkObjectResult ok = result.Should().BeOfType<OkObjectResult>().Subject;
        CustomerDto dto = ok.Value.Should().BeOfType<CustomerDto>().Subject;
        dto.Name.Should().Be("Updated Owner");
        dto.PaymentTerms.Should().Be("Net 60");
    }

    [Fact]
    public async Task Delete_SoftDeletesCustomer()
    {
        Customer seeded = await SeedCustomer();

        IActionResult deleteResult = await _controller.Delete(seeded.Id);
        deleteResult.Should().BeOfType<NoContentResult>();

        IActionResult getResult = await _controller.GetById(seeded.Id);
        getResult.Should().BeOfType<NotFoundObjectResult>();
    }
}
