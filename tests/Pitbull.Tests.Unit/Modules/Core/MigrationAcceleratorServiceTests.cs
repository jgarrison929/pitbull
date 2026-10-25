using FluentAssertions;
using Pitbull.Core.Domain;
using Pitbull.Core.Services;
using Pitbull.Tests.Unit.Helpers;

// ReSharper disable UseCollectionExpression

namespace Pitbull.Tests.Unit.Modules.Core;

public class MigrationAcceleratorServiceTests
{
    // ── Source Detection ─────────────────────────────────────────────────

    [Fact]
    public void DetectSourceSystem_VistaHeaders_ReturnsVista()
    {
        using var db = TestDbContextFactory.Create();
        var service = new MigrationAcceleratorService(db);

        var headers = new[] { "APCo", "JCCo", "APVendor", "Name", "Address" };
        var result = service.DetectSourceSystem(headers);

        result.SourceSystem.Should().Be("vista");
        result.DisplayName.Should().Be("Vista/Viewpoint");
        result.Confidence.Should().BeGreaterThan(0);
    }

    [Fact]
    public void DetectSourceSystem_SageHeaders_ReturnsSage()
    {
        using var db = TestDbContextFactory.Create();
        var service = new MigrationAcceleratorService(db);

        var headers = new[] { "REC#", "VENDOR-#", "VENDOR-NAME", "EMPLOYEE-#" };
        var result = service.DetectSourceSystem(headers);

        result.SourceSystem.Should().Be("sage300");
        result.DisplayName.Should().Be("Sage 300 CRE");
        result.Confidence.Should().BeGreaterThan(0);
    }

    [Fact]
    public void DetectSourceSystem_QuickBooksHeaders_ReturnsQuickBooks()
    {
        using var db = TestDbContextFactory.Create();
        var service = new MigrationAcceleratorService(db);

        var headers = new[] { "!HDR", "!SPL", "*Name", "Account No." };
        var result = service.DetectSourceSystem(headers);

        result.SourceSystem.Should().Be("quickbooks");
        result.DisplayName.Should().Be("QuickBooks");
        result.Confidence.Should().BeGreaterThan(0);
    }

    [Fact]
    public void DetectSourceSystem_FoundationHeaders_ReturnsFoundation()
    {
        using var db = TestDbContextFactory.Create();
        var service = new MigrationAcceleratorService(db);

        var headers = new[] { "VENDOR_NO", "JOB_NO", "PHASE_NO", "COST_TYPE" };
        var result = service.DetectSourceSystem(headers);

        result.SourceSystem.Should().Be("foundation");
        result.DisplayName.Should().Be("Foundation Software");
    }

    [Fact]
    public void DetectSourceSystem_UnknownHeaders_ReturnsGeneric()
    {
        using var db = TestDbContextFactory.Create();
        var service = new MigrationAcceleratorService(db);

        var headers = new[] { "Column1", "Column2", "Column3" };
        var result = service.DetectSourceSystem(headers);

        result.SourceSystem.Should().Be("generic");
        result.DisplayName.Should().Be("Generic CSV");
        result.Confidence.Should().Be(0m);
    }

    [Fact]
    public void DetectSourceSystem_EmptyHeaders_ReturnsGeneric()
    {
        using var db = TestDbContextFactory.Create();
        var service = new MigrationAcceleratorService(db);

        var result = service.DetectSourceSystem([]);

        result.SourceSystem.Should().Be("generic");
        result.Confidence.Should().Be(0m);
    }

    [Fact]
    public void DetectSourceSystem_PicksHighestScoreWhenMultipleMatch()
    {
        using var db = TestDbContextFactory.Create();
        var service = new MigrationAcceleratorService(db);

        // Mix of Vista (3/7 match) and Sage (1/5 match) — Vista should win
        var headers = new[] { "APCo", "JCCo", "APVendor", "REC#" };
        var result = service.DetectSourceSystem(headers);

        result.SourceSystem.Should().Be("vista");
    }

    // ── Field Mapping Auto-Detection ────────────────────────────────────

