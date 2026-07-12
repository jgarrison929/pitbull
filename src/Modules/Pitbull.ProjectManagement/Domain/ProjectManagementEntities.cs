using Pitbull.Core.Domain;

namespace Pitbull.ProjectManagement.Domain;

// 6. Enum catalog
public enum ScheduleStatus { Draft = 0, Active = 1, Baselined = 2, Archived = 3 }
public enum ScheduleCalendarType { Standard5x8 = 0, Standard6x10 = 1, Custom = 2 }
public enum ScheduleImportSource { Csv = 0, P6Xml = 1, MsProject = 2 }
public enum ScheduleActivityType { Wbs = 0, Task = 1, Milestone = 2 }
public enum ScheduleActivityStatus { NotStarted = 0, InProgress = 1, Completed = 2, OnHold = 3 }
public enum ScheduleDependencyType { FS = 0, FF = 1, SS = 2, SF = 3 }
public enum ScheduleBaselineType { Initial = 0, ApprovedRevision = 1, Recovery = 2 }
public enum ScheduleResourceType { Crew = 0, Equipment = 1, Subcontract = 2 }
public enum CalendarExceptionType { Holiday = 0, WeatherShutdown = 1, CompanyShutdown = 2, Custom = 3 }
public enum ImportStatus { Queued = 0, Processing = 1, Succeeded = 2, PartialSuccess = 3, Failed = 4 }

public enum JobCostSourceType { TimeEntries = 0, PurchaseOrder = 1, Subcontract = 2, ManualAdjustment = 3 }
public enum CommitmentType { Subcontract = 0, PurchaseOrder = 1, Other = 2 }
public enum CommitmentStatus { Draft = 0, Approved = 1, PartiallyInvoiced = 2, Closed = 3 }
public enum ForecastConfidenceLevel { Low = 0, Medium = 1, High = 2 }

public enum RfiDistributionStatus { NotSent = 0, PartiallySent = 1, Sent = 2, Acknowledged = 3 }
public enum DistributionRecipientType { To = 0, Cc = 1, Bcc = 2 }
public enum RfiAttachmentRole { QuestionSupport = 0, Response = 1, Reference = 2 }
public enum RfiImpactType { Cost = 0, Schedule = 1, CostAndSchedule = 2 }
public enum SubmittalType { ProductData = 0, ShopDrawing = 1, Sample = 2, Mockup = 3, Closeout = 4, Other = 5 }
public enum SubmittalStatus { Draft = 0, Submitted = 1, InReview = 2, Approved = 3, ApprovedAsNoted = 4, ReviseAndResubmit = 5, Rejected = 6, Closed = 7 }
public enum SubmittalWorkflowEventType { Created = 0, Submitted = 1, Reviewed = 2, Returned = 3, Approved = 4, Rejected = 5, ReviseAndResubmit = 6, Closed = 7 }
public enum SubmittalAttachmentRole { Primary = 0, Supporting = 1, Response = 2, Reference = 3 }

public enum ProjectFolderType { Plans = 0, Specs = 1, Contracts = 2, Correspondence = 3, Photos = 4, Reports = 5, Custom = 6 }
public enum PlanDiscipline { Architectural = 0, Structural = 1, Civil = 2, Mechanical = 3, Electrical = 4, Plumbing = 5, FireProtection = 6, Other = 7 }
public enum PlanRevisionType { IFC = 0, Bulletin = 1, ASI = 2, Addendum = 3, RecordDrawing = 4, Other = 5 }
public enum PlanSetStatus { Draft = 0, Issued = 1, Superseded = 2, Archived = 3 }
public enum DistributionDocumentType { PlanSheet = 0, SpecSection = 1, GeneralDocument = 2 }
public enum DistributionMethod { Email = 0, DownloadLink = 1, PortalNotification = 2, Printed = 3 }
public enum CommunicationType { Letter = 0, Email = 1, Memo = 2, PhoneLog = 3 }
public enum CommunicationDirection { Incoming = 0, Outgoing = 1 }
public enum CommunicationReferenceType { General = 0, Rfi = 1, Submittal = 2, ChangeOrder = 3, Task = 4 }
public enum CommunicationStatus { Open = 0, FollowUpRequired = 1, Closed = 2 }

