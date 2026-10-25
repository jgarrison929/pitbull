using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Core.Domain;
using Pitbull.Core.Features.Equipment;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Services;

public sealed class EquipmentServiceTests
{
    #region Create Equipment Tests

    [Fact]
    public async Task CreateEquipmentAsync_WithValidCommand_ReturnsSuccess()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var command = new CreateEquipmentCommand(
            Code: "EX-001",
            Name: "CAT 320 Excavator",
            Description: "Heavy excavator for earthwork",
            Type: EquipmentType.HeavyEquipment,
            HourlyRate: 150m,
            BillingRate: 185m,
            IsActive: true,
            SerialNumber: "CAT0320001"
        );

        // Act
        var result = await service.CreateEquipmentAsync(command);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Code.Should().Be("EX-001");
        result.Value.Name.Should().Be("CAT 320 Excavator");
        result.Value.Type.Should().Be(EquipmentType.HeavyEquipment);
        result.Value.HourlyRate.Should().Be(150m);
        result.Value.BillingRate.Should().Be(185m);
    }

    [Fact]
    public async Task CreateEquipmentAsync_WithDuplicateCode_ReturnsError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        // Create first equipment
        var command1 = new CreateEquipmentCommand(Code: "EX-001", Name: "First Excavator");
        await service.CreateEquipmentAsync(command1);

        // Try to create second with same code
        var command2 = new CreateEquipmentCommand(Code: "EX-001", Name: "Second Excavator");

        // Act
        var result = await service.CreateEquipmentAsync(command2);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("DUPLICATE_CODE");
        result.Error.Should().Contain("EX-001");
    }

    #endregion

    #region Get Equipment Tests

    [Fact]
    public async Task GetEquipmentAsync_WhenExists_ReturnsEquipment()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var createResult = await service.CreateEquipmentAsync(
            new CreateEquipmentCommand(Code: "EX-001", Name: "Test Excavator")
        );

        // Act
        var result = await service.GetEquipmentAsync(createResult.Value!.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Code.Should().Be("EX-001");
    }

    [Fact]
    public async Task GetEquipmentAsync_WhenNotExists_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        // Act
        var result = await service.GetEquipmentAsync(Guid.NewGuid());

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region List Equipment Tests

    [Fact]
    public async Task ListEquipmentAsync_ReturnsAllEquipment()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        await service.CreateEquipmentAsync(new CreateEquipmentCommand(Code: "EX-001", Name: "Excavator 1"));
        await service.CreateEquipmentAsync(new CreateEquipmentCommand(Code: "EX-002", Name: "Excavator 2"));
        await service.CreateEquipmentAsync(new CreateEquipmentCommand(Code: "LR-001", Name: "Loader 1"));

        // Act
        var result = await service.ListEquipmentAsync(new ListEquipmentQuery());

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(3);
        result.Value.Items.Should().HaveCount(3);
    }

    [Fact]
    public async Task ListEquipmentAsync_WithActiveFilter_ReturnsOnlyActiveEquipment()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        await service.CreateEquipmentAsync(new CreateEquipmentCommand(Code: "EX-001", Name: "Active Excavator", IsActive: true));
        await service.CreateEquipmentAsync(new CreateEquipmentCommand(Code: "EX-002", Name: "Inactive Excavator", IsActive: false));

        // Act
        var result = await service.ListEquipmentAsync(new ListEquipmentQuery(IsActive: true));

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
        result.Value.Items.Should().OnlyContain(e => e.IsActive);
    }

    [Fact]
    public async Task ListEquipmentAsync_WithTypeFilter_ReturnsOnlyMatchingType()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        await service.CreateEquipmentAsync(new CreateEquipmentCommand(Code: "EX-001", Name: "Excavator", Type: EquipmentType.HeavyEquipment));
        await service.CreateEquipmentAsync(new CreateEquipmentCommand(Code: "TR-001", Name: "Truck", Type: EquipmentType.Vehicles));

        // Act
        var result = await service.ListEquipmentAsync(new ListEquipmentQuery(Type: EquipmentType.HeavyEquipment));

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
        result.Value.Items.Should().OnlyContain(e => e.Type == EquipmentType.HeavyEquipment);
    }

    [Fact]
    public async Task ListEquipmentAsync_WithSearchTerm_ReturnsMatchingEquipment()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        await service.CreateEquipmentAsync(new CreateEquipmentCommand(Code: "EX-001", Name: "CAT 320 Excavator"));
        await service.CreateEquipmentAsync(new CreateEquipmentCommand(Code: "LR-001", Name: "John Deere Loader"));

        // Act
        var result = await service.ListEquipmentAsync(new ListEquipmentQuery(SearchTerm: "CAT"));

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(1);
        result.Value.Items.Should().OnlyContain(e => e.Name.Contains("CAT"));
    }

    [Fact]
    public async Task ListEquipmentAsync_WithPagination_ReturnsCorrectPage()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        for (int i = 1; i <= 5; i++)
        {
            await service.CreateEquipmentAsync(new CreateEquipmentCommand(Code: $"EX-00{i}", Name: $"Excavator {i}"));
        }

        // Act
        var result = await service.ListEquipmentAsync(new ListEquipmentQuery(Page: 2, PageSize: 2));

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(5);
        result.Value.Items.Should().HaveCount(2);
        result.Value.Page.Should().Be(2);
        result.Value.TotalPages.Should().Be(3);
    }

    #endregion

    #region Update Equipment Tests

    [Fact]
    public async Task UpdateEquipmentAsync_WithValidCommand_ReturnsUpdatedEquipment()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var createResult = await service.CreateEquipmentAsync(
            new CreateEquipmentCommand(Code: "EX-001", Name: "Original Name")
        );
        var equipmentId = createResult.Value!.Id;

        // Act
        var result = await service.UpdateEquipmentAsync(
            new UpdateEquipmentCommand(EquipmentId: equipmentId, Name: "Updated Name", HourlyRate: 200m)
        );

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Name.Should().Be("Updated Name");
        result.Value.HourlyRate.Should().Be(200m);
        result.Value.Code.Should().Be("EX-001"); // Unchanged
    }

    [Fact]
    public async Task UpdateEquipmentAsync_WithDuplicateCode_ReturnsError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        await service.CreateEquipmentAsync(new CreateEquipmentCommand(Code: "EX-001", Name: "First"));
        var createResult = await service.CreateEquipmentAsync(new CreateEquipmentCommand(Code: "EX-002", Name: "Second"));

        // Act - Try to change EX-002 to EX-001
        var result = await service.UpdateEquipmentAsync(
            new UpdateEquipmentCommand(EquipmentId: createResult.Value!.Id, Code: "EX-001")
        );

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("DUPLICATE_CODE");
    }

    [Fact]
    public async Task UpdateEquipmentAsync_WhenNotExists_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        // Act
        var result = await service.UpdateEquipmentAsync(
            new UpdateEquipmentCommand(EquipmentId: Guid.NewGuid(), Name: "Test")
        );

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region Delete Equipment Tests

    [Fact]
    public async Task DeleteEquipmentAsync_WhenExists_ReturnsSuccess()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var createResult = await service.CreateEquipmentAsync(
            new CreateEquipmentCommand(Code: "EX-001", Name: "Test")
        );

        // Act
        var result = await service.DeleteEquipmentAsync(createResult.Value!.Id);

        // Assert
        result.IsSuccess.Should().BeTrue();

        // Verify it's marked as deleted (soft delete)
        // Note: In-memory DB doesn't apply query filters, so we verify IsDeleted directly
        var entity = await db.Set<Equipment>()
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(e => e.Id == createResult.Value.Id);
        entity.Should().NotBeNull();
        entity!.IsDeleted.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteEquipmentAsync_WhenNotExists_ReturnsNotFound()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        // Act
        var result = await service.DeleteEquipmentAsync(Guid.NewGuid());

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    #endregion

    #region Helper Methods

    private static EquipmentService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        return new EquipmentService(
            db,
            new CreateEquipmentValidator(),
            new UpdateEquipmentValidator(),
            NullLogger<EquipmentService>.Instance
        );
    }

    #endregion
}
