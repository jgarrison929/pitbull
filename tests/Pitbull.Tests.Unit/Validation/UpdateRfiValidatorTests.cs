using FluentValidation.TestHelper;
using Pitbull.RFIs.Domain;
using Pitbull.RFIs.Features.UpdateRfi;

namespace Pitbull.Tests.Unit.Validation;

public sealed class UpdateRfiValidatorTests
{
    private readonly UpdateRfiValidator _validator = new();

    private static UpdateRfiCommand CreateValidCommand(
        Guid? id = null,
        Guid? projectId = null,
        string subject = "Updated Subject",
        string question = "Updated question?",
        string? answer = null,
        RfiStatus status = RfiStatus.Open,
        RfiPriority priority = RfiPriority.Normal,
        DateTime? dueDate = null,
        Guid? assignedToUserId = null,
        string? assignedToName = null,
        Guid? ballInCourtUserId = null,
        string? ballInCourtName = null)
    {
        return new UpdateRfiCommand(
            Id: id ?? Guid.NewGuid(),
            ProjectId: projectId ?? Guid.NewGuid(),
            Subject: subject,
            Question: question,
            Answer: answer,
            Status: status,
            Priority: priority,
            DueDate: dueDate,
            AssignedToUserId: assignedToUserId,
            AssignedToName: assignedToName,
            BallInCourtUserId: ballInCourtUserId,
            BallInCourtName: ballInCourtName
        );
    }

    [Fact]
    public void Validate_WithValidCommand_ShouldNotHaveErrors()
    {
        var command = CreateValidCommand();
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    // Id Tests
    [Fact]
    public void Validate_IdEmpty_ShouldHaveError()
    {
        var command = CreateValidCommand(id: Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Id)
            .WithErrorMessage("RFI ID is required");
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

    // Answer Tests
    [Fact]
    public void Validate_AnswerExceedsMaxLength_ShouldHaveError()
    {
        var command = CreateValidCommand(answer: new string('a', 5001));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Answer)
            .WithErrorMessage("Answer cannot exceed 5000 characters");
    }

    [Fact]
    public void Validate_AnswerAtMaxLength_ShouldNotHaveError()
    {
        var command = CreateValidCommand(answer: new string('a', 5000));
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Answer);
    }

    [Fact]
    public void Validate_AnswerNull_ShouldNotHaveError()
    {
        var command = CreateValidCommand(answer: null);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Answer);
    }

    [Fact]
    public void Validate_AnswerEmpty_ShouldNotHaveError()
    {
        var command = CreateValidCommand(answer: "");
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Answer);
    }

    // Status Tests
    [Fact]
    public void Validate_StatusInvalidValue_ShouldHaveError()
    {
        var command = CreateValidCommand(status: (RfiStatus)99);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Status)
            .WithErrorMessage("Invalid status value");
    }

    [Theory]
    [InlineData(RfiStatus.Open)]
    [InlineData(RfiStatus.Answered)]
    [InlineData(RfiStatus.Closed)]
    public void Validate_StatusValidValues_ShouldNotHaveError(RfiStatus status)
    {
        var command = CreateValidCommand(status: status);
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.Status);
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

    // Complete RFI workflow test
    [Fact]
    public void Validate_AnsweredRfiWithAnswer_ShouldNotHaveErrors()
    {
        var command = CreateValidCommand(
            answer: "The clarification is as follows...",
            status: RfiStatus.Answered
        );
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_ClosedRfiWithAllFields_ShouldNotHaveErrors()
    {
        var command = CreateValidCommand(
            answer: "Final answer provided.",
            status: RfiStatus.Closed,
            dueDate: DateTime.UtcNow.AddDays(7),
            assignedToUserId: Guid.NewGuid(),
            assignedToName: "John Doe",
            ballInCourtUserId: Guid.NewGuid(),
            ballInCourtName: "Jane Smith"
        );
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }
}