public enum DailyReportType { Foreman = 0, ProjectManager = 1 }
public enum DailyReportStatus { Draft = 0, Submitted = 1, Approved = 2, Locked = 3 }
public enum SafetyIncidentType { Injury = 0, NearMiss = 1, PropertyDamage = 2, Observation = 3 }
public enum SafetySeverity { Low = 0, Moderate = 1, High = 2, Critical = 3 }
public enum ProgressEntryType { Activity = 0, CostCode = 1, Quantity = 2, EarnedValue = 3 }
public enum ProgressEntryStatus { Draft = 0, Submitted = 1, Approved = 2, Rejected = 3 }
public enum ProjectionStatus { Draft = 0, Submitted = 1, Approved = 2, Locked = 3 }

public enum MeetingType { Oac = 0, Subcontractor = 1, Safety = 2, Progress = 3, Other = 4 }
public enum MeetingStatus { Scheduled = 0, InProgress = 1, Completed = 2, Canceled = 3 }
public enum TaskType { General = 0, Rfi = 1, Submittal = 2, MeetingAction = 3, DailyReport = 4, Narrative = 5 }
public enum TaskPriority { Low = 0, Normal = 1, High = 2, Urgent = 3 }
public enum TaskStatus { Open = 0, InProgress = 1, Blocked = 2, Complete = 3, Canceled = 4 }
public enum MeetingAttachmentRole { Agenda = 0, Minutes = 1, Reference = 2 }
public enum GeneratedDocumentType { Transmittal = 0, MeetingMinutes = 1, DailyReport = 2, Letter = 3, Narrative = 4 }
public enum GeneratedDocumentReferenceType { Project = 0, Rfi = 1, Submittal = 2, Meeting = 3, DailyReport = 4, Narrative = 5, Task = 6 }
public enum GeneratedOutputFormat { Pdf = 0, Docx = 1 }
public enum TemplateEngineType { Razor = 0, Handlebars = 1 }
public enum NarrativeStatus { Draft = 0, Submitted = 1, Approved = 2, Published = 3 }
public enum DocumentStorageProvider { LocalFileSystem = 0, S3Compatible = 1, AzureBlob = 2 }
public enum TaskReferenceType { None = 0, Rfi = 1, Submittal = 2, Meeting = 3, DailyReport = 4, Narrative = 5, Other = 6 }

public enum PunchListCategory { Architectural = 0, Structural = 1, Mechanical = 2, Electrical = 3, Plumbing = 4, FireProtection = 5, Sitework = 6, LifeSafety = 7, Finishes = 8, Other = 9 }
public enum PunchListResponsiblePartyType { GeneralContractor = 0, Subcontractor = 1, Owner = 2, Architect = 3 }
public enum PunchListItemStatus { Open = 0, InProgress = 1, ReadyForInspection = 2, Closed = 3, Disputed = 4 }
public enum PunchListPriority { Critical = 0, High = 1, Normal = 2, Low = 3 }

// 4.1 Schedule
public class PmSchedule : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ScheduleStatus Status { get; set; } = ScheduleStatus.Draft;
    public DateTime DataDate { get; set; }
    public ScheduleCalendarType CalendarType { get; set; } = ScheduleCalendarType.Standard5x8;
    public ScheduleImportSource ImportedFrom { get; set; } = ScheduleImportSource.Csv;
    public DateTime? LastCriticalPathRunAt { get; set; }
}

public class PmScheduleActivity : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ScheduleId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid? ParentActivityId { get; set; }
    public string WbsCode { get; set; } = string.Empty;
    public string ActivityCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public ScheduleActivityType ActivityType { get; set; }
    public ScheduleActivityStatus Status { get; set; }
    public int OriginalDurationDays { get; set; }
    public int RemainingDurationDays { get; set; }
    public DateTime? PlannedStart { get; set; }
    public DateTime? PlannedFinish { get; set; }
    public DateTime? EarlyStart { get; set; }
    public DateTime? EarlyFinish { get; set; }
    public DateTime? LateStart { get; set; }
    public DateTime? LateFinish { get; set; }
    public DateTime? ActualStart { get; set; }
    public DateTime? ActualFinish { get; set; }
    public int? TotalFloatDays { get; set; }
    public int? FreeFloatDays { get; set; }
    public decimal PercentComplete { get; set; }
    public bool IsCritical { get; set; }
    public Guid? CostCodeId { get; set; }
    public Guid? PhaseId { get; set; }
    public int SortOrder { get; set; }
    /// <summary>Default zone for activity (schedule overlay fuel).</summary>
    public Guid? PrimarySpatialNodeId { get; set; }
}

public class PmScheduleDependency : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ScheduleId { get; set; }
    public Guid PredecessorActivityId { get; set; }
    public Guid SuccessorActivityId { get; set; }
    public ScheduleDependencyType DependencyType { get; set; }
    public int LagDays { get; set; }
}

