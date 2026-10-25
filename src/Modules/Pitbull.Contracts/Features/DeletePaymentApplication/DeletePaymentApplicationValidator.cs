using FluentValidation;

namespace Pitbull.Contracts.Features.DeletePaymentApplication;

public class DeletePaymentApplicationValidator : AbstractValidator<DeletePaymentApplicationCommand>
{
    public DeletePaymentApplicationValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Payment application ID is required");
    }
}
