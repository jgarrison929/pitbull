using FluentValidation.TestHelper;
using Pitbull.HR.Domain;
using Pitbull.HR.Features.CreatePayRate;

namespace Pitbull.Tests.Unit.HR;

public sealed class CreatePayRateValidatorTests
{
    private readonly CreatePayRateValidator _validator = new();

    private static CreatePayRateCommand CreateValidCommand(
        Guid? employeeId = null,
        string? description = "Standard hourly rate",
        RateType rateType = RateType.Hourly,
        decimal amount = 35.00m,
        string? currency = "USD",
        DateOnly? effectiveDate = null,
        DateOnly? expirationDate = null,
        Guid? projectId = null,
        string? shiftCode = null,
        string? workState = null,
        int? priority = null,
        bool includesFringe = false,
        decimal? fringeRate = null,
        decimal? healthWelfareRate = null,
        decimal? pensionRate = null,
        decimal? trainingRate = null,
        decimal? otherFringeRate = null,
        RateSource? source = null,
        string? notes = null)
    {
        return new CreatePayRateCommand(
            EmployeeId: employeeId ?? Guid.NewGuid(),
            Description: description,
            RateType: rateType,
            Amount: amount,
            Currency: currency,
            EffectiveDate: effectiveDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
            ExpirationDate: expirationDate,
            ProjectId: projectId,
            ShiftCode: shiftCode,
            WorkState: workState,
            Priority: priority,
            IncludesFringe: includesFringe,
            FringeRate: fringeRate,
            HealthWelfareRate: healthWelfareRate,
            PensionRate: pensionRate,
            TrainingRate: trainingRate,
            OtherFringeRate: otherFringeRate,
            Source: source,
            Notes: notes
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
    public void Validate_ZeroAmount_FailsWithMessage()
    {
        var command = CreateValidCommand(amount: 0);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Amount)
            .WithErrorMessage("Amount must be greater than zero");
    }

    [Fact]
    public void Validate_NegativeAmount_FailsWithMessage()
    {
        var command = CreateValidCommand(amount: -10m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Amount)
            .WithErrorMessage("Amount must be greater than zero");
    }

    [Fact]
    public void Validate_AmountTooHigh_FailsWithMessage()
    {
        var command = CreateValidCommand(amount: 15000m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Amount)
            .WithErrorMessage("Amount cannot exceed $10,000/hour");
    }

    [Fact]
    public void Validate_InvalidCurrency_FailsWithMessage()
    {
        var command = CreateValidCommand(currency: "usd");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Currency)
            .WithErrorMessage("Currency must be uppercase (e.g., USD)");
    }

    [Fact]
    public void Validate_CurrencyTooLong_FailsWithMessage()
    {
        var command = CreateValidCommand(currency: "USDD");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Currency)
            .WithErrorMessage("Currency must be a 3-character code");
    }

    [Fact]
    public void Validate_ExpirationBeforeEffective_FailsWithMessage()
    {
        var effectiveDate = DateOnly.FromDateTime(DateTime.UtcNow);
        var expirationDate = effectiveDate.AddDays(-1);
        var command = CreateValidCommand(effectiveDate: effectiveDate, expirationDate: expirationDate);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ExpirationDate)
            .WithErrorMessage("Expiration date must be after effective date");
    }

    [Fact]
    public void Validate_DescriptionTooLong_FailsWithMessage()
    {
        var command = CreateValidCommand(description: new string('X', 201));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Description)
            .WithErrorMessage("Description cannot exceed 200 characters");
    }

    [Fact]
    public void Validate_ShiftCodeTooLong_FailsWithMessage()
    {
        var command = CreateValidCommand(shiftCode: new string('X', 11));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ShiftCode)
            .WithErrorMessage("Shift code cannot exceed 10 characters");
    }

    [Fact]
    public void Validate_InvalidWorkState_FailsWithMessage()
    {
        var command = CreateValidCommand(workState: "ca");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.WorkState)
            .WithErrorMessage("Work state must be uppercase (e.g., CA)");
    }

    [Fact]
    public void Validate_WorkStateTooLong_FailsWithMessage()
    {
        var command = CreateValidCommand(workState: "CAL");
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.WorkState)
            .WithErrorMessage("Work state must be a 2-character code");
    }

    [Fact]
    public void Validate_PriorityOutOfRange_FailsWithMessage()
    {
        var command = CreateValidCommand(priority: 0);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Priority)
            .WithErrorMessage("Priority must be between 1 and 100");
    }

    [Fact]
    public void Validate_PriorityTooHigh_FailsWithMessage()
    {
        var command = CreateValidCommand(priority: 101);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Priority)
            .WithErrorMessage("Priority must be between 1 and 100");
    }

    [Fact]
    public void Validate_NegativeFringeRate_FailsWithMessage()
    {
        var command = CreateValidCommand(fringeRate: -1m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.FringeRate)
            .WithErrorMessage("Fringe rate cannot be negative");
    }

    [Fact]
    public void Validate_NegativeHealthWelfareRate_FailsWithMessage()
    {
        var command = CreateValidCommand(healthWelfareRate: -1m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.HealthWelfareRate)
            .WithErrorMessage("Health & welfare rate cannot be negative");
    }

    [Fact]
    public void Validate_NegativePensionRate_FailsWithMessage()
    {
        var command = CreateValidCommand(pensionRate: -1m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.PensionRate)
            .WithErrorMessage("Pension rate cannot be negative");
    }

    [Fact]
    public void Validate_NegativeTrainingRate_FailsWithMessage()
    {
        var command = CreateValidCommand(trainingRate: -1m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.TrainingRate)
            .WithErrorMessage("Training rate cannot be negative");
    }

    [Fact]
    public void Validate_NegativeOtherFringeRate_FailsWithMessage()
    {
        var command = CreateValidCommand(otherFringeRate: -1m);
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.OtherFringeRate)
            .WithErrorMessage("Other fringe rate cannot be negative");
    }

    [Fact]
    public void Validate_NotesTooLong_FailsWithMessage()
    {
        var command = CreateValidCommand(notes: new string('X', 1001));
        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Notes)
            .WithErrorMessage("Notes cannot exceed 1000 characters");
    }

    [Fact]
    public void Validate_ValidFringeRates_Passes()
    {
        var command = CreateValidCommand(
            includesFringe: true,
            fringeRate: 5.00m,
            healthWelfareRate: 8.50m,
            pensionRate: 6.25m,
            trainingRate: 0.75m,
            otherFringeRate: 1.00m
        );
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_ValidWorkStateAndShift_Passes()
    {
        var command = CreateValidCommand(
            workState: "CA",
            shiftCode: "SWING",
            priority: 50
        );
        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_AllRateTypes_Passes()
    {
        foreach (RateType rateType in Enum.GetValues<RateType>())
        {
            var command = CreateValidCommand(rateType: rateType);
            var result = _validator.TestValidate(command);
            result.ShouldNotHaveValidationErrorFor(x => x.RateType);
        }
    }
}
