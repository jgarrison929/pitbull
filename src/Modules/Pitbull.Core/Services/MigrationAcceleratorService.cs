using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;

namespace Pitbull.Core.Services;

public interface IMigrationAcceleratorService
{
    /// <summary>
    /// Auto-detect the source system from CSV column headers.
    /// Returns the detected source system identifier and confidence score.
    /// </summary>
    SourceDetectionResult DetectSourceSystem(IReadOnlyList<string> headers);

    /// <summary>
    /// Get default field mappings for a detected source system and entity type.
    /// </summary>
    IReadOnlyList<SuggestedFieldMapping> GetDefaultMappings(string sourceSystem, string entityType, IReadOnlyList<string> headers);

    /// <summary>
    /// Run the 6-stage validation pipeline on dictionary-keyed rows with the given field mappings.
    /// </summary>
    Task<ValidationPipelineResult> ValidateAsync(
        string entityType,
        IReadOnlyList<Dictionary<string, string>> rows,
        IReadOnlyList<FieldMapping> mappings,
        CancellationToken ct = default);

    /// <summary>
    /// Get the list of supported source systems.
    /// </summary>
    IReadOnlyList<SourceSystemProfile> GetSourceProfiles();
}

public class MigrationAcceleratorService(PitbullDbContext db) : IMigrationAcceleratorService
{
    // ── Source System Signature Definitions ──────────────────────────────

    private static readonly Dictionary<string, string[]> SourceSignatures = new(StringComparer.OrdinalIgnoreCase)
    {
        ["vista"] = ["APCo", "JCCo", "PRCo", "ARCo", "GLCo", "APVendor", "JCCostType"],
        ["sage300"] = ["REC#", "REC-TYPE", "VENDOR-#", "JOB-#", "EMPLOYEE-#"],
        ["foundation"] = ["VENDOR_NO", "JOB_NO", "PHASE_NO", "COST_TYPE", "Vnd #"],
        ["quickbooks"] = ["!HDR", "!SPL", "!TRNS", "*Name", "Account No."],
    };

    private static readonly Dictionary<string, string> SourceDisplayNames = new(StringComparer.OrdinalIgnoreCase)
    {
        ["vista"] = "Vista/Viewpoint",
        ["sage300"] = "Sage 300 CRE",
        ["foundation"] = "Foundation Software",
        ["quickbooks"] = "QuickBooks",
        ["generic"] = "Generic CSV",
    };

    // ── Default Field Mapping Templates ─────────────────────────────────

    private static readonly Dictionary<(string Source, string Entity), (string SourceCol, string TargetField, bool Required)[]> DefaultMappingTemplates = new()
    {
        [("vista", "vendor")] =
        [
            ("APVendor", "Code", true),
            ("Name", "Name", true),
            ("SortName", "ContactName", false),
            ("TaxId", "TaxId", false),
            ("PayTerms", "PaymentTerms", false),
            ("Address", "Address", false),
            ("City", "City", false),
            ("State", "State", false),
            ("Zip", "Zip", false),
            ("Phone", "Phone", false),
            ("1099YN", "TradeClassification", false),
        ],
        [("vista", "employee")] =
        [
            ("Employee", "EmployeeNumber", true),
            ("FirstName", "FirstName", true),
            ("LastName", "LastName", true),
            ("HrlyRate", "BaseHourlyRate", false),
            ("Email", "Email", false),
            ("HireDate", "HireDate", false),
            ("Status", "IsActive", false),
        ],
        [("vista", "project")] =
        [
            ("Job", "Number", true),
            ("Description", "Name", true),
            ("Contract", "ContractAmount", false),
            ("Status", "Status", false),
            ("StartDate", "StartDate", false),
        ],
        [("sage300", "vendor")] =
        [
            ("VENDOR-#", "Code", true),
            ("VENDOR-NAME", "Name", true),
            ("SORT-NAME", "ContactName", false),
            ("TAX-ID", "TaxId", false),
            ("PAY-TERMS", "PaymentTerms", false),
            ("ADDRESS-1", "Address", false),
            ("CITY", "City", false),
            ("STATE", "State", false),
            ("ZIP", "Zip", false),
        ],
        [("sage300", "employee")] =
        [
            ("EMPLOYEE-#", "EmployeeNumber", true),
            ("FIRST-NAME", "FirstName", true),
            ("LAST-NAME", "LastName", true),
            ("PAY-RATE", "BaseHourlyRate", false),
            ("EMAIL", "Email", false),
            ("HIRE-DATE", "HireDate", false),
            ("STATUS", "IsActive", false),
        ],
        [("foundation", "vendor")] =
        [
            ("VENDOR_NO", "Code", true),
            ("Name", "Name", true),
            ("TAX_ID", "TaxId", false),
            ("ADDRESS_1", "Address", false),
            ("CITY", "City", false),
            ("STATE", "State", false),
            ("ZIP", "Zip", false),
        ],
        [("quickbooks", "vendor")] =
        [
            ("Vendor", "Code", true),
            ("Company", "Name", true),
            ("Main Phone", "Phone", false),
            ("Account No.", "TaxId", false),
        ],
    };

