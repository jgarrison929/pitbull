using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Pitbull.Api.Features.AI;

[ApiController]
[Route("api/ai")]
[Authorize(Policy = "AP.View")]
[EnableRateLimiting("ai-invoice")]
[Produces("application/json")]
[Tags("AI")]
public class InvoiceExtractionController(
    IInvoiceVisionExtractionService service,
    ILogger<InvoiceExtractionController> logger) : ControllerBase
{
    [HttpPost("extract-invoice")]
    [RequestSizeLimit(10_485_760)] // 10 MB
    [ProducesResponseType(typeof(InvoiceExtractionResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> ExtractInvoice(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "File is empty." });

        if (file.Length > 10 * 1024 * 1024)
            return BadRequest(new { error = "File exceeds 10 MB limit." });

        byte[] content;
        await using (var stream = file.OpenReadStream())
        {
            using var ms = new MemoryStream();
            await stream.CopyToAsync(ms, ct);
            content = ms.ToArray();
        }

        var result = await service.ExtractFromFileAsync(content, file.ContentType, file.FileName, ct);

        if (result.OverallConfidence == 0 && result.Warnings.Count > 0)
        {
            logger.LogInformation("Invoice extraction returned warnings for {FileName}: {Warnings}",
                file.FileName, string.Join("; ", result.Warnings));
        }

        return Ok(result);
    }
}
