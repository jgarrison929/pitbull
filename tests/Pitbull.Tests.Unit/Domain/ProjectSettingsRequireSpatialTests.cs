using Pitbull.Core.Domain;
using Xunit;

namespace Pitbull.Tests.Unit.Domain;

/// <summary>
/// Schema defaults for RequireSpatialOnProgress (2.18.3) — optional, off by default.
/// </summary>
public class ProjectSettingsRequireSpatialTests
{
    [Fact]
    public void RequireSpatialOnProgress_defaults_to_false()
    {
        var settings = new ProjectSettings();
        Assert.False(settings.RequireSpatialOnProgress);
    }

    [Fact]
    public void RequireSpatialOnProgress_can_be_enabled()
    {
        var settings = new ProjectSettings { RequireSpatialOnProgress = true };
        Assert.True(settings.RequireSpatialOnProgress);
    }
}