    // ── Source Detection ─────────────────────────────────────────────────

    public SourceDetectionResult DetectSourceSystem(IReadOnlyList<string> headers)
    {
        if (headers.Count == 0)
            return new SourceDetectionResult("generic", "Generic CSV", 0m);

        var headerSet = new HashSet<string>(headers, StringComparer.OrdinalIgnoreCase);
        var bestSource = "generic";
        var bestScore = 0m;

        foreach (var (source, signatures) in SourceSignatures)
        {
            var matchCount = signatures.Count(sig => headerSet.Contains(sig));
            if (matchCount == 0) continue;

            var score = (decimal)matchCount / signatures.Length;
            if (score > bestScore)
            {
                bestScore = score;
                bestSource = source;
            }
        }

        var displayName = SourceDisplayNames.GetValueOrDefault(bestSource, bestSource);
        return new SourceDetectionResult(bestSource, displayName, bestScore);
    }

    // ── Default Mappings ────────────────────────────────────────────────

    public IReadOnlyList<SuggestedFieldMapping> GetDefaultMappings(
        string sourceSystem, string entityType, IReadOnlyList<string> headers)
    {
        var key = (sourceSystem.ToLowerInvariant(), entityType.ToLowerInvariant());
        if (!DefaultMappingTemplates.TryGetValue(key, out var templates))
            return [];

        var headerSet = new HashSet<string>(headers, StringComparer.OrdinalIgnoreCase);
        var results = new List<SuggestedFieldMapping>();

        foreach (var (sourceCol, targetField, required) in templates)
        {
            var matched = headerSet.Contains(sourceCol);
            results.Add(new SuggestedFieldMapping(
                sourceCol,
                targetField,
                required,
                matched ? 0.95m : 0.3m,
                matched));
        }

        return results;
    }

    // ── 6-Stage Validation Pipeline ─────────────────────────────────────

    public async Task<ValidationPipelineResult> ValidateAsync(
        string entityType,
        IReadOnlyList<Dictionary<string, string>> rows,
        IReadOnlyList<FieldMapping> mappings,
        CancellationToken ct = default)
    {
        var errors = new List<ValidationError>();
        var warnings = new List<ValidationError>();

        for (var rowIdx = 0; rowIdx < rows.Count; rowIdx++)
        {
            var row = rows[rowIdx];
            var rowNum = rowIdx + 2; // 1-based, skip header row

            foreach (var mapping in mappings)
            {
                row.TryGetValue(mapping.SourceColumn, out var value);
                value = value?.Trim();

                // Stage 1: Schema — column presence (already handled by dict structure)

                // Stage 2: Type validation
                if (!string.IsNullOrEmpty(value))
                {
                    var typeError = ValidateFieldType(mapping.TargetField, value);
                    if (typeError != null)
                        errors.Add(new ValidationError(rowNum, "Type", $"Column '{mapping.SourceColumn}': {typeError}"));
                }

                // Stage 3: Required field validation
                if (mapping.IsRequired && string.IsNullOrWhiteSpace(value))
                {
                    errors.Add(new ValidationError(rowNum, "Required", $"Required field '{mapping.SourceColumn}' is empty"));
                }

                // Stage 4: Business rule validation
                var bizWarning = ValidateBusinessRule(entityType, mapping.TargetField, value);
                if (bizWarning != null)
                    warnings.Add(new ValidationError(rowNum, "BusinessRule", bizWarning));
            }
        }

        // Stage 5: Referential integrity (check existing data in DB)
        var refWarnings = await ValidateReferentialIntegrityAsync(entityType, rows, mappings, ct);
        warnings.AddRange(refWarnings);

        // Stage 6: Duplicate detection within the import
        var dupeErrors = DetectDuplicates(entityType, rows, mappings);
        errors.AddRange(dupeErrors);

        var errorRows = errors.Select(e => e.Row).Distinct().Count();
        var validCount = rows.Count - errorRows;

        return new ValidationPipelineResult(
            rows.Count,
            validCount,
            errors.Count,
            warnings.Count,
            errors,
            warnings);
    }

