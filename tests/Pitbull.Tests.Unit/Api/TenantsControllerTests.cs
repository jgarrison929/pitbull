using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pitbull.Api.Controllers;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Api;

public class TenantsControllerTests
{
    private static readonly Guid TestTenantId = TestDbContextFactory.TestTenantId;

    private static TenantsController CreateController(PitbullDbContext db, ITenantContext tenantContext)
    {
        var controller = new TenantsController(db, tenantContext);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
        return controller;
    }

    private static ITenantContext CreateTenantContext(Guid tenantId)
    {
        var mock = new Mock<ITenantContext>();
        mock.Setup(t => t.TenantId).Returns(tenantId);
        mock.Setup(t => t.TenantName).Returns("Test Tenant");
        mock.Setup(t => t.IsResolved).Returns(true);
        return mock.Object;
    }

    #region Create

    [Fact]
    public async Task Create_Success_Returns201()
    {
        using var db = TestDbContextFactory.Create();
        var tenantCtx = CreateTenantContext(TestTenantId);
        var controller = CreateController(db, tenantCtx);

        var request = new CreateTenantRequest("Acme Construction LLC");
        var result = await controller.Create(request);

        var createdResult = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        createdResult.StatusCode.Should().Be(201);
        var response = createdResult.Value.Should().BeOfType<TenantResponse>().Subject;
        response.Name.Should().Be("Acme Construction LLC");
        response.Status.Should().Be("Active");
        response.Plan.Should().Be("Standard");
    }

    [Fact]
    public async Task Create_GeneratesSlugFromName()
    {
        using var db = TestDbContextFactory.Create();
        var tenantCtx = CreateTenantContext(TestTenantId);
        var controller = CreateController(db, tenantCtx);

        var request = new CreateTenantRequest("Acme Construction LLC");
        var result = await controller.Create(request);

        var createdResult = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        var response = createdResult.Value.Should().BeOfType<TenantResponse>().Subject;
        response.Slug.Should().Be("acme-construction-llc");
    }

    [Fact]
    public async Task Create_GeneratesSlug_RemovesApostrophes()
    {
        using var db = TestDbContextFactory.Create();
        var tenantCtx = CreateTenantContext(TestTenantId);
        var controller = CreateController(db, tenantCtx);

        var request = new CreateTenantRequest("O'Brien's Builders");
        var result = await controller.Create(request);

        var createdResult = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        var response = createdResult.Value.Should().BeOfType<TenantResponse>().Subject;
        response.Slug.Should().Be("obriens-builders");
    }

    [Fact]
    public async Task Create_DuplicateSlug_Returns409()
    {
        using var db = TestDbContextFactory.Create();
        var tenantCtx = CreateTenantContext(TestTenantId);
        var controller = CreateController(db, tenantCtx);

        // Pre-seed a tenant with the same slug
        db.Tenants.Add(new Tenant
        {
            Name = "Acme Construction LLC",
            Slug = "acme-construction-llc"
        });
        await db.SaveChangesAsync();

        var request = new CreateTenantRequest("Acme Construction LLC");
        var result = await controller.Create(request);

        var conflictResult = result.Should().BeOfType<ConflictObjectResult>().Subject;
        conflictResult.StatusCode.Should().Be(409);
    }

    #endregion

    #region GetById

    [Fact]
    public async Task GetById_MatchesTenantContext_ReturnsTenant()
    {
        using var db = TestDbContextFactory.Create();
        var tenantId = Guid.NewGuid();
        var tenantCtx = CreateTenantContext(tenantId);
        var controller = CreateController(db, tenantCtx);

        var tenant = new Tenant
        {
            Id = tenantId,
            Name = "My Tenant",
            Slug = "my-tenant",
            Status = TenantStatus.Active
        };
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        var result = await controller.GetById(tenantId);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<TenantResponse>().Subject;
        response.Id.Should().Be(tenantId);
        response.Name.Should().Be("My Tenant");
    }

    [Fact]
    public async Task GetById_DifferentTenant_Returns404()
    {
        using var db = TestDbContextFactory.Create();
        var tenantCtx = CreateTenantContext(TestTenantId);
        var controller = CreateController(db, tenantCtx);

        var otherTenantId = Guid.NewGuid();
        var result = await controller.GetById(otherTenantId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetById_InactiveTenant_Returns404()
    {
        using var db = TestDbContextFactory.Create();
        var tenantId = Guid.NewGuid();
        var tenantCtx = CreateTenantContext(tenantId);
        var controller = CreateController(db, tenantCtx);

        var tenant = new Tenant
        {
            Id = tenantId,
            Name = "Suspended Tenant",
            Slug = "suspended-tenant",
            Status = TenantStatus.Suspended
        };
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        var result = await controller.GetById(tenantId);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    #endregion

    #region GetCurrent

    [Fact]
    public async Task GetCurrent_ReturnsCurrentTenant()
    {
        using var db = TestDbContextFactory.Create();
        var tenantId = Guid.NewGuid();
        var tenantCtx = CreateTenantContext(tenantId);
        var controller = CreateController(db, tenantCtx);

        var tenant = new Tenant
        {
            Id = tenantId,
            Name = "Current Tenant",
            Slug = "current-tenant",
            Status = TenantStatus.Active
        };
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        var result = await controller.GetCurrent();

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<TenantResponse>().Subject;
        response.Id.Should().Be(tenantId);
        response.Name.Should().Be("Current Tenant");
    }

    [Fact]
    public async Task GetCurrent_NotFound_Returns404()
    {
        using var db = TestDbContextFactory.Create();
        var tenantId = Guid.NewGuid();
        var tenantCtx = CreateTenantContext(tenantId);
        var controller = CreateController(db, tenantCtx);

        // No tenant seeded
        var result = await controller.GetCurrent();

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetCurrent_InactiveTenant_Returns404()
    {
        using var db = TestDbContextFactory.Create();
        var tenantId = Guid.NewGuid();
        var tenantCtx = CreateTenantContext(tenantId);
        var controller = CreateController(db, tenantCtx);

        var tenant = new Tenant
        {
            Id = tenantId,
            Name = "Deactivated Tenant",
            Slug = "deactivated-tenant",
            Status = TenantStatus.Deactivated
        };
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        var result = await controller.GetCurrent();

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    #endregion
}
