using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Pitbull.Api.Controllers;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Api;

public class AdminAuditControllerTests
{
    private static readonly Guid TestTenantId = TestDbContextFactory.TestTenantId;
    private static readonly Guid TestUserId = Guid.NewGuid();
    private static readonly Guid OtherUserId = Guid.NewGuid();

    private static AdminAuditController CreateController(PitbullDbContext db)
    {
        var controller = new AdminAuditController(db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
        return controller;
    }

    private static AuditLog CreateLog(
        AuditAction action = AuditAction.Create,
        string resourceType = "Project",
        Guid? userId = null,
        bool success = true,
        DateTime? timestamp = null)
    {
        var log = AuditLog.Create(
            tenantId: TestTenantId,
            userId: userId ?? TestUserId,
            userEmail: "test@test.com",
            userName: "Test User",
            action: action,
            resourceType: resourceType,
            resourceId: Guid.NewGuid().ToString(),
            description: $"{action} {resourceType}",
            details: null,
            ipAddress: "127.0.0.1",
            userAgent: "TestAgent",
            success: success,
            errorMessage: success ? null : "Error occurred");
        return log;
    }

    private static async Task SeedLogs(PitbullDbContext db, params AuditLog[] logs)
    {
        foreach (var log in logs)
            db.Set<AuditLog>().Add(log);
        await db.SaveChangesAsync();
    }

    #region ListLogs

    [Fact]
    public async Task ListLogs_ReturnsPaginatedResults()
    {
        using var db = TestDbContextFactory.Create();
        var controller = CreateController(db);

        var log1 = CreateLog();
        var log2 = CreateLog(AuditAction.Update);
        await SeedLogs(db, log1, log2);

        var result = await controller.ListLogs(null, null, null, null, null, null, null);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<AuditLogListResponse>().Subject;
        response.Items.Should().HaveCount(2);
        response.TotalCount.Should().Be(2);
        response.Page.Should().Be(1);
        response.PageSize.Should().Be(25);
    }

    [Fact]
    public async Task ListLogs_FiltersByUserId()
    {
        using var db = TestDbContextFactory.Create();
        var controller = CreateController(db);

        var log1 = CreateLog(userId: TestUserId);
        var log2 = CreateLog(userId: OtherUserId);
        await SeedLogs(db, log1, log2);

        var result = await controller.ListLogs(userId: TestUserId, null, null, null, null, null, null);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<AuditLogListResponse>().Subject;
        response.Items.Should().HaveCount(1);
        response.Items[0].UserId.Should().Be(TestUserId);
    }

    [Fact]
    public async Task ListLogs_FiltersByAction()
    {
        using var db = TestDbContextFactory.Create();
        var controller = CreateController(db);

        var log1 = CreateLog(action: AuditAction.Create);
        var log2 = CreateLog(action: AuditAction.Delete);
        var log3 = CreateLog(action: AuditAction.Create);
        await SeedLogs(db, log1, log2, log3);

        var result = await controller.ListLogs(null, nameof(AuditAction.Create), null, null, null, null, null);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<AuditLogListResponse>().Subject;
        response.Items.Should().HaveCount(2);
        response.Items.Should().AllSatisfy(i => i.Action.Should().Be("Create"));
    }

    [Fact]
    public async Task ListLogs_FiltersByResourceType()
    {
        using var db = TestDbContextFactory.Create();
        var controller = CreateController(db);

        var log1 = CreateLog(resourceType: "Project");
        var log2 = CreateLog(resourceType: "Bid");
        await SeedLogs(db, log1, log2);

        var result = await controller.ListLogs(null, null, "Project", null, null, null, null);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<AuditLogListResponse>().Subject;
        response.Items.Should().HaveCount(1);
        response.Items[0].ResourceType.Should().Be("Project");
    }

    [Fact]
    public async Task ListLogs_FiltersByDateRange()
    {
        using var db = TestDbContextFactory.Create();
        var controller = CreateController(db);

        // Create logs - all will have Timestamp = DateTime.UtcNow (set by the entity)
        var log1 = CreateLog();
        var log2 = CreateLog();
        await SeedLogs(db, log1, log2);

        var from = DateTime.UtcNow.AddMinutes(-5);
        var to = DateTime.UtcNow.AddMinutes(5);

        var result = await controller.ListLogs(null, null, null, from, to, null, null);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<AuditLogListResponse>().Subject;
        response.Items.Should().HaveCount(2);
    }

    [Fact]
    public async Task ListLogs_FiltersBySuccess()
    {
        using var db = TestDbContextFactory.Create();
        var controller = CreateController(db);

        var log1 = CreateLog(success: true);
        var log2 = CreateLog(success: false);
        await SeedLogs(db, log1, log2);

        var result = await controller.ListLogs(null, null, null, null, null, success: false, search: null);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<AuditLogListResponse>().Subject;
        response.Items.Should().HaveCount(1);
        response.Items[0].Success.Should().BeFalse();
    }

    [Fact]
    public async Task ListLogs_PaginationWorks()
    {
        using var db = TestDbContextFactory.Create();
        var controller = CreateController(db);

        // Seed 5 logs
        var logs = Enumerable.Range(0, 5)
            .Select(_ => CreateLog())
            .ToArray();
        await SeedLogs(db, logs);

        // Page 1, pageSize 2
        var result = await controller.ListLogs(null, null, null, null, null, null, search: null, page: 1, pageSize: 2);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<AuditLogListResponse>().Subject;
        response.Items.Should().HaveCount(2);
        response.TotalCount.Should().Be(5);
        response.TotalPages.Should().Be(3);
        response.Page.Should().Be(1);
        response.PageSize.Should().Be(2);
    }

    [Fact]
    public async Task ListLogs_Page2_ReturnsCorrectItems()
    {
        using var db = TestDbContextFactory.Create();
        var controller = CreateController(db);

        var logs = Enumerable.Range(0, 5)
            .Select(_ => CreateLog())
            .ToArray();
        await SeedLogs(db, logs);

        var result = await controller.ListLogs(null, null, null, null, null, null, search: null, page: 2, pageSize: 2);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<AuditLogListResponse>().Subject;
        response.Items.Should().HaveCount(2);
        response.Page.Should().Be(2);
    }

    #endregion

    #region GetResourceTypes

    [Fact]
    public async Task GetResourceTypes_ReturnsDistinctTypes()
    {
        using var db = TestDbContextFactory.Create();
        var controller = CreateController(db);

        var log1 = CreateLog(resourceType: "Project");
        var log2 = CreateLog(resourceType: "Bid");
        var log3 = CreateLog(resourceType: "Project"); // duplicate
        await SeedLogs(db, log1, log2, log3);

        var result = await controller.GetResourceTypes();

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var types = okResult.Value.Should().BeAssignableTo<List<string>>().Subject;
        types.Should().HaveCount(2);
        types.Should().Contain("Project");
        types.Should().Contain("Bid");
    }

    #endregion

    #region GetActions

    [Fact]
    public void GetActions_ReturnsEnumNames()
    {
        using var db = TestDbContextFactory.Create();
        var controller = CreateController(db);

        var result = controller.GetActions();

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var actions = okResult.Value.Should().BeAssignableTo<List<string>>().Subject;
        actions.Should().Contain("Create");
        actions.Should().Contain("Delete");
        actions.Should().Contain("Login");
        actions.Should().Contain("Export");
        actions.Count.Should().Be(Enum.GetNames<AuditAction>().Length);
    }

    #endregion
}
