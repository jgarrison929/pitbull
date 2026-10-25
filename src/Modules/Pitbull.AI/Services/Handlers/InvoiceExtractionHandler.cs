using Pitbull.AI.Providers;
using Pitbull.Core.CQRS;

namespace Pitbull.AI.Services.Handlers;

/// <summary>
/// Feature handler for AI-powered invoice data extraction.
/// Delegates to the existing InvoiceExtractionService for actual processing,
/// wrapping results in the standard AiFeatureResult format.
/// </summary>
public sealed class InvoiceExtractionHandler(
    IAiService aiService) : IAiFeatureHandler
{
    public string FeatureName => "invoice-extraction";
    public AiCapability RequiredCapability => AiCapability.DocumentUnderstanding;

    public async Task<Result<AiFeatureResult>> ExecuteAsync(AiFeatureRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Input))
        {
            return Result.Failure<AiFeatureResult>(
                "Invoice text is required for extraction.",
                "VALIDATION_ERROR");
        }

        var aiRequest = new AiCompletionRequest(
            SystemPrompt: InvoiceExtractionPrompt,
            UserPrompt: request.Input,
            Capability: RequiredCapability,
            MaxTokens: 2048,
            Temperature: 0.1m);

        var result = await aiService.CompleteAsync(request.TenantId, aiRequest, ct: ct);

        if (!result.IsSuccess)
        {
            return Result.Failure<AiFeatureResult>(
                $"Invoice extraction failed: {result.Error}",
                result.ErrorCode ?? "AI_PROVIDER_ERROR");
        }

        var completion = result.Value!;
        return Result.Success(new AiFeatureResult(
            Content: completion.Content,
            ConfidenceScore: completion.ConfidenceScore,
            Provider: completion.Provider,
            Model: completion.Model,
            LatencyMs: (long)completion.Latency.TotalMilliseconds));
    }

    private const string InvoiceExtractionPrompt = """
        You are an invoice data extraction assistant for a construction management ERP.
        Extract structured data from invoice text and return it as JSON.

        RESPONSE FORMAT (return ONLY valid JSON, no markdown fences):
        {
          "vendorName": "string or null",
          "vendorNameConfidence": 0.0-1.0,
          "invoiceNumber": "string or null",
          "invoiceNumberConfidence": 0.0-1.0,
          "invoiceDate": "YYYY-MM-DD or null",
          "invoiceDateConfidence": 0.0-1.0,
          "dueDate": "YYYY-MM-DD or null",
          "dueDateConfidence": 0.0-1.0,
          "lineItems": [
            {
              "description": "string",
              "quantity": number or null,
              "unitPrice": number or null,
              "amount": number or null,
              "costCode": "string or null"
            }
          ],
          "subTotal": number or null,
          "taxAmount": number or null,
          "totalAmount": number or null,
          "totalAmountConfidence": 0.0-1.0
        }

        RULES:
        - Extract all fields you can identify. Set confidence to 0.0 for fields you cannot find.
        - Dates should be in YYYY-MM-DD format.
        - Monetary amounts should be plain numbers (no currency symbols).
        - For line items, extract as many as visible. If no line items are found, return an empty array.
        - If a cost code can be inferred from the description (e.g., "concrete" = 03-000, "electrical" = 26-000), include it.
        - Confidence scores should reflect how certain you are about each extracted value.
        """;
}
