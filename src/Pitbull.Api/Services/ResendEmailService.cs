using Resend;

namespace Pitbull.Api.Services;

public class ResendEmailService : IEmailService
{
    private readonly IResend _resend;
    private readonly string _fromAddress;
    private readonly string _fromName;
    private readonly string _baseUrl;
    private readonly ILogger<ResendEmailService> _logger;

    public ResendEmailService(IResend resend, IConfiguration configuration, ILogger<ResendEmailService> logger)
    {
        _resend = resend;
        _fromAddress = configuration["Email:FromAddress"] ?? "noreply@example.com";
        _fromName = configuration["Email:FromName"] ?? "Pitbull Construction Solutions";
        _baseUrl = configuration["Email:BaseUrl"]?.TrimEnd('/') ?? "http://localhost:3000";
        _logger = logger;
    }

    public async Task SendInvitationEmailAsync(string toEmail, string inviterName, string companyName, string inviteToken, CancellationToken ct = default)
    {
        var inviteUrl = $"{_baseUrl}/invite/{Uri.EscapeDataString(inviteToken)}";
        var html = EmailTemplates.InvitationEmail(inviterName, companyName, inviteUrl);
        await SendAsync(toEmail, $"{inviterName} invited you to {companyName} on Pitbull", html, ct);
    }

    public async Task SendEmailVerificationAsync(string toEmail, string userName, string verificationToken, CancellationToken ct = default)
    {
        var verificationUrl = $"{_baseUrl}/verify-email?token={Uri.EscapeDataString(verificationToken)}";
        var html = EmailTemplates.VerificationEmail(userName, verificationUrl);
        await SendAsync(toEmail, "Verify your email address", html, ct);
    }

    public async Task SendWelcomeEmailAsync(string toEmail, string userName, string companyName, CancellationToken ct = default)
    {
        var dashboardUrl = $"{_baseUrl}/dashboard";
        var html = EmailTemplates.WelcomeEmail(userName, companyName, dashboardUrl);
        await SendAsync(toEmail, $"Welcome to Pitbull, {userName}!", html, ct);
    }

    public async Task SendPasswordResetAsync(string toEmail, string userName, string resetToken, CancellationToken ct = default)
    {
        var resetUrl = $"{_baseUrl}/reset-password?token={Uri.EscapeDataString(resetToken)}";
        var html = EmailTemplates.PasswordResetEmail(userName, resetUrl);
        await SendAsync(toEmail, "Reset your password", html, ct);
    }

    public async Task SendNotificationEmailAsync(string toEmail, string userName, string title, string message, string? actionUrl = null, CancellationToken ct = default)
    {
        var url = actionUrl ?? $"{_baseUrl}/";
        var html = EmailTemplates.NotificationEmail(userName, title, message, url);
        await SendAsync(toEmail, $"[Pitbull] {title}", html, ct);
    }

    private async Task SendAsync(string toEmail, string subject, string htmlBody, CancellationToken ct)
    {
        try
        {
            var message = new EmailMessage();
            message.From = $"{_fromName} <{_fromAddress}>";
            message.To.Add(toEmail);
            message.Subject = subject;
            message.HtmlBody = htmlBody;

            await _resend.EmailSendAsync(message, ct);
            _logger.LogInformation("Email sent via Resend to {Email} — Subject: {Subject}", toEmail, subject);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email via Resend to {Email} — Subject: {Subject}", toEmail, subject);
        }
    }
}
