# Time Tracking Module Design

> **Status:** Draft - Planning for Alpha 0 (v0.50)  
> **Target:** February 21, 2026 delivery  
> **Priority:** High - Core Alpha 0 functionality

## Overview

The Time Tracking module enables construction workers to log hours against specific jobs and cost codes, with an approval workflow for foremen/supers and cost rollup reporting for project managers.

**Core Workflow:**
1. Workers enter daily time by job/cost code (mobile-friendly)
2. Foremen/supers approve time entries
3. System calculates labor cost (base rate + burden)
4. PMs view cost rollup by job/cost code
5. Export to Vista-compatible format

## Domain Model

### Entities

#### `Employee`
```csharp
public class Employee : BaseEntity
{
    public Guid EmployeeId { get; set; }
    public string EmployeeNumber { get; set; }  // Company employee #
    public string FirstName { get; set; }
    public string LastName { get; set; }
    public string Email { get; set; }
    public decimal BaseHourlyRate { get; set; }
    public decimal BurdenRate { get; set; }     // Multiplier (e.g., 1.35 for 35% burden)
    public EmployeeRole Role { get; set; }      // Worker, Foreman, Superintendent, PM
    public bool IsActive { get; set; }
    
    // Navigation
    public List<TimeEntry> TimeEntries { get; set; } = [];
    public List<TimeApproval> ApprovalsGiven { get; set; } = [];
}
```

#### `TimeEntry`
```csharp
public class TimeEntry : BaseEntity
{
    public Guid TimeEntryId { get; set; }
    public Guid EmployeeId { get; set; }
    public Guid ProjectId { get; set; }
    public string CostCode { get; set; }        // Links to project cost codes
    public DateOnly WorkDate { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public decimal HoursWorked { get; set; }    // Calculated from start/end
    public string? Description { get; set; }    // Optional work description
    public TimeEntryStatus Status { get; set; } // Draft, Submitted, Approved, Rejected
    public string? Notes { get; set; }          // Worker notes
    
    // Approval tracking
    public Guid? ApprovedByEmployeeId { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? ApprovalNotes { get; set; }
    
    // Cost calculation (populated on approval)
    public decimal? BaseCost { get; set; }      // Hours * BaseHourlyRate
    public decimal? BurdenCost { get; set; }    // BaseCost * BurdenRate
    public decimal? TotalCost { get; set; }     // BaseCost + BurdenCost
    
    // Navigation
    public Employee Employee { get; set; } = null!;
    public Project Project { get; set; } = null!;
    public Employee? ApprovedBy { get; set; }
}
```

#### `TimeApproval` (Audit Trail)
```csharp
public class TimeApproval : BaseEntity
{
    public Guid TimeApprovalId { get; set; }
    public Guid TimeEntryId { get; set; }
    public Guid ApprovedByEmployeeId { get; set; }
    public DateTime ApprovalDate { get; set; }
    public TimeApprovalAction Action { get; set; } // Approved, Rejected, Modified
    public string? Comments { get; set; }
    public decimal? OriginalHours { get; set; }    // For modification tracking
    public decimal? ApprovedHours { get; set; }
    
    // Navigation
    public TimeEntry TimeEntry { get; set; } = null!;
    public Employee ApprovedBy { get; set; } = null!;
}
```

### Enums

```csharp
public enum EmployeeRole
{
    Worker = 1,
    Foreman = 2,
    Superintendent = 3,
    ProjectManager = 4,
    Administrator = 5
}

public enum TimeEntryStatus
{
    Draft = 1,      // Being edited by worker
    Submitted = 2,  // Ready for approval
    Approved = 3,   // Approved by foreman/super
    Rejected = 4    // Rejected, needs rework
}

public enum TimeApprovalAction
{
    Approved = 1,
    Rejected = 2,
    Modified = 3    // Approved with hour changes
}
```

## API Endpoints

### Time Entry Management

```
GET    /api/timeentries                    # List time entries (filtered by user role)
GET    /api/timeentries/{id}               # Get time entry details
POST   /api/timeentries                    # Create new time entry
PUT    /api/timeentries/{id}               # Update time entry (if not approved)
DELETE /api/timeentries/{id}               # Delete time entry (if not approved)

GET    /api/timeentries/week/{date}        # Get week view for time entry
POST   /api/timeentries/submit/{id}        # Submit time entry for approval
```

### Approval Workflow

