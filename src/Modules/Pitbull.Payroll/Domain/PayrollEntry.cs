using Pitbull.Core.Domain;

namespace Pitbull.Payroll.Domain;

/// <summary>
/// One payroll entry per employee per batch.
/// Contains all calculated pay, taxes, and deductions.
/// </summary>
public class PayrollEntry : BaseEntity
{
    public Guid PayrollBatchId { get; set; }
    public Guid EmployeeId { get; set; }
    
    // Hours
    public decimal RegularHours { get; set; }
    public decimal OvertimeHours { get; set; }
    public decimal DoubleTimeHours { get; set; }
    public decimal PtoHours { get; set; }
    public decimal HolidayHours { get; set; }
    public decimal TotalHours { get; set; }
    
    // Pay rates used
    public decimal RegularRate { get; set; }
    public decimal OvertimeRate { get; set; }
    public decimal DoubleTimeRate { get; set; }
    
    // Earnings
    public decimal RegularPay { get; set; }
    public decimal OvertimePay { get; set; }
    public decimal DoubleTimePay { get; set; }
    public decimal PtoPay { get; set; }
    public decimal HolidayPay { get; set; }
    public decimal BonusPay { get; set; }
    public decimal OtherEarnings { get; set; }
    public decimal GrossPay { get; set; }
    
    // Federal taxes
    public decimal FederalWithholding { get; set; }
    public decimal SocialSecurity { get; set; }
    public decimal Medicare { get; set; }
    public decimal AdditionalMedicare { get; set; }  // 0.9% above $200k
    
    // State/local taxes
    public string? WorkState { get; set; }
    public decimal StateWithholding { get; set; }
    public decimal StateDisability { get; set; }  // CA SDI, etc.
    public decimal LocalWithholding { get; set; }
    
    // Employee deductions
    public decimal TotalDeductions { get; set; }
    public decimal PreTaxDeductions { get; set; }
    public decimal PostTaxDeductions { get; set; }
    
    // Net pay
    public decimal NetPay { get; set; }
    
    // Employer costs
    public decimal EmployerSocialSecurity { get; set; }
    public decimal EmployerMedicare { get; set; }
    public decimal EmployerFuta { get; set; }
    public decimal EmployerSuta { get; set; }
    public decimal WorkersCompPremium { get; set; }
    
    // Union fringes (employer-paid)
    public decimal UnionHealthWelfare { get; set; }
    public decimal UnionPension { get; set; }
    public decimal UnionTraining { get; set; }
    public decimal UnionOther { get; set; }
    public decimal TotalUnionFringes { get; set; }
    
    // Totals
    public decimal TotalEmployerTaxes { get; set; }
    public decimal TotalEmployerCost { get; set; }  // Gross + taxes + fringes
    
    // YTD (for reference, updated after posting)
    public decimal YtdGross { get; set; }
    public decimal YtdFederalWithholding { get; set; }
    public decimal YtdSocialSecurity { get; set; }
    public decimal YtdMedicare { get; set; }
    public decimal YtdStateWithholding { get; set; }
    public decimal YtdNet { get; set; }
    
    public string? Notes { get; set; }
    
    public PayrollBatch PayrollBatch { get; set; } = null!;
    public ICollection<PayrollDeductionLine> DeductionLines { get; set; } = new List<PayrollDeductionLine>();
}