    // ── Source Profiles ──────────────────────────────────────────────────

    public IReadOnlyList<SourceSystemProfile> GetSourceProfiles()
    {
        return
        [
            new("vista", "Vista/Viewpoint",
                ["vendor", "employee", "project", "cost-code", "gl-account"],
                "Export from Vista using SQL queries or Crystal Reports. Dates are MM/DD/YYYY. Company codes prefix all IDs."),
            new("sage300", "Sage 300 CRE",
                ["vendor", "employee", "project", "cost-code"],
                "Export from Sage 300 Construction using the report writer or Pervasive SQL direct export."),
            new("foundation", "Foundation Software",
                ["vendor", "project", "cost-code"],
                "Export from Foundation using the Report module. SQL Server-based export."),
            new("quickbooks", "QuickBooks",
                ["vendor", "employee", "project"],
                "Export from QuickBooks Desktop (IIF) or QuickBooks Online (CSV). Use Lists > Export."),
            new("generic", "Generic CSV",
                ["vendor", "employee", "project", "cost-code", "equipment", "time-entries"],
                "Any delimited text file. Manual column mapping required."),
        ];
    }

    // ── Private Helpers ─────────────────────────────────────────────────

    private static string? ValidateFieldType(string targetField, string value)
    {
        var field = targetField.ToLowerInvariant();

        // Money / numeric fields
        if (field.Contains("amount") || field.Contains("rate") || field.Contains("budget") || field.Contains("cost"))
        {
            if (!decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out _))
                return $"Expected a number, got '{value}'";
        }

        // Date fields
        if (field.Contains("date"))
        {
            if (!DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out _)
                && !DateTime.TryParseExact(value, "MM/dd/yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
                return $"Expected a date, got '{value}'";
        }

        return null;
    }

    private static string? ValidateBusinessRule(string entityType, string targetField, string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;

        var entity = entityType.ToLowerInvariant();
        var field = targetField.ToLowerInvariant();

        // Employee hourly rate range check
        if (entity == "employee" && field.Contains("rate"))
        {
            if (decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var rate))
            {
                if (rate < 10 || rate > 500)
                    return $"Hourly rate ${rate} is outside expected range ($10-$500)";
            }
        }

