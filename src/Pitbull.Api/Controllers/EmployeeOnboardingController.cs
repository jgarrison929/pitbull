using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Extensions;
using Pitbull.TimeTracking.Features;
using Pitbull.TimeTracking.Services;

namespace Pitbull.Api.Controllers;

/// <summary>
/// Employee onboarding endpoints for managing the multi-step onboarding process
/// including emergency contacts, tax compliance, certifications, and union affiliations.
/// </summary>
[ApiController]
[Route("api/employee-onboarding")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Employee Onboarding")]
public class EmployeeOnboardingController(
    IEmployeeOnboardingService onboardingService) : ControllerBase
{
    // === Onboarding Status ===

    /// <summary>
    /// Get onboarding status for an employee
    /// </summary>
    [HttpGet("{employeeId:guid}/status")]
    [ProducesResponseType(typeof(EmployeeOnboardingStatusDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetStatus(Guid employeeId)
    {
        var result = await onboardingService.GetOnboardingStatusAsync(employeeId);
        return this.HandleResult(result);
    }

    /// <summary>
    /// Complete onboarding for an employee
    /// </summary>
    [HttpPost("{employeeId:guid}/complete")]
    [ProducesResponseType(typeof(EmployeeOnboardingStatusDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Complete(Guid employeeId, [FromBody] CompleteOnboardingRequest request)
    {
        var result = await onboardingService.CompleteOnboardingAsync(employeeId, request);
        return this.HandleResult(result);
    }

    // === Emergency Contacts ===

    /// <summary>
    /// Get emergency contacts for an employee
    /// </summary>
    [HttpGet("{employeeId:guid}/emergency-contacts")]
    [ProducesResponseType(typeof(IReadOnlyList<EmergencyContactDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetEmergencyContacts(Guid employeeId)
    {
        var result = await onboardingService.GetEmergencyContactsAsync(employeeId);
        return this.HandleResult(result);
    }

    /// <summary>
    /// Add an emergency contact for an employee
    /// </summary>
    [HttpPost("{employeeId:guid}/emergency-contacts")]
    [ProducesResponseType(typeof(EmergencyContactDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddEmergencyContact(
        Guid employeeId, [FromBody] SaveEmergencyContactRequest request)
    {
        var result = await onboardingService.SaveEmergencyContactAsync(employeeId, request);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error }),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }
        return CreatedAtAction(nameof(GetEmergencyContacts), new { employeeId }, result.Value);
    }

    /// <summary>
    /// Delete an emergency contact
    /// </summary>
    [HttpDelete("{employeeId:guid}/emergency-contacts/{contactId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteEmergencyContact(Guid employeeId, Guid contactId)
    {
        var result = await onboardingService.DeleteEmergencyContactAsync(employeeId, contactId);
        if (!result.IsSuccess)
            return NotFound(new { error = result.Error });
        return NoContent();
    }

    // === Tax Compliance ===

    /// <summary>
    /// Get tax compliance data for an employee
    /// </summary>
    [HttpGet("{employeeId:guid}/tax-compliance")]
    [ProducesResponseType(typeof(TaxComplianceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetTaxCompliance(Guid employeeId)
    {
        var result = await onboardingService.GetTaxComplianceAsync(employeeId);
        return this.HandleResult(result);
    }

    /// <summary>
    /// Save tax compliance data for an employee (create or update)
    /// </summary>
    [HttpPut("{employeeId:guid}/tax-compliance")]
    [ProducesResponseType(typeof(TaxComplianceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SaveTaxCompliance(
        Guid employeeId, [FromBody] SaveTaxComplianceRequest request)
    {
        var result = await onboardingService.SaveTaxComplianceAsync(employeeId, request);
        return this.HandleResult(result);
    }

    // === Certifications ===

    /// <summary>
    /// Get certifications for an employee
    /// </summary>
    [HttpGet("{employeeId:guid}/certifications")]
    [ProducesResponseType(typeof(IReadOnlyList<CertificationDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCertifications(Guid employeeId)
    {
        var result = await onboardingService.GetCertificationsAsync(employeeId);
        return this.HandleResult(result);
    }

    /// <summary>
    /// Add a certification for an employee
    /// </summary>
    [HttpPost("{employeeId:guid}/certifications")]
    [ProducesResponseType(typeof(CertificationDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddCertification(
        Guid employeeId, [FromBody] SaveCertificationRequest request)
    {
        var result = await onboardingService.SaveCertificationAsync(employeeId, request);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error }),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }
        return CreatedAtAction(nameof(GetCertifications), new { employeeId }, result.Value);
    }

    /// <summary>
    /// Delete a certification
    /// </summary>
    [HttpDelete("{employeeId:guid}/certifications/{certificationId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteCertification(Guid employeeId, Guid certificationId)
    {
        var result = await onboardingService.DeleteCertificationAsync(employeeId, certificationId);
        if (!result.IsSuccess)
            return NotFound(new { error = result.Error });
        return NoContent();
    }

    // === Union Affiliations ===

    /// <summary>
    /// Get union affiliations for an employee
    /// </summary>
    [HttpGet("{employeeId:guid}/union-affiliations")]
    [ProducesResponseType(typeof(IReadOnlyList<UnionAffiliationDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetUnionAffiliations(Guid employeeId)
    {
        var result = await onboardingService.GetUnionAffiliationsAsync(employeeId);
        return this.HandleResult(result);
    }

    /// <summary>
    /// Add a union affiliation for an employee
    /// </summary>
    [HttpPost("{employeeId:guid}/union-affiliations")]
    [ProducesResponseType(typeof(UnionAffiliationDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddUnionAffiliation(
        Guid employeeId, [FromBody] SaveUnionAffiliationRequest request)
    {
        var result = await onboardingService.SaveUnionAffiliationAsync(employeeId, request);
        if (!result.IsSuccess)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { error = result.Error }),
                _ => BadRequest(new { error = result.Error, code = result.ErrorCode })
            };
        }
        return CreatedAtAction(nameof(GetUnionAffiliations), new { employeeId }, result.Value);
    }

    /// <summary>
    /// Delete a union affiliation
    /// </summary>
    [HttpDelete("{employeeId:guid}/union-affiliations/{affiliationId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteUnionAffiliation(Guid employeeId, Guid affiliationId)
    {
        var result = await onboardingService.DeleteUnionAffiliationAsync(employeeId, affiliationId);
        if (!result.IsSuccess)
            return NotFound(new { error = result.Error });
        return NoContent();
    }
}
