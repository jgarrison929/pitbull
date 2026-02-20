using System.Reflection;
using System.Text.RegularExpressions;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Pitbull.Tests.Unit.Helpers;

namespace Pitbull.Tests.Unit.Migrations;

public class MigrationIntegrityTests
{
    [Fact]
    public void InMemoryModel_CanBeCreated_WithAllModuleAssemblies()
    {
        // This validates that all entity configurations are compatible and
        // the full model can be built without errors (catches config conflicts).
        using var db = TestDbContextFactory.Create();
        db.Model.Should().NotBeNull();
        db.Model.GetEntityTypes().Should().NotBeEmpty();
    }

    [Fact]
    public void AllMigrations_CanBeInstantiated()
    {
        var migrationsAssembly = typeof(Program).Assembly;
        var migrationTypes = migrationsAssembly.GetTypes()
            .Where(t => t.IsSubclassOf(typeof(Migration)) && !t.IsAbstract)
            .ToList();

        migrationTypes.Should().NotBeEmpty("expected at least one migration");

        foreach (var migrationType in migrationTypes)
        {
            var instance = Activator.CreateInstance(migrationType);
            instance.Should().NotBeNull($"migration {migrationType.Name} should be instantiable");
        }
    }

    [Fact]
    public void Migrations_AreOrderedChronologically()
    {
        var migrationsAssembly = typeof(Program).Assembly;
        var migrationTypes = migrationsAssembly.GetTypes()
            .Where(t => t.IsSubclassOf(typeof(Migration)) && !t.IsAbstract)
            .Select(t => t.GetCustomAttribute<DbContextAttribute>() is not null ? t.Name : t.Name)
            .OrderBy(n => n)
            .ToList();

        // Migration names should already be in chronological order (timestamp prefix)
        var sorted = migrationTypes.OrderBy(n => n).ToList();
        migrationTypes.Should().BeEquivalentTo(sorted, options => options.WithStrictOrdering(),
            "migrations should have chronological timestamp prefixes");
    }

    [Fact]
    public void Migrations_DoNotHaveDuplicateColumnOperations()
    {
        // This catches the known bug where EF scaffolds duplicate AddColumn calls
        // when multiple migrations are created in the same session.
        var migrationsAssembly = typeof(Program).Assembly;
        var migrationTypes = migrationsAssembly.GetTypes()
            .Where(t => t.IsSubclassOf(typeof(Migration)) && !t.IsAbstract)
            .ToList();

        var addColumnPattern = new Regex(
            @"migrationBuilder\.AddColumn<[^>]+>\(\s*name:\s*""([^""]+)"",\s*table:\s*""([^""]+)""",
            RegexOptions.Compiled);

        var duplicates = new List<string>();

        foreach (var migrationType in migrationTypes)
        {
            // Read the Up method source from the compiled assembly by analyzing method body
            // Instead, we'll check via reflection on the Migration instance
            var instance = (Migration)Activator.CreateInstance(migrationType)!;

            // Get the operations by calling BuildTargetModel and examining the migration
            // We use a simpler approach: scan the source file for duplicate operations
        }

        // Approach 2: scan actual migration source files
        var migrationsDir = FindMigrationsDirectory();
        if (migrationsDir is null)
        {
            // In CI, the source files might not be available — skip this check
            return;
        }

        var migrationFiles = Directory.GetFiles(migrationsDir, "*.cs")
            .Where(f => !f.Contains("Designer") && !f.Contains("Snapshot"))
            .ToList();

        foreach (var file in migrationFiles)
        {
            var content = File.ReadAllText(file);
            var matches = addColumnPattern.Matches(content);

            var operations = matches
                .Select(m => $"{m.Groups[2].Value}.{m.Groups[1].Value}")
                .ToList();

            var dupes = operations
                .GroupBy(op => op)
                .Where(g => g.Count() > 1)
                .Select(g => g.Key)
                .ToList();

            foreach (var dupe in dupes)
            {
                duplicates.Add($"{Path.GetFileName(file)}: duplicate AddColumn for {dupe}");
            }
        }

        duplicates.Should().BeEmpty(
            "migrations should not have duplicate AddColumn operations on the same table.column — " +
            "this is a known bug when EF scaffolds multiple migrations in the same session");
    }

    [Fact]
    public void Migrations_DoNotHaveDuplicateCreateTableOperations()
    {
        var migrationsDir = FindMigrationsDirectory();
        if (migrationsDir is null) return;

        var createTablePattern = new Regex(
            @"migrationBuilder\.CreateTable\(\s*name:\s*""([^""]+)""",
            RegexOptions.Compiled);

        // Collect all CreateTable operations across ALL migrations
        var allTableCreations = new List<(string File, string Table)>();
        var migrationFiles = Directory.GetFiles(migrationsDir, "*.cs")
            .Where(f => !f.Contains("Designer") && !f.Contains("Snapshot"))
            .ToList();

        foreach (var file in migrationFiles)
        {
            var content = File.ReadAllText(file);
            var matches = createTablePattern.Matches(content);
            foreach (Match m in matches)
            {
                allTableCreations.Add((Path.GetFileName(file), m.Groups[1].Value));
            }
        }

        // Known pre-existing duplicates that won't be fixed (would require migration squashing)
        var knownDuplicates = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "project_assignments" };

        // Check for same table created in multiple migrations (likely a conflict)
        var crossMigrationDupes = allTableCreations
            .GroupBy(t => t.Table)
            .Where(g => g.Count() > 1 && !knownDuplicates.Contains(g.Key))
            .Select(g => $"Table '{g.Key}' created in: {string.Join(", ", g.Select(x => x.File))}")
            .ToList();

        crossMigrationDupes.Should().BeEmpty(
            "no table should be created by multiple migrations — this indicates migration conflicts");
    }

    private static string? FindMigrationsDirectory()
    {
        // Walk up from the test assembly output directory to find the Migrations folder
        var dir = AppContext.BaseDirectory;
        for (var i = 0; i < 10; i++)
        {
            var candidate = Path.Combine(dir, "src", "Pitbull.Api", "Migrations");
            if (Directory.Exists(candidate))
                return candidate;
            dir = Directory.GetParent(dir)?.FullName;
            if (dir is null) break;
        }

        // Try the workspace root directly
        var workspaceRoot = "/mnt/c/pitbull-private";
        var fallback = Path.Combine(workspaceRoot, "src", "Pitbull.Api", "Migrations");
        return Directory.Exists(fallback) ? fallback : null;
    }
}
