using FluentValidation.TestHelper;
using Pitbull.Contracts.Features.OwnerChangeOrders;

namespace Pitbull.Tests.Unit.Contracts;

public sealed class CreateOwnerChangeOrderValidatorTests
{
    private readonly CreateOwnerChangeOrderValidator _validator = new();

    private static CreateOwnerChangeOrderCommand Valid(
        string number = "OCO-001",
        string title = "Owner CO",
        string description = "Scope change",
        decimal amount = 10000m)
        => new(
            ProjectId: Guid.NewGuid(),
            ChangeOrderNumber: number,
            Title: title,
            Description: description,
            Reason: "Owner request",
            Amount: amount,
            DaysExtension: 2,
            ReferenceNumber: "REF-1");

    [Fact]
    public void Valid_command_passes()
    {
        _validator.TestValidate(Valid()).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Title_too_long_fails()
    {
        _validator.TestValidate(Valid(title: new string('A', 201)))
            .ShouldHaveValidationErrorFor(x => x.Title);
    }

    [Fact]
    public void Amount_over_max_fails()
    {
        _validator.TestValidate(Valid(amount: 1_000_000_000.01m))
            .ShouldHaveValidationErrorFor(x => x.Amount);
    }

    [Fact]
    public void Empty_number_fails()
    {
        _validator.TestValidate(Valid(number: ""))
            .ShouldHaveValidationErrorFor(x => x.ChangeOrderNumber);
    }
}
