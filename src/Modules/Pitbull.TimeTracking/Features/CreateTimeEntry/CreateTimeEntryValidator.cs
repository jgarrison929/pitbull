using FluentValidation;

namespace Pitbull.TimeTracking.Features.CreateTimeEntry;

public class CreateTimeEntryValidator : AbstractValidator<CreateTimeEntryCommand>
{
    public CreateTimeEntryValidator()
    {
        RuleFor(x => x.Date)
            .NotEmpty().WithMessage("Date is required")
            .LessThanOrEqualTo(DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)))
            .WithMessage("Date cannot be more than 1 day in the future");

        RuleFor(x => x.EmployeeId)
            .NotEmpty().WithMessage("Employee is required");

        RuleFor(x => x.ProjectId)
            .NotEmpty().WithMessage("Project is required");

        RuleFor(x => x.CostCodeId)
            .NotEmpty().WithMessage("Cost code is required");

        RuleFor(x => x.RegularHours)
            .GreaterThanOrEqualTo(0).WithMessage("Regular hours cannot be negative")
            .LessThanOrEqualTo(24).WithMessage("Regular hours cannot exceed 24");

        RuleFor(x => x.OvertimeHours)
            .GreaterThanOrEqualTo(0).WithMessage("Overtime hours cannot be negative")
            .LessThanOrEqualTo(24).WithMessage("Overtime hours cannot exceed 24");

        RuleFor(x => x.DoubletimeHours)
            .GreaterThanOrEqualTo(0).WithMessage("Doubletime hours cannot be negative")
            .LessThanOrEqualTo(24).WithMessage("Doubletime hours cannot exceed 24");

        RuleFor(x => x)
            .Must(x => x.RegularHours + x.OvertimeHours + x.DoubletimeHours > 0)
            .WithMessage("At least one hour type must have a positive value");

        RuleFor(x => x)
            .Must(x => x.RegularHours + x.OvertimeHours + x.DoubletimeHours <= 24)
            .WithMessage("Total hours cannot exceed 24 per day");

        RuleFor(x => x.Description)
            .MaximumLength(500).WithMessage("Description cannot exceed 500 characters")
            .When(x => !string.IsNullOrEmpty(x.Description));
    }
}
