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

    #region GetLog

    [Fact]
    public async Task GetLog_ReturnsLog_WhenFound()
    {
        using var db = TestDbContextFactory.Create();
        var controller = CreateController(db);

        var log = CreateLog(AuditAction.Update, "Bid");
        await SeedLogs(db, log);

        var result = await controller.GetLog(log.Id);

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = okResult.Value.Should().BeOfType<AuditLogDto>().Subject;
        dto.Id.Should().Be(log.Id);
        dto.Action.Should().Be("Update");
        dto.ResourceType.Should().Be("Bid");
    }

    [Fact]
    public async Task GetLog_Returns404_WhenNotFound()
    {
        using var db = TestDbContextFactory.Create();
        var controller = CreateController(db);

        var result = await controller.GetLog(Guid.NewGuid());

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    #endregion

    #region GetSummary

    [Fact]
    public async Task GetSummary_ReturnsValidSummary()
    {
        using var db = TestDbContextFactory.Create();
        var controller = CreateController(db);

        // Seed logs with today's timestamps (AuditLog.Create sets Timestamp = UtcNow)
        var log1 = CreateLog(AuditAction.Create, "Project");
        var log2 = CreateLog(AuditAction.Login, "User");
        var log3 = CreateLog(AuditAction.Create, "Bid");
        await SeedLogs(db, log1, log2, log3);

        var result = await controller.GetSummary();

        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var summary = okResult.Value.Should().BeOfType<AuditLogSummaryResponse>().Subject;
        summary.TotalEventsToday.Should().Be(3);
        summary.LoginCountToday.Should().Be(1);
    }

    [Fact]
    public async Task GetSummary_ActionCounts_GroupsByAction()
    {
        using var db = TestDbContextFactory.Create();
        var controller = CreateController(db);

        await SeedLogs(db,
            CreateLog(AuditAction.Create),
            CreateLog(AuditAction.Create),
            CreateLog(AuditAction.Delete));

        var result = await controller.GetSummary();

        var summary = (result as OkObjectResult)!.Value as AuditLogSummaryResponse;
        summary!.ActionCounts.Should().Contain(a => a.Action == "Create" && a.Count == 2);
        summary.ActionCounts.Should().Contain(a => a.Action == "Delete" && a.Count == 1);
    }

    [Fact]
    public async Task GetSummary_RecentActivity_ReturnsUpTo10()
    {
        using var db = TestDbContextFactory.Create();
        var controller = CreateController(db);

        var logs = Enumerable.Range(0, 15).Select(_ => CreateLog()).ToArray();
        await SeedLogs(db, logs);

        var result = await controller.GetSummary();

        var summary = (result as OkObjectResult)!.Value as AuditLogSummaryResponse;
        summary!.RecentActivity.Should().HaveCount(10);
    }

    [Fact]
    public async Task GetSummary_EmptyDatabase_ReturnsZeroCounts()
    {
        using var db = TestDbContextFactory.Create();
        var controller = CreateController(db);

        var result = await controller.GetSummary();

        var summary = (result as OkObjectResult)!.Value as AuditLogSummaryResponse;
        summary!.TotalEventsToday.Should().Be(0);
        summary.LoginCountToday.Should().Be(0);
        summary.RecentActivity.Should().BeEmpty();
    }

    #endregion

    #region ExportCsv

    [Fact]
    public async Task ExportCsv_ReturnsFileResult()
    {
        using var db = TestDbContextFactory.Create();
        var controller = CreateController(db);

        await SeedLogs(db, CreateLog());

        var result = await controller.ExportCsv(null, null, null, null, null);

        result.Should().BeOfType<FileContentResult>();
        var file = (FileContentResult)result;
        file.ContentType.Should().Be("text/csv");
        file.FileDownloadName.Should().StartWith("audit-logs-");
        file.FileDownloadName.Should().EndWith(".csv");
    }

    [Fact]
    public async Task ExportCsv_ContainsHeaderRow()
    {
        using var db = TestDbContextFactory.Create();
        var controller = CreateController(db);

        await SeedLogs(db, CreateLog());

        var result = (FileContentResult)await controller.ExportCsv(null, null, null, null, null);
        var csv = System.Text.Encoding.UTF8.GetString(result.FileContents);

        csv.Should().StartWith("Timestamp,User,Email,Action,Resource Type,Resource ID,Description,IP Address,Success");
    }

    [Fact]
    public async Task ExportCsv_ContainsLogData()
    {
        using var db = TestDbContextFactory.Create();
        var controller = CreateController(db);

        await SeedLogs(db, CreateLog(AuditAction.Create, "Project"));

        var result = (FileContentResult)await controller.ExportCsv(null, null, null, null, null);
        var csv = System.Text.Encoding.UTF8.GetString(result.FileContents);
        var lines = csv.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        lines.Should().HaveCountGreaterThan(1);
        lines[1].Should().Contain("Create");
        lines[1].Should().Contain("Project");
    }

    [Fact]
    public async Task ExportCsv_FiltersByAction()
    {
        using var db = TestDbContextFactory.Create();
        var controller = CreateController(db);

        await SeedLogs(db, CreateLog(AuditAction.Create), CreateLog(AuditAction.Delete));

        var result = (FileContentResult)await controller.ExportCsv(null, "Create", null, null, null);
        var csv = System.Text.Encoding.UTF8.GetString(result.FileContents);
        var lines = csv.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        // Header + 1 data row (only Create)
        lines.Should().HaveCount(2);
    }

    #endregion

    #region ListLogs — search

    [Fact]
    public async Task ListLogs_Search_MatchesDescription()
    {
        using var db = TestDbContextFactory.Create();
        var controller = CreateController(db);

        await SeedLogs(db,
            CreateLog(AuditAction.Create, "Project"),   // description = "Create Project"
            CreateLog(AuditAction.Delete, "Bid"));       // description = "Delete Bid"

        var result = await controller.ListLogs(null, null, null, null, null, null, search: "Project");

        var response = ((OkObjectResult)result).Value as AuditLogListResponse;
        response!.Items.Should().HaveCount(1);
        response.Items[0].Description.Should().Contain("Project");
    }

    #endregion

    #region ListLogs — pageSize clamping

    [Fact]
    public async Task ListLogs_ClampsPageSizeToMax100()
    {
        using var db = TestDbContextFactory.Create();
        var controller = CreateController(db);
        await SeedLogs(db, CreateLog());

        var result = await controller.ListLogs(null, null, null, null, null, null, null, page: 1, pageSize: 200);

        var response = ((OkObjectResult)result).Value as AuditLogListResponse;
        response!.PageSize.Should().Be(100);
    }

    [Fact]
    public async Task ListLogs_ClampsPageSizeToMin1()
    {
        using var db = TestDbContextFactory.Create();
        var controller = CreateController(db);
        await SeedLogs(db, CreateLog());

        var result = await controller.ListLogs(null, null, null, null, null, null, null, page: 1, pageSize: 0);

        var response = ((OkObjectResult)result).Value as AuditLogListResponse;
        response!.PageSize.Should().Be(1);
    }

    #endregion
}
