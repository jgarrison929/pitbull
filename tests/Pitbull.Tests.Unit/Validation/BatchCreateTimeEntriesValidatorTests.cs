using FluentAssertions;
using Pitbull.TimeTracking.Features.BatchCreateTimeEntries;

namespace Pitbull.Tests.Unit.Validation;

public sealed class BatchCreateTimeEntriesValidatorTests
{
    private readonly BatchCreateTimeEntriesValidator _validator = new();

    [Fact]
    public void Validate_NegativeEquipmentHours_ReturnsValidationError()
    {
        var command = CreateCommand(new BatchTimeEntryItem(
            DateOnly.FromDateTime(DateTime.UtcNow),
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            8m,
            EquipmentHours: -1m));

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage.Contains("Equipment hours cannot be negative"));
    }

    [Fact]
    public void Validate_EquipmentHoursWithoutEquipmentId_ReturnsValidationError()
    {
        var command = CreateCommand(new BatchTimeEntryItem(
            DateOnly.FromDateTime(DateTime.UtcNow),
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            8m,
            EquipmentHours: 2m));

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage.Contains("Equipment ID is required"));
    }

    [Fact]
    public void Validate_EquipmentIdWithoutEquipmentHours_ReturnsValidationError()
    {
        var command = CreateCommand(new BatchTimeEntryItem(
            DateOnly.FromDateTime(DateTime.UtcNow),
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            8m,
            EquipmentId: Guid.NewGuid(),
            EquipmentHours: 0m));

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage.Contains("Equipment hours must be greater than zero"));
    }

    private static BatchCreateTimeEntriesCommand CreateCommand(BatchTimeEntryItem entry)
    {
        return new BatchCreateTimeEntriesCommand([entry], IsDraft: false);
    }
}
