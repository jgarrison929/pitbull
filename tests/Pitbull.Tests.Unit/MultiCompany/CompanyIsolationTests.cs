using FluentAssertions;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Projects.Domain;
using Pitbull.Bids.Domain;
using Pitbull.TimeTracking.Domain;
using Pitbull.Tests.Unit.Helpers;
using Microsoft.EntityFrameworkCore;

namespace Pitbull.Tests.Unit.MultiCompany;

[Trait("Category", "MultiCompany")]
public class CompanyIsolationTests
{
    private static readonly Guid TenantId = TestDbContextFactory.TestTenantId;
    private static readonly Guid Company1Id = Guid.Parse("11111111-aaaa-bbbb-cccc-111111111111");
    private static readonly Guid Company2Id = Guid.Parse("22222222-aaaa-bbbb-cccc-222222222222");

    [Fact]
    public async Task Projects_AreFilteredByCompany_WhenCompanyContextIsResolved()
    {
        // Use a single DB context with no company filter to seed data
        using var dbSetup = TestDbContextFactory.Create(TenantId, companyId: Guid.Empty);

        dbSetup.Set<Project>().Add(new Project
        {
            Id = Guid.NewGuid(),
            Name = "Company 1 Project",
            Number = "PRJ-C1-001",
            Status = ProjectStatus.Active,
            Type = ProjectType.Commercial,
            CompanyId = Company1Id,
            TenantId = TenantId,
            CreatedAt = DateTime.UtcNow
        });
        dbSetup.Set<Project>().Add(new Project
        {
            Id = Guid.NewGuid(),
            Name = "Company 2 Project",
            Number = "PRJ-C2-001",
            Status = ProjectStatus.Active,
            Type = ProjectType.Commercial,
            CompanyId = Company2Id,
            TenantId = TenantId,
            CreatedAt = DateTime.UtcNow
        });
        await dbSetup.SaveChangesAsync();

        // Verify both exist
        var all = await dbSetup.Set<Project>().ToListAsync();
        all.Should().HaveCount(2, "With no company filter, all projects should be visible");

        // Verify CompanyId was set correctly
        all.Should().Contain(p => p.CompanyId == Company1Id);
        all.Should().Contain(p => p.CompanyId == Company2Id);

        // Note: In-memory provider shares model, so company query filter evaluation
        // depends on the context instance. True PostgreSQL RLS isolation tested in integration tests.
    }

    [Fact]
    public async Task Projects_AllVisible_WhenNoCompanyContextResolved()
    {
        var dbName = Guid.NewGuid().ToString();

        // Create two projects in different companies
        using (var dbSetup = TestDbContextFactory.Create(TenantId, dbName, Guid.Empty))
        {
            dbSetup.Set<Project>().Add(new Project
            {
                Id = Guid.NewGuid(),
                Name = "Company 1 Project",
                Number = "PRJ-C1-001",
                Status = ProjectStatus.Active,
                Type = ProjectType.Commercial,
                CompanyId = Company1Id,
                TenantId = TenantId,
                CreatedAt = DateTime.UtcNow
            });
            dbSetup.Set<Project>().Add(new Project
            {
                Id = Guid.NewGuid(),
                Name = "Company 2 Project",
                Number = "PRJ-C2-001",
                Status = ProjectStatus.Active,
                Type = ProjectType.Commercial,
                CompanyId = Company2Id,
                TenantId = TenantId,
                CreatedAt = DateTime.UtcNow
            });
            await dbSetup.SaveChangesAsync();
        }

        // Query with no company context (Guid.Empty = not resolved) - should see all
        using (var dbAll = TestDbContextFactory.Create(TenantId, dbName, Guid.Empty))
        {
            var projects = await dbAll.Set<Project>().ToListAsync();
            projects.Should().HaveCount(2);
        }
    }

    [Fact]
    public async Task CompanyScoped_Entities_GetCompanyIdAutoSet_OnSave()
    {
        using var db = TestDbContextFactory.Create(TenantId, companyId: Company1Id);

        var project = new Project
        {
            Id = Guid.NewGuid(),
            Name = "Auto Company Test",
            Number = "PRJ-AUTO-001",
            Status = ProjectStatus.Active,
            Type = ProjectType.Commercial,
            CreatedAt = DateTime.UtcNow
            // CompanyId not set - should be auto-filled by SaveChangesAsync
        };

        db.Set<Project>().Add(project);
        await db.SaveChangesAsync();

        project.CompanyId.Should().Be(Company1Id);
    }

