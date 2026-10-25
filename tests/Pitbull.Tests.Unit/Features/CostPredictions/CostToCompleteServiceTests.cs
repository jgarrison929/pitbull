using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Api.Features.CostPredictions;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.ProjectManagement.Domain;
using Pitbull.Projects.Domain;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;
using static Pitbull.Api.Features.CostPredictions.CostToCompleteService;

namespace Pitbull.Tests.Unit.Features.CostPredictions;

public class CostToCompleteServiceTests
{
    private static readonly Guid ProjectId = Guid.NewGuid();
    private static readonly Guid CostCodeId1 = Guid.NewGuid();
    private static readonly Guid CostCodeId2 = Guid.NewGuid();
    private static readonly Guid EmployeeId = Guid.NewGuid();

    // ── Linear Regression Math ──────────────────────────────────

    [Fact]
    public void LinearRegression_PerfectLinearData_ReturnsExactSlopeAndIntercept()
    {
        // y = 100 + 50x (perfect line)
        var points = new List<(decimal X, decimal Y)>
        {
            (0m, 100m),
            (1m, 150m),
            (2m, 200m),
            (3m, 250m),
            (4m, 300m)
        };

        var result = CostToCompleteService.LinearRegression(points);

        result.Slope.Should().BeApproximately(50m, 0.01m);
        result.Intercept.Should().BeApproximately(100m, 0.01m);
        result.RSquared.Should().BeApproximately(1.0m, 0.001m);
    }

    [Fact]
    public void LinearRegression_NoisyData_ReturnsReasonableR2()
    {
        // Noisy data around y = 10x
        var points = new List<(decimal X, decimal Y)>
        {
            (1m, 12m),
            (2m, 18m),
            (3m, 35m),
            (4m, 38m),
            (5m, 55m)
        };

        var result = CostToCompleteService.LinearRegression(points);

        result.Slope.Should().BeGreaterThan(0m);
        result.RSquared.Should().BeGreaterThan(0.5m).And.BeLessThanOrEqualTo(1.0m);
    }

    [Fact]
    public void LinearRegression_SinglePoint_ReturnsZeroSlope()
    {
        var points = new List<(decimal X, decimal Y)> { (5m, 100m) };

        var result = CostToCompleteService.LinearRegression(points);

        result.Slope.Should().Be(0m);
        result.RSquared.Should().Be(0m);
    }

    [Fact]
    public void LinearRegression_TwoPoints_PerfectFit()
    {
        var points = new List<(decimal X, decimal Y)>
        {
            (0m, 0m),
            (10m, 500m)
        };

        var result = CostToCompleteService.LinearRegression(points);

        result.Slope.Should().BeApproximately(50m, 0.01m);
        result.Intercept.Should().BeApproximately(0m, 0.01m);
        result.RSquared.Should().BeApproximately(1.0m, 0.001m);
    }

    [Fact]
    public void LinearRegression_FlatData_ZeroSlope()
    {
        var points = new List<(decimal X, decimal Y)>
        {
            (1m, 100m),
            (2m, 100m),
            (3m, 100m)
        };

        var result = CostToCompleteService.LinearRegression(points);

        result.Slope.Should().BeApproximately(0m, 0.01m);
        result.Intercept.Should().BeApproximately(100m, 0.01m);
    }

    // ── BuildCumulativeSeries ───────────────────────────────────

    [Fact]
    public void BuildCumulativeSeries_AccumulatesDailySpends()
    {
        var projectStart = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var spends = new List<DailySpend>
        {
            new(new DateOnly(2026, 1, 3), 100m),
            new(new DateOnly(2026, 1, 5), 200m),
            new(new DateOnly(2026, 1, 10), 150m)
        };

        var result = CostToCompleteService.BuildCumulativeSeries(spends, projectStart);

        result.Should().HaveCount(3);
        result[0].X.Should().Be(2m);   // Day 2
        result[0].Y.Should().Be(100m); // Cumulative 100
        result[1].X.Should().Be(4m);   // Day 4
        result[1].Y.Should().Be(300m); // Cumulative 300
        result[2].X.Should().Be(9m);   // Day 9
        result[2].Y.Should().Be(450m); // Cumulative 450
    }

