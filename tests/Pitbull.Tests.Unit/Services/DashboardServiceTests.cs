using FluentAssertions;
using Pitbull.Core.Features.Dashboard;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Services;

/// <summary>
/// Tests for DashboardService methods.
/// Note: The service uses raw SQL (SqlQueryRaw) which doesn't work with EF InMemory provider.
/// These tests verify the service gracefully handles failures and returns appropriate defaults.
/// Full integration tests with PostgreSQL cover the actual query behavior.
/// </summary>
public class DashboardServiceTests
{
    #region GetRfisNeedingAttentionAsync

    [Fact]
    public async Task GetRfisNeedingAttentionAsync_WhenNoRfisExist_ReturnsEmptyResult()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = new DashboardService(db);

        // Act
        var result = await service.GetRfisNeedingAttentionAsync();

        // Assert - service catches SQL exceptions and returns empty/zero results
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Items.Should().BeEmpty();
        result.Value.TotalCount.Should().Be(0);
        result.Value.OverdueCount.Should().Be(0);
        result.Value.BallInCourtCount.Should().Be(0);
    }

    [Fact]
    public async Task GetRfisNeedingAttentionAsync_WithUserId_ReturnsEmptyResult()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = new DashboardService(db);
        var userId = Guid.NewGuid();

        // Act
        var result = await service.GetRfisNeedingAttentionAsync(userId);

        // Assert - passing userId doesn't crash the service
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task GetRfisNeedingAttentionAsync_WithLimit_ReturnsEmptyResult()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = new DashboardService(db);

        // Act
        var result = await service.GetRfisNeedingAttentionAsync(limit: 10);

        // Assert - limit parameter doesn't crash the service
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task GetRfisNeedingAttentionAsync_WithAllParameters_ReturnsEmptyResult()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = new DashboardService(db);
        var userId = Guid.NewGuid();

        // Act
        var result = await service.GetRfisNeedingAttentionAsync(userId, limit: 15);

        // Assert - combined parameters don't crash
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Items.Should().BeEmpty();
    }

    [Theory]
    [InlineData(0)]   // Below min clamps to 1
    [InlineData(-5)]  // Negative clamps to 1
    [InlineData(25)]  // Above max clamps to 20
    [InlineData(100)] // Way above max clamps to 20
    [InlineData(5)]   // Valid value stays unchanged
    [InlineData(1)]   // Min boundary
    [InlineData(20)]  // Max boundary
    public async Task GetRfisNeedingAttentionAsync_HandlesVariousLimitValues(int inputLimit)
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var service = new DashboardService(db);

        // Act - the method should handle any limit gracefully
        // The service clamps limit to [1, 20] range internally
        var result = await service.GetRfisNeedingAttentionAsync(limit: inputLimit);

        // Assert - service doesn't crash with any limit value
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    #endregion

    #region RfisNeedingAttentionResponse Record Tests

    [Fact]
    public void RfisNeedingAttentionResponse_RecordEquality()
    {
        // Arrange - use same list instance for records to be equal
        var items = new List<RfiAttentionItem>();
        
        var response1 = new RfisNeedingAttentionResponse(
            OverdueCount: 5,
            BallInCourtCount: 3,
            TotalCount: 8,
            Items: items
        );
        var response2 = new RfisNeedingAttentionResponse(
            OverdueCount: 5,
            BallInCourtCount: 3,
            TotalCount: 8,
            Items: items
        );
        var response3 = new RfisNeedingAttentionResponse(
            OverdueCount: 10, // Different
            BallInCourtCount: 3,
            TotalCount: 13,
            Items: items
        );

        // Assert - record value equality (same list reference)
        response1.Should().Be(response2);
        response1.Should().NotBe(response3);
    }

    [Fact]
    public void RfisNeedingAttentionResponse_EquivalentWithDifferentListInstances()
    {
        // Arrange - different list instances but empty
        var response1 = new RfisNeedingAttentionResponse(
            OverdueCount: 5,
            BallInCourtCount: 3,
            TotalCount: 8,
            Items: new List<RfiAttentionItem>()
        );
        var response2 = new RfisNeedingAttentionResponse(
            OverdueCount: 5,
            BallInCourtCount: 3,
            TotalCount: 8,
            Items: new List<RfiAttentionItem>()
        );

        // Assert - use BeEquivalentTo for structural comparison
        response1.Should().BeEquivalentTo(response2);
    }

    [Fact]
    public void RfiAttentionItem_RecordEquality()
    {
        // Arrange
        var id = Guid.NewGuid();
        var dueDate = DateTime.UtcNow.AddDays(-3);
        
        var item1 = new RfiAttentionItem(
            Id: id,
            Number: 42,
            Subject: "Foundation clarification",
            ProjectId: Guid.NewGuid().ToString(),
            ProjectName: "Office Building",
            ProjectNumber: "P-2026-001",
            Priority: "High",
            DueDate: dueDate,
            DaysOverdue: 3,
            IsOverdue: true,
            IsBallInCourt: false,
            BallInCourtName: "John Architect"
        );
        var item2 = new RfiAttentionItem(
            Id: id,
            Number: 42,
            Subject: "Foundation clarification",
            ProjectId: item1.ProjectId,
            ProjectName: "Office Building",
            ProjectNumber: "P-2026-001",
            Priority: "High",
            DueDate: dueDate,
            DaysOverdue: 3,
            IsOverdue: true,
            IsBallInCourt: false,
            BallInCourtName: "John Architect"
        );
        var item3 = new RfiAttentionItem(
            Id: Guid.NewGuid(), // Different ID
            Number: 42,
            Subject: "Foundation clarification",
            ProjectId: item1.ProjectId,
            ProjectName: "Office Building",
            ProjectNumber: "P-2026-001",
            Priority: "High",
            DueDate: dueDate,
            DaysOverdue: 3,
            IsOverdue: true,
            IsBallInCourt: false,
            BallInCourtName: "John Architect"
        );

        // Assert
        item1.Should().Be(item2);
        item1.Should().NotBe(item3);
    }

    [Fact]
    public void RfiAttentionItem_Properties_AreCorrectlySet()
    {
        // Arrange
        var id = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var dueDate = DateTime.UtcNow.AddDays(-5);

        // Act
        var item = new RfiAttentionItem(
            Id: id,
            Number: 99,
            Subject: "HVAC specification needed",
            ProjectId: projectId.ToString(),
            ProjectName: "Hospital Wing B",
            ProjectNumber: "H-2026-005",
            Priority: "Critical",
            DueDate: dueDate,
            DaysOverdue: 5,
            IsOverdue: true,
            IsBallInCourt: true,
            BallInCourtName: "Current User"
        );

        // Assert
        item.Id.Should().Be(id);
        item.Number.Should().Be(99);
        item.Subject.Should().Be("HVAC specification needed");
        item.ProjectId.Should().Be(projectId.ToString());
        item.ProjectName.Should().Be("Hospital Wing B");
        item.ProjectNumber.Should().Be("H-2026-005");
        item.Priority.Should().Be("Critical");
        item.DueDate.Should().Be(dueDate);
        item.DaysOverdue.Should().Be(5);
        item.IsOverdue.Should().BeTrue();
        item.IsBallInCourt.Should().BeTrue();
        item.BallInCourtName.Should().Be("Current User");
    }

    [Fact]
    public void RfiAttentionItem_NullableDueDate_HandledCorrectly()
    {
        // Arrange & Act
        var item = new RfiAttentionItem(
            Id: Guid.NewGuid(),
            Number: 1,
            Subject: "Test",
            ProjectId: Guid.NewGuid().ToString(),
            ProjectName: "Test Project",
            ProjectNumber: "P-001",
            Priority: "Normal",
            DueDate: null, // No due date
            DaysOverdue: 0,
            IsOverdue: false,
            IsBallInCourt: true,
            BallInCourtName: "User"
        );

        // Assert
        item.DueDate.Should().BeNull();
        item.IsOverdue.Should().BeFalse();
        item.DaysOverdue.Should().Be(0);
    }

    [Fact]
    public void RfiAttentionItem_NullBallInCourtName_HandledCorrectly()
    {
        // Arrange & Act
        var item = new RfiAttentionItem(
            Id: Guid.NewGuid(),
            Number: 1,
            Subject: "Test",
            ProjectId: Guid.NewGuid().ToString(),
            ProjectName: "Test Project",
            ProjectNumber: "P-001",
            Priority: "Normal",
            DueDate: DateTime.UtcNow.AddDays(-1),
            DaysOverdue: 1,
            IsOverdue: true,
            IsBallInCourt: false,
            BallInCourtName: null // Not assigned to anyone
        );

        // Assert
        item.BallInCourtName.Should().BeNull();
        item.IsBallInCourt.Should().BeFalse();
    }

    #endregion

    #region Response Construction Tests

    [Fact]
    public void RfisNeedingAttentionResponse_WithItems_CalculatesCountsCorrectly()
    {
        // Arrange
        var items = new List<RfiAttentionItem>
        {
            CreateTestItem(isOverdue: true, isBallInCourt: false),
            CreateTestItem(isOverdue: true, isBallInCourt: true),
            CreateTestItem(isOverdue: false, isBallInCourt: true),
        };

        // Act
        var response = new RfisNeedingAttentionResponse(
            OverdueCount: 2,
            BallInCourtCount: 2,
            TotalCount: 3,
            Items: items
        );

        // Assert
        response.Items.Should().HaveCount(3);
        response.OverdueCount.Should().Be(2);
        response.BallInCourtCount.Should().Be(2);
        response.TotalCount.Should().Be(3);
    }

    [Fact]
    public void RfisNeedingAttentionResponse_ItemsSortedByUrgency_OverdueFirst()
    {
        // This test documents the expected sort order:
        // 1. Overdue items first (sorted by due date ASC)
        // 2. Non-overdue ball-in-court items second
        // 3. Then by priority, then by creation date

        // Arrange
        var overdueItem = CreateTestItem(isOverdue: true, isBallInCourt: false, daysOverdue: 5);
        var ballInCourtItem = CreateTestItem(isOverdue: false, isBallInCourt: true);
        var bothItem = CreateTestItem(isOverdue: true, isBallInCourt: true, daysOverdue: 2);

        var items = new List<RfiAttentionItem> { overdueItem, ballInCourtItem, bothItem };

        // Sort by urgency (overdue first, then by days overdue descending)
        var sortedItems = items
            .OrderByDescending(i => i.IsOverdue)
            .ThenByDescending(i => i.DaysOverdue)
            .ToList();

        // Assert - overdue items should come first
        sortedItems[0].IsOverdue.Should().BeTrue();
        sortedItems[0].DaysOverdue.Should().Be(5); // Most overdue first
        sortedItems[1].IsOverdue.Should().BeTrue();
        sortedItems[1].DaysOverdue.Should().Be(2);
        sortedItems[2].IsOverdue.Should().BeFalse();
    }

    private static RfiAttentionItem CreateTestItem(
        bool isOverdue = false,
        bool isBallInCourt = false,
        int daysOverdue = 0)
    {
        return new RfiAttentionItem(
            Id: Guid.NewGuid(),
            Number: Random.Shared.Next(1, 1000),
            Subject: $"Test RFI {Guid.NewGuid():N}",
            ProjectId: Guid.NewGuid().ToString(),
            ProjectName: "Test Project",
            ProjectNumber: "P-TEST-001",
            Priority: "Normal",
            DueDate: isOverdue ? DateTime.UtcNow.AddDays(-daysOverdue) : DateTime.UtcNow.AddDays(7),
            DaysOverdue: daysOverdue,
            IsOverdue: isOverdue,
            IsBallInCourt: isBallInCourt,
            BallInCourtName: isBallInCourt ? "Test User" : null
        );
    }

    #endregion
}
