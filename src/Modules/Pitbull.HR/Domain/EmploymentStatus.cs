namespace Pitbull.HR.Domain;

/// <summary>
/// Current employment status of an employee.
/// </summary>
public enum EmploymentStatus
{
    /// <summary>Actively employed.</summary>
    Active = 1,
    
    /// <summary>Temporarily inactive (leave of absence, layoff).</summary>
    Inactive = 2,
    
    /// <summary>Employment has ended.</summary>
    Terminated = 3,
    
    /// <summary>Pending hire/onboarding not yet complete.</summary>
    Pending = 4,
    
    /// <summary>Former employee eligible for rehire (construction-specific).</summary>
    OnCall = 5
}

/// <summary>
/// Worker classification: Field vs Office.
/// </summary>
public enum WorkerType
{
    /// <summary>Field worker (crew, craft, foreman).</summary>
    Field = 1,
    
    /// <summary>Office/administrative worker.</summary>
    Office = 2,
    
    /// <summary>Works both field and office.</summary>
    Hybrid = 3
}

/// <summary>
/// FLSA exempt/non-exempt classification.
/// </summary>
public enum FLSAStatus
{
    /// <summary>Non-exempt (hourly, eligible for overtime).</summary>
    NonExempt = 1,
    
    /// <summary>Exempt (salaried, not eligible for overtime).</summary>
    Exempt = 2
}

/// <summary>
/// Full-time vs part-time classification.
/// </summary>
public enum EmploymentType
{
    FullTime = 1,
    PartTime = 2,
    Seasonal = 3,
    Temporary = 4
}

/// <summary>
/// Pay frequency for payroll processing.
/// </summary>
public enum PayFrequency
{
    Weekly = 1,
    BiWeekly = 2,
    SemiMonthly = 3,
    Monthly = 4
}

/// <summary>
/// Default pay type for the employee.
/// </summary>
public enum PayType
{
    Hourly = 1,
    Salary = 2
}

/// <summary>
/// Payment method preference.
/// </summary>
public enum PaymentMethod
{
    DirectDeposit = 1,
    Check = 2,
    PayCard = 3
}

/// <summary>
/// I-9 verification status.
/// </summary>
public enum I9Status
{
    NotStarted = 0,
    Section1Complete = 1,
    Section2Complete = 2,
    Verified = 3,
    ReverificationNeeded = 4
}

/// <summary>
/// E-Verify case status.
/// </summary>
public enum EVerifyStatus
{
    NotSubmitted = 0,
    Pending = 1,
    EmploymentAuthorized = 2,
    TentativeNonconfirmation = 3,
    CaseInContinuance = 4,
    FinalNonconfirmation = 5,
    ClosedCaseInvalidated = 6
}

/// <summary>
/// Background check status.
/// </summary>
public enum BackgroundCheckStatus
{
    NotRequired = 0,
    Pending = 1,
    InProgress = 2,
    Cleared = 3,
    Failed = 4,
    ConditionalClear = 5
}

/// <summary>
/// Drug test status.
/// </summary>
public enum DrugTestStatus
{
    NotRequired = 0,
    Scheduled = 1,
    Pending = 2,
    Passed = 3,
    Failed = 4
}
