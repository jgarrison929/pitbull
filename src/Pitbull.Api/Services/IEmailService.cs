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
            toEmail, inviterName, companyName, inviteToken[..Math.Min(8, inviteToken.Length)]);
        return Task.CompletedTask;
    }

    public Task SendEmailVerificationAsync(string toEmail, string userName, string verificationToken, CancellationToken ct = default)
    {
        logger.LogInformation(
            "[EMAIL STUB] Email Verification sent to {Email} | User: {User} | Token: {TokenPrefix}...",
            toEmail, userName, verificationToken[..Math.Min(8, verificationToken.Length)]);
        return Task.CompletedTask;
    }

    public Task SendWelcomeEmailAsync(string toEmail, string userName, string companyName, CancellationToken ct = default)
    {
        logger.LogInformation(
            "[EMAIL STUB] Welcome email sent to {Email} | User: {User} | Company: {Company}",
            toEmail, userName, companyName);
        return Task.CompletedTask;
    }
}
