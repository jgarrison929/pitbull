# Cost Code Management Design

> **Status:** Draft - Foundation for Time Tracking  
> **Target:** Alpha 0 prerequisite  
> **Priority:** High - Required for time tracking module

## Overview

Cost codes are standardized accounting categories used in construction to track labor, materials, and equipment costs by work type. They enable accurate job costing and integrate with accounting systems like Vista.

**Purpose:**
- Categorize labor hours by work type (concrete, framing, electrical, etc.)
- Enable accurate job costing and budget tracking  
- Standardize cost reporting across projects
- Integrate with Vista and other construction accounting systems

## Industry Standards

### CSI MasterFormat (Most Common)
**Structure:** `Division-Section-Item` (e.g., `03-30-00` for Cast-in-Place Concrete)

**Example CSI Cost Codes:**
```
01-00-00  General Requirements
02-00-00  Existing Conditions  
03-00-00  Concrete
04-00-00  Masonry
05-00-00  Metals
06-00-00  Wood, Plastics, Composites
07-00-00  Thermal and Moisture Protection
08-00-00  Openings
09-00-00  Finishes
```

### Company-Specific Systems
Many contractors use simplified internal systems:
```
100  Site Work
200  Concrete  
300  Framing
400  Roofing
500  MEP
600  Finishes
```

## Domain Model

### Entities

#### `CostCode`
```csharp
public class CostCode : BaseEntity
{
    public Guid CostCodeId { get; set; }
    public string Code { get; set; }           // e.g., "03-30-00" or "200"
    public string Title { get; set; }          // e.g., "Cast-in-Place Concrete"
    public string? Description { get; set; }   // Detailed description
    public CostCodeType Type { get; set; }     // Labor, Material, Equipment, Overhead
    public string? Division { get; set; }      // CSI Division (01-49) or custom grouping
    public decimal? BudgetedRate { get; set; } // Default labor rate for this code
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
    
    // Hierarchy support (optional - for complex cost structures)
    public Guid? ParentCostCodeId { get; set; }
    public CostCode? ParentCostCode { get; set; }
    public List<CostCode> ChildCostCodes { get; set; } = [];
    
    // Usage tracking
    public DateTime? LastUsed { get; set; }
    public int UsageCount { get; set; }
    
    // Navigation
    public List<ProjectCostCode> ProjectCostCodes { get; set; } = [];
    public List<TimeEntry> TimeEntries { get; set; } = [];
}
```

#### `ProjectCostCode` (Project-specific cost code configuration)
```csharp
public class ProjectCostCode : BaseEntity
{
    public Guid ProjectCostCodeId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid CostCodeId { get; set; }
    public decimal BudgetedHours { get; set; }
    public decimal BudgetedAmount { get; set; }
    public decimal? ActualHours { get; set; }    // Calculated from time entries
    public decimal? ActualAmount { get; set; }   // Calculated from time entries
    public bool IsActive { get; set; }           // Can disable codes per project
    public string? ProjectSpecificTitle { get; set; }  // Override title for project
    public string? Notes { get; set; }
    
    // Budget tracking
    public decimal? PercentComplete { get; set; }
    public DateTime? EstimatedStartDate { get; set; }
    public DateTime? EstimatedEndDate { get; set; }
    public DateTime? ActualStartDate { get; set; }    // First time entry
    public DateTime? ActualEndDate { get; set; }      // Last time entry (if complete)
    
    // Navigation
    public Project Project { get; set; } = null!;
    public CostCode CostCode { get; set; } = null!;
}
```

#### `CostCodeTemplate` (Reusable cost code sets)
```csharp
public class CostCodeTemplate : BaseEntity
{
    public Guid CostCodeTemplateId { get; set; }
    public string Name { get; set; }           // e.g., "Commercial Office Building"
    public string? Description { get; set; }
    public ProjectType ProjectType { get; set; } // Commercial, Residential, etc.
    public bool IsDefault { get; set; }
    public bool IsPublic { get; set; }         // Available to all users in tenant
    
    // Navigation
    public List<CostCodeTemplateItem> Items { get; set; } = [];
}

public class CostCodeTemplateItem : BaseEntity
{
    public Guid CostCodeTemplateItemId { get; set; }
    public Guid CostCodeTemplateId { get; set; }
    public Guid CostCodeId { get; set; }
    public decimal? DefaultBudgetedHours { get; set; }
    public decimal? DefaultBudgetedAmount { get; set; }
    public int SortOrder { get; set; }
    
    // Navigation
    public CostCodeTemplate Template { get; set; } = null!;
    public CostCode CostCode { get; set; } = null!;
}
```

### Enums