    [Fact]
    public void GetDefaultMappings_VistaVendor_ReturnsMappingsWithMatchFlags()
    {
        using var db = TestDbContextFactory.Create();
        var service = new MigrationAcceleratorService(db);

        var headers = new[] { "APVendor", "Name", "SortName", "Phone" };
        var mappings = service.GetDefaultMappings("vista", "vendor", headers);

        mappings.Should().NotBeEmpty();

        var codeMappings = mappings.Where(m => m.TargetField == "Code").ToList();
        codeMappings.Should().HaveCount(1);
        codeMappings[0].SourceColumn.Should().Be("APVendor");
        codeMappings[0].FoundInHeaders.Should().BeTrue();
        codeMappings[0].Confidence.Should().Be(0.95m);
        codeMappings[0].IsRequired.Should().BeTrue();
    }

    [Fact]
    public void GetDefaultMappings_MissingColumn_LowConfidence()
    {
        using var db = TestDbContextFactory.Create();
        var service = new MigrationAcceleratorService(db);

        // Don't include "Address" in headers
        var headers = new[] { "APVendor", "Name" };
        var mappings = service.GetDefaultMappings("vista", "vendor", headers);

        var addressMapping = mappings.FirstOrDefault(m => m.TargetField == "Address");
        addressMapping.Should().NotBeNull();
        addressMapping!.FoundInHeaders.Should().BeFalse();
        addressMapping.Confidence.Should().Be(0.3m);
    }

    [Fact]
    public void GetDefaultMappings_UnknownSourceSystem_ReturnsEmpty()
    {
        using var db = TestDbContextFactory.Create();
        var service = new MigrationAcceleratorService(db);

        var mappings = service.GetDefaultMappings("unknown-erp", "vendor", ["Col1", "Col2"]);

        mappings.Should().BeEmpty();
    }

    [Fact]
    public void GetDefaultMappings_UnknownEntityType_ReturnsEmpty()
    {
        using var db = TestDbContextFactory.Create();
        var service = new MigrationAcceleratorService(db);

        var mappings = service.GetDefaultMappings("vista", "unknown-entity", ["APVendor", "Name"]);

        mappings.Should().BeEmpty();
    }

    [Fact]
    public void GetDefaultMappings_Sage300Employee_ReturnsMappings()
    {
        using var db = TestDbContextFactory.Create();
        var service = new MigrationAcceleratorService(db);

        var headers = new[] { "EMPLOYEE-#", "FIRST-NAME", "LAST-NAME", "PAY-RATE" };
        var mappings = service.GetDefaultMappings("sage300", "employee", headers);

        mappings.Should().NotBeEmpty();
        mappings.Should().Contain(m => m.TargetField == "EmployeeNumber" && m.FoundInHeaders);
        mappings.Should().Contain(m => m.TargetField == "FirstName" && m.FoundInHeaders);
        mappings.Should().Contain(m => m.TargetField == "LastName" && m.FoundInHeaders);
    }

    // ── Validation Pipeline ─────────────────────────────────────────────

    [Fact]
    public async Task ValidateAsync_ValidVendorData_ReturnsAllValid()
    {
        using var db = TestDbContextFactory.Create();
        var service = new MigrationAcceleratorService(db);

        var rows = new List<Dictionary<string, string>>
        {
            new() { ["Code"] = "V001", ["Name"] = "ACME Supplies" },
            new() { ["Code"] = "V002", ["Name"] = "Best Materials" },
        };

        var mappings = new List<FieldMapping>
        {
            CreateMapping("Code", "Code", true),
            CreateMapping("Name", "Name", true),
        };

        var result = await service.ValidateAsync("vendor", rows, mappings);

        result.TotalRows.Should().Be(2);
        result.ValidRows.Should().Be(2);
        result.ErrorCount.Should().Be(0);
    }

    [Fact]
    public async Task ValidateAsync_MissingRequiredField_ReturnsError()
    {
        using var db = TestDbContextFactory.Create();
        var service = new MigrationAcceleratorService(db);

        var rows = new List<Dictionary<string, string>>
        {
            new() { ["Code"] = "V001", ["Name"] = "" },  // Empty required
        };

        var mappings = new List<FieldMapping>
        {
            CreateMapping("Code", "Code", true),
            CreateMapping("Name", "Name", true),
        };

        var result = await service.ValidateAsync("vendor", rows, mappings);

        result.ErrorCount.Should().BeGreaterThan(0);
        result.Errors.Should().Contain(e => e.Stage == "Required");
    }

