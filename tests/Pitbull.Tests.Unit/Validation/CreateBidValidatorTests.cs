using FluentAssertions;
using FluentValidation.TestHelper;
using Pitbull.Bids.Domain;
using Pitbull.Bids.Features.CreateBid;

namespace Pitbull.Tests.Unit.Validation;

public sealed class CreateBidValidatorTests
{
    private readonly CreateBidValidator _validator = new();

    private static CreateBidCommand CreateValidCommand(
        string? name = "Test Bid",
        string? number = "BID-001",
        decimal estimatedValue = 500000m,
        DateTime? bidDate = null,
        DateTime? dueDate = null,
        List<CreateBidItemDto>? items = null)
    {
        return new CreateBidCommand(
            Name: name ?? "Test Bid",
            Number: number ?? "BID-001",
            EstimatedValue: estimatedValue,
            BidDate: bidDate,
            DueDate: dueDate,
            Owner: null,
            Description: null,
            Items: items
        );
    }

    [Fact]
    public void Validate_WithValidCommand_ShouldNotHaveErrors()
    {
        var command = CreateValidCommand();
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WithEmptyName_ShouldHaveError()
    {
        var command = CreateValidCommand(name: "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Name)
            .WithErrorMessage("Bid name is required");
    }

    [Fact]
    public void Validate_WithEmptyNumber_ShouldHaveError()
    {
        var command = CreateValidCommand(number: "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Number)
            .WithErrorMessage("Bid number is required");
    }

    [Fact]
    public void Validate_WithNegativeEstimatedValue_ShouldHaveError()
    {
        var command = CreateValidCommand(estimatedValue: -1000m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.EstimatedValue)
            .WithErrorMessage("Estimated value cannot be negative");
    }

    [Fact]
    public void Validate_WithNameTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(name: new string('A', 201));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Name)
            .WithErrorMessage("Bid name cannot exceed 200 characters");
    }

    [Fact]
    public void Validate_WithDueBeforeBidDate_ShouldHaveError()
    {
        var command = CreateValidCommand(
            bidDate: new DateTime(2026, 6, 1),
            dueDate: new DateTime(2026, 1, 1)
        );
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.DueDate)
            .WithErrorMessage("Due date must be after bid date");
    }

    [Fact]
    public void Validate_WithZeroEstimatedValue_ShouldNotHaveError()
    {
        var command = CreateValidCommand(estimatedValue: 0m);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.EstimatedValue);
    }

    [Fact]
    public void Validate_WithValidBidItem_ShouldNotHaveError()
    {
        var items = new List<CreateBidItemDto>
        {
            new("Foundation Work", BidItemCategory.Labor, 100, 50m)
        };
        var command = CreateValidCommand(items: items);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WithEmptyBidItemDescription_ShouldHaveError()
    {
        var items = new List<CreateBidItemDto>
        {
            new("", BidItemCategory.Labor, 100, 50m)
        };
        var command = CreateValidCommand(items: items);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor("Items[0].Description")
            .WithErrorMessage("Bid item description is required");
    }

    [Fact]
    public void Validate_WithZeroQuantity_ShouldHaveError()
    {
        var items = new List<CreateBidItemDto>
        {
            new("Test Item", BidItemCategory.Labor, 0, 50m)
        };
        var command = CreateValidCommand(items: items);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor("Items[0].Quantity")
            .WithErrorMessage("Quantity must be greater than 0");
    }

    [Fact]
    public void Validate_WithNegativeUnitCost_ShouldHaveError()
    {
        var items = new List<CreateBidItemDto>
        {
            new("Test Item", BidItemCategory.Labor, 100, -10m)
        };
        var command = CreateValidCommand(items: items);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor("Items[0].UnitCost")
            .WithErrorMessage("Unit cost cannot be negative");
    }
}
