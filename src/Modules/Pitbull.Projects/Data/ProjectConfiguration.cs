using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Projects.Domain;

namespace Pitbull.Projects.Data;

public class ProjectConfiguration : IEntityTypeConfiguration<Project>
{
    public void Configure(EntityTypeBuilder<Project> builder)
    {
        builder.ToTable("projects");
        builder.HasKey(p => p.Id);

        builder.Property(p => p.Name).HasMaxLength(200).IsRequired();
        builder.Property(p => p.Number).HasMaxLength(50).IsRequired();
        builder.Property(p => p.Description).HasMaxLength(2000);
        builder.Property(p => p.Address).HasMaxLength(500);
        builder.Property(p => p.City).HasMaxLength(100);
        builder.Property(p => p.State).HasMaxLength(50);
        builder.Property(p => p.ZipCode).HasMaxLength(20);
        builder.Property(p => p.ClientName).HasMaxLength(200);
        builder.Property(p => p.ClientContact).HasMaxLength(200);
        builder.Property(p => p.ClientEmail).HasMaxLength(200);
        builder.Property(p => p.ClientPhone).HasMaxLength(50);
        builder.Property(p => p.ContractAmount).HasPrecision(18, 2);
        builder.Property(p => p.OriginalBudget).HasPrecision(18, 2);
        builder.Property(p => p.Status).HasConversion<string>().HasMaxLength(50);
        builder.Property(p => p.Type).HasConversion<string>().HasMaxLength(50);

        builder.HasIndex(p => new { p.TenantId, p.Number }).IsUnique();
        builder.HasIndex(p => p.Status);

        builder.HasMany(p => p.Phases)
            .WithOne(ph => ph.Project)
            .HasForeignKey(ph => ph.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(p => p.Budget)
            .WithOne(b => b.Project)
            .HasForeignKey<ProjectBudget>(b => b.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(p => p.Projections)
            .WithOne(pr => pr.Project)
            .HasForeignKey(pr => pr.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class PhaseConfiguration : IEntityTypeConfiguration<Phase>
{
    public void Configure(EntityTypeBuilder<Phase> builder)
    {
        builder.ToTable("project_phases");
        builder.HasKey(p => p.Id);

        builder.Property(p => p.Name).HasMaxLength(200).IsRequired();
        builder.Property(p => p.CostCode).HasMaxLength(50).IsRequired();
        builder.Property(p => p.Description).HasMaxLength(1000);
        builder.Property(p => p.BudgetAmount).HasPrecision(18, 2);
        builder.Property(p => p.ActualCost).HasPrecision(18, 2);
        builder.Property(p => p.PercentComplete).HasPrecision(5, 2);
        builder.Property(p => p.Status).HasConversion<string>().HasMaxLength(50);
    }
}

public class ProjectBudgetConfiguration : IEntityTypeConfiguration<ProjectBudget>
{
    public void Configure(EntityTypeBuilder<ProjectBudget> builder)
    {
        builder.ToTable("project_budgets");
        builder.HasKey(b => b.Id);

        builder.Property(b => b.OriginalContractAmount).HasPrecision(18, 2);
        builder.Property(b => b.ApprovedChangeOrders).HasPrecision(18, 2);
        builder.Property(b => b.PendingChangeOrders).HasPrecision(18, 2);
        builder.Property(b => b.TotalBudget).HasPrecision(18, 2);
        builder.Property(b => b.TotalCommitted).HasPrecision(18, 2);
        builder.Property(b => b.TotalActualCost).HasPrecision(18, 2);
        builder.Property(b => b.TotalBilledToDate).HasPrecision(18, 2);
        builder.Property(b => b.TotalReceivedToDate).HasPrecision(18, 2);
        builder.Property(b => b.RetainageHeld).HasPrecision(18, 2);

        builder.Ignore(b => b.CurrentContractAmount);
        builder.Ignore(b => b.BudgetVariance);
    }
}

public class ProjectionConfiguration : IEntityTypeConfiguration<Projection>
{
    public void Configure(EntityTypeBuilder<Projection> builder)
    {
        builder.ToTable("project_projections");
        builder.HasKey(p => p.Id);

        builder.Property(p => p.ProjectedRevenue).HasPrecision(18, 2);
        builder.Property(p => p.ProjectedCost).HasPrecision(18, 2);
        builder.Property(p => p.ActualRevenue).HasPrecision(18, 2);
        builder.Property(p => p.ActualCost).HasPrecision(18, 2);
        builder.Property(p => p.Notes).HasMaxLength(2000);

        builder.Ignore(p => p.ProjectedMargin);
        builder.Ignore(p => p.ActualMargin);
    }
}
