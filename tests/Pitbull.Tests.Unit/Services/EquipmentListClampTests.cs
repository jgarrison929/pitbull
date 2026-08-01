using FluentAssertions;
using FluentValidation.TestHelper;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Core.Features.Equipment;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Services;

public sealed class EquipmentListClampTests
{
    [Fact]
    public async Task List_ClampsPageSizeTo100()
    {
        using var db = TestDbContextFactory.Create();
        var service = new EquipmentService(
            db,
            new CreateEquipmentValidator(),
            new UpdateEquipmentValidator(),
            NullLogger<EquipmentService>.Instance);

        var result = await service.ListEquipmentAsync(new ListEquipmentQuery(Page: 1, PageSize: 500));

        result.IsSuccess.Should().BeTrue();
        result.Value!.PageSize.Should().Be(100);
    }

    [Fact]
    public void Create_RejectsHourlyRateOverMax()
    {
        var validator = new CreateEquipmentValidator();
        var command = new CreateEquipmentCommand(
            Code: "EX-1",
            Name: "Excavator",
            HourlyRate: 1_000_000.01m);

        var result = validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.HourlyRate);
    }

    [Fact]
    public void Create_RejectsNegativeHourlyRateWithNegativeMessage()
    {
        var validator = new CreateEquipmentValidator();
        var command = new CreateEquipmentCommand(
            Code: "EX-1",
            Name: "Excavator",
            HourlyRate: -1m);

        var result = validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.HourlyRate)
            .WithErrorMessage("Hourly rate cannot be negative");
    }
}
