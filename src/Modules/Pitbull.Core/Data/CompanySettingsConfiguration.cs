using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class CompanySettingsConfiguration : IEntityTypeConfiguration<CompanySettings>
{
    public void Configure(EntityTypeBuilder<CompanySettings> builder)
    {
        builder.ToTable("company_settings");
        
        builder.Property(e => e.CompanyName)
            .HasMaxLength(200)
            .IsRequired();
        
        builder.Property(e => e.LogoUrl)
            .HasMaxLength(500);
        
        builder.Property(e => e.Address)
            .HasMaxLength(500);
        
        builder.Property(e => e.City)
            .HasMaxLength(100);
        
        builder.Property(e => e.State)
            .HasMaxLength(100);
        
        builder.Property(e => e.ZipCode)
            .HasMaxLength(20);
        
        builder.Property(e => e.Country)
            .HasMaxLength(100);
        
        builder.Property(e => e.Phone)
            .HasMaxLength(30);
        
        builder.Property(e => e.Website)
            .HasMaxLength(200);
        
        builder.Property(e => e.TaxId)
            .HasMaxLength(50);
        
        builder.Property(e => e.Timezone)
            .HasMaxLength(100)
            .HasDefaultValue("America/Los_Angeles");
        
        builder.Property(e => e.DateFormat)
            .HasMaxLength(20)
            .HasDefaultValue("MM/dd/yyyy");
        
        builder.Property(e => e.TimeFormat)
            .HasMaxLength(10)
            .HasDefaultValue("12h");
        
        builder.Property(e => e.Currency)
            .HasMaxLength(10)
            .HasDefaultValue("USD");
        
        builder.Property(e => e.WorkWeek)
            .HasMaxLength(50)
            .HasDefaultValue("Mon,Tue,Wed,Thu,Fri");
        
        builder.Property(e => e.NotificationEmail)
            .HasMaxLength(256);
        
        builder.Property(e => e.DigestFrequency)
            .HasMaxLength(20)
            .HasDefaultValue("immediate");
        
        // One settings record per tenant
        builder.HasIndex(e => e.TenantId).IsUnique();
    }
}
