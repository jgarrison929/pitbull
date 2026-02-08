using Pitbull.Core.Domain;

namespace Pitbull.HR.Domain;

/// <summary>
/// Core employee entity. The aggregate root for all HR data.
/// Represents a worker who can be assigned to projects and log time.
/// </summary>
public class Employee : BaseEntity
{
    // ──────────────────────────────────────────────────────────────
    // Identity
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Employee number/badge number. Unique within tenant.
    /// Format: Configurable per tenant (e.g., "EMP-001", "10045")
    /// </summary>
    public string EmployeeNumber { get; set; } = string.Empty;
    
    /// <summary>
    /// Legal first name as it appears on tax documents.
    /// </summary>
    public string FirstName { get; set; } = string.Empty;
    
    /// <summary>
    /// Middle name or initial (optional).
    /// </summary>
    public string? MiddleName { get; set; }
    
    /// <summary>
    /// Legal last name as it appears on tax documents.
    /// </summary>
    public string LastName { get; set; } = string.Empty;
    
    /// <summary>
    /// Preferred name for display (if different from legal name).
    /// </summary>
    public string? PreferredName { get; set; }
    
    /// <summary>
    /// Suffix (Jr., Sr., III, etc.)
    /// </summary>
    public string? Suffix { get; set; }
    
    /// <summary>
    /// Full display name (computed).
    /// </summary>
    public string FullName => string.IsNullOrEmpty(PreferredName) 
        ? $"{FirstName} {LastName}".Trim()
        : $"{PreferredName} {LastName}".Trim();
    
    // ──────────────────────────────────────────────────────────────
    // Sensitive PII (Encrypted at rest)
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Social Security Number (encrypted, never logged).
    /// Required for payroll and tax reporting.
    /// </summary>
    public string SSNEncrypted { get; set; } = string.Empty;
    
    /// <summary>
    /// Last 4 digits of SSN for display/verification.
    /// </summary>
    public string SSNLast4 { get; set; } = string.Empty;
    
    /// <summary>
    /// Date of birth. Required for age verification and benefits.
    /// </summary>
    public DateOnly DateOfBirth { get; set; }
    
    // ──────────────────────────────────────────────────────────────
    // Contact Information
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Primary email address for notifications and login.
    /// </summary>
    public string? Email { get; set; }
    
    /// <summary>
    /// Personal/secondary email (for terminated employee contact).
    /// </summary>
    public string? PersonalEmail { get; set; }
    
    /// <summary>
    /// Primary phone number (mobile preferred).
    /// </summary>
    public string? Phone { get; set; }
    
    /// <summary>
    /// Secondary/home phone number.
    /// </summary>
    public string? SecondaryPhone { get; set; }
    
    // ──────────────────────────────────────────────────────────────
    // Home Address
    // ──────────────────────────────────────────────────────────────
    
