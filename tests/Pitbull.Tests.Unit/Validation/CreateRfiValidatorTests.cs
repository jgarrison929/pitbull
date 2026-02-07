using FluentValidation.TestHelper;
using Pitbull.RFIs.Domain;
using Pitbull.RFIs.Features.CreateRfi;

namespace Pitbull.Tests.Unit.Validation;

public sealed class CreateRfiValidatorTests
{
    private readonly CreateRfiValidator _validator = new();

    private static CreateRfiCommand CreateValidCommand(
        Guid? projectId = null,
        string subject = "Test Subject",
        string question = "What is the answer?",
        RfiPriority priority = RfiPriority.Normal,
        DateTime? dueDate = null,
        Guid? assignedToUserId = null,
        string? assignedToName = null,
        Guid? ballInCourtUserId = null,
        string? ballInCourtName = null,
        string? createdByName = null)
    {
        return new CreateRfiCommand(
            ProjectId: projectId ?? Guid.NewGuid(),
            Subject: subject,
            Question: question,
            Priority: priority,
            DueDate: dueDate,
            AssignedToUserId: assignedToUserId,
            AssignedToName: assignedToName,
            BallInCourtUserId: ballInCourtUserId,
            BallInCourtName: ballInCourtName,
            CreatedByName: createdByName
        );
    }

    [Fact]
    public void Validate_WithValidCommand_ShouldNotHaveErrors()
    {
        var command = CreateValidCommand();
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    // ProjectId Tests
    [Fact]
    public void Validate_ProjectIdEmpty_ShouldHaveError()
    {
        var command = CreateValidCommand(projectId: Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ProjectId)
            .WithErrorMessage("Project ID is required");
    }

    // Subject Tests
    [Fact]
    public void Validate_SubjectEmpty_ShouldHaveError()
    {
        var command = CreateValidCommand(subject: "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Subject)
            .WithErrorMessage("Subject is required");
    }

    [Fact]
    public void Validate_SubjectNull_ShouldHaveError()
    {
        var command = CreateValidCommand(subject: null!);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Subject);
    }

    [Fact]
    public void Validate_SubjectExceedsMaxLength_ShouldHaveError()
    {
        var command = CreateValidCommand(subject: new string('a', 501));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Subject)
            .WithErrorMessage("Subject cannot exceed 500 characters");
    }

    [Fact]
    public void Validate_SubjectAtMaxLength_ShouldNotHaveError()
    {
        var command = CreateValidCommand(subject: new string('a', 500));
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Subject);
    }

    // Question Tests
    [Fact]
    public void Validate_QuestionEmpty_ShouldHaveError()
    {
        var command = CreateValidCommand(question: "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Question)
            .WithErrorMessage("Question is required");
    }

    [Fact]
    public void Validate_QuestionNull_ShouldHaveError()
    {
        var command = CreateValidCommand(question: null!);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Question);
    }

    [Fact]
    public void Validate_QuestionExceedsMaxLength_ShouldHaveError()
    {
        var command = CreateValidCommand(question: new string('a', 5001));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Question)
            .WithErrorMessage("Question cannot exceed 5000 characters");
    }

    [Fact]
    public void Validate_QuestionAtMaxLength_ShouldNotHaveError()
    {
        var command = CreateValidCommand(question: new string('a', 5000));
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Question);
    }

    // Priority Tests
    [Fact]
    public void Validate_PriorityInvalidValue_ShouldHaveError()
    {
        var command = CreateValidCommand(priority: (RfiPriority)99);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Priority)
            .WithErrorMessage("Invalid priority value");
    }

    [Theory]
    [InlineData(RfiPriority.Low)]
    [InlineData(RfiPriority.Normal)]
    [InlineData(RfiPriority.High)]
    [InlineData(RfiPriority.Urgent)]
    public void Validate_PriorityValidValues_ShouldNotHaveError(RfiPriority priority)
    {
        var command = CreateValidCommand(priority: priority);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Priority);
    }

    // AssignedToName Tests
    [Fact]
    public void Validate_AssignedToNameExceedsMaxLength_ShouldHaveError()
    {
        var command = CreateValidCommand(assignedToName: new string('a', 201));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.AssignedToName)
            .WithErrorMessage("Assigned to name cannot exceed 200 characters");
    }

    [Fact]
    public void Validate_AssignedToNameAtMaxLength_ShouldNotHaveError()
    {
        var command = CreateValidCommand(assignedToName: new string('a', 200));
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.AssignedToName);
    }

    [Fact]
    public void Validate_AssignedToNameNull_ShouldNotHaveError()
    {
        var command = CreateValidCommand(assignedToName: null);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.AssignedToName);
    }

    // Optional Fields Tests
    [Fact]
    public void Validate_AllOptionalFieldsProvided_ShouldNotHaveErrors()
    {
        var command = CreateValidCommand(
            dueDate: DateTime.UtcNow.AddDays(7),
            assignedToUserId: Guid.NewGuid(),
            assignedToName: "John Doe",
            ballInCourtUserId: Guid.NewGuid(),
            ballInCourtName: "Jane Smith",
            createdByName: "Admin User"
        );
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }
}