    [Fact]
    public async Task ValidateAsync_InvalidNumericField_ReturnsTypeError()
    {
        using var db = TestDbContextFactory.Create();
        var service = new MigrationAcceleratorService(db);

        var rows = new List<Dictionary<string, string>>
        {
            new() { ["Number"] = "EMP001", ["FirstName"] = "John", ["LastName"] = "Doe", ["BaseHourlyRate"] = "not-a-number" },
        };

        var mappings = new List<FieldMapping>
        {
            CreateMapping("Number", "EmployeeNumber", true),
            CreateMapping("FirstName", "FirstName", true),
            CreateMapping("LastName", "LastName", true),
            CreateMapping("BaseHourlyRate", "BaseHourlyRate", false),
        };

        var result = await service.ValidateAsync("employee", rows, mappings);

        result.Errors.Should().Contain(e => e.Stage == "Type" && e.Message.Contains("Expected a number"));
    }

    [Fact]
    public async Task ValidateAsync_InvalidDateField_ReturnsTypeError()
    {
        using var db = TestDbContextFactory.Create();
        var service = new MigrationAcceleratorService(db);

        var rows = new List<Dictionary<string, string>>
        {
            new() { ["Number"] = "P001", ["Name"] = "Project 1", ["StartDate"] = "not-a-date" },
        };

        var mappings = new List<FieldMapping>
        {
            CreateMapping("Number", "Number", true),
            CreateMapping("Name", "Name", true),
            CreateMapping("StartDate", "StartDate", false),
        };

        var result = await service.ValidateAsync("project", rows, mappings);

        result.Errors.Should().Contain(e => e.Stage == "Type" && e.Message.Contains("Expected a date"));
    }

    [Fact]
    public async Task ValidateAsync_BusinessRuleWarning_EmployeeRateOutOfRange()
    {
        using var db = TestDbContextFactory.Create();
        var service = new MigrationAcceleratorService(db);

        var rows = new List<Dictionary<string, string>>
        {
            new() { ["EmpNo"] = "EMP001", ["First"] = "John", ["Last"] = "Doe", ["Rate"] = "5000" },
        };

        var mappings = new List<FieldMapping>
        {
            CreateMapping("EmpNo", "EmployeeNumber", true),
            CreateMapping("First", "FirstName", true),
            CreateMapping("Last", "LastName", true),
            CreateMapping("Rate", "BaseHourlyRate", false),
        };

        var result = await service.ValidateAsync("employee", rows, mappings);

        result.WarningCount.Should().BeGreaterThan(0);
        result.Warnings.Should().Contain(w => w.Stage == "BusinessRule" && w.Message.Contains("outside expected range"));
    }

    [Fact]
    public async Task ValidateAsync_BusinessRuleWarning_NegativeContractAmount()
    {
        using var db = TestDbContextFactory.Create();
        var service = new MigrationAcceleratorService(db);

        var rows = new List<Dictionary<string, string>>
        {
            new() { ["Number"] = "P001", ["Name"] = "Test Project", ["ContractAmount"] = "-5000" },
        };

        var mappings = new List<FieldMapping>
        {
            CreateMapping("Number", "Number", true),
            CreateMapping("Name", "Name", true),
            CreateMapping("ContractAmount", "ContractAmount", false),
        };

        var result = await service.ValidateAsync("project", rows, mappings);

        result.Warnings.Should().Contain(w => w.Stage == "BusinessRule" && w.Message.Contains("negative"));
    }

    [Fact]
    public async Task ValidateAsync_BusinessRuleWarning_StateNotTwoChars()
    {
        using var db = TestDbContextFactory.Create();
        var service = new MigrationAcceleratorService(db);

        var rows = new List<Dictionary<string, string>>
        {
            new() { ["Code"] = "V001", ["Name"] = "Test", ["State"] = "California" },
        };

        var mappings = new List<FieldMapping>
        {
            CreateMapping("Code", "Code", true),
            CreateMapping("Name", "Name", true),
            CreateMapping("State", "State", false),
        };

        var result = await service.ValidateAsync("vendor", rows, mappings);

        result.Warnings.Should().Contain(w => w.Stage == "BusinessRule" && w.Message.Contains("2-character"));
    }

