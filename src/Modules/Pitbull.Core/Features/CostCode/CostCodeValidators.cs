using FluentValidation;

namespace Pitbull.Core.Features.CostCode;

public class CreateCostCodeValidator : AbstractValidator<CreateCostCodeCommand>
{
    public CreateCostCodeValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("Code is required")
            .MaximumLength(20).WithMessage("Code cannot exceed 20 characters");

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Description is required")
            .MaximumLength(200).WithMessage("Description cannot exceed 200 characters");

        RuleFor(x => x.Division)
            .MaximumLength(50).WithMessage("Division cannot exceed 50 characters")
            .When(x => !string.IsNullOrEmpty(x.Division));

        RuleFor(x => x.CostType)
            .IsInEnum().WithMessage("Invalid cost type");
    }
}

public class UpdateCostCodeValidator : AbstractValidator<UpdateCostCodeCommand>
{
    public UpdateCostCodeValidator()
    {
        RuleFor(x => x.CostCodeId)
            .NotEmpty().WithMessage("Cost code ID is required");

        RuleFor(x => x.Code)
            .MaximumLength(20).WithMessage("Code cannot exceed 20 characters")
            .When(x => !string.IsNullOrEmpty(x.Code));

        RuleFor(x => x.Description)
            .MaximumLength(200).WithMessage("Description cannot exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.Description));

        RuleFor(x => x.Division)
            .MaximumLength(50).WithMessage("Division cannot exceed 50 characters")
            .When(x => x.Division != null);

        RuleFor(x => x.CostType)
            .IsInEnum().WithMessage("Invalid cost type")
            .When(x => x.CostType.HasValue);
    }
}