    public string? AddressLine1 { get; set; }
    public string? AddressLine2 { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? ZipCode { get; set; }
    public string? Country { get; set; } = "US";
    
    // ──────────────────────────────────────────────────────────────
    // Employment Status
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Current employment status.
    /// </summary>
    public EmploymentStatus Status { get; set; } = EmploymentStatus.Active;
    
    /// <summary>
    /// Original hire date (first episode).
    /// </summary>
    public DateOnly OriginalHireDate { get; set; }
    
    /// <summary>
    /// Most recent hire date (current or last episode).
    /// </summary>
    public DateOnly MostRecentHireDate { get; set; }
    
    /// <summary>
    /// Termination date if not currently active.
    /// </summary>
    public DateOnly? TerminationDate { get; set; }
    
    /// <summary>
    /// Whether eligible for rehire after termination.
    /// </summary>
    public bool EligibleForRehire { get; set; } = true;
    
    // ──────────────────────────────────────────────────────────────
    // Classification
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Worker type: Field, Office, or Hybrid.
    /// </summary>
    public WorkerType WorkerType { get; set; } = WorkerType.Field;
    
    /// <summary>
    /// FLSA classification: Exempt (salary) or NonExempt (hourly).
    /// </summary>
    public FLSAStatus FLSAStatus { get; set; } = FLSAStatus.NonExempt;
    
    /// <summary>
    /// Full-time or Part-time status.
    /// </summary>
    public EmploymentType EmploymentType { get; set; } = EmploymentType.FullTime;
    
    /// <summary>
    /// Job title for display.
    /// </summary>
    public string? JobTitle { get; set; }
    
    /// <summary>
    /// Trade code (e.g., "CARP", "ELEC", "LABR", "OPER").
    /// </summary>
    public string? TradeCode { get; set; }
    
    /// <summary>
    /// Workers' compensation class code for insurance.
    /// </summary>
    public string? WorkersCompClassCode { get; set; }
    
    /// <summary>
    /// Department for organizational reporting.
    /// </summary>
    public Guid? DepartmentId { get; set; }
    
    /// <summary>
    /// Primary supervisor who approves time entries.
    /// </summary>
    public Guid? SupervisorId { get; set; }
    
    // ──────────────────────────────────────────────────────────────
    // Tax Configuration
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Home/resident state for tax purposes.
    /// </summary>
    public string? HomeState { get; set; }
    
    /// <summary>
    /// SUI (State Unemployment Insurance) state.
    /// </summary>
    public string? SUIState { get; set; }
    
    // ──────────────────────────────────────────────────────────────
    // Payroll Configuration
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Pay frequency: Weekly, BiWeekly, SemiMonthly, Monthly.
    /// </summary>
    public PayFrequency PayFrequency { get; set; } = PayFrequency.Weekly;
    
    /// <summary>
    /// Default pay type: Hourly or Salary.
    /// </summary>
    public PayType DefaultPayType { get; set; } = PayType.Hourly;
    
    /// <summary>
    /// Default hourly rate (fallback when no specific rate matches).
    /// </summary>
    public decimal? DefaultHourlyRate { get; set; }
    
    /// <summary>
    /// Payment method preference.
    /// </summary>
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.DirectDeposit;
    
    // ──────────────────────────────────────────────────────────────
    // Union Information
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Whether employee is a union member.
    /// </summary>
    public bool IsUnionMember { get; set; }
    
    // ──────────────────────────────────────────────────────────────
    // Compliance Tracking
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// I-9 verification status.
    /// </summary>
    public I9Status I9Status { get; set; } = I9Status.NotStarted;
    
    /// <summary>
    /// E-Verify case status (if used).
    /// </summary>
    public EVerifyStatus? EVerifyStatus { get; set; }
    
    /// <summary>
    /// Background check status.
    /// </summary>
    public BackgroundCheckStatus? BackgroundCheckStatus { get; set; }
    
    /// <summary>
    /// Drug test status.
    /// </summary>
    public DrugTestStatus? DrugTestStatus { get; set; }
    
    // ──────────────────────────────────────────────────────────────
    // Application User Link
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// Link to ASP.NET Identity user (if employee has system access).
    /// </summary>
    public Guid? AppUserId { get; set; }
    
    // ──────────────────────────────────────────────────────────────
    // Notes
    // ──────────────────────────────────────────────────────────────
    
    /// <summary>
    /// General notes about the employee (not visible to employee).
    /// </summary>
    public string? Notes { get; set; }
    
    // ──────────────────────────────────────────────────────────────
    // Navigation Properties (Child Entities)
    // ──────────────────────────────────────────────────────────────
    
    public ICollection<EmploymentEpisode> EmploymentEpisodes { get; set; } = [];
    public ICollection<Certification> Certifications { get; set; } = [];
    public ICollection<PayRate> PayRates { get; set; } = [];
    
    // Self-referencing navigation
    public Employee? Supervisor { get; set; }
    public ICollection<Employee> DirectReports { get; set; } = [];
}
