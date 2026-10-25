using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Resend;
using Pitbull.Api.Services;

namespace Pitbull.Tests.Unit.Services;

public class ResendEmailServiceTests
{
    private readonly Mock<IResend> _resendMock;
    private readonly Mock<ILogger<ResendEmailService>> _loggerMock;
    private readonly IConfiguration _configuration;
    private readonly ResendEmailService _sut;

    public ResendEmailServiceTests()
    {
        _resendMock = new Mock<IResend>();
        _loggerMock = new Mock<ILogger<ResendEmailService>>();

        _configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Email:FromAddress"] = "test@example.com",
                ["Email:FromName"] = "Test Sender",
                ["Email:BaseUrl"] = "https://app.example.com",
            })
            .Build();

        _resendMock
            .Setup(r => r.EmailSendAsync(It.IsAny<EmailMessage>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ResendResponse<Guid>(Guid.NewGuid(), null!));

        _sut = new ResendEmailService(_resendMock.Object, _configuration, _loggerMock.Object);
    }

    #region SendEmailVerificationAsync

    [Fact]
    public async Task SendEmailVerificationAsync_SendsEmailWithCorrectTo()
    {
        await _sut.SendEmailVerificationAsync("user@test.com", "Alice", "token123");

        _resendMock.Verify(r => r.EmailSendAsync(
            It.Is<EmailMessage>(m => m.To.Any(a => a.ToString() == "user@test.com")),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SendEmailVerificationAsync_SendsEmailWithCorrectSubject()
    {
        await _sut.SendEmailVerificationAsync("user@test.com", "Alice", "token123");

        _resendMock.Verify(r => r.EmailSendAsync(
            It.Is<EmailMessage>(m => m.Subject == "Verify your email address"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SendEmailVerificationAsync_SendsEmailWithCorrectFrom()
    {
        await _sut.SendEmailVerificationAsync("user@test.com", "Alice", "token123");

        _resendMock.Verify(r => r.EmailSendAsync(
            It.Is<EmailMessage>(m => m.From!.ToString()!.Contains("test@example.com")
                                  && m.From!.ToString()!.Contains("Test Sender")),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SendEmailVerificationAsync_IncludesVerificationUrlInBody()
    {
        await _sut.SendEmailVerificationAsync("user@test.com", "Alice", "token123");

        _resendMock.Verify(r => r.EmailSendAsync(
            It.Is<EmailMessage>(m => m.HtmlBody!.Contains("https://app.example.com/verify-email?token=token123")),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SendEmailVerificationAsync_UrlEncodesToken()
    {
        await _sut.SendEmailVerificationAsync("user@test.com", "Alice", "token with spaces&special=chars");

        _resendMock.Verify(r => r.EmailSendAsync(
            It.Is<EmailMessage>(m => m.HtmlBody!.Contains("token%20with%20spaces%26special%3Dchars")),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    #endregion

    #region SendPasswordResetAsync

    [Fact]
    public async Task SendPasswordResetAsync_SendsEmailWithCorrectSubject()
    {
        await _sut.SendPasswordResetAsync("user@test.com", "Bob", "reset-token");

        _resendMock.Verify(r => r.EmailSendAsync(
            It.Is<EmailMessage>(m => m.Subject == "Reset your password"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SendPasswordResetAsync_IncludesResetUrlInBody()
    {
        await _sut.SendPasswordResetAsync("user@test.com", "Bob", "reset-token");

        _resendMock.Verify(r => r.EmailSendAsync(
            It.Is<EmailMessage>(m => m.HtmlBody!.Contains("https://app.example.com/reset-password?token=reset-token")),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SendPasswordResetAsync_SendsToCorrectRecipient()
    {
        await _sut.SendPasswordResetAsync("bob@test.com", "Bob", "reset-token");

        _resendMock.Verify(r => r.EmailSendAsync(
            It.Is<EmailMessage>(m => m.To.Any(a => a.ToString() == "bob@test.com")),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    #endregion

    #region SendInvitationEmailAsync

    [Fact]
    public async Task SendInvitationEmailAsync_SendsEmailWithCorrectSubject()
    {
        await _sut.SendInvitationEmailAsync("new@test.com", "Alice", "Acme Corp", "invite-token");

        _resendMock.Verify(r => r.EmailSendAsync(
            It.Is<EmailMessage>(m => m.Subject == "Alice invited you to Acme Corp on Pitbull"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SendInvitationEmailAsync_IncludesInviteUrlInBody()
    {
        await _sut.SendInvitationEmailAsync("new@test.com", "Alice", "Acme Corp", "invite-token");

        _resendMock.Verify(r => r.EmailSendAsync(
            It.Is<EmailMessage>(m => m.HtmlBody!.Contains("https://app.example.com/invite/invite-token")),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SendInvitationEmailAsync_IncludesInviterAndCompanyInBody()
    {
        await _sut.SendInvitationEmailAsync("new@test.com", "Alice", "Acme Corp", "invite-token");

        _resendMock.Verify(r => r.EmailSendAsync(
            It.Is<EmailMessage>(m => m.HtmlBody!.Contains("Alice")
                                  && m.HtmlBody!.Contains("Acme Corp")),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    #endregion

    #region SendWelcomeEmailAsync

    [Fact]
    public async Task SendWelcomeEmailAsync_SendsEmailWithCorrectSubject()
    {
        await _sut.SendWelcomeEmailAsync("user@test.com", "Charlie", "BuildCo");

        _resendMock.Verify(r => r.EmailSendAsync(
            It.Is<EmailMessage>(m => m.Subject == "Welcome to Pitbull, Charlie!"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SendWelcomeEmailAsync_IncludesDashboardUrlInBody()
    {
        await _sut.SendWelcomeEmailAsync("user@test.com", "Charlie", "BuildCo");

        _resendMock.Verify(r => r.EmailSendAsync(
            It.Is<EmailMessage>(m => m.HtmlBody!.Contains("https://app.example.com/dashboard")),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SendWelcomeEmailAsync_IncludesUserNameAndCompanyInBody()
    {
        await _sut.SendWelcomeEmailAsync("user@test.com", "Charlie", "BuildCo");

        _resendMock.Verify(r => r.EmailSendAsync(
            It.Is<EmailMessage>(m => m.HtmlBody!.Contains("Charlie")
                                  && m.HtmlBody!.Contains("BuildCo")),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    #endregion

    #region Error Handling

    [Fact]
    public async Task SendEmailVerificationAsync_WhenResendThrows_DoesNotRethrow()
    {
        _resendMock
            .Setup(r => r.EmailSendAsync(It.IsAny<EmailMessage>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("Resend API failure"));

        var act = () => _sut.SendEmailVerificationAsync("user@test.com", "Alice", "token123");

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task SendPasswordResetAsync_WhenResendThrows_DoesNotRethrow()
    {
        _resendMock
            .Setup(r => r.EmailSendAsync(It.IsAny<EmailMessage>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("Resend API failure"));

        var act = () => _sut.SendPasswordResetAsync("user@test.com", "Bob", "token");

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task SendInvitationEmailAsync_WhenResendThrows_DoesNotRethrow()
    {
        _resendMock
            .Setup(r => r.EmailSendAsync(It.IsAny<EmailMessage>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("Resend API failure"));

        var act = () => _sut.SendInvitationEmailAsync("new@test.com", "Alice", "Acme", "token");

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task SendWelcomeEmailAsync_WhenResendThrows_DoesNotRethrow()
    {
        _resendMock
            .Setup(r => r.EmailSendAsync(It.IsAny<EmailMessage>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("Resend API failure"));

        var act = () => _sut.SendWelcomeEmailAsync("user@test.com", "Charlie", "BuildCo");

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task SendEmailVerificationAsync_WhenResendThrows_LogsError()
    {
        _resendMock
            .Setup(r => r.EmailSendAsync(It.IsAny<EmailMessage>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("Resend API failure"));

        await _sut.SendEmailVerificationAsync("user@test.com", "Alice", "token123");

        _loggerMock.Verify(
            l => l.Log(
                LogLevel.Error,
                It.IsAny<EventId>(),
                It.IsAny<It.IsAnyType>(),
                It.IsAny<Exception>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    #endregion

    #region Configuration

    [Fact]
    public async Task UsesConfiguredFromAddress()
    {
        await _sut.SendEmailVerificationAsync("user@test.com", "Alice", "token");

        _resendMock.Verify(r => r.EmailSendAsync(
            It.Is<EmailMessage>(m => m.From!.ToString()!.Contains("test@example.com")),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UsesConfiguredFromName()
    {
        await _sut.SendEmailVerificationAsync("user@test.com", "Alice", "token");

        _resendMock.Verify(r => r.EmailSendAsync(
            It.Is<EmailMessage>(m => m.From!.ToString()!.Contains("Test Sender")),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UsesConfiguredBaseUrl()
    {
        await _sut.SendEmailVerificationAsync("user@test.com", "Alice", "token");

        _resendMock.Verify(r => r.EmailSendAsync(
            It.Is<EmailMessage>(m => m.HtmlBody!.Contains("https://app.example.com/")),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DefaultsWhenConfigMissing()
    {
        var emptyConfig = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        var sut = new ResendEmailService(_resendMock.Object, emptyConfig, _loggerMock.Object);

        await sut.SendEmailVerificationAsync("user@test.com", "Alice", "token");

        _resendMock.Verify(r => r.EmailSendAsync(
            It.Is<EmailMessage>(m =>
                m.From!.ToString()!.Contains("noreply@example.com") &&
                m.From!.ToString()!.Contains("Pitbull Construction Solutions") &&
                m.HtmlBody!.Contains("http://localhost:3000/")),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task BaseUrl_TrimsTrailingSlash()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Email:BaseUrl"] = "https://app.example.com/",
            })
            .Build();

        var sut = new ResendEmailService(_resendMock.Object, config, _loggerMock.Object);

        await sut.SendEmailVerificationAsync("user@test.com", "Alice", "token");

        // Should not produce double-slash like "https://app.example.com//verify-email"
        _resendMock.Verify(r => r.EmailSendAsync(
            It.Is<EmailMessage>(m => m.HtmlBody!.Contains("https://app.example.com/verify-email")),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    #endregion

    #region CancellationToken

    [Fact]
    public async Task PassesCancellationTokenToResend()
    {
        using var cts = new CancellationTokenSource();

        await _sut.SendEmailVerificationAsync("user@test.com", "Alice", "token", cts.Token);

        _resendMock.Verify(r => r.EmailSendAsync(
            It.IsAny<EmailMessage>(),
            cts.Token), Times.Once);
    }

    #endregion
}