public class PmScheduleBaseline : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ScheduleId { get; set; }
    public Guid ProjectId { get; set; }
    public string Name { get; set; } = string.Empty;
    public ScheduleBaselineType BaselineType { get; set; }
    public DateTime CapturedAt { get; set; }
    public Guid CapturedByUserId { get; set; }
    public string? SourceVersion { get; set; }
}

public class PmScheduleBaselineActivity : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid BaselineId { get; set; }
    public Guid ActivityId { get; set; }
    public DateTime? BaselineStart { get; set; }
    public DateTime? BaselineFinish { get; set; }
    public int BaselineDurationDays { get; set; }
}

public class PmScheduleResourceAssignment : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ActivityId { get; set; }
    public ScheduleResourceType ResourceType { get; set; }
    public Guid? EmployeeId { get; set; }
    public Guid? EquipmentId { get; set; }
    public Guid? SubcontractId { get; set; }
    public decimal PlannedUnits { get; set; }
    public decimal ActualUnits { get; set; }
    public decimal PlannedHours { get; set; }
    public decimal ActualHours { get; set; }
}

public class PmScheduleCalendarException : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ScheduleId { get; set; }
    public DateTime Date { get; set; }
    public CalendarExceptionType ExceptionType { get; set; }
    public decimal? WorkHours { get; set; }
}

public class PmScheduleImportLog : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid? ScheduleId { get; set; }
    public ScheduleImportSource ImportSource { get; set; }
    public DateTime ImportedAt { get; set; }
    public Guid ImportedByUserId { get; set; }
    public ImportStatus Status { get; set; }
    public string FileName { get; set; } = string.Empty;
    public int RowsProcessed { get; set; }
    public int RowsFailed { get; set; }
    public string? ErrorSummary { get; set; }
}

// 4.2 Job Cost
public class PmJobCostBudget : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid CostCodeId { get; set; }
    public Guid? PhaseId { get; set; }
    public decimal OriginalBudget { get; set; }
    public decimal ApprovedBudgetChanges { get; set; }
    public decimal CurrentBudget { get; set; }
    public decimal? BudgetUnits { get; set; }
    public string? UnitOfMeasure { get; set; }
    public decimal? BudgetUnitCost { get; set; }
    public decimal LaborBurdenRate { get; set; }
}

public class PmJobCostActual : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid CostCodeId { get; set; }
    public Guid? PhaseId { get; set; }
    public DateTime AsOfDate { get; set; }
    public decimal LaborCost { get; set; }
    public decimal MaterialCost { get; set; }
    public decimal EquipmentCost { get; set; }
    public decimal SubcontractCost { get; set; }
    public decimal OtherCost { get; set; }
    public decimal TotalActualCost { get; set; }
    public JobCostSourceType SourceType { get; set; }
    public Guid? SourceReferenceId { get; set; }
}

public class PmJobCostCommitment : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid CostCodeId { get; set; }
    public Guid? PhaseId { get; set; }
    public CommitmentType CommitmentType { get; set; }
    public Guid? ReferenceId { get; set; }
    public decimal OriginalCommittedAmount { get; set; }
    public decimal ApprovedChangesAmount { get; set; }
    public decimal CurrentCommittedAmount { get; set; }
    public decimal BilledToDate { get; set; }
    public decimal PaidToDate { get; set; }
    public decimal RemainingCommitted { get; set; }
    public CommitmentStatus Status { get; set; }
}

public class PmJobCostForecast : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid CostCodeId { get; set; }
    public Guid? PhaseId { get; set; }
    public DateTime ForecastPeriod { get; set; }
    public decimal ActualToDate { get; set; }
    public decimal CommittedToDate { get; set; }
    public decimal CostToComplete { get; set; }
    public decimal EstimatedFinalCost { get; set; }
    public decimal VarianceToBudget { get; set; }
    public ForecastConfidenceLevel ForecastConfidence { get; set; }
    public string? Notes { get; set; }
}

public class PmJobCostUnitProgress : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid CostCodeId { get; set; }
    public Guid? PhaseId { get; set; }
    public DateTime PeriodDate { get; set; }
    public decimal InstalledQuantity { get; set; }
    public string InstalledUnit { get; set; } = string.Empty;
    public decimal CumulativeQuantity { get; set; }
    public decimal CumulativeCost { get; set; }
    public decimal CostPerUnit { get; set; }
}

