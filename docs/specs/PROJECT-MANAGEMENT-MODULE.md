# Project Management Module Specification

**Version:** 1.0 Draft  
**Date:** February 16, 2026  
**Status:** Phase A Design Complete (Spec Only)  
**Module:** `Pitbull.ProjectManagement`

## 1. Scope and Goals

This specification defines the full data model and API surface for a new `Pitbull.ProjectManagement` module that unifies 13 PM capabilities under a project context:

1. Schedule Management
2. Job Costing
3. RFIs Enhancement
4. Submittals
5. Plans & Specifications
6. Communications Log
7. Daily Reports
8. Progress Entry
9. Revenue & Cost Projections
10. Meeting Coordination
11. Document Generation
12. Task Assignments
13. Project Narratives

This is **design only**. No implementation, migrations, or runtime changes are included in this phase.

## 2. Architecture Alignment

### 2.1 Existing Patterns to Preserve

- Entity base: all new entities inherit `BaseEntity` (`Id`, `TenantId`, audit fields, `IsDeleted` soft delete).
- Multi-company isolation: all new PM entities implement `ICompanyScoped` and include `CompanyId`.
- Query filtering: rely on global `PitbullDbContext` filters (tenant + company + soft delete).
- Concurrency: use PostgreSQL `xmin` concurrency token on mutable aggregates.
- API style: REST controllers in `src/Pitbull.Api/Controllers/`, service interfaces in module `Services/`, paginated list responses using `PagedResult<T>`.
- Validation and service orchestration follow existing direct-service pattern (`ProjectService`, `RfiService`, `TimeEntryService`).

### 2.2 Cross-Module Reuse (Do Not Duplicate)

- `Pitbull.Projects`: remains system-of-record for project header (`Project`, `Phase`, `ProjectBudget`, `Projection`).
- `Pitbull.RFIs`: enhanced in-place with additional relational entities and endpoints.
- `Pitbull.Contracts`: source of approved/pending COs and subcontract commitments.
- `Pitbull.TimeTracking`: source of actual labor hours/cost and crew/equipment presence.
- `Pitbull.Core`: source of `CostCode`, `Equipment`, users/tenant/company context.
- `Pitbull.Documents`: currently scaffolding only (`.csproj`). PM module will include its own document storage entities and storage-provider abstraction (no SharePoint/external DMS integrations).

## 3. Module Boundaries

### 3.1 New Module

- `src/Modules/Pitbull.ProjectManagement/`
  - `Domain/`
  - `Data/`
  - `Features/`
  - `Services/`

### 3.2 Existing Module Enhancements

- `Pitbull.RFIs`: add child entities for attachments and distribution recipients.
- `Pitbull.Projects`: add lightweight navigation properties only where needed (optional, non-breaking).

## 4. Domain Model (Complete)

All entities below inherit `BaseEntity` and implement `ICompanyScoped` unless noted.

### 4.1 Schedule Management

Design note:
- Delay tracking and contract-aware notification intelligence are deferred to a future AI integration phase. When a delay is logged, AI will read contract obligations and surface required notification recipients and notice periods.

#### `PmSchedule`
- Purpose: One active schedule per project, with optional baselines.
- Fields:
  - `ProjectId`, `CompanyId`
  - `Name`, `Description`
  - `Status` (`ScheduleStatus`)
  - `DataDate` (status date)
  - `CalendarType` (`ScheduleCalendarType`)
  - `ImportedFrom` (`ScheduleImportSource`)
  - `LastCriticalPathRunAt`
- Relationships:
  - 1:N `PmScheduleActivity`
  - 1:N `PmScheduleBaseline`
  - 1:N `PmScheduleCalendarException`

#### `PmScheduleActivity`
- Purpose: WBS/activity node for Gantt and CPM.
- Fields:
  - `ScheduleId`, `ProjectId`
  - `ParentActivityId` (WBS tree)
  - `WbsCode`, `ActivityCode`, `Name`
  - `ActivityType` (`ScheduleActivityType`)
  - `Status` (`ScheduleActivityStatus`)
  - `OriginalDurationDays`, `RemainingDurationDays`
  - `PlannedStart`, `PlannedFinish`
  - `EarlyStart`, `EarlyFinish`, `LateStart`, `LateFinish`
  - `ActualStart`, `ActualFinish`
  - `TotalFloatDays`, `FreeFloatDays`
  - `PercentComplete`
  - `IsCritical`
  - `CostCodeId` (nullable for WBS summary)
  - `PhaseId` (nullable link to `Projects.Phase`)
- Relationships:
  - Self tree: parent/children
  - N:N resources via `PmScheduleResourceAssignment`
  - N:N dependencies via `PmScheduleDependency`

#### `PmScheduleDependency`
- Fields:
  - `ScheduleId`, `PredecessorActivityId`, `SuccessorActivityId`
  - `DependencyType` (`ScheduleDependencyType`: FS/FF/SS/SF)
  - `LagDays` (negative allowed for lead)

#### `PmScheduleBaseline`
- Purpose: Baseline snapshot for variance.
- Fields:
  - `ScheduleId`, `ProjectId`
  - `Name`, `BaselineType` (`ScheduleBaselineType`)
  - `CapturedAt`, `CapturedByUserId`
  - `SourceVersion`
- Child: `PmScheduleBaselineActivity`

#### `PmScheduleBaselineActivity`
- Fields:
  - `BaselineId`, `ActivityId`
  - `BaselineStart`, `BaselineFinish`, `BaselineDurationDays`

#### `PmScheduleResourceAssignment`
- Fields:
  - `ActivityId`
  - `ResourceType` (`ScheduleResourceType`: Crew/Equipment/Subcontract)
  - `EmployeeId` (nullable), `EquipmentId` (nullable), `SubcontractId` (nullable)
  - `PlannedUnits`, `ActualUnits`
  - `PlannedHours`, `ActualHours`

