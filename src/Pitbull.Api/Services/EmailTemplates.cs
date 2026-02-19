using System.Net;

namespace Pitbull.Api.Services;

public static class EmailTemplates
{
    private static string Wrap(string title, string bodyContent)
    {
        return $"""
            <!DOCTYPE html>
            <html lang="en">
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>{WebUtility.HtmlEncode(title)}</title></head>
            <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
            <tr><td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">
            <tr><td style="background-color:#1e293b;padding:24px 32px;text-align:center;">
            <span style="color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Pitbull</span>
            <span style="color:#94a3b8;font-size:14px;display:block;margin-top:4px;">Construction Solutions</span>
            </td></tr>
            <tr><td style="padding:32px;">
            {bodyContent}
            </td></tr>
            <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #e2e8f0;">
            <span style="color:#94a3b8;font-size:12px;">Pitbull Construction Solutions &mdash; Built for general contractors.</span>
            </td></tr>
            </table>
            </td></tr>
            </table>
            </body>
            </html>
            """;
    }

    private static string Button(string url, string label)
    {
        var safeUrl = WebUtility.HtmlEncode(url);
        return $"""
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
            <tr><td style="background-color:#2563eb;border-radius:6px;text-align:center;">
            <a href="{safeUrl}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;">
            {WebUtility.HtmlEncode(label)}
            </a>
            </td></tr>
            </table>
            """;
    }

    public static string VerificationEmail(string userName, string verificationUrl)
    {
        var safeName = WebUtility.HtmlEncode(userName);
        var body = $"""
            <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Verify your email address</h2>
            <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 8px;">
            Hi {safeName},</p>
            <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 8px;">
            Thanks for signing up. Please verify your email address to get started.</p>
            {Button(verificationUrl, "Verify Email")}
            <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin:16px 0 0;">
            If you didn't create an account, you can safely ignore this email.</p>
            """;
        return Wrap("Verify your email", body);
    }

    public static string PasswordResetEmail(string userName, string resetUrl)
    {
        var safeName = WebUtility.HtmlEncode(userName);
        var body = $"""
            <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Reset your password</h2>
            <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 8px;">
            Hi {safeName},</p>
            <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 8px;">
            We received a request to reset your password. Click the button below to choose a new one.</p>
            {Button(resetUrl, "Reset Password")}
            <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin:16px 0 0;">
            If you didn't request a password reset, you can safely ignore this email. This link will expire in 1 hour.</p>
            """;
        return Wrap("Reset your password", body);
    }

    public static string InvitationEmail(string inviterName, string companyName, string inviteUrl)
    {
        var safeInviter = WebUtility.HtmlEncode(inviterName);
        var safeCompany = WebUtility.HtmlEncode(companyName);
        var body = $"""
            <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">You've been invited to join a team</h2>
            <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 8px;">
            {safeInviter} has invited you to join <strong>{safeCompany}</strong> on Pitbull Construction Solutions.</p>
            <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 8px;">
            Accept the invitation to start collaborating on projects, bids, and more.</p>
            {Button(inviteUrl, "Accept Invitation")}
            <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin:16px 0 0;">
            If you weren't expecting this invitation, you can safely ignore this email.</p>
            """;
        return Wrap("Team Invitation", body);
    }

    public static string NotificationEmail(string userName, string title, string message, string actionUrl)
    {
        var safeName = WebUtility.HtmlEncode(userName);
        var safeTitle = WebUtility.HtmlEncode(title);
        var safeMessage = WebUtility.HtmlEncode(message);
        var body = $"""
            <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">{safeTitle}</h2>
            <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 8px;">
            Hi {safeName},</p>
            <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 8px;">
            {safeMessage}</p>
            {Button(actionUrl, "View in Pitbull")}
            <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin:16px 0 0;">
            You received this email because you have email notifications enabled. You can change your preferences in Settings &gt; Notifications.</p>
            """;
        return Wrap(title, body);
    }

    public static string WelcomeEmail(string userName, string companyName, string dashboardUrl)
    {
        var safeName = WebUtility.HtmlEncode(userName);
        var safeCompany = WebUtility.HtmlEncode(companyName);
        var body = $"""
            <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Welcome to Pitbull!</h2>
            <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 8px;">
            Hi {safeName},</p>
            <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 8px;">
            Your account for <strong>{safeCompany}</strong> is all set. You're ready to manage projects, track bids, and streamline your construction workflows.</p>
            {Button(dashboardUrl, "Go to Dashboard")}
            """;
        return Wrap("Welcome to Pitbull", body);
    }
}
