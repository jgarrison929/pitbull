using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Billing.Features.Customers;
using Pitbull.Billing.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.Billing;

public sealed class CustomerServiceTests
{
    private static CustomerService CreateService(PitbullDbContext db) =>
        new(db, NullLogger<CustomerService>.Instance);

    [Fact]
    public async Task CreateCustomerAsync_MissingNameOrCode_ReturnsValidationError()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        CustomerService service = CreateService(db);

        var result = await service.CreateCustomerAsync(new CreateCustomerCommand(Name: "", Code: " "));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task CreateCustomerAsync_DuplicateCode_ReturnsDuplicateError()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        CustomerService service = CreateService(db);
        await SeedCustomerAsync(db, code: "C-100");

        var result = await service.CreateCustomerAsync(new CreateCustomerCommand(
            Name: "City of Austin",
            Code: "C-100"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("DUPLICATE_CODE");
    }

    [Fact]
    public async Task UpdateCustomerAsync_DuplicateCode_ReturnsDuplicateError()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        CustomerService service = CreateService(db);
        await SeedCustomerAsync(db, code: "C-001");
        Customer customerToUpdate = await SeedCustomerAsync(db, code: "C-002");

        var result = await service.UpdateCustomerAsync(new UpdateCustomerCommand(
            CustomerId: customerToUpdate.Id,
            Code: "C-001"));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("DUPLICATE_CODE");
    }

    [Fact]
    public async Task UpdateCustomerAsync_IsActiveToggle_UpdatesState()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        CustomerService service = CreateService(db);
        Customer customer = await SeedCustomerAsync(db, code: "C-200", isActive: true);

        var result = await service.UpdateCustomerAsync(new UpdateCustomerCommand(
            CustomerId: customer.Id,
            IsActive: false,
            Name: " Updated Name "));

        result.IsSuccess.Should().BeTrue();
        result.Value!.IsActive.Should().BeFalse();
        result.Value.Name.Should().Be("Updated Name");
    }

    [Fact]
    public async Task DeleteCustomerAsync_ExistingCustomer_DeletesAndSubsequentGetNotFound()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        CustomerService service = CreateService(db);
        Customer customer = await SeedCustomerAsync(db, code: "C-300");

        var deleteResult = await service.DeleteCustomerAsync(customer.Id);
        var getResult = await service.GetCustomerAsync(customer.Id);

        deleteResult.IsSuccess.Should().BeTrue();
        getResult.IsSuccess.Should().BeFalse();
        getResult.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task GetCustomersAsync_SearchAndInvalidPaging_AppliesDefaults()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        CustomerService service = CreateService(db);
        await SeedCustomerAsync(db, code: "C-500", name: "Prime Owner", contactEmail: "billing@prime.com");
        await SeedCustomerAsync(db, code: "C-600", name: "Other Owner", contactEmail: "other@owner.com");

        var result = await service.GetCustomersAsync(new ListCustomersQuery(
            SearchTerm: "  BILLING@PRIME.COM  ",
            IsActive: null,
            Page: 0,
            PageSize: 0));

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().HaveCount(1);
        result.Value.Items[0].Code.Should().Be("C-500");
        result.Value.Page.Should().Be(1);
        result.Value.PageSize.Should().Be(25);
    }

    private static async Task<Customer> SeedCustomerAsync(
        PitbullDbContext db,
        string code,
        string name = "Test Customer",
        string? contactEmail = "ap@test.com",
        bool isActive = true)
    {
        Customer customer = new()
        {
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            Name = name,
            Code = code,
            ContactEmail = contactEmail,
            IsActive = isActive,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        db.Set<Customer>().Add(customer);
        await db.SaveChangesAsync();
        return customer;
    }
}
