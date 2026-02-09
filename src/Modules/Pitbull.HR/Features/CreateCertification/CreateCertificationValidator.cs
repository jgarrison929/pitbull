using FluentValidation;

namespace Pitbull.HR.Features.CreateCertification;

public class CreateCertificationValidator : AbstractValidator<CreateCertificationCommand>
{
    public CreateCertificationValidator()
    {
        RuleFor(x => x.EmployeeId)
            .NotEmpty().WithMessage("Employee ID is required");

        RuleFor(x => x.CertificationTypeCode)
            .NotEmpty().WithMessage("Certification type code is required")
            .MaximumLength(50).WithMessage("Certification type code cannot exceed 50 characters");

        RuleFor(x => x.CertificationName)
            .NotEmpty().WithMessage("Certification name is required")
            .MaximumLength(200).WithMessage("Certification name cannot exceed 200 characters");

        RuleFor(x => x.CertificateNumber)
            .MaximumLength(100).WithMessage("Certificate number cannot exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.CertificateNumber));

        RuleFor(x => x.IssuingAuthority)
            .MaximumLength(200).WithMessage("Issuing authority cannot exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.IssuingAuthority));

        RuleFor(x => x.IssueDate)
            .NotEmpty().WithMessage("Issue date is required")
            .LessThanOrEqualTo(DateOnly.FromDateTime(DateTime.UtcNow))
            .WithMessage("Issue date cannot be in the future");

        RuleFor(x => x.ExpirationDate)
            .GreaterThan(x => x.IssueDate)
            .WithMessage("Expiration date must be after issue date")
            .When(x => x.ExpirationDate.HasValue);
    }
}
