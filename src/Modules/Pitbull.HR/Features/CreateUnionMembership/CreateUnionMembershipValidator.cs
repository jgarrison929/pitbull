using FluentValidation;

namespace Pitbull.HR.Features.CreateUnionMembership;

public class CreateUnionMembershipValidator : AbstractValidator<CreateUnionMembershipCommand>
{
    public CreateUnionMembershipValidator()
    {
        RuleFor(x => x.EmployeeId).NotEmpty();
        RuleFor(x => x.UnionLocal).NotEmpty().MaximumLength(100);
        RuleFor(x => x.MembershipNumber).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Classification).NotEmpty().MaximumLength(50);
        RuleFor(x => x.ApprenticeLevel).InclusiveBetween(1, 10).When(x => x.ApprenticeLevel.HasValue);
        RuleFor(x => x.DispatchNumber).MaximumLength(50).When(x => !string.IsNullOrEmpty(x.DispatchNumber));
        RuleFor(x => x.DispatchListPosition).GreaterThan(0).When(x => x.DispatchListPosition.HasValue);
        RuleFor(x => x.FringeRate).GreaterThanOrEqualTo(0).When(x => x.FringeRate.HasValue);
        RuleFor(x => x.HealthWelfareRate).GreaterThanOrEqualTo(0).When(x => x.HealthWelfareRate.HasValue);
        RuleFor(x => x.PensionRate).GreaterThanOrEqualTo(0).When(x => x.PensionRate.HasValue);
        RuleFor(x => x.TrainingRate).GreaterThanOrEqualTo(0).When(x => x.TrainingRate.HasValue);
        RuleFor(x => x.EffectiveDate).NotEmpty();
        RuleFor(x => x.Notes).MaximumLength(500).When(x => !string.IsNullOrEmpty(x.Notes));
    }
}