```csharp
public enum CostCodeType
{
    Labor = 1,
    Material = 2,
    Equipment = 3,
    Subcontract = 4,
    Overhead = 5
}

public enum ProjectType
{
    Commercial = 1,
    Residential = 2,
    Industrial = 3,
    Infrastructure = 4,
    Renovation = 5,
    TenantImprovement = 6
}
```

## API Endpoints

### Cost Code Management

```
GET    /api/costcodes                    # List all cost codes
GET    /api/costcodes/{id}               # Get cost code details
POST   /api/costcodes                    # Create new cost code
PUT    /api/costcodes/{id}               # Update cost code
DELETE /api/costcodes/{id}               # Deactivate cost code

GET    /api/costcodes/search?q={query}   # Search cost codes by title/code
GET    /api/costcodes/divisions          # Get cost codes grouped by division
GET    /api/costcodes/type/{type}        # Get cost codes by type (Labor, Material, etc.)
```

### Project Cost Code Assignment

```
GET    /api/projects/{id}/costcodes         # Get cost codes for project
POST   /api/projects/{id}/costcodes         # Add cost codes to project
PUT    /api/projects/{id}/costcodes/{ccId}  # Update project cost code budget
DELETE /api/projects/{id}/costcodes/{ccId}  # Remove cost code from project

POST   /api/projects/{id}/costcodes/template/{templateId}  # Apply template to project
```

### Cost Code Templates

```
GET    /api/costcode-templates             # List available templates
GET    /api/costcode-templates/{id}        # Get template details
POST   /api/costcode-templates             # Create new template
PUT    /api/costcode-templates/{id}        # Update template
DELETE /api/costcode-templates/{id}        # Delete template

POST   /api/costcode-templates/{id}/copy   # Copy template to create new one
```

### Reporting

```
GET    /api/projects/{id}/costcode-summary  # Budget vs actual by cost code
GET    /api/projects/{id}/costcode-detail   # Detailed cost code breakdown
GET    /api/costcodes/usage-report          # Cost code usage analytics
```

## Standard Cost Code Library

### Default CSI-Based Cost Codes for Pitbull

