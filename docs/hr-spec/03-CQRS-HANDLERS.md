# HR Core Module - CQRS Commands & Queries Specification

**Version:** 1.0.0  
**Date:** February 8, 2026  
**Module:** Pitbull.HRCore  
**Pattern:** MediatR CQRS with FluentValidation

---

## Table of Contents

1. [Overview](#1-overview)
2. [Domain Events](#2-domain-events)
3. [Shared Types](#3-shared-types)
4. [Employee Commands](#4-employee-commands)
5. [Employee Queries](#5-employee-queries)
6. [Certification Commands](#6-certification-commands)
7. [Certification Queries](#7-certification-queries)
8. [Pay Rate Commands](#8-pay-rate-commands)
9. [Pay Rate Queries](#9-pay-rate-queries)
10. [Withholding & Deduction Commands](#10-withholding--deduction-commands)
11. [Withholding & Deduction Queries](#11-withholding--deduction-queries)
12. [Employment Episode Commands](#12-employment-episode-commands)
13. [EEO Data Commands & Queries](#13-eeo-data-commands--queries)
14. [Compliance Queries](#14-compliance-queries)
15. [File Structure](#15-file-structure)

---

## 1. Overview

This specification defines all Commands and Queries for the HR Core module following Pitbull's established CQRS patterns. All commands return `Result<T>` for consistent error handling without exceptions.

### Design Principles

1. **Idempotency**: All commands include optional `CorrelationId` for retry-safe agent automation
2. **Event Sourcing**: Commands publish domain events for audit trail and cross-module integration
3. **Effective Dating**: All temporal data uses `DateOnly` with `EffectiveDate`/`ExpirationDate` patterns
4. **Strong Typing**: Use strongly-typed IDs (`EmployeeId`, `CertificationId`, etc.) over raw `Guid`

### Namespace Convention

```
Pitbull.HRCore.Features.{Feature}/
    {Feature}Command.cs
    {Feature}Handler.cs
    {Feature}Validator.cs
```

---

## 2. Domain Events

All domain events inherit from `DomainEventBase` and are dispatched via MediatR after `SaveChangesAsync`.

### Employee Events

```csharp
namespace Pitbull.HRCore.Domain.Events;

// Employee Lifecycle
public sealed record EmployeeCreatedEvent(
    Guid EmployeeId,
    Guid TenantId,
    string EmployeeNumber,
    string FirstName,
    string LastName,
    DateOnly HireDate,
    WorkerType WorkerType
) : DomainEventBase;

public sealed record EmployeeUpdatedEvent(
    Guid EmployeeId,
    Guid TenantId,
    IReadOnlyDictionary<string, (object? OldValue, object? NewValue)> Changes
) : DomainEventBase;

public sealed record EmployeeTerminatedEvent(
    Guid EmployeeId,
    Guid TenantId,
    DateOnly TerminationDate,
    SeparationReason Reason,
    bool EligibleForRehire
) : DomainEventBase;

public sealed record EmployeeRehiredEvent(
    Guid EmployeeId,
    Guid TenantId,
    Guid NewEpisodeId,
    DateOnly RehireDate
) : DomainEventBase;

public sealed record EmployeeStatusChangedEvent(
    Guid EmployeeId,
    Guid TenantId,
    EmploymentStatus OldStatus,
    EmploymentStatus NewStatus,
    string? Reason
) : DomainEventBase;

// Certification Events
public sealed record CertificationAddedEvent(
    Guid CertificationId,
    Guid EmployeeId,
    Guid TenantId,
    CertificationType Type,
    DateOnly? ExpirationDate
) : DomainEventBase;

public sealed record CertificationVerifiedEvent(
    Guid CertificationId,
    Guid EmployeeId,
    Guid TenantId,
    string VerifiedBy
) : DomainEventBase;

public sealed record CertificationExpiredEvent(
    Guid CertificationId,
    Guid EmployeeId,
    Guid TenantId,
    CertificationType Type,
    DateOnly ExpirationDate
) : DomainEventBase;

public sealed record CertificationExpiringWarningEvent(
    Guid CertificationId,
    Guid EmployeeId,
    Guid TenantId,
    CertificationType Type,
    DateOnly ExpirationDate,
    int DaysUntilExpiration
) : DomainEventBase;

public sealed record CertificationRevokedEvent(
    Guid CertificationId,
    Guid EmployeeId,
    Guid TenantId,
    CertificationType Type,
    string Reason
) : DomainEventBase;

// Pay Rate Events
public sealed record PayRateAddedEvent(
    Guid PayRateId,
    Guid EmployeeId,
    Guid TenantId,
    RateType RateType,
    decimal Amount,
    DateOnly EffectiveDate,
    Guid? ProjectId
) : DomainEventBase;

public sealed record PayRateUpdatedEvent(
    Guid PayRateId,
    Guid EmployeeId,
    Guid TenantId,
    decimal OldAmount,
    decimal NewAmount
) : DomainEventBase;

public sealed record PayRateExpiredEvent(
    Guid PayRateId,
    Guid EmployeeId,
    Guid TenantId,
    DateOnly ExpirationDate
) : DomainEventBase;

// Withholding Events
public sealed record WithholdingElectionChangedEvent(
    Guid ElectionId,
    Guid EmployeeId,
    Guid TenantId,
    WithholdingType Type,
    DateOnly EffectiveDate
) : DomainEventBase;

// Deduction Events
public sealed record DeductionAddedEvent(
    Guid DeductionId,
    Guid EmployeeId,
    Guid TenantId,
    DeductionType Type,
    string Description
) : DomainEventBase;

public sealed record DeductionModifiedEvent(
    Guid DeductionId,
    Guid EmployeeId,
    Guid TenantId,
    DeductionType Type,
    IReadOnlyDictionary<string, (object? OldValue, object? NewValue)> Changes
) : DomainEventBase;
```

---

## 3. Shared Types

### Strongly-Typed IDs

```csharp
namespace Pitbull.HRCore.Domain;

public readonly record struct EmployeeId(Guid Value)
{
    public static EmployeeId New() => new(Guid.NewGuid());
    public static implicit operator Guid(EmployeeId id) => id.Value;
    public static explicit operator EmployeeId(Guid guid) => new(guid);
    public override string ToString() => Value.ToString();
}

public readonly record struct CertificationId(Guid Value);
public readonly record struct PayRateId(Guid Value);
public readonly record struct DeductionId(Guid Value);
public readonly record struct WithholdingElectionId(Guid Value);
public readonly record struct EmploymentEpisodeId(Guid Value);
```

### Enums

```csharp
namespace Pitbull.HRCore.Domain;

public enum EmploymentStatus
{
    Active,
    Inactive,
    Terminated,
    SeasonalInactive,
    OnLeave
}

public enum WorkerType
{
    Field,
    Office,
    Hybrid
}

public enum SeparationReason
{
    ProjectEnd,
    Voluntary,
    TerminationForCause,
    TerminationWithoutCause,
    Seasonal,
    Retirement,
    Deceased,
    Other
}

public enum CertificationType
{
    OSHA10,
    OSHA30,
    FirstAid,
    CPR,
    Forklift,
    CraneOperator,
    Welding,
    ConfinedSpace,
    FallProtection,
    Excavation,
    Scaffolding,
    Rigging,
    HazMat,
    Electrical,
    Plumbing,
    HVAC,
    DriversLicense,
    CDL,
    Other
}

public enum VerificationStatus
{
    Pending,
    Verified,
    Expired,
    Revoked
}

public enum RateType
{
    Hourly,
    Salary,
    PieceRate,
    PerDiem
}

public enum DeductionType
{
    Benefit,
    Garnishment,
    UnionDues,
    Retirement401k,
    HSA,
    FSA,
    Insurance,
    ChildSupport,
    TaxLevy,
    Other
}

public enum CalculationMethod
{
    Flat,
    Percentage,
    HoursBased
}

public enum WithholdingType
{
    FederalW4,
    StateWithholding
}

public enum FilingStatus
{
    Single,
    MarriedFilingJointly,
    MarriedFilingSeparately,
    HeadOfHousehold
}
```

### Common DTOs

```csharp
namespace Pitbull.HRCore.Features;

// Base Employee DTO used across multiple queries
public record EmployeeDto(
    Guid Id,
    string EmployeeNumber,
    string FirstName,
    string? MiddleName,
    string LastName,
    EmploymentStatus Status,
    WorkerType WorkerType,
    DateOnly HireDate,
    DateOnly? TerminationDate,
    string? TradeCode,
    string? WorkersCompClassCode,
    Guid? DefaultCrewId,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

// Detailed Employee with nested data
public record EmployeeDetailDto(
    Guid Id,
    string EmployeeNumber,
    PersonalInfoDto PersonalInfo,
    EmploymentInfoDto Employment,
    WorkerClassificationDto Classification,
    TaxProfileDto TaxProfile,
    IReadOnlyList<CertificationDto> Certifications,
    IReadOnlyList<PayRateDto> ActivePayRates,
    IReadOnlyList<DeductionDto> ActiveDeductions,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record PersonalInfoDto(
    string FirstName,
    string? MiddleName,
    string LastName,
    DateOnly DateOfBirth,
    AddressDto? HomeAddress,
    string? Phone,
    string? Email,
    IReadOnlyList<EmergencyContactDto> EmergencyContacts
);

public record EmploymentInfoDto(
    string EmployeeNumber,
    EmploymentStatus Status,
    DateOnly HireDate,
    DateOnly? TerminationDate,
    bool EligibleForRehire,
    IReadOnlyList<EmploymentEpisodeDto> Episodes
);

public record WorkerClassificationDto(
    WorkerType Type,
    string? TradeCode,
    string? UnionLocal,
    string? WorkersCompClassCode,
    Guid? DefaultCrewId
);

public record TaxProfileDto(
    string HomeState,
    IReadOnlyList<string> WorkStates,
    string SuiState
);

public record AddressDto(
    string Line1,
    string? Line2,
    string City,
    string State,
    string ZipCode,
    string? County
);

public record EmergencyContactDto(
    string Name,
    string Relationship,
    string Phone,
    string? AlternatePhone
);

public record CertificationDto(
    Guid Id,
    CertificationType Type,
    string TypeDisplayName,
    string? IssuingAuthority,
    DateOnly IssueDate,
    DateOnly? ExpirationDate,
    VerificationStatus Status,
    string? DocumentUrl,
    bool IsExpired,
    int? DaysUntilExpiration
);

public record PayRateDto(
    Guid Id,
    RateType RateType,
    decimal Amount,
    DateOnly EffectiveDate,
    DateOnly? ExpirationDate,
    Guid? ProjectId,
    string? ProjectName,
    Guid? JobClassificationId,
    string? JobClassificationName,
    Guid? WageDeterminationId,
    string? ShiftCode,
    int Priority
);

public record DeductionDto(
    Guid Id,
    DeductionType Type,
    string Description,
    CalculationMethod CalculationMethod,
    decimal AmountOrRate,
    decimal? CapAmount,
    decimal YtdWithheld,
    decimal ArrearsBalance,
    int Priority,
    DateOnly EffectiveDate,
    DateOnly? ExpirationDate
);

public record WithholdingElectionDto(
    Guid Id,
    WithholdingType Type,
    FilingStatus FilingStatus,
    bool MultipleJobs,
    decimal DependentsAmount,
    decimal OtherIncome,
    decimal Deductions,
    decimal ExtraWithholding,
    string? StateCode,
    int? StateAllowances,
    decimal? StateAdditionalAmount,
    DateOnly EffectiveDate,
    DateOnly? ExpirationDate
);

public record EmploymentEpisodeDto(
    Guid Id,
    DateOnly HireDate,
    DateOnly? TerminationDate,
    SeparationReason? SeparationReason,
    bool? EligibleForRehire,
    string? RehireNotes,
    string? UnionDispatchReference
);

// Lightweight list item DTO
public record EmployeeListItemDto(
    Guid Id,
    string EmployeeNumber,
    string FullName,
    EmploymentStatus Status,
    WorkerType WorkerType,
    string? TradeCode,
    DateOnly HireDate,
    int ActiveCertificationCount,
    bool HasExpiringCertifications
);

// Work eligibility response for TimeTracking integration
public record WorkEligibilityDto(
    Guid EmployeeId,
    bool CanWork,
    IReadOnlyList<string> Blockers,
    IReadOnlyList<CertificationDto> ExpiringCertifications
);

// Pay rate resolution response for Payroll integration
public record ResolvedPayRateDto(
    Guid PayRateId,
    decimal Rate,
    RateType RateType,
    Guid? WageDeterminationId,
    string? WageDeterminationCode,
    bool IsPrevailingWage
);

// Tax jurisdiction response for Payroll integration
public record TaxJurisdictionDto(
    string Federal,
    IReadOnlyList<string> States,
    IReadOnlyList<string> Localities,
    string SuiState
);

// Bulk certification validation response
public record BulkCertificationValidationDto(
    IReadOnlyList<Guid> ValidEmployeeIds,
    IReadOnlyList<CertificationViolationDto> Violations
);

public record CertificationViolationDto(
    Guid EmployeeId,
    string EmployeeName,
    CertificationType MissingCertification,
    string? ExpirationInfo
);
```

---

## 4. Employee Commands

### 4.1 CreateEmployeeCommand

Creates a new employee with initial employment episode.

```csharp
namespace Pitbull.HRCore.Features.CreateEmployee;

public record CreateEmployeeCommand(
    // Personal Info (required)
    string FirstName,
    string LastName,
    DateOnly DateOfBirth,
    string SsnEncrypted,
    
    // Personal Info (optional)
    string? MiddleName,
    string? Phone,
    string? Email,
    
    // Home Address
    string? AddressLine1,
    string? AddressLine2,
    string? City,
    string? State,
    string? ZipCode,
    string? County,
    
    // Employment (required)
    string EmployeeNumber,
    DateOnly HireDate,
    WorkerType WorkerType,
    
    // Classification (optional)
    string? TradeCode,
    string? UnionLocal,
    string? WorkersCompClassCode,
    Guid? DefaultCrewId,
    
    // Tax Profile
    string HomeState,
    string SuiState,
    IReadOnlyList<string>? WorkStates,
    
    // Initial Pay Rate (optional but recommended)
    RateType? InitialRateType,
    decimal? InitialPayRate,
    
    // Emergency Contacts (optional)
    IReadOnlyList<CreateEmergencyContactDto>? EmergencyContacts,
    
    // Union-specific
    string? UnionDispatchReference,
    
    // Idempotency
    Guid? CorrelationId
) : ICommand<EmployeeDetailDto>;

public record CreateEmergencyContactDto(
    string Name,
    string Relationship,
    string Phone,
    string? AlternatePhone
);
```

**Handler Signature:**

```csharp
namespace Pitbull.HRCore.Features.CreateEmployee;

public sealed class CreateEmployeeHandler(
    HRCoreDbContext db,
    IEmployeeNumberGenerator employeeNumberGenerator,
    IEncryptionService encryption,
    ILogger<CreateEmployeeHandler> logger
) : IRequestHandler<CreateEmployeeCommand, Result<EmployeeDetailDto>>
{
    public async Task<Result<EmployeeDetailDto>> Handle(
        CreateEmployeeCommand request, 
        CancellationToken cancellationToken);
}
```

**Domain Events Published:**
- `EmployeeCreatedEvent`
- `PayRateAddedEvent` (if initial pay rate provided)

**Validator:**

```csharp
namespace Pitbull.HRCore.Features.CreateEmployee;

public class CreateEmployeeValidator : AbstractValidator<CreateEmployeeCommand>
{
    public CreateEmployeeValidator(HRCoreDbContext db)
    {
        // Required fields
        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("First name is required")
            .MaximumLength(100).WithMessage("First name cannot exceed 100 characters");
            
        RuleFor(x => x.LastName)
            .NotEmpty().WithMessage("Last name is required")
            .MaximumLength(100).WithMessage("Last name cannot exceed 100 characters");
            
        RuleFor(x => x.MiddleName)
            .MaximumLength(100).WithMessage("Middle name cannot exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.MiddleName));
            
        RuleFor(x => x.DateOfBirth)
            .NotEmpty().WithMessage("Date of birth is required")
            .LessThan(DateOnly.FromDateTime(DateTime.Today.AddYears(-14)))
            .WithMessage("Employee must be at least 14 years old")
            .GreaterThan(DateOnly.FromDateTime(DateTime.Today.AddYears(-120)))
            .WithMessage("Invalid date of birth");
            
        RuleFor(x => x.SsnEncrypted)
            .NotEmpty().WithMessage("SSN is required");
            
        RuleFor(x => x.EmployeeNumber)
            .NotEmpty().WithMessage("Employee number is required")
            .MaximumLength(20).WithMessage("Employee number cannot exceed 20 characters")
            .Matches(@"^[A-Z0-9\-]+$").WithMessage("Employee number can only contain letters, numbers, and hyphens")
            .MustAsync(async (number, ct) => !await db.Employees.AnyAsync(e => e.EmployeeNumber == number, ct))
            .WithMessage("Employee number already exists");
            
        RuleFor(x => x.HireDate)
            .NotEmpty().WithMessage("Hire date is required")
            .LessThanOrEqualTo(DateOnly.FromDateTime(DateTime.Today.AddMonths(3)))
            .WithMessage("Hire date cannot be more than 3 months in the future");
            
        RuleFor(x => x.WorkerType)
            .IsInEnum().WithMessage("Invalid worker type");
            
        // Contact info validation
        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("Invalid email format")
            .MaximumLength(256).WithMessage("Email cannot exceed 256 characters")
            .When(x => !string.IsNullOrEmpty(x.Email));
            
        RuleFor(x => x.Phone)
            .MaximumLength(20).WithMessage("Phone number cannot exceed 20 characters")
            .Matches(@"^\+?[\d\s\-\(\)]+$").WithMessage("Invalid phone number format")
            .When(x => !string.IsNullOrEmpty(x.Phone));
            
        // Address validation
        RuleFor(x => x.AddressLine1)
            .MaximumLength(200).WithMessage("Address line 1 cannot exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.AddressLine1));
            
        RuleFor(x => x.AddressLine2)
            .MaximumLength(200).WithMessage("Address line 2 cannot exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.AddressLine2));
            
        RuleFor(x => x.City)
            .MaximumLength(100).WithMessage("City cannot exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.City));
            
        RuleFor(x => x.State)
            .MaximumLength(2).WithMessage("State must be 2-letter code")
            .Matches(@"^[A-Z]{2}$").WithMessage("State must be valid 2-letter state code")
            .When(x => !string.IsNullOrEmpty(x.State));
            
        RuleFor(x => x.ZipCode)
            .MaximumLength(10).WithMessage("Zip code cannot exceed 10 characters")
            .Matches(@"^\d{5}(-\d{4})?$").WithMessage("Invalid zip code format")
            .When(x => !string.IsNullOrEmpty(x.ZipCode));
            
        // Tax profile validation
        RuleFor(x => x.HomeState)
            .NotEmpty().WithMessage("Home state is required")
            .MaximumLength(2).WithMessage("Home state must be 2-letter code")
            .Matches(@"^[A-Z]{2}$").WithMessage("Home state must be valid 2-letter state code");
            
        RuleFor(x => x.SuiState)
            .NotEmpty().WithMessage("SUI state is required")
            .MaximumLength(2).WithMessage("SUI state must be 2-letter code")
            .Matches(@"^[A-Z]{2}$").WithMessage("SUI state must be valid 2-letter state code");
            
        RuleForEach(x => x.WorkStates)
            .Matches(@"^[A-Z]{2}$").WithMessage("Work state must be valid 2-letter state code")
            .When(x => x.WorkStates != null && x.WorkStates.Any());
            
        // Initial pay rate validation
        RuleFor(x => x.InitialPayRate)
            .GreaterThan(0).WithMessage("Pay rate must be greater than zero")
            .LessThanOrEqualTo(10000).WithMessage("Pay rate seems unreasonably high")
            .When(x => x.InitialPayRate.HasValue);
            
        RuleFor(x => x.InitialRateType)
            .IsInEnum().WithMessage("Invalid rate type")
            .When(x => x.InitialRateType.HasValue);
            
        RuleFor(x => x)
            .Must(x => (x.InitialPayRate.HasValue && x.InitialRateType.HasValue) ||
                       (!x.InitialPayRate.HasValue && !x.InitialRateType.HasValue))
            .WithMessage("Both initial pay rate and rate type must be provided together");
            
        // Classification
        RuleFor(x => x.TradeCode)
            .MaximumLength(50).WithMessage("Trade code cannot exceed 50 characters")
            .When(x => !string.IsNullOrEmpty(x.TradeCode));
            
        RuleFor(x => x.WorkersCompClassCode)
            .MaximumLength(10).WithMessage("Workers comp class code cannot exceed 10 characters")
            .When(x => !string.IsNullOrEmpty(x.WorkersCompClassCode));
            
        // Emergency contacts
        RuleForEach(x => x.EmergencyContacts)
            .ChildRules(contact =>
            {
                contact.RuleFor(c => c.Name)
                    .NotEmpty().WithMessage("Emergency contact name is required")
                    .MaximumLength(200).WithMessage("Emergency contact name cannot exceed 200 characters");
                    
                contact.RuleFor(c => c.Relationship)
                    .NotEmpty().WithMessage("Emergency contact relationship is required")
                    .MaximumLength(50).WithMessage("Relationship cannot exceed 50 characters");
                    
                contact.RuleFor(c => c.Phone)
                    .NotEmpty().WithMessage("Emergency contact phone is required")
                    .MaximumLength(20).WithMessage("Phone cannot exceed 20 characters");
            })
            .When(x => x.EmergencyContacts != null && x.EmergencyContacts.Any());
    }
}
```

---

### 4.2 UpdateEmployeeCommand

Updates employee information. Tracks changes for audit.

```csharp
namespace Pitbull.HRCore.Features.UpdateEmployee;

public record UpdateEmployeeCommand(
    Guid Id,
    
    // Personal Info
    string FirstName,
    string? MiddleName,
    string LastName,
    string? Phone,
    string? Email,
    
    // Home Address
    string? AddressLine1,
    string? AddressLine2,
    string? City,
    string? State,
    string? ZipCode,
    string? County,
    
    // Classification
    WorkerType WorkerType,
    string? TradeCode,
    string? UnionLocal,
    string? WorkersCompClassCode,
    Guid? DefaultCrewId,
    
    // Tax Profile
    string HomeState,
    string SuiState,
    IReadOnlyList<string>? WorkStates,
    
    // Idempotency
    Guid? CorrelationId
) : ICommand<EmployeeDetailDto>;
```

**Handler Signature:**

```csharp
public sealed class UpdateEmployeeHandler(
    HRCoreDbContext db,
    ILogger<UpdateEmployeeHandler> logger
) : IRequestHandler<UpdateEmployeeCommand, Result<EmployeeDetailDto>>;
```

**Domain Events Published:**
- `EmployeeUpdatedEvent` (with change dictionary)

**Validator:**

```csharp
public class UpdateEmployeeValidator : AbstractValidator<UpdateEmployeeCommand>
{
    public UpdateEmployeeValidator(HRCoreDbContext db)
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Employee ID is required")
            .MustAsync(async (id, ct) => await db.Employees.AnyAsync(e => e.Id == id && !e.IsDeleted, ct))
            .WithMessage("Employee not found");
            
        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("First name is required")
            .MaximumLength(100).WithMessage("First name cannot exceed 100 characters");
            
        RuleFor(x => x.LastName)
            .NotEmpty().WithMessage("Last name is required")
            .MaximumLength(100).WithMessage("Last name cannot exceed 100 characters");
            
        RuleFor(x => x.MiddleName)
            .MaximumLength(100).WithMessage("Middle name cannot exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.MiddleName));
            
        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("Invalid email format")
            .MaximumLength(256).WithMessage("Email cannot exceed 256 characters")
            .When(x => !string.IsNullOrEmpty(x.Email));
            
        RuleFor(x => x.Phone)
            .MaximumLength(20).WithMessage("Phone number cannot exceed 20 characters")
            .Matches(@"^\+?[\d\s\-\(\)]+$").WithMessage("Invalid phone number format")
            .When(x => !string.IsNullOrEmpty(x.Phone));
            
        RuleFor(x => x.WorkerType)
            .IsInEnum().WithMessage("Invalid worker type");
            
        RuleFor(x => x.HomeState)
            .NotEmpty().WithMessage("Home state is required")
            .MaximumLength(2).WithMessage("Home state must be 2-letter code")
            .Matches(@"^[A-Z]{2}$").WithMessage("Home state must be valid 2-letter state code");
            
        RuleFor(x => x.SuiState)
            .NotEmpty().WithMessage("SUI state is required")
            .MaximumLength(2).WithMessage("SUI state must be 2-letter code")
            .Matches(@"^[A-Z]{2}$").WithMessage("SUI state must be valid 2-letter state code");
            
        // Address validation (same as Create)
        RuleFor(x => x.State)
            .MaximumLength(2).WithMessage("State must be 2-letter code")
            .Matches(@"^[A-Z]{2}$").WithMessage("State must be valid 2-letter state code")
            .When(x => !string.IsNullOrEmpty(x.State));
            
        RuleFor(x => x.ZipCode)
            .Matches(@"^\d{5}(-\d{4})?$").WithMessage("Invalid zip code format")
            .When(x => !string.IsNullOrEmpty(x.ZipCode));
    }
}
```

---

### 4.3 TerminateEmployeeCommand

Terminates an employee, closing the current employment episode.

```csharp
namespace Pitbull.HRCore.Features.TerminateEmployee;

public record TerminateEmployeeCommand(
    Guid EmployeeId,
    DateOnly TerminationDate,
    SeparationReason Reason,
    bool EligibleForRehire,
    string? RehireNotes,
    string? TerminationNotes,
    Guid? CorrelationId
) : ICommand<EmployeeDto>;
```

**Handler Signature:**

```csharp
public sealed class TerminateEmployeeHandler(
    HRCoreDbContext db,
    ILogger<TerminateEmployeeHandler> logger
) : IRequestHandler<TerminateEmployeeCommand, Result<EmployeeDto>>;
```

**Domain Events Published:**
- `EmployeeTerminatedEvent`
- `EmployeeStatusChangedEvent`

**Validator:**

```csharp
public class TerminateEmployeeValidator : AbstractValidator<TerminateEmployeeCommand>
{
    public TerminateEmployeeValidator(HRCoreDbContext db)
    {
        RuleFor(x => x.EmployeeId)
            .NotEmpty().WithMessage("Employee ID is required")
            .MustAsync(async (id, ct) => await db.Employees.AnyAsync(
                e => e.Id == id && !e.IsDeleted && e.Status != EmploymentStatus.Terminated, ct))
            .WithMessage("Employee not found or already terminated");
            
        RuleFor(x => x.TerminationDate)
            .NotEmpty().WithMessage("Termination date is required")
            .LessThanOrEqualTo(DateOnly.FromDateTime(DateTime.Today.AddDays(30)))
            .WithMessage("Termination date cannot be more than 30 days in the future");
            
        RuleFor(x => x.Reason)
            .IsInEnum().WithMessage("Invalid separation reason");
            
        RuleFor(x => x.RehireNotes)
            .MaximumLength(1000).WithMessage("Rehire notes cannot exceed 1000 characters")
            .When(x => !string.IsNullOrEmpty(x.RehireNotes));
            
        RuleFor(x => x.TerminationNotes)
            .MaximumLength(2000).WithMessage("Termination notes cannot exceed 2000 characters")
            .When(x => !string.IsNullOrEmpty(x.TerminationNotes));
            
        // Require notes if termination for cause
        RuleFor(x => x.TerminationNotes)
            .NotEmpty().WithMessage("Termination notes required for termination for cause")
            .When(x => x.Reason == SeparationReason.TerminationForCause);
    }
}
```

---

### 4.4 RehireEmployeeCommand

Rehires a previously terminated employee, creating a new employment episode.

```csharp
namespace Pitbull.HRCore.Features.RehireEmployee;

public record RehireEmployeeCommand(
    Guid EmployeeId,
    DateOnly RehireDate,
    
    // Optional updates on rehire
    WorkerType? WorkerType,
    string? TradeCode,
    string? UnionLocal,
    Guid? DefaultCrewId,
    string? UnionDispatchReference,
    
    // Initial pay rate for new episode
    RateType? InitialRateType,
    decimal? InitialPayRate,
    
    Guid? CorrelationId
) : ICommand<EmployeeDetailDto>;
```

**Handler Signature:**

```csharp
public sealed class RehireEmployeeHandler(
    HRCoreDbContext db,
    ILogger<RehireEmployeeHandler> logger
) : IRequestHandler<RehireEmployeeCommand, Result<EmployeeDetailDto>>;
```

**Domain Events Published:**
- `EmployeeRehiredEvent`
- `EmployeeStatusChangedEvent`
- `PayRateAddedEvent` (if new rate provided)

**Validator:**

```csharp
public class RehireEmployeeValidator : AbstractValidator<RehireEmployeeCommand>
{
    public RehireEmployeeValidator(HRCoreDbContext db)
    {
        RuleFor(x => x.EmployeeId)
            .NotEmpty().WithMessage("Employee ID is required")
            .MustAsync(async (id, ct) =>
            {
                var employee = await db.Employees.FirstOrDefaultAsync(
                    e => e.Id == id && !e.IsDeleted, ct);
                return employee != null &&
                       employee.Status == EmploymentStatus.Terminated &&
                       employee.EligibleForRehire;
            })
            .WithMessage("Employee not found, not terminated, or not eligible for rehire");
            
        RuleFor(x => x.RehireDate)
            .NotEmpty().WithMessage("Rehire date is required")
            .LessThanOrEqualTo(DateOnly.FromDateTime(DateTime.Today.AddMonths(3)))
            .WithMessage("Rehire date cannot be more than 3 months in the future");
            
        RuleFor(x => x.WorkerType)
            .IsInEnum().WithMessage("Invalid worker type")
            .When(x => x.WorkerType.HasValue);
            
        RuleFor(x => x.InitialPayRate)
            .GreaterThan(0).WithMessage("Pay rate must be greater than zero")
            .When(x => x.InitialPayRate.HasValue);
            
        RuleFor(x => x)
            .Must(x => (x.InitialPayRate.HasValue && x.InitialRateType.HasValue) ||
                       (!x.InitialPayRate.HasValue && !x.InitialRateType.HasValue))
            .WithMessage("Both initial pay rate and rate type must be provided together");
    }
}
```

---

### 4.5 ChangeEmployeeStatusCommand

Changes employee status (e.g., Active → SeasonalInactive).

```csharp
namespace Pitbull.HRCore.Features.ChangeEmployeeStatus;

public record ChangeEmployeeStatusCommand(
    Guid EmployeeId,
    EmploymentStatus NewStatus,
    string? Reason,
    DateOnly? EffectiveDate,
    Guid? CorrelationId
) : ICommand<EmployeeDto>;
```

**Validator:**

```csharp
public class ChangeEmployeeStatusValidator : AbstractValidator<ChangeEmployeeStatusCommand>
{
    public ChangeEmployeeStatusValidator(HRCoreDbContext db)
    {
        RuleFor(x => x.EmployeeId)
            .NotEmpty().WithMessage("Employee ID is required")
            .MustAsync(async (id, ct) => await db.Employees.AnyAsync(
                e => e.Id == id && !e.IsDeleted, ct))
            .WithMessage("Employee not found");
            
        RuleFor(x => x.NewStatus)
            .IsInEnum().WithMessage("Invalid status")
            .NotEqual(EmploymentStatus.Terminated)
            .WithMessage("Use TerminateEmployee command for terminations");
            
        RuleFor(x => x.Reason)
            .MaximumLength(500).WithMessage("Reason cannot exceed 500 characters");
    }
}
```

**Domain Events Published:**
- `EmployeeStatusChangedEvent`

---

### 4.6 UpdateEmergencyContactsCommand

Updates an employee's emergency contacts.

```csharp
namespace Pitbull.HRCore.Features.UpdateEmergencyContacts;

public record UpdateEmergencyContactsCommand(
    Guid EmployeeId,
    IReadOnlyList<EmergencyContactInput> Contacts,
    Guid? CorrelationId
) : ICommand<EmployeeDto>;

public record EmergencyContactInput(
    string Name,
    string Relationship,
    string Phone,
    string? AlternatePhone
);
```

**Validator:**

```csharp
public class UpdateEmergencyContactsValidator : AbstractValidator<UpdateEmergencyContactsCommand>
{
    public UpdateEmergencyContactsValidator(HRCoreDbContext db)
    {
        RuleFor(x => x.EmployeeId)
            .NotEmpty().WithMessage("Employee ID is required")
            .MustAsync(async (id, ct) => await db.Employees.AnyAsync(
                e => e.Id == id && !e.IsDeleted, ct))
            .WithMessage("Employee not found");
            
        RuleFor(x => x.Contacts)
            .NotNull().WithMessage("Contacts list is required");
            
        RuleForEach(x => x.Contacts)
            .ChildRules(contact =>
            {
                contact.RuleFor(c => c.Name)
                    .NotEmpty().WithMessage("Contact name is required")
                    .MaximumLength(200);
                    
                contact.RuleFor(c => c.Relationship)
                    .NotEmpty().WithMessage("Relationship is required")
                    .MaximumLength(50);
                    
                contact.RuleFor(c => c.Phone)
                    .NotEmpty().WithMessage("Phone is required")
                    .MaximumLength(20)
                    .Matches(@"^\+?[\d\s\-\(\)]+$").WithMessage("Invalid phone format");
            });
    }
}
```

**Domain Events Published:**
- `EmployeeUpdatedEvent`

---

### 4.7 DeleteEmployeeCommand (Soft Delete)

Soft deletes an employee. Requires terminated status and no active time entries.

```csharp
namespace Pitbull.HRCore.Features.DeleteEmployee;

public record DeleteEmployeeCommand(
    Guid EmployeeId,
    string Reason,
    Guid? CorrelationId
) : ICommand;
```

**Validator:**

```csharp
public class DeleteEmployeeValidator : AbstractValidator<DeleteEmployeeCommand>
{
    public DeleteEmployeeValidator(HRCoreDbContext db, ITimeTrackingService timeTracking)
    {
        RuleFor(x => x.EmployeeId)
            .NotEmpty().WithMessage("Employee ID is required")
            .MustAsync(async (id, ct) =>
            {
                var employee = await db.Employees.FirstOrDefaultAsync(
                    e => e.Id == id && !e.IsDeleted, ct);
                return employee?.Status == EmploymentStatus.Terminated;
            })
            .WithMessage("Only terminated employees can be deleted")
            .MustAsync(async (id, ct) => !await timeTracking.HasUnprocessedTimeEntries(id, ct))
            .WithMessage("Employee has unprocessed time entries");
            
        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("Deletion reason is required")
            .MaximumLength(500).WithMessage("Reason cannot exceed 500 characters");
    }
}
```

---

## 5. Employee Queries

### 5.1 GetEmployeeQuery

Gets detailed employee information by ID.

```csharp
namespace Pitbull.HRCore.Features.GetEmployee;

public record GetEmployeeQuery(
    Guid Id,
    bool IncludeCertifications = true,
    bool IncludePayRates = true,
    bool IncludeDeductions = false,
    bool IncludeEpisodes = false
) : IQuery<EmployeeDetailDto>;
```

**Handler Signature:**

```csharp
public sealed class GetEmployeeHandler(
    HRCoreDbContext db
) : IRequestHandler<GetEmployeeQuery, Result<EmployeeDetailDto>>
{
    public async Task<Result<EmployeeDetailDto>> Handle(
        GetEmployeeQuery request,
        CancellationToken cancellationToken);
}
```

---

### 5.2 GetEmployeeByNumberQuery

Gets employee by employee number.

```csharp
namespace Pitbull.HRCore.Features.GetEmployeeByNumber;

public record GetEmployeeByNumberQuery(
    string EmployeeNumber
) : IQuery<EmployeeDetailDto>;
```

---

### 5.3 ListEmployeesQuery

Paginated list of employees with filtering.

```csharp
namespace Pitbull.HRCore.Features.ListEmployees;

public record ListEmployeesQuery(
    EmploymentStatus? Status = null,
    WorkerType? WorkerType = null,
    string? TradeCode = null,
    Guid? CrewId = null,
    string? Search = null,
    bool IncludeTerminated = false,
    DateOnly? ActiveAsOf = null,
    ListEmployeesSortBy SortBy = ListEmployeesSortBy.Name,
    bool SortDescending = false
) : PaginationQuery, IQuery<PagedResult<EmployeeListItemDto>>;

public enum ListEmployeesSortBy
{
    Name,
    EmployeeNumber,
    HireDate,
    Status,
    TradeCode
}
```

**Handler Signature:**

```csharp
public sealed class ListEmployeesHandler(
    HRCoreDbContext db
) : IRequestHandler<ListEmployeesQuery, Result<PagedResult<EmployeeListItemDto>>>;
```

**Validator:**

```csharp
public class ListEmployeesValidator : AbstractValidator<ListEmployeesQuery>
{
    public ListEmployeesValidator()
    {
        RuleFor(x => x.Search)
            .MaximumLength(100).WithMessage("Search term cannot exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.Search));
            
        RuleFor(x => x.TradeCode)
            .MaximumLength(50).WithMessage("Trade code cannot exceed 50 characters")
            .When(x => !string.IsNullOrEmpty(x.TradeCode));
            
        RuleFor(x => x.SortBy)
            .IsInEnum().WithMessage("Invalid sort field");
    }
}
```

---

### 5.4 SearchEmployeesQuery

Full-text search across employee data for autocomplete.

```csharp
namespace Pitbull.HRCore.Features.SearchEmployees;

public record SearchEmployeesQuery(
    string Query,
    int Limit = 10,
    bool ActiveOnly = true
) : IQuery<IReadOnlyList<EmployeeSearchResultDto>>;

public record EmployeeSearchResultDto(
    Guid Id,
    string EmployeeNumber,
    string FullName,
    EmploymentStatus Status,
    string? TradeCode,
    string MatchField  // Which field matched (name, number, trade)
);
```

---

### 5.5 CheckWorkEligibilityQuery

Checks if employee can work on a project (TimeTracking integration).

```csharp
namespace Pitbull.HRCore.Features.CheckWorkEligibility;

public record CheckWorkEligibilityQuery(
    Guid EmployeeId,
    Guid? ProjectId = null,
    DateOnly? Date = null
) : IQuery<WorkEligibilityDto>;
```

**Handler Implementation Notes:**
- Returns blockers for: Terminated/Inactive status, missing required certs, expired certs
- Checks project-specific certification requirements if ProjectId provided
- Date defaults to today if not specified

---

### 5.6 GetEmployeeHistoryQuery

Gets full employment history for an employee.

```csharp
namespace Pitbull.HRCore.Features.GetEmployeeHistory;

public record GetEmployeeHistoryQuery(
    Guid EmployeeId
) : IQuery<EmployeeHistoryDto>;

public record EmployeeHistoryDto(
    Guid EmployeeId,
    string EmployeeNumber,
    string FullName,
    DateOnly OriginalHireDate,
    int TotalEpisodes,
    IReadOnlyList<EmploymentEpisodeDto> Episodes,
    IReadOnlyList<AuditLogEntryDto> RecentChanges
);

public record AuditLogEntryDto(
    DateTime Timestamp,
    string Action,
    string Field,
    string? OldValue,
    string? NewValue,
    string ChangedBy
);
```

---

## 6. Certification Commands

### 6.1 AddCertificationCommand

Adds a certification to an employee.

```csharp
namespace Pitbull.HRCore.Features.AddCertification;

public record AddCertificationCommand(
    Guid EmployeeId,
    CertificationType Type,
    string? CustomTypeName,  // If Type == Other
    string? IssuingAuthority,
    DateOnly IssueDate,
    DateOnly? ExpirationDate,
    string? DocumentUrl,
    string? Notes,
    Guid? CorrelationId
) : ICommand<CertificationDto>;
```

**Validator:**

```csharp
public class AddCertificationValidator : AbstractValidator<AddCertificationCommand>
{
    public AddCertificationValidator(HRCoreDbContext db)
    {
        RuleFor(x => x.EmployeeId)
            .NotEmpty().WithMessage("Employee ID is required")
            .MustAsync(async (id, ct) => await db.Employees.AnyAsync(
                e => e.Id == id && !e.IsDeleted, ct))
            .WithMessage("Employee not found");
            
        RuleFor(x => x.Type)
            .IsInEnum().WithMessage("Invalid certification type");
            
        RuleFor(x => x.CustomTypeName)
            .NotEmpty().WithMessage("Custom type name required when type is Other")
            .MaximumLength(100).WithMessage("Custom type name cannot exceed 100 characters")
            .When(x => x.Type == CertificationType.Other);
            
        RuleFor(x => x.IssueDate)
            .NotEmpty().WithMessage("Issue date is required")
            .LessThanOrEqualTo(DateOnly.FromDateTime(DateTime.Today))
            .WithMessage("Issue date cannot be in the future");
            
        RuleFor(x => x.ExpirationDate)
            .GreaterThan(x => x.IssueDate)
            .WithMessage("Expiration date must be after issue date")
            .When(x => x.ExpirationDate.HasValue);
            
        RuleFor(x => x.IssuingAuthority)
            .MaximumLength(200).WithMessage("Issuing authority cannot exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.IssuingAuthority));
            
        RuleFor(x => x.DocumentUrl)
            .Must(url => Uri.TryCreate(url, UriKind.Absolute, out _))
            .WithMessage("Invalid document URL")
            .When(x => !string.IsNullOrEmpty(x.DocumentUrl));
            
        // Prevent duplicate active certifications of same type
        RuleFor(x => x)
            .MustAsync(async (cmd, ct) =>
            {
                return !await db.Certifications.AnyAsync(c =>
                    c.EmployeeId == cmd.EmployeeId &&
                    c.Type == cmd.Type &&
                    c.Status != VerificationStatus.Expired &&
                    c.Status != VerificationStatus.Revoked, ct);
            })
            .WithMessage("Employee already has an active certification of this type");
    }
}
```

**Domain Events Published:**
- `CertificationAddedEvent`

---

### 6.2 VerifyCertificationCommand

Marks a certification as verified.

```csharp
namespace Pitbull.HRCore.Features.VerifyCertification;

public record VerifyCertificationCommand(
    Guid CertificationId,
    string VerifiedBy,
    string? VerificationNotes,
    Guid? CorrelationId
) : ICommand<CertificationDto>;
```

**Validator:**

```csharp
public class VerifyCertificationValidator : AbstractValidator<VerifyCertificationCommand>
{
    public VerifyCertificationValidator(HRCoreDbContext db)
    {
        RuleFor(x => x.CertificationId)
            .NotEmpty().WithMessage("Certification ID is required")
            .MustAsync(async (id, ct) =>
            {
                var cert = await db.Certifications.FirstOrDefaultAsync(c => c.Id == id, ct);
                return cert != null && cert.Status == VerificationStatus.Pending;
            })
            .WithMessage("Certification not found or not in pending status");
            
        RuleFor(x => x.VerifiedBy)
            .NotEmpty().WithMessage("Verifier name is required")
            .MaximumLength(100).WithMessage("Verifier name cannot exceed 100 characters");
    }
}
```

**Domain Events Published:**
- `CertificationVerifiedEvent`

---

### 6.3 RevokeCertificationCommand

Revokes a certification (e.g., fraud discovered).

```csharp
namespace Pitbull.HRCore.Features.RevokeCertification;

public record RevokeCertificationCommand(
    Guid CertificationId,
    string Reason,
    string RevokedBy,
    Guid? CorrelationId
) : ICommand<CertificationDto>;
```

**Validator:**

```csharp
public class RevokeCertificationValidator : AbstractValidator<RevokeCertificationCommand>
{
    public RevokeCertificationValidator(HRCoreDbContext db)
    {
        RuleFor(x => x.CertificationId)
            .NotEmpty().WithMessage("Certification ID is required")
            .MustAsync(async (id, ct) =>
            {
                var cert = await db.Certifications.FirstOrDefaultAsync(c => c.Id == id, ct);
                return cert != null && cert.Status != VerificationStatus.Revoked;
            })
            .WithMessage("Certification not found or already revoked");
            
        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("Revocation reason is required")
            .MaximumLength(1000).WithMessage("Reason cannot exceed 1000 characters");
            
        RuleFor(x => x.RevokedBy)
            .NotEmpty().WithMessage("Revoker name is required")
            .MaximumLength(100).WithMessage("Revoker name cannot exceed 100 characters");
    }
}
```

**Domain Events Published:**
- `CertificationRevokedEvent`

---

### 6.4 RenewCertificationCommand

Renews an existing certification with new dates.

```csharp
namespace Pitbull.HRCore.Features.RenewCertification;

public record RenewCertificationCommand(
    Guid EmployeeId,
    CertificationType Type,
    DateOnly NewIssueDate,
    DateOnly? NewExpirationDate,
    string? NewIssuingAuthority,
    string? NewDocumentUrl,
    Guid? CorrelationId
) : ICommand<CertificationDto>;
```

**Handler Notes:**
- Expires the old certification and creates a new one
- Maintains certification history

**Domain Events Published:**
- `CertificationExpiredEvent` (for old cert)
- `CertificationAddedEvent` (for new cert)

---

### 6.5 UpdateCertificationDocumentCommand

Updates the document URL for a certification.

```csharp
namespace Pitbull.HRCore.Features.UpdateCertificationDocument;

public record UpdateCertificationDocumentCommand(
    Guid CertificationId,
    string DocumentUrl,
    Guid? CorrelationId
) : ICommand<CertificationDto>;
```

---

## 7. Certification Queries

### 7.1 GetCertificationQuery

```csharp
namespace Pitbull.HRCore.Features.GetCertification;

public record GetCertificationQuery(
    Guid CertificationId
) : IQuery<CertificationDto>;
```

---

### 7.2 ListEmployeeCertificationsQuery

```csharp
namespace Pitbull.HRCore.Features.ListEmployeeCertifications;

public record ListEmployeeCertificationsQuery(
    Guid EmployeeId,
    bool IncludeExpired = false,
    bool IncludeRevoked = false
) : IQuery<IReadOnlyList<CertificationDto>>;
```

---

### 7.3 ListExpiringCertificationsQuery

Lists certifications expiring within a date range (for compliance dashboards).

```csharp
namespace Pitbull.HRCore.Features.ListExpiringCertifications;

public record ListExpiringCertificationsQuery(
    int DaysAhead = 30,
    CertificationType? Type = null,
    Guid? ProjectId = null  // Filter to employees assigned to project
) : PaginationQuery, IQuery<PagedResult<ExpiringCertificationDto>>;

public record ExpiringCertificationDto(
    Guid CertificationId,
    Guid EmployeeId,
    string EmployeeNumber,
    string EmployeeName,
    CertificationType Type,
    string TypeDisplayName,
    DateOnly ExpirationDate,
    int DaysUntilExpiration,
    bool Warning30DaysSent,
    bool Warning60DaysSent,
    bool Warning90DaysSent
);
```

---

### 7.4 ValidateCertificationsQuery

Bulk validation for project mobilization.

```csharp
namespace Pitbull.HRCore.Features.ValidateCertifications;

public record ValidateCertificationsQuery(
    Guid ProjectId,
    IReadOnlyList<Guid> EmployeeIds,
    IReadOnlyList<CertificationType> RequiredCertifications,
    DateOnly? AsOfDate = null
) : IQuery<BulkCertificationValidationDto>;
```

**Handler Notes:**
- Checks each employee for all required certifications
- Returns list of valid employees and detailed violations
- Used by TimeTracking/Projects for mobilization checks

---

### 7.5 GetCertificationComplianceReportQuery

Generates compliance report for audits.

```csharp
namespace Pitbull.HRCore.Features.GetCertificationComplianceReport;

public record GetCertificationComplianceReportQuery(
    DateOnly AsOfDate,
    CertificationType? Type = null,
    Guid? ProjectId = null
) : IQuery<CertificationComplianceReportDto>;

public record CertificationComplianceReportDto(
    DateOnly AsOfDate,
    int TotalActiveEmployees,
    int EmployeesWithAllRequiredCerts,
    int EmployeesWithExpiringCerts,
    int EmployeesWithMissingCerts,
    IReadOnlyList<CertificationTypeStatsDto> StatsByType
);

public record CertificationTypeStatsDto(
    CertificationType Type,
    string TypeDisplayName,
    int TotalRequired,
    int TotalCurrent,
    int TotalExpiring30Days,
    int TotalExpired,
    decimal CompliancePercentage
);
```

---

## 8. Pay Rate Commands

### 8.1 AddPayRateCommand

Adds a new pay rate for an employee.

```csharp
namespace Pitbull.HRCore.Features.AddPayRate;

public record AddPayRateCommand(
    Guid EmployeeId,
    RateType RateType,
    decimal Amount,
    DateOnly EffectiveDate,
    DateOnly? ExpirationDate,
    
    // Scoping (all optional)
    Guid? ProjectId,
    Guid? JobClassificationId,
    Guid? WageDeterminationId,
    string? ShiftCode,
    int Priority = 0,
    
    string? Notes,
    Guid? CorrelationId
) : ICommand<PayRateDto>;
```

**Validator:**

```csharp
public class AddPayRateValidator : AbstractValidator<AddPayRateCommand>
{
    public AddPayRateValidator(HRCoreDbContext db, IProjectService projectService)
    {
        RuleFor(x => x.EmployeeId)
            .NotEmpty().WithMessage("Employee ID is required")
            .MustAsync(async (id, ct) => await db.Employees.AnyAsync(
                e => e.Id == id && !e.IsDeleted, ct))
            .WithMessage("Employee not found");
            
        RuleFor(x => x.RateType)
            .IsInEnum().WithMessage("Invalid rate type");
            
        RuleFor(x => x.Amount)
            .GreaterThan(0).WithMessage("Amount must be greater than zero")
            .LessThanOrEqualTo(10000).WithMessage("Amount seems unreasonably high - please verify")
            .PrecisionScale(10, 4, true).WithMessage("Amount cannot have more than 4 decimal places");
            
        RuleFor(x => x.EffectiveDate)
            .NotEmpty().WithMessage("Effective date is required");
            
        RuleFor(x => x.ExpirationDate)
            .GreaterThan(x => x.EffectiveDate)
            .WithMessage("Expiration date must be after effective date")
            .When(x => x.ExpirationDate.HasValue);
            
        // Validate project exists if specified
        RuleFor(x => x.ProjectId)
            .MustAsync(async (id, ct) => await projectService.ExistsAsync(id!.Value, ct))
            .WithMessage("Project not found")
            .When(x => x.ProjectId.HasValue);
            
        RuleFor(x => x.ShiftCode)
            .MaximumLength(10).WithMessage("Shift code cannot exceed 10 characters")
            .Matches(@"^[A-Z0-9]+$").WithMessage("Shift code must be alphanumeric")
            .When(x => !string.IsNullOrEmpty(x.ShiftCode));
            
        RuleFor(x => x.Priority)
            .InclusiveBetween(0, 100).WithMessage("Priority must be between 0 and 100");
            
        // Warn on overlapping rates with same scope
        RuleFor(x => x)
            .MustAsync(async (cmd, ct) =>
            {
                var overlapping = await db.PayRates.AnyAsync(pr =>
                    pr.EmployeeId == cmd.EmployeeId &&
                    pr.ProjectId == cmd.ProjectId &&
                    pr.JobClassificationId == cmd.JobClassificationId &&
                    pr.ShiftCode == cmd.ShiftCode &&
                    pr.EffectiveDate <= (cmd.ExpirationDate ?? DateOnly.MaxValue) &&
                    (pr.ExpirationDate == null || pr.ExpirationDate >= cmd.EffectiveDate), ct);
                return !overlapping;
            })
            .WithMessage("Overlapping pay rate exists with same scope - verify priority is correct");
    }
}
```

**Domain Events Published:**
- `PayRateAddedEvent`

---

### 8.2 UpdatePayRateCommand

Updates an existing pay rate.

```csharp
namespace Pitbull.HRCore.Features.UpdatePayRate;

public record UpdatePayRateCommand(
    Guid PayRateId,
    decimal Amount,
    DateOnly? ExpirationDate,
    int? Priority,
    string? Notes,
    Guid? CorrelationId
) : ICommand<PayRateDto>;
```

**Validator:**

```csharp
public class UpdatePayRateValidator : AbstractValidator<UpdatePayRateCommand>
{
    public UpdatePayRateValidator(HRCoreDbContext db)
    {
        RuleFor(x => x.PayRateId)
            .NotEmpty().WithMessage("Pay rate ID is required")
            .MustAsync(async (id, ct) => await db.PayRates.AnyAsync(pr => pr.Id == id, ct))
            .WithMessage("Pay rate not found");
            
        RuleFor(x => x.Amount)
            .GreaterThan(0).WithMessage("Amount must be greater than zero")
            .LessThanOrEqualTo(10000).WithMessage("Amount seems unreasonably high")
            .PrecisionScale(10, 4, true).WithMessage("Amount cannot have more than 4 decimal places");
            
        RuleFor(x => x.Priority)
            .InclusiveBetween(0, 100).WithMessage("Priority must be between 0 and 100")
            .When(x => x.Priority.HasValue);
    }
}
```

**Domain Events Published:**
- `PayRateUpdatedEvent`

---

### 8.3 ExpirePayRateCommand

Manually expires a pay rate.

```csharp
namespace Pitbull.HRCore.Features.ExpirePayRate;

public record ExpirePayRateCommand(
    Guid PayRateId,
    DateOnly ExpirationDate,
    string? Reason,
    Guid? CorrelationId
) : ICommand<PayRateDto>;
```

**Domain Events Published:**
- `PayRateExpiredEvent`

---

### 8.4 BulkUpdatePayRatesCommand

Updates pay rates for multiple employees (e.g., annual raise).

```csharp
namespace Pitbull.HRCore.Features.BulkUpdatePayRates;

public record BulkUpdatePayRatesCommand(
    IReadOnlyList<Guid> EmployeeIds,
    decimal PercentageIncrease,  // e.g., 0.03 for 3%
    DateOnly EffectiveDate,
    RateType? FilterRateType = null,  // Only update certain rate types
    Guid? FilterProjectId = null,  // Only update rates for specific project
    string? Notes,
    Guid? CorrelationId
) : ICommand<BulkPayRateUpdateResultDto>;

public record BulkPayRateUpdateResultDto(
    int TotalEmployees,
    int RatesUpdated,
    int RatesSkipped,
    IReadOnlyList<PayRateUpdateDetailDto> Details
);

public record PayRateUpdateDetailDto(
    Guid EmployeeId,
    Guid PayRateId,
    decimal OldAmount,
    decimal NewAmount,
    bool Success,
    string? ErrorMessage
);
```

**Validator:**

```csharp
public class BulkUpdatePayRatesValidator : AbstractValidator<BulkUpdatePayRatesCommand>
{
    public BulkUpdatePayRatesValidator()
    {
        RuleFor(x => x.EmployeeIds)
            .NotEmpty().WithMessage("At least one employee ID required")
            .Must(ids => ids.Count <= 500).WithMessage("Cannot update more than 500 employees at once");
            
        RuleFor(x => x.PercentageIncrease)
            .NotEqual(0).WithMessage("Percentage increase cannot be zero")
            .InclusiveBetween(-0.50m, 0.50m).WithMessage("Percentage must be between -50% and +50%");
            
        RuleFor(x => x.EffectiveDate)
            .NotEmpty().WithMessage("Effective date is required");
    }
}
```

---

## 9. Pay Rate Queries

### 9.1 GetPayRateQuery

```csharp
namespace Pitbull.HRCore.Features.GetPayRate;

public record GetPayRateQuery(
    Guid PayRateId
) : IQuery<PayRateDto>;
```

---

### 9.2 ListEmployeePayRatesQuery

```csharp
namespace Pitbull.HRCore.Features.ListEmployeePayRates;

public record ListEmployeePayRatesQuery(
    Guid EmployeeId,
    bool IncludeExpired = false,
    DateOnly? AsOfDate = null
) : IQuery<IReadOnlyList<PayRateDto>>;
```

---

### 9.3 ResolvePayRateQuery

Resolves the correct pay rate for a work scenario (Payroll integration).

```csharp
namespace Pitbull.HRCore.Features.ResolvePayRate;

public record ResolvePayRateQuery(
    Guid EmployeeId,
    DateOnly WorkDate,
    Guid? ProjectId = null,
    Guid? JobClassificationId = null,
    string? ShiftCode = null
) : IQuery<ResolvedPayRateDto>;
```

**Handler Implementation Notes:**
- Returns highest-priority matching rate
- Priority order: Project+Job+Shift > Project+Job > Project > Job > Default
- Returns error if no applicable rate found

---

### 9.4 GetPrevailingWageRatesQuery

Gets prevailing wage rates for a project.

```csharp
namespace Pitbull.HRCore.Features.GetPrevailingWageRates;

public record GetPrevailingWageRatesQuery(
    Guid ProjectId,
    DateOnly? AsOfDate = null
) : IQuery<IReadOnlyList<PrevailingWageRateDto>>;

public record PrevailingWageRateDto(
    Guid WageDeterminationId,
    string WageDeterminationCode,
    string JobClassification,
    decimal BaseRate,
    decimal FringeRate,
    decimal TotalRate,
    DateOnly EffectiveDate,
    DateOnly? ExpirationDate
);
```

---

## 10. Withholding & Deduction Commands

### 10.1 UpdateWithholdingElectionCommand

Updates W-4 or state withholding election.

```csharp
namespace Pitbull.HRCore.Features.UpdateWithholdingElection;

public record UpdateWithholdingElectionCommand(
    Guid EmployeeId,
    WithholdingType Type,
    
    // Federal W-4 fields
    FilingStatus FilingStatus,
    bool MultipleJobs,
    decimal DependentsAmount,
    decimal OtherIncome,
    decimal Deductions,
    decimal ExtraWithholding,
    
    // State-specific (when Type == StateWithholding)
    string? StateCode,
    int? StateAllowances,
    decimal? StateAdditionalAmount,
    
    DateOnly EffectiveDate,
    
    Guid? CorrelationId
) : ICommand<WithholdingElectionDto>;
```

**Validator:**

```csharp
public class UpdateWithholdingElectionValidator : AbstractValidator<UpdateWithholdingElectionCommand>
{
    public UpdateWithholdingElectionValidator(HRCoreDbContext db)
    {
        RuleFor(x => x.EmployeeId)
            .NotEmpty().WithMessage("Employee ID is required")
            .MustAsync(async (id, ct) => await db.Employees.AnyAsync(
                e => e.Id == id && !e.IsDeleted, ct))
            .WithMessage("Employee not found");
            
        RuleFor(x => x.Type)
            .IsInEnum().WithMessage("Invalid withholding type");
            
        RuleFor(x => x.FilingStatus)
            .IsInEnum().WithMessage("Invalid filing status");
            
        RuleFor(x => x.DependentsAmount)
            .GreaterThanOrEqualTo(0).WithMessage("Dependents amount cannot be negative");
            
        RuleFor(x => x.OtherIncome)
            .GreaterThanOrEqualTo(0).WithMessage("Other income cannot be negative");
            
        RuleFor(x => x.Deductions)
            .GreaterThanOrEqualTo(0).WithMessage("Deductions cannot be negative");
            
        RuleFor(x => x.ExtraWithholding)
            .GreaterThanOrEqualTo(0).WithMessage("Extra withholding cannot be negative");
            
        // State withholding validations
        RuleFor(x => x.StateCode)
            .NotEmpty().WithMessage("State code required for state withholding")
            .Matches(@"^[A-Z]{2}$").WithMessage("State must be valid 2-letter state code")
            .When(x => x.Type == WithholdingType.StateWithholding);
            
        RuleFor(x => x.StateAllowances)
            .GreaterThanOrEqualTo(0).WithMessage("State allowances cannot be negative")
            .When(x => x.StateAllowances.HasValue);
            
        RuleFor(x => x.StateAdditionalAmount)
            .GreaterThanOrEqualTo(0).WithMessage("State additional amount cannot be negative")
            .When(x => x.StateAdditionalAmount.HasValue);
            
        RuleFor(x => x.EffectiveDate)
            .NotEmpty().WithMessage("Effective date is required");
    }
}
```

**Domain Events Published:**
- `WithholdingElectionChangedEvent`

---

### 10.2 AddDeductionCommand

Adds a deduction to an employee.

```csharp
namespace Pitbull.HRCore.Features.AddDeduction;

public record AddDeductionCommand(
    Guid EmployeeId,
    DeductionType Type,
    string Description,
    CalculationMethod CalculationMethod,
    decimal AmountOrRate,
    decimal? CapAmount,
    int Priority,
    DateOnly EffectiveDate,
    DateOnly? ExpirationDate,
    
    // Garnishment-specific
    string? CaseNumber,
    string? PayableTo,
    
    Guid? CorrelationId
) : ICommand<DeductionDto>;
```

**Validator:**

```csharp
public class AddDeductionValidator : AbstractValidator<AddDeductionCommand>
{
    public AddDeductionValidator(HRCoreDbContext db)
    {
        RuleFor(x => x.EmployeeId)
            .NotEmpty().WithMessage("Employee ID is required")
            .MustAsync(async (id, ct) => await db.Employees.AnyAsync(
                e => e.Id == id && !e.IsDeleted, ct))
            .WithMessage("Employee not found");
            
        RuleFor(x => x.Type)
            .IsInEnum().WithMessage("Invalid deduction type");
            
        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Description is required")
            .MaximumLength(200).WithMessage("Description cannot exceed 200 characters");
            
        RuleFor(x => x.CalculationMethod)
            .IsInEnum().WithMessage("Invalid calculation method");
            
        RuleFor(x => x.AmountOrRate)
            .GreaterThan(0).WithMessage("Amount/rate must be greater than zero");
            
        // Percentage validation
        RuleFor(x => x.AmountOrRate)
            .LessThanOrEqualTo(1).WithMessage("Percentage cannot exceed 100%")
            .When(x => x.CalculationMethod == CalculationMethod.Percentage);
            
        RuleFor(x => x.CapAmount)
            .GreaterThan(0).WithMessage("Cap amount must be greater than zero")
            .When(x => x.CapAmount.HasValue);
            
        RuleFor(x => x.Priority)
            .InclusiveBetween(1, 100).WithMessage("Priority must be between 1 and 100");
            
        RuleFor(x => x.EffectiveDate)
            .NotEmpty().WithMessage("Effective date is required");
            
        RuleFor(x => x.ExpirationDate)
            .GreaterThan(x => x.EffectiveDate)
            .WithMessage("Expiration date must be after effective date")
            .When(x => x.ExpirationDate.HasValue);
            
        // Garnishment-specific validations
        RuleFor(x => x.CaseNumber)
            .NotEmpty().WithMessage("Case number required for garnishments")
            .When(x => x.Type == DeductionType.Garnishment ||
                       x.Type == DeductionType.ChildSupport ||
                       x.Type == DeductionType.TaxLevy);
    }
}
```

**Domain Events Published:**
- `DeductionAddedEvent`

---

### 10.3 ModifyDeductionCommand

Modifies an existing deduction.

```csharp
namespace Pitbull.HRCore.Features.ModifyDeduction;

public record ModifyDeductionCommand(
    Guid DeductionId,
    string? Description,
    decimal? AmountOrRate,
    decimal? CapAmount,
    int? Priority,
    DateOnly? ExpirationDate,
    Guid? CorrelationId
) : ICommand<DeductionDto>;
```

**Domain Events Published:**
- `DeductionModifiedEvent`

---

### 10.4 SuspendDeductionCommand

Temporarily suspends a deduction.

```csharp
namespace Pitbull.HRCore.Features.SuspendDeduction;

public record SuspendDeductionCommand(
    Guid DeductionId,
    string Reason,
    DateOnly? ResumeDate,
    Guid? CorrelationId
) : ICommand<DeductionDto>;
```

---

### 10.5 RecordDeductionPaymentCommand

Records a deduction payment (updates YTD withheld).

```csharp
namespace Pitbull.HRCore.Features.RecordDeductionPayment;

public record RecordDeductionPaymentCommand(
    Guid DeductionId,
    decimal Amount,
    DateOnly PaymentDate,
    string? PayrollRunId,
    Guid? CorrelationId
) : ICommand<DeductionDto>;
```

---

## 11. Withholding & Deduction Queries

### 11.1 GetEmployeeWithholdingsQuery

```csharp
namespace Pitbull.HRCore.Features.GetEmployeeWithholdings;

public record GetEmployeeWithholdingsQuery(
    Guid EmployeeId,
    DateOnly? AsOfDate = null
) : IQuery<EmployeeWithholdingsDto>;

public record EmployeeWithholdingsDto(
    Guid EmployeeId,
    WithholdingElectionDto? FederalW4,
    IReadOnlyList<WithholdingElectionDto> StateWithholdings
);
```

---

### 11.2 GetEmployeeDeductionsQuery

```csharp
namespace Pitbull.HRCore.Features.GetEmployeeDeductions;

public record GetEmployeeDeductionsQuery(
    Guid EmployeeId,
    bool IncludeExpired = false,
    bool IncludeSuspended = false,
    DateOnly? AsOfDate = null
) : IQuery<IReadOnlyList<DeductionDto>>;
```

---

### 11.3 GetPayrollDeductionSummaryQuery

Gets all deductions for payroll processing.

```csharp
namespace Pitbull.HRCore.Features.GetPayrollDeductionSummary;

public record GetPayrollDeductionSummaryQuery(
    Guid EmployeeId,
    DateOnly PayPeriodStart,
    DateOnly PayPeriodEnd,
    decimal GrossWages  // For percentage calculations
) : IQuery<PayrollDeductionSummaryDto>;

public record PayrollDeductionSummaryDto(
    Guid EmployeeId,
    IReadOnlyList<CalculatedDeductionDto> Deductions,
    decimal TotalDeductions
);

public record CalculatedDeductionDto(
    Guid DeductionId,
    DeductionType Type,
    string Description,
    decimal CalculatedAmount,
    decimal RemainingTowardsCap,
    int Priority
);
```

---

## 12. Employment Episode Commands

### 12.1 CreateEmploymentEpisodeCommand

Internal command used by Rehire - generally not called directly.

```csharp
namespace Pitbull.HRCore.Features.CreateEmploymentEpisode;

public record CreateEmploymentEpisodeCommand(
    Guid EmployeeId,
    DateOnly HireDate,
    string? UnionDispatchReference,
    Guid? CorrelationId
) : ICommand<EmploymentEpisodeDto>;
```

---

### 12.2 CloseEmploymentEpisodeCommand

Internal command used by Terminate - generally not called directly.

```csharp
namespace Pitbull.HRCore.Features.CloseEmploymentEpisode;

public record CloseEmploymentEpisodeCommand(
    Guid EpisodeId,
    DateOnly TerminationDate,
    SeparationReason Reason,
    bool EligibleForRehire,
    string? RehireNotes,
    Guid? CorrelationId
) : ICommand<EmploymentEpisodeDto>;
```

---

### 12.3 UpdateEpisodeRehireEligibilityCommand

Updates rehire eligibility after the fact (e.g., policy review).

```csharp
namespace Pitbull.HRCore.Features.UpdateEpisodeRehireEligibility;

public record UpdateEpisodeRehireEligibilityCommand(
    Guid EpisodeId,
    bool EligibleForRehire,
    string Reason,
    string UpdatedBy,
    Guid? CorrelationId
) : ICommand<EmploymentEpisodeDto>;
```

---

## 13. EEO Data Commands & Queries

EEO data is stored in a segregated schema with restricted access per compliance requirements.

### 13.1 RecordEEODataCommand

Records or updates EEO demographic data.

```csharp
namespace Pitbull.HRCore.Features.RecordEEOData;

public record RecordEEODataCommand(
    Guid EmployeeId,
    string? Race,
    string? Ethnicity,
    string? Sex,
    string? VeteranStatus,
    string? DisabilityStatus,
    EEOCollectionMethod CollectionMethod,
    Guid? CorrelationId
) : ICommand;

public enum EEOCollectionMethod
{
    SelfReported,
    Voluntary,
    VisualObservation
}
```

**Validator:**

```csharp
public class RecordEEODataValidator : AbstractValidator<RecordEEODataCommand>
{
    public RecordEEODataValidator(HRCoreDbContext db)
    {
        RuleFor(x => x.EmployeeId)
            .NotEmpty().WithMessage("Employee ID is required")
            .MustAsync(async (id, ct) => await db.Employees.AnyAsync(
                e => e.Id == id && !e.IsDeleted, ct))
            .WithMessage("Employee not found");
            
        RuleFor(x => x.Race)
            .MaximumLength(100)
            .When(x => !string.IsNullOrEmpty(x.Race));
            
        RuleFor(x => x.Ethnicity)
            .MaximumLength(100)
            .When(x => !string.IsNullOrEmpty(x.Ethnicity));
            
        RuleFor(x => x.Sex)
            .MaximumLength(50)
            .When(x => !string.IsNullOrEmpty(x.Sex));
            
        RuleFor(x => x.CollectionMethod)
            .IsInEnum().WithMessage("Invalid collection method");
    }
}
```

---

### 13.2 GetEEODataQuery

Restricted query for EEO data (requires special permissions).

```csharp
namespace Pitbull.HRCore.Features.GetEEOData;

public record GetEEODataQuery(
    Guid EmployeeId
) : IQuery<EEODataDto>;

public record EEODataDto(
    Guid EmployeeId,
    string? Race,
    string? Ethnicity,
    string? Sex,
    string? VeteranStatus,
    string? DisabilityStatus,
    DateTime CollectedDate,
    EEOCollectionMethod CollectionMethod
);
```

**Handler Notes:**
- Requires elevated permissions (HR Manager or Compliance role)
- All access is audit logged
- Returns null if not collected (not an error)

---

### 13.3 GenerateEEO1ReportQuery

Generates EEO-1 report data for federal reporting.

```csharp
namespace Pitbull.HRCore.Features.GenerateEEO1Report;

public record GenerateEEO1ReportQuery(
    int ReportYear,
    DateOnly SnapshotDate
) : IQuery<EEO1ReportDto>;

public record EEO1ReportDto(
    int ReportYear,
    DateOnly SnapshotDate,
    int TotalEmployees,
    IReadOnlyList<EEO1CategoryDto> Categories
);

public record EEO1CategoryDto(
    string JobCategory,
    string Race,
    string Sex,
    int Count
);
```

---

## 14. Compliance Queries

### 14.1 GetTaxJurisdictionsQuery

Resolves tax jurisdictions for a work scenario (Payroll integration).

```csharp
namespace Pitbull.HRCore.Features.GetTaxJurisdictions;

public record GetTaxJurisdictionsQuery(
    Guid EmployeeId,
    DateOnly WorkDate,
    Guid? WorkSiteId
) : IQuery<TaxJurisdictionDto>;
```

**Handler Implementation Notes:**
- Uses employee's home state + work states + reciprocity elections
- Resolves work site to state/local jurisdictions
- Returns SUI state based on employer rules

---

### 14.2 GetRetentionStatusQuery

Gets data retention status for compliance.

```csharp
namespace Pitbull.HRCore.Features.GetRetentionStatus;

public record GetRetentionStatusQuery(
    Guid EmployeeId
) : IQuery<RetentionStatusDto>;

public record RetentionStatusDto(
    Guid EmployeeId,
    bool IsTerminated,
    DateOnly? TerminationDate,
    DateOnly? DataRetentionUntil,
    int DaysUntilEligibleForPurge,
    IReadOnlyList<RetentionRequirementDto> Requirements
);

public record RetentionRequirementDto(
    string Regulation,
    string DataType,
    int RetentionYears,
    DateOnly RetentionUntil
);
```

---

### 14.3 GetDocumentRetentionReportQuery

Lists employees/data eligible for purge.

```csharp
namespace Pitbull.HRCore.Features.GetDocumentRetentionReport;

public record GetDocumentRetentionReportQuery(
    DateOnly AsOfDate
) : PaginationQuery, IQuery<PagedResult<RetentionEligibleRecordDto>>;

public record RetentionEligibleRecordDto(
    Guid EmployeeId,
    string EmployeeNumber,
    string FullName,
    DateOnly TerminationDate,
    DateOnly EligibleForPurgeDate,
    IReadOnlyList<string> DataCategories
);
```

---

### 14.4 GetAuditLogQuery

Retrieves audit log entries for an employee.

```csharp
namespace Pitbull.HRCore.Features.GetAuditLog;

public record GetAuditLogQuery(
    Guid? EmployeeId = null,
    DateTime? FromDate = null,
    DateTime? ToDate = null,
    string? Action = null,
    string? ChangedBy = null
) : PaginationQuery, IQuery<PagedResult<AuditLogEntryDto>>;
```

---

## 15. File Structure

```
Pitbull.HRCore/
├── Domain/
│   ├── Entities/
│   │   ├── Employee.cs
│   │   ├── Certification.cs
│   │   ├── PayRate.cs
│   │   ├── Deduction.cs
│   │   ├── WithholdingElection.cs
│   │   ├── EmploymentEpisode.cs
│   │   └── EmergencyContact.cs
│   ├── ValueObjects/
│   │   ├── PersonalInfo.cs
│   │   ├── Address.cs
│   │   └── TaxProfile.cs
│   ├── Enums/
│   │   └── Enums.cs
│   ├── Events/
│   │   └── DomainEvents.cs
│   └── StronglyTypedIds.cs
│
├── Features/
│   ├── CreateEmployee/
│   │   ├── CreateEmployeeCommand.cs
│   │   ├── CreateEmployeeHandler.cs
│   │   └── CreateEmployeeValidator.cs
│   ├── UpdateEmployee/
│   │   ├── UpdateEmployeeCommand.cs
│   │   ├── UpdateEmployeeHandler.cs
│   │   └── UpdateEmployeeValidator.cs
│   ├── TerminateEmployee/
│   │   └── ...
│   ├── RehireEmployee/
│   │   └── ...
│   ├── ChangeEmployeeStatus/
│   │   └── ...
│   ├── UpdateEmergencyContacts/
│   │   └── ...
│   ├── DeleteEmployee/
│   │   └── ...
│   ├── GetEmployee/
│   │   ├── GetEmployeeQuery.cs
│   │   └── GetEmployeeHandler.cs
│   ├── GetEmployeeByNumber/
│   │   └── ...
│   ├── ListEmployees/
│   │   ├── ListEmployeesQuery.cs
│   │   ├── ListEmployeesHandler.cs
│   │   └── ListEmployeesValidator.cs
│   ├── SearchEmployees/
│   │   └── ...
│   ├── CheckWorkEligibility/
│   │   └── ...
│   ├── GetEmployeeHistory/
│   │   └── ...
│   │
│   ├── AddCertification/
│   │   └── ...
│   ├── VerifyCertification/
│   │   └── ...
│   ├── RevokeCertification/
│   │   └── ...
│   ├── RenewCertification/
│   │   └── ...
│   ├── UpdateCertificationDocument/
│   │   └── ...
│   ├── GetCertification/
│   │   └── ...
│   ├── ListEmployeeCertifications/
│   │   └── ...
│   ├── ListExpiringCertifications/
│   │   └── ...
│   ├── ValidateCertifications/
│   │   └── ...
│   ├── GetCertificationComplianceReport/
│   │   └── ...
│   │
│   ├── AddPayRate/
│   │   └── ...
│   ├── UpdatePayRate/
│   │   └── ...
│   ├── ExpirePayRate/
│   │   └── ...
│   ├── BulkUpdatePayRates/
│   │   └── ...
│   ├── GetPayRate/
│   │   └── ...
│   ├── ListEmployeePayRates/
│   │   └── ...
│   ├── ResolvePayRate/
│   │   └── ...
│   ├── GetPrevailingWageRates/
│   │   └── ...
│   │
│   ├── UpdateWithholdingElection/
│   │   └── ...
│   ├── AddDeduction/
│   │   └── ...
│   ├── ModifyDeduction/
│   │   └── ...
│   ├── SuspendDeduction/
│   │   └── ...
│   ├── RecordDeductionPayment/
│   │   └── ...
│   ├── GetEmployeeWithholdings/
│   │   └── ...
│   ├── GetEmployeeDeductions/
│   │   └── ...
│   ├── GetPayrollDeductionSummary/
│   │   └── ...
│   │
│   ├── CreateEmploymentEpisode/
│   │   └── ...
│   ├── CloseEmploymentEpisode/
│   │   └── ...
│   ├── UpdateEpisodeRehireEligibility/
│   │   └── ...
│   │
│   ├── RecordEEOData/
│   │   └── ...
│   ├── GetEEOData/
│   │   └── ...
│   ├── GenerateEEO1Report/
│   │   └── ...
│   │
│   ├── GetTaxJurisdictions/
│   │   └── ...
│   ├── GetRetentionStatus/
│   │   └── ...
│   ├── GetDocumentRetentionReport/
│   │   └── ...
│   └── GetAuditLog/
│       └── ...
│
├── Infrastructure/
│   ├── HRCoreDbContext.cs
│   ├── Configurations/
│   │   ├── EmployeeConfiguration.cs
│   │   ├── CertificationConfiguration.cs
│   │   └── ...
│   └── Services/
│       ├── EmployeeNumberGenerator.cs
│       └── CertificationExpirationService.cs
│
└── DTOs/
    └── SharedDtos.cs
```

---

## Summary

This specification defines **55+ commands and queries** for the HR Core module:

### Commands (32)
- **Employee**: Create, Update, Terminate, Rehire, ChangeStatus, UpdateEmergencyContacts, Delete
- **Certification**: Add, Verify, Revoke, Renew, UpdateDocument
- **Pay Rate**: Add, Update, Expire, BulkUpdate
- **Withholding/Deduction**: UpdateWithholding, Add, Modify, Suspend, RecordPayment
- **Episode**: Create, Close, UpdateRehireEligibility
- **EEO**: RecordEEOData

### Queries (25+)
- **Employee**: Get, GetByNumber, List, Search, CheckWorkEligibility, GetHistory
- **Certification**: Get, ListByEmployee, ListExpiring, Validate, ComplianceReport
- **Pay Rate**: Get, ListByEmployee, Resolve, GetPrevailingWage
- **Withholding/Deduction**: GetWithholdings, GetDeductions, GetPayrollSummary
- **EEO**: GetEEOData, GenerateEEO1Report
- **Compliance**: GetTaxJurisdictions, GetRetentionStatus, GetRetentionReport, GetAuditLog

All commands include idempotency support via `CorrelationId` for agent automation, and all mutations publish domain events for audit trail and cross-module integration.

---

*Specification complete. Ready for implementation.*
