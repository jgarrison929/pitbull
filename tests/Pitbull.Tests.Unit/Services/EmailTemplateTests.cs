using FluentAssertions;
using Pitbull.Api.Services;

namespace Pitbull.Tests.Unit.Services;

public class EmailTemplateTests
{
    #region VerificationEmail

    [Fact]
    public void VerificationEmail_ContainsVerificationUrl()
    {
        var html = EmailTemplates.VerificationEmail("Alice", "https://app.example.com/verify?token=abc123");

        html.Should().Contain("https://app.example.com/verify?token=abc123");
    }

    [Fact]
    public void VerificationEmail_ContainsUserName()
    {
        var html = EmailTemplates.VerificationEmail("Alice", "https://example.com/verify");

        html.Should().Contain("Alice");
    }

    [Fact]
    public void VerificationEmail_HtmlEncodesUserName()
    {
        var html = EmailTemplates.VerificationEmail("<script>alert(1)</script>", "https://example.com/verify");

        html.Should().NotContain("<script>");
        html.Should().Contain("&lt;script&gt;alert(1)&lt;/script&gt;");
    }

    #endregion

    #region PasswordResetEmail

    [Fact]
    public void PasswordResetEmail_ContainsResetUrl()
    {
        var html = EmailTemplates.PasswordResetEmail("Bob", "https://app.example.com/reset?token=xyz");

        html.Should().Contain("https://app.example.com/reset?token=xyz");
    }

    [Fact]
    public void PasswordResetEmail_ContainsUserName()
    {
        var html = EmailTemplates.PasswordResetEmail("Bob", "https://example.com/reset");

        html.Should().Contain("Bob");
    }

    [Fact]
    public void PasswordResetEmail_HtmlEncodesUserName()
    {
        var html = EmailTemplates.PasswordResetEmail("<img onerror=alert(1)>", "https://example.com/reset");

        html.Should().NotContain("<img onerror");
        html.Should().Contain("&lt;img onerror=alert(1)&gt;");
    }

    #endregion

    #region InvitationEmail

    [Fact]
    public void InvitationEmail_ContainsInviteUrl()
    {
        var html = EmailTemplates.InvitationEmail("Alice", "Acme Corp", "https://app.example.com/invite?token=inv");

        html.Should().Contain("https://app.example.com/invite?token=inv");
    }

    [Fact]
    public void InvitationEmail_ContainsInviterName()
    {
        var html = EmailTemplates.InvitationEmail("Alice", "Acme Corp", "https://example.com/invite");

        html.Should().Contain("Alice");
    }

    [Fact]
    public void InvitationEmail_ContainsCompanyName()
    {
        var html = EmailTemplates.InvitationEmail("Alice", "Acme Corp", "https://example.com/invite");

        html.Should().Contain("Acme Corp");
    }

    [Fact]
    public void InvitationEmail_HtmlEncodesInviterName()
    {
        var html = EmailTemplates.InvitationEmail("<script>alert('xss')</script>", "Acme Corp", "https://example.com/invite");

        html.Should().NotContain("<script>alert('xss')</script>");
        html.Should().Contain("&lt;script&gt;");
    }

    [Fact]
    public void InvitationEmail_HtmlEncodesCompanyName()
    {
        var html = EmailTemplates.InvitationEmail("Alice", "<b>Evil Corp</b>", "https://example.com/invite");

        html.Should().NotContain("<b>Evil Corp</b>");
        html.Should().Contain("&lt;b&gt;Evil Corp&lt;/b&gt;");
    }

    #endregion

    #region WelcomeEmail

    [Fact]
    public void WelcomeEmail_ContainsUserName()
    {
        var html = EmailTemplates.WelcomeEmail("Charlie", "BuildCo", "https://example.com/dashboard");

        html.Should().Contain("Charlie");
    }

    [Fact]
    public void WelcomeEmail_ContainsCompanyName()
    {
        var html = EmailTemplates.WelcomeEmail("Charlie", "BuildCo", "https://example.com/dashboard");

        html.Should().Contain("BuildCo");
    }

    [Fact]
    public void WelcomeEmail_ContainsDashboardUrl()
    {
        var html = EmailTemplates.WelcomeEmail("Charlie", "BuildCo", "https://app.example.com/dashboard");

        html.Should().Contain("https://app.example.com/dashboard");
    }

    [Fact]
    public void WelcomeEmail_HtmlEncodesUserName()
    {
        var html = EmailTemplates.WelcomeEmail("<script>alert(1)</script>", "BuildCo", "https://example.com/dashboard");

        html.Should().NotContain("<script>");
        html.Should().Contain("&lt;script&gt;");
    }

    [Fact]
    public void WelcomeEmail_HtmlEncodesCompanyName()
    {
        var html = EmailTemplates.WelcomeEmail("Charlie", "\"onmouseover=\"alert(1)\"", "https://example.com/dashboard");

        html.Should().NotContain("\"onmouseover=\"alert(1)\"");
        html.Should().Contain("&quot;onmouseover=&quot;alert(1)&quot;");
    }

    #endregion

    #region HTML Structure

    [Theory]
    [InlineData("Verification")]
    [InlineData("PasswordReset")]
    [InlineData("Invitation")]
    [InlineData("Welcome")]
    public void AllTemplates_ContainDoctypeDeclaration(string templateName)
    {
        var html = GetTemplateHtml(templateName);

        html.Should().Contain("<!DOCTYPE html>");
    }

    [Theory]
    [InlineData("Verification")]
    [InlineData("PasswordReset")]
    [InlineData("Invitation")]
    [InlineData("Welcome")]
    public void AllTemplates_ContainHtmlTag(string templateName)
    {
        var html = GetTemplateHtml(templateName);

        html.Should().Contain("<html");
        html.Should().Contain("</html>");
    }

    [Theory]
    [InlineData("Verification")]
    [InlineData("PasswordReset")]
    [InlineData("Invitation")]
    [InlineData("Welcome")]
    public void AllTemplates_ContainBodyTag(string templateName)
    {
        var html = GetTemplateHtml(templateName);

        html.Should().Contain("<body");
        html.Should().Contain("</body>");
    }

    [Theory]
    [InlineData("Verification")]
    [InlineData("PasswordReset")]
    [InlineData("Invitation")]
    [InlineData("Welcome")]
    public void AllTemplates_ContainHeadTag(string templateName)
    {
        var html = GetTemplateHtml(templateName);

        html.Should().Contain("<head>");
        html.Should().Contain("</head>");
    }

    private static string GetTemplateHtml(string templateName)
    {
        return templateName switch
        {
            "Verification" => EmailTemplates.VerificationEmail("User", "https://example.com/verify"),
            "PasswordReset" => EmailTemplates.PasswordResetEmail("User", "https://example.com/reset"),
            "Invitation" => EmailTemplates.InvitationEmail("Inviter", "Company", "https://example.com/invite"),
            "Welcome" => EmailTemplates.WelcomeEmail("User", "Company", "https://example.com/dashboard"),
            _ => throw new ArgumentException($"Unknown template: {templateName}")
        };
    }

    #endregion
}