// 4.3 RFI enhancements (stored in PM module with FK to RFI)
public class RfiDistributionRecipient : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid RfiId { get; set; }
    public DistributionRecipientType RecipientType { get; set; }
    public Guid? RecipientUserId { get; set; }
    public string RecipientName { get; set; } = string.Empty;
    public string RecipientEmail { get; set; } = string.Empty;
    public DateTime? SentAt { get; set; }
    public DateTime? AcknowledgedAt { get; set; }
}

public class RfiAttachment : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid RfiId { get; set; }
    public Guid DocumentId { get; set; }
    public RfiAttachmentRole DocumentRole { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public string? RevisionTag { get; set; }
}

public class RfiCostImpactLink : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid RfiId { get; set; }
    public Guid? CostCodeId { get; set; }
    public Guid? ChangeOrderId { get; set; }
    public RfiImpactType ImpactType { get; set; }
    public decimal? EstimatedCost { get; set; }
    public int? EstimatedDays { get; set; }
    public decimal? ApprovedCost { get; set; }
    public int? ApprovedDays { get; set; }
}

// 4.4 Submittals
public class PmSubmittal : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public int SubmittalNumber { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? SpecSectionCode { get; set; }
    public string? SpecSectionTitle { get; set; }
    public SubmittalType SubmittalType { get; set; }
    public SubmittalStatus Status { get; set; }
    public DateTime? RequiredByDate { get; set; }
    public DateTime? SubmittedDate { get; set; }
    public DateTime? ReturnedDate { get; set; }
    public DateTime? FinalDueDate { get; set; }
    public Guid? ScheduleActivityId { get; set; }
    public bool IsSubstitutionRequest { get; set; }
    public int RevisionNumber { get; set; }
}

public class PmSubmittalWorkflowEvent : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid SubmittalId { get; set; }
    public SubmittalWorkflowEventType EventType { get; set; }
    public SubmittalStatus? FromStatus { get; set; }
    public SubmittalStatus ToStatus { get; set; }
    public Guid ActionByUserId { get; set; }
    public DateTime ActionAt { get; set; }
    public string? Comments { get; set; }
}

public class PmSubmittalAttachment : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid SubmittalId { get; set; }
    public Guid DocumentId { get; set; }
    public SubmittalAttachmentRole DocumentRole { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string? RevisionTag { get; set; }
}

// 4.5 Plans/specs
public class PmDocumentFolder : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid? ParentFolderId { get; set; }
    public string Name { get; set; } = string.Empty;
    public ProjectFolderType FolderType { get; set; }
    public int SortOrder { get; set; }
}

public class PmPlanSet : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public string Name { get; set; } = string.Empty;
    public PlanDiscipline Discipline { get; set; }
    public DateTime? IssueDate { get; set; }
    public PlanRevisionType Revision { get; set; }
    public PlanSetStatus Status { get; set; }
}

public class PmPlanSheet : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid PlanSetId { get; set; }
    public Guid ProjectId { get; set; }
    public string DrawingNumber { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Discipline { get; set; }
    public string? CurrentRevision { get; set; }
    public string? Scale { get; set; }
    public Guid? DocumentId { get; set; }
}

public class PmPlanSheetRevision : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid PlanSheetId { get; set; }
    public string RevisionNumber { get; set; } = string.Empty;
    public DateTime RevisionDate { get; set; }
    public string? RevisionDescription { get; set; }
    public Guid? DocumentId { get; set; }
    public Guid? IssuedByUserId { get; set; }
}

public class PmSpecSection : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public string? DivisionCode { get; set; }
    public string SectionCode { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? CsiEdition { get; set; }
    public string? CurrentRevision { get; set; }
    public Guid? DocumentId { get; set; }
}

public class PmSpecSectionRevision : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid SpecSectionId { get; set; }
    public string RevisionNumber { get; set; } = string.Empty;
    public DateTime RevisionDate { get; set; }
    public string? Summary { get; set; }
    public Guid? DocumentId { get; set; }
}

public class PmDocumentDistribution : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public DistributionDocumentType DocumentType { get; set; }
    public Guid? ReferenceId { get; set; }
    public Guid? RecipientUserId { get; set; }
    public string RecipientName { get; set; } = string.Empty;
    public string RecipientEmail { get; set; } = string.Empty;
    public DateTime? SentAt { get; set; }
    public DateTime? AcknowledgedAt { get; set; }
    public DistributionMethod DistributionMethod { get; set; }
}

// 4.6 communications
public class PmCommunication : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public CommunicationType CommunicationType { get; set; }
    public CommunicationDirection Direction { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string? Body { get; set; }
    public string? FromName { get; set; }
    public string? FromEmail { get; set; }
    public string? ToName { get; set; }
    public string? ToEmail { get; set; }
    public CommunicationReferenceType ReferenceType { get; set; }
    public Guid? ReferenceId { get; set; }
    public DateTime? FollowUpDate { get; set; }
    public CommunicationStatus Status { get; set; }
}

