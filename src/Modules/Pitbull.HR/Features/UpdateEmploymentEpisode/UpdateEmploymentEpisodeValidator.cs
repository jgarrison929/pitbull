using FluentValidation;

namespace Pitbull.HR.Features.UpdateEmploymentEpisode;

public class UpdateEmploymentEpisodeValidator : AbstractValidator<UpdateEmploymentEpisodeCommand>
{
    public UpdateEmploymentEpisodeValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Episode ID is required");

        RuleFor(x => x.TerminationDate)
            .LessThanOrEqualTo(DateOnly.FromDateTime(DateTime.UtcNow))
            .WithMessage("Termination date cannot be in the future")
            .When(x => x.TerminationDate.HasValue);

        RuleFor(x => x.SeparationReason)
            .IsInEnum().WithMessage("Invalid separation reason")
            .When(x => x.SeparationReason.HasValue);

        RuleFor(x => x.SeparationNotes)
            .MaximumLength(1000).WithMessage("Separation notes cannot exceed 1000 characters")
            .When(x => !string.IsNullOrEmpty(x.SeparationNotes));

        RuleFor(x => x.PositionAtTermination)
            .MaximumLength(100).WithMessage("Position cannot exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.PositionAtTermination));
    }
}
