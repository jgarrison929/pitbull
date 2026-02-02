using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Bids.Domain;

namespace Pitbull.Bids.Data;

public class BidConfiguration : IEntityTypeConfiguration<Bid>
{
    public void Configure(EntityTypeBuilder<Bid> builder)
    {
        builder.ToTable("bids");
        builder.HasKey(b => b.Id);

        builder.Property(b => b.Name).HasMaxLength(200).IsRequired();
        builder.Property(b => b.Number).HasMaxLength(50).IsRequired();
        builder.Property(b => b.Description).HasMaxLength(2000);
        builder.Property(b => b.Owner).HasMaxLength(200);
        builder.Property(b => b.EstimatedValue).HasPrecision(18, 2);
        builder.Property(b => b.Status).HasConversion<string>().HasMaxLength(50);

        builder.HasIndex(b => new { b.TenantId, b.Number }).IsUnique();
        builder.HasIndex(b => b.Status);

        builder.HasMany(b => b.Items)
            .WithOne(i => i.Bid)
            .HasForeignKey(i => i.BidId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class BidItemConfiguration : IEntityTypeConfiguration<BidItem>
{
    public void Configure(EntityTypeBuilder<BidItem> builder)
    {
        builder.ToTable("bid_items");
        builder.HasKey(i => i.Id);

        builder.Property(i => i.Description).HasMaxLength(500).IsRequired();
        builder.Property(i => i.Category).HasConversion<string>().HasMaxLength(50);
        builder.Property(i => i.Quantity).HasPrecision(18, 4);
        builder.Property(i => i.UnitCost).HasPrecision(18, 2);
        builder.Property(i => i.TotalCost).HasPrecision(18, 2);
    }
}
