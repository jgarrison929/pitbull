using FluentAssertions;

namespace Pitbull.Tests.Unit.Migrations;

/// <summary>
/// Guards against re-introducing a bare AddColumn for pm_daily_reports.Title after
/// 20260626223208 already adds it (fresh MigrateAsync 42701 in CI).
/// </summary>
public class AddPmDailyReportTitleMigrationTests
{
    [Fact]
    public void Later_Title_migration_Up_is_idempotent()
    {
        var path = FindMigrationFile("20260709140618_AddPmDailyReportTitle.cs");
        path.Should().NotBeNull("migration file must be discoverable from test output");

        var source = File.ReadAllText(path!);
        source.Should().Contain("IF NOT EXISTS",
            "Up must use ADD COLUMN IF NOT EXISTS so June's Title add does not 42701");
        source.Should().Contain("pm_daily_reports");
        source.Should().NotContain("migrationBuilder.AddColumn",
            "bare AddColumn reintroduces the duplicate-column failure on fresh DBs");
    }

    [Fact]
    public void Earlier_OwnerChangeOrder_migration_still_adds_Title()
    {
        var path = FindMigrationFile("20260626223208_AddOwnerChangeOrderAndVendorInvoiceAccrual.cs");
        path.Should().NotBeNull();
        var source = File.ReadAllText(path!);
        source.Should().Contain("pm_daily_reports");
        source.Should().Contain("name: \"Title\"");
    }

    private static string? FindMigrationFile(string fileName)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        for (var i = 0; i < 8 && dir is not null; i++)
        {
            var candidate = Path.Combine(dir.FullName, "src", "Pitbull.Api", "Migrations", fileName);
            if (File.Exists(candidate))
                return candidate;
            dir = dir.Parent;
        }
        return null;
    }
}