public class PmCommunicationAttachment : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid CommunicationId { get; set; }
    public Guid DocumentId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;
}

// 4.7 daily reports
public class PmDailyReport : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public string? Title { get; set; }
    public DateTime ReportDate { get; set; }
    public DailyReportType ReportType { get; set; }
    public DailyReportStatus Status { get; set; }
    public string? WeatherSummary { get; set; }
    public decimal? TemperatureLow { get; set; }
    public decimal? TemperatureHigh { get; set; }
    public string? Precipitation { get; set; }
    public string? Wind { get; set; }
    public string? WorkNarrative { get; set; }
    public string? DelaysNarrative { get; set; }
    public string? SafetyNarrative { get; set; }
    public Guid PreparedByUserId { get; set; }
    /// <summary>Optional zone/spatial node for field report context (twin fuel).</summary>
    public Guid? SpatialNodeId { get; set; }
}

public class PmDailyReportCrew : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid DailyReportId { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public string Trade { get; set; } = string.Empty;
    public int HeadCount { get; set; }
    public decimal HoursWorked { get; set; }
}

public class PmDailyReportEquipment : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid DailyReportId { get; set; }
    public Guid? EquipmentId { get; set; }
    public string EquipmentName { get; set; } = string.Empty;
    public decimal HoursUsed { get; set; }
}

public class PmDailyReportVisitor : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid DailyReportId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Company { get; set; }
    public string? Purpose { get; set; }
    public DateTime? TimeIn { get; set; }
    public DateTime? TimeOut { get; set; }
}

public class PmDailyReportSafetyIncident : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid DailyReportId { get; set; }
    public SafetyIncidentType IncidentType { get; set; }
    public string Description { get; set; } = string.Empty;
    public SafetySeverity Severity { get; set; }
    public string? ReportedTo { get; set; }
}

public class PmDailyReportDelivery : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid DailyReportId { get; set; }
    public string VendorName { get; set; } = string.Empty;
    public string MaterialDescription { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string Unit { get; set; } = string.Empty;
    public Guid? RelatedCostCodeId { get; set; }
}

public class PmDailyReportPhoto : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid DailyReportId { get; set; }
    public Guid DocumentId { get; set; }
    public string? Caption { get; set; }
    public DateTime? TakenAt { get; set; }
    public Guid? TakenByUserId { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
}

public class PmDailyReportRollup : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ParentDailyReportId { get; set; }
    public Guid ChildDailyReportId { get; set; }
}

// 4.8 progress
public class PmProgressEntry : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public DateTime ProgressDate { get; set; }
    public Guid EnteredByUserId { get; set; }
    public ProgressEntryType EntryType { get; set; }
    public ProgressEntryStatus Status { get; set; }
    /// <summary>Optional zone of work for twin progress overlay.</summary>
    public Guid? SpatialNodeId { get; set; }
}

public class PmActivityProgress : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProgressEntryId { get; set; }
    public Guid ScheduleActivityId { get; set; }
    public decimal PercentComplete { get; set; }
    public decimal? InstalledQuantity { get; set; }
    public string? Unit { get; set; }
    public decimal? EarnedHours { get; set; }
    /// <summary>Optional zone pin finer than parent entry.</summary>
    public Guid? SpatialNodeId { get; set; }
}

public class PmCostCodeProgress : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProgressEntryId { get; set; }
    public Guid CostCodeId { get; set; }
    public Guid? PhaseId { get; set; }
    public decimal PercentComplete { get; set; }
    public decimal EarnedValueAmount { get; set; }
}

public class PmEarnedValueSnapshot : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public DateTime SnapshotDate { get; set; }
    public decimal BCWS { get; set; }
    public decimal BCWP { get; set; }
    public decimal ACWP { get; set; }
    public decimal? CPI { get; set; }
    public decimal? SPI { get; set; }
    public decimal? EstimateAtCompletion { get; set; }
    public decimal? VarianceAtCompletion { get; set; }
}

public class PmSCurvePoint : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public DateTime CurveDate { get; set; }
    public decimal PlannedPercent { get; set; }
    public decimal ActualPercent { get; set; }
    public decimal EarnedPercent { get; set; }
}

public class PmProgressTimeEntryLink : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProgressEntryId { get; set; }
    public Guid TimeEntryId { get; set; }
}

