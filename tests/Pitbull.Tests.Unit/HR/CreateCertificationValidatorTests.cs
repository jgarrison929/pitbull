using FluentValidation.TestHelper;
using Pitbull.HR.Features.CreateCertification;

namespace Pitbull.Tests.Unit.HR;

public sealed class CreateCertificationValidatorTests
{
    private readonly CreateCertificationValidator _validator = new();

    private static CreateCertificationCommand CreateValidCommand(
        Guid? employeeId = null,
        string certificationTypeCode = "OSHA10",
        string certificationName = "OSHA 10-Hour Safety",
        string? certificateNumber = "CERT-12345",
        string? issuingAuthority = "OSHA",
        DateOnly? issueDate = null,
        DateOnly? expirationDate = null)
    {
        return new CreateCertificationCommand(
            EmployeeId: employeeId ?? Guid.NewGuid(),
            CertificationTypeCode: certificationTypeCode,
            CertificationName: certificationName,
            CertificateNumber: certificateNumber,
            IssuingAuthority: issuingAuthority,
            IssueDate: issueDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)),
            ExpirationDate: expirationDate
        );
    }

    [Fact]
    public void Validate_ValidCommand_Passes()
    {
        var command = CreateValidCommand();
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_EmptyEmployeeId_FailsWithMessage()
    {
        var command = CreateValidCommand(employeeId: Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.EmployeeId)
            .WithErrorMessage("Employee ID is required");
    }

    [Fact]
    public void Validate_EmptyCertificationTypeCode_FailsWithMessage()
    {
        var command = CreateValidCommand(certificationTypeCode: "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.CertificationTypeCode)
            .WithErrorMessage("Certification type code is required");
    }

    [Fact]
    public void Validate_CertificationTypeCodeTooLong_FailsWithMessage()
    {
        var command = CreateValidCommand(certificationTypeCode: new string('X', 51));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.CertificationTypeCode)
            .WithErrorMessage("Certification type code cannot exceed 50 characters");
    }

    [Fact]
    public void Validate_EmptyCertificationName_FailsWithMessage()
    {
        var command = CreateValidCommand(certificationName: "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.CertificationName)
            .WithErrorMessage("Certification name is required");
    }

    [Fact]
    public void Validate_CertificationNameTooLong_FailsWithMessage()
    {
        var command = CreateValidCommand(certificationName: new string('X', 201));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.CertificationName)
            .WithErrorMessage("Certification name cannot exceed 200 characters");
    }

    [Fact]
    public void Validate_CertificateNumberTooLong_FailsWithMessage()
    {
        var command = CreateValidCommand(certificateNumber: new string('X', 101));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.CertificateNumber)
            .WithErrorMessage("Certificate number cannot exceed 100 characters");
    }

    [Fact]
    public void Validate_IssuingAuthorityTooLong_FailsWithMessage()
    {
        var command = CreateValidCommand(issuingAuthority: new string('X', 201));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.IssuingAuthority)
            .WithErrorMessage("Issuing authority cannot exceed 200 characters");
    }

    [Fact]
    public void Validate_FutureIssueDate_FailsWithMessage()
    {
        var command = CreateValidCommand(issueDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.IssueDate)
            .WithErrorMessage("Issue date cannot be in the future");
    }

    [Fact]
    public void Validate_ExpirationDateBeforeIssueDate_FailsWithMessage()
    {
        var issueDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30));
        var expirationDate = issueDate.AddDays(-1);
        var command = CreateValidCommand(issueDate: issueDate, expirationDate: expirationDate);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ExpirationDate)
            .WithErrorMessage("Expiration date must be after issue date");
    }

    [Fact]
    public void Validate_ValidExpirationDate_Passes()
    {
        var issueDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30));
        var expirationDate = issueDate.AddYears(1);
        var command = CreateValidCommand(issueDate: issueDate, expirationDate: expirationDate);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.ExpirationDate);
    }

    [Fact]
    public void Validate_NullExpirationDate_Passes()
    {
        var command = CreateValidCommand(expirationDate: null);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.ExpirationDate);
    }

    [Fact]
    public void Validate_NullOptionalFields_Passes()
    {
        var command = CreateValidCommand(certificateNumber: null, issuingAuthority: null);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }
}
