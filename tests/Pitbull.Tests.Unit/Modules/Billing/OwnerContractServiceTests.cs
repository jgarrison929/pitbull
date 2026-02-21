using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Billing.Features.AiaBilling;
using Pitbull.Billing.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Modules.Billing;

public sealed class OwnerContractServiceTests
{
    private static OwnerContractService CreateService(PitbullDbContext db) =>
        new(db, NullLogger<OwnerContractService>.Instance);

    [Fact]
    public async Task CreateContractAsync_EmptyContractNumber_ReturnsValidationError()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        OwnerContractService service = CreateService(db);

        var result = await service.CreateContractAsync(new CreateOwnerContractCommand(
            ProjectId: Guid.NewGuid(),
            ContractNumber: "",
            ProjectName: "Project",
            OriginalContractSum: 100_000m));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task CreateContractAsync_DuplicateContractNumber_ReturnsDuplicateError()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        OwnerContractService service = CreateService(db);
        await service.CreateContractAsync(new CreateOwnerContractCommand(
            ProjectId: Guid.NewGuid(),
            ContractNumber: "OC-100",
            ProjectName: "Project A",
            OriginalContractSum: 100_000m));

        var result = await service.CreateContractAsync(new CreateOwnerContractCommand(
            ProjectId: Guid.NewGuid(),
            ContractNumber: "  OC-100 ",
            ProjectName: "Project B",
            OriginalContractSum: 200_000m));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("DUPLICATE");
    }

    [Fact]
    public async Task UpdateContractAsync_OriginalContractSum_RecalculatesContractSumToDate()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        OwnerContractService service = CreateService(db);
        OwnerContract contract = await SeedContractAsync(db, approvedChangeOrderAmount: 30_000m);

        var result = await service.UpdateContractAsync(new UpdateOwnerContractCommand(
            ContractId: contract.Id,
            OriginalContractSum: 120_000m));

        result.IsSuccess.Should().BeTrue();
        result.Value!.OriginalContractSum.Should().Be(120_000m);
        result.Value.ContractSumToDate.Should().Be(150_000m);
    }

    [Fact]
    public async Task DeleteContractAsync_WithBillingApplications_ReturnsHasBillingsError()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        OwnerContractService service = CreateService(db);
        OwnerContract contract = await SeedContractAsync(db);
        await SeedBillingApplicationAsync(db, contract);

        var result = await service.DeleteContractAsync(contract.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("HAS_BILLINGS");
    }

    [Fact]
    public async Task DeleteContractAsync_WithoutBillingApplications_SoftDeletesContract()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        OwnerContractService service = CreateService(db);
        OwnerContract contract = await SeedContractAsync(db);

        var result = await service.DeleteContractAsync(contract.Id);

        result.IsSuccess.Should().BeTrue();
        OwnerContract persisted = await db.Set<OwnerContract>()
            .IgnoreQueryFilters()
            .FirstAsync(c => c.Id == contract.Id);
        persisted.IsDeleted.Should().BeTrue();
        persisted.DeletedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task ActivateSOVAsync_NoLineItems_ReturnsValidationError()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        OwnerContractService service = CreateService(db);
        OwnerContract contract = await SeedContractAsync(db, originalContractSum: 100_000m);
        OwnerScheduleOfValues sov = await SeedSovAsync(db, contract, revisedAmount: 100_000m);

        var result = await service.ActivateSOVAsync(sov.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task ActivateSOVAsync_UnbalancedLines_ReturnsUnbalancedError()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        OwnerContractService service = CreateService(db);
        OwnerContract contract = await SeedContractAsync(db, originalContractSum: 100_000m);
        OwnerScheduleOfValues sov = await SeedSovAsync(db, contract, revisedAmount: 100_000m);
        await SeedLineItemAsync(db, sov.Id, "1", 60_000m);

        var result = await service.ActivateSOVAsync(sov.Id);

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("UNBALANCED");
    }

    [Fact]
    public async Task ActivateSOVAsync_BalancedDraftLines_TransitionsToActive()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        OwnerContractService service = CreateService(db);
        OwnerContract contract = await SeedContractAsync(db, originalContractSum: 100_000m);
        OwnerScheduleOfValues sov = await SeedSovAsync(db, contract, revisedAmount: 100_000m);
        await SeedLineItemAsync(db, sov.Id, "1", 40_000m);
        await SeedLineItemAsync(db, sov.Id, "2", 60_000m);

        var result = await service.ActivateSOVAsync(sov.Id);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(OwnerSOVStatus.Active);
        result.Value.TotalScheduledValue.Should().Be(100_000m);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(101)]
    public async Task CreateContractAsync_DefaultRetainageOutOfBounds_ReturnsValidationError(decimal retainage)
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        OwnerContractService service = CreateService(db);

        var result = await service.CreateContractAsync(new CreateOwnerContractCommand(
            ProjectId: Guid.NewGuid(),
            ContractNumber: "OC-RET",
            ProjectName: "Retainage Test",
            OriginalContractSum: 100_000m,
            DefaultRetainagePercent: retainage));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Theory]
    [InlineData(-5)]
    [InlineData(200)]
    public async Task CreateContractAsync_MaterialsRetainageOutOfBounds_ReturnsValidationError(decimal retainage)
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        OwnerContractService service = CreateService(db);

        var result = await service.CreateContractAsync(new CreateOwnerContractCommand(
            ProjectId: Guid.NewGuid(),
            ContractNumber: "OC-MAT",
            ProjectName: "Materials Test",
            OriginalContractSum: 100_000m,
            RetainagePercentMaterials: retainage));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(101)]
    public async Task UpdateContractAsync_DefaultRetainageOutOfBounds_ReturnsValidationError(decimal retainage)
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        OwnerContractService service = CreateService(db);
        OwnerContract contract = await SeedContractAsync(db);

        var result = await service.UpdateContractAsync(new UpdateOwnerContractCommand(
            ContractId: contract.Id,
            DefaultRetainagePercent: retainage));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(101)]
    public async Task UpdateContractAsync_MaterialsRetainageOutOfBounds_ReturnsValidationError(decimal retainage)
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        OwnerContractService service = CreateService(db);
        OwnerContract contract = await SeedContractAsync(db);

        var result = await service.UpdateContractAsync(new UpdateOwnerContractCommand(
            ContractId: contract.Id,
            RetainagePercentMaterials: retainage));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task AddLineItemAsync_AutoSortOrder_UsesNextSortValue()
    {
        using PitbullDbContext db = TestDbContextFactory.Create();
        OwnerContractService service = CreateService(db);
        OwnerContract contract = await SeedContractAsync(db, originalContractSum: 200_000m);
        OwnerScheduleOfValues sov = await SeedSovAsync(db, contract, revisedAmount: 200_000m);
        await SeedLineItemAsync(db, sov.Id, "1", 25_000m, sortOrder: 7);

        var result = await service.AddLineItemAsync(new AddSOVLineItemCommand(
            OwnerSOVId: sov.Id,
            ItemNumber: "2",
            Description: "Concrete",
            ScheduledValue: 50_000m,
            SortOrder: 0));

        result.IsSuccess.Should().BeTrue();
        result.Value!.SortOrder.Should().Be(8);
    }

    private static async Task<OwnerContract> SeedContractAsync(
        PitbullDbContext db,
        decimal originalContractSum = 100_000m,
        decimal approvedChangeOrderAmount = 0m)
    {
        OwnerContract contract = new()
        {
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = Guid.NewGuid(),
            ContractNumber = $"OC-{Guid.NewGuid():N}".Substring(0, 8),
            ProjectName = "Seeded Project",
            OriginalContractSum = originalContractSum,
            ApprovedChangeOrderAmount = approvedChangeOrderAmount,
            ContractSumToDate = originalContractSum + approvedChangeOrderAmount,
            Status = OwnerContractStatus.Active,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        db.Set<OwnerContract>().Add(contract);
        await db.SaveChangesAsync();
        return contract;
    }

    private static async Task SeedBillingApplicationAsync(PitbullDbContext db, OwnerContract contract)
    {
        BillingApplication app = new()
        {
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = contract.ProjectId,
            OwnerContractId = contract.Id,
            OwnerScheduleOfValuesId = Guid.NewGuid(),
            ApplicationNumber = 1,
            PeriodFrom = new DateOnly(2026, 1, 1),
            PeriodThrough = new DateOnly(2026, 1, 31),
            ApplicationDate = new DateOnly(2026, 1, 31),
            OriginalContractSum = contract.OriginalContractSum,
            ContractSumToDate = contract.ContractSumToDate,
            Status = BillingApplicationStatus.Draft,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        db.Set<BillingApplication>().Add(app);
        await db.SaveChangesAsync();
    }

    private static async Task<OwnerScheduleOfValues> SeedSovAsync(
        PitbullDbContext db,
        OwnerContract contract,
        decimal revisedAmount)
    {
        OwnerScheduleOfValues sov = new()
        {
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            ProjectId = contract.ProjectId,
            OwnerContractId = contract.Id,
            Name = "Main SOV",
            OriginalContractAmount = contract.OriginalContractSum,
            ApprovedChangeOrderAmount = contract.ApprovedChangeOrderAmount,
            RevisedContractAmount = revisedAmount,
            TotalScheduledValue = 0m,
            DefaultRetainagePercent = 10m,
            Status = OwnerSOVStatus.Draft,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        db.Set<OwnerScheduleOfValues>().Add(sov);
        await db.SaveChangesAsync();
        return sov;
    }

    private static async Task SeedLineItemAsync(
        PitbullDbContext db,
        Guid sovId,
        string itemNumber,
        decimal scheduledValue,
        int sortOrder = 1)
    {
        OwnerSOVLineItem line = new()
        {
            TenantId = TestDbContextFactory.TestTenantId,
            CompanyId = TestDbContextFactory.TestCompanyId,
            OwnerScheduleOfValuesId = sovId,
            ItemNumber = itemNumber,
            Description = $"Line {itemNumber}",
            SortOrder = sortOrder,
            OriginalValue = scheduledValue,
            ScheduledValue = scheduledValue,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        };

        db.Set<OwnerSOVLineItem>().Add(line);
        await db.SaveChangesAsync();
    }
}