#### `PmScheduleCalendarException`
- Fields:
  - `ScheduleId`, `Date`, `ExceptionType` (`CalendarExceptionType`), `WorkHours`

#### `PmScheduleImportLog`
- Fields:
  - `ProjectId`, `ScheduleId`
  - `ImportSource` (`ScheduleImportSource`: CSV/P6Xml/MSProject)
  - `ImportedAt`, `ImportedByUserId`
  - `Status` (`ImportStatus`)
  - `FileName`, `RowsProcessed`, `RowsFailed`
  - `ErrorSummary`

Import scope note:
- MVP supports CSV imports only.
- P6 XML import is planned for a later phase.
- MS Project conversion is future scope.

### 4.2 Job Costing

Cost code setup note:
- Cost code display supports two company-level modes via setting toggle:
  - `Flat`: all cost codes displayed at the same level.
  - `DivisionGrouped`: cost codes organized under CSI division hierarchy.
- UI must explain both modes in plain language at the setting and selection surfaces.

#### `PmJobCostBudget`
- Purpose: Budget by cost code and phase.
- Fields:
  - `ProjectId`, `CostCodeId`, `PhaseId` (nullable)
  - `OriginalBudget`, `ApprovedBudgetChanges`, `CurrentBudget`
  - `BudgetUnits`, `UnitOfMeasure`
  - `BudgetUnitCost`
  - `LaborBurdenRate`

#### `PmJobCostActual`
- Purpose: Materialized periodic actuals by source.
- Fields:
  - `ProjectId`, `CostCodeId`, `PhaseId` (nullable)
  - `AsOfDate`
  - `LaborCost`, `MaterialCost`, `EquipmentCost`, `SubcontractCost`, `OtherCost`
  - `TotalActualCost`
  - `SourceType` (`JobCostSourceType`: TimeEntries/PO/Subcontract/Manual)
  - `SourceReferenceId` (nullable)

#### `PmJobCostCommitment`
- Purpose: Committed but not fully billed cost.
- Fields:
  - `ProjectId`, `CostCodeId`, `PhaseId` (nullable)
  - `CommitmentType` (`CommitmentType`: Subcontract/PO/Other)
  - `ReferenceId` (`SubcontractId`/future PO id)
  - `OriginalCommittedAmount`, `ApprovedChangesAmount`, `CurrentCommittedAmount`
  - `BilledToDate`, `PaidToDate`, `RemainingCommitted`
  - `Status` (`CommitmentStatus`)

#### `PmJobCostForecast`
- Purpose: PM estimate-at-completion inputs and outputs by cost bucket.
- Fields:
  - `ProjectId`, `CostCodeId`, `PhaseId` (nullable)
  - `ForecastPeriod` (month start)
  - `ActualToDate`, `CommittedToDate`, `CostToComplete`
  - `EstimatedFinalCost` (EFC)
  - `VarianceToBudget`
  - `ForecastConfidence` (`ForecastConfidenceLevel`)
  - `Notes`

#### `PmJobCostUnitProgress`
- Purpose: Unit production and unit cost tracking.
- Fields:
  - `ProjectId`, `CostCodeId`, `PhaseId` (nullable)
  - `PeriodDate`
  - `InstalledQuantity`, `InstalledUnit`
  - `CumulativeQuantity`
  - `CumulativeCost`
  - `CostPerUnit`

### 4.3 RFIs Enhancements (existing module extension)

#### Extend `Rfi` (existing)
- Keep current fields.
- Add:
  - `RequiredResponseDate` (alias/replace semantics for current `DueDate`)
  - `OfficialResponseDate`
  - `DistributionStatus` (`RfiDistributionStatus`)

#### `RfiDistributionRecipient`
- Fields:
  - `RfiId`
  - `RecipientType` (`DistributionRecipientType`: To/CC/BCC)
  - `RecipientUserId` (nullable), `RecipientName`, `RecipientEmail`
  - `SentAt`, `AcknowledgedAt`

#### `RfiAttachment`
- Fields:
  - `RfiId`, `DocumentId`
  - `DocumentRole` (`RfiAttachmentRole`: QuestionSupport/Response/Reference)
  - `FileName`, `MimeType`, `FileSizeBytes`, `RevisionTag`

#### `RfiCostImpactLink`
- Fields:
  - `RfiId`
  - `CostCodeId` (nullable)
  - `ChangeOrderId` (nullable)
  - `ImpactType` (`RfiImpactType`: Cost/Schedule/Both)
  - `EstimatedCost`, `EstimatedDays`
  - `ApprovedCost`, `ApprovedDays`

### 4.4 Submittals

Design notes:
- Submittal statuses are aligned to AIA/CSI industry-standard workflow semantics.
- Future AI integration will analyze submittal content for cost implications and automatically flag potential budget impacts.

#### `PmSubmittal`
- Fields:
  - `ProjectId`
  - `SubmittalNumber` (sequential per project)
  - `Title`, `Description`
  - `SpecSectionCode`, `SpecSectionTitle`
  - `SubmittalType` (`SubmittalType`)
  - `Status` (`SubmittalStatus`)
  - `RequiredByDate`, `SubmittedDate`, `ReturnedDate`, `FinalDueDate`
  - `ScheduleActivityId` (nullable)
  - `IsSubstitutionRequest`
  - `RevisionNumber`

#### `PmSubmittalWorkflowEvent`
- Fields:
  - `SubmittalId`
  - `EventType` (`SubmittalWorkflowEventType`)
  - `FromStatus`, `ToStatus`
  - `ActionByUserId`, `ActionAt`
  - `Comments`

