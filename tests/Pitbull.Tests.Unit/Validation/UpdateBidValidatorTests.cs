using FluentAssertions;
using FluentValidation.TestHelper;
using Pitbull.Bids.Domain;
using Pitbull.Bids.Features.CreateBid;
using Pitbull.Bids.Features.UpdateBid;

namespace Pitbull.Tests.Unit.Validation;

public sealed class UpdateBidValidatorTests
{
    private readonly UpdateBidValidator _validator = new();

    private static UpdateBidCommand CreateValidCommand(
        Guid? id = null,
        string? name = "Test Bid",
        string? number = "BID-001",
        BidStatus status = BidStatus.Draft,
        decimal estimatedValue = 500000m,
        DateTime? bidDate = null,
        DateTime? dueDate = null,
        List<CreateBidItemDto>? items = null)
    {
        return new UpdateBidCommand(
            Id: id ?? Guid.NewGuid(),
            Name: name ?? "Test Bid",
            Number: number ?? "BID-001",
            Status: status,
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
    public void Validate_WithEmptyId_ShouldHaveError()
    {
        var command = CreateValidCommand(id: Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Id)
            .WithErrorMessage("Bid ID is required");
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
    public void Validate_WithAllStatuses_ShouldNotHaveError()
    {
        foreach (BidStatus status in Enum.GetValues(typeof(BidStatus)))
        {
            var command = CreateValidCommand(status: status);
            var result = _validator.TestValidate(command);
            result.ShouldNotHaveValidationErrorFor(x => x.Status);
        }
    }

    [Fact]
    public void Validate_WithValidBidItem_ShouldNotHaveError()
    {
        var items = new List<CreateBidItemDto>
        {
            new("Test Item", BidItemCategory.Material, 10, 100m)
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
            new("", BidItemCategory.Material, 10, 100m)
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
            new("Test Item", BidItemCategory.Material, 0, 100m)
        };
        var command = CreateValidCommand(items: items);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor("Items[0].Quantity")
            .WithErrorMessage("Quantity must be greater than 0");
    }
}
