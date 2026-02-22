using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class WorkflowTransitionConfiguration : IEntityTypeConfiguration<WorkflowTransition>
{
    public void Configure(EntityTypeBuilder<WorkflowTransition> builder)
    {
        builder.ToTable("workflow_transitions");
        builder.HasKey(wt => wt.Id);

        builder.Property(wt => wt.EntityType).HasMaxLength(100).IsRequired();
        builder.Property(wt => wt.FromStatus).HasMaxLength(50);
        builder.Property(wt => wt.ToStatus).HasMaxLength(50).IsRequired();
        builder.Property(wt => wt.Comment).HasMaxLength(2000);
        builder.Property(wt => wt.ChangedByName).HasMaxLength(200);

        builder.HasIndex(wt => new { wt.TenantId, wt.EntityType, wt.EntityId, wt.ChangedAt })
            .HasDatabaseName("IX_workflow_transitions_entity_lookup");

        builder.HasIndex(wt => new { wt.CompanyId, wt.EntityType, wt.ChangedAt })
            .HasDatabaseName("IX_workflow_transitions_company_type");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
