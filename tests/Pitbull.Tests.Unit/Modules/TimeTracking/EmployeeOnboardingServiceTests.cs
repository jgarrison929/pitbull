using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Pitbull.Tests.Unit.Helpers;
using Pitbull.TimeTracking.Domain;
using Pitbull.TimeTracking.Features;
using Pitbull.TimeTracking.Services;

namespace Pitbull.Tests.Unit.Modules.TimeTracking;

public sealed class EmployeeOnboardingServiceTests
{
    private static EmployeeOnboardingService CreateService(Pitbull.Core.Data.PitbullDbContext db) => new(db);

    [Fact]
    public async Task GetOnboardingStatus_NonExistentEmployee_ReturnsNotFound()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.GetOnboardingStatusAsync(Guid.NewGuid());

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task SaveEmergencyContact_NotStartedEmployee_MovesToInProgress()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var employeeId = await SeedEmployeeAsync(db, OnboardingStatus.NotStarted);

        var saveResult = await service.SaveEmergencyContactAsync(
            employeeId,
            new SaveEmergencyContactRequest("Jane Doe", "Spouse", "555-0100", "jane@example.com", null, true));

        saveResult.IsSuccess.Should().BeTrue();

        var employee = await db.Set<Employee>().FirstAsync(e => e.Id == employeeId);
        employee.OnboardingStatus.Should().Be(OnboardingStatus.InProgress);
    }

    [Fact]
    public async Task CompleteOnboarding_InProgressEmployee_SetsCompleteAndTimestamp()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var employeeId = await SeedEmployeeAsync(db, OnboardingStatus.InProgress);

        var result = await service.CompleteOnboardingAsync(employeeId, new CompleteOnboardingRequest("done"));

        result.IsSuccess.Should().BeTrue();
        result.Value!.OnboardingStatus.Should().Be(OnboardingStatus.Complete);
        result.Value.OnboardingCompletedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task CompleteOnboarding_AlreadyComplete_ReturnsAlreadyCompleted()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var employeeId = await SeedEmployeeAsync(db, OnboardingStatus.Complete);

        var result = await service.CompleteOnboardingAsync(employeeId, new CompleteOnboardingRequest(null));

        result.IsSuccess.Should().BeFalse();
        result.ErrorCode.Should().Be("ALREADY_COMPLETED");
    }

    [Fact]
    public async Task SaveTaxCompliance_CompleteEmployee_DoesNotRegressStatus()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var employeeId = await SeedEmployeeAsync(db, OnboardingStatus.Complete);

        var result = await service.SaveTaxComplianceAsync(
            employeeId,
            new SaveTaxComplianceRequest(
                W4FilingStatus.Single,
                W4AdditionalWithholding: 10m,
                W4Exempt: false,
                I9Status.Verified,
                I9Section1Date: DateTime.UtcNow.AddDays(-10),
                I9Section2Date: DateTime.UtcNow.AddDays(-5),
                I9VerifiedBy: "hr@pitbull.local",
                CertifiedPayrollRequired: true,
                DavisBaconApplicable: true,
                PayrollNotes: "verified"));

        result.IsSuccess.Should().BeTrue();

        var employee = await db.Set<Employee>().FirstAsync(e => e.Id == employeeId);
        employee.OnboardingStatus.Should().Be(OnboardingStatus.Complete);
    }

    [Fact]
    public async Task GetOnboardingStatus_WithSavedRecords_ReflectsProgressFlags()
    {
        using var db = TestDbContextFactory.Create();
        var service = CreateService(db);
        var employeeId = await SeedEmployeeAsync(db, OnboardingStatus.NotStarted);

        await service.SaveEmergencyContactAsync(
            employeeId,
            new SaveEmergencyContactRequest("Emergency Contact", "Parent", "555-0111", null, null, true));

        await service.SaveTaxComplianceAsync(
            employeeId,
            new SaveTaxComplianceRequest(
                W4FilingStatus.HeadOfHousehold,
                W4AdditionalWithholding: 0m,
                W4Exempt: false,
                I9Status.Section1Complete,
                I9Section1Date: DateTime.UtcNow.AddDays(-3),
                I9Section2Date: null,
                I9VerifiedBy: null,
                CertifiedPayrollRequired: false,
                DavisBaconApplicable: false,
                PayrollNotes: null));

        var status = await service.GetOnboardingStatusAsync(employeeId);

        status.IsSuccess.Should().BeTrue();
        status.Value!.HasEmergencyContacts.Should().BeTrue();
        status.Value.HasTaxCompliance.Should().BeTrue();
        status.Value.OnboardingStatus.Should().Be(OnboardingStatus.InProgress);
    }

    private static async Task<Guid> SeedEmployeeAsync(Pitbull.Core.Data.PitbullDbContext db, OnboardingStatus status)
    {
        var employee = new Employee
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            EmployeeNumber = $"EMP-{Random.Shared.Next(10000, 99999)}",
            FirstName = "Test",
            LastName = "Worker",
            BaseHourlyRate = 35m,
            Classification = EmployeeClassification.Hourly,
            OnboardingStatus = status,
            OnboardingCompletedAt = status == OnboardingStatus.Complete ? DateTime.UtcNow.AddDays(-1) : null,
            CreatedAt = DateTime.UtcNow
        };

        db.Set<Employee>().Add(employee);
        await db.SaveChangesAsync();
        return employee.Id;
    }
}
