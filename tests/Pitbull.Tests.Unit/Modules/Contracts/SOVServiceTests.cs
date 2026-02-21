using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.SOV;
using Pitbull.Contracts.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.Contracts;

public sealed class SOVServiceTests
{
    private static SOVService CreateService(Pitbull.Core.Data.PitbullDbContext db)
        => new(db);

    private static async Task<(Guid SubcontractId, Guid SovId)> SeedSOVAsync(
        Pitbull.Core.Data.PitbullDbContext db, decimal contractValue = 100_000m)
    {
        var projectId = Guid.NewGuid();
        await TestDbContextFactory.SeedProjectAsync(db, projectId);

        var subcontract = new Subcontract
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = projectId,
            SubcontractNumber = "SC-001",
            SubcontractorName = "Test Sub",
            ScopeOfWork = "Test scope",
            OriginalValue = contractValue,
            CurrentValue = contractValue,
            RetainagePercent = 10m,
            Status = SubcontractStatus.Executed,
            CreatedAt = DateTime.UtcNow
        };

        db.Set<Subcontract>().Add(subcontract);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var sovResult = await service.CreateAsync(subcontract.Id, new CreateSOVCommand("Main SOV"));
        sovResult.IsSuccess.Should().BeTrue();

        return (subcontract.Id, sovResult.Value!.Id);
    }

    // === AddLineItem Overbilling Validation ===

    [Fact]
    public async Task AddLineItem_BillingWithinScheduledValue_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        var (_, sovId) = await SeedSOVAsync(db);
        var service = CreateService(db);

        var result = await service.AddLineItemAsync(sovId, new CreateSOVLineItemCommand(
            "001", "Concrete", 50_000m, PreviouslyBilled: 20_000m, CurrentBilled: 10_000m));

        result.IsSuccess.Should().BeTrue();
        result.Value!.ScheduledValue.Should().Be(50_000m);
    }

    [Fact]
    public async Task AddLineItem_TotalBilledExceedsScheduledValue_Fails()
    {
        using var db = TestDbContextFactory.Create();
        var (_, sovId) = await SeedSOVAsync(db);
        var service = CreateService(db);

        var result = await service.AddLineItemAsync(sovId, new CreateSOVLineItemCommand(
            "001", "Concrete", 50_000m, PreviouslyBilled: 30_000m, CurrentBilled: 25_000m));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("OVERBILLING");
    }

    [Fact]
    public async Task AddLineItem_BilledExactlyEqualsScheduledValue_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        var (_, sovId) = await SeedSOVAsync(db);
        var service = CreateService(db);

        var result = await service.AddLineItemAsync(sovId, new CreateSOVLineItemCommand(
            "001", "Concrete", 50_000m, PreviouslyBilled: 30_000m, CurrentBilled: 20_000m));

        result.IsSuccess.Should().BeTrue();
    }

    // === UpdateLineItem Overbilling Validation ===

    [Fact]
    public async Task UpdateLineItem_IncreaseBillingBeyondSchedule_Fails()
    {
        using var db = TestDbContextFactory.Create();
        var (_, sovId) = await SeedSOVAsync(db);
        var service = CreateService(db);

        var added = await service.AddLineItemAsync(sovId, new CreateSOVLineItemCommand(
            "001", "Concrete", 50_000m, PreviouslyBilled: 20_000m, CurrentBilled: 10_000m));
        added.IsSuccess.Should().BeTrue();

        var result = await service.UpdateLineItemAsync(sovId, added.Value!.Id,
            new UpdateSOVLineItemCommand(CurrentBilled: 35_000m));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("OVERBILLING");
    }

    [Fact]
    public async Task UpdateLineItem_ReduceScheduledValueBelowBilled_Fails()
    {
        using var db = TestDbContextFactory.Create();
        var (_, sovId) = await SeedSOVAsync(db);
        var service = CreateService(db);

        var added = await service.AddLineItemAsync(sovId, new CreateSOVLineItemCommand(
            "001", "Concrete", 50_000m, PreviouslyBilled: 20_000m, CurrentBilled: 20_000m));
        added.IsSuccess.Should().BeTrue();

        var result = await service.UpdateLineItemAsync(sovId, added.Value!.Id,
            new UpdateSOVLineItemCommand(ScheduledValue: 30_000m));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("OVERBILLING");
    }

    [Fact]
    public async Task UpdateLineItem_ValidUpdate_Succeeds()
    {
        using var db = TestDbContextFactory.Create();
        var (_, sovId) = await SeedSOVAsync(db);
        var service = CreateService(db);

        var added = await service.AddLineItemAsync(sovId, new CreateSOVLineItemCommand(
            "001", "Concrete", 50_000m, PreviouslyBilled: 10_000m, CurrentBilled: 5_000m));
        added.IsSuccess.Should().BeTrue();

        var result = await service.UpdateLineItemAsync(sovId, added.Value!.Id,
            new UpdateSOVLineItemCommand(CurrentBilled: 15_000m));

        result.IsSuccess.Should().BeTrue();
        result.Value!.CurrentBilled.Should().Be(15_000m);
    }

    // === SOV Summary ===

    [Fact]
    public async Task GetSummary_CalculatesTotalsCorrectly()
    {
        using var db = TestDbContextFactory.Create();
        var (_, sovId) = await SeedSOVAsync(db, contractValue: 200_000m);
        var service = CreateService(db);

        await service.AddLineItemAsync(sovId, new CreateSOVLineItemCommand(
            "001", "Concrete", 80_000m, PreviouslyBilled: 20_000m, CurrentBilled: 10_000m));
        await service.AddLineItemAsync(sovId, new CreateSOVLineItemCommand(
            "002", "Steel", 60_000m, PreviouslyBilled: 15_000m, CurrentBilled: 5_000m));

        var result = await service.GetSummaryAsync(sovId);

        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalScheduledValue.Should().Be(140_000m);
        result.Value!.TotalPreviouslyBilled.Should().Be(35_000m);
        result.Value!.TotalCurrentBilled.Should().Be(15_000m);
        result.Value!.LineItemCount.Should().Be(2);
    }
}
