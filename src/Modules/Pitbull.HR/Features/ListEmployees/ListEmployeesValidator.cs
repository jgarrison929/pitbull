using FluentValidation;

namespace Pitbull.HR.Features.ListEmployees;

/// <summary>
/// Validator for ListEmployeesQuery.
/// </summary>
public class ListEmployeesValidator : AbstractValidator<ListEmployeesQuery>
{
    public ListEmployeesValidator()
    {
        RuleFor(x => x.Search)
            .MaximumLength(100).WithMessage("Search term cannot exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.Search));

        RuleFor(x => x.TradeCode)
            .MaximumLength(50).WithMessage("Trade code cannot exceed 50 characters")
            .When(x => !string.IsNullOrEmpty(x.TradeCode));

        RuleFor(x => x.Status)
            .IsInEnum().WithMessage("Invalid employment status")
            .When(x => x.Status.HasValue);

        RuleFor(x => x.WorkerType)
            .IsInEnum().WithMessage("Invalid worker type")
            .When(x => x.WorkerType.HasValue);

        RuleFor(x => x.SortBy)
            .IsInEnum().WithMessage("Invalid sort field");
    }
}
