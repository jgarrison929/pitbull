namespace Pitbull.RFIs.Features.GetRfi;

/// <summary>
/// Query parameters for retrieving a single RFI. Used by RfiService.
/// </summary>
public record GetRfiQuery(Guid ProjectId, Guid Id);
