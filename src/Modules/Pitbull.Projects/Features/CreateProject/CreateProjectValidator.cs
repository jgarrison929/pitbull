using FluentValidation;

namespace Pitbull.Projects.Features.CreateProject;

public class CreateProjectValidator : AbstractValidator<CreateProjectCommand>
{
    public CreateProjectValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Project name is required")
            .MaximumLength(200).WithMessage("Project name cannot exceed 200 characters");

        RuleFor(x => x.Number)
            .NotEmpty().WithMessage("Project number is required")
            .MaximumLength(50).WithMessage("Project number cannot exceed 50 characters");

        RuleFor(x => x.Type)
            .IsInEnum().WithMessage("Invalid project type");

        RuleFor(x => x.ContractAmount)
            .GreaterThanOrEqualTo(0).WithMessage("Contract amount cannot be negative")
            .LessThanOrEqualTo(1_000_000_000m).WithMessage("Contract amount cannot exceed 1,000,000,000");

        // Optional fields with length validation
        RuleFor(x => x.Description)
            .MaximumLength(1000).WithMessage("Description cannot exceed 1000 characters")
            .When(x => !string.IsNullOrEmpty(x.Description));

        RuleFor(x => x.Address)
            .MaximumLength(200).WithMessage("Address cannot exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.Address));

        RuleFor(x => x.City)
            .MaximumLength(100).WithMessage("City cannot exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.City));

        RuleFor(x => x.State)
            .MaximumLength(50).WithMessage("State cannot exceed 50 characters")
            .When(x => !string.IsNullOrEmpty(x.State));

        RuleFor(x => x.ZipCode)
            .MaximumLength(20).WithMessage("Zip code cannot exceed 20 characters")
            .When(x => !string.IsNullOrEmpty(x.ZipCode));

        RuleFor(x => x.ClientName)
            .MaximumLength(200).WithMessage("Client name cannot exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.ClientName));

        RuleFor(x => x.ClientContact)
            .MaximumLength(200).WithMessage("Client contact cannot exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.ClientContact));

        RuleFor(x => x.ClientEmail)
            .EmailAddress().WithMessage("Invalid email format")
            .MaximumLength(256).WithMessage("Email cannot exceed 256 characters")
            .When(x => !string.IsNullOrEmpty(x.ClientEmail));

        RuleFor(x => x.ClientPhone)
            .MaximumLength(20).WithMessage("Phone number cannot exceed 20 characters")
            .When(x => !string.IsNullOrEmpty(x.ClientPhone));

        // Date validation
        RuleFor(x => x.EstimatedCompletionDate)
            .GreaterThan(x => x.StartDate)
            .When(x => x.StartDate.HasValue && x.EstimatedCompletionDate.HasValue)
            .WithMessage("Estimated completion date must be after start date");

        RuleFor(x => x.Phases)
            .Must(phases => phases is null || phases.Count <= 200)
            .WithMessage("Project cannot have more than 200 phases on create");

        RuleForEach(x => x.Phases).ChildRules(phase =>
        {
            phase.RuleFor(p => p.Name)
                .NotEmpty().WithMessage("Phase name is required")
                .MaximumLength(200).WithMessage("Phase name cannot exceed 200 characters");
            phase.RuleFor(p => p.CostCode)
                .NotEmpty().WithMessage("Phase cost code is required")
                .MaximumLength(50).WithMessage("Phase cost code cannot exceed 50 characters");
            phase.RuleFor(p => p.BudgetAmount)
                .GreaterThanOrEqualTo(0).WithMessage("Phase budget cannot be negative")
                .LessThanOrEqualTo(1_000_000_000m).WithMessage("Phase budget cannot exceed 1,000,000,000");
        }).When(x => x.Phases is { Count: > 0 });

        RuleFor(x => x.TeamMembers)
            .Must(team => team is null || team.Count <= 200)
            .WithMessage("Project cannot have more than 200 team members on create");

        RuleForEach(x => x.TeamMembers).ChildRules(member =>
        {
            member.RuleFor(m => m.EmployeeId)
                .NotEmpty().WithMessage("Team member employee ID is required");
            member.RuleFor(m => m.Role)
                .MaximumLength(100).WithMessage("Team member role cannot exceed 100 characters")
                .When(m => !string.IsNullOrEmpty(m.Role));
            member.RuleFor(m => m.AssignmentRole)
                .IsInEnum().WithMessage("Invalid assignment role");
        }).When(x => x.TeamMembers is { Count: > 0 });
    }
}