#### `PmSubmittalAttachment`
- Fields:
  - `SubmittalId`, `DocumentId`
  - `DocumentRole` (`SubmittalAttachmentRole`)
  - `FileName`, `RevisionTag`

### 4.5 Plans & Specifications (Document Management)

#### `PmDocumentFolder`
- Purpose: project document library tree.
- Fields:
  - `ProjectId`
  - `ParentFolderId` (nullable)
  - `Name`
  - `FolderType` (`ProjectFolderType`: Plans/Specs/Contracts/Correspondence/Photos/Reports/Custom)
  - `SortOrder`

#### `PmPlanSet`
- Fields:
  - `ProjectId`
  - `Name`, `Discipline` (`PlanDiscipline`)
  - `IssueDate`
  - `Revision` (`PlanRevisionType`)
  - `Status` (`PlanSetStatus`)

#### `PmPlanSheet`
- Fields:
  - `PlanSetId`, `ProjectId`
  - `DrawingNumber`, `Title`, `Discipline`
  - `CurrentRevision`, `Scale`
  - `DocumentId`

#### `PmPlanSheetRevision`
- Fields:
  - `PlanSheetId`
  - `RevisionNumber`, `RevisionDate`
  - `RevisionDescription`
  - `DocumentId`
  - `IssuedByUserId`

#### `PmSpecSection`
- Fields:
  - `ProjectId`
  - `DivisionCode`, `SectionCode`, `Title`
  - `CsiEdition`
  - `CurrentRevision`
  - `DocumentId`

#### `PmSpecSectionRevision`
- Fields:
  - `SpecSectionId`
  - `RevisionNumber`, `RevisionDate`, `Summary`
  - `DocumentId`

#### `PmDocumentDistribution`
- Fields:
  - `ProjectId`
  - `DocumentType` (`DistributionDocumentType`: PlanSheet/SpecSection/General)
  - `ReferenceId` (sheet/spec/document link)
  - `RecipientUserId` (nullable), `RecipientName`, `RecipientEmail`
  - `SentAt`, `AcknowledgedAt`
  - `DistributionMethod` (`DistributionMethod`)

### 4.6 Communications Log

#### `PmCommunication`
- Fields:
  - `ProjectId`
  - `CommunicationType` (`CommunicationType`: Letter/Email/Memo/PhoneLog)
  - `Direction` (`CommunicationDirection`: Incoming/Outgoing)
  - `Subject`, `Body`
  - `FromName`, `FromEmail`, `ToName`, `ToEmail`
  - `ReferenceType` (`CommunicationReferenceType`: General/RFI/Submittal/ChangeOrder/Task)
  - `ReferenceId` (nullable)
  - `FollowUpDate` (nullable)
  - `Status` (`CommunicationStatus`)

#### `PmCommunicationAttachment`
- Fields:
  - `CommunicationId`, `DocumentId`
  - `FileName`, `MimeType`

### 4.7 Daily Reports

#### `PmDailyReport`
- Fields:
  - `ProjectId`
  - `ReportDate`
  - `ReportType` (`DailyReportType`: Foreman/PM)
  - `Status` (`DailyReportStatus`)
  - `WeatherSummary`
  - `TemperatureLow`, `TemperatureHigh`
  - `Precipitation`, `Wind`
  - `WorkNarrative`
  - `DelaysNarrative`
  - `SafetyNarrative`
  - `PreparedByUserId`

#### `PmDailyReportCrew`
- Fields:
  - `DailyReportId`
  - `CompanyName`
  - `Trade`
  - `HeadCount`
  - `HoursWorked`

Tracking note:
- Initial implementation tracks company/trade headcount.
- Schema is designed to support future customizable crew tracking methods per company setting.

#### `PmDailyReportEquipment`
- Fields:
  - `DailyReportId`
  - `EquipmentId` (nullable)
  - `EquipmentName`
  - `HoursUsed`

#### `PmDailyReportVisitor`
- Fields:
  - `DailyReportId`
  - `Name`, `Company`, `Purpose`, `TimeIn`, `TimeOut`

#### `PmDailyReportSafetyIncident`
- Fields:
  - `DailyReportId`
  - `IncidentType` (`SafetyIncidentType`)
  - `Description`
  - `Severity` (`SafetySeverity`)
  - `ReportedTo`

#### `PmDailyReportDelivery`
- Fields:
  - `DailyReportId`
  - `VendorName`
  - `MaterialDescription`
  - `Quantity`, `Unit`
  - `RelatedCostCodeId` (nullable)

#### `PmDailyReportPhoto`
- Fields:
  - `DailyReportId`, `DocumentId`
  - `Caption`, `TakenAt`, `TakenByUserId`
  - `Latitude`, `Longitude` (nullable)

#### `PmDailyReportRollup`
- Purpose: links foreman reports rolled into PM report.
- Fields:
  - `ParentDailyReportId` (PM)
  - `ChildDailyReportId` (Foreman)

### 4.8 Progress Entry

#### `PmProgressEntry`
- Fields:
  - `ProjectId`
  - `ProgressDate`
  - `EnteredByUserId`
  - `EntryType` (`ProgressEntryType`: Activity/CostCode/Quantity/EarnedValue)
  - `Status` (`ProgressEntryStatus`)

#### `PmActivityProgress`
- Fields:
  - `ProgressEntryId`
  - `ScheduleActivityId`
  - `PercentComplete`
  - `InstalledQuantity`, `Unit`
  - `EarnedHours`

#### `PmCostCodeProgress`
- Fields:
  - `ProgressEntryId`
  - `CostCodeId`, `PhaseId` (nullable)
  - `PercentComplete`
  - `EarnedValueAmount`

#### `PmEarnedValueSnapshot`
- Fields:
  - `ProjectId`
  - `SnapshotDate`
  - `BCWS`, `BCWP`, `ACWP`
  - `CPI`, `SPI`
  - `EstimateAtCompletion`, `VarianceAtCompletion`

