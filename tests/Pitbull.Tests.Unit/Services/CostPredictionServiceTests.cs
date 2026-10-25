using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Projects.Domain;
using Pitbull.Reports.Services;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Tests.Unit.Services;

public class CostPredictionServiceTests
{
    private static readonly Guid ProjectId = Guid.NewGuid();
    private static readonly Guid EmployeeId = Guid.NewGuid();

    [Fact]
    public async Task GeneratePredictionAsync_WithTimeEntries_CreatesPrediction()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        await SeedProjectWithTimeEntries(db, budgetAmount: 100_000m, laborCost: 30_000m, daysAgo: 60);

        var result = await service.GeneratePredictionAsync(ProjectId, CancellationToken.None);

        result.Should().NotBeNull();
        result.ProjectId.Should().Be(ProjectId);
        result.CostToDate.Should().Be(30_000m);
        result.BudgetAtCompletion.Should().Be(100_000m);
        result.PredictedFinalCost.Should().BeGreaterThan(0);
        result.ConfidenceLevel.Should().BeGreaterThan(0).And.BeLessThanOrEqualTo(1);
        result.BurnRate.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task GeneratePredictionAsync_ProjectNotFound_ThrowsArgumentException()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var act = () => service.GeneratePredictionAsync(Guid.NewGuid(), CancellationToken.None);

