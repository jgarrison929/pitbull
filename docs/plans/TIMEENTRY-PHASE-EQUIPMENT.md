# Plan: Time Entry Phase Codes & Equipment Tracking

**Date:** 2026-02-13
**Status:** Ready for Implementation
**Branch:** `feature/timeentry-phase-equipment` (off `feature/multi-company`)

## Goal

Add optional Phase and Equipment tracking to time entries so job cost reports break down labor and equipment by project phase. This is foundational for construction job costing - PMs need to see "this phase cost $X in labor and $Y in equipment."

## Context

### Business Reality (from Josh/Lyles)
- Workers may split across **multiple projects in one day** (one entry per project/cost code/phase combo)
- Foremen enter time for crews remotely (30-45 min to 3 hours from PM's office)
- Lyles operates across Fresno, Visalia, Bakersfield, Rocklin, Sacramento, Union City, Temecula, Murrieta
- PMs manage multiple smaller jobs with several crews each
- Phase and equipment must be trackable per time entry for accurate job costing
- Equipment hours charged to specific jobs/phases for utilization and billing (especially T&M contracts)

### Existing Model
- `TimeEntry` has: Date, EmployeeId, ProjectId, CostCodeId, hours (Reg/OT/DT), Description, Status
- `Phase` already exists in Projects module: Name, CostCode, BudgetAmount, ActualCost, Status
- `CostCode` has `CostType` enum including `Equipment = 3`
- `BatchCreateTimeEntries` exists for foreman crew entry
- Unique constraint: `(Date, EmployeeId, ProjectId, CostCodeId)` - needs updating

## Design

### 1. Equipment Entity (New - Core Module)

```csharp
// Pitbull.Core/Domain/Equipment.cs
public class Equipment : BaseEntity
{
    public string Code { get; set; } = string.Empty;        // e.g. "EX-001", "CR-003"
    public string Name { get; set; } = string.Empty;        // "CAT 320 Excavator"
    public string? Description { get; set; }
    public EquipmentType Type { get; set; }
    public decimal HourlyRate { get; set; }                 // Internal charge rate
    public decimal? BillingRate { get; set; }               // T&M billing rate (may differ)
    public bool IsActive { get; set; } = true;
    public string? SerialNumber { get; set; }
    public string? LicensePlate { get; set; }
}

public enum EquipmentType
{
    HeavyEquipment = 0,   // Excavators, loaders, dozers
    LightEquipment = 1,   // Compactors, generators, pumps  
    Vehicles = 2,         // Trucks, trailers
    Tools = 3,            // Concrete saws, welders
    Other = 4
}
```

**Why tenant-scoped (not company-scoped):** Equipment is shared across companies like employees. A CAT 320 doesn't belong to one legal entity - it moves between jobsites across companies.

### 2. TimeEntry Changes

Add two optional fields to `TimeEntry`:

```csharp
// New fields on TimeEntry
public Guid? PhaseId { get; set; }           // Optional - which project phase
public Guid? EquipmentId { get; set; }       // Optional - equipment used
public decimal EquipmentHours { get; set; }  // Hours equipment was used (may differ from labor hours)

// Navigation
public Phase? Phase { get; set; }
public Equipment? Equipment { get; set; }
```

**PhaseId** is optional because:
- Not all projects have phases defined yet
- Some entries are general/overhead
- Backward compatible with existing data

**EquipmentHours** separate from labor hours because:
- A crew of 4 might use one excavator for 6 hours while they each work 8
- Equipment hours ≠ labor hours

### 3. Unique Constraint Update

Current: `(Date, EmployeeId, ProjectId, CostCodeId)` - UNIQUE

New: `(Date, EmployeeId, ProjectId, CostCodeId, PhaseId)` - UNIQUE

This allows the same employee to log time on different phases of the same project/cost code on the same day. PhaseId=null is treated as a distinct value by PostgreSQL for unique indexes, which is correct behavior.

### 4. API Changes

#### Create/Update TimeEntry
Add optional fields to commands:
```csharp
public record CreateTimeEntryCommand(
    DateOnly Date,
    Guid EmployeeId,
    Guid ProjectId,
    Guid CostCodeId,
    decimal RegularHours,
    decimal OvertimeHours = 0,
    decimal DoubletimeHours = 0,
    string? Description = null,
    Guid? PhaseId = null,           // NEW
    Guid? EquipmentId = null,       // NEW
    decimal EquipmentHours = 0      // NEW
) : ICommand<TimeEntryDto>;
```

Same for `BatchTimeEntryItem`.

#### TimeEntryDto
Add to response:
```csharp
Guid? PhaseId,
string? PhaseName,
Guid? EquipmentId,
string? EquipmentName,
string? EquipmentCode,
decimal EquipmentHours
```

#### New Equipment CRUD Endpoints
```
GET    /api/equipment          - List equipment (with filters)
GET    /api/equipment/{id}     - Get equipment by ID
POST   /api/equipment          - Create equipment
PUT    /api/equipment/{id}     - Update equipment
DELETE /api/equipment/{id}     - Soft delete equipment
```

#### Validation Rules
- If PhaseId provided, must belong to the same ProjectId
- If EquipmentId provided, must exist and be active
- EquipmentHours >= 0, max 24
- EquipmentHours can only be set if EquipmentId is provided

### 5. EF Configuration Updates

```csharp
// TimeEntryConfiguration additions
builder.Property(te => te.EquipmentHours)
    .HasPrecision(5, 2)
    .HasDefaultValue(0m);

builder.HasOne(te => te.Phase)
    .WithMany()
    .HasForeignKey(te => te.PhaseId)
    .OnDelete(DeleteBehavior.Restrict);

builder.HasOne(te => te.Equipment)
    .WithMany()
    .HasForeignKey(te => te.EquipmentId)
    .OnDelete(DeleteBehavior.Restrict);

// Update unique index
builder.HasIndex(te => new { te.Date, te.EmployeeId, te.ProjectId, te.CostCodeId, te.PhaseId })
    .IsUnique()
    .HasDatabaseName("IX_time_entries_unique_daily_entry");
```

### 6. Migration

```sql
-- Add columns
ALTER TABLE time_entries ADD COLUMN "PhaseId" uuid NULL;
ALTER TABLE time_entries ADD COLUMN "EquipmentId" uuid NULL;
ALTER TABLE time_entries ADD COLUMN "EquipmentHours" numeric(5,2) NOT NULL DEFAULT 0;

-- Add FKs
ALTER TABLE time_entries ADD CONSTRAINT "FK_time_entries_phases" 
    FOREIGN KEY ("PhaseId") REFERENCES phases("Id") ON DELETE RESTRICT;
ALTER TABLE time_entries ADD CONSTRAINT "FK_time_entries_equipment" 
    FOREIGN KEY ("EquipmentId") REFERENCES equipment("Id") ON DELETE RESTRICT;

-- Drop old unique index, create new one
DROP INDEX "IX_time_entries_unique_daily_entry";
CREATE UNIQUE INDEX "IX_time_entries_unique_daily_entry" 
    ON time_entries ("Date", "EmployeeId", "ProjectId", "CostCodeId", "PhaseId");

-- Equipment table
CREATE TABLE equipment (
    "Id" uuid PRIMARY KEY,
    "TenantId" uuid NOT NULL,
    "Code" varchar(50) NOT NULL,
    "Name" varchar(200) NOT NULL,
    "Description" varchar(500),
    "Type" int NOT NULL DEFAULT 0,
    "HourlyRate" numeric(10,2) NOT NULL DEFAULT 0,
    "BillingRate" numeric(10,2),
    "IsActive" boolean NOT NULL DEFAULT true,
    "SerialNumber" varchar(100),
    "LicensePlate" varchar(50),
    "CreatedAt" timestamptz NOT NULL DEFAULT now(),
    "UpdatedAt" timestamptz,
    "IsDeleted" boolean NOT NULL DEFAULT false,
    "xmin" xid
);

-- RLS on equipment
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY equipment_tenant_policy ON equipment
    USING ("TenantId" = current_setting('app.tenant_id')::uuid);

-- Index
CREATE INDEX "IX_equipment_tenant_active" ON equipment ("TenantId", "IsActive");
CREATE UNIQUE INDEX "IX_equipment_tenant_code" ON equipment ("TenantId", "Code") WHERE NOT "IsDeleted";
```

### 7. Reports Impact

**Labor Cost Report** - Group by Phase within Project:
```
Project 2024-001: Highway Widening
  Phase: Earthwork (03-100)
    Labor: 240 hrs / $18,500
    Equipment: CAT 320 - 80 hrs / $12,000
  Phase: Concrete (03-300)
    Labor: 160 hrs / $12,200
    Equipment: Pump Truck - 40 hrs / $6,000
```

**Vista Export** - Add Phase and Equipment columns to CSV

### 8. Frontend (DO NOT IMPLEMENT - already handled separately)

Frontend work will be done in a separate pass. Backend team should NOT touch any .tsx/.ts files.

## Files to Create/Modify

### New Files
- `src/Modules/Pitbull.Core/Domain/Equipment.cs`
- `src/Modules/Pitbull.Core/Data/EquipmentConfiguration.cs`
- `src/Pitbull.Api/Controllers/EquipmentController.cs`
- `src/Modules/Pitbull.Core/Features/Equipment/` (CRUD commands/queries/DTOs)
- `src/Pitbull.Api/Migrations/YYYYMMDD_AddPhaseEquipmentToTimeEntry.cs`

### Modified Files
- `src/Modules/Pitbull.TimeTracking/Domain/TimeEntry.cs` - Add PhaseId, EquipmentId, EquipmentHours
- `src/Modules/Pitbull.TimeTracking/Data/TimeEntryConfiguration.cs` - FK + index changes
- `src/Modules/Pitbull.TimeTracking/Features/TimeEntryDto.cs` - Add phase/equipment fields
- `src/Modules/Pitbull.TimeTracking/Features/TimeEntryMapper.cs` - Map new fields
- `src/Modules/Pitbull.TimeTracking/Features/CreateTimeEntry/CreateTimeEntryCommand.cs` - Add params
- `src/Modules/Pitbull.TimeTracking/Features/CreateTimeEntry/CreateTimeEntryValidator.cs` - New rules
- `src/Modules/Pitbull.TimeTracking/Features/BatchCreateTimeEntries/BatchCreateTimeEntriesCommand.cs` - Add params
- `src/Modules/Pitbull.TimeTracking/Features/BatchCreateTimeEntries/BatchCreateTimeEntriesValidator.cs` - New rules
- `src/Modules/Pitbull.TimeTracking/Features/UpdateTimeEntry/UpdateTimeEntryCommand.cs` - Add params
- `src/Modules/Pitbull.TimeTracking/Features/UpdateTimeEntry/UpdateTimeEntryValidator.cs` - New rules
- `src/Modules/Pitbull.TimeTracking/Services/TimeEntryService.cs` - Validation + includes
- `src/Modules/Pitbull.TimeTracking/Features/ExportVistaTimesheet/ExportVistaTimesheetQuery.cs` - Add columns
- `src/Modules/Pitbull.TimeTracking/Features/GetLaborCostReport/GetLaborCostReportQuery.cs` - Phase grouping
- `src/Pitbull.Api/Controllers/TimeTrackingController.cs` - Accept new params
- `src/Modules/Pitbull.Core/Data/PitbullDbContext.cs` - Add DbSet<Equipment>

### Tests
- Unit tests for Equipment CRUD validation
- Unit tests for TimeEntry phase validation (must match project)
- Unit tests for equipment hours validation
- Integration tests for Equipment CRUD
- Integration tests for TimeEntry with phase/equipment
- Integration test for labor cost report with phase grouping
- Integration test for Vista export with new columns

## Estimated Scope
- ~15-20 files modified/created
- ~500-800 lines new code
- ~200-300 lines test code
- 1 EF migration

## Success Criteria
1. Time entries can optionally include PhaseId and EquipmentId
2. Equipment CRUD works with RLS
3. PhaseId validated against project's phases
4. Labor cost report groups by phase
5. Vista export includes phase and equipment columns
6. All existing tests still pass
7. Batch entry supports phase/equipment
8. No frontend files touched
