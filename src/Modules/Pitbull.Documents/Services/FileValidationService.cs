using Pitbull.Core.CQRS;

namespace Pitbull.Documents.Services;

public class FileValidationService : IFileValidationService
{
    private const long MaxFileSize = 50 * 1024 * 1024; // 50 MB

    private static readonly HashSet<string> BlockedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".exe", ".bat", ".cmd", ".ps1", ".dll", ".com", ".scr", ".msi",
        ".vbs", ".js", ".wsf", ".hta", ".cpl", ".inf", ".reg", ".pif",
        ".sh", ".bash"
    };

    private static readonly string[] AllowedContentTypePrefixes =
    [
        "image/",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats",
        "application/vnd.ms-excel",
        "application/vnd.ms-powerpoint",
        "text/plain",
        "text/csv",
        "video/",
        "audio/",
        "application/zip",
        "application/x-zip"
    ];

    /// <summary>
    /// Extensions that are safe when uploaded with application/octet-stream content type.
    /// Common CAD/BIM formats that browsers can't infer a MIME type for.
    /// </summary>
    private static readonly HashSet<string> OctetStreamSafeExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".dwg", ".rvt", ".ifc", ".dwf"
    };

    public Result ValidateFile(string fileName, string contentType, long fileSize)
    {
        if (string.IsNullOrWhiteSpace(fileName))
            return Result.Failure("File name is required", "INVALID_FILE");

        // Check file size
        if (fileSize <= 0)
            return Result.Failure("File is empty", "INVALID_FILE");

        if (fileSize > MaxFileSize)
            return Result.Failure($"File size exceeds the maximum allowed size of {MaxFileSize / (1024 * 1024)}MB", "INVALID_FILE");

        // Check all extensions (double-extension attack prevention)
        var extensions = GetAllExtensions(fileName);

        if (extensions.Count == 0)
            return Result.Failure("File must have an extension", "INVALID_FILE");

        foreach (var ext in extensions)
        {
            if (BlockedExtensions.Contains(ext))
                return Result.Failure($"File type '{ext}' is not allowed", "INVALID_FILE");
        }

        // Check content type
        if (string.IsNullOrWhiteSpace(contentType))
            return Result.Failure("Content type is required", "INVALID_FILE");

        var normalizedContentType = contentType.Trim().ToLowerInvariant();

        // Handle application/octet-stream separately — only allow for known safe extensions
        if (normalizedContentType == "application/octet-stream")
        {
            var primaryExtension = extensions[^1]; // last extension is the "real" one
            if (!OctetStreamSafeExtensions.Contains(primaryExtension))
                return Result.Failure(
                    $"Content type 'application/octet-stream' is only allowed for CAD/BIM files ({string.Join(", ", OctetStreamSafeExtensions)})",
                    "INVALID_FILE");

            return Result.Success();
        }

        var isAllowed = AllowedContentTypePrefixes.Any(prefix =>
            normalizedContentType.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));

        if (!isAllowed)
            return Result.Failure($"Content type '{contentType}' is not allowed", "INVALID_FILE");

        return Result.Success();
    }

    /// <summary>
    /// Extracts all extensions from a file name.
    /// For "report.pdf.exe" returns [".pdf", ".exe"].
    /// </summary>
    private static List<string> GetAllExtensions(string fileName)
    {
        var extensions = new List<string>();
        var name = fileName;

        while (true)
        {
            var ext = Path.GetExtension(name);
            if (string.IsNullOrEmpty(ext))
                break;

            extensions.Insert(0, ext);
            name = Path.GetFileNameWithoutExtension(name);
        }

        return extensions;
    }
}
