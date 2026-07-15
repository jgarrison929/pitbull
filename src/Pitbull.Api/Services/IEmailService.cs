using Pitbull.Core.Logging;
namespace Pitbull.Api.Services;

/// <summary>
/// Email sending abstraction. Currently stubbed with console logging.
/// Swap implementation for real SMTP (MailKit) or transactional email (SendGrid) later.
/// </summary>
public interface IEmailService
{
    Task SendInvitationEmailAsync(string toEmail, string inviterName, string companyName, string inviteToken, CancellationToken ct = default);
    Task SendEmailVerificationAsync(string toEmail, string userName, string verificationToken, CancellationToken ct = default);
    Task SendWelcomeEmailAsync(string toEmail, string userName, string companyName, CancellationToken ct = default);
    Task SendPasswordResetAsync(string toEmail, string userName, string resetToken, CancellationToken ct = default);
    Task SendNotificationEmailAsync(string toEmail, string userName, string title, string message, string? actionUrl = null, CancellationToken ct = default);
}

/// <summary>
/// Console-logging stub for email service.
/// Logs email metadata to Serilog without exposing sensitive tokens.
/// Replace with real implementation when SMTP is configured.
/// </summary>
public class ConsoleEmailService(ILogger<ConsoleEmailService> logger) : IEmailService
{
    public Task SendInvitationEmailAsync(string toEmail, string inviterName, string companyName, string inviteToken, CancellationToken ct = default)
    {
        logger.LogInformation(
            "[EMAIL STUB] Team Invitation sent to {Email} | From: {Inviter} | Company: {Company} | Token: {TokenPrefix}...",
            LogSafe.Email(toEmail), LogSafe.Text(inviterName), LogSafe.Text(companyName), LogSafe.Text(inviteToken[..Math.Min(8, inviteToken.Length)]));
        return Task.CompletedTask;
    }

    public Task SendEmailVerificationAsync(string toEmail, string userName, string verificationToken, CancellationToken ct = default)
    {
        logger.LogInformation(
            "[EMAIL STUB] Email Verification sent to {Email} | User: {User} | Token: {TokenPrefix}...",
            LogSafe.Email(toEmail), LogSafe.Text(userName), LogSafe.Text(verificationToken[..Math.Min(8, verificationToken.Length)]));
        return Task.CompletedTask;
    }

    public Task SendWelcomeEmailAsync(string toEmail, string userName, string companyName, CancellationToken ct = default)
    {
        logger.LogInformation(
            "[EMAIL STUB] Welcome email sent to {Email} | User: {User} | Company: {Company}",
            LogSafe.Email(toEmail), LogSafe.Text(userName), LogSafe.Text(companyName));
        return Task.CompletedTask;
    }

    public Task SendPasswordResetAsync(string toEmail, string userName, string resetToken, CancellationToken ct = default)
    {
        logger.LogInformation(
            "[EMAIL STUB] Password reset sent to {Email} | User: {User} | Token: {TokenPrefix}...",
            LogSafe.Email(toEmail), LogSafe.Text(userName), LogSafe.Text(resetToken[..Math.Min(8, resetToken.Length)]));
        return Task.CompletedTask;
    }

    public Task SendNotificationEmailAsync(string toEmail, string userName, string title, string message, string? actionUrl = null, CancellationToken ct = default)
    {
        logger.LogInformation(
            "[EMAIL STUB] Notification email sent to {Email} | User: {User} | Title: {Title}",
            LogSafe.Email(toEmail), LogSafe.Text(userName), LogSafe.Text(title));
        return Task.CompletedTask;
    }
}
