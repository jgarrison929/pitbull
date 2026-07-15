using System.Text;

namespace Pitbull.Core.Logging;

/// <summary>
/// Helpers for safe logging of untrusted or sensitive values.
/// Strips CR/LF (log forging) and redacts emails for log sinks.
/// </summary>
public static class LogSafe
{
    /// <summary>
    /// Strip carriage returns / newlines (and other C0 controls except tab)
    /// so untrusted strings cannot inject forged log lines.
    /// </summary>
    public static string Text(string? value)
    {
        if (string.IsNullOrEmpty(value))
            return string.Empty;

        // Fast path: no control characters
        var needsClean = false;
        foreach (var c in value)
        {
            if (c is '\r' or '\n' or '\0' || (c < 0x20 && c != '\t'))
            {
                needsClean = true;
                break;
            }
        }

        if (!needsClean)
            return value;

        // CodeQL log-forging sanitizer pattern: remove CR/LF via Replace
        var cleaned = value.Replace("\r", string.Empty).Replace("\n", string.Empty);

        // Drop remaining C0 controls except tab
        var sb = new StringBuilder(cleaned.Length);
        foreach (var c in cleaned)
        {
            if (c == '\t' || c >= 0x20)
                sb.Append(c);
        }

        return sb.ToString();
    }

    /// <summary>Format any value for logging after control-char sanitization.</summary>
    public static string Text(object? value)
    {
        if (value is null)
            return string.Empty;
        return Text(value as string ?? value.ToString());
    }

    /// <summary>
    /// Redact an email for logs (domain only). Never write full addresses to logs.
    /// </summary>
    public static string Email(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return "[no-email]";

        var cleaned = Text(email.Trim());
        var at = cleaned.IndexOf('@');
        if (at <= 0 || at >= cleaned.Length - 1)
            return "[redacted-email]";

        return "***@" + cleaned[(at + 1)..];
    }
}