    // ── DetermineHealth ─────────────────────────────────────────

    [Theory]
    [InlineData(0, 100_000, 0, 10, "Green")]                // On budget
    [InlineData(-5_000, 100_000, 0, 10, "Green")]            // Under budget
    [InlineData(4_000, 100_000, 1, 10, "Yellow")]            // 4% over, 1 warning
    [InlineData(12_000, 100_000, 3, 5, "Red")]               // 12% over
    [InlineData(2_000, 100_000, 6, 10, "Red")]               // >50% warnings
    public void DetermineHealth_VariousScenarios(
        decimal overallVariance, decimal totalBudget, int warningCount, int totalCostCodes, string expected)
    {
        var result = CostToCompleteService.DetermineHealth(overallVariance, totalBudget, warningCount, totalCostCodes);
        result.Should().Be(expected);
    }

    [Fact]
    public void DetermineHealth_ZeroBudget_NoVariance_ReturnsGreen()
    {
        CostToCompleteService.DetermineHealth(0m, 0m, 0, 0).Should().Be("Green");
    }

    [Fact]
    public void DetermineHealth_ZeroBudget_WithVariance_ReturnsYellow()
    {
        CostToCompleteService.DetermineHealth(500m, 0m, 0, 0).Should().Be("Yellow");
    }

    // ── PredictCostCode ─────────────────────────────────────────

    [Fact]
    public void PredictCostCode_NoSpendData_ReturnsBudgetAsEac()
    {
        var budget = MakeBudget(CostCodeId1, currentBudget: 50_000m);
        var spends = new List<DailySpend>();

        var result = CostToCompleteService.PredictCostCode(
            budget, spends, "01-100", "General Labor",
            DateTime.UtcNow.AddDays(-60), 180, 120);

        result.PredictedEac.Should().Be(50_000m);
        result.Confidence.Should().Be(0m);
        result.TrendDirection.Should().Be("flat");
        result.IsWarning.Should().BeFalse();
    }

