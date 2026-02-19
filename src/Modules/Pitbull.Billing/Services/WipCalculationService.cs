using Microsoft.EntityFrameworkCore;
using Pitbull.Billing.Features.Wip;
using Pitbull.Contracts.Domain;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Billing.Services;

public class WipCalculationService(PitbullDbContext db) : IWipCalculationService
{
    public async Task<Result<WipReportLineCalculationResult>> CalculateProjectLineAsync(
        Project project,
        decimal estimatedCostToComplete,
        CancellationToken cancellationToken = default)
    {
        List<Guid> subcontractIds = await db.Set<Subcontract>()
            .AsNoTracking()
            .Where(s => s.ProjectId == project.Id)
            .Select(s => s.Id)
            .ToListAsync(cancellationToken);

        decimal approvedChangeOrders = 0m;
        decimal billedToDate = 0m;

        if (subcontractIds.Count > 0)
        {
            approvedChangeOrders = await db.Set<ChangeOrder>()
                .AsNoTracking()
                .Where(co => subcontractIds.Contains(co.SubcontractId) && co.Status == ChangeOrderStatus.Approved)
                .SumAsync(co => (decimal?)co.Amount, cancellationToken) ?? 0m;

            billedToDate = await db.Set<PaymentApplication>()
                .AsNoTracking()
                .Where(pa => subcontractIds.Contains(pa.SubcontractId))
                .Where(pa => pa.Status != PaymentApplicationStatus.Draft
                             && pa.Status != PaymentApplicationStatus.Rejected
                             && pa.Status != PaymentApplicationStatus.Void)
                .SumAsync(pa => (decimal?)pa.CurrentPaymentDue, cancellationToken) ?? 0m;
        }

        decimal totalCostToDate = await db.Set<TimeEntry>()
            .AsNoTracking()
            .Where(te => te.ProjectId == project.Id && te.Status == TimeEntryStatus.Approved)
            .SumAsync(te =>
                (te.RegularHours * (te.Employee != null ? te.Employee.BaseHourlyRate : 0m)) +
                (te.OvertimeHours * (te.Employee != null ? te.Employee.BaseHourlyRate : 0m) * 1.5m) +
                (te.DoubletimeHours * (te.Employee != null ? te.Employee.BaseHourlyRate : 0m) * 2.0m) +
                (te.EquipmentId.HasValue
                    ? te.EquipmentHours * (te.Equipment != null ? te.Equipment.HourlyRate : 0m)
                    : 0m),
                cancellationToken);

        decimal revisedContractAmount = project.ContractAmount + approvedChangeOrders;
        decimal normalizedEstimatedCostToComplete = estimatedCostToComplete < 0m ? 0m : estimatedCostToComplete;
        decimal estimatedTotalCost = totalCostToDate + normalizedEstimatedCostToComplete;

        decimal percentComplete = estimatedTotalCost <= 0m
            ? 0m
            : totalCostToDate / estimatedTotalCost;

        if (percentComplete < 0m)
            percentComplete = 0m;

        if (percentComplete > 1m)
            percentComplete = 1m;

        decimal earnedRevenue = revisedContractAmount * percentComplete;
        decimal overUnderBilling = earnedRevenue - billedToDate;

        WipReportLineCalculationResult result = new(
            ProjectId: project.Id,
            ProjectNumber: project.Number,
            ProjectName: project.Name,
            ContractAmount: project.ContractAmount,
            ApprovedChangeOrders: approvedChangeOrders,
            RevisedContractAmount: revisedContractAmount,
            TotalCostToDate: totalCostToDate,
            EstimatedCostToComplete: normalizedEstimatedCostToComplete,
            EstimatedTotalCost: estimatedTotalCost,
            PercentComplete: percentComplete,
            EarnedRevenue: earnedRevenue,
            BilledToDate: billedToDate,
            OverUnderBilling: overUnderBilling,
            OverUnderClassification: WipMapper.ClassifyOverUnder(overUnderBilling));

        return Result.Success(result);
    }
}
