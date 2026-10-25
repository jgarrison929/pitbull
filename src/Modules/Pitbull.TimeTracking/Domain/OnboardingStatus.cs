namespace Pitbull.TimeTracking.Domain;

/// <summary>
/// Status of an employee's onboarding process.
/// </summary>
public enum OnboardingStatus
{
    NotStarted = 0,
    InProgress = 1,
    Complete = 2,
    Incomplete = 3
}

/// <summary>
/// Contractor type for onboarding profile configuration.
/// Determines which fields/steps are required during onboarding.
/// </summary>
public enum ContractorType
{
    Civil = 0,
    Electrical = 1,
    Mechanical = 2,
    Plumbing = 3,
    Utility = 4,
    GeneralBuilding = 5,
    Specialty = 6,
    Custom = 7
}

/// <summary>
/// W-4 filing status for federal tax withholding.
/// </summary>
public enum W4FilingStatus
{
    Single = 0,
    MarriedFilingJointly = 1,
    HeadOfHousehold = 2
}

/// <summary>
/// I-9 verification status for employment eligibility.
/// </summary>
public enum I9Status
{
    NotStarted = 0,
    Section1Complete = 1,
    Verified = 2,
    Expired = 3
}

/// <summary>
/// Verification status for employee certifications.
/// </summary>
public enum CertificationVerificationStatus
{
    Pending = 0,
    Verified = 1,
    Expired = 2,
    Rejected = 3
}