```
GET    /api/timeentries/pending-approval   # List time entries pending approval
POST   /api/timeentries/{id}/approve       # Approve time entry
POST   /api/timeentries/{id}/reject        # Reject time entry
POST   /api/timeentries/{id}/modify        # Approve with modifications
```

### Reporting

```
GET    /api/timereports/job-cost-summary   # Cost rollup by job
GET    /api/timereports/employee-hours     # Hours by employee
GET    /api/timereports/cost-code-detail   # Detailed cost code breakdown
```

### Export

```
GET    /api/timeexport/vista               # Vista-compatible CSV export
GET    /api/timeexport/payroll             # Payroll system export
```

## Database Schema

### Key Relationships
- `Employee` 1:N `TimeEntry` (employee can have many time entries)
- `Project` 1:N `TimeEntry` (project can have many time entries)
- `TimeEntry` 1:N `TimeApproval` (maintains approval audit trail)
- `Employee` 1:N `TimeApproval` as approver

### Indexes for Performance
```sql
-- Query optimization for common patterns
CREATE INDEX IX_TimeEntry_EmployeeId_WorkDate ON TimeEntry(EmployeeId, WorkDate);
CREATE INDEX IX_TimeEntry_ProjectId_Status ON TimeEntry(ProjectId, Status);
CREATE INDEX IX_TimeEntry_Status_ApprovedByEmployeeId ON TimeEntry(Status, ApprovedByEmployeeId);
CREATE INDEX IX_TimeEntry_WorkDate_Status ON TimeEntry(WorkDate, Status) WHERE Status IN (2, 3); -- Submitted, Approved
```

## Business Rules

### Time Entry Rules
1. **Daily Limit:** Maximum 24 hours per day per employee
2. **Overlap Prevention:** No overlapping time entries for same employee/day
3. **Edit Window:** Time entries can only be edited within 7 days of work date
4. **Approval Required:** All time entries must be approved before cost calculation
5. **Cost Code Validation:** Cost codes must exist on the associated project

### Approval Rules
1. **Role Authorization:** Only Foremen, Supers, PMs can approve time
2. **Project Access:** Approvers must have access to the project
3. **Self-Approval:** Employees cannot approve their own time entries
4. **Approval Window:** Time entries must be approved within 30 days
5. **Modification Audit:** All hour modifications must be documented

### Cost Calculation Rules
1. **Base Cost:** `Hours * Employee.BaseHourlyRate`
2. **Burden Cost:** `BaseCost * (Employee.BurdenRate - 1)`
3. **Total Cost:** `BaseCost + BurdenCost`
4. **Recalculation:** Costs recalculated if hours modified during approval
5. **Freeze Rule:** Costs frozen once exported to Vista

## Security & Authorization

### Role-Based Access Control (RBAC)

#### Worker
- Create/edit own time entries (draft status only)
- Submit time entries for approval
- View own time entry history
- **Cannot:** Approve time, view other employee time, modify approved entries

#### Foreman
- All Worker permissions
- Approve/reject time entries for assigned crew
- Modify hours during approval (with audit trail)
- View time summary for managed employees
- **Cannot:** Access other foremen's crews, export data

#### Superintendent  
- All Foreman permissions
- Approve time for all project employees
- View project-wide time and cost reports
- **Cannot:** Access other projects, export system-wide data

#### Project Manager
- View all time and cost data for assigned projects
- Generate project reports and exports
- Override approvals (with audit trail)
- **Cannot:** Enter time for others, access other projects

#### Administrator
- Full system access
- User management and role assignment
- System-wide reporting and exports
- Configuration management

### Data Isolation
- **Tenant-Level:** All time data isolated by tenant (RLS)
- **Project-Level:** Users only see time for projects they have access to
- **Employee-Level:** Workers only see their own time entries

## Frontend Components

### Mobile Time Entry Interface
**Priority: High** - Primary user interface

```typescript
// Weekly timesheet view optimized for mobile
interface WeeklyTimesheetProps {
  employee: Employee;
  weekStartDate: Date;
  projects: Project[];
  onSave: (timeEntries: TimeEntryInput[]) => void;
}

// Daily time entry form
interface DailyTimeEntryProps {
  workDate: Date;
  projects: Project[];
  existingEntries: TimeEntry[];
  onAddEntry: (entry: TimeEntryInput) => void;
}
```

### Approval Dashboard
**Priority: Medium** - Supervisor interface

