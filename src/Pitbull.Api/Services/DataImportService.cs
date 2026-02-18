using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.Entities;
using Pitbull.Core.MultiTenancy;
using Pitbull.Projects.Domain;
using Pitbull.TimeTracking.Domain;

namespace Pitbull.Api.Services;

public interface IDataImportService
{
    Task<ImportPreviewResponse> PreviewAsync(string type, IFormFile file, CancellationToken cancellationToken = default);
    Task<ImportCommitResponse> ConfirmAsync(string type, Guid importId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ImportBatchHistoryDto>> GetHistoryAsync(int take = 100, CancellationToken cancellationToken = default);
}

public class DataImportService(
    PitbullDbContext db,
    ICompanyContext companyContext) : IDataImportService
{
    private const int MaxRowCount = 10_000;
    private const long MaxFileSizeBytes = 10 * 1024 * 1024; // 10 MB

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public async Task<ImportPreviewResponse> PreviewAsync(
        string type,
        IFormFile file,
        CancellationToken cancellationToken = default)
    {
        type = NormalizeType(type);

        if (!ImportBatchTypes.ValidTypes.Contains(type))
            throw new ArgumentException($"Unsupported import type '{type}'", nameof(type));

        if (file.Length == 0)
            throw new ArgumentException("CSV file is empty", nameof(file));

        if (file.Length > MaxFileSizeBytes)
            throw new ArgumentException($"CSV file exceeds the maximum allowed size of {MaxFileSizeBytes / (1024 * 1024)}MB", nameof(file));

        using var stream = file.OpenReadStream();
        var csv = await CsvParser.ParseAsync(stream, MaxRowCount, cancellationToken);

        var (rows, validRowsJson) = await BuildPreviewAsync(type, csv, cancellationToken);

        var batch = new ImportBatch
        {
            Type = type,
            Status = ImportBatchStatuses.Pending,
            TotalRows = rows.Count,
            ValidRows = rows.Count(r => r.IsValid),
            ErrorRows = rows.Count(r => !r.IsValid),
            ErrorDetails = JsonSerializer.Serialize(new ImportBatchPayload
            {
                Type = type,
                Headers = csv.Headers,
                Rows = rows,
                ValidRowsJson = validRowsJson
            }, JsonOptions)
        };

        db.Set<ImportBatch>().Add(batch);
        await db.SaveChangesAsync(cancellationToken);

        return new ImportPreviewResponse(
            batch.Id,
            type,
            batch.TotalRows,
            batch.ValidRows,
            batch.ErrorRows,
            rows);
    }

    public async Task<ImportCommitResponse> ConfirmAsync(
        string type,
        Guid importId,
        CancellationToken cancellationToken = default)
    {
        type = NormalizeType(type);

        var batch = await db.Set<ImportBatch>()
            .FirstOrDefaultAsync(x => x.Id == importId, cancellationToken);

        if (batch is null)
            throw new ArgumentException("Import batch not found", nameof(importId));

        if (!string.Equals(batch.Type, type, StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Import batch type mismatch", nameof(type));

        if (!string.Equals(batch.Status, ImportBatchStatuses.Pending, StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Import batch is not in Pending status", nameof(importId));

        batch.Status = ImportBatchStatuses.Processing;
        await db.SaveChangesAsync(cancellationToken);

        try
        {
            var payload = JsonSerializer.Deserialize<ImportBatchPayload>(batch.ErrorDetails, JsonOptions)
                ?? throw new InvalidOperationException("Import batch payload is invalid");

            var importedRows = type switch
            {
                ImportBatchTypes.Employees => await CommitEmployeesAsync(payload.ValidRowsJson, cancellationToken),
                ImportBatchTypes.Projects => await CommitProjectsAsync(payload.ValidRowsJson, cancellationToken),
                ImportBatchTypes.CostCodes => await CommitCostCodesAsync(payload.ValidRowsJson, cancellationToken),
                ImportBatchTypes.Equipment => await CommitEquipmentAsync(payload.ValidRowsJson, cancellationToken),
                ImportBatchTypes.TimeEntries => await CommitTimeEntriesAsync(payload.ValidRowsJson, cancellationToken),
                _ => throw new InvalidOperationException($"Unsupported import type '{type}'")
            };

            batch.Status = ImportBatchStatuses.Completed;
            batch.CompletedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(cancellationToken);

            return new ImportCommitResponse(batch.Id, batch.Status, importedRows, "Import completed successfully");
        }
        catch (Exception ex)
        {
            batch.Status = ImportBatchStatuses.Failed;
            batch.CompletedAt = DateTime.UtcNow;
            batch.ErrorDetails = JsonSerializer.Serialize(new
            {
                error = ex.Message,
                previousPayload = batch.ErrorDetails
            });
            await db.SaveChangesAsync(cancellationToken);

            return new ImportCommitResponse(batch.Id, batch.Status, 0, ex.Message);
        }
    }

    public async Task<IReadOnlyList<ImportBatchHistoryDto>> GetHistoryAsync(
        int take = 100,
        CancellationToken cancellationToken = default)
    {
        take = Math.Clamp(take, 1, 500);

        var batches = await db.Set<ImportBatch>()
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .Take(take)
            .ToListAsync(cancellationToken);

        return batches.Select(x => new ImportBatchHistoryDto(
            x.Id,
            x.Type,
            x.Status,
            x.TotalRows,
            x.ValidRows,
            x.ErrorRows,
            x.CreatedAt,
            x.CompletedAt)).ToList();
    }

    private async Task<(List<ImportPreviewRowDto> rows, string validRowsJson)> BuildPreviewAsync(
        string type,
        CsvData csv,
        CancellationToken cancellationToken)
    {
        return type switch
        {
            ImportBatchTypes.Employees => BuildEmployeePreview(csv),
            ImportBatchTypes.Projects => BuildProjectPreview(csv),
            ImportBatchTypes.CostCodes => BuildCostCodePreview(csv),
            ImportBatchTypes.Equipment => BuildEquipmentPreview(csv),
            ImportBatchTypes.TimeEntries => await BuildTimeEntryPreviewAsync(csv, cancellationToken),
            _ => throw new InvalidOperationException($"Unsupported import type '{type}'")
        };
    }

    private (List<ImportPreviewRowDto> rows, string validRowsJson) BuildEmployeePreview(CsvData csv)
    {
        ValidateHeaders(csv.Headers, ["EmployeeNumber", "FirstName", "LastName", "Email", "Department", "JobTitle", "PayRate", "HireDate"]);

        var previewRows = new List<ImportPreviewRowDto>();
        var validRows = new List<EmployeeImportRow>();

        for (var i = 0; i < csv.Rows.Count; i++)
        {
            var rowNumber = i + 2;
            var row = csv.Rows[i];
            var errors = new List<string>();

            var employeeNumber = GetRequired(row, "EmployeeNumber", errors);
            var firstName = GetRequired(row, "FirstName", errors);
            var lastName = GetRequired(row, "LastName", errors);
            var email = GetRequired(row, "Email", errors);
            var department = GetOptional(row, "Department");
            var jobTitle = GetOptional(row, "JobTitle");

            var payRate = ParseDecimal(row, "PayRate", errors);
            var hireDate = ParseDateOnly(row, "HireDate", errors);

            if (errors.Count == 0)
            {
                validRows.Add(new EmployeeImportRow(
                    employeeNumber,
                    firstName,
                    lastName,
                    email,
                    department,
                    jobTitle,
                    payRate,
                    hireDate));
            }

            previewRows.Add(new ImportPreviewRowDto(rowNumber, errors.Count == 0, row, errors));
        }

        return (previewRows, JsonSerializer.Serialize(validRows, JsonOptions));
    }

    private (List<ImportPreviewRowDto> rows, string validRowsJson) BuildProjectPreview(CsvData csv)
    {
        ValidateHeaders(csv.Headers, ["ProjectNumber", "Name", "Description", "StartDate", "EndDate", "ContractAmount", "Status"]);

        var previewRows = new List<ImportPreviewRowDto>();
        var validRows = new List<ProjectImportRow>();

        for (var i = 0; i < csv.Rows.Count; i++)
        {
            var rowNumber = i + 2;
            var row = csv.Rows[i];
            var errors = new List<string>();

            var projectNumber = GetRequired(row, "ProjectNumber", errors);
            var name = GetRequired(row, "Name", errors);
            var description = GetOptional(row, "Description");
            var startDate = ParseDateTime(row, "StartDate", errors);
            var endDate = ParseDateTime(row, "EndDate", errors);
            var contractAmount = ParseDecimal(row, "ContractAmount", errors);
            var statusRaw = GetRequired(row, "Status", errors);

            var status = ProjectStatus.Bidding;
            if (!string.IsNullOrWhiteSpace(statusRaw)
                && !Enum.TryParse<ProjectStatus>(statusRaw, true, out status))
            {
                errors.Add($"Status '{statusRaw}' is invalid");
            }

            if (errors.Count == 0)
            {
                validRows.Add(new ProjectImportRow(
                    projectNumber,
                    name,
                    description,
                    startDate,
                    endDate,
                    contractAmount,
                    status));
            }

            previewRows.Add(new ImportPreviewRowDto(rowNumber, errors.Count == 0, row, errors));
        }

        return (previewRows, JsonSerializer.Serialize(validRows, JsonOptions));
    }

    private (List<ImportPreviewRowDto> rows, string validRowsJson) BuildCostCodePreview(CsvData csv)
    {
        ValidateHeaders(csv.Headers, ["Code", "Description", "Category", "UnitOfMeasure"]);

        var previewRows = new List<ImportPreviewRowDto>();
        var validRows = new List<CostCodeImportRow>();

        for (var i = 0; i < csv.Rows.Count; i++)
        {
            var rowNumber = i + 2;
            var row = csv.Rows[i];
            var errors = new List<string>();

            var code = GetRequired(row, "Code", errors);
            var description = GetRequired(row, "Description", errors);
            var category = GetOptional(row, "Category");
            var unitOfMeasure = GetOptional(row, "UnitOfMeasure");

            if (errors.Count == 0)
            {
                validRows.Add(new CostCodeImportRow(code, description, category, unitOfMeasure));
            }

            previewRows.Add(new ImportPreviewRowDto(rowNumber, errors.Count == 0, row, errors));
        }

        return (previewRows, JsonSerializer.Serialize(validRows, JsonOptions));
    }

    private (List<ImportPreviewRowDto> rows, string validRowsJson) BuildEquipmentPreview(CsvData csv)
    {
        ValidateHeaders(csv.Headers, ["Name", "Code", "Type", "HourlyRate", "DailyRate"]);

        var previewRows = new List<ImportPreviewRowDto>();
        var validRows = new List<EquipmentImportRow>();

        for (var i = 0; i < csv.Rows.Count; i++)
        {
            var rowNumber = i + 2;
            var row = csv.Rows[i];
            var errors = new List<string>();

            var name = GetRequired(row, "Name", errors);
            var code = GetRequired(row, "Code", errors);
            var typeRaw = GetRequired(row, "Type", errors);
            var hourlyRate = ParseDecimal(row, "HourlyRate", errors);
            var dailyRate = ParseDecimal(row, "DailyRate", errors);

            var equipmentType = EquipmentType.Other;
            if (!string.IsNullOrWhiteSpace(typeRaw)
                && !Enum.TryParse<EquipmentType>(typeRaw, true, out equipmentType))
            {
                errors.Add($"Type '{typeRaw}' is invalid");
            }

            if (errors.Count == 0)
            {
                validRows.Add(new EquipmentImportRow(name, code, equipmentType, hourlyRate, dailyRate));
            }

            previewRows.Add(new ImportPreviewRowDto(rowNumber, errors.Count == 0, row, errors));
        }

        return (previewRows, JsonSerializer.Serialize(validRows, JsonOptions));
    }

    private async Task<(List<ImportPreviewRowDto> rows, string validRowsJson)> BuildTimeEntryPreviewAsync(
        CsvData csv,
        CancellationToken cancellationToken)
    {
        ValidateHeaders(csv.Headers, ["EmployeeNumber", "ProjectNumber", "CostCode", "Date", "Hours", "OvertimeHours", "Description"]);

        if (!companyContext.IsResolved)
            throw new InvalidOperationException("A company context is required to import time entries");

        var previewRows = new List<ImportPreviewRowDto>();
        var candidateRows = new List<(int RowNumber, Dictionary<string, string> Values, TimeEntryImportRow Row, List<string> Errors)>();

        for (var i = 0; i < csv.Rows.Count; i++)
        {
            var rowNumber = i + 2;
            var row = csv.Rows[i];
            var errors = new List<string>();

            var employeeNumber = GetRequired(row, "EmployeeNumber", errors);
            var projectNumber = GetRequired(row, "ProjectNumber", errors);
            var costCode = GetRequired(row, "CostCode", errors);
            var date = ParseDateOnly(row, "Date", errors);
            var hours = ParseDecimal(row, "Hours", errors);
            var overtimeHours = ParseDecimal(row, "OvertimeHours", errors);
            var description = GetOptional(row, "Description");

            var parsed = new TimeEntryImportRow(
                employeeNumber,
                projectNumber,
                costCode,
                date,
                hours,
                overtimeHours,
                description);

            candidateRows.Add((rowNumber, row, parsed, errors));
        }

        var employeeNumbers = candidateRows.Select(x => x.Row.EmployeeNumber).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var projectNumbers = candidateRows.Select(x => x.Row.ProjectNumber).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var costCodes = candidateRows.Select(x => x.Row.CostCode).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        var existingEmployees = await db.Set<Employee>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted && employeeNumbers.Contains(x.EmployeeNumber))
            .Select(x => x.EmployeeNumber)
            .ToListAsync(cancellationToken);

        var existingProjects = await db.Set<Project>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted && projectNumbers.Contains(x.Number))
            .Select(x => x.Number)
            .ToListAsync(cancellationToken);

        var existingCostCodes = await db.Set<CostCode>()
            .AsNoTracking()
            .Where(x => !x.IsDeleted && costCodes.Contains(x.Code))
            .Select(x => x.Code)
            .ToListAsync(cancellationToken);

        var employeeSet = existingEmployees.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var projectSet = existingProjects.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var costCodeSet = existingCostCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);

        var validRows = new List<TimeEntryImportRow>();

        foreach (var candidate in candidateRows)
        {
            if (!employeeSet.Contains(candidate.Row.EmployeeNumber))
                candidate.Errors.Add($"Employee '{candidate.Row.EmployeeNumber}' not found");

            if (!projectSet.Contains(candidate.Row.ProjectNumber))
                candidate.Errors.Add($"Project '{candidate.Row.ProjectNumber}' not found");

            if (!costCodeSet.Contains(candidate.Row.CostCode))
                candidate.Errors.Add($"Cost code '{candidate.Row.CostCode}' not found");

            if (candidate.Errors.Count == 0)
                validRows.Add(candidate.Row);

            previewRows.Add(new ImportPreviewRowDto(
                candidate.RowNumber,
                candidate.Errors.Count == 0,
                candidate.Values,
                candidate.Errors));
        }

        return (previewRows, JsonSerializer.Serialize(validRows, JsonOptions));
    }

    private async Task<int> CommitEmployeesAsync(string validRowsJson, CancellationToken cancellationToken)
    {
        var rows = JsonSerializer.Deserialize<List<EmployeeImportRow>>(validRowsJson, JsonOptions) ?? [];
        if (rows.Count == 0)
            return 0;

        var employeeNumbers = rows.Select(x => x.EmployeeNumber).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var existing = await db.Set<Employee>()
            .Where(x => !x.IsDeleted && employeeNumbers.Contains(x.EmployeeNumber))
            .ToDictionaryAsync(x => x.EmployeeNumber, StringComparer.OrdinalIgnoreCase, cancellationToken);

        foreach (var row in rows)
        {
            var departmentNote = string.IsNullOrWhiteSpace(row.Department)
                ? null
                : $"Department: {row.Department}";

            if (existing.TryGetValue(row.EmployeeNumber, out var employee))
            {
                employee.FirstName = row.FirstName;
                employee.LastName = row.LastName;
                employee.Email = row.Email;
                employee.Title = row.JobTitle;
                employee.BaseHourlyRate = row.PayRate;
                employee.HireDate = row.HireDate;
                employee.Notes = departmentNote;
                employee.IsActive = true;
            }
            else
            {
                db.Set<Employee>().Add(new Employee
                {
                    EmployeeNumber = row.EmployeeNumber,
                    FirstName = row.FirstName,
                    LastName = row.LastName,
                    Email = row.Email,
                    Title = row.JobTitle,
                    BaseHourlyRate = row.PayRate,
                    HireDate = row.HireDate,
                    Notes = departmentNote,
                    Classification = EmployeeClassification.Hourly,
                    IsActive = true
                });
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return rows.Count;
    }

    private async Task<int> CommitProjectsAsync(string validRowsJson, CancellationToken cancellationToken)
    {
        if (!companyContext.IsResolved)
            throw new InvalidOperationException("A company context is required to import projects");

        var rows = JsonSerializer.Deserialize<List<ProjectImportRow>>(validRowsJson, JsonOptions) ?? [];
        if (rows.Count == 0)
            return 0;

        var projectNumbers = rows.Select(x => x.ProjectNumber).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var existing = await db.Set<Project>()
            .Where(x => !x.IsDeleted && projectNumbers.Contains(x.Number))
            .ToDictionaryAsync(x => x.Number, StringComparer.OrdinalIgnoreCase, cancellationToken);

        foreach (var row in rows)
        {
            if (existing.TryGetValue(row.ProjectNumber, out var project))
            {
                project.Name = row.Name;
                project.Description = row.Description;
                project.StartDate = row.StartDate;
                project.EstimatedCompletionDate = row.EndDate;
                project.ContractAmount = row.ContractAmount;
                project.Status = row.Status;
            }
            else
            {
                db.Set<Project>().Add(new Project
                {
                    Number = row.ProjectNumber,
                    Name = row.Name,
                    Description = row.Description,
                    StartDate = row.StartDate,
                    EstimatedCompletionDate = row.EndDate,
                    ContractAmount = row.ContractAmount,
                    Status = row.Status,
                    Type = ProjectType.Commercial,
                    CompanyId = companyContext.CompanyId
                });
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return rows.Count;
    }

    private async Task<int> CommitCostCodesAsync(string validRowsJson, CancellationToken cancellationToken)
    {
        var rows = JsonSerializer.Deserialize<List<CostCodeImportRow>>(validRowsJson, JsonOptions) ?? [];
        if (rows.Count == 0)
            return 0;

        var codes = rows.Select(x => x.Code).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var existing = await db.Set<CostCode>()
            .Where(x => !x.IsDeleted && codes.Contains(x.Code))
            .ToDictionaryAsync(x => x.Code, StringComparer.OrdinalIgnoreCase, cancellationToken);

        foreach (var row in rows)
        {
            var uomSuffix = string.IsNullOrWhiteSpace(row.UnitOfMeasure)
                ? string.Empty
                : $" (UOM: {row.UnitOfMeasure})";

            var description = row.Description + uomSuffix;
            var costType = ResolveCostType(row.Category);

            if (existing.TryGetValue(row.Code, out var costCode))
            {
                costCode.Description = description;
                costCode.Division = row.Category;
                costCode.CostType = costType;
                costCode.IsActive = true;
            }
            else
            {
                db.Set<CostCode>().Add(new CostCode
                {
                    Code = row.Code,
                    Description = description,
                    Division = row.Category,
                    CostType = costType,
                    IsActive = true
                });
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return rows.Count;
    }

    private async Task<int> CommitEquipmentAsync(string validRowsJson, CancellationToken cancellationToken)
    {
        var rows = JsonSerializer.Deserialize<List<EquipmentImportRow>>(validRowsJson, JsonOptions) ?? [];
        if (rows.Count == 0)
            return 0;

        var codes = rows.Select(x => x.Code).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var existing = await db.Set<Equipment>()
            .Where(x => !x.IsDeleted && codes.Contains(x.Code))
            .ToDictionaryAsync(x => x.Code, StringComparer.OrdinalIgnoreCase, cancellationToken);

        foreach (var row in rows)
        {
            if (existing.TryGetValue(row.Code, out var equipment))
            {
                equipment.Name = row.Name;
                equipment.Type = row.Type;
                equipment.HourlyRate = row.HourlyRate;
                equipment.BillingRate = row.DailyRate;
                equipment.IsActive = true;
            }
            else
            {
                db.Set<Equipment>().Add(new Equipment
                {
                    Name = row.Name,
                    Code = row.Code,
                    Type = row.Type,
                    HourlyRate = row.HourlyRate,
                    BillingRate = row.DailyRate,
                    IsActive = true
                });
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return rows.Count;
    }

    private async Task<int> CommitTimeEntriesAsync(string validRowsJson, CancellationToken cancellationToken)
    {
        if (!companyContext.IsResolved)
            throw new InvalidOperationException("A company context is required to import time entries");

        var rows = JsonSerializer.Deserialize<List<TimeEntryImportRow>>(validRowsJson, JsonOptions) ?? [];
        if (rows.Count == 0)
            return 0;

        var employeeMap = await db.Set<Employee>()
            .Where(x => !x.IsDeleted && rows.Select(r => r.EmployeeNumber).Contains(x.EmployeeNumber))
            .ToDictionaryAsync(x => x.EmployeeNumber, StringComparer.OrdinalIgnoreCase, cancellationToken);

        var projectMap = await db.Set<Project>()
            .Where(x => !x.IsDeleted && rows.Select(r => r.ProjectNumber).Contains(x.Number))
            .ToDictionaryAsync(x => x.Number, StringComparer.OrdinalIgnoreCase, cancellationToken);

        var costCodeMap = await db.Set<CostCode>()
            .Where(x => !x.IsDeleted && rows.Select(r => r.CostCode).Contains(x.Code))
            .ToDictionaryAsync(x => x.Code, StringComparer.OrdinalIgnoreCase, cancellationToken);

        var imported = 0;

        foreach (var row in rows)
        {
            if (!employeeMap.TryGetValue(row.EmployeeNumber, out var employee))
                continue;
            if (!projectMap.TryGetValue(row.ProjectNumber, out var project))
                continue;
            if (!costCodeMap.TryGetValue(row.CostCode, out var costCode))
                continue;

            var existing = await db.Set<TimeEntry>()
                .Where(x => !x.IsDeleted)
                .FirstOrDefaultAsync(x =>
                    x.Date == row.Date &&
                    x.EmployeeId == employee.Id &&
                    x.ProjectId == project.Id &&
                    x.CostCodeId == costCode.Id,
                    cancellationToken);

            if (existing is not null)
            {
                existing.RegularHours = row.Hours;
                existing.OvertimeHours = row.OvertimeHours;
                existing.DoubletimeHours = 0;
                existing.Description = row.Description;
                existing.Status = TimeEntryStatus.Submitted;
            }
            else
            {
                db.Set<TimeEntry>().Add(new TimeEntry
                {
                    Date = row.Date,
                    EmployeeId = employee.Id,
                    ProjectId = project.Id,
                    CostCodeId = costCode.Id,
                    RegularHours = row.Hours,
                    OvertimeHours = row.OvertimeHours,
                    DoubletimeHours = 0,
                    Description = row.Description,
                    CompanyId = project.CompanyId,
                    Status = TimeEntryStatus.Submitted
                });
            }

            imported++;
        }

        await db.SaveChangesAsync(cancellationToken);
        return imported;
    }

    private static CostType ResolveCostType(string? category)
    {
        if (string.IsNullOrWhiteSpace(category))
            return CostType.Labor;

        return category.Trim().ToLowerInvariant() switch
        {
            "labor" => CostType.Labor,
            "material" => CostType.Material,
            "equipment" => CostType.Equipment,
            "subcontract" => CostType.Subcontract,
            "overhead" => CostType.Overhead,
            _ => CostType.Other
        };
    }

    private static string NormalizeType(string type)
    {
        return type.Trim().ToLowerInvariant();
    }

    private static void ValidateHeaders(IReadOnlyList<string> headers, IReadOnlyList<string> required)
    {
        var missing = required.Where(x => !headers.Contains(x, StringComparer.OrdinalIgnoreCase)).ToList();
        if (missing.Count > 0)
            throw new ArgumentException($"CSV is missing required columns: {string.Join(", ", missing)}");
    }

    private static string GetRequired(Dictionary<string, string> row, string key, List<string> errors)
    {
        if (!row.TryGetValue(key, out var value) || string.IsNullOrWhiteSpace(value))
        {
            errors.Add($"{key} is required");
            return string.Empty;
        }

        return value.Trim();
    }

    private static string? GetOptional(Dictionary<string, string> row, string key)
    {
        return row.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value)
            ? value.Trim()
            : null;
    }

    private static decimal ParseDecimal(Dictionary<string, string> row, string key, List<string> errors)
    {
        var value = GetRequired(row, key, errors);
        if (string.IsNullOrWhiteSpace(value))
            return 0m;

        if (decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed))
            return parsed;

        if (decimal.TryParse(value, NumberStyles.Any, CultureInfo.CurrentCulture, out parsed))
            return parsed;

        errors.Add($"{key} '{value}' is not a valid number");
        return 0m;
    }

    private static DateOnly ParseDateOnly(Dictionary<string, string> row, string key, List<string> errors)
    {
        var value = GetRequired(row, key, errors);
        if (string.IsNullOrWhiteSpace(value))
            return default;

        if (DateOnly.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
            return parsed;

        if (DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedDateTime))
            return DateOnly.FromDateTime(parsedDateTime);

        errors.Add($"{key} '{value}' is not a valid date");
        return default;
    }

    private static DateTime? ParseDateTime(Dictionary<string, string> row, string key, List<string> errors)
    {
        var value = GetOptional(row, key);
        if (string.IsNullOrWhiteSpace(value))
            return null;

        if (DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed))
            return parsed;

        errors.Add($"{key} '{value}' is not a valid date");
        return null;
    }
}

public record ImportPreviewResponse(
    Guid ImportId,
    string Type,
    int TotalRows,
    int ValidRows,
    int ErrorRows,
    IReadOnlyList<ImportPreviewRowDto> Rows);

public record ImportPreviewRowDto(
    int RowNumber,
    bool IsValid,
    Dictionary<string, string> Values,
    IReadOnlyList<string> Errors);

public record ImportCommitResponse(
    Guid ImportId,
    string Status,
    int ImportedRows,
    string Message);

public record ImportBatchHistoryDto(
    Guid Id,
    string Type,
    string Status,
    int TotalRows,
    int ValidRows,
    int ErrorRows,
    DateTime CreatedAt,
    DateTime? CompletedAt);

public sealed class ImportBatchPayload
{
    public string Type { get; set; } = string.Empty;
    public IReadOnlyList<string> Headers { get; set; } = [];
    public IReadOnlyList<ImportPreviewRowDto> Rows { get; set; } = [];
    public string ValidRowsJson { get; set; } = "[]";
}

public sealed record EmployeeImportRow(
    string EmployeeNumber,
    string FirstName,
    string LastName,
    string Email,
    string? Department,
    string? JobTitle,
    decimal PayRate,
    DateOnly HireDate);

public sealed record ProjectImportRow(
    string ProjectNumber,
    string Name,
    string? Description,
    DateTime? StartDate,
    DateTime? EndDate,
    decimal ContractAmount,
    ProjectStatus Status);

public sealed record CostCodeImportRow(
    string Code,
    string Description,
    string? Category,
    string? UnitOfMeasure);

public sealed record EquipmentImportRow(
    string Name,
    string Code,
    EquipmentType Type,
    decimal HourlyRate,
    decimal DailyRate);

public sealed record TimeEntryImportRow(
    string EmployeeNumber,
    string ProjectNumber,
    string CostCode,
    DateOnly Date,
    decimal Hours,
    decimal OvertimeHours,
    string? Description);

internal sealed class CsvData
{
    public required IReadOnlyList<string> Headers { get; init; }
    public required IReadOnlyList<Dictionary<string, string>> Rows { get; init; }
}

internal static class CsvParser
{
    public static async Task<CsvData> ParseAsync(Stream stream, int maxRows, CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(stream);
        var headerLine = await reader.ReadLineAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(headerLine))
            throw new ArgumentException("CSV file is missing headers");

        var headers = ParseLine(headerLine)
            .Select(x => x.Trim())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .ToList();

        if (headers.Count == 0)
            throw new ArgumentException("CSV file contains invalid headers");

        var rows = new List<Dictionary<string, string>>();

        while (!reader.EndOfStream)
        {
            var line = await reader.ReadLineAsync(cancellationToken) ?? string.Empty;
            if (string.IsNullOrWhiteSpace(line))
                continue;

            if (rows.Count >= maxRows)
                throw new ArgumentException($"CSV file exceeds the maximum of {maxRows:N0} data rows");

            var values = ParseLine(line);
            var row = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            for (var i = 0; i < headers.Count; i++)
            {
                row[headers[i]] = i < values.Count ? values[i].Trim() : string.Empty;
            }

            rows.Add(row);
        }

        return new CsvData
        {
            Headers = headers,
            Rows = rows
        };
    }

    private static List<string> ParseLine(string line)
    {
        var result = new List<string>();
        var current = new System.Text.StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < line.Length; i++)
        {
            var c = line[i];

            if (c == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    current.Append('"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }

                continue;
            }

            if (c == ',' && !inQuotes)
            {
                result.Add(current.ToString());
                current.Clear();
                continue;
            }

            current.Append(c);
        }

        result.Add(current.ToString());
        return result;
    }
}