#### `PmSCurvePoint`
- Fields:
  - `ProjectId`
  - `CurveDate`
  - `PlannedPercent`, `ActualPercent`, `EarnedPercent`

#### `PmProgressTimeEntryLink`
- Fields:
  - `ProgressEntryId`
  - `TimeEntryId`

### 4.9 Revenue & Cost Projections

#### `PmMonthlyProjection`
- Fields:
  - `ProjectId`
  - `ProjectionMonth` (1st day of month)
  - `ContractValueOriginal`
  - `ApprovedChangeOrders`
  - `PendingChangeOrders`
  - `AdjustedContractValue`
  - `RevenueRecognizedToDate`
  - `PercentComplete`
  - `ProjectedFinalRevenue`
  - `ProjectedFinalCost`
  - `ProjectedMargin`
  - `ProjectionStatus` (`ProjectionStatus`: Draft/Submitted/Approved/Locked)
  - `PreparedByUserId`, `ReviewedByUserId` (nullable)
  - `Notes`

#### `PmProjectionCostCode`
- Fields:
  - `MonthlyProjectionId`
  - `CostCodeId`, `PhaseId` (nullable)
  - `OriginalBudget`, `CurrentBudget`, `EAC`, `Variance`

### 4.10 Meeting Coordination

#### `PmMeetingSeries`
- Fields:
  - `ProjectId`
  - `MeetingType` (`MeetingType`: OAC/Subcontractor/Safety/Progress/Other)
  - `Title`
  - `RecurrenceRule` (iCal RRULE string)
  - `StartDate`, `EndDate` (nullable)
  - `IsActive`

#### `PmMeeting`
- Fields:
  - `ProjectId`, `MeetingSeriesId` (nullable)
  - `MeetingType`
  - `Title`, `Location`, `VirtualMeetingUrl`
  - `ScheduledStart`, `ScheduledEnd`
  - `ActualStart`, `ActualEnd`
  - `Status` (`MeetingStatus`)
  - `AgendaTemplateId` (nullable)

#### `PmMeetingAgendaItem`
- Fields:
  - `MeetingId`
  - `ItemNumber`, `Topic`, `Description`
  - `PresenterUserId` (nullable)

#### `PmMeetingMinute`
- Fields:
  - `MeetingId`
  - `MinuteText`
  - `RecordedByUserId`
  - `VersionNumber`

#### `PmMeetingActionItem`
- Fields:
  - `MeetingId`
  - `Description`
  - `AssigneeUserId` (nullable), `AssigneeName`
  - `DueDate`
  - `Priority` (`TaskPriority`)
  - `Status` (`TaskStatus`)
  - `ClosedAt`

#### `PmMeetingAttachment`
- Fields:
  - `MeetingId`, `DocumentId`
  - `AttachmentRole` (`MeetingAttachmentRole`)

### 4.11 Document Generation

#### `PmDocumentTemplate`
- Fields:
  - `CompanyId`
  - `TemplateType` (`GeneratedDocumentType`: Transmittal/MeetingMinutes/DailyReport/Letter/Narrative)
  - `Name`, `Description`
  - `Engine` (`TemplateEngineType`: Razor/Handlebars)
  - `BodyTemplate`
  - `HeaderTemplate` (nullable)
  - `FooterTemplate` (nullable)
  - `IsDefault`
  - `Version`

#### `PmGeneratedDocument`
- Fields:
  - `ProjectId`
  - `TemplateId`
  - `DocumentType` (`GeneratedDocumentType`)
  - `ReferenceType` (`GeneratedDocumentReferenceType`)
  - `ReferenceId` (nullable)
  - `GeneratedAt`, `GeneratedByUserId`
  - `OutputFormat` (`GeneratedOutputFormat`: Pdf/Docx)
  - `DocumentId`
  - `MergeDataJson`
  - `LetterheadConfigId` (nullable)

#### `PmLetterheadConfig`
- Fields:
  - `CompanyId`
  - `Name`
  - `LogoDocumentId` (nullable)
  - `PrimaryColor`, `SecondaryColor`
  - `AddressBlock`, `Phone`, `Email`, `Website`
  - `IsDefault`

### 4.12 Task Assignments

#### `PmTask`
- Fields:
  - `ProjectId` (nullable for cross-project personal tasks)
  - `Title`, `Description`
  - `TaskType` (`TaskType`: General/RFI/Submittal/MeetingAction/DailyReport/Narrative)
  - `Priority` (`TaskPriority`)
  - `Status` (`TaskStatus`)
  - `AssignedByUserId`
  - `AssignedToUserId` (nullable), `AssignedToName`
  - `DueDate`, `StartedAt`, `CompletedAt`
  - `ReferenceType` (`TaskReferenceType`)
  - `ReferenceId` (nullable)

#### `PmTaskComment`
- Fields:
  - `TaskId`
  - `Comment`
  - `CommentedByUserId`
  - `CommentedAt`

### 4.13 Project Narratives

#### `PmProjectNarrative`
- Fields:
  - `ProjectId`
  - `NarrativeMonth` (month start)
  - `Status` (`NarrativeStatus`)
  - `TemplateId` (nullable)
  - `ExecutiveSummary`
  - `KeyAccomplishments`
  - `UpcomingMilestones`
  - `RisksAndConcerns`
  - `FinancialSummary`
  - `ScheduleSummary`
  - `GeneratedDraftText` (nullable)
  - `FinalizedAt` (nullable)
  - `PreparedByUserId`

#### `PmProjectNarrativeRevision`
- Fields:
  - `NarrativeId`
  - `RevisionNumber`
  - `ContentSnapshotJson`
  - `RevisedByUserId`
  - `RevisedAt`
  - `RevisionNote`