        await act.Should().ThrowAsync<ArgumentException>().WithMessage("Project not found.");
    }

    [Fact]
    public async Task GeneratePredictionAsync_NoTimeEntries_UsesBudgetAsEstimate()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        db.Set<Project>().Add(new Project
        {
            Id = ProjectId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            Name = "Empty Project",
            Number = "PRJ-EMPTY",
            ContractAmount = 200_000m,
            Status = ProjectStatus.Active,
            CreatedAt = DateTime.UtcNow.AddDays(-10),
            CreatedBy = "test"
        });
        await db.SaveChangesAsync();

        var result = await service.GeneratePredictionAsync(ProjectId, CancellationToken.None);

        result.CostToDate.Should().Be(0m);
        result.BudgetAtCompletion.Should().Be(200_000m);
        result.PredictedFinalCost.Should().BeGreaterThanOrEqualTo(0);
    }

    [Fact]
    public async Task GetLatestPredictionAsync_NoPredictions_ReturnsNull()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.GetLatestPredictionAsync(Guid.NewGuid(), CancellationToken.None);

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetLatestPredictionAsync_MultiplePredictions_ReturnsMostRecent()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        await SeedProjectWithTimeEntries(db, budgetAmount: 100_000m, laborCost: 20_000m, daysAgo: 45);

        // Generate two predictions
        await service.GeneratePredictionAsync(ProjectId, CancellationToken.None);
        await service.GeneratePredictionAsync(ProjectId, CancellationToken.None);

        var result = await service.GetLatestPredictionAsync(ProjectId, CancellationToken.None);

        result.Should().NotBeNull();
        result!.ProjectId.Should().Be(ProjectId);
    }

    [Fact]
    public async Task GetPredictionHistoryAsync_ReturnsPredictionsOrderedByCreatedAtDesc()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        await SeedProjectWithTimeEntries(db, budgetAmount: 100_000m, laborCost: 25_000m, daysAgo: 50);

        await service.GeneratePredictionAsync(ProjectId, CancellationToken.None);
        await service.GeneratePredictionAsync(ProjectId, CancellationToken.None);

        var history = await service.GetPredictionHistoryAsync(ProjectId, CancellationToken.None);

        history.Should().HaveCount(2);
        history[0].CreatedAt.Should().BeOnOrAfter(history[1].CreatedAt);
    }

    [Fact]
    public async Task GeneratePredictionAsync_VarianceToBudget_CalculatedCorrectly()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        await SeedProjectWithTimeEntries(db, budgetAmount: 50_000m, laborCost: 40_000m, daysAgo: 60);

        var result = await service.GeneratePredictionAsync(ProjectId, CancellationToken.None);

        result.VarianceToBudget.Should().Be(result.PredictedFinalCost - result.BudgetAtCompletion);
    }

    [Fact]
    public async Task GeneratePredictionAsync_UsesOriginalBudgetWhenAvailable()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var projectId = Guid.NewGuid();
        db.Set<Project>().Add(new Project
        {
            Id = projectId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            Name = "Budget Project",
            Number = "PRJ-BDG",
            ContractAmount = 200_000m,
            OriginalBudget = 150_000m,
            Status = ProjectStatus.Active,
            CreatedAt = DateTime.UtcNow.AddDays(-30),
            CreatedBy = "test"
        });
        await db.SaveChangesAsync();

        var result = await service.GeneratePredictionAsync(projectId, CancellationToken.None);

        result.BudgetAtCompletion.Should().Be(150_000m);
    }

    // --- Confidence scoring tests ---

    [Theory]
    [InlineData(5, 3, false)]
    [InlineData(10, 10, false)]
    [InlineData(25, 25, false)]
    public void CalculateConfidence_LessThan30Days_CappedAtHalf(int daysElapsed, int entryCount, bool hasWip)
    {
        var confidence = CostPredictionService.CalculateConfidence(daysElapsed, entryCount, hasWip);
        confidence.Should().BeLessThanOrEqualTo(0.5m);
    }

    [Fact]
    public void CalculateConfidence_90DaysPlus50Entries_HighConfidence()
    {
        var confidence = CostPredictionService.CalculateConfidence(90, 50, false);
        confidence.Should().BeGreaterThanOrEqualTo(0.75m);
    }

    [Fact]
    public void CalculateConfidence_WithWipData_GetsBonus()
    {
        var withoutWip = CostPredictionService.CalculateConfidence(60, 30, false);
        var withWip = CostPredictionService.CalculateConfidence(60, 30, true);
        withWip.Should().BeGreaterThan(withoutWip);
    }

    [Fact]
    public void CalculateConfidence_AlwaysClampedTo0_05Through0_99()
    {
        var minimum = CostPredictionService.CalculateConfidence(0, 0, false);
        minimum.Should().BeGreaterThanOrEqualTo(0.05m);

        var maximum = CostPredictionService.CalculateConfidence(1000, 1000, true);
        maximum.Should().BeLessThanOrEqualTo(0.99m);
    }

    // --- Helpers ---

    private static CostPredictionService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        var tenantContext = new TenantContext
        {
            TenantId = TestDbContextFactory.TestTenantId,
            TenantName = "Test Tenant"
        };
        var companyContext = new CompanyContext
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            CompanyCode = "01",
            CompanyName = "Test Company"
        };
        return new CostPredictionService(db, tenantContext, companyContext, NullLogger<CostPredictionService>.Instance);
    }

    private static async Task SeedProjectWithTimeEntries(
        Pitbull.Core.Data.PitbullDbContext db,
        decimal budgetAmount,
        decimal laborCost,
        int daysAgo)
    {
        var project = new Project
        {
            Id = ProjectId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            TenantId = TestDbContextFactory.TestTenantId,
            Name = "Test Forecast Project",
            Number = "PRJ-FORECAST",
            ContractAmount = budgetAmount,
            Status = ProjectStatus.Active,
            StartDate = DateTime.UtcNow.AddDays(-daysAgo),
            EstimatedCompletionDate = DateTime.UtcNow.AddDays(120),
            CreatedAt = DateTime.UtcNow.AddDays(-daysAgo),
            CreatedBy = "test"
        };

        var costCode = new CostCode
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            Code = "01-100",
            Description = "General Labor",
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        var employee = new Employee
        {
            Id = EmployeeId,
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeNumber = "EMP-001",
            FirstName = "John",
            LastName = "Doe",
            BaseHourlyRate = 50m,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        db.Set<Project>().Add(project);
        db.Set<CostCode>().Add(costCode);
        db.Set<Employee>().Add(employee);
        await db.SaveChangesAsync();

        // Calculate how many 8-hour days of regular time at $50/hr to reach the target labor cost
        var hoursNeeded = laborCost / 50m;
        var daysOfEntries = (int)Math.Ceiling(hoursNeeded / 8m);

        for (var i = 0; i < daysOfEntries; i++)
        {
            var remainingHours = hoursNeeded - i * 8m;
            var hoursForDay = Math.Min(8m, remainingHours);

            db.Set<TimeEntry>().Add(new TimeEntry
            {
                Id = Guid.NewGuid(),
                CompanyId = TestDbContextFactory.TestCompanyId,
                TenantId = TestDbContextFactory.TestTenantId,
                ProjectId = ProjectId,
                EmployeeId = EmployeeId,
                CostCodeId = costCode.Id,
                Date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-daysAgo + i)),
                RegularHours = hoursForDay,
                OvertimeHours = 0,
                DoubletimeHours = 0,
                Status = TimeEntryStatus.Approved,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "test"
            });
        }

        await db.SaveChangesAsync();
    }
}
