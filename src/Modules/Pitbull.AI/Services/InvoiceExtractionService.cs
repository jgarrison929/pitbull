using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pitbull.AI.Providers;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.AI.Services;

public record InvoiceExtractionResult
{
    public string? VendorName { get; init; }
    public decimal VendorNameConfidence { get; init; }
    public string? InvoiceNumber { get; init; }
    public decimal InvoiceNumberConfidence { get; init; }
    public DateOnly? InvoiceDate { get; init; }
    public decimal InvoiceDateConfidence { get; init; }
    public DateOnly? DueDate { get; init; }
    public decimal DueDateConfidence { get; init; }
    public List<ExtractedLineItem> LineItems { get; init; } = new();
    public decimal? SubTotal { get; init; }
    public decimal? TaxAmount { get; init; }
    public decimal? TotalAmount { get; init; }
    public decimal TotalAmountConfidence { get; init; }
    public decimal OverallConfidence { get; init; }
    public string? RawText { get; init; }
    public Guid? MatchedVendorId { get; init; }
    public string? MatchedVendorName { get; init; }
    public List<string> Warnings { get; init; } = new();
}

public record ExtractedLineItem
{
    public string? Description { get; init; }
    public decimal? Quantity { get; init; }
    public decimal? UnitPrice { get; init; }
    public decimal? Amount { get; init; }
    public string? CostCode { get; init; }
}

public record InvoiceExtractionRequest(string Text);

public interface IInvoiceExtractionService
{
    Task<InvoiceExtractionResult> ExtractAsync(string invoiceText, CancellationToken ct);
}

public sealed class InvoiceExtractionService(
    IAiService aiService,
    IAiUsageService usageService,
    PitbullDbContext db,
    ITenantContext tenant,
    ILogger<InvoiceExtractionService> logger) : IInvoiceExtractionService
{
    private const string SystemPrompt = """
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

        EXAMPLES:
        Input: "ACME Supplies Inc.\nInvoice #INV-2026-0042\nDate: 01/15/2026\nDue: 02/15/2026\n\nConcrete Mix (50 bags) - $12.50/bag - $625.00\nRebar #4 (100 ft) - $2.75/ft - $275.00\n\nSubtotal: $900.00\nTax (8.25%): $74.25\nTotal: $974.25"
        Output: {"vendorName":"ACME Supplies Inc.","vendorNameConfidence":0.95,"invoiceNumber":"INV-2026-0042","invoiceNumberConfidence":0.95,"invoiceDate":"2026-01-15","invoiceDateConfidence":0.95,"dueDate":"2026-02-15","dueDateConfidence":0.95,"lineItems":[{"description":"Concrete Mix","quantity":50,"unitPrice":12.50,"amount":625.00,"costCode":"03-000"},{"description":"Rebar #4","quantity":100,"unitPrice":2.75,"amount":275.00,"costCode":"03-000"}],"subTotal":900.00,"taxAmount":74.25,"totalAmount":974.25,"totalAmountConfidence":0.98}
        """;

    public async Task<InvoiceExtractionResult> ExtractAsync(string invoiceText, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(invoiceText))
        {
            return new InvoiceExtractionResult
            {
                RawText = invoiceText,
                OverallConfidence = 0,
                Warnings = ["Invoice text is empty."]
            };
        }

        var sw = System.Diagnostics.Stopwatch.StartNew();
        var tenantId = tenant.TenantId;

        var aiRequest = new AiCompletionRequest(
            SystemPrompt: SystemPrompt,
            UserPrompt: invoiceText,
            Capability: AiCapability.DocumentUnderstanding,
            MaxTokens: 2048,
            Temperature: 0.1m);

        var aiResult = await aiService.CompleteAsync(tenantId, aiRequest, ct: ct);
        sw.Stop();

        if (!aiResult.IsSuccess)
        {
            logger.LogWarning("AI invoice extraction failed: {Error}", aiResult.Error);

            // Log usage even on failure
            await TryLogUsageAsync(Guid.Empty, "unknown", "unknown", 0, 0, 0, sw.ElapsedMilliseconds, 0, ct);

            return new InvoiceExtractionResult
            {
                RawText = invoiceText,
                OverallConfidence = 0,
                Warnings = [$"AI extraction failed: {aiResult.Error}"]
            };
        }

        var completionResult = aiResult.Value!;

        // Parse the AI JSON response
        InvoiceExtractionResult extractionResult;
        try
        {
            extractionResult = ParseAiResponse(completionResult.Content, invoiceText);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to parse AI invoice extraction response");
            extractionResult = new InvoiceExtractionResult
            {
                RawText = invoiceText,
                OverallConfidence = 0,
                Warnings = ["AI returned an unparseable response."]
            };
        }

        // Vendor matching
        extractionResult = await MatchVendorAsync(extractionResult, ct);

        // Log AI usage
        await TryLogUsageAsync(
            Guid.Empty, // userId resolved by controller
            completionResult.Provider,
            completionResult.Model,
            completionResult.InputTokens,
            completionResult.OutputTokens,
            (completionResult.InputTokens + completionResult.OutputTokens) * 0.000003m,
            sw.ElapsedMilliseconds,
            extractionResult.OverallConfidence,
            ct);

        return extractionResult;
    }

    private static InvoiceExtractionResult ParseAiResponse(string content, string rawText)
    {
        content = content.Trim();

        // Strip markdown code fences if present
        if (content.StartsWith("```"))
        {
            var firstNewline = content.IndexOf('\n');
            if (firstNewline >= 0)
                content = content[(firstNewline + 1)..];
            if (content.EndsWith("```"))
                content = content[..^3].TrimEnd();
        }

        var doc = JsonDocument.Parse(content);
        var root = doc.RootElement;

        var lineItems = new List<ExtractedLineItem>();
        if (root.TryGetProperty("lineItems", out var lineItemsEl) && lineItemsEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in lineItemsEl.EnumerateArray())
            {
                lineItems.Add(new ExtractedLineItem
                {
                    Description = GetStringProp(item, "description"),
                    Quantity = GetDecimalProp(item, "quantity"),
                    UnitPrice = GetDecimalProp(item, "unitPrice"),
                    Amount = GetDecimalProp(item, "amount"),
                    CostCode = GetStringProp(item, "costCode")
                });
            }
        }

        var vendorNameConf = GetDecimalProp(root, "vendorNameConfidence") ?? 0;
        var invoiceNumConf = GetDecimalProp(root, "invoiceNumberConfidence") ?? 0;
        var invoiceDateConf = GetDecimalProp(root, "invoiceDateConfidence") ?? 0;
        var dueDateConf = GetDecimalProp(root, "dueDateConfidence") ?? 0;
        var totalAmountConf = GetDecimalProp(root, "totalAmountConfidence") ?? 0;

        // Calculate overall confidence as average of non-zero field confidences
        var confidences = new[] { vendorNameConf, invoiceNumConf, invoiceDateConf, dueDateConf, totalAmountConf };
        var nonZero = confidences.Where(c => c > 0).ToArray();
        var overallConfidence = nonZero.Length > 0 ? nonZero.Average() : 0m;

        return new InvoiceExtractionResult
        {
            VendorName = GetStringProp(root, "vendorName"),
            VendorNameConfidence = vendorNameConf,
            InvoiceNumber = GetStringProp(root, "invoiceNumber"),
            InvoiceNumberConfidence = invoiceNumConf,
            InvoiceDate = ParseDate(GetStringProp(root, "invoiceDate")),
            InvoiceDateConfidence = invoiceDateConf,
            DueDate = ParseDate(GetStringProp(root, "dueDate")),
            DueDateConfidence = dueDateConf,
            LineItems = lineItems,
            SubTotal = GetDecimalProp(root, "subTotal"),
            TaxAmount = GetDecimalProp(root, "taxAmount"),
            TotalAmount = GetDecimalProp(root, "totalAmount"),
            TotalAmountConfidence = totalAmountConf,
            OverallConfidence = Math.Round(overallConfidence, 4),
            RawText = rawText,
            Warnings = new List<string>()
        };
    }

    private async Task<InvoiceExtractionResult> MatchVendorAsync(InvoiceExtractionResult result, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(result.VendorName))
        {
            return result with
            {
                Warnings = [.. result.Warnings, "No vendor name extracted. Cannot match to existing vendor."]
            };
        }

        var vendorName = result.VendorName.Trim();

        var vendors = await db.Set<Vendor>()
            .AsNoTracking()
            .Where(v => !v.IsDeleted && v.IsActive)
            .Select(v => new { v.Id, v.Name, v.Code })
            .ToListAsync(ct);

        // 1. Exact match
        var exact = vendors.FirstOrDefault(v =>
            v.Name.Equals(vendorName, StringComparison.OrdinalIgnoreCase));

        if (exact is not null)
        {
            return result with
            {
                MatchedVendorId = exact.Id,
                MatchedVendorName = exact.Name,
                Warnings = [.. result.Warnings, $"Vendor matched: {exact.Name} ({exact.Code})"]
            };
        }

        // 2. Contains match
        var containsMatches = vendors
            .Where(v => v.Name.Contains(vendorName, StringComparison.OrdinalIgnoreCase)
                     || vendorName.Contains(v.Name, StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (containsMatches.Count == 1)
        {
            return result with
            {
                MatchedVendorId = containsMatches[0].Id,
                MatchedVendorName = containsMatches[0].Name,
                Warnings = [.. result.Warnings, $"Vendor matched (partial): {containsMatches[0].Name} ({containsMatches[0].Code})"]
            };
        }

        if (containsMatches.Count > 1)
        {
            var names = string.Join(", ", containsMatches.Select(v => $"{v.Name} ({v.Code})"));
            return result with
            {
                Warnings = [.. result.Warnings, $"Multiple vendor matches for '{vendorName}': {names}"]
            };
        }

        return result with
        {
            Warnings = [.. result.Warnings, $"Vendor '{vendorName}' not found in system."]
        };
    }

    private async Task TryLogUsageAsync(
        Guid userId, string provider, string model, int tokensIn, int tokensOut,
        decimal estimatedCost, long durationMs, decimal confidence, CancellationToken ct)
    {
        try
        {
            await usageService.LogUsageAsync(
                userId, provider, model, tokensIn, tokensOut,
                estimatedCost, "InvoiceExtraction", (int)durationMs, confidence, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to log AI usage for invoice extraction");
        }
    }

    private static string? GetStringProp(JsonElement el, string name)
    {
        if (el.TryGetProperty(name, out var prop) && prop.ValueKind == JsonValueKind.String)
            return prop.GetString();
        return null;
    }

    private static decimal? GetDecimalProp(JsonElement el, string name)
    {
        if (!el.TryGetProperty(name, out var prop))
            return null;

        return prop.ValueKind switch
        {
            JsonValueKind.Number => prop.GetDecimal(),
            JsonValueKind.String => decimal.TryParse(prop.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : null,
            _ => null
        };
    }

    private static DateOnly? ParseDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        if (DateOnly.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            return date;

        return null;
    }
}