### 4.14 Document Storage

Document storage architecture notes:
- Build Pitbull-owned document storage layer (no external document system integrations; no SharePoint dependency).
- Supported deployment options:
  - On-prem customer-hosted storage.
  - Pitbull Cloud storage (Railway deployment, managed by Pitbull).

#### `PmDocument`
- Fields:
  - `Id`
  - `TenantId`
  - `CompanyId`
  - `ProjectId`
  - `FileName`
  - `MimeType`
  - `FileSizeBytes`
  - `StoragePath`
  - `StorageProvider` (`DocumentStorageProvider`: LocalFileSystem/S3Compatible/AzureBlob)
  - `Checksum`
  - `UploadedByUserId`
  - `UploadedAt`

#### `PmDocumentVersion`
- Fields:
  - `DocumentId`
  - `VersionNumber`
  - `StoragePath`
  - `FileSizeBytes`
  - `UploadedByUserId`
  - `UploadedAt`
  - `ChangeNote`

## 5. Key Relationships (Cross-Module)

- `Project (Projects)` 1:N all PM entities with `ProjectId`.
- `CostCode (Core)` linked by budget/actual/progress/projections and RFI cost links.
- `Phase (Projects)` optional for cost and progress granularity.
- `TimeEntry (TimeTracking)` used for:
  - Job cost labor actuals
  - Progress links (`PmProgressTimeEntryLink`)
  - Daily rollups (crew/equipment)
- `Subcontract/ChangeOrder (Contracts)` used for:
  - Commitments and approved CO rollups
  - RFI cost linkage via `OriginatingRfiId` and `RfiCostImpactLink`
- `Rfi (RFIs)` enhanced with distributions, attachments, and structured impact links.

## 6. Enum Catalog

### 6.1 Schedule
- `ScheduleStatus`: `Draft`, `Active`, `Baselined`, `Archived`
- `ScheduleCalendarType`: `Standard5x8`, `Standard6x10`, `Custom`
- `ScheduleImportSource`: `Csv`, `P6Xml`, `MsProject`
- `ScheduleActivityType`: `Wbs`, `Task`, `Milestone`
- `ScheduleActivityStatus`: `NotStarted`, `InProgress`, `Completed`, `OnHold`
- `ScheduleDependencyType`: `FS`, `FF`, `SS`, `SF`
- `ScheduleBaselineType`: `Initial`, `ApprovedRevision`, `Recovery`
- `ScheduleResourceType`: `Crew`, `Equipment`, `Subcontract`
- `CalendarExceptionType`: `Holiday`, `WeatherShutdown`, `CompanyShutdown`, `Custom`
- `ImportStatus`: `Queued`, `Processing`, `Succeeded`, `PartialSuccess`, `Failed`

### 6.2 Job Cost and Forecasting
- `JobCostSourceType`: `TimeEntries`, `PurchaseOrder`, `Subcontract`, `ManualAdjustment`
- `CommitmentType`: `Subcontract`, `PurchaseOrder`, `Other`
- `CommitmentStatus`: `Draft`, `Approved`, `PartiallyInvoiced`, `Closed`
- `ForecastConfidenceLevel`: `Low`, `Medium`, `High`

### 6.3 RFIs and Submittals
- `RfiDistributionStatus`: `NotSent`, `PartiallySent`, `Sent`, `Acknowledged`
- `DistributionRecipientType`: `To`, `Cc`, `Bcc`
- `RfiAttachmentRole`: `QuestionSupport`, `Response`, `Reference`
- `RfiImpactType`: `Cost`, `Schedule`, `CostAndSchedule`
- `SubmittalType`: `ProductData`, `ShopDrawing`, `Sample`, `Mockup`, `Closeout`, `Other`
- `SubmittalStatus`: `Draft`, `Submitted`, `InReview`, `Approved`, `ApprovedAsNoted`, `ReviseAndResubmit`, `Rejected`, `Closed`
- `SubmittalWorkflowEventType`: `Created`, `Submitted`, `Reviewed`, `Returned`, `Approved`, `Rejected`, `ReviseAndResubmit`, `Closed`
- `SubmittalAttachmentRole`: `Primary`, `Supporting`, `Response`, `Reference`

### 6.4 Documents and Communications
- `DocumentStorageProvider`: `LocalFileSystem`, `S3Compatible`, `AzureBlob`
- `ProjectFolderType`: `Plans`, `Specs`, `Contracts`, `Correspondence`, `Photos`, `Reports`, `Custom`
- `PlanDiscipline`: `Architectural`, `Structural`, `Civil`, `Mechanical`, `Electrical`, `Plumbing`, `FireProtection`, `Other`
- `PlanRevisionType`: `IFC`, `Bulletin`, `ASI`, `Addendum`, `RecordDrawing`, `Other`
- `PlanSetStatus`: `Draft`, `Issued`, `Superseded`, `Archived`
- `DistributionDocumentType`: `PlanSheet`, `SpecSection`, `GeneralDocument`
- `DistributionMethod`: `Email`, `DownloadLink`, `PortalNotification`, `Printed`
- `CommunicationType`: `Letter`, `Email`, `Memo`, `PhoneLog`
- `CommunicationDirection`: `Incoming`, `Outgoing`
- `CommunicationReferenceType`: `General`, `Rfi`, `Submittal`, `ChangeOrder`, `Task`
- `CommunicationStatus`: `Open`, `FollowUpRequired`, `Closed`