```typescript
// Default cost codes to seed in new tenants
const DefaultCostCodes = [
  // General Requirements
  { code: "01-10-00", title: "Summary of Work", division: "01" },
  { code: "01-20-00", title: "Price and Payment Procedures", division: "01" },
  { code: "01-30-00", title: "Administrative Requirements", division: "01" },
  { code: "01-40-00", title: "Quality Requirements", division: "01" },
  { code: "01-50-00", title: "Temporary Facilities", division: "01" },
  
  // Site Construction  
  { code: "02-10-00", title: "Subsurface Investigation", division: "02" },
  { code: "02-20-00", title: "Demolition", division: "02" },
  { code: "02-30-00", title: "Site Clearing and Earthwork", division: "02" },
  { code: "02-40-00", title: "Tunneling and Mining", division: "02" },
  { code: "02-50-00", title: "Site Improvements", division: "02" },
  
  // Concrete
  { code: "03-10-00", title: "Concrete Forming", division: "03" },
  { code: "03-20-00", title: "Concrete Reinforcing", division: "03" },
  { code: "03-30-00", title: "Cast-in-Place Concrete", division: "03" },
  { code: "03-40-00", title: "Precast Concrete", division: "03" },
  
  // Masonry
  { code: "04-10-00", title: "Unit Masonry", division: "04" },
  { code: "04-20-00", title: "Stone Assemblies", division: "04" },
  
  // Metals
  { code: "05-10-00", title: "Structural Metal Framing", division: "05" },
  { code: "05-20-00", title: "Metal Joists", division: "05" },
  { code: "05-30-00", title: "Metal Decking", division: "05" },
  
  // Wood & Plastics
  { code: "06-10-00", title: "Rough Carpentry", division: "06" },
  { code: "06-20-00", title: "Finish Carpentry", division: "06" },
  
  // Thermal & Moisture
  { code: "07-10-00", title: "Dampproofing and Waterproofing", division: "07" },
  { code: "07-20-00", title: "Thermal Protection", division: "07" },
  { code: "07-30-00", title: "Steep Slope Roofing", division: "07" },
  { code: "07-40-00", title: "Roofing and Siding Panels", division: "07" },
  
  // Openings
  { code: "08-10-00", title: "Doors and Frames", division: "08" },
  { code: "08-30-00", title: "Specialty Doors", division: "08" },
  { code: "08-50-00", title: "Windows", division: "08" },
  
  // Finishes
  { code: "09-10-00", title: "Plaster and Gypsum Board", division: "09" },
  { code: "09-30-00", title: "Tiling", division: "09" },
  { code: "09-50-00", title: "Ceilings", division: "09" },
  { code: "09-60-00", title: "Flooring", division: "09" },
  { code: "09-90-00", title: "Painting and Coating", division: "09" },
  
  // Specialties (common ones)
  { code: "10-20-00", title: "Interior Specialties", division: "10" },
  { code: "10-40-00", title: "Safety Specialties", division: "10" },
  
  // Equipment (as needed)
  { code: "11-10-00", title: "Vehicle Service Equipment", division: "11" },
  
  // Furnishings (minimal)
  { code: "12-10-00", title: "Art", division: "12" },
  
  // Special Construction
  { code: "13-10-00", title: "Special Facility Components", division: "13" },
  
  // Conveying Equipment
  { code: "14-20-00", title: "Elevators", division: "14" },
  
  // Fire Suppression
  { code: "21-10-00", title: "Water-Based Fire-Suppression Systems", division: "21" },
  
  // Plumbing
  { code: "22-10-00", title: "Plumbing Piping", division: "22" },
  { code: "22-30-00", title: "Plumbing Equipment", division: "22" },
  { code: "22-40-00", title: "Plumbing Fixtures", division: "22" },
  
  // HVAC
  { code: "23-05-00", title: "Common Work Results for HVAC", division: "23" },
  { code: "23-20-00", title: "HVAC Piping and Pumps", division: "23" },
  { code: "23-30-00", title: "HVAC Air Distribution", division: "23" },
  { code: "23-50-00", title: "Central Heating Equipment", division: "23" },
  { code: "23-80-00", title: "Decentralized Energy Equipment", division: "23" },
  
  // Integrated Automation
  { code: "25-10-00", title: "Integrated Automation Facility Controls", division: "25" },
  
  // Electrical
  { code: "26-05-00", title: "Common Work Results for Electrical", division: "26" },
  { code: "26-20-00", title: "Low-Voltage Electrical Transmission", division: "26" },
  { code: "26-30-00", title: "Facility Electrical Power Generating", division: "26" },
  { code: "26-40-00", title: "Electrical and Cathodic Protection", division: "26" },
  { code: "26-50-00", title: "Lighting", division: "26" },
  
  // Communications
  { code: "27-10-00", title: "Structured Cabling", division: "27" },
  { code: "27-20-00", title: "Data Communications", division: "27" },
  { code: "27-30-00", title: "Voice Communications", division: "27" },
  { code: "27-40-00", title: "Audio-Video Communications", division: "27" },
  
  // Electronic Safety & Security
  { code: "28-10-00", title: "Electronic Access Control", division: "28" },
  { code: "28-20-00", title: "Electronic Surveillance", division: "28" },
  { code: "28-30-00", title: "Electronic Detection and Alarm", division: "28" },
];
```

## Business Rules

### Cost Code Management Rules
1. **Unique Codes:** Cost code `Code` must be unique within tenant
2. **Deactivation Only:** Cost codes cannot be deleted if used in time entries
3. **Hierarchy Depth:** Maximum 3 levels of cost code hierarchy
4. **Code Format:** Enforce consistent format (configurable per tenant)
5. **Required Fields:** Code and Title are always required

### Project Assignment Rules
1. **Active Codes Only:** Only active cost codes can be added to projects
2. **Budget Validation:** Budgeted amounts must be positive
3. **Template Application:** Applying template replaces existing cost codes
4. **Usage Protection:** Cannot remove cost codes with actual time entries
5. **Automatic Creation:** ProjectCostCode created when first time entry recorded

### Template Rules
1. **Template Scope:** Templates can be private (user) or public (tenant)
2. **Default Template:** Each project type can have one default template
3. **Template Validation:** All cost codes in template must be active
4. **Copy Protection:** Cannot modify public templates (copy first)
5. **Usage Tracking:** Track which projects use each template

## Database Schema

### Key Indexes
```sql
-- Performance optimization for common queries
CREATE UNIQUE INDEX IX_CostCode_Code ON CostCode(TenantId, Code);
CREATE INDEX IX_CostCode_Division_Active ON CostCode(Division, IsActive);
CREATE INDEX IX_CostCode_Type_Active ON CostCode(Type, IsActive);
CREATE INDEX IX_CostCode_LastUsed ON CostCode(LastUsed DESC) WHERE IsActive = true;

CREATE UNIQUE INDEX IX_ProjectCostCode_Project_Code ON ProjectCostCode(ProjectId, CostCodeId);
CREATE INDEX IX_ProjectCostCode_Project_Active ON ProjectCostCode(ProjectId, IsActive);

CREATE INDEX IX_CostCodeTemplate_ProjectType_IsDefault ON CostCodeTemplate(ProjectType, IsDefault);
```

