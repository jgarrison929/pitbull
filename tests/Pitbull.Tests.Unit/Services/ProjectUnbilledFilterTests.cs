using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Core.Services;
using Pitbull.Projects.Domain;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.Projects.Features.ListProjects;
using Pitbull.Projects.Features.UpdateProject;
using Pitbull.Projects.Services;
using Pitbull.Tests.Unit.Helpers;
using FluentValidation;

namespace Pitbull.Tests.Unit.Services;

/// <summary>
/// Drives real <see cref="ProjectService.GetProjectsAsync"/> unbilled filter —
/// the consumer behind executive Unbilled Backlog drill.
/// </summary>
public class ProjectUnbilledFilterTests : IDisposable
{
    private readonly Pitbull.Core.Data.PitbullDbContext _db;
    private readonly ProjectService _service;
    private readonly Guid _companyId = TestDbContextFactory.TestCompanyId;
    private readonly Guid _tenantId = TestDbContextFactory.TestTenantId;

    public ProjectUnbilledFilterTests()
    {
        _db = TestDbContextFactory.Create();
        var company = new CompanyContext
        {
            CompanyId = _companyId,
            CompanyCode = "01",
            CompanyName = "Test"
        };
        var team = new Mock<IProjectTeamAssignmentService>();
        var createVal = new Mock<IValidator<CreateProjectCommand>>();
        var updateVal = new Mock<IValidator<UpdateProjectCommand>>();

        _service = new ProjectService(
            _db,
            company,
            team.Object,
            createVal.Object,
            updateVal.Object,
            null,
            NullLogger<ProjectService>.Instance);
    }

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task GetProjectsAsync_UnbilledOnly_ReturnsProjectsWithRemainingContractValue()
    {
        var fullyBilledId = Guid.NewGuid();
        var partialId = Guid.NewGuid();
        var neverBilledId = Guid.NewGuid();

        _db.Set<Project>().AddRange(
            new Project
            {
                Id = fullyBilledId,
                TenantId = _tenantId,
                CompanyId = _companyId,
                Name = "Fully Billed Job",
                Number = "P-FULL",
                Status = ProjectStatus.Active,
                ContractAmount = 100_000m,
            },
            new Project
            {
                Id = partialId,
                TenantId = _tenantId,
                CompanyId = _companyId,
                Name = "Partial Bill Job",
                Number = "P-PART",
                Status = ProjectStatus.Active,
                ContractAmount = 200_000m,
            },
            new Project
            {
                Id = neverBilledId,
                TenantId = _tenantId,
                CompanyId = _companyId,
                Name = "Never Billed Job",
                Number = "P-ZERO",
                Status = ProjectStatus.Active,
                ContractAmount = 50_000m,
            });

        var contractA = Guid.NewGuid();
        var contractB = Guid.NewGuid();
        _db.Set<BillingApplication>().AddRange(
            new BillingApplication
            {
                Id = Guid.NewGuid(),
                TenantId = _tenantId,
                CompanyId = _companyId,
                ProjectId = fullyBilledId,
                OwnerContractId = contractA,
                OwnerScheduleOfValuesId = Guid.NewGuid(),
                ApplicationNumber = 1,
                PeriodFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-1)),
                PeriodThrough = DateOnly.FromDateTime(DateTime.UtcNow),
                ApplicationDate = DateOnly.FromDateTime(DateTime.UtcNow),
                Status = BillingApplicationStatus.Paid,
                TotalCompletedAndStoredToDate = 100_000m,
                ContractSumToDate = 100_000m,
            },
            new BillingApplication
            {
                Id = Guid.NewGuid(),
                TenantId = _tenantId,
                CompanyId = _companyId,
                ProjectId = partialId,
                OwnerContractId = contractB,
                OwnerScheduleOfValuesId = Guid.NewGuid(),
                ApplicationNumber = 2,
                PeriodFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-1)),
                PeriodThrough = DateOnly.FromDateTime(DateTime.UtcNow),
                ApplicationDate = DateOnly.FromDateTime(DateTime.UtcNow),
                Status = BillingApplicationStatus.SubmittedToOwner,
                TotalCompletedAndStoredToDate = 40_000m,
                ContractSumToDate = 200_000m,
            });

        await _db.SaveChangesAsync();

        var result = await _service.GetProjectsAsync(new ListProjectsQuery(
            Status: ProjectStatus.Active,
            UnbilledOnly: true)
        {
            Page = 1,
            PageSize = 50
        });

        result.IsSuccess.Should().BeTrue();
        var items = result.Value!.Items;
        items.Select(i => i.Id).Should().Contain(partialId);
        items.Select(i => i.Id).Should().Contain(neverBilledId);
        items.Select(i => i.Id).Should().NotContain(fullyBilledId);

        var partial = items.First(i => i.Id == partialId);
        partial.BilledToDate.Should().Be(40_000m);
        partial.UnbilledAmount.Should().Be(160_000m);

        var never = items.First(i => i.Id == neverBilledId);
        never.BilledToDate.Should().Be(0m);
        never.UnbilledAmount.Should().Be(50_000m);
    }
}
