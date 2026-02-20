using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Contracts.Domain;
using Pitbull.Core.Domain;
using Pitbull.ProjectManagement.Domain;
using Pitbull.Projects.Domain;
using Pitbull.RFIs.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.ProjectManagement.Data;

internal static class PmConfigExtensions
{
    public static void ConfigureBase<TEntity>(this EntityTypeBuilder<TEntity> builder, string table)
        where TEntity : class
    {
        builder.ToTable(table);
        builder.HasKey("Id");
        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class PmScheduleConfiguration : IEntityTypeConfiguration<PmSchedule>
{
    public void Configure(EntityTypeBuilder<PmSchedule> builder)
    {
        builder.ConfigureBase("pm_schedules");
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(2000);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.CalendarType).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.ImportedFrom).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.TenantId, x.CompanyId, x.ProjectId, x.Name }).IsUnique();
        builder.HasIndex(x => new { x.ProjectId, x.Status });
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmScheduleActivityConfiguration : IEntityTypeConfiguration<PmScheduleActivity>
{
    public void Configure(EntityTypeBuilder<PmScheduleActivity> builder)
    {
        builder.ConfigureBase("pm_schedule_activities");
        builder.Property(x => x.WbsCode).HasMaxLength(100);
        builder.Property(x => x.ActivityCode).HasMaxLength(100).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(300).IsRequired();
        builder.Property(x => x.PercentComplete).HasPrecision(5, 2);
        builder.Property(x => x.ActivityType).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.ScheduleId, x.ActivityCode }).IsUnique();
        builder.HasIndex(x => new { x.ScheduleId, x.ParentActivityId, x.SortOrder });
        builder.HasOne<PmSchedule>()
            .WithMany()
            .HasForeignKey(x => x.ScheduleId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<PmScheduleActivity>()
            .WithMany()
            .HasForeignKey(x => x.ParentActivityId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<CostCode>()
            .WithMany()
            .HasForeignKey(x => x.CostCodeId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Phase>()
            .WithMany()
            .HasForeignKey(x => x.PhaseId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmScheduleDependencyConfiguration : IEntityTypeConfiguration<PmScheduleDependency>
{
    public void Configure(EntityTypeBuilder<PmScheduleDependency> builder)
    {
        builder.ConfigureBase("pm_schedule_dependencies");
        builder.Property(x => x.DependencyType).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.ScheduleId, x.PredecessorActivityId, x.SuccessorActivityId }).IsUnique();
        builder.HasOne<PmSchedule>()
            .WithMany()
            .HasForeignKey(x => x.ScheduleId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<PmScheduleActivity>()
            .WithMany()
            .HasForeignKey(x => x.PredecessorActivityId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<PmScheduleActivity>()
            .WithMany()
            .HasForeignKey(x => x.SuccessorActivityId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmScheduleBaselineConfiguration : IEntityTypeConfiguration<PmScheduleBaseline>
{
    public void Configure(EntityTypeBuilder<PmScheduleBaseline> builder)
    {
        builder.ConfigureBase("pm_schedule_baselines");
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.BaselineType).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.ProjectId, x.CapturedAt });
        builder.HasOne<PmSchedule>()
            .WithMany()
            .HasForeignKey(x => x.ScheduleId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.CapturedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmScheduleBaselineActivityConfiguration : IEntityTypeConfiguration<PmScheduleBaselineActivity>
{
    public void Configure(EntityTypeBuilder<PmScheduleBaselineActivity> builder)
    {
        builder.ConfigureBase("pm_schedule_baseline_activities");
        builder.HasIndex(x => new { x.BaselineId, x.ActivityId }).IsUnique();
        builder.HasOne<PmScheduleBaseline>()
            .WithMany()
            .HasForeignKey(x => x.BaselineId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<PmScheduleActivity>()
            .WithMany()
            .HasForeignKey(x => x.ActivityId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmScheduleResourceAssignmentConfiguration : IEntityTypeConfiguration<PmScheduleResourceAssignment>
{
    public void Configure(EntityTypeBuilder<PmScheduleResourceAssignment> builder)
    {
        builder.ConfigureBase("pm_schedule_resource_assignments");
        builder.Property(x => x.ResourceType).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.ActivityId, x.ResourceType });
        builder.HasOne<PmScheduleActivity>()
            .WithMany()
            .HasForeignKey(x => x.ActivityId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<Employee>()
            .WithMany()
            .HasForeignKey(x => x.EmployeeId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Equipment>()
            .WithMany()
            .HasForeignKey(x => x.EquipmentId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Subcontract>()
            .WithMany()
            .HasForeignKey(x => x.SubcontractId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmScheduleCalendarExceptionConfiguration : IEntityTypeConfiguration<PmScheduleCalendarException>
{
    public void Configure(EntityTypeBuilder<PmScheduleCalendarException> builder)
    {
        builder.ConfigureBase("pm_schedule_calendar_exceptions");
        builder.Property(x => x.ExceptionType).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.ScheduleId, x.Date }).IsUnique();
        builder.HasOne<PmSchedule>()
            .WithMany()
            .HasForeignKey(x => x.ScheduleId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class PmScheduleImportLogConfiguration : IEntityTypeConfiguration<PmScheduleImportLog>
{
    public void Configure(EntityTypeBuilder<PmScheduleImportLog> builder)
    {
        builder.ConfigureBase("pm_schedule_import_logs");
        builder.Property(x => x.FileName).HasMaxLength(260).IsRequired();
        builder.Property(x => x.ErrorSummary).HasMaxLength(4000);
        builder.Property(x => x.ImportSource).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.ProjectId, x.ImportedAt });
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<PmSchedule>()
            .WithMany()
            .HasForeignKey(x => x.ScheduleId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.ImportedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmJobCostBudgetConfiguration : IEntityTypeConfiguration<PmJobCostBudget>
{
    public void Configure(EntityTypeBuilder<PmJobCostBudget> builder)
    {
        builder.ConfigureBase("pm_job_cost_budgets");
        builder.Property(x => x.UnitOfMeasure).HasMaxLength(50);
        builder.Property(x => x.OriginalBudget).HasPrecision(18, 2);
        builder.Property(x => x.ApprovedBudgetChanges).HasPrecision(18, 2);
        builder.Property(x => x.CurrentBudget).HasPrecision(18, 2);
        builder.Property(x => x.BudgetUnitCost).HasPrecision(18, 4);
        builder.Property(x => x.LaborBurdenRate).HasPrecision(8, 4);
        builder.HasIndex(x => new { x.ProjectId, x.CostCodeId, x.PhaseId }).IsUnique();
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<CostCode>()
            .WithMany()
            .HasForeignKey(x => x.CostCodeId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Phase>()
            .WithMany()
            .HasForeignKey(x => x.PhaseId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmJobCostActualConfiguration : IEntityTypeConfiguration<PmJobCostActual>
{
    public void Configure(EntityTypeBuilder<PmJobCostActual> builder)
    {
        builder.ConfigureBase("pm_job_cost_actuals");
        builder.Property(x => x.LaborCost).HasPrecision(18, 2);
        builder.Property(x => x.MaterialCost).HasPrecision(18, 2);
        builder.Property(x => x.EquipmentCost).HasPrecision(18, 2);
        builder.Property(x => x.SubcontractCost).HasPrecision(18, 2);
        builder.Property(x => x.OtherCost).HasPrecision(18, 2);
        builder.Property(x => x.TotalActualCost).HasPrecision(18, 2);
        builder.Property(x => x.SourceType).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.ProjectId, x.CostCodeId, x.PhaseId, x.AsOfDate });
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<CostCode>()
            .WithMany()
            .HasForeignKey(x => x.CostCodeId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Phase>()
            .WithMany()
            .HasForeignKey(x => x.PhaseId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmJobCostCommitmentConfiguration : IEntityTypeConfiguration<PmJobCostCommitment>
{
    public void Configure(EntityTypeBuilder<PmJobCostCommitment> builder)
    {
        builder.ConfigureBase("pm_job_cost_commitments");
        builder.Property(x => x.OriginalCommittedAmount).HasPrecision(18, 2);
        builder.Property(x => x.ApprovedChangesAmount).HasPrecision(18, 2);
        builder.Property(x => x.CurrentCommittedAmount).HasPrecision(18, 2);
        builder.Property(x => x.BilledToDate).HasPrecision(18, 2);
        builder.Property(x => x.PaidToDate).HasPrecision(18, 2);
        builder.Property(x => x.RemainingCommitted).HasPrecision(18, 2);
        builder.Property(x => x.CommitmentType).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.ProjectId, x.CostCodeId, x.PhaseId, x.ReferenceId });
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<CostCode>()
            .WithMany()
            .HasForeignKey(x => x.CostCodeId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Phase>()
            .WithMany()
            .HasForeignKey(x => x.PhaseId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmJobCostForecastConfiguration : IEntityTypeConfiguration<PmJobCostForecast>
{
    public void Configure(EntityTypeBuilder<PmJobCostForecast> builder)
    {
        builder.ConfigureBase("pm_job_cost_forecasts");
        builder.Property(x => x.ActualToDate).HasPrecision(18, 2);
        builder.Property(x => x.CommittedToDate).HasPrecision(18, 2);
        builder.Property(x => x.CostToComplete).HasPrecision(18, 2);
        builder.Property(x => x.EstimatedFinalCost).HasPrecision(18, 2);
        builder.Property(x => x.VarianceToBudget).HasPrecision(18, 2);
        builder.Property(x => x.Notes).HasMaxLength(2000);
        builder.Property(x => x.ForecastConfidence).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.ProjectId, x.CostCodeId, x.PhaseId, x.ForecastPeriod });
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<CostCode>()
            .WithMany()
            .HasForeignKey(x => x.CostCodeId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Phase>()
            .WithMany()
            .HasForeignKey(x => x.PhaseId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmJobCostUnitProgressConfiguration : IEntityTypeConfiguration<PmJobCostUnitProgress>
{
    public void Configure(EntityTypeBuilder<PmJobCostUnitProgress> builder)
    {
        builder.ConfigureBase("pm_job_cost_unit_progress");
        builder.Property(x => x.InstalledUnit).HasMaxLength(30);
        builder.Property(x => x.CostPerUnit).HasPrecision(18, 4);
        builder.HasIndex(x => new { x.ProjectId, x.CostCodeId, x.PhaseId, x.PeriodDate });
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<CostCode>()
            .WithMany()
            .HasForeignKey(x => x.CostCodeId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Phase>()
            .WithMany()
            .HasForeignKey(x => x.PhaseId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class RfiDistributionRecipientConfiguration : IEntityTypeConfiguration<RfiDistributionRecipient>
{
    public void Configure(EntityTypeBuilder<RfiDistributionRecipient> builder)
    {
        builder.ConfigureBase("pm_rfi_distribution_recipients");
        builder.Property(x => x.RecipientName).HasMaxLength(200).IsRequired();
        builder.Property(x => x.RecipientEmail).HasMaxLength(200).IsRequired();
        builder.Property(x => x.RecipientType).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.RfiId, x.RecipientEmail, x.RecipientType });
        builder.HasOne<Rfi>()
            .WithMany()
            .HasForeignKey(x => x.RfiId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.RecipientUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class RfiAttachmentConfiguration : IEntityTypeConfiguration<RfiAttachment>
{
    public void Configure(EntityTypeBuilder<RfiAttachment> builder)
    {
        builder.ConfigureBase("pm_rfi_attachments");
        builder.Property(x => x.FileName).HasMaxLength(260).IsRequired();
        builder.Property(x => x.MimeType).HasMaxLength(100).IsRequired();
        builder.Property(x => x.RevisionTag).HasMaxLength(50);
        builder.Property(x => x.DocumentRole).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.RfiId, x.DocumentId }).IsUnique();
        builder.HasOne<Rfi>()
            .WithMany()
            .HasForeignKey(x => x.RfiId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<PmDocument>()
            .WithMany()
            .HasForeignKey(x => x.DocumentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class RfiCostImpactLinkConfiguration : IEntityTypeConfiguration<RfiCostImpactLink>
{
    public void Configure(EntityTypeBuilder<RfiCostImpactLink> builder)
    {
        builder.ConfigureBase("pm_rfi_cost_impact_links");
        builder.Property(x => x.EstimatedCost).HasPrecision(18, 2);
        builder.Property(x => x.ApprovedCost).HasPrecision(18, 2);
        builder.Property(x => x.ImpactType).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.RfiId, x.CostCodeId, x.ChangeOrderId });
        builder.HasOne<Rfi>()
            .WithMany()
            .HasForeignKey(x => x.RfiId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<CostCode>()
            .WithMany()
            .HasForeignKey(x => x.CostCodeId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<ChangeOrder>()
            .WithMany()
            .HasForeignKey(x => x.ChangeOrderId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmSubmittalConfiguration : IEntityTypeConfiguration<PmSubmittal>
{
    public void Configure(EntityTypeBuilder<PmSubmittal> builder)
    {
        builder.ConfigureBase("pm_submittals");
        builder.Property(x => x.Title).HasMaxLength(300).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(4000);
        builder.Property(x => x.SpecSectionCode).HasMaxLength(50);
        builder.Property(x => x.SpecSectionTitle).HasMaxLength(300);
        builder.Property(x => x.SubmittalType).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.TenantId, x.ProjectId, x.SubmittalNumber }).IsUnique();
        builder.HasIndex(x => new { x.ProjectId, x.Status, x.RequiredByDate });
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<PmScheduleActivity>()
            .WithMany()
            .HasForeignKey(x => x.ScheduleActivityId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmSubmittalWorkflowEventConfiguration : IEntityTypeConfiguration<PmSubmittalWorkflowEvent>
{
    public void Configure(EntityTypeBuilder<PmSubmittalWorkflowEvent> builder)
    {
        builder.ConfigureBase("pm_submittal_workflow_events");
        builder.Property(x => x.Comments).HasMaxLength(2000);
        builder.Property(x => x.EventType).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.FromStatus).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.ToStatus).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.SubmittalId, x.ActionAt });
        builder.HasOne<PmSubmittal>()
            .WithMany()
            .HasForeignKey(x => x.SubmittalId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.ActionByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmSubmittalAttachmentConfiguration : IEntityTypeConfiguration<PmSubmittalAttachment>
{
    public void Configure(EntityTypeBuilder<PmSubmittalAttachment> builder)
    {
        builder.ConfigureBase("pm_submittal_attachments");
        builder.Property(x => x.FileName).HasMaxLength(260).IsRequired();
        builder.Property(x => x.RevisionTag).HasMaxLength(50);
        builder.Property(x => x.DocumentRole).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.SubmittalId, x.DocumentId }).IsUnique();
        builder.HasOne<PmSubmittal>()
            .WithMany()
            .HasForeignKey(x => x.SubmittalId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<PmDocument>()
            .WithMany()
            .HasForeignKey(x => x.DocumentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmDocumentFolderConfiguration : IEntityTypeConfiguration<PmDocumentFolder>
{
    public void Configure(EntityTypeBuilder<PmDocumentFolder> builder)
    {
        builder.ConfigureBase("pm_document_folders");
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.FolderType).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.ProjectId, x.ParentFolderId, x.Name }).IsUnique();
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<PmDocumentFolder>()
            .WithMany()
            .HasForeignKey(x => x.ParentFolderId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmPlanSetConfiguration : IEntityTypeConfiguration<PmPlanSet>
{
    public void Configure(EntityTypeBuilder<PmPlanSet> builder)
    {
        builder.ConfigureBase("pm_plan_sets");
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Discipline).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.Revision).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.ProjectId, x.Name, x.Revision });
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmPlanSheetConfiguration : IEntityTypeConfiguration<PmPlanSheet>
{
    public void Configure(EntityTypeBuilder<PmPlanSheet> builder)
    {
        builder.ConfigureBase("pm_plan_sheets");
        builder.Property(x => x.DrawingNumber).HasMaxLength(100).IsRequired();
        builder.Property(x => x.Title).HasMaxLength(300).IsRequired();
        builder.Property(x => x.Discipline).HasConversion<string>().HasMaxLength(100);
        builder.Property(x => x.CurrentRevision).HasMaxLength(50);
        builder.Property(x => x.Scale).HasMaxLength(50);
        builder.HasIndex(x => new { x.PlanSetId, x.DrawingNumber, x.CurrentRevision }).IsUnique();
        builder.HasOne<PmPlanSet>()
            .WithMany()
            .HasForeignKey(x => x.PlanSetId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<PmDocument>()
            .WithMany()
            .HasForeignKey(x => x.DocumentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmPlanSheetRevisionConfiguration : IEntityTypeConfiguration<PmPlanSheetRevision>
{
    public void Configure(EntityTypeBuilder<PmPlanSheetRevision> builder)
    {
        builder.ConfigureBase("pm_plan_sheet_revisions");
        builder.Property(x => x.RevisionNumber).HasMaxLength(50).IsRequired();
        builder.Property(x => x.RevisionDescription).HasMaxLength(1000);
        builder.HasIndex(x => new { x.PlanSheetId, x.RevisionNumber }).IsUnique();
        builder.HasOne<PmPlanSheet>()
            .WithMany()
            .HasForeignKey(x => x.PlanSheetId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<PmDocument>()
            .WithMany()
            .HasForeignKey(x => x.DocumentId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.IssuedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmSpecSectionConfiguration : IEntityTypeConfiguration<PmSpecSection>
{
    public void Configure(EntityTypeBuilder<PmSpecSection> builder)
    {
        builder.ConfigureBase("pm_spec_sections");
        builder.Property(x => x.DivisionCode).HasMaxLength(20);
        builder.Property(x => x.SectionCode).HasMaxLength(50).IsRequired();
        builder.Property(x => x.Title).HasMaxLength(300).IsRequired();
        builder.Property(x => x.CsiEdition).HasMaxLength(50);
        builder.Property(x => x.CurrentRevision).HasMaxLength(50);
        builder.HasIndex(x => new { x.ProjectId, x.SectionCode, x.CurrentRevision }).IsUnique();
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<PmDocument>()
            .WithMany()
            .HasForeignKey(x => x.DocumentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmSpecSectionRevisionConfiguration : IEntityTypeConfiguration<PmSpecSectionRevision>
{
    public void Configure(EntityTypeBuilder<PmSpecSectionRevision> builder)
    {
        builder.ConfigureBase("pm_spec_section_revisions");
        builder.Property(x => x.RevisionNumber).HasMaxLength(50).IsRequired();
        builder.Property(x => x.Summary).HasMaxLength(1000);
        builder.HasIndex(x => new { x.SpecSectionId, x.RevisionNumber }).IsUnique();
        builder.HasOne<PmSpecSection>()
            .WithMany()
            .HasForeignKey(x => x.SpecSectionId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<PmDocument>()
            .WithMany()
            .HasForeignKey(x => x.DocumentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmDocumentDistributionConfiguration : IEntityTypeConfiguration<PmDocumentDistribution>
{
    public void Configure(EntityTypeBuilder<PmDocumentDistribution> builder)
    {
        builder.ConfigureBase("pm_document_distributions");
        builder.Property(x => x.RecipientName).HasMaxLength(200);
        builder.Property(x => x.RecipientEmail).HasMaxLength(200);
        builder.Property(x => x.DocumentType).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.DistributionMethod).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.ProjectId, x.DocumentType, x.ReferenceId });
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.RecipientUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmCommunicationConfiguration : IEntityTypeConfiguration<PmCommunication>
{
    public void Configure(EntityTypeBuilder<PmCommunication> builder)
    {
        builder.ConfigureBase("pm_communications");
        builder.Property(x => x.Subject).HasMaxLength(300).IsRequired();
        builder.Property(x => x.Body).HasMaxLength(5000);
        builder.Property(x => x.FromName).HasMaxLength(200);
        builder.Property(x => x.FromEmail).HasMaxLength(200);
        builder.Property(x => x.ToName).HasMaxLength(200);
        builder.Property(x => x.ToEmail).HasMaxLength(200);
        builder.Property(x => x.CommunicationType).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.Direction).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.ReferenceType).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.ProjectId, x.Status, x.FollowUpDate });
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmCommunicationAttachmentConfiguration : IEntityTypeConfiguration<PmCommunicationAttachment>
{
    public void Configure(EntityTypeBuilder<PmCommunicationAttachment> builder)
    {
        builder.ConfigureBase("pm_communication_attachments");
        builder.Property(x => x.FileName).HasMaxLength(260).IsRequired();
        builder.Property(x => x.MimeType).HasMaxLength(100).IsRequired();
        builder.HasIndex(x => new { x.CommunicationId, x.DocumentId }).IsUnique();
        builder.HasOne<PmCommunication>()
            .WithMany()
            .HasForeignKey(x => x.CommunicationId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<PmDocument>()
            .WithMany()
            .HasForeignKey(x => x.DocumentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmDailyReportConfiguration : IEntityTypeConfiguration<PmDailyReport>
{
    public void Configure(EntityTypeBuilder<PmDailyReport> builder)
    {
        builder.ConfigureBase("pm_daily_reports");
        builder.Property(x => x.WeatherSummary).HasMaxLength(200);
        builder.Property(x => x.Precipitation).HasMaxLength(100);
        builder.Property(x => x.Wind).HasMaxLength(100);
        builder.Property(x => x.WorkNarrative).HasMaxLength(4000);
        builder.Property(x => x.DelaysNarrative).HasMaxLength(4000);
        builder.Property(x => x.SafetyNarrative).HasMaxLength(4000);
        builder.Property(x => x.TemperatureLow).HasPrecision(6, 2);
        builder.Property(x => x.TemperatureHigh).HasPrecision(6, 2);
        builder.Property(x => x.ReportType).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.ProjectId, x.ReportDate, x.ReportType }).IsUnique();
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.PreparedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmDailyReportCrewConfiguration : IEntityTypeConfiguration<PmDailyReportCrew>
{
    public void Configure(EntityTypeBuilder<PmDailyReportCrew> builder)
    {
        builder.ConfigureBase("pm_daily_report_crews");
        builder.Property(x => x.CompanyName).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Trade).HasMaxLength(100).IsRequired();
        builder.Property(x => x.HoursWorked).HasPrecision(10, 2);
        builder.HasOne<PmDailyReport>()
            .WithMany()
            .HasForeignKey(x => x.DailyReportId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class PmDailyReportEquipmentConfiguration : IEntityTypeConfiguration<PmDailyReportEquipment>
{
    public void Configure(EntityTypeBuilder<PmDailyReportEquipment> builder)
    {
        builder.ConfigureBase("pm_daily_report_equipment");
        builder.Property(x => x.EquipmentName).HasMaxLength(200).IsRequired();
        builder.Property(x => x.HoursUsed).HasPrecision(10, 2);
        builder.HasOne<PmDailyReport>()
            .WithMany()
            .HasForeignKey(x => x.DailyReportId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<Equipment>()
            .WithMany()
            .HasForeignKey(x => x.EquipmentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmDailyReportVisitorConfiguration : IEntityTypeConfiguration<PmDailyReportVisitor>
{
    public void Configure(EntityTypeBuilder<PmDailyReportVisitor> builder)
    {
        builder.ConfigureBase("pm_daily_report_visitors");
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Company).HasMaxLength(200);
        builder.Property(x => x.Purpose).HasMaxLength(500);
        builder.HasOne<PmDailyReport>()
            .WithMany()
            .HasForeignKey(x => x.DailyReportId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class PmDailyReportSafetyIncidentConfiguration : IEntityTypeConfiguration<PmDailyReportSafetyIncident>
{
    public void Configure(EntityTypeBuilder<PmDailyReportSafetyIncident> builder)
    {
        builder.ConfigureBase("pm_daily_report_safety_incidents");
        builder.Property(x => x.Description).HasMaxLength(2000).IsRequired();
        builder.Property(x => x.ReportedTo).HasMaxLength(200);
        builder.Property(x => x.IncidentType).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.Severity).HasConversion<string>().HasMaxLength(50);
        builder.HasOne<PmDailyReport>()
            .WithMany()
            .HasForeignKey(x => x.DailyReportId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class PmDailyReportDeliveryConfiguration : IEntityTypeConfiguration<PmDailyReportDelivery>
{
    public void Configure(EntityTypeBuilder<PmDailyReportDelivery> builder)
    {
        builder.ConfigureBase("pm_daily_report_deliveries");
        builder.Property(x => x.VendorName).HasMaxLength(200).IsRequired();
        builder.Property(x => x.MaterialDescription).HasMaxLength(1000).IsRequired();
        builder.Property(x => x.Unit).HasMaxLength(40).IsRequired();
        builder.Property(x => x.Quantity).HasPrecision(18, 3);
        builder.HasOne<PmDailyReport>()
            .WithMany()
            .HasForeignKey(x => x.DailyReportId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<CostCode>()
            .WithMany()
            .HasForeignKey(x => x.RelatedCostCodeId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmDailyReportPhotoConfiguration : IEntityTypeConfiguration<PmDailyReportPhoto>
{
    public void Configure(EntityTypeBuilder<PmDailyReportPhoto> builder)
    {
        builder.ConfigureBase("pm_daily_report_photos");
        builder.Property(x => x.Caption).HasMaxLength(500);
        builder.Property(x => x.Latitude).HasPrecision(9, 6);
        builder.Property(x => x.Longitude).HasPrecision(9, 6);
        builder.HasIndex(x => new { x.DailyReportId, x.DocumentId }).IsUnique();
        builder.HasOne<PmDailyReport>()
            .WithMany()
            .HasForeignKey(x => x.DailyReportId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<PmDocument>()
            .WithMany()
            .HasForeignKey(x => x.DocumentId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.TakenByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmDailyReportRollupConfiguration : IEntityTypeConfiguration<PmDailyReportRollup>
{
    public void Configure(EntityTypeBuilder<PmDailyReportRollup> builder)
    {
        builder.ConfigureBase("pm_daily_report_rollups");
        builder.HasIndex(x => new { x.ParentDailyReportId, x.ChildDailyReportId }).IsUnique();
        builder.HasOne<PmDailyReport>()
            .WithMany()
            .HasForeignKey(x => x.ParentDailyReportId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<PmDailyReport>()
            .WithMany()
            .HasForeignKey(x => x.ChildDailyReportId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmProgressEntryConfiguration : IEntityTypeConfiguration<PmProgressEntry>
{
    public void Configure(EntityTypeBuilder<PmProgressEntry> builder)
    {
        builder.ConfigureBase("pm_progress_entries");
        builder.Property(x => x.EntryType).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.ProjectId, x.ProgressDate, x.EntryType });
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.EnteredByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmActivityProgressConfiguration : IEntityTypeConfiguration<PmActivityProgress>
{
    public void Configure(EntityTypeBuilder<PmActivityProgress> builder)
    {
        builder.ConfigureBase("pm_activity_progress");
        builder.Property(x => x.PercentComplete).HasPrecision(5, 2);
        builder.HasIndex(x => new { x.ProgressEntryId, x.ScheduleActivityId }).IsUnique();
        builder.HasOne<PmProgressEntry>()
            .WithMany()
            .HasForeignKey(x => x.ProgressEntryId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<PmScheduleActivity>()
            .WithMany()
            .HasForeignKey(x => x.ScheduleActivityId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmCostCodeProgressConfiguration : IEntityTypeConfiguration<PmCostCodeProgress>
{
    public void Configure(EntityTypeBuilder<PmCostCodeProgress> builder)
    {
        builder.ConfigureBase("pm_cost_code_progress");
        builder.Property(x => x.PercentComplete).HasPrecision(5, 2);
        builder.Property(x => x.EarnedValueAmount).HasPrecision(18, 2);
        builder.HasIndex(x => new { x.ProgressEntryId, x.CostCodeId, x.PhaseId }).IsUnique();
        builder.HasOne<PmProgressEntry>()
            .WithMany()
            .HasForeignKey(x => x.ProgressEntryId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<CostCode>()
            .WithMany()
            .HasForeignKey(x => x.CostCodeId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Phase>()
            .WithMany()
            .HasForeignKey(x => x.PhaseId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmEarnedValueSnapshotConfiguration : IEntityTypeConfiguration<PmEarnedValueSnapshot>
{
    public void Configure(EntityTypeBuilder<PmEarnedValueSnapshot> builder)
    {
        builder.ConfigureBase("pm_earned_value_snapshots");
        builder.Property(x => x.BCWS).HasPrecision(18, 2);
        builder.Property(x => x.BCWP).HasPrecision(18, 2);
        builder.Property(x => x.ACWP).HasPrecision(18, 2);
        builder.Property(x => x.CPI).HasPrecision(12, 4);
        builder.Property(x => x.SPI).HasPrecision(12, 4);
        builder.HasIndex(x => new { x.ProjectId, x.SnapshotDate }).IsUnique();
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmSCurvePointConfiguration : IEntityTypeConfiguration<PmSCurvePoint>
{
    public void Configure(EntityTypeBuilder<PmSCurvePoint> builder)
    {
        builder.ConfigureBase("pm_s_curve_points");
        builder.Property(x => x.PlannedPercent).HasPrecision(5, 2);
        builder.Property(x => x.ActualPercent).HasPrecision(5, 2);
        builder.Property(x => x.EarnedPercent).HasPrecision(5, 2);
        builder.HasIndex(x => new { x.ProjectId, x.CurveDate }).IsUnique();
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmProgressTimeEntryLinkConfiguration : IEntityTypeConfiguration<PmProgressTimeEntryLink>
{
    public void Configure(EntityTypeBuilder<PmProgressTimeEntryLink> builder)
    {
        builder.ConfigureBase("pm_progress_time_entry_links");
        builder.HasIndex(x => new { x.ProgressEntryId, x.TimeEntryId }).IsUnique();
        builder.HasOne<PmProgressEntry>()
            .WithMany()
            .HasForeignKey(x => x.ProgressEntryId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<TimeEntry>()
            .WithMany()
            .HasForeignKey(x => x.TimeEntryId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmMonthlyProjectionConfiguration : IEntityTypeConfiguration<PmMonthlyProjection>
{
    public void Configure(EntityTypeBuilder<PmMonthlyProjection> builder)
    {
        builder.ConfigureBase("pm_monthly_projections");
        builder.Property(x => x.Notes).HasMaxLength(4000);
        builder.Property(x => x.ContractValueOriginal).HasPrecision(18, 2);
        builder.Property(x => x.ApprovedChangeOrders).HasPrecision(18, 2);
        builder.Property(x => x.PendingChangeOrders).HasPrecision(18, 2);
        builder.Property(x => x.AdjustedContractValue).HasPrecision(18, 2);
        builder.Property(x => x.RevenueRecognizedToDate).HasPrecision(18, 2);
        builder.Property(x => x.PercentComplete).HasPrecision(5, 2);
        builder.Property(x => x.ProjectedFinalRevenue).HasPrecision(18, 2);
        builder.Property(x => x.ProjectedFinalCost).HasPrecision(18, 2);
        builder.Property(x => x.ProjectedMargin).HasPrecision(18, 2);
        builder.Property(x => x.ProjectionStatus).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.ProjectId, x.ProjectionMonth }).IsUnique();
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.PreparedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.ReviewedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmProjectionCostCodeConfiguration : IEntityTypeConfiguration<PmProjectionCostCode>
{
    public void Configure(EntityTypeBuilder<PmProjectionCostCode> builder)
    {
        builder.ConfigureBase("pm_projection_cost_codes");
        builder.Property(x => x.OriginalBudget).HasPrecision(18, 2);
        builder.Property(x => x.CurrentBudget).HasPrecision(18, 2);
        builder.Property(x => x.EAC).HasPrecision(18, 2);
        builder.Property(x => x.Variance).HasPrecision(18, 2);
        builder.HasIndex(x => new { x.MonthlyProjectionId, x.CostCodeId, x.PhaseId }).IsUnique();
        builder.HasOne<PmMonthlyProjection>()
            .WithMany()
            .HasForeignKey(x => x.MonthlyProjectionId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<CostCode>()
            .WithMany()
            .HasForeignKey(x => x.CostCodeId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Phase>()
            .WithMany()
            .HasForeignKey(x => x.PhaseId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmMeetingSeriesConfiguration : IEntityTypeConfiguration<PmMeetingSeries>
{
    public void Configure(EntityTypeBuilder<PmMeetingSeries> builder)
    {
        builder.ConfigureBase("pm_meeting_series");
        builder.Property(x => x.Title).HasMaxLength(300).IsRequired();
        builder.Property(x => x.RecurrenceRule).HasMaxLength(500);
        builder.Property(x => x.MeetingType).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.ProjectId, x.MeetingType, x.StartDate });
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmMeetingConfiguration : IEntityTypeConfiguration<PmMeeting>
{
    public void Configure(EntityTypeBuilder<PmMeeting> builder)
    {
        builder.ConfigureBase("pm_meetings");
        builder.Property(x => x.Title).HasMaxLength(300).IsRequired();
        builder.Property(x => x.Location).HasMaxLength(300);
        builder.Property(x => x.VirtualMeetingUrl).HasMaxLength(500);
        builder.Property(x => x.MeetingType).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.ProjectId, x.ScheduledStart });
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<PmMeetingSeries>()
            .WithMany()
            .HasForeignKey(x => x.MeetingSeriesId)
            .OnDelete(DeleteBehavior.SetNull);
        builder.HasOne<PmDocumentTemplate>()
            .WithMany()
            .HasForeignKey(x => x.AgendaTemplateId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmMeetingAgendaItemConfiguration : IEntityTypeConfiguration<PmMeetingAgendaItem>
{
    public void Configure(EntityTypeBuilder<PmMeetingAgendaItem> builder)
    {
        builder.ConfigureBase("pm_meeting_agenda_items");
        builder.Property(x => x.Topic).HasMaxLength(300).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(2000);
        builder.HasIndex(x => new { x.MeetingId, x.ItemNumber }).IsUnique();
        builder.HasOne<PmMeeting>()
            .WithMany()
            .HasForeignKey(x => x.MeetingId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.PresenterUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmMeetingMinuteConfiguration : IEntityTypeConfiguration<PmMeetingMinute>
{
    public void Configure(EntityTypeBuilder<PmMeetingMinute> builder)
    {
        builder.ConfigureBase("pm_meeting_minutes");
        builder.Property(x => x.MinuteText).HasMaxLength(10000).IsRequired();
        builder.HasIndex(x => new { x.MeetingId, x.VersionNumber }).IsUnique();
        builder.HasOne<PmMeeting>()
            .WithMany()
            .HasForeignKey(x => x.MeetingId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.RecordedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmMeetingActionItemConfiguration : IEntityTypeConfiguration<PmMeetingActionItem>
{
    public void Configure(EntityTypeBuilder<PmMeetingActionItem> builder)
    {
        builder.ConfigureBase("pm_meeting_action_items");
        builder.Property(x => x.Description).HasMaxLength(2000).IsRequired();
        builder.Property(x => x.AssigneeName).HasMaxLength(200);
        builder.Property(x => x.Priority).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.AssigneeUserId, x.Status, x.DueDate });
        builder.HasOne<PmMeeting>()
            .WithMany()
            .HasForeignKey(x => x.MeetingId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.AssigneeUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmMeetingAttachmentConfiguration : IEntityTypeConfiguration<PmMeetingAttachment>
{
    public void Configure(EntityTypeBuilder<PmMeetingAttachment> builder)
    {
        builder.ConfigureBase("pm_meeting_attachments");
        builder.Property(x => x.AttachmentRole).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.MeetingId, x.DocumentId }).IsUnique();
        builder.HasOne<PmMeeting>()
            .WithMany()
            .HasForeignKey(x => x.MeetingId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<PmDocument>()
            .WithMany()
            .HasForeignKey(x => x.DocumentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmDocumentTemplateConfiguration : IEntityTypeConfiguration<PmDocumentTemplate>
{
    public void Configure(EntityTypeBuilder<PmDocumentTemplate> builder)
    {
        builder.ConfigureBase("pm_document_templates");
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(1000);
        builder.Property(x => x.BodyTemplate).HasColumnType("text").IsRequired();
        builder.Property(x => x.HeaderTemplate).HasColumnType("text");
        builder.Property(x => x.FooterTemplate).HasColumnType("text");
        builder.Property(x => x.TemplateType).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.Engine).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.CompanyId, x.TemplateType, x.Name }).IsUnique();
    }
}

public class PmGeneratedDocumentConfiguration : IEntityTypeConfiguration<PmGeneratedDocument>
{
    public void Configure(EntityTypeBuilder<PmGeneratedDocument> builder)
    {
        builder.ConfigureBase("pm_generated_documents");
        builder.Property(x => x.MergeDataJson).HasColumnType("text");
        builder.Property(x => x.DocumentType).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.ReferenceType).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.OutputFormat).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.ProjectId, x.DocumentType, x.GeneratedAt });
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<PmDocumentTemplate>()
            .WithMany()
            .HasForeignKey(x => x.TemplateId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.GeneratedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<PmDocument>()
            .WithMany()
            .HasForeignKey(x => x.DocumentId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<PmLetterheadConfig>()
            .WithMany()
            .HasForeignKey(x => x.LetterheadConfigId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmLetterheadConfigConfiguration : IEntityTypeConfiguration<PmLetterheadConfig>
{
    public void Configure(EntityTypeBuilder<PmLetterheadConfig> builder)
    {
        builder.ConfigureBase("pm_letterhead_configs");
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.PrimaryColor).HasMaxLength(20);
        builder.Property(x => x.SecondaryColor).HasMaxLength(20);
        builder.Property(x => x.AddressBlock).HasMaxLength(1000);
        builder.Property(x => x.Phone).HasMaxLength(50);
        builder.Property(x => x.Email).HasMaxLength(200);
        builder.Property(x => x.Website).HasMaxLength(200);
        builder.HasIndex(x => new { x.CompanyId, x.Name }).IsUnique();
        builder.HasOne<PmDocument>()
            .WithMany()
            .HasForeignKey(x => x.LogoDocumentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmTaskConfiguration : IEntityTypeConfiguration<PmTask>
{
    public void Configure(EntityTypeBuilder<PmTask> builder)
    {
        builder.ConfigureBase("pm_tasks");
        builder.Property(x => x.Title).HasMaxLength(300).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(4000);
        builder.Property(x => x.AssignedToName).HasMaxLength(200);
        builder.Property(x => x.TaskType).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.Priority).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.ReferenceType).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.AssignedToUserId, x.Status, x.DueDate });
        builder.HasIndex(x => new { x.ProjectId, x.Status, x.DueDate });
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.AssignedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.AssignedToUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmTaskCommentConfiguration : IEntityTypeConfiguration<PmTaskComment>
{
    public void Configure(EntityTypeBuilder<PmTaskComment> builder)
    {
        builder.ConfigureBase("pm_task_comments");
        builder.Property(x => x.Comment).HasMaxLength(4000).IsRequired();
        builder.HasIndex(x => new { x.TaskId, x.CommentedAt });
        builder.HasOne<PmTask>()
            .WithMany()
            .HasForeignKey(x => x.TaskId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.CommentedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmProjectNarrativeConfiguration : IEntityTypeConfiguration<PmProjectNarrative>
{
    public void Configure(EntityTypeBuilder<PmProjectNarrative> builder)
    {
        builder.ConfigureBase("pm_project_narratives");
        builder.Property(x => x.ExecutiveSummary).HasMaxLength(4000);
        builder.Property(x => x.KeyAccomplishments).HasMaxLength(4000);
        builder.Property(x => x.UpcomingMilestones).HasMaxLength(4000);
        builder.Property(x => x.RisksAndConcerns).HasMaxLength(4000);
        builder.Property(x => x.FinancialSummary).HasMaxLength(4000);
        builder.Property(x => x.ScheduleSummary).HasMaxLength(4000);
        builder.Property(x => x.GeneratedDraftText).HasColumnType("text");
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.ProjectId, x.NarrativeMonth }).IsUnique();
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<PmDocumentTemplate>()
            .WithMany()
            .HasForeignKey(x => x.TemplateId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.PreparedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmProjectNarrativeRevisionConfiguration : IEntityTypeConfiguration<PmProjectNarrativeRevision>
{
    public void Configure(EntityTypeBuilder<PmProjectNarrativeRevision> builder)
    {
        builder.ConfigureBase("pm_project_narrative_revisions");
        builder.Property(x => x.ContentSnapshotJson).HasColumnType("text").IsRequired();
        builder.Property(x => x.RevisionNote).HasMaxLength(1000);
        builder.HasIndex(x => new { x.NarrativeId, x.RevisionNumber }).IsUnique();
        builder.HasOne<PmProjectNarrative>()
            .WithMany()
            .HasForeignKey(x => x.NarrativeId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.RevisedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmDocumentConfiguration : IEntityTypeConfiguration<PmDocument>
{
    public void Configure(EntityTypeBuilder<PmDocument> builder)
    {
        builder.ConfigureBase("pm_documents");
        builder.Property(x => x.FileName).HasMaxLength(260).IsRequired();
        builder.Property(x => x.MimeType).HasMaxLength(100).IsRequired();
        builder.Property(x => x.StoragePath).HasMaxLength(1000).IsRequired();
        builder.Property(x => x.Checksum).HasMaxLength(256).IsRequired();
        builder.HasIndex(x => new { x.ProjectId, x.UploadedAt });
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.UploadedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmDocumentVersionConfiguration : IEntityTypeConfiguration<PmDocumentVersion>
{
    public void Configure(EntityTypeBuilder<PmDocumentVersion> builder)
    {
        builder.ConfigureBase("pm_document_versions");
        builder.Property(x => x.StoragePath).HasMaxLength(1000).IsRequired();
        builder.Property(x => x.ChangeNote).HasMaxLength(1000);
        builder.HasIndex(x => new { x.DocumentId, x.VersionNumber }).IsUnique();
        builder.HasOne<PmDocument>()
            .WithMany()
            .HasForeignKey(x => x.DocumentId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.UploadedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmPunchListItemConfiguration : IEntityTypeConfiguration<PmPunchListItem>
{
    public void Configure(EntityTypeBuilder<PmPunchListItem> builder)
    {
        builder.ConfigureBase("pm_punch_list_items");
        builder.Property(x => x.Location).HasMaxLength(500).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(4000).IsRequired();
        builder.Property(x => x.AssignedToName).HasMaxLength(200);
        builder.Property(x => x.Notes).HasMaxLength(4000);
        builder.Property(x => x.CostImpact).HasPrecision(18, 2);
        builder.Property(x => x.Category).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.ResponsiblePartyType).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(50);
        builder.Property(x => x.Priority).HasConversion<string>().HasMaxLength(50);
        builder.HasIndex(x => new { x.TenantId, x.ProjectId, x.ItemNumber }).IsUnique();
        builder.HasIndex(x => new { x.ProjectId, x.Status, x.DueDate });
        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Subcontract>()
            .WithMany()
            .HasForeignKey(x => x.ResponsibleSubcontractorId)
            .OnDelete(DeleteBehavior.SetNull);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.ClosedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.InspectedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class PmPunchListPhotoConfiguration : IEntityTypeConfiguration<PmPunchListPhoto>
{
    public void Configure(EntityTypeBuilder<PmPunchListPhoto> builder)
    {
        builder.ConfigureBase("pm_punch_list_photos");
        builder.Property(x => x.Caption).HasMaxLength(500);
        builder.Property(x => x.Latitude).HasPrecision(10, 7);
        builder.Property(x => x.Longitude).HasPrecision(10, 7);
        builder.HasIndex(x => new { x.PunchListItemId, x.DocumentId }).IsUnique();
        builder.HasOne<PmPunchListItem>()
            .WithMany()
            .HasForeignKey(x => x.PunchListItemId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<PmDocument>()
            .WithMany()
            .HasForeignKey(x => x.DocumentId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.TakenByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
