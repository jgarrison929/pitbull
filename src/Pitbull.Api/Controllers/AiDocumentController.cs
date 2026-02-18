using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pitbull.AI.Providers;
using Pitbull.AI.Services;
using Pitbull.Api.Validation;
using Pitbull.Core.Data;
using Pitbull.Documents.Domain;

namespace Pitbull.Api.Controllers;

/// <summary>
/// AI-powered document analysis. Extracts structured data from uploaded documents.
/// </summary>
[ApiController]
[Route("api/ai")]
[Authorize]
[EnableRateLimiting("ai-document")]
[Produces("application/json")]
[Tags("AI")]
public class AiDocumentController(
    IAiService aiService,
    PitbullDbContext db) : ControllerBase
{
    private const int MaxAdditionalContextLength = 8000;

    private Guid GetTenantId()
    {
        var tenantClaim = User.FindFirst("tenant_id")?.Value;
        return Guid.TryParse(tenantClaim, out var tid) ? tid : Guid.Empty;
    }

    /// <summary>
    /// Analyze a document and extract structured data (dates, amounts, parties, key terms).
    /// </summary>
    [HttpPost("analyze-document")]
    [ProducesResponseType(typeof(AiDocumentAnalysisResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> AnalyzeDocument(
        [FromBody] AiDocumentAnalysisRequest request, CancellationToken ct)
    {
        if (request.FileId == Guid.Empty)
            return BadRequest(new { error = "fileId is required", code = "VALIDATION_ERROR" });

        if (AiInputSanitizer.ValidateLength(request.AdditionalContext, MaxAdditionalContextLength, "additionalContext") is { } ctxErr)
            return BadRequest(new { error = ctxErr, code = "VALIDATION_ERROR" });

        var file = await db.Set<FileAttachment>()
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == request.FileId && !f.IsDeleted, ct);

        if (file is null)
            return NotFound(new { error = "File not found", code = "NOT_FOUND" });

        var fileContext = BuildFileContext(file, request.AdditionalContext);

        var aiRequest = new AiCompletionRequest(
            SystemPrompt: """
                You are a construction document analyst. Analyze the document metadata and any
                available content, then extract structured information. Return a JSON object with
                these fields (use null for fields you cannot determine):

                {
                  "documentType": "string (e.g., Subcontract, Change Order, Insurance Certificate, Lien Waiver, Pay Application, Submittal, Specification, Drawing)",
                  "dates": [{"label": "string", "value": "YYYY-MM-DD"}],
                  "amounts": [{"label": "string", "value": number}],
                  "parties": [{"name": "string", "role": "string"}],
                  "keyTerms": ["string"],
                  "summary": "string (2-3 sentence summary)",
                  "recommendations": ["string"]
                }

                Return ONLY valid JSON, no markdown code fences or explanation.
                """,
            UserPrompt: fileContext,
            Capability: AiCapability.DocumentUnderstanding,
            MaxTokens: 2048,
            Temperature: 0.2m);

        var tenantId = GetTenantId();
        var result = await aiService.CompleteAsync(tenantId, aiRequest, null, ct);

        if (!result.IsSuccess)
            return StatusCode(503, new { error = result.Error, code = result.ErrorCode });

        return Ok(new AiDocumentAnalysisResponse(
            FileId: file.Id,
            FileName: file.FileName,
            Analysis: result.Value!.Content,
            Model: result.Value.Model,
            Provider: result.Value.Provider,
            LatencyMs: (long)result.Value.Latency.TotalMilliseconds));
    }

    private static string BuildFileContext(FileAttachment file, string? additionalContext)
    {
        var lines = new List<string>
        {
            $"File Name: {AiInputSanitizer.SanitizeMetadata(file.FileName)}",
            $"Content Type: {AiInputSanitizer.SanitizeMetadata(file.ContentType)}",
            $"File Size: {file.FileSize} bytes",
        };

        if (!string.IsNullOrWhiteSpace(file.RelatedEntityType))
            lines.Add($"Related To: {AiInputSanitizer.SanitizeMetadata(file.RelatedEntityType)} ({file.RelatedEntityId})");

        if (!string.IsNullOrWhiteSpace(additionalContext))
            lines.Add($"\nAdditional Context:\n{AiInputSanitizer.Sanitize(additionalContext)}");

        return string.Join("\n", lines);
    }
}

// ── DTOs ────────────────────────────────────────────────────────────

public record AiDocumentAnalysisRequest(
    Guid FileId,
    string? AdditionalContext = null);

public record AiDocumentAnalysisResponse(
    Guid FileId,
    string FileName,
    string Analysis,
    string Model,
    string Provider,
    long LatencyMs);
