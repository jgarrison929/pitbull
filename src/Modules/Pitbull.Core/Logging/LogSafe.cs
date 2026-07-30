using System.Security.Cryptography;
using System.Text;

namespace Pitbull.Core.Logging;

/// <summary>
/// Helpers for safe logging of untrusted or sensitive values.
/// Always strips CR/LF (log forging) and never writes raw emails to sinks.
/// Designed so CodeQL dataflow treats outputs as sanitized.
/// </summary>
public static class LogSafe
{
    /// <summary>
    /// Strip carriage returns / newlines (and other C0 controls except tab)
    /// so untrusted strings cannot inject forged log lines.
    /// Always runs Replace so static analyzers see an explicit sanitizer barrier.
    /// </summary>
    public static string Text(string? value)
    {
        if (value is null)
            return string.Empty;

        // Unconditional CR/LF removal — recognized sanitizer pattern for cs/log-forging.
        var cleaned = value.Replace("\r", string.Empty).Replace("\n", string.Empty);

        if (cleaned.Length == 0)
            return string.Empty;

        // Drop remaining C0 controls except tab
        StringBuilder? sb = null;
        for (var i = 0; i < cleaned.Length; i++)
        {
            var c = cleaned[i];
            if (c != '\t' && c < 0x20)
            {
                sb ??= new StringBuilder(cleaned.Length);
                if (sb.Length == 0 && i > 0)
                    sb.Append(cleaned.AsSpan(0, i));
                continue;
            }

            sb?.Append(c);
        }

        return sb?.ToString() ?? cleaned;
    }

    /// <summary>Format any value for logging after control-char sanitization.</summary>
    public static string Text(object? value)
    {
        if (value is null)
            return string.Empty;
        return Text(value as string ?? value.ToString());
    }

    /// <summary>
    /// Correlate emails in logs without writing addresses (or domains) to sinks.
    /// Returns a stable short fingerprint: email#a1b2c3d4
    /// </summary>
    public static string Email(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return "[no-email]";

        var cleaned = Text(email.Trim()).ToLowerInvariant();
        if (cleaned.Length == 0 || cleaned.IndexOf('@') <= 0)
            return "[redacted-email]";

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(cleaned));
        return "email#" + Convert.ToHexString(hash.AsSpan(0, 4)).ToLowerInvariant();
    }
}
