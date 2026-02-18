using System.Text.RegularExpressions;

namespace Pitbull.Api.Validation;

/// <summary>
/// Sanitizes AI prompt inputs to mitigate prompt injection attacks.
/// Normalizes Unicode, strips invisible characters, then removes known injection patterns.
/// </summary>
public static partial class AiInputSanitizer
{
    /// <summary>
    /// Sanitize user input destined for an AI prompt.
    /// Normalizes Unicode, strips zero-width/control characters, then removes
    /// prompt injection patterns and normalizes whitespace.
    /// </summary>
    public static string Sanitize(string input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return string.Empty;

        // Phase 1: Normalize input to defeat zero-width and homoglyph bypasses
        var normalized = NormalizeInput(input);

        // Phase 2: Strip prompt injection patterns
        var sanitized = PromptInjectionPattern().Replace(normalized, string.Empty);

        // Phase 3: Collapse runs of 3+ newlines into 2
        sanitized = ExcessiveNewlines().Replace(sanitized, "\n\n");

        return sanitized.Trim();
    }

    /// <summary>
    /// Sanitize a value intended for embedding as metadata in a prompt
    /// (e.g., file names, content types). Strips characters that could act
    /// as prompt delimiters or injection vectors.
    /// </summary>
    public static string SanitizeMetadata(string input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return string.Empty;

        var normalized = NormalizeInput(input);

        // Strip characters that could act as prompt delimiters
        normalized = PromptDelimiters().Replace(normalized, string.Empty);

        return normalized.Trim();
    }

    /// <summary>
    /// Validate that a context dictionary key contains only safe characters.
    /// Returns an error message if invalid, null if valid.
    /// </summary>
    public static string? ValidateContextKey(string key)
    {
        if (string.IsNullOrWhiteSpace(key))
            return "context key must not be empty";

        if (key.Length > 100)
            return $"context key '{key[..20]}...' must not exceed 100 characters";

        if (!SafeContextKey().IsMatch(key))
            return $"context key '{key}' contains invalid characters (allowed: a-z, A-Z, 0-9, _, -)";

        return null;
    }

    /// <summary>
    /// Validate that a string does not exceed the maximum allowed length.
    /// Returns an error message if invalid, null if valid.
    /// </summary>
    public static string? ValidateLength(string? input, int maxLength, string fieldName)
    {
        if (input is not null && input.Length > maxLength)
            return $"{fieldName} must not exceed {maxLength} characters";

        return null;
    }

    /// <summary>
    /// Validate that a collection does not exceed the maximum allowed count.
    /// Returns an error message if invalid, null if valid.
    /// </summary>
    public static string? ValidateCollectionSize<T>(ICollection<T>? collection, int maxCount, string fieldName)
    {
        if (collection is not null && collection.Count > maxCount)
            return $"{fieldName} must not exceed {maxCount} items";

        return null;
    }

    /// <summary>
    /// Normalize input by stripping zero-width characters, control characters,
    /// and other invisible Unicode that can bypass regex-based pattern matching.
    /// </summary>
    private static string NormalizeInput(string input)
    {
        // Strip zero-width and invisible formatting characters
        var stripped = ZeroWidthChars().Replace(input, string.Empty);

        // Strip control characters (except \n, \r, \t which are legitimate whitespace)
        stripped = ControlChars().Replace(stripped, string.Empty);

        // Normalize Unicode to NFC form to collapse homoglyph-like composed sequences
        stripped = stripped.Normalize(System.Text.NormalizationForm.FormC);

        return stripped;
    }

    // Zero-width and invisible Unicode characters commonly used for regex bypass:
    // U+200B (zero-width space), U+200C (ZWNJ), U+200D (ZWJ),
    // U+200E (LTR mark), U+200F (RTL mark), U+FEFF (BOM/ZWNBS),
    // U+00AD (soft hyphen), U+2060 (word joiner), U+2061-2064 (invisible operators),
    // U+180E (Mongolian vowel separator), U+034F (combining grapheme joiner)
    [GeneratedRegex(@"[\u200B-\u200F\uFEFF\u00AD\u2060-\u2064\u180E\u034F]")]
    private static partial Regex ZeroWidthChars();

    // Control characters except tab (\x09), newline (\x0A), carriage return (\x0D)
    [GeneratedRegex(@"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]")]
    private static partial Regex ControlChars();

    // Characters that could act as prompt delimiters when embedded in metadata
    [GeneratedRegex(@"[`""'\\\n\r{}\[\]]")]
    private static partial Regex PromptDelimiters();

    // Matches common prompt injection patterns (case-insensitive):
    //  - "ignore previous/above/all instructions/prompts"
    //  - "system:" or "SYSTEM:" at line start
    //  - "you are now..." role reassignment
    //  - "new instructions:" / "override:" directives
    //  - Markdown-style system blocks ```system
    [GeneratedRegex(
        @"(?i)(?:ignore\s+(?:previous|above|all|prior)\s+(?:instructions|prompts|directives))|" +
        @"(?:^system\s*:)|" +
        @"(?:you\s+are\s+now\b)|" +
        @"(?:new\s+instructions?\s*:)|" +
        @"(?:override\s*:)|" +
        @"(?:```\s*system)",
        RegexOptions.Multiline)]
    private static partial Regex PromptInjectionPattern();

    [GeneratedRegex(@"\n{3,}")]
    private static partial Regex ExcessiveNewlines();

    // Context dictionary keys: alphanumeric, underscores, hyphens only
    [GeneratedRegex(@"^[a-zA-Z0-9_-]+$")]
    private static partial Regex SafeContextKey();
}