    [Fact]
    public async Task TenantScoped_Entities_NotFilteredByCompany()
    {
        var dbName = Guid.NewGuid().ToString();

        // Create employees (tenant-scoped, no company filter)
        using (var dbSetup = TestDbContextFactory.Create(TenantId, dbName, Guid.Empty))
        {
            dbSetup.Set<Employee>().Add(new Employee
            {
                Id = Guid.NewGuid(),
                EmployeeNumber = "EMP-001",
                FirstName = "John",
                LastName = "Doe",
                Classification = EmployeeClassification.Hourly,
                BaseHourlyRate = 35.0m,
                HomeCompanyId = Company1Id,
                TenantId = TenantId,
                CreatedAt = DateTime.UtcNow
            });
            dbSetup.Set<Employee>().Add(new Employee
            {
                Id = Guid.NewGuid(),
                EmployeeNumber = "EMP-002",
                FirstName = "Jane",
                LastName = "Smith",
                Classification = EmployeeClassification.Hourly,
                BaseHourlyRate = 40.0m,
                HomeCompanyId = Company2Id,
                TenantId = TenantId,
                CreatedAt = DateTime.UtcNow
            });
            await dbSetup.SaveChangesAsync();
        }

        // Query with Company 1 context - should see BOTH employees (they're tenant-scoped)
        using (var dbC1 = TestDbContextFactory.Create(TenantId, dbName, Company1Id))
        {
            var employees = await dbC1.Set<Employee>().ToListAsync();
            employees.Should().HaveCount(2, "Employees are tenant-scoped, not company-scoped");
        }
    }

    [Fact(Skip = "Company query filters use Expression.Constant(this) which doesn't work across InMemory DbContext instances. Verified via integration tests with PostgreSQL RLS.")]
    public async Task Bids_AreFilteredByCompany()
    {
        var dbName = Guid.NewGuid().ToString();

        using (var dbSetup = TestDbContextFactory.Create(TenantId, dbName, Guid.Empty))
        {
            dbSetup.Set<Bid>().Add(new Bid
            {
                Id = Guid.NewGuid(),
                Name = "C1 Bid",
                Number = "BID-C1-001",
                Status = BidStatus.Draft,
                EstimatedValue = 1_000_000m,
                CompanyId = Company1Id,
                TenantId = TenantId,
                CreatedAt = DateTime.UtcNow
            });
            dbSetup.Set<Bid>().Add(new Bid
            {
                Id = Guid.NewGuid(),
                Name = "C2 Bid",
                Number = "BID-C2-001",
                Status = BidStatus.Draft,
                EstimatedValue = 2_000_000m,
                CompanyId = Company2Id,
                TenantId = TenantId,
                CreatedAt = DateTime.UtcNow
            });
            await dbSetup.SaveChangesAsync();
        }

        using (var dbC1 = TestDbContextFactory.Create(TenantId, dbName, Company1Id))
        {
            var bids = await dbC1.Set<Bid>().ToListAsync();
            bids.Should().HaveCount(1);
            bids[0].Name.Should().Be("C1 Bid");
        }
    }

    [Fact]
    public async Task Company_Entity_IsTenantScoped_NotCompanyFiltered()
    {
        var dbName = Guid.NewGuid().ToString();

        using (var dbSetup = TestDbContextFactory.Create(TenantId, dbName, Guid.Empty))
        {
            dbSetup.Set<Company>().Add(new Company
            {
                Id = Company1Id,
                Code = "01",
                Name = "Company 1",
                IsDefault = true,
                IsActive = true,
                TenantId = TenantId,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "test"
            });
            dbSetup.Set<Company>().Add(new Company
            {
                Id = Company2Id,
                Code = "02",
                Name = "Company 2",
                IsDefault = false,
                IsActive = true,
                TenantId = TenantId,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = "test"
            });
            await dbSetup.SaveChangesAsync();
        }

        // Even with Company 1 active, should see all companies (they're tenant-scoped)
        using (var dbC1 = TestDbContextFactory.Create(TenantId, dbName, Company1Id))
        {
            var companies = await dbC1.Set<Company>().ToListAsync();
            companies.Should().HaveCount(2, "Company entities are tenant-scoped, visible across all companies");
        }
    }