### Data Migration Strategy
```sql
-- Migration script to populate default cost codes for existing tenants
INSERT INTO CostCode (TenantId, Code, Title, Division, Type, IsActive, SortOrder)
SELECT 
    t.TenantId,
    dc.Code,
    dc.Title, 
    dc.Division,
    'Labor',
    true,
    ROW_NUMBER() OVER (ORDER BY dc.Code)
FROM Tenant t
CROSS JOIN @DefaultCostCodes dc
WHERE NOT EXISTS (
    SELECT 1 FROM CostCode cc 
    WHERE cc.TenantId = t.TenantId AND cc.Code = dc.Code
);
```

## Frontend Components

### Cost Code Selection
```typescript
// Searchable cost code dropdown for time entry
interface CostCodeSelectorProps {
  projectId: string;
  selectedCodeId?: string;
  onSelect: (costCode: CostCode) => void;
  filterByType?: CostCodeType;
  showDescriptions?: boolean;
}

// Grouped cost code list (by division)
interface CostCodeListProps {
  costCodes: CostCode[];
  groupBy: 'division' | 'type';
  showUsageCount?: boolean;
  onEdit?: (costCode: CostCode) => void;
}
```

### Project Setup
```typescript
// Cost code assignment to project
interface ProjectCostCodeSetupProps {
  project: Project;
  availableTemplates: CostCodeTemplate[];
  onApplyTemplate: (templateId: string) => void;
  onCustomAssignment: (costCodeIds: string[]) => void;
}

// Budget entry for cost codes
interface CostCodeBudgetProps {
  projectCostCodes: ProjectCostCode[];
  onUpdateBudget: (ccId: string, hours: number, amount: number) => void;
}
```

### Management Interface
```typescript
// Cost code creation/editing
interface CostCodeFormProps {
  costCode?: CostCode;
  onSave: (costCode: CostCodeInput) => void;
  onCancel: () => void;
}

// Template management
interface TemplateManagementProps {
  templates: CostCodeTemplate[];
  onCreateTemplate: (name: string, projectType: ProjectType) => void;
  onEditTemplate: (template: CostCodeTemplate) => void;
}
```

## Implementation Plan

### Phase 1: Core Cost Code Management
- [ ] CostCode entity and basic CRUD operations
- [ ] Default cost code library seeding
- [ ] Cost code search and filtering
- [ ] Basic management interface

**Target:** Cost codes can be created and managed

### Phase 2: Project Integration  
- [ ] ProjectCostCode entity and relationships
- [ ] Project cost code assignment API
- [ ] Cost code selection UI for projects
- [ ] Budget tracking foundation

**Target:** Projects can have assigned cost codes with budgets

### Phase 3: Templates and Automation
- [ ] CostCodeTemplate entities and management
- [ ] Template application to projects
- [ ] Default templates for common project types
- [ ] Template sharing and copying

**Target:** Quick project setup using templates

### Phase 4: Reporting and Analytics
- [ ] Cost code usage reporting
- [ ] Budget vs actual tracking
- [ ] Performance analytics
- [ ] Integration with time tracking

**Target:** Complete cost code analytics and reporting

## Integration Points

### Time Tracking Module
- Cost codes required for all time entries
- Real-time budget vs actual calculations
- Cost code validation during time entry

### Project Management
- Cost code budgets roll up to project budgets
- Phase-based cost code grouping
- Progress tracking by cost code

### Reporting System
- Standard cost reports by division/type
- Budget variance analysis
- Cost code performance metrics

### External Systems
- Vista export with proper cost code mapping
- QuickBooks integration (future)
- Excel import/export for bulk operations

## Success Metrics

### Alpha 0 Acceptance Criteria
- [ ] 100+ standard cost codes available out-of-box
- [ ] Projects can be assigned cost codes in <2 minutes
- [ ] Time entries validate against project cost codes
- [ ] Cost code search returns results in <1 second
- [ ] Templates reduce project setup time by 80%

### Performance Targets
- Cost code search: <500ms
- Project cost code assignment: <2 seconds  
- Template application: <5 seconds
- Cost code list loading: <1 second
- Budget calculation: <100ms

---

**Next Steps:**
1. Create CostCode module directory structure
2. Implement CostCode and ProjectCostCode entities
3. Seed default cost code library
4. Build cost code management API
5. Create cost code selection UI components

**Dependencies:**
- Project entity (already exists)
- Multi-tenant data model (already exists) 
- User authorization system (already exists)