using Pitbull.Core.Logging;
using Xunit;

namespace Pitbull.Tests.Unit.Logging;

public class LogSafeTests
{
    [Fact]
    public void Text_strips_cr_lf()
    {
        var result = LogSafe.Text("hello\r\nWORLD");
        Assert.Equal("helloWORLD", result);
        Assert.DoesNotContain("\n", result);
        Assert.DoesNotContain("\r", result);
    }

    [Fact]
    public void Text_preserves_normal_text()
    {
        Assert.Equal("Project Alpha", LogSafe.Text("Project Alpha"));
    }

    [Fact]
    public void Text_null_returns_empty()
    {
        Assert.Equal(string.Empty, LogSafe.Text((string?)null));
    }

    [Fact]
    public void Email_redacts_local_part()
    {
        Assert.Equal("***@demo.local", LogSafe.Email("ceo@demo.local"));
    }

    [Fact]
    public void Email_empty_returns_placeholder()
    {
        Assert.Equal("[no-email]", LogSafe.Email(null));
        Assert.Equal("[no-email]", LogSafe.Email("  "));
    }

    [Fact]
    public void Email_strips_newlines_in_domain()
    {
        var result = LogSafe.Email("user@ex\nample.com");
        Assert.DoesNotContain("\n", result);
        Assert.StartsWith("***@", result);
    }
}