### 6.5 Daily/Progress/Projection
- `DailyReportType`: `Foreman`, `ProjectManager`
- `DailyReportStatus`: `Draft`, `Submitted`, `Approved`, `Locked`
- `SafetyIncidentType`: `Injury`, `NearMiss`, `PropertyDamage`, `Observation`
- `SafetySeverity`: `Low`, `Moderate`, `High`, `Critical`
- `ProgressEntryType`: `Activity`, `CostCode`, `Quantity`, `EarnedValue`
- `ProgressEntryStatus`: `Draft`, `Submitted`, `Approved`, `Rejected`
- `ProjectionStatus`: `Draft`, `Submitted`, `Approved`, `Locked`

### 6.6 Meetings, Tasks, Narratives, Generation
- `MeetingType`: `Oac`, `Subcontractor`, `Safety`, `Progress`, `Other`
- `MeetingStatus`: `Scheduled`, `InProgress`, `Completed`, `Canceled`
- `TaskType`: `General`, `Rfi`, `Submittal`, `MeetingAction`, `DailyReport`, `Narrative`
- `TaskPriority`: `Low`, `Normal`, `High`, `Urgent`
- `TaskStatus`: `Open`, `InProgress`, `Blocked`, `Complete`, `Canceled`
- `MeetingAttachmentRole`: `Agenda`, `Minutes`, `Reference`
- `GeneratedDocumentType`: `Transmittal`, `MeetingMinutes`, `DailyReport`, `Letter`, `Narrative`
- `GeneratedDocumentReferenceType`: `Project`, `Rfi`, `Submittal`, `Meeting`, `DailyReport`, `Narrative`, `Task`
- `GeneratedOutputFormat`: `Pdf`, `Docx`
- `TemplateEngineType`: `Razor`, `Handlebars`
- `NarrativeStatus`: `Draft`, `Submitted`, `Approved`, `Published`

## 7. API Surface (Complete)

Route prefix pattern:
- Project-scoped resources: `/api/projects/{projectId:guid}/...`
- Cross-project personal work queues: `/api/project-management/...`

All list endpoints support:
- `page`, `pageSize` using `PaginationQuery` semantics.
- module-specific filter params.
- standard `PagedResult<T>` response.

### 7.1 Schedule APIs

- `POST /api/projects/{projectId}/schedules`
- `GET /api/projects/{projectId}/schedules/{scheduleId}`
- `GET /api/projects/{projectId}/schedules`
- `PUT /api/projects/{projectId}/schedules/{scheduleId}`
- `DELETE /api/projects/{projectId}/schedules/{scheduleId}` (soft)
- `POST /api/projects/{projectId}/schedules/{scheduleId}/activities`
- `PUT /api/projects/{projectId}/schedules/{scheduleId}/activities/{activityId}`
- `POST /api/projects/{projectId}/schedules/{scheduleId}/dependencies`
- `DELETE /api/projects/{projectId}/schedules/{scheduleId}/dependencies/{dependencyId}`
- `POST /api/projects/{projectId}/schedules/{scheduleId}/baseline`
- `GET /api/projects/{projectId}/schedules/{scheduleId}/variance`
- `POST /api/projects/{projectId}/schedules/{scheduleId}/critical-path/recalculate`
- `POST /api/projects/{projectId}/schedules/import` (MVP: CSV only)
- `GET /api/projects/{projectId}/schedules/imports`

### 7.2 Job Cost APIs

- `POST /api/projects/{projectId}/job-cost/budgets`
- `PUT /api/projects/{projectId}/job-cost/budgets/{budgetId}`
- `GET /api/projects/{projectId}/job-cost/budgets`
- `GET /api/projects/{projectId}/job-cost/actuals?asOfDate=...`
- `POST /api/projects/{projectId}/job-cost/actuals/rebuild`
- `GET /api/projects/{projectId}/job-cost/commitments`
- `POST /api/projects/{projectId}/job-cost/commitments`
- `GET /api/projects/{projectId}/job-cost/forecasts`
- `POST /api/projects/{projectId}/job-cost/forecasts`
- `GET /api/projects/{projectId}/job-cost/analysis/over-under`
- `GET /api/projects/{projectId}/job-cost/unit-costs`

### 7.3 RFI Enhancement APIs

Existing:
- `GET/POST/PUT /api/projects/{projectId}/rfis...`

Additions:
- `POST /api/projects/{projectId}/rfis/{rfiId}/attachments`
- `GET /api/projects/{projectId}/rfis/{rfiId}/attachments`
- `DELETE /api/projects/{projectId}/rfis/{rfiId}/attachments/{attachmentId}`
- `POST /api/projects/{projectId}/rfis/{rfiId}/distribution`
- `GET /api/projects/{projectId}/rfis/{rfiId}/distribution`
- `POST /api/projects/{projectId}/rfis/{rfiId}/cost-links`
- `PUT /api/projects/{projectId}/rfis/{rfiId}/cost-links/{linkId}`
- `GET /api/projects/{projectId}/rfis/{rfiId}/cost-links`

### 7.4 Submittal APIs

- `POST /api/projects/{projectId}/submittals`
- `GET /api/projects/{projectId}/submittals/{submittalId}`
- `GET /api/projects/{projectId}/submittals`
- `PUT /api/projects/{projectId}/submittals/{submittalId}`
- `POST /api/projects/{projectId}/submittals/{submittalId}/workflow`
- `POST /api/projects/{projectId}/submittals/{submittalId}/attachments`
- `GET /api/projects/{projectId}/submittals/register`

### 7.5 Plans & Specs APIs

- `GET /api/projects/{projectId}/documents/folders`
- `POST /api/projects/{projectId}/documents/folders`
- `POST /api/projects/{projectId}/plan-sets`
- `GET /api/projects/{projectId}/plan-sets`
- `GET /api/projects/{projectId}/plan-sets/{planSetId}`
- `POST /api/projects/{projectId}/plan-sets/{planSetId}/sheets`
- `POST /api/projects/{projectId}/plan-sheets/{sheetId}/revisions`
- `GET /api/projects/{projectId}/spec-sections`
- `POST /api/projects/{projectId}/spec-sections`
- `POST /api/projects/{projectId}/spec-sections/{specSectionId}/revisions`
- `POST /api/projects/{projectId}/document-distributions`
- `GET /api/projects/{projectId}/document-distributions`

