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
    public void Email_returns_stable_fingerprint_without_address()
    {
        var a = LogSafe.Email("ceo@demo.local");
        var b = LogSafe.Email("ceo@demo.local");
        Assert.Equal(a, b);
        Assert.StartsWith("email#", a);
        Assert.DoesNotContain("ceo", a, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("@", a);
        Assert.DoesNotContain("demo.local", a);
    }

    [Fact]
    public void Email_empty_returns_placeholder()
    {
        Assert.Equal("[no-email]", LogSafe.Email(null));
        Assert.Equal("[no-email]", LogSafe.Email("  "));
    }

    [Fact]
    public void Email_strips_newlines_and_does_not_echo_input()
    {
        var result = LogSafe.Email("user@ex\nample.com");
        Assert.DoesNotContain("\n", result);
        Assert.DoesNotContain("user", result, StringComparison.OrdinalIgnoreCase);
        Assert.StartsWith("email#", result);
    }

    [Fact]
    public void Text_always_strips_cr_lf_even_when_mixed_with_controls()
    {
        var result = LogSafe.Text("a\0b\rc\nd");
        Assert.Equal("abcd", result);
    }
}