    [Fact]
    public async Task ValidateAsync_DuplicateVendorCodes_ReturnsDuplicateError()
    {
        using var db = TestDbContextFactory.Create();
        var service = new MigrationAcceleratorService(db);

        var rows = new List<Dictionary<string, string>>
        {
            new() { ["Code"] = "V001", ["Name"] = "Vendor A" },
            new() { ["Code"] = "V002", ["Name"] = "Vendor B" },
            new() { ["Code"] = "V001", ["Name"] = "Vendor C" },  // Duplicate
        };

        var mappings = new List<FieldMapping>
        {
            CreateMapping("Code", "Code", true),
            CreateMapping("Name", "Name", true),
        };

        var result = await service.ValidateAsync("vendor", rows, mappings);

        result.Errors.Should().Contain(e => e.Stage == "Duplicate" && e.Message.Contains("V001"));
    }

    [Fact]
    public async Task ValidateAsync_DuplicateEmployeeNumbers_ReturnsDuplicateError()
    {
        using var db = TestDbContextFactory.Create();
        var service = new MigrationAcceleratorService(db);

        var rows = new List<Dictionary<string, string>>
        {
            new() { ["EmpNo"] = "E001", ["First"] = "John", ["Last"] = "Doe" },
            new() { ["EmpNo"] = "E001", ["First"] = "Jane", ["Last"] = "Smith" },
        };

        var mappings = new List<FieldMapping>
        {
            CreateMapping("EmpNo", "EmployeeNumber", true),
            CreateMapping("First", "FirstName", true),
            CreateMapping("Last", "LastName", true),
        };

        var result = await service.ValidateAsync("employee", rows, mappings);

        result.Errors.Should().Contain(e => e.Stage == "Duplicate" && e.Message.Contains("E001"));
    }

    [Fact]
    public async Task ValidateAsync_ValidDatesInMultipleFormats_Pass()
    {
        using var db = TestDbContextFactory.Create();
        var service = new MigrationAcceleratorService(db);

        var rows = new List<Dictionary<string, string>>
        {
            new() { ["EmpNo"] = "E001", ["First"] = "John", ["Last"] = "Doe", ["HireDate"] = "01/15/2025" },
            new() { ["EmpNo"] = "E002", ["First"] = "Jane", ["Last"] = "Smith", ["HireDate"] = "2025-01-15" },
        };

        var mappings = new List<FieldMapping>
        {
            CreateMapping("EmpNo", "EmployeeNumber", true),
            CreateMapping("First", "FirstName", true),
            CreateMapping("Last", "LastName", true),
            CreateMapping("HireDate", "HireDate", false),
        };

        var result = await service.ValidateAsync("employee", rows, mappings);

        result.Errors.Where(e => e.Stage == "Type").Should().BeEmpty();
    }

    // ── Source Profiles ──────────────────────────────────────────────────

    [Fact]
    public void GetSourceProfiles_ReturnsAllProfiles()
    {
        using var db = TestDbContextFactory.Create();
        var service = new MigrationAcceleratorService(db);

        var profiles = service.GetSourceProfiles();

        profiles.Should().HaveCount(5);
        profiles.Should().Contain(p => p.Id == "vista");
        profiles.Should().Contain(p => p.Id == "sage300");
        profiles.Should().Contain(p => p.Id == "foundation");
        profiles.Should().Contain(p => p.Id == "quickbooks");
        profiles.Should().Contain(p => p.Id == "generic");
    }

    [Fact]
    public void GetSourceProfiles_AllHaveSupportedEntityTypes()
    {
        using var db = TestDbContextFactory.Create();
        var service = new MigrationAcceleratorService(db);

        var profiles = service.GetSourceProfiles();

        foreach (var profile in profiles)
        {
            profile.SupportedEntityTypes.Should().NotBeEmpty(
                $"profile '{profile.Id}' should have supported entity types");
            profile.DisplayName.Should().NotBeNullOrWhiteSpace();
            profile.ExportGuide.Should().NotBeNullOrWhiteSpace();
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private static FieldMapping CreateMapping(string sourceColumn, string targetField, bool isRequired)
    {
        return new FieldMapping
        {
            Id = Guid.NewGuid(),
            TenantId = TestDbContextFactory.TestTenantId,
            MigrationProjectId = Guid.NewGuid(),
            EntityType = "test",
            SourceColumn = sourceColumn,
            TargetField = targetField,
            IsRequired = isRequired,
            SortOrder = 0,
        };
    }
}
