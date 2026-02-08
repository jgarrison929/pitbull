using FluentValidation;

namespace Pitbull.Contracts.Features.DeleteSubcontract;

public class DeleteSubcontractValidator : AbstractValidator<DeleteSubcontractCommand>
{
    public DeleteSubcontractValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Subcontract ID is required");
    }
}