// 4.9 projections
public class PmMonthlyProjection : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public DateTime ProjectionMonth { get; set; }
    public decimal ContractValueOriginal { get; set; }
    public decimal ApprovedChangeOrders { get; set; }
    public decimal PendingChangeOrders { get; set; }
    public decimal AdjustedContractValue { get; set; }
    public decimal RevenueRecognizedToDate { get; set; }
    public decimal PercentComplete { get; set; }
    public decimal ProjectedFinalRevenue { get; set; }
    public decimal ProjectedFinalCost { get; set; }
    public decimal ProjectedMargin { get; set; }
    public ProjectionStatus ProjectionStatus { get; set; }
    public Guid PreparedByUserId { get; set; }
    public Guid? ReviewedByUserId { get; set; }
    public string? Notes { get; set; }
}

public class PmProjectionCostCode : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid MonthlyProjectionId { get; set; }
    public Guid CostCodeId { get; set; }
    public Guid? PhaseId { get; set; }
    public decimal OriginalBudget { get; set; }
    public decimal CurrentBudget { get; set; }
    public decimal EAC { get; set; }
    public decimal Variance { get; set; }
}

// 4.10 meetings
public class PmMeetingSeries : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public MeetingType MeetingType { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? RecurrenceRule { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public bool IsActive { get; set; }
}

public class PmMeeting : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid? MeetingSeriesId { get; set; }
    public MeetingType MeetingType { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Location { get; set; }
    public string? VirtualMeetingUrl { get; set; }
    public DateTime ScheduledStart { get; set; }
    public DateTime? ScheduledEnd { get; set; }
    public DateTime? ActualStart { get; set; }
    public DateTime? ActualEnd { get; set; }
    public MeetingStatus Status { get; set; }
    public Guid? AgendaTemplateId { get; set; }
}

public class PmMeetingAgendaItem : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid MeetingId { get; set; }
    public int ItemNumber { get; set; }
    public string Topic { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid? PresenterUserId { get; set; }
}

public class PmMeetingMinute : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid MeetingId { get; set; }
    public string MinuteText { get; set; } = string.Empty;
    public Guid RecordedByUserId { get; set; }
    public int VersionNumber { get; set; }
}

public class PmMeetingActionItem : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid MeetingId { get; set; }
    public string Description { get; set; } = string.Empty;
    public Guid? AssigneeUserId { get; set; }
    public string? AssigneeName { get; set; }
    public DateTime? DueDate { get; set; }
    public TaskPriority Priority { get; set; }
    public TaskStatus Status { get; set; }
    public DateTime? ClosedAt { get; set; }
}

public class PmMeetingAttachment : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid MeetingId { get; set; }
    public Guid DocumentId { get; set; }
    public MeetingAttachmentRole AttachmentRole { get; set; }
}

// 4.11 document generation
public class PmDocumentTemplate : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public GeneratedDocumentType TemplateType { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public TemplateEngineType Engine { get; set; }
    public string BodyTemplate { get; set; } = string.Empty;
    public string? HeaderTemplate { get; set; }
    public string? FooterTemplate { get; set; }
    public bool IsDefault { get; set; }
    public int Version { get; set; } = 1;
}

public class PmGeneratedDocument : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid TemplateId { get; set; }
    public GeneratedDocumentType DocumentType { get; set; }
    public GeneratedDocumentReferenceType ReferenceType { get; set; }
    public Guid? ReferenceId { get; set; }
    public DateTime GeneratedAt { get; set; }
    public Guid GeneratedByUserId { get; set; }
    public GeneratedOutputFormat OutputFormat { get; set; }
    public Guid DocumentId { get; set; }
    public string? MergeDataJson { get; set; }
    public Guid? LetterheadConfigId { get; set; }
}

public class PmLetterheadConfig : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public string Name { get; set; } = string.Empty;
    public Guid? LogoDocumentId { get; set; }
    public string? PrimaryColor { get; set; }
    public string? SecondaryColor { get; set; }
    public string? AddressBlock { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Website { get; set; }
    public bool IsDefault { get; set; }
}

// 4.12 tasks
public class PmTask : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid? ProjectId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public TaskType TaskType { get; set; }
    public TaskPriority Priority { get; set; }
    public TaskStatus Status { get; set; }
    public Guid AssignedByUserId { get; set; }
    public Guid? AssignedToUserId { get; set; }
    public string? AssignedToName { get; set; }
    public DateTime? DueDate { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public TaskReferenceType ReferenceType { get; set; }
    public Guid? ReferenceId { get; set; }
}

public class PmTaskComment : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid TaskId { get; set; }
    public string Comment { get; set; } = string.Empty;
    public Guid CommentedByUserId { get; set; }
    public DateTime CommentedAt { get; set; }
}

// 4.13 narratives
public class PmProjectNarrative : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public DateTime NarrativeMonth { get; set; }
    public NarrativeStatus Status { get; set; }
    public Guid? TemplateId { get; set; }
    public string? ExecutiveSummary { get; set; }
    public string? KeyAccomplishments { get; set; }
    public string? UpcomingMilestones { get; set; }
    public string? RisksAndConcerns { get; set; }
    public string? FinancialSummary { get; set; }
    public string? ScheduleSummary { get; set; }
    public string? GeneratedDraftText { get; set; }
    public DateTime? FinalizedAt { get; set; }
    public Guid PreparedByUserId { get; set; }
}

public class PmProjectNarrativeRevision : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid NarrativeId { get; set; }
    public int RevisionNumber { get; set; }
    public string ContentSnapshotJson { get; set; } = string.Empty;
    public Guid RevisedByUserId { get; set; }
    public DateTime RevisedAt { get; set; }
    public string? RevisionNote { get; set; }
}

// 4.14 document storage
public class PmDocument : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public string StoragePath { get; set; } = string.Empty;
    public DocumentStorageProvider StorageProvider { get; set; } = DocumentStorageProvider.LocalFileSystem;
    public string Checksum { get; set; } = string.Empty;
    public Guid UploadedByUserId { get; set; }
    public DateTime UploadedAt { get; set; }
}

public class PmDocumentVersion : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid DocumentId { get; set; }
    public int VersionNumber { get; set; }
    public string StoragePath { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public Guid UploadedByUserId { get; set; }
    public DateTime UploadedAt { get; set; }
    public string? ChangeNote { get; set; }
}

// 4.15 Punch List
public class PmPunchListItem : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public int ItemNumber { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public PunchListCategory Category { get; set; }
    public string Description { get; set; } = string.Empty;
    public PunchListResponsiblePartyType ResponsiblePartyType { get; set; }
    public Guid? ResponsibleSubcontractorId { get; set; }
    public string? AssignedToName { get; set; }
    public DateTime? DueDate { get; set; }
    public PunchListItemStatus Status { get; set; }
    public PunchListPriority Priority { get; set; }
    public bool PhotoRequired { get; set; }
    public decimal? CostImpact { get; set; }
    public int? ScheduleImpactDays { get; set; }
    public Guid CreatedByUserId { get; set; }
    public Guid? ClosedByUserId { get; set; }
    public DateTime? ClosedAt { get; set; }
    public Guid? InspectedByUserId { get; set; }
    public DateTime? InspectedAt { get; set; }
    public string? Notes { get; set; }
}

public class PmPunchListPhoto : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid PunchListItemId { get; set; }
    public Guid DocumentId { get; set; }
    public string? Caption { get; set; }
    public DateTime? TakenAt { get; set; }
    public Guid? TakenByUserId { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.16 Progress → Schedule → Cost integration (Phase 1 Foundation)
// The moat feature: one field entry automatically updates schedule + earned value
// ─────────────────────────────────────────────────────────────────────────────

public enum WeatherCondition { Clear = 0, Cloudy = 1, Rain = 2, Snow = 3, Wind = 4, Extreme = 5 }

/// <summary>
/// Maps a CostCode to one or more ScheduleActivities.
/// This is the critical link that enables a single progress entry to
/// automatically update the schedule and drive earned value calculations.
/// WeightFactor handles activities that span multiple cost codes (e.g., 0.6 concrete + 0.4 rebar).
/// </summary>
public class PmCostCodeActivityMapping : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid CostCodeId { get; set; }
    public Guid ScheduleActivityId { get; set; }
    /// <summary>
    /// Weight of this cost code's contribution to the activity's overall progress.
    /// Sum of all weights for an activity should equal 1.0.
    /// Default 1.0 = this cost code fully drives the activity.
    /// </summary>
    public decimal WeightFactor { get; set; } = 1.0m;
}

/// <summary>
/// Field-reported quantity progress. One entry per cost code per day.
/// Creating this entry auto-updates ScheduleActivity.PercentComplete
/// and triggers earned value recalculation.
/// </summary>
public class PmFieldProgressEntry : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public DateOnly Date { get; set; }
    public Guid CostCodeId { get; set; }
    /// <summary>
    /// Auto-resolved from CostCodeActivityMapping when not explicitly provided.
    /// </summary>
    public Guid? ScheduleActivityId { get; set; }
    public decimal QuantityInstalled { get; set; }
    public string UnitOfMeasure { get; set; } = string.Empty;
    /// <summary>
    /// Running total of all QuantityInstalled for this project+costcode up to and including this entry.
    /// Calculated automatically on create/update.
    /// </summary>
    public decimal CumulativeQuantity { get; set; }
    /// <summary>
    /// Denormalized from the cost code's budget quantity for fast percent-complete calculation.
    /// </summary>
    public decimal TotalBudgetedQuantity { get; set; }
    /// <summary>
    /// Auto-calculated: CumulativeQuantity / TotalBudgetedQuantity.
    /// Drives ScheduleActivity.PercentComplete when a mapping exists.
    /// </summary>
    public decimal PercentComplete { get; set; }
    public int CrewSize { get; set; }
    public decimal HoursWorked { get; set; }
    public string? Notes { get; set; }
    public WeatherCondition WeatherCondition { get; set; } = WeatherCondition.Clear;
    public Guid? ReportedById { get; set; }
}

/// <summary>
/// Earned value snapshot stored per cost code per date.
/// Computed and stored for performance — recalculated when progress entries change.
/// All metrics use standard PMBOK/ANSI 748 earned value definitions.
/// </summary>
public class PmCostCodeEarnedValueSnapshot : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid CostCodeId { get; set; }
    public DateOnly SnapshotDate { get; set; }
    /// <summary>BCWS: Budgeted Cost of Work Scheduled = BAC × planned % complete based on schedule dates</summary>
    public decimal BCWS { get; set; }
    /// <summary>BCWP: Budgeted Cost of Work Performed = BAC × actual % complete from progress entries</summary>
    public decimal BCWP { get; set; }
    /// <summary>ACWP: Actual Cost of Work Performed = sum of time entry costs + subcontract billings for this cost code</summary>
    public decimal ACWP { get; set; }
    /// <summary>BAC: Budget at Completion = total budgeted cost for this cost code</summary>
    public decimal BAC { get; set; }
    /// <summary>SV: Schedule Variance = BCWP - BCWS (positive = ahead of schedule)</summary>
    public decimal SV { get; set; }
    /// <summary>CV: Cost Variance = BCWP - ACWP (positive = under budget)</summary>
    public decimal CV { get; set; }
    /// <summary>SPI: Schedule Performance Index = BCWP / BCWS (>1.0 = ahead of schedule)</summary>
    public decimal SPI { get; set; }
    /// <summary>CPI: Cost Performance Index = BCWP / ACWP (>1.0 = under budget)</summary>
    public decimal CPI { get; set; }
    /// <summary>EAC: Estimate at Completion = BAC / CPI</summary>
    public decimal EAC { get; set; }
    /// <summary>ETC: Estimate to Complete = EAC - ACWP</summary>
    public decimal ETC { get; set; }
    /// <summary>TCPI: To-Complete Performance Index = (BAC - BCWP) / (BAC - ACWP)</summary>
    public decimal TCPI { get; set; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Digital Twin — zones-first spatial graph (see docs/pitbull-digital-twin-spec.md)
// ─────────────────────────────────────────────────────────────────────────────

public enum SpatialGraphStatus { Draft = 0, Published = 1, Archived = 2 }
public enum SpatialNodeType { Site = 0, Building = 1, Storey = 2, Zone = 3, Element = 4 }
public enum SpatialLengthUnit { Meters = 0 }

/// <summary>Versioned spatial graph for a project (one Published graph at a time).</summary>
public class SpatialGraph : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public string Name { get; set; } = "Primary";
    public int Version { get; set; } = 1;
    public SpatialGraphStatus Status { get; set; } = SpatialGraphStatus.Published;
    public SpatialLengthUnit LengthUnit { get; set; } = SpatialLengthUnit.Meters;
    public decimal? OriginLatitude { get; set; }
    public decimal? OriginLongitude { get; set; }
    public DateTime? PublishedAt { get; set; }
    public string? PublishedBy { get; set; }
}

/// <summary>Tree node: Site → Building → Storey → Zone (→ optional Element).</summary>
public class SpatialNode : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid GraphId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid? ParentNodeId { get; set; }
    public SpatialNodeType NodeType { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public int? LevelIndex { get; set; }
    public string? ExternalKey { get; set; }
    public decimal? CentroidX { get; set; }
    public decimal? CentroidY { get; set; }
    public decimal? CentroidZ { get; set; }
    public bool IsActive { get; set; } = true;
    public string? RetiredReason { get; set; }
}
