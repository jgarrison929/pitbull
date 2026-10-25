using FluentValidation.TestHelper;
using Pitbull.Bids.Features.ConvertBidToProject;

namespace Pitbull.Tests.Unit.Validation;

public sealed class ConvertBidToProjectValidatorTests
{
    private readonly ConvertBidToProjectValidator _validator = new();

    private static ConvertBidToProjectCommand CreateValidCommand(
        Guid? bidId = null,
        string? projectNumber = "PRJ-001")
    {
        return new ConvertBidToProjectCommand(
            BidId: bidId ?? Guid.NewGuid(),
            ProjectNumber: projectNumber ?? "PRJ-001"
        );
    }

    [Fact]
    public void Validate_WithValidCommand_ShouldNotHaveErrors()
    {
        var command = CreateValidCommand();
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WithEmptyBidId_ShouldHaveError()
    {
        var command = CreateValidCommand(bidId: Guid.Empty);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.BidId)
            .WithErrorMessage("Bid ID is required");
    }

    [Fact]
    public void Validate_WithEmptyProjectNumber_ShouldHaveError()
    {
        var command = CreateValidCommand(projectNumber: "");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ProjectNumber)
            .WithErrorMessage("Project number is required");
    }

    [Fact]
    public void Validate_WithValidProjectNumber_ShouldNotHaveError()
    {
        var command = CreateValidCommand(projectNumber: "PRJ-2026-001");
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.ProjectNumber);
    }

    [Fact]
    public void Validate_WithProjectNumberTooLong_ShouldHaveError()
    {
        var command = CreateValidCommand(projectNumber: new string('A', 51));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ProjectNumber);
    }

    [Fact]
    public void Validate_WithProjectNumberAtMaxLength_ShouldNotHaveError()
    {
        var command = CreateValidCommand(projectNumber: new string('A', 50));
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.ProjectNumber);
    }

    [Fact]
    public void Validate_WithWhitespaceProjectNumber_ShouldHaveError()
    {
        var command = CreateValidCommand(projectNumber: "   ");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ProjectNumber)
            .WithErrorMessage("Project number is required");
    }
}
