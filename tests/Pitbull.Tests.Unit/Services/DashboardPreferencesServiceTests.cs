using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Api.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Tests.Unit.Services;

public class DashboardPreferencesServiceTests : IDisposable
{
    private static readonly Guid TestTenantId = Guid.NewGuid();
    private static readonly Guid TestUserId = Guid.NewGuid();
    private readonly PitbullDbContext _db;
    private readonly DashboardPreferencesService _service;

    public DashboardPreferencesServiceTests()
    {
        var tenantContext = new TenantContext { TenantId = TestTenantId, TenantName = "Test" };
        var companyContext = new CompanyContext();

        var options = new DbContextOptionsBuilder<PitbullDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new PitbullDbContext(options, tenantContext, companyContext);
        _db.Database.EnsureCreated();
        _service = new DashboardPreferencesService(_db);
    }

    public void Dispose()
    {
        _db.Dispose();
        GC.SuppressFinalize(this);
    }

    #region GetPreferencesAsync

    [Fact]
    public async Task GetPreferencesAsync_NoSavedPreference_ReturnsDefault()
    {
        var result = await _service.GetPreferencesAsync(TestUserId);

        result.Layout.Should().Be("default");
        result.Widgets.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task GetPreferencesAsync_WithSavedPreference_ReturnsSavedLayout()
    {
        await _service.SavePreferencesAsync(TestUserId, "pm");

        var result = await _service.GetPreferencesAsync(TestUserId);

        result.Layout.Should().Be("pm");
    }

    [Fact]
    public async Task GetPreferencesAsync_DifferentUsers_ReturnsDifferentPreferences()
    {
        var user1 = Guid.NewGuid();
        var user2 = Guid.NewGuid();

        await _service.SavePreferencesAsync(user1, "pm");
        await _service.SavePreferencesAsync(user2, "executive");

        var result1 = await _service.GetPreferencesAsync(user1);
        var result2 = await _service.GetPreferencesAsync(user2);

        result1.Layout.Should().Be("pm");
        result2.Layout.Should().Be("executive");
    }

    #endregion

    #region SavePreferencesAsync

    [Fact]
    public async Task SavePreferencesAsync_ValidLayout_CreatesPreference()
    {
        var result = await _service.SavePreferencesAsync(TestUserId, "controller");

        result.Layout.Should().Be("controller");
        result.Widgets.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task SavePreferencesAsync_UpdateExisting_ChangesLayout()
    {
        await _service.SavePreferencesAsync(TestUserId, "pm");
        var result = await _service.SavePreferencesAsync(TestUserId, "executive");

        result.Layout.Should().Be("executive");
    }

    [Fact]
    public async Task SavePreferencesAsync_InvalidLayout_ThrowsArgumentException()
    {
        var act = () => _service.SavePreferencesAsync(TestUserId, "invalid-layout");

        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*invalid-layout*");
    }

    [Theory]
    [InlineData("default")]
    [InlineData("pm")]
    [InlineData("controller")]
    [InlineData("field")]
    [InlineData("executive")]
    public async Task SavePreferencesAsync_AllValidLayouts_Succeed(string layout)
    {
        var result = await _service.SavePreferencesAsync(TestUserId, layout);

        result.Layout.Should().Be(layout);
    }

    [Fact]
    public async Task SavePreferencesAsync_Upsert_DoesNotCreateDuplicate()
    {
        await _service.SavePreferencesAsync(TestUserId, "pm");
        await _service.SavePreferencesAsync(TestUserId, "executive");

        var count = await _db.DashboardPreferences.CountAsync(p => p.UserId == TestUserId);
        count.Should().Be(1);
    }

    #endregion

    #region SaveWidgetConfigurationAsync

    [Fact]
    public async Task SaveWidgetConfigurationAsync_NoExistingPreference_CreatesWithWidgets()
    {
        var widgets = new List<WidgetDto>
        {
            new("w1", "kpi-cards", 0, 0, 4, 1, true),
            new("w2", "recent-activity", 1, 0, 2, 2, false)
        };

        var result = await _service.SaveWidgetConfigurationAsync(TestUserId, widgets);

        result.Layout.Should().Be("default");
        result.Widgets.Should().HaveCount(2);
        result.Widgets![0].Type.Should().Be("kpi-cards");
        result.Widgets[1].Visible.Should().BeFalse();
    }

    [Fact]
    public async Task SaveWidgetConfigurationAsync_ExistingPreference_UpdatesWidgets()
    {
        await _service.SavePreferencesAsync(TestUserId, "pm");

        var widgets = new List<WidgetDto>
        {
            new("w1", "kpi-cards", 0, 0, 4, 1, true)
        };

        var result = await _service.SaveWidgetConfigurationAsync(TestUserId, widgets);

        result.Layout.Should().Be("pm");
        result.Widgets.Should().HaveCount(1);
    }

    [Fact]
    public async Task SaveWidgetConfigurationAsync_WidgetsPersistedAndRetrievable()
    {
        var widgets = new List<WidgetDto>
        {
            new("w1", "kpi-cards", 0, 0, 4, 1, true),
            new("w2", "project-status", 1, 0, 4, 2, true)
        };

        await _service.SaveWidgetConfigurationAsync(TestUserId, widgets);

        var retrieved = await _service.GetPreferencesAsync(TestUserId);

        retrieved.Widgets.Should().HaveCount(2);
        retrieved.Widgets![0].Id.Should().Be("w1");
        retrieved.Widgets[1].Type.Should().Be("project-status");
        retrieved.Widgets[1].Row.Should().Be(1);
        retrieved.Widgets[1].Width.Should().Be(4);
    }

    #endregion

    #region ResetToDefaultAsync

    [Fact]
    public async Task ResetToDefaultAsync_WithSavedPreference_DeletesAndReturnsDefault()
    {
        await _service.SavePreferencesAsync(TestUserId, "executive");

        var result = await _service.ResetToDefaultAsync(TestUserId);

        result.Layout.Should().Be("default");
        result.Widgets.Should().NotBeNullOrEmpty();

        var count = await _db.DashboardPreferences.CountAsync(p => p.UserId == TestUserId);
        count.Should().Be(0);
    }

    [Fact]
    public async Task ResetToDefaultAsync_NoSavedPreference_ReturnsDefault()
    {
        var result = await _service.ResetToDefaultAsync(TestUserId);

        result.Layout.Should().Be("default");
    }

    #endregion

    #region GetTemplate

    [Theory]
    [InlineData("pm")]
    [InlineData("controller")]
    [InlineData("field")]
    [InlineData("executive")]
    [InlineData("default")]
    public void GetTemplate_ValidRole_ReturnsTemplate(string role)
    {
        var template = _service.GetTemplate(role);

        template.Should().NotBeNull();
        template.Role.Should().Be(role);
        template.Layout.Should().Be(role);
        template.Widgets.Should().NotBeEmpty();
    }

    [Fact]
    public void GetTemplate_UnknownRole_ReturnsDefaultTemplate()
    {
        var template = _service.GetTemplate("unknown");

        template.Role.Should().Be("default");
    }

    [Fact]
    public void GetTemplate_AllTemplatesHaveKpiCards()
    {
        var roles = new[] { "default", "pm", "controller", "field", "executive" };

        foreach (var role in roles)
        {
            var template = _service.GetTemplate(role);
            template.Widgets.Should().Contain(w => w.Type == "kpi-cards",
                because: $"template '{role}' should have kpi-cards widget");
        }
    }

    #endregion
}
