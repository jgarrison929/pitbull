namespace Pitbull.Core.Services.BlobStorage;

public class BlobStorageOptions
{
    public const string SectionName = "BlobStorage";

    /// <summary>
    /// Provider: "local" or "s3". Defaults to "local".
    /// Can also be set via BLOB_PROVIDER environment variable.
    /// </summary>
    public string Provider { get; set; } = "local";

    /// <summary>
    /// Base directory for local file storage. Defaults to /data/blobs.
    /// </summary>
    public string LocalBasePath { get; set; } = "/data/blobs";

    /// <summary>
    /// S3 bucket name (also used for MinIO).
    /// Can also be set via S3_BUCKET environment variable.
    /// </summary>
    public string? S3Bucket { get; set; }

    /// <summary>
    /// AWS region (e.g., "us-east-1").
    /// Can also be set via S3_REGION environment variable.
    /// </summary>
    public string? S3Region { get; set; }

    /// <summary>
    /// S3 access key. Can also be set via S3_ACCESS_KEY environment variable.
    /// </summary>
    public string? S3AccessKey { get; set; }

    /// <summary>
    /// S3 secret key. Can also be set via S3_SECRET_KEY environment variable.
    /// </summary>
    public string? S3SecretKey { get; set; }

    /// <summary>
    /// Custom S3-compatible endpoint (e.g., MinIO URL).
    /// Can also be set via S3_ENDPOINT environment variable.
    /// When set, forces path-style addressing for MinIO compatibility.
    /// </summary>
    public string? S3Endpoint { get; set; }

    /// <summary>
    /// Base URL for constructing public/presigned URLs in local mode.
    /// Defaults to "/api/files" (relative).
    /// </summary>
    public string LocalBaseUrl { get; set; } = "/api/files";
}
