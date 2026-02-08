using FluentValidation;

namespace Pitbull.HR.Features.UpdateEmployee;

/// <summary>
/// Validator for UpdateEmployeeCommand.
/// </summary>
public class UpdateEmployeeValidator : AbstractValidator<UpdateEmployeeCommand>
{
    public UpdateEmployeeValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Employee ID is required");

        // Required name fields
        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("First name is required")
            .MaximumLength(100).WithMessage("First name cannot exceed 100 characters");

        RuleFor(x => x.LastName)
            .NotEmpty().WithMessage("Last name is required")
            .MaximumLength(100).WithMessage("Last name cannot exceed 100 characters");

        RuleFor(x => x.MiddleName)
            .MaximumLength(100).WithMessage("Middle name cannot exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.MiddleName));

        RuleFor(x => x.PreferredName)
            .MaximumLength(100).WithMessage("Preferred name cannot exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.PreferredName));

        RuleFor(x => x.Suffix)
            .MaximumLength(20).WithMessage("Suffix cannot exceed 20 characters")
            .When(x => !string.IsNullOrEmpty(x.Suffix));

        // Contact validation
        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("Invalid email format")
            .MaximumLength(256).WithMessage("Email cannot exceed 256 characters")
            .When(x => !string.IsNullOrEmpty(x.Email));

        RuleFor(x => x.PersonalEmail)
            .EmailAddress().WithMessage("Invalid personal email format")
            .MaximumLength(256).WithMessage("Personal email cannot exceed 256 characters")
            .When(x => !string.IsNullOrEmpty(x.PersonalEmail));

        RuleFor(x => x.Phone)
            .MaximumLength(20).WithMessage("Phone number cannot exceed 20 characters")
            .Matches(@"^\+?[\d\s\-\(\)]+$").WithMessage("Invalid phone number format")
            .When(x => !string.IsNullOrEmpty(x.Phone));

        RuleFor(x => x.SecondaryPhone)
            .MaximumLength(20).WithMessage("Secondary phone cannot exceed 20 characters")
            .Matches(@"^\+?[\d\s\-\(\)]+$").WithMessage("Invalid phone number format")
            .When(x => !string.IsNullOrEmpty(x.SecondaryPhone));

        // Address validation
        RuleFor(x => x.AddressLine1)
            .MaximumLength(200).WithMessage("Address line 1 cannot exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.AddressLine1));

        RuleFor(x => x.AddressLine2)
            .MaximumLength(200).WithMessage("Address line 2 cannot exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.AddressLine2));

        RuleFor(x => x.City)
            .MaximumLength(100).WithMessage("City cannot exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.City));

        RuleFor(x => x.State)
            .MaximumLength(2).WithMessage("State must be 2-letter code")
            .Matches(@"^[A-Z]{2}$").WithMessage("State must be valid 2-letter state code")
            .When(x => !string.IsNullOrEmpty(x.State));

        RuleFor(x => x.ZipCode)
            .MaximumLength(10).WithMessage("Zip code cannot exceed 10 characters")
            .Matches(@"^\d{5}(-\d{4})?$").WithMessage("Invalid zip code format")
            .When(x => !string.IsNullOrEmpty(x.ZipCode));

        RuleFor(x => x.Country)
            .MaximumLength(2).WithMessage("Country must be 2-letter code")
            .When(x => !string.IsNullOrEmpty(x.Country));

        // Classification validation
        RuleFor(x => x.WorkerType)
            .IsInEnum().WithMessage("Invalid worker type")
            .When(x => x.WorkerType.HasValue);

        RuleFor(x => x.FLSAStatus)
            .IsInEnum().WithMessage("Invalid FLSA status")
            .When(x => x.FLSAStatus.HasValue);

        RuleFor(x => x.EmploymentType)
            .IsInEnum().WithMessage("Invalid employment type")
            .When(x => x.EmploymentType.HasValue);

        RuleFor(x => x.JobTitle)
            .MaximumLength(200).WithMessage("Job title cannot exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.JobTitle));

        RuleFor(x => x.TradeCode)
            .MaximumLength(50).WithMessage("Trade code cannot exceed 50 characters")
            .When(x => !string.IsNullOrEmpty(x.TradeCode));

        RuleFor(x => x.WorkersCompClassCode)
            .MaximumLength(10).WithMessage("Workers comp class code cannot exceed 10 characters")
            .When(x => !string.IsNullOrEmpty(x.WorkersCompClassCode));

        // Tax validation
        RuleFor(x => x.HomeState)
            .MaximumLength(2).WithMessage("Home state must be 2-letter code")
            .Matches(@"^[A-Z]{2}$").WithMessage("Home state must be valid 2-letter state code")
            .When(x => !string.IsNullOrEmpty(x.HomeState));

        RuleFor(x => x.SUIState)
            .MaximumLength(2).WithMessage("SUI state must be 2-letter code")
            .Matches(@"^[A-Z]{2}$").WithMessage("SUI state must be valid 2-letter state code")
            .When(x => !string.IsNullOrEmpty(x.SUIState));

        // Payroll validation
        RuleFor(x => x.PayFrequency)
            .IsInEnum().WithMessage("Invalid pay frequency")
            .When(x => x.PayFrequency.HasValue);

        RuleFor(x => x.DefaultPayType)
            .IsInEnum().WithMessage("Invalid pay type")
            .When(x => x.DefaultPayType.HasValue);

        RuleFor(x => x.DefaultHourlyRate)
            .GreaterThan(0).WithMessage("Default hourly rate must be greater than zero")
            .LessThanOrEqualTo(1000).WithMessage("Default hourly rate seems unreasonably high")
            .When(x => x.DefaultHourlyRate.HasValue);

        RuleFor(x => x.PaymentMethod)
            .IsInEnum().WithMessage("Invalid payment method")
            .When(x => x.PaymentMethod.HasValue);

        // Notes validation
        RuleFor(x => x.Notes)
            .MaximumLength(4000).WithMessage("Notes cannot exceed 4000 characters")
            .When(x => !string.IsNullOrEmpty(x.Notes));
    }
}