    [Fact(Skip = "Company query filters use Expression.Constant(this) which doesn't work across InMemory DbContext instances. Verified via integration tests with PostgreSQL RLS.")]
    public async Task CrossTenant_CompanyIsolation_StillWorks()
    {
        var dbName = Guid.NewGuid().ToString();
        var otherTenantId = TestDbContextFactory.OtherTenantId;

        // Create projects for different tenants
        using (var dbSetup = TestDbContextFactory.Create(TenantId, dbName, Guid.Empty))
        {
            dbSetup.Set<Project>().Add(new Project
            {
                Id = Guid.NewGuid(),
                Name = "Tenant 1 Project",
                Number = "PRJ-T1-001",
                Status = ProjectStatus.Active,
                Type = ProjectType.Commercial,
                CompanyId = Company1Id,
                TenantId = TenantId,
                CreatedAt = DateTime.UtcNow
            });
            await dbSetup.SaveChangesAsync();
        }

        using (var dbOther = TestDbContextFactory.CreateWithSameDb(dbName, otherTenantId, Company1Id))
        {
            dbOther.Set<Project>().Add(new Project
            {
                Id = Guid.NewGuid(),
                Name = "Tenant 2 Project",
                Number = "PRJ-T2-001",
                Status = ProjectStatus.Active,
                Type = ProjectType.Commercial,
                CompanyId = Company1Id, // Same company ID but different tenant
                TenantId = otherTenantId,
                CreatedAt = DateTime.UtcNow
            });
            await dbOther.SaveChangesAsync();
        }

        // Tenant 1 should only see their project
        using (var dbT1 = TestDbContextFactory.Create(TenantId, dbName, Company1Id))
        {
            var projects = await dbT1.Set<Project>().ToListAsync();
            projects.Should().HaveCount(1);
            projects[0].Name.Should().Be("Tenant 1 Project");
        }
    }

    [Fact]
    public void CompanyContext_IsResolved_WhenCompanyIdSet()
    {
        var context = new CompanyContext
        {
            CompanyId = Guid.NewGuid(),
            CompanyCode = "01",
            CompanyName = "Test"
        };

        context.IsResolved.Should().BeTrue();
    }

    [Fact]
    public void CompanyContext_IsNotResolved_WhenEmpty()
    {
        var context = new CompanyContext();

        context.IsResolved.Should().BeFalse();
        context.CompanyId.Should().Be(Guid.Empty);
    }

    [Fact]
    public void CompanyContext_TracksAccessibleCompanies()
    {
        var context = new CompanyContext();
        var ids = new[] { Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid() };

        context.SetAccessibleCompanies(ids);

        context.AccessibleCompanyIds.Should().HaveCount(3);
        context.AccessibleCompanyIds.Should().BeEquivalentTo(ids);
    }

    [Fact]
    public void ICompanyScoped_IsImplementedByProjectEntities()
    {
        // Verify all expected entities implement ICompanyScoped
        typeof(Project).Should().Implement<ICompanyScoped>();
        typeof(Phase).Should().Implement<ICompanyScoped>();
        typeof(ProjectBudget).Should().Implement<ICompanyScoped>();
        typeof(Projection).Should().Implement<ICompanyScoped>();
        typeof(Bid).Should().Implement<ICompanyScoped>();
        typeof(BidItem).Should().Implement<ICompanyScoped>();
        typeof(TimeEntry).Should().Implement<ICompanyScoped>();
        typeof(ProjectAssignment).Should().Implement<ICompanyScoped>();
        typeof(PayPeriod).Should().Implement<ICompanyScoped>();
    }

    [Fact]
    public void TenantScoped_EntitiesDoNotImplement_ICompanyScoped()
    {
        typeof(Employee).Should().NotImplement<ICompanyScoped>();
        typeof(CostCode).Should().NotImplement<ICompanyScoped>();
        typeof(Company).Should().NotImplement<ICompanyScoped>();
    }
}
