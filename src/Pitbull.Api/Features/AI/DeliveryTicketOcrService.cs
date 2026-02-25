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

public interface IDeliveryTicketOcrService
{
    Task<DeliveryTicketExtractionResult> ExtractDeliveryTicketAsync(
        byte[] fileContent, string contentType, string fileName, Guid projectId, CancellationToken ct);
}

public sealed class DeliveryTicketOcrService(
    IAiApiKeyService aiApiKeyService,
    IHttpClientFactory httpClientFactory,
    PitbullDbContext db,
    ITenantContext tenant,
    ICompanyContext company,
    ILogger<DeliveryTicketOcrService> logger) : IDeliveryTicketOcrService
{
    private static readonly HashSet<string> SupportedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp", "image/gif"
    };

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private const int MaxStringLength = 500;

    internal const string ExtractionPrompt = """
        You are a delivery ticket data extraction assistant for a construction management ERP.
        Extract structured data from this delivery ticket / delivery slip image and return it as JSON.

        RESPONSE FORMAT (return ONLY valid JSON, no markdown fences):
        {
          "poNumber": "string or null",
          "poNumberConfidence": 0.0-1.0,
          "vendorName": "string or null",
          "vendorNameConfidence": 0.0-1.0,
          "ticketNumber": "string or null",
          "ticketNumberConfidence": 0.0-1.0,
          "deliveryDate": "YYYY-MM-DD or null",
          "deliveryDateConfidence": 0.0-1.0,
          "materials": [
            {
              "description": "string",
              "quantity": number or null,
              "unit": "string or null",
              "costCode": "string or null"
            }
          ]
        }

        RULES:
        - Look for PO numbers, purchase order references, "PO #", or "P.O." fields.
        - Look for ticket/slip/delivery numbers (often at the top of the document).
        - Vendor/supplier name is usually in the header or letterhead of the ticket.
        - Materials may be listed as line items with descriptions, quantities, and units.
        - Common construction units: EA (each), LF (linear feet), SF (square feet), CY (cubic yards), TON, GAL, BG (bags), PC (pieces), LB (pounds), RL (rolls), SHT (sheets).
        - Dates should be in YYYY-MM-DD format.
        - If a cost code can be inferred from the material (e.g., "concrete" = 03-000, "rebar" = 03-200, "lumber" = 06-000, "electrical conduit" = 26-000, "plumbing pipe" = 22-000), include it.
        - Confidence scores should reflect how certain you are about each extracted value.
        - Set confidence to 0.0 for fields you cannot find in the image.
        """;

    public async Task<DeliveryTicketExtractionResult> ExtractDeliveryTicketAsync(
        byte[] fileContent, string contentType, string fileName, Guid projectId, CancellationToken ct)
    {
        if (fileContent.Length == 0)
            return EmptyResult("File is empty.");

        if (!SupportedTypes.Contains(contentType))
            return EmptyResult($"Unsupported file type: {contentType}. Supported: JPEG, PNG, WEBP, GIF.");

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
            logger.LogWarning(ex, "OpenAI Vision API call failed for delivery ticket {FileName}", fileName);
            return EmptyResult("AI extraction failed. Please try again.");
        }

        DeliveryTicketExtractionResult result;
        try
        {
            result = ParseAiResponse(aiResponseContent);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to parse AI extraction response for delivery ticket {FileName}", fileName);
            return EmptyResult("AI returned an unparseable response.");
        }

        result = await EnrichWithVendorMatchesAsync(result, ct);
        result = await EnrichWithPoMatchAsync(result, projectId, ct);

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
            response_format = new { type = "json_object" },
            messages = new object[]
            {
                new { role = "system", content = ExtractionPrompt },
                new
                {
                    role = "user",
                    content = new object[]
                    {
                        new { type = "image_url", image_url = new { url = imageDataUrl } },
                        new { type = "text", text = "Extract all delivery ticket data from this document image." }
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

    internal static DeliveryTicketExtractionResult ParseAiResponse(string content)
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

        var materials = new List<DeliveryMaterialLineDto>();
        if (root.TryGetProperty("materials", out var materialsEl) && materialsEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in materialsEl.EnumerateArray())
            {
                materials.Add(new DeliveryMaterialLineDto(
                    Description: Truncate(GetString(item, "description") ?? "", MaxStringLength) ?? "",
                    Quantity: ClampQuantity(GetDecimal(item, "quantity")),
                    Unit: Truncate(GetString(item, "unit"), 20),
                    CostCode: Truncate(GetString(item, "costCode"), 20)));
            }
        }

        var vendorConf = ClampConfidence(GetDecimal(root, "vendorNameConfidence") ?? 0);
        var poConf = ClampConfidence(GetDecimal(root, "poNumberConfidence") ?? 0);
        var ticketConf = ClampConfidence(GetDecimal(root, "ticketNumberConfidence") ?? 0);
        var dateConf = ClampConfidence(GetDecimal(root, "deliveryDateConfidence") ?? 0);

        var confidences = new[] { vendorConf, poConf, ticketConf, dateConf }
            .Where(c => c > 0).ToArray();
        var overall = confidences.Length > 0 ? confidences.Average() : 0m;

        return new DeliveryTicketExtractionResult
        {
            PoNumber = Truncate(GetString(root, "poNumber"), 100),
            PoNumberConfidence = poConf,
            VendorName = Truncate(GetString(root, "vendorName"), MaxStringLength),
            VendorNameConfidence = vendorConf,
            TicketNumber = Truncate(GetString(root, "ticketNumber"), 100),
            TicketNumberConfidence = ticketConf,
            DeliveryDate = Truncate(GetString(root, "deliveryDate"), 10),
            DeliveryDateConfidence = dateConf,
            Materials = materials,
            OverallConfidence = Math.Round(overall, 4)
        };
    }

    internal async Task<DeliveryTicketExtractionResult> EnrichWithVendorMatchesAsync(
        DeliveryTicketExtractionResult result, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(result.VendorName))
        {
            return result with
            {
                Warnings = [.. result.Warnings, "No vendor name extracted — cannot match."]
            };
        }

        var companyId = company.CompanyId;
        var vendors = await db.Set<Vendor>()
            .AsNoTracking()
            .Where(v => !v.IsDeleted && v.IsActive && v.CompanyId == companyId)
            .Select(v => new { v.Id, v.Name, v.Code })
            .ToListAsync(ct);

        var extractedName = result.VendorName.Trim();
        var matches = new List<VendorMatchDto>();

        foreach (var v in vendors)
        {
            var score = InvoiceVisionExtractionService.ComputeMatchScore(extractedName, v.Name);
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

    internal async Task<DeliveryTicketExtractionResult> EnrichWithPoMatchAsync(
        DeliveryTicketExtractionResult result, Guid projectId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(result.PoNumber))
            return result;

        var poNumber = result.PoNumber.Trim();
        var companyId = company.CompanyId;

        // First try exact match within the project
        var po = await (
            from p in db.Set<PurchaseOrder>().AsNoTracking()
            join proj in db.Set<Project>().AsNoTracking() on p.ProjectId equals proj.Id into projects
            from proj in projects.DefaultIfEmpty()
            where !p.IsDeleted
                  && p.CompanyId == companyId
                  && p.PONumber.ToLower() == poNumber.ToLower()
                  && p.ProjectId == projectId
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

        // Fall back to any PO in the same company if not found in this project
        po ??= await (
            from p in db.Set<PurchaseOrder>().AsNoTracking()
            join proj in db.Set<Project>().AsNoTracking() on p.ProjectId equals proj.Id into projects
            from proj in projects.DefaultIfEmpty()
            where !p.IsDeleted
                  && p.CompanyId == companyId
                  && p.PONumber.ToLower() == poNumber.ToLower()
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

    internal static decimal ClampConfidence(decimal value) =>
        Math.Max(0, Math.Min(1, value));

    private static decimal? ClampQuantity(decimal? value) =>
        value.HasValue ? Math.Max(0, value.Value) : null;

    private static string? Truncate(string? value, int maxLength) =>
        value is not null && value.Length > maxLength ? value[..maxLength] : value;

    private static DeliveryTicketExtractionResult EmptyResult(string warning) => new()
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
