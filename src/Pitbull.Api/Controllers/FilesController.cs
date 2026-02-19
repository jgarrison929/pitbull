using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Documents.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/files")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Files")]
public class FilesController(IFileStorageService fileStorageService) : ControllerBase
{
    private Guid? GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("sub");
        return claim != null && Guid.TryParse(claim.Value, out var id) ? id : null;
    }

    [HttpPost("upload")]
    [RequestSizeLimit(26_214_400)] // 25 MB
    [ProducesResponseType(typeof(FileAttachmentDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Upload(
        IFormFile file,
        [FromForm] string? relatedEntityType = null,
        [FromForm] Guid? relatedEntityId = null)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        if (file.Length == 0)
            return BadRequest(new { error = "File is empty" });

        await using var stream = file.OpenReadStream();
        var command = new UploadFileCommand(
            file.FileName,
            file.ContentType,
            file.Length,
            stream,
            userId.Value,
            relatedEntityType,
            relatedEntityId
        );

        var result = await fileStorageService.UploadAsync(command);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error, code = result.ErrorCode });

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPost("upload-multiple")]
    [RequestSizeLimit(104_857_600)] // 100 MB total
    [ProducesResponseType(typeof(IReadOnlyList<FileAttachmentDto>), StatusCodes.Status201Created)]
    public async Task<IActionResult> UploadMultiple(
        List<IFormFile> files,
        [FromForm] string? relatedEntityType = null,
        [FromForm] Guid? relatedEntityId = null)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var results = new List<FileAttachmentDto>();

        foreach (var file in files)
        {
            if (file.Length == 0) continue;

            await using var stream = file.OpenReadStream();
            var command = new UploadFileCommand(
                file.FileName,
                file.ContentType,
                file.Length,
                stream,
                userId.Value,
                relatedEntityType,
                relatedEntityId
            );

            var result = await fileStorageService.UploadAsync(command);
            if (result.IsSuccess && result.Value is not null)
                results.Add(result.Value);
        }

        return StatusCode(StatusCodes.Status201Created, results);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(FileAttachmentDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await fileStorageService.GetByIdAsync(id);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = "NOT_FOUND" })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return Ok(result.Value);
    }

    [HttpGet("{id:guid}/download")]
    [ProducesResponseType(typeof(FileResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> Download(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await fileStorageService.DownloadAsync(id, userId.Value);
        if (!result.IsSuccess)
            return result.ErrorCode is "NOT_FOUND" or "FILE_MISSING"
                ? NotFound(new { error = result.Error, code = result.ErrorCode })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        var download = result.Value!;
        return File(download.Content, download.ContentType, download.FileName);
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<FileAttachmentDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetByEntity(
        [FromQuery] string entityType,
        [FromQuery] Guid entityId)
    {
        var result = await fileStorageService.GetByEntityAsync(entityType, entityId);
        if (!result.IsSuccess)
            return BadRequest(new { error = result.Error });

        return Ok(result.Value);
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await fileStorageService.DeleteAsync(id, userId.Value);
        if (!result.IsSuccess)
            return result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error, code = "NOT_FOUND" })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });

        return NoContent();
    }
}
