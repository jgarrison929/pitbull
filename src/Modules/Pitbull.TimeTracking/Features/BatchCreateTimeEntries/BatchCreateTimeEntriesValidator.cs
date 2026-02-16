using FluentValidation;

namespace Pitbull.TimeTracking.Features.BatchCreateTimeEntries;

public class BatchCreateTimeEntriesValidator : AbstractValidator<BatchCreateTimeEntriesCommand>
{
    public BatchCreateTimeEntriesValidator()
    {
        RuleFor(x => x.Entries)
            .NotEmpty()
            .WithMessage("At least one time entry is required")
            .Must(entries => entries.Count <= 500)
            .WithMessage("Maximum 500 entries per batch");

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

            // CostCodeId is optional -- when Guid.Empty, the service auto-assigns
            // the tenant's default labor cost code (Code="LAB").

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
                .Must(e => e.RegularHours + e.OvertimeHours + e.DoubletimeHours <= 24)
                .WithMessage("Total hours cannot exceed 24 per day");

            entry.RuleFor(e => e.Description)
                .MaximumLength(500)
                .WithMessage("Description cannot exceed 500 characters");

            entry.RuleFor(e => e.EquipmentHours)
                .GreaterThanOrEqualTo(0)
                .WithMessage("Equipment hours cannot be negative")
                .LessThanOrEqualTo(24)
                .WithMessage("Equipment hours cannot exceed 24");

            entry.RuleFor(e => e.EquipmentId)
                .NotEmpty()
                .WithMessage("Equipment ID is required when equipment hours are specified")
                .When(e => e.EquipmentHours > 0);

            entry.RuleFor(e => e.EquipmentHours)
                .GreaterThan(0)
                .WithMessage("Equipment hours must be greater than zero when equipment is selected")
                .When(e => e.EquipmentId.HasValue);
        });

        // Drafts can have zero hours; non-drafts require total hours > 0
        When(cmd => !cmd.IsDraft, () =>
        {
            RuleForEach(x => x.Entries).ChildRules(entry =>
            {
                entry.RuleFor(e => e)
                    .Must(e => e.RegularHours + e.OvertimeHours + e.DoubletimeHours > 0)
                    .WithMessage("Total hours must be greater than zero");
            });
        });
    }
}
