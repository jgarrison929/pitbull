using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Data;

public class DiagnosticErrorConfiguration : IEntityTypeConfiguration<DiagnosticError>
{
    public void Configure(EntityTypeBuilder<DiagnosticError> builder)
    {
        builder.ToTable("diagnostic_errors");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Source)
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(e => e.Level)
            .IsRequired()
            .HasMaxLength(20)
            .HasDefaultValue("error");

        builder.Property(e => e.RequestMethod)
            .HasMaxLength(10);

        builder.Property(e => e.RequestPath)
            .HasMaxLength(2048);

        builder.Property(e => e.QueryString)
            .HasMaxLength(2048);

        builder.Property(e => e.Message)
            .IsRequired();

        builder.Property(e => e.ExceptionType)
            .HasMaxLength(500);

        builder.Property(e => e.UserId)
            .HasMaxLength(200);

        builder.Property(e => e.UserEmail)
            .HasMaxLength(500);

        builder.Property(e => e.CorrelationId)
            .HasMaxLength(100);

        builder.Property(e => e.TraceId)
            .HasMaxLength(100);

        builder.Property(e => e.IpAddress)
            .HasMaxLength(50);

        builder.Property(e => e.PageUrl)
            .HasMaxLength(2048);

        builder.Property(e => e.Metadata)
            .HasColumnType("jsonb");

        builder.Property(e => e.AcknowledgedBy)
            .HasMaxLength(200);

        // Indexes
        builder.HasIndex(e => e.Timestamp)
            .IsDescending()
            .HasDatabaseName("IX_diagnostic_errors_Timestamp");

        builder.HasIndex(e => new { e.Source, e.Level })
            .HasDatabaseName("IX_diagnostic_errors_Source_Level");

        builder.HasIndex(e => e.Acknowledged)
            .HasFilter("\"Acknowledged\" = false")
            .HasDatabaseName("IX_diagnostic_errors_Unacknowledged");
    }
}
