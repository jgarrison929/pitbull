namespace Pitbull.Core.Domain;

/// <summary>
/// Company-level bid/estimating configuration. Owned by Company entity.
/// Controls default validity periods, sign-off requirements, and markup percentages.
/// </summary>
public class BidSettings
{
    /// <summary>
    /// Default number of days a bid remains valid after submission.
    /// Industry standard is typically 30-90 days.
    /// </summary>
    public int DefaultValidityPeriodDays { get; set; } = 30;

    /// <summary>
    /// Require an estimator to sign off before a bid can be submitted.
    /// Adds a review gate to prevent accidental submissions.
    /// </summary>
    public bool RequireEstimatorSignOff { get; set; } = false;

    /// <summary>
    /// Default overhead percentage applied to bids.
    /// Added on top of direct costs to cover company overhead.
    /// </summary>
    public decimal DefaultOverheadPercent { get; set; } = 10m;

    /// <summary>
    /// Default profit percentage applied to bids.
    /// Added on top of costs + overhead as the target margin.
    /// </summary>
    public decimal DefaultProfitPercent { get; set; } = 10m;
}
