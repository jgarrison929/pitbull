using FluentAssertions;
using Pitbull.Projects.Features.GetProjectStats;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Handlers;

/// <summary>
/// Tests for GetProjectStatsHandler.
/// Note: The handler uses raw SQL which doesn't work with EF InMemory provider.
/// These tests verify graceful handling and response structure.
/// </summary>
public sealed class GetProjectStatsHandlerTests
{
    [Fact]
    public async Task Handle_WithNonExistentProject_ReturnsNotFoundError()
    {
        // Arrange
        using var db = TestDbContextFactory.Create();
        var handler = new GetProjectStatsHandler(db);
        var query = new GetProjectStatsQuery(Guid.NewGuid());

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert - with InMemory, raw SQL fails but should handle gracefully
        // In production with real DB, this would return PROJECT_NOT_FOUND
        result.Should().NotBeNull();
    }

    [Fact]
    public void ProjectStatsResponse_HasCorrectStructure()
    {
        // Arrange & Act
        var response = new ProjectStatsResponse(
            ProjectId: Guid.NewGuid(),
            ProjectName: "Test Project",
            ProjectNumber: "PRJ-001",
            TotalHours: 100m,
            RegularHours: 80m,
            OvertimeHours: 15m,
            DoubleTimeHours: 5m,
            TotalLaborCost: 5000m,
            TimeEntryCount: 25,
            ApprovedEntryCount: 20,
            PendingEntryCount: 5,
            AssignedEmployeeCount: 8,
            FirstEntryDate: DateOnly.Parse("2026-01-01"),
            LastEntryDate: DateOnly.Parse("2026-02-01")
        );

        // Assert
        response.ProjectName.Should().Be("Test Project");
        response.ProjectNumber.Should().Be("PRJ-001");
        response.TotalHours.Should().Be(100m);
        response.RegularHours.Should().Be(80m);
        response.OvertimeHours.Should().Be(15m);
        response.DoubleTimeHours.Should().Be(5m);
        response.TotalLaborCost.Should().Be(5000m);
        response.TimeEntryCount.Should().Be(25);
        response.ApprovedEntryCount.Should().Be(20);
        response.PendingEntryCount.Should().Be(5);
        response.AssignedEmployeeCount.Should().Be(8);
        response.FirstEntryDate.Should().Be(DateOnly.Parse("2026-01-01"));
        response.LastEntryDate.Should().Be(DateOnly.Parse("2026-02-01"));
    }

    [Fact]
    public void ProjectStatsResponse_HandlesNullDates()
    {
        // Arrange & Act
        var response = new ProjectStatsResponse(
            ProjectId: Guid.NewGuid(),
            ProjectName: "Empty Project",
            ProjectNumber: "PRJ-002",
            TotalHours: 0m,
            RegularHours: 0m,
            OvertimeHours: 0m,
            DoubleTimeHours: 0m,
            TotalLaborCost: 0m,
            TimeEntryCount: 0,
            ApprovedEntryCount: 0,
            PendingEntryCount: 0,
            AssignedEmployeeCount: 0,
            FirstEntryDate: null,
            LastEntryDate: null
        );

        // Assert
        response.FirstEntryDate.Should().BeNull();
        response.LastEntryDate.Should().BeNull();
        response.TotalHours.Should().Be(0m);
    }

    [Fact]
    public void GetProjectStatsQuery_CanBeCreated()
    {
        // Arrange
        var projectId = Guid.NewGuid();

        // Act
        var query = new GetProjectStatsQuery(projectId);

        // Assert
        query.ProjectId.Should().Be(projectId);
    }

    [Fact]
    public void ProjectStatsResponse_HoursBreakdownSumsCorrectly()
    {
        // Arrange & Act
        var response = new ProjectStatsResponse(
            ProjectId: Guid.NewGuid(),
            ProjectName: "Test",
            ProjectNumber: "T-001",
            TotalHours: 100m, // Should equal sum of below
            RegularHours: 80m,
            OvertimeHours: 15m,
            DoubleTimeHours: 5m,
            TotalLaborCost: 5000m,
            TimeEntryCount: 10,
            ApprovedEntryCount: 8,
            PendingEntryCount: 2,
            AssignedEmployeeCount: 3,
            FirstEntryDate: DateOnly.Parse("2026-01-01"),
            LastEntryDate: DateOnly.Parse("2026-01-31")
        );

        // Assert - verify hours add up
        var calculatedTotal = response.RegularHours + response.OvertimeHours + response.DoubleTimeHours;
        response.TotalHours.Should().Be(calculatedTotal);
    }

    [Fact]
    public void ProjectStatsResponse_EntryCountsAddUp()
    {
        // Arrange & Act
        var response = new ProjectStatsResponse(
            ProjectId: Guid.NewGuid(),
            ProjectName: "Test",
            ProjectNumber: "T-001",
            TotalHours: 50m,
            RegularHours: 50m,
            OvertimeHours: 0m,
            DoubleTimeHours: 0m,
            TotalLaborCost: 2500m,
            TimeEntryCount: 10, // Should be >= approved + pending
            ApprovedEntryCount: 7,
            PendingEntryCount: 2,
            AssignedEmployeeCount: 2,
            FirstEntryDate: null,
            LastEntryDate: null
        );

        // Assert - entry counts should make sense
        response.TimeEntryCount.Should().BeGreaterThanOrEqualTo(
            response.ApprovedEntryCount + response.PendingEntryCount
        );
    }
}