    [Fact]
    public void PredictCostCode_SingleDataPoint_ReturnsBudgetAsEac()
    {
        var budget = MakeBudget(CostCodeId1, currentBudget: 50_000m);
        var spends = new List<DailySpend>
        {
            new(DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)), 5_000m)
        };

        var result = CostToCompleteService.PredictCostCode(
            budget, spends, "01-100", "General Labor",
            DateTime.UtcNow.AddDays(-60), 180, 120);

        result.PredictedEac.Should().Be(50_000m);
        result.Confidence.Should().Be(0m);
    }

    [Fact]
    public void PredictCostCode_SteadyBurn_PredictsFinalCost()
    {
        // $500/day steady burn over 30 days = $15k actual, 180-day project = ~$90k EAC
        var budget = MakeBudget(CostCodeId1, currentBudget: 100_000m);
        var projectStart = DateTime.UtcNow.AddDays(-60);
        var spends = Enumerable.Range(1, 30)
            .Select(i => new DailySpend(
                DateOnly.FromDateTime(projectStart.AddDays(i + 30)),
                500m))
            .ToList();

        var result = CostToCompleteService.PredictCostCode(
            budget, spends, "01-100", "General Labor",
            projectStart, 180, 120);

        result.PredictedEac.Should().BeGreaterThan(15_000m);
        result.ActualCost.Should().Be(15_000m);
        result.Confidence.Should().BeGreaterThan(0m);
        result.TrendDirection.Should().Be("up"); // Cumulative is always rising
        result.DailyBurnRate.Should().BeGreaterThan(0m);
    }

    [Fact]
    public void PredictCostCode_OverBudgetProjection_FlagsWarning()
    {
        // Heavy spend that will project well over budget
        var budget = MakeBudget(CostCodeId1, currentBudget: 10_000m);
        var projectStart = DateTime.UtcNow.AddDays(-90);
        var spends = Enumerable.Range(1, 60)
            .Select(i => new DailySpend(
                DateOnly.FromDateTime(projectStart.AddDays(i + 10)),
                200m))
            .ToList();

        var result = CostToCompleteService.PredictCostCode(
            budget, spends, "02-200", "Concrete",
            projectStart, 180, 90);

        result.IsWarning.Should().BeTrue();
        result.PredictedEac.Should().BeGreaterThan(10_000m * 1.05m);
    }

    [Fact]
    public void PredictCostCode_DaysUntilExhaustion_Calculated()
    {
        var budget = MakeBudget(CostCodeId1, currentBudget: 20_000m);
        var projectStart = DateTime.UtcNow.AddDays(-30);
        var spends = Enumerable.Range(1, 20)
            .Select(i => new DailySpend(
                DateOnly.FromDateTime(projectStart.AddDays(i)),
                100m))
            .ToList();

        var result = CostToCompleteService.PredictCostCode(
            budget, spends, "01-100", "General Labor",
            projectStart, 180, 150);

        result.DaysUntilExhaustion.Should().NotBeNull();
        result.DaysUntilExhaustion.Should().BeGreaterThan(0);
    }

    // ── Integration-style: PredictAsync ─────────────────────────

    [Fact]
    public async Task PredictAsync_ProjectNotFound_ThrowsArgument()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var act = () => service.PredictAsync(Guid.NewGuid(), CancellationToken.None);

        await act.Should().ThrowAsync<ArgumentException>().WithMessage("Project not found.");
    }

    [Fact]
    public async Task PredictAsync_NoBudgets_ThrowsInvalidOperation()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        db.Set<Project>().Add(MakeProject());
        await db.SaveChangesAsync();

        var act = () => service.PredictAsync(ProjectId, CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*budgets*");
    }

    [Fact]
    public async Task PredictAsync_WithBudgetsAndEntries_ReturnsResult()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        await SeedFullProject(db);

        var result = await service.PredictAsync(ProjectId, CancellationToken.None);

        result.ProjectId.Should().Be(ProjectId);
        result.ProjectName.Should().Be("Highway Bridge Rehabilitation");
        result.TotalBudget.Should().BeGreaterThan(0);
        result.TotalActualCost.Should().BeGreaterThan(0);
        result.TotalPredictedEac.Should().BeGreaterThan(0);
        result.CostCodes.Should().NotBeEmpty();
        result.ProjectHealth.Should().BeOneOf("Green", "Yellow", "Red");
        result.GeneratedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task PredictAsync_CostCodesOrderedByWarningThenVariance()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        await SeedFullProject(db);

        var result = await service.PredictAsync(ProjectId, CancellationToken.None);

        // Warning items should appear first
        if (result.CostCodes.Count > 1)
        {
            var firstWarning = result.CostCodes.FindIndex(c => c.IsWarning);
            var lastNonWarning = result.CostCodes.FindLastIndex(c => !c.IsWarning);
            if (firstWarning >= 0 && lastNonWarning >= 0)
                firstWarning.Should().BeLessThan(lastNonWarning);
        }
    }

    [Fact]
    public async Task PredictAsync_BudgetsWithNoTimeEntries_ReturnsZeroActual()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        db.Set<Project>().Add(MakeProject());
        db.Set<CostCode>().Add(MakeCostCode(CostCodeId1, "01-100", "General Labor"));
        db.Set<PmJobCostBudget>().Add(MakeBudget(CostCodeId1, 50_000m));
        await db.SaveChangesAsync();

        var result = await service.PredictAsync(ProjectId, CancellationToken.None);

        result.TotalActualCost.Should().Be(0m);
        result.CostCodes.Should().HaveCount(1);
        result.CostCodes[0].ActualCost.Should().Be(0m);
    }

    // ── Helpers ─────────────────────────────────────────────────

    private static CostToCompleteService CreateService(Pitbull.Core.Data.PitbullDbContext db)
    {
        var companyContext = new CompanyContext
        {
            CompanyId = TestDbContextFactory.TestCompanyId,
            CompanyCode = "01",
            CompanyName = "Test Company"
        };
        return new CostToCompleteService(db, companyContext, NullLogger<CostToCompleteService>.Instance);
    }

    private static Project MakeProject() => new()
    {
        Id = ProjectId,
        CompanyId = TestDbContextFactory.TestCompanyId,
        TenantId = TestDbContextFactory.TestTenantId,
        Name = "Highway Bridge Rehabilitation",
        Number = "PRJ-HBR-001",
        ContractAmount = 500_000m,
        Status = ProjectStatus.Active,
        StartDate = DateTime.UtcNow.AddDays(-90),
        EstimatedCompletionDate = DateTime.UtcNow.AddDays(270),
        CreatedAt = DateTime.UtcNow.AddDays(-90),
        CreatedBy = "test"
    };

    private static CostCode MakeCostCode(Guid id, string code, string description) => new()
    {
        Id = id,
        TenantId = TestDbContextFactory.TestTenantId,
        Code = code,
        Description = description,
        CreatedAt = DateTime.UtcNow,
        CreatedBy = "test"
    };

    private static PmJobCostBudget MakeBudget(Guid costCodeId, decimal currentBudget) => new()
    {
        Id = Guid.NewGuid(),
        CompanyId = TestDbContextFactory.TestCompanyId,
        TenantId = TestDbContextFactory.TestTenantId,
        ProjectId = ProjectId,
        CostCodeId = costCodeId,
        OriginalBudget = currentBudget,
        ApprovedBudgetChanges = 0m,
        CurrentBudget = currentBudget,
        CreatedAt = DateTime.UtcNow,
        CreatedBy = "test"
    };

    private static async Task SeedFullProject(Pitbull.Core.Data.PitbullDbContext db)
    {
        db.Set<Project>().Add(MakeProject());
        db.Set<CostCode>().Add(MakeCostCode(CostCodeId1, "01-100", "General Labor"));
        db.Set<CostCode>().Add(MakeCostCode(CostCodeId2, "03-300", "Concrete"));
        db.Set<PmJobCostBudget>().Add(MakeBudget(CostCodeId1, 200_000m));
        db.Set<PmJobCostBudget>().Add(MakeBudget(CostCodeId2, 100_000m));

        var employee = new Employee
        {
            Id = EmployeeId,
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeNumber = "EMP-001",
            FirstName = "Jane",
            LastName = "Smith",
            BaseHourlyRate = 60m,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };
        db.Set<Employee>().Add(employee);
        await db.SaveChangesAsync();

        // Seed time entries: 40 days of labor on CostCode1, 20 on CostCode2
        var start = DateTime.UtcNow.AddDays(-80);
        for (var i = 0; i < 40; i++)
        {
            db.Set<TimeEntry>().Add(new TimeEntry
            {
                Id = Guid.NewGuid(),
                CompanyId = TestDbContextFactory.TestCompanyId,
                TenantId = TestDbContextFactory.TestTenantId,
                ProjectId = ProjectId,
                EmployeeId = EmployeeId,
                CostCodeId = CostCodeId1,
                Date = DateOnly.FromDateTime(start.AddDays(i)),
                RegularHours = 8m,
                OvertimeHours = 0m,
                DoubletimeHours = 0m,
                Status = TimeEntryStatus.Approved,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "test"
            });
        }

        for (var i = 0; i < 20; i++)
        {
            db.Set<TimeEntry>().Add(new TimeEntry
            {
                Id = Guid.NewGuid(),
                CompanyId = TestDbContextFactory.TestCompanyId,
                TenantId = TestDbContextFactory.TestTenantId,
                ProjectId = ProjectId,
                EmployeeId = EmployeeId,
                CostCodeId = CostCodeId2,
                Date = DateOnly.FromDateTime(start.AddDays(i + 20)),
                RegularHours = 6m,
                OvertimeHours = 2m,
                DoubletimeHours = 0m,
                Status = TimeEntryStatus.Approved,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "test"
            });
        }

        await db.SaveChangesAsync();
    }
}
