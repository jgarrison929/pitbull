using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class CostPredictionConfiguration : IEntityTypeConfiguration<CostPrediction>
{
    public void Configure(EntityTypeBuilder<CostPrediction> builder)
    {
        builder.ToTable("cost_predictions");

        builder.HasKey(cp => cp.Id);

        builder.Property(cp => cp.PredictionMethod).HasConversion<string>().HasMaxLength(30);

        builder.Property(cp => cp.PredictedFinalCost).HasPrecision(18, 2);
        builder.Property(cp => cp.ConfidenceLevel).HasPrecision(18, 4);
        builder.Property(cp => cp.VarianceToBudget).HasPrecision(18, 2);
        builder.Property(cp => cp.VariancePercent).HasPrecision(18, 4);
        builder.Property(cp => cp.BudgetAtCompletion).HasPrecision(18, 2);
        builder.Property(cp => cp.CostToDate).HasPrecision(18, 2);
        builder.Property(cp => cp.EstimatedCostToComplete).HasPrecision(18, 2);
        builder.Property(cp => cp.BurnRate).HasPrecision(18, 4);

        builder.Property(cp => cp.Notes).HasMaxLength(2000);

        builder.HasIndex(cp => new { cp.TenantId, cp.ProjectId, cp.CreatedAt })
            .HasDatabaseName("IX_cost_predictions_tenant_project_created");

        builder.Property<uint>("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();
    }
}
