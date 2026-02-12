using FluentValidation;

namespace Pitbull.TimeTracking.Features.BatchCreateTimeEntries;

public class BatchCreateTimeEntriesValidator : AbstractValidator<BatchCreateTimeEntriesCommand>
{
    public BatchCreateTimeEntriesValidator()
    {
        RuleFor(x => x.Entries)
            .NotEmpty()
            .WithMessage("At least one time entry is required")
            .Must(entries => entries.Count <= 50)
            .WithMessage("Maximum 50 entries per batch");

        RuleForEach(x => x.Entries).ChildRules(entry =>
        {
            entry.RuleFor(e => e.Date)
                .NotEmpty()
                .WithMessage("Date is required");

            entry.RuleFor(e => e.EmployeeId)
                .NotEmpty()
                .WithMessage("Employee is required");

            entry.RuleFor(e => e.ProjectId)
                .NotEmpty()
                .WithMessage("Project is required");

            entry.RuleFor(e => e.CostCodeId)
                .NotEmpty()
                .WithMessage("Cost code is required");

            entry.RuleFor(e => e.RegularHours)
                .GreaterThanOrEqualTo(0)
                .WithMessage("Regular hours cannot be negative")
                .LessThanOrEqualTo(24)
                .WithMessage("Regular hours cannot exceed 24");

            entry.RuleFor(e => e.OvertimeHours)
                .GreaterThanOrEqualTo(0)
                .WithMessage("Overtime hours cannot be negative")
                .LessThanOrEqualTo(24)
                .WithMessage("Overtime hours cannot exceed 24");

            entry.RuleFor(e => e.DoubletimeHours)
                .GreaterThanOrEqualTo(0)
                .WithMessage("Doubletime hours cannot be negative")
                .LessThanOrEqualTo(24)
                .WithMessage("Doubletime hours cannot exceed 24");

            entry.RuleFor(e => e)
                .Must(e => e.RegularHours + e.OvertimeHours + e.DoubletimeHours > 0)
                .WithMessage("Total hours must be greater than zero");

            entry.RuleFor(e => e)
                .Must(e => e.RegularHours + e.OvertimeHours + e.DoubletimeHours <= 24)
                .WithMessage("Total hours cannot exceed 24 per day");

            entry.RuleFor(e => e.Description)
                .MaximumLength(500)
                .WithMessage("Description cannot exceed 500 characters");
        });
    }
}