### 7.6 Communications APIs

- `POST /api/projects/{projectId}/communications`
- `GET /api/projects/{projectId}/communications/{communicationId}`
- `GET /api/projects/{projectId}/communications`
- `PUT /api/projects/{projectId}/communications/{communicationId}`
- `POST /api/projects/{projectId}/communications/{communicationId}/attachments`

### 7.7 Daily Report APIs

- `POST /api/projects/{projectId}/daily-reports`
- `GET /api/projects/{projectId}/daily-reports/{dailyReportId}`
- `GET /api/projects/{projectId}/daily-reports`
- `PUT /api/projects/{projectId}/daily-reports/{dailyReportId}`
- `POST /api/projects/{projectId}/daily-reports/{dailyReportId}/submit`
- `POST /api/projects/{projectId}/daily-reports/{dailyReportId}/approve`
- `POST /api/projects/{projectId}/daily-reports/{dailyReportId}/photos`
- `POST /api/projects/{projectId}/daily-reports/{dailyReportId}/rollup`

### 7.8 Progress APIs

- `POST /api/projects/{projectId}/progress-entries`
- `GET /api/projects/{projectId}/progress-entries/{progressEntryId}`
- `GET /api/projects/{projectId}/progress-entries`
- `PUT /api/projects/{projectId}/progress-entries/{progressEntryId}`
- `POST /api/projects/{projectId}/progress-entries/{progressEntryId}/approve`
- `POST /api/projects/{projectId}/progress-entries/{progressEntryId}/time-links`
- `GET /api/projects/{projectId}/earned-value/snapshots`
- `GET /api/projects/{projectId}/s-curve`

### 7.9 Revenue & Cost Projection APIs

- `POST /api/projects/{projectId}/monthly-projections`
- `GET /api/projects/{projectId}/monthly-projections/{projectionId}`
- `GET /api/projects/{projectId}/monthly-projections`
- `PUT /api/projects/{projectId}/monthly-projections/{projectionId}`
- `POST /api/projects/{projectId}/monthly-projections/{projectionId}/submit`
- `POST /api/projects/{projectId}/monthly-projections/{projectionId}/approve`
- `GET /api/projects/{projectId}/projection-variance`

### 7.10 Meeting APIs

- `POST /api/projects/{projectId}/meeting-series`
- `GET /api/projects/{projectId}/meeting-series`
- `POST /api/projects/{projectId}/meetings`
- `GET /api/projects/{projectId}/meetings/{meetingId}`
- `GET /api/projects/{projectId}/meetings`
- `PUT /api/projects/{projectId}/meetings/{meetingId}`
- `POST /api/projects/{projectId}/meetings/{meetingId}/agenda-items`
- `POST /api/projects/{projectId}/meetings/{meetingId}/minutes`
- `POST /api/projects/{projectId}/meetings/{meetingId}/action-items`
- `PUT /api/projects/{projectId}/meetings/{meetingId}/action-items/{actionItemId}`

### 7.11 Document Generation APIs

- `POST /api/projects/{projectId}/document-templates`
- `GET /api/projects/{projectId}/document-templates`
- `POST /api/projects/{projectId}/documents/generate`
- `GET /api/projects/{projectId}/generated-documents/{generatedDocumentId}`
- `GET /api/projects/{projectId}/generated-documents`
- `POST /api/companies/{companyId}/letterheads`
- `GET /api/companies/{companyId}/letterheads`

### 7.12 Task APIs

- `POST /api/projects/{projectId}/tasks`
- `GET /api/projects/{projectId}/tasks/{taskId}`
- `GET /api/projects/{projectId}/tasks`
- `PUT /api/projects/{projectId}/tasks/{taskId}`
- `POST /api/projects/{projectId}/tasks/{taskId}/comments`
- `GET /api/project-management/tasks/my` (cross-project dashboard)

### 7.13 Narrative APIs

- `POST /api/projects/{projectId}/narratives`
- `GET /api/projects/{projectId}/narratives/{narrativeId}`
- `GET /api/projects/{projectId}/narratives`
- `PUT /api/projects/{projectId}/narratives/{narrativeId}`
- `POST /api/projects/{projectId}/narratives/{narrativeId}/submit`
- `POST /api/projects/{projectId}/narratives/{narrativeId}/publish`
- `GET /api/projects/{projectId}/narratives/{narrativeId}/revisions`

## 8. DTO Shapes (Canonical)

All request DTOs follow command-style records already used in the codebase.

### 8.1 List Query Contract

- Common query members:
  - `Page`, `PageSize` inherited from `PaginationQuery`.
  - Module-specific filters:
    - date ranges (`startDate`, `endDate`)
    - status enums
    - related IDs (`costCodeId`, `phaseId`, `assigneeId`)
    - full-text `search`

### 8.2 Response Contract

- Detail endpoints: strongly typed DTO per aggregate (`ScheduleDto`, `SubmittalDto`, etc.).
- List endpoints: `PagedResult<TDto>`.
- Aggregate analytics endpoints: purpose-built DTOs (`JobCostSummaryDto`, `EarnedValueDto`, `ProjectionVarianceDto`).

### 8.3 Concurrency Contract

- Mutable major aggregates include an `ETag`/`xmin` token in response.
- Update commands include expected token.
- Conflict returns `409` with code `CONFLICT`.

## 9. Data Integrity and Indexing Plan

### 9.1 Required Unique Constraints

