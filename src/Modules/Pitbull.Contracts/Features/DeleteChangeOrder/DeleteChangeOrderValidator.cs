using FluentValidation;

namespace Pitbull.Contracts.Features.DeleteChangeOrder;

public class DeleteChangeOrderValidator : AbstractValidator<DeleteChangeOrderCommand>
{
    public DeleteChangeOrderValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Change order ID is required");
    }
}