```typescript
// Pending approvals list
interface ApprovalQueueProps {
  pendingEntries: TimeEntry[];
  onApprove: (entryId: string, hours?: number) => void;
  onReject: (entryId: string, reason: string) => void;
}

// Batch approval for efficiency
interface BatchApprovalProps {
  selectedEntries: TimeEntry[];
  onBatchApprove: (entryIds: string[]) => void;
}
```

### Reporting Interface
**Priority: Medium** - Management reports

```typescript
// Job cost summary report
interface JobCostReportProps {
  projects: Project[];
  dateRange: DateRange;
  groupBy: 'costCode' | 'employee' | 'date';
}

// Export interface
interface ExportControlsProps {
  exportType: 'vista' | 'payroll' | 'excel';
  dateRange: DateRange;
  projects?: Project[];
}
```

## Implementation Plan

### Phase 1: Core Time Entry (Week 1)
- [ ] Employee and TimeEntry entities
- [ ] Basic CRUD API endpoints
- [ ] Mobile-friendly time entry form
- [ ] Weekly timesheet view
- [ ] Basic validation and business rules

**Target:** Workers can enter and save time entries

### Phase 2: Approval Workflow (Week 1-2)
- [ ] TimeApproval entity and audit trail
- [ ] Approval API endpoints
- [ ] Role-based authorization
- [ ] Approval dashboard for supervisors
- [ ] Status management and notifications

**Target:** Complete approval workflow functional

### Phase 3: Cost Calculation & Reporting (Week 2)
- [ ] Cost calculation engine
- [ ] Job cost summary reports
- [ ] Employee hours reporting
- [ ] Cost code detail breakdown
- [ ] Performance optimization

**Target:** Accurate cost tracking and basic reports

### Phase 4: Export & Integration (Week 3)
- [ ] Vista export format research
- [ ] CSV export implementation
- [ ] Export scheduling and automation
- [ ] Data validation for exports
- [ ] Integration testing

**Target:** Vista-compatible export working

## Testing Strategy

### Unit Tests
- Business rule validation
- Cost calculation accuracy  
- Authorization logic
- Data model constraints

### Integration Tests
- API endpoint workflows
- Database transaction integrity
- Role-based access control
- Export file generation

### Performance Tests
- Large dataset handling (1000+ employees)
- Concurrent time entry submission
- Report generation speed
- Export file size limits

### UAT Scenarios
1. **Daily Time Entry:** Worker enters time for multiple jobs
2. **Approval Flow:** Foreman reviews and approves team time
3. **Cost Tracking:** PM views labor costs by project phase
4. **Export Process:** Generate weekly timesheet for Vista
5. **Mobile Usage:** Complete workflow on tablet/phone

## Technical Considerations

### Performance
- **Pagination:** Large time entry lists for busy projects
- **Caching:** Cache employee rates and project cost codes
- **Batch Operations:** Bulk approval and export processing
- **Database Optimization:** Proper indexing for time-based queries

### Scalability
- **Tenant Isolation:** Support multiple construction companies
- **Data Archival:** Move old time entries to archive tables
- **API Rate Limiting:** Prevent abuse of export endpoints
- **Background Processing:** Async export generation

### Data Integrity
- **Audit Trail:** Complete history of all time entry changes
- **Backup Strategy:** Regular backups before export processing
- **Validation:** Cross-validation of hours vs. project schedules
- **Error Recovery:** Handle partial failures gracefully

## Success Metrics

### Alpha 0 Acceptance Criteria
- [ ] 50+ time entries processed without data loss
- [ ] Approval workflow completes in <30 seconds
- [ ] Mobile time entry works on iOS/Android tablets
- [ ] Cost calculations accurate to within $0.01
- [ ] Vista export file format validated
- [ ] Multi-tenant isolation verified

### Performance Targets
- Time entry save: <2 seconds
- Approval processing: <5 seconds
- Weekly report generation: <10 seconds
- Export file creation: <30 seconds
- Mobile page load: <3 seconds

---

**Next Steps:**
1. Create TimeTracking module directory structure
2. Implement Employee and TimeEntry entities
3. Set up basic CRUD API endpoints
4. Build mobile-first time entry interface
5. Begin approval workflow implementation

**Dependencies:**
- Project and cost code data model (already exists)
- User authentication and authorization (already exists)
- Multi-tenant data isolation (already exists)
- Mobile-responsive UI framework (already exists)