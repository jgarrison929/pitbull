using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Pitbull.AI.Services;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.MultiTenancy;
using Pitbull.Projects.Domain;

namespace Pitbull.Api.Features.AI;

public interface IInvoiceVisionExtractionService
{
    Task<InvoiceExtractionResult> ExtractFromFileAsync(
        byte[] fileContent, string contentType, string fileName, CancellationToken ct);
}

public sealed class InvoiceVisionExtractionService(
    IAiApiKeyService aiApiKeyService,
    IHttpClientFactory httpClientFactory,
    PitbullDbContext db,
    ITenantContext tenant,
    ILogger<InvoiceVisionExtractionService> logger) : IInvoiceVisionExtractionService
{
    private static readonly HashSet<string> SupportedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"
    };

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private const string ExtractionPrompt = """
        You are an invoice data extraction assistant for a construction management ERP.
        Extract structured data from this invoice image and return it as JSON.

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
          "poNumber": "string or null",
          "poNumberConfidence": 0.0-1.0,
          "lineItems": [
            {
              "description": "string",
              "quantity": number or null,
              "unitPrice": number or null,
              "amount": number or null,
              "costCode": "string or null"
            }
          ],
          "subtotal": number or null,
          "tax": number or null,
          "total": number or null,
          "totalConfidence": 0.0-1.0
        }

        RULES:
        - Extract all fields you can identify. Set confidence to 0.0 for fields you cannot find.
        - Look for PO numbers, purchase order references, or "PO #" fields.
        - Dates should be in YYYY-MM-DD format.
        - Monetary amounts should be plain numbers (no currency symbols).
        - For line items, extract as many as visible. If no line items are found, return an empty array.
        - If a cost code can be inferred from the description (e.g., "concrete" = 03-000, "electrical" = 26-000), include it.
        - Confidence scores should reflect how certain you are about each extracted value.
        """;

    public async Task<InvoiceExtractionResult> ExtractFromFileAsync(
        byte[] fileContent, string contentType, string fileName, CancellationToken ct)
    {
        if (fileContent.Length == 0)
            return EmptyResult("File is empty.");

        if (!SupportedTypes.Contains(contentType))
            return EmptyResult($"Unsupported file type: {contentType}. Supported: JPEG, PNG, WEBP, GIF, PDF.");

        var tenantId = tenant.TenantId;

        var apiKeyResult = await aiApiKeyService.GetDecryptedKeyAsync(tenantId, "openai", ct);
        if (!apiKeyResult.IsSuccess)
            return EmptyResult("OpenAI API key not configured. Go to Admin > AI Settings to add one.");

        var base64 = Convert.ToBase64String(fileContent);
        var dataUrl = $"data:{contentType};base64,{base64}";

        string aiResponseContent;
        try
        {
            aiResponseContent = await CallVisionApiAsync(apiKeyResult.Value!, dataUrl, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "OpenAI Vision API call failed for file {FileName}", fileName);
            return EmptyResult("AI extraction failed. Please try again.");
        }

        InvoiceExtractionResult result;
        try
        {
            result = ParseAiResponse(aiResponseContent);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to parse AI extraction response for {FileName}", fileName);
            return EmptyResult("AI returned an unparseable response.");
        }

        result = await EnrichWithVendorMatchesAsync(result, ct);
        result = await EnrichWithPoMatchAsync(result, ct);

        return result;
    }

    private async Task<string> CallVisionApiAsync(string apiKey, string imageDataUrl, CancellationToken ct)
    {
        var client = httpClientFactory.CreateClient("OpenAI");
        using var request = new HttpRequestMessage(HttpMethod.Post, "v1/chat/completions");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        var payload = new
        {
            model = "gpt-4o",
            temperature = 0.1,
            max_tokens = 2048,
            messages = new object[]
            {
                new { role = "system", content = ExtractionPrompt },
                new
                {
                    role = "user",
                    content = new object[]
                    {
                        new { type = "image_url", image_url = new { url = imageDataUrl } },
                        new { type = "text", text = "Extract all invoice data from this document image." }
                    }
                }
            }
        };

        request.Content = new StringContent(
            JsonSerializer.Serialize(payload, JsonOptions),
            Encoding.UTF8,
            "application/json");

        using var response = await client.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("OpenAI Vision API returned {Status}: {Body}",
                (int)response.StatusCode, body.Length > 500 ? body[..500] : body);
            throw new HttpRequestException($"OpenAI Vision API returned {(int)response.StatusCode}");
        }

        using var doc = JsonDocument.Parse(body);
        return doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString() ?? string.Empty;
    }

    internal static InvoiceExtractionResult ParseAiResponse(string content)
    {
        content = content.Trim();

        if (content.StartsWith("```"))
        {
            var firstNewline = content.IndexOf('\n');
            if (firstNewline >= 0)
                content = content[(firstNewline + 1)..];
            if (content.EndsWith("```"))
                content = content[..^3].TrimEnd();
        }

        using var doc = JsonDocument.Parse(content);
        var root = doc.RootElement;

        var lineItems = new List<InvoiceLineItemDto>();
        if (root.TryGetProperty("lineItems", out var lineItemsEl) && lineItemsEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in lineItemsEl.EnumerateArray())
            {
                lineItems.Add(new InvoiceLineItemDto(
                    Description: GetString(item, "description") ?? "",
                    Quantity: GetDecimal(item, "quantity"),
                    UnitPrice: GetDecimal(item, "unitPrice"),
                    Amount: GetDecimal(item, "amount"),
                    CostCode: GetString(item, "costCode")));
            }
        }

        var vendorNameConf = GetDecimal(root, "vendorNameConfidence") ?? 0;
        var invoiceNumConf = GetDecimal(root, "invoiceNumberConfidence") ?? 0;
        var invoiceDateConf = GetDecimal(root, "invoiceDateConfidence") ?? 0;
        var dueDateConf = GetDecimal(root, "dueDateConfidence") ?? 0;
        var poNumberConf = GetDecimal(root, "poNumberConfidence") ?? 0;
        var totalConf = GetDecimal(root, "totalConfidence") ?? 0;

        var confidences = new[] { vendorNameConf, invoiceNumConf, invoiceDateConf, totalConf }
            .Where(c => c > 0).ToArray();
        var overall = confidences.Length > 0 ? confidences.Average() : 0m;

        return new InvoiceExtractionResult
        {
            VendorName = GetString(root, "vendorName"),
            VendorNameConfidence = vendorNameConf,
            InvoiceNumber = GetString(root, "invoiceNumber"),
            InvoiceNumberConfidence = invoiceNumConf,
            InvoiceDate = GetString(root, "invoiceDate"),
            InvoiceDateConfidence = invoiceDateConf,
            DueDate = GetString(root, "dueDate"),
            DueDateConfidence = dueDateConf,
            PoNumber = GetString(root, "poNumber"),
            PoNumberConfidence = poNumberConf,
            LineItems = lineItems,
            Subtotal = GetDecimal(root, "subtotal"),
            Tax = GetDecimal(root, "tax"),
            Total = GetDecimal(root, "total"),
            TotalConfidence = totalConf,
            OverallConfidence = Math.Round(overall, 4)
        };
    }

    private async Task<InvoiceExtractionResult> EnrichWithVendorMatchesAsync(
        InvoiceExtractionResult result, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(result.VendorName))
        {
            return result with
            {
                Warnings = [.. result.Warnings, "No vendor name extracted — cannot match."]
            };
        }

        var vendors = await db.Set<Vendor>()
            .AsNoTracking()
            .Where(v => !v.IsDeleted && v.IsActive)
            .Select(v => new { v.Id, v.Name, v.Code })
            .ToListAsync(ct);

        var extractedName = result.VendorName.Trim();
        var matches = new List<VendorMatchDto>();

        foreach (var v in vendors)
        {
            var score = ComputeMatchScore(extractedName, v.Name);
            if (score >= 0.5m)
                matches.Add(new VendorMatchDto(v.Id, v.Name, v.Code, Math.Round(score, 2)));
        }

        var topMatches = matches.OrderByDescending(m => m.Confidence).Take(3).ToList();
        var warnings = new List<string>(result.Warnings);

        if (topMatches.Count == 0)
            warnings.Add($"No vendor match found for '{extractedName}'.");

        return result with
        {
            VendorMatches = topMatches,
            Warnings = warnings
        };
    }

    private async Task<InvoiceExtractionResult> EnrichWithPoMatchAsync(
        InvoiceExtractionResult result, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(result.PoNumber))
            return result;

        var poNumber = result.PoNumber.Trim();

        var po = await (
            from p in db.Set<PurchaseOrder>().AsNoTracking()
            join proj in db.Set<Project>().AsNoTracking() on p.ProjectId equals proj.Id into projects
            from proj in projects.DefaultIfEmpty()
            where !p.IsDeleted && p.PONumber.ToLower() == poNumber.ToLower()
            select new
            {
                p.Id,
                p.PONumber,
                p.Description,
                p.TotalAmount,
                p.Status,
                p.ProjectId,
                ProjectName = proj != null ? proj.Name : null
            })
            .FirstOrDefaultAsync(ct);

        if (po is null)
        {
            return result with
            {
                Warnings = [.. result.Warnings, $"PO '{poNumber}' not found in system."]
            };
        }

        return result with
        {
            MatchedPurchaseOrder = new PurchaseOrderMatchDto(
                po.Id,
                po.PONumber,
                po.Description,
                po.TotalAmount,
                po.Status.ToString(),
                po.ProjectId,
                po.ProjectName)
        };
    }

    internal static decimal ComputeMatchScore(string extracted, string vendorName)
    {
        var a = extracted.ToLowerInvariant().Trim();
        var b = vendorName.ToLowerInvariant().Trim();

        if (a == b) return 1.0m;

        // Contains match bonus
        if (b.Contains(a) || a.Contains(b))
        {
            var shorter = Math.Min(a.Length, b.Length);
            var longer = Math.Max(a.Length, b.Length);
            return 0.7m + (0.3m * shorter / longer);
        }

        // Levenshtein similarity
        var distance = LevenshteinDistance(a, b);
        var maxLen = Math.Max(a.Length, b.Length);
        if (maxLen == 0) return 1.0m;

        return Math.Max(0, 1.0m - ((decimal)distance / maxLen));
    }

    internal static int LevenshteinDistance(string a, string b)
    {
        if (string.IsNullOrEmpty(a)) return b?.Length ?? 0;
        if (string.IsNullOrEmpty(b)) return a.Length;

        var d = new int[a.Length + 1, b.Length + 1];
        for (var i = 0; i <= a.Length; i++) d[i, 0] = i;
        for (var j = 0; j <= b.Length; j++) d[0, j] = j;

        for (var i = 1; i <= a.Length; i++)
        for (var j = 1; j <= b.Length; j++)
        {
            var cost = a[i - 1] == b[j - 1] ? 0 : 1;
            d[i, j] = Math.Min(
                Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1),
                d[i - 1, j - 1] + cost);
        }

        return d[a.Length, b.Length];
    }

    private static InvoiceExtractionResult EmptyResult(string warning) => new()
    {
        OverallConfidence = 0,
        Warnings = [warning]
    };

    private static string? GetString(JsonElement el, string name)
    {
        if (el.TryGetProperty(name, out var prop) && prop.ValueKind == JsonValueKind.String)
            return prop.GetString();
        return null;
    }

    private static decimal? GetDecimal(JsonElement el, string name)
    {
        if (!el.TryGetProperty(name, out var prop)) return null;
        return prop.ValueKind switch
        {
            JsonValueKind.Number => prop.GetDecimal(),
            JsonValueKind.String => decimal.TryParse(prop.GetString(), NumberStyles.Any,
                CultureInfo.InvariantCulture, out var d) ? d : null,
            _ => null
        };
    }
}
