using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Pitbull.Billing.Features.AiaBilling;
using Pitbull.Billing.Services;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Billing;

public sealed class OwnerContractValidationTests
{
    [Fact]
    public async Task CreateContract_RejectsOversizedContractNumber()
    {
        using var db = TestDbContextFactory.Create();
        var service = new OwnerContractService(db, NullLogger<OwnerContractService>.Instance);

        var result = await service.CreateContractAsync(new CreateOwnerContractCommand(
            ProjectId: Guid.NewGuid(),
            ContractNumber: new string('C', 101),
            ProjectName: "Test Project",
            OriginalContractSum: 100_000m));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("100");
    }

    [Fact]
    public async Task CreateContract_RejectsSumOverMax()
    {
        using var db = TestDbContextFactory.Create();
        var service = new OwnerContractService(db, NullLogger<OwnerContractService>.Instance);

        var result = await service.CreateContractAsync(new CreateOwnerContractCommand(
            ProjectId: Guid.NewGuid(),
            ContractNumber: "OC-001",
            ProjectName: "Test Project",
            OriginalContractSum: 1_000_000_000.01m));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("1,000,000,000");
    }

    [Fact]
    public async Task CreateContract_RejectsInvalidPaymentTerms()
    {
        using var db = TestDbContextFactory.Create();
        var service = new OwnerContractService(db, NullLogger<OwnerContractService>.Instance);

        var result = await service.CreateContractAsync(new CreateOwnerContractCommand(
            ProjectId: Guid.NewGuid(),
            ContractNumber: "OC-002",
            ProjectName: "Test Project",
            OriginalContractSum: 50_000m,
            PaymentTermsDays: 400));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("VALIDATION_ERROR");
        result.Error.Should().Contain("Payment terms");
    }
}