- Schedule:
  - `PmSchedule`: unique active schedule name per project (`TenantId`,`CompanyId`,`ProjectId`,`Name`,`IsDeleted=false`).
  - `PmScheduleActivity`: unique (`ScheduleId`,`ActivityCode`).
- Submittals:
  - `PmSubmittal`: unique (`TenantId`,`ProjectId`,`SubmittalNumber`).
- Plans/specs:
  - `PmPlanSheet`: unique (`PlanSetId`,`DrawingNumber`,`CurrentRevision`).
  - `PmSpecSection`: unique (`ProjectId`,`SectionCode`,`CurrentRevision`).
- Daily reports:
  - one PM daily report per (`ProjectId`,`ReportDate`,`ReportType=ProjectManager`).
- Narratives:
  - unique (`ProjectId`,`NarrativeMonth`).

### 9.2 High-Value Query Indexes

- all tables: (`TenantId`), (`CompanyId`) automatically aligned with global filtering.
- project feeds: (`ProjectId`,`CreatedAt DESC`).
- status queues: (`ProjectId`,`Status`,`DueDate`).
- schedule charts: (`ScheduleId`,`ParentActivityId`,`SortOrder`).
- costing rollups: (`ProjectId`,`CostCodeId`,`PhaseId`,`AsOfDate`).
- task dashboard: (`AssignedToUserId`,`Status`,`DueDate`).

### 9.3 Rollup Strategy

- Start with transactional tables + on-demand query aggregation.
- Add materialized views after baseline profiling for:
  - project job-cost summary (`budget vs actual vs committed vs EFC`)
  - earned value and S-curve datasets

## 10. Workflow and State Rules

- `SubmittalStatus` transitions:
  - `Draft -> Submitted -> InReview -> Approved|ApprovedAsNoted|ReviseAndResubmit|Rejected -> Closed`
- `DailyReportStatus`:
  - `Draft -> Submitted -> Approved -> Locked`
- `TaskStatus`:
  - `Open -> InProgress -> Complete` (with `Blocked` and `Canceled` side states)
- `NarrativeStatus`:
  - `Draft -> Submitted -> Approved -> Published`
- `ProjectionStatus`:
  - `Draft -> Submitted -> Approved -> Locked`

All transitions are captured in workflow/history entities where applicable.

## 11. Security, Multi-Tenancy, and Audit

- Every PM entity stores `TenantId` + `CompanyId` and uses global query filters.
- Controllers require `[Authorize]` and standard API rate limiting.
- Entity audit fields (`CreatedAt`, `CreatedBy`, `UpdatedAt`, `UpdatedBy`, soft delete fields) are auto-populated by `PitbullDbContext`.
- Sensitive operations (approve/lock/publish/generate) should emit auditable domain events in Phase B+.

## 12. Controller and Service Plan (Implementation Preview)

Controllers to add in `src/Pitbull.Api/Controllers/`:

- `ProjectSchedulesController`
- `ProjectJobCostController`
- `SubmittalsController`
- `PlansAndSpecsController`
- `ProjectCommunicationsController`
- `ProjectDailyReportsController`
- `ProjectProgressController`
- `ProjectProjectionsController`
- `ProjectMeetingsController`
- `ProjectDocumentGenerationController`
- `ProjectTasksController`
- `ProjectNarrativesController`
- `ProjectManagementDashboardController` (cross-project personal queues)

Services to add in `src/Modules/Pitbull.ProjectManagement/Services/`:

- `IScheduleService` / `ScheduleService`
- `IJobCostService` / `JobCostService`
- `ISubmittalService` / `SubmittalService`
- `IPlansSpecsService` / `PlansSpecsService`
- `ICommunicationService` / `CommunicationService`
- `IDailyReportService` / `DailyReportService`
- `IProgressService` / `ProgressService`
- `IProjectionService` / `ProjectionService`
- `IMeetingService` / `MeetingService`
- `IDocumentGenerationService` / `DocumentGenerationService`
- `ITaskService` / `TaskService`
- `INarrativeService` / `NarrativeService`

## 13. Out-of-Scope for Phase A

- EF entity implementation and migrations.
- Controller/service code.
- Schedule engine internals (CPM algorithm implementation).
- Rendering/annotation UI behaviors.
- External integrations for P6/MS Project parsers beyond import contract.

## 14. Architecture Decisions (Resolved)

1. `ProjectBudget` / `Projection` source-of-truth strategy:
   - Keep existing `Pitbull.Projects` tables for backward compatibility.
   - `PmJobCostBudget` and `PmMonthlyProjection` are the source of truth for PM workflows.
   - Sync/migration strategy between legacy and PM-specific tables will be defined in Phase C.
2. Document storage ownership:
   - Pitbull will build and operate its own document storage layer.
   - No external document system integrations. No SharePoint dependency.
   - Deployment options: on-prem customer-hosted or Pitbull Cloud (Railway, managed by Pitbull).
3. Route naming:
   - Use `/api/projects/{projectId}/...` for project-scoped resources.
   - Use `/api/project-management/...` for cross-project personal queues (`my tasks`, `my action items`).
4. Schedule import scope:
   - MVP: CSV only.
   - P6 XML: later phase.
   - MS Project conversion: future scope.

## 15. AI Integration Points

Future phases will wire AI into the following workflows:

- Delay tracking: contract intelligence for who to notify and notice periods.
- Submittal review: cost impact analysis and budget-risk flags.
- Document upload: field extraction and smart form fill.
- Project narratives: AI-drafted monthly summaries from project data.
- Daily reports: auto-populate from time entries and equipment logs.
- Cost projections: AI-assisted estimate-at-completion based on trend analysis.
- Meeting minutes: auto-generate from agenda items and action items.

---

This specification is ready for implementation planning (Phase B onward) after review.
