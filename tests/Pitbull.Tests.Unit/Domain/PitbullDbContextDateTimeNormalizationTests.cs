using FluentAssertions;
using System.Reflection;
using Pitbull.Core.Domain;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Domain;

public class PitbullDbContextDateTimeNormalizationTests
{
    [Fact]
    public void NormalizeUnspecifiedDateTimeKindsForSave_ConvertsUnspecifiedDateTimeToUtc()
    {
        using var db = TestDbContextFactory.Create();

        var diagnosticError = new DiagnosticError
        {
            Source = "backend",
            Level = "error",
            Message = "test",
            Timestamp = new DateTime(2026, 2, 18, 12, 30, 0, DateTimeKind.Unspecified)
        };

        db.Set<DiagnosticError>().Add(diagnosticError);
        InvokeNormalizeUnspecifiedDateTimeKindsForSave(db);

        diagnosticError.Timestamp.Kind.Should().Be(DateTimeKind.Utc);
    }

    [Fact]
    public void NormalizeUnspecifiedDateTimeKindsForSave_ConvertsUnspecifiedNullableDateTimeToUtc()
    {
        using var db = TestDbContextFactory.Create();

        var acknowledgedAt = new DateTime(2026, 2, 18, 14, 45, 0, DateTimeKind.Unspecified);
        var diagnosticError = new DiagnosticError
        {
            Source = "backend",
            Level = "error",
            Message = "test",
            AcknowledgedAt = acknowledgedAt
        };

        db.Set<DiagnosticError>().Add(diagnosticError);
        InvokeNormalizeUnspecifiedDateTimeKindsForSave(db);

        diagnosticError.AcknowledgedAt.Should().NotBeNull();
        diagnosticError.AcknowledgedAt!.Value.Kind.Should().Be(DateTimeKind.Utc);
    }

    private static void InvokeNormalizeUnspecifiedDateTimeKindsForSave(Pitbull.Core.Data.PitbullDbContext db)
    {
        MethodInfo? normalizeMethod = typeof(Pitbull.Core.Data.PitbullDbContext)
            .GetMethod("NormalizeUnspecifiedDateTimeKindsForSave", BindingFlags.Instance | BindingFlags.NonPublic);

        normalizeMethod.Should().NotBeNull();
        _ = normalizeMethod!.Invoke(db, null);
    }
}
