using FluentValidation;

namespace Pitbull.Core.Features.Equipment;

public class CreateEquipmentValidator : AbstractValidator<CreateEquipmentCommand>
{
    public CreateEquipmentValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("Code is required")
            .MaximumLength(50).WithMessage("Code cannot exceed 50 characters");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required")
            .MaximumLength(200).WithMessage("Name cannot exceed 200 characters");

        RuleFor(x => x.Description)
            .MaximumLength(500).WithMessage("Description cannot exceed 500 characters")
            .When(x => !string.IsNullOrEmpty(x.Description));

        RuleFor(x => x.Type)
            .IsInEnum().WithMessage("Invalid equipment type");

        RuleFor(x => x.HourlyRate)
            .GreaterThanOrEqualTo(0).WithMessage("Hourly rate cannot be negative");

        RuleFor(x => x.BillingRate)
            .GreaterThanOrEqualTo(0).WithMessage("Billing rate cannot be negative")
            .When(x => x.BillingRate.HasValue);

        RuleFor(x => x.SerialNumber)
            .MaximumLength(100).WithMessage("Serial number cannot exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.SerialNumber));

        RuleFor(x => x.LicensePlate)
            .MaximumLength(50).WithMessage("License plate cannot exceed 50 characters")
            .When(x => !string.IsNullOrEmpty(x.LicensePlate));
    }
}

public class UpdateEquipmentValidator : AbstractValidator<UpdateEquipmentCommand>
{
    public UpdateEquipmentValidator()
    {
        RuleFor(x => x.EquipmentId)
            .NotEmpty().WithMessage("Equipment ID is required");

        RuleFor(x => x.Code)
            .MaximumLength(50).WithMessage("Code cannot exceed 50 characters")
            .When(x => !string.IsNullOrEmpty(x.Code));

        RuleFor(x => x.Name)
            .MaximumLength(200).WithMessage("Name cannot exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.Name));

        RuleFor(x => x.Description)
            .MaximumLength(500).WithMessage("Description cannot exceed 500 characters")
            .When(x => x.Description != null);

        RuleFor(x => x.Type)
            .IsInEnum().WithMessage("Invalid equipment type")
            .When(x => x.Type.HasValue);

        RuleFor(x => x.HourlyRate)
            .GreaterThanOrEqualTo(0).WithMessage("Hourly rate cannot be negative")
            .When(x => x.HourlyRate.HasValue);

        RuleFor(x => x.BillingRate)
            .GreaterThanOrEqualTo(0).WithMessage("Billing rate cannot be negative")
            .When(x => x.BillingRate.HasValue);

        RuleFor(x => x.SerialNumber)
            .MaximumLength(100).WithMessage("Serial number cannot exceed 100 characters")
            .When(x => x.SerialNumber != null);

        RuleFor(x => x.LicensePlate)
            .MaximumLength(50).WithMessage("License plate cannot exceed 50 characters")
            .When(x => x.LicensePlate != null);
    }
}