        // Contract amount should be non-negative
        if (entity == "project" && field.Contains("amount"))
        {
            if (decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var amount))
            {
                if (amount < 0)
                    return $"Contract amount should not be negative: {amount}";
            }
        }

        // State abbreviation should be 2 characters
        if (field == "state" && value.Length != 2)
        {
            return $"State should be a 2-character abbreviation, got '{value}'";
        }

        return null;
    }

    private async Task<List<ValidationError>> ValidateReferentialIntegrityAsync(
        string entityType,
        IReadOnlyList<Dictionary<string, string>> rows,
        IReadOnlyList<FieldMapping> mappings,
        CancellationToken ct)
    {
        var errors = new List<ValidationError>();

        // For entity types that reference projects, check project numbers exist
        if (entityType.Equals("time-entries", StringComparison.OrdinalIgnoreCase) ||
            entityType.Equals("subcontract", StringComparison.OrdinalIgnoreCase))
        {
            var projectMapping = mappings.FirstOrDefault(m =>
                m.TargetField.Equals("ProjectId", StringComparison.OrdinalIgnoreCase) ||
                m.TargetField.Equals("ProjectNumber", StringComparison.OrdinalIgnoreCase));

            if (projectMapping != null)
            {
                var projectRefs = rows
                    .Select((r, i) => (Row: i + 2, Value: r.GetValueOrDefault(projectMapping.SourceColumn)?.Trim()))
                    .Where(x => !string.IsNullOrEmpty(x.Value))
                    .ToList();

                var uniqueRefs = projectRefs.Select(x => x.Value!).Distinct().ToList();
                // Query projects table without compile-time dependency on Pitbull.Projects
                // (Core must not reference other modules — module boundary rule).
                var existingProjects = new List<string>();
                try
                {
                    existingProjects = await db.Database
                        .SqlQueryRaw<string>(
                            @"SELECT ""Number"" AS ""Value"" FROM projects WHERE ""IsDeleted"" = false")
                        .ToListAsync(ct);
                    existingProjects = existingProjects
                        .Where(n => uniqueRefs.Contains(n, StringComparer.OrdinalIgnoreCase))
                        .ToList();
                }
                catch (InvalidOperationException)
                {
                    // In-memory database does not support raw SQL — skip referential check
                }

                var existingSet = new HashSet<string>(existingProjects, StringComparer.OrdinalIgnoreCase);

                foreach (var (row, value) in projectRefs)
                {
                    if (!existingSet.Contains(value!))
                        errors.Add(new ValidationError(row, "ReferentialIntegrity",
                            $"Project '{value}' not found in system"));
                }
            }
        }

        return errors;
    }

    private static List<ValidationError> DetectDuplicates(
        string entityType,
        IReadOnlyList<Dictionary<string, string>> rows,
        IReadOnlyList<FieldMapping> mappings)
    {
        var errors = new List<ValidationError>();

        // Find the primary key / unique field for duplicate detection
        var keyFields = entityType.ToLowerInvariant() switch
        {
            "vendor" => new[] { "Code" },
            "employee" => new[] { "EmployeeNumber" },
            "project" => new[] { "Number" },
            "cost-code" => new[] { "Code" },
            "gl-account" => new[] { "AccountCode" },
            _ => Array.Empty<string>()
        };

        foreach (var keyField in keyFields)
        {
            var mapping = mappings.FirstOrDefault(m =>
                m.TargetField.Equals(keyField, StringComparison.OrdinalIgnoreCase));

            if (mapping == null) continue;

            var seen = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            for (var i = 0; i < rows.Count; i++)
            {
                var value = rows[i].GetValueOrDefault(mapping.SourceColumn)?.Trim();
                if (string.IsNullOrEmpty(value)) continue;

                if (seen.TryGetValue(value, out var firstRow))
                {
                    errors.Add(new ValidationError(i + 2, "Duplicate",
                        $"Duplicate {keyField} '{value}' (first seen at row {firstRow})"));
                }
                else
                {
                    seen[value] = i + 2;
                }
            }
        }

        return errors;
    }
}

// ── DTOs ────────────────────────────────────────────────────────────────

public record SourceDetectionResult(string SourceSystem, string DisplayName, decimal Confidence);

public record SuggestedFieldMapping(
    string SourceColumn,
    string TargetField,
    bool IsRequired,
    decimal Confidence,
    bool FoundInHeaders);

public record ValidationPipelineResult(
    int TotalRows,
    int ValidRows,
    int ErrorCount,
    int WarningCount,
    IReadOnlyList<ValidationError> Errors,
    IReadOnlyList<ValidationError> Warnings);

public record ValidationError(int Row, string Stage, string Message);

public record SourceSystemProfile(
    string Id,
    string DisplayName,
    IReadOnlyList<string> SupportedEntityTypes,
    string ExportGuide);
