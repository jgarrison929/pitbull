using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class WorkflowDefinitionConfiguration : IEntityTypeConfiguration<WorkflowDefinition>
{
    public void Configure(EntityTypeBuilder<WorkflowDefinition> builder)
    {
        builder.ToTable("workflow_definitions");
        builder.HasKey(d => d.Id);

        builder.Property(d => d.EntityType).HasMaxLength(100).IsRequired();
        builder.Property(d => d.TriggerStatus).HasMaxLength(50).IsRequired();
        builder.Property(d => d.ApprovedStatus).HasMaxLength(50).IsRequired();
        builder.Property(d => d.RejectedStatus).HasMaxLength(50).IsRequired();
        builder.Property(d => d.Name).HasMaxLength(200).IsRequired();
        builder.Property(d => d.Description).HasMaxLength(2000);
        builder.Property(d => d.AmountThreshold).HasPrecision(18, 2);
        builder.Property(d => d.Mode).HasConversion<int>();

        builder.HasMany(d => d.Steps)
            .WithOne(s => s.WorkflowDefinition)
            .HasForeignKey(s => s.WorkflowDefinitionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(d => new { d.CompanyId, d.EntityType, d.IsActive })
            .HasDatabaseName("IX_workflow_definitions_company_entity_active");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class WorkflowApprovalStepConfiguration : IEntityTypeConfiguration<WorkflowApprovalStep>
{
    public void Configure(EntityTypeBuilder<WorkflowApprovalStep> builder)
    {
        builder.ToTable("workflow_approval_steps");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Name).HasMaxLength(200).IsRequired();
        builder.Property(s => s.ApproverRole).HasMaxLength(100);
        builder.Property(s => s.ApproverRelationship).HasMaxLength(100);
        builder.Property(s => s.ApproverType).HasConversion<int>();

        builder.HasIndex(s => new { s.WorkflowDefinitionId, s.StepOrder })
            .HasDatabaseName("IX_workflow_approval_steps_definition_order");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}

public class WorkflowApprovalActionConfiguration : IEntityTypeConfiguration<WorkflowApprovalAction>
{
    public void Configure(EntityTypeBuilder<WorkflowApprovalAction> builder)
    {
        builder.ToTable("workflow_approval_actions");
        builder.HasKey(a => a.Id);

        builder.Property(a => a.EntityType).HasMaxLength(100).IsRequired();
        builder.Property(a => a.AssignedToUserName).HasMaxLength(200);
        builder.Property(a => a.Comment).HasMaxLength(2000);
        builder.Property(a => a.Status).HasConversion<int>();

        builder.HasOne(a => a.ApprovalStep)
            .WithMany()
            .HasForeignKey(a => a.WorkflowApprovalStepId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(a => new { a.AssignedToUserId, a.Status, a.CreatedAtUtc })
            .HasDatabaseName("IX_workflow_approval_actions_assignee_status");

        builder.HasIndex(a => new { a.EntityType, a.EntityId, a.Status })
            .HasDatabaseName("IX_workflow_approval_actions_entity_status");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}