# Document Management Module — Design Specification

> **Status:** Draft
> **Module:** `Pitbull.Documents` (core storage) + `Pitbull.ProjectManagement` (PM-specific features)
> **Author:** River (AI-assisted design)
> **Date:** 2026-02-22
> **Sponsor:** VP of Construction (Tom Reilly), Project Manager (Mike Chen)
> **Executive Review Reference:** "Document management is the silent productivity killer. PMs spend 45 minutes a day looking for files across SharePoint, Procore, email, and physical boxes."
> **References:** `docs/roles/PROJECT-MANAGER.md`, `docs/plans/SCHEDULE-MODULE-DESIGN.md`, `docs/plans/JOB-COST-MODULE-DESIGN.md`

---

## 0) Why This Module Exists

### The Document Chaos Problem

A typical $20M commercial construction project generates 10,000-50,000 documents over its lifecycle. Today, those documents live in:

- **SharePoint** — contracts, correspondence, internal docs (if the company bothered to organize it)
- **Procore** — RFIs, submittals, drawings (if the company pays for Procore)
- **Email** — the real document management system for most GCs. Critical decisions buried in inbox threads.
- **Box/Dropbox** — ad hoc file sharing with subs, no version control
- **Physical filing cabinets** — original signed contracts, lien waivers, insurance certs (yes, still)
- **The PM's laptop** — the single point of failure. When a PM leaves, half the project history leaves with them.

**The cost of document chaos:**
- PMs spend 30-45 minutes per day searching for documents (ENR 2024 survey)
- 15% of construction rework is caused by using outdated drawings or specs
- Closeout packages take 2-4 weeks to assemble because documents are scattered
- Dispute resolution suffers because contemporaneous records can't be found
- Insurance audits require producing documents that nobody can locate

### What We Replace

| System | What It Does | Why It Falls Short |
|--------|-------------|-------------------|
| **SharePoint** | File storage with folders | No construction context. No connection to RFIs, submittals, projects. Search is terrible for construction docs. No mobile field access. |
| **Procore Documents** | Project-scoped file storage | Decent but separate from accounting. No GL integration. $400+/user/month for the full platform. Can't attach docs to invoices or pay apps. |
| **Bluebeam Studio** | PDF markup and collaboration | Great for drawing review but nothing else. No submittal tracking, no transmittals, no closeout packages. |
| **PlanGrid (Autodesk Build)** | Field drawing access | Excellent for drawings but acquired by Autodesk, pricing exploded. No integration with cost/billing. |
| **Box/Dropbox** | Generic cloud storage | Zero construction awareness. No version control tied to submittals. No transmittal tracking. No access control by role. |

**Our advantage:** Documents live inside the ERP. An RFI response references the drawing it affects. A submittal attachment links to the spec section and the schedule activity it blocks. A daily report photo is geotagged and timestamped. A change order references the correspondence that triggered it. No exports, no "check the SharePoint folder," no "I think Mike had that file."

---

## 1) Industry Context: Documents in Construction

### 1.1 Document Lifecycle by Project Phase

**Preconstruction (Bid → Award)**
- Bid documents, plans and specs (IFC set), addenda
- Geotechnical reports, surveys, environmental studies
- Subcontractor proposals, bid tabulations
- Insurance certificates, bond letters
- Owner contract (signed original)

**Construction (Active Work)**
- Drawings: IFC sets, bulletins, ASIs, shop drawings
- Specs: CSI sections with addenda and revisions
- RFI correspondence (question + response + attachments)
- Submittal packages (product data, shop drawings, samples)
- Daily reports with photos
- Meeting minutes (OAC, sub coordination, safety)
- Change order documentation (PCOs, CORs, approved COs)
- Pay applications (G702/G703 with lien waivers)
- Correspondence (letters, memos, emails of record)
- Inspection reports, test results
- Safety documentation (toolbox talks, incident reports)
- Permits and regulatory approvals

**Closeout (Substantial Completion → Final)**
- Punch list documentation with photos
- O&M manuals (Operations & Maintenance)
- As-built drawings
- Warranty letters
- Final lien waivers (conditional + unconditional)
- Certificate of Substantial Completion
- Certificate of Occupancy
- Attic stock inventory
- Training documentation
- Equipment startup records
- Commissioning reports
- Final retention release documentation

### 1.2 Who Accesses What

| Role | Primary Documents | Access Pattern |
|------|------------------|---------------|
| **Project Manager** | Everything. RFIs, submittals, COs, pay apps, correspondence, drawings | Create, edit, distribute |
| **Superintendent** | Daily reports, drawings, safety docs, punch lists, photos | Create (field), read (office) |
| **Project Engineer** | RFIs, submittals, drawings, specs, shop drawings | Create, track, distribute |
| **Controller/CFO** | Contracts, pay apps, lien waivers, insurance certs | Read, approve, archive |
| **Subcontractor** | Their scope drawings, submittals, pay apps, insurance | Limited read, upload submittals |
| **Owner** | Pay apps, schedule updates, meeting minutes, CO documentation | Read, approve |
| **Architect** | RFIs, submittals, drawings, ASIs | Read, respond, approve |

### 1.3 The Transmittal

A transmittal is a formal cover sheet documenting that specific documents were sent to a specific party on a specific date. It is a legal record of delivery.

**Why transmittals matter:**
- "We never received that drawing revision" → "Here's the transmittal dated March 15 showing it was sent to you"
- "We didn't know about the specification change" → "Transmittal #47 to your attention, acknowledged March 20"
- In disputes, transmittals prove that information was communicated

---

## 2) Existing Infrastructure

### 2.1 Two-Tier Document System (Already Built)

The codebase has two document layers:

**Tier 1: Generic File Attachments (`Pitbull.Documents`)**
- `FileAttachment` entity with generic `RelatedEntityType` + `RelatedEntityId`
- `IFileStorageService` — upload, download, delete, query by entity
- `IFileValidationService` — 50 MB limit, blocked extensions (.exe, .bat, etc.), allowed MIME types
- Storage: `{basePath}/uploads/{tenantId}/{entityType}/{guid}_{filename}`
- Controller: `api/files` — upload, upload-multiple, download, delete

**Tier 2: Project Documents (`Pitbull.ProjectManagement`)**
- `PmDocument` — project-scoped document with checksum and storage provider
- `PmDocumentVersion` — version history per document
- `PmDocumentFolder` — hierarchical folders with `ProjectFolderType`
- `PmDocumentDistribution` — transmittal/distribution tracking
- `PmDocumentTemplate` — Razor/Handlebars templates for document generation
- `PmGeneratedDocument` — documents created from templates (transmittals, meeting minutes, letters)
- `PmLetterheadConfig` — company letterhead for generated documents
- Storage: `{basePath}/pm-documents/{companyId}/{projectId}/{guid}_{filename}`
- Provider pattern: `IDocumentStorageProvider` with LocalFileSystem (implemented), S3Compatible (planned), AzureBlob (planned)

### 2.2 Attachment Entities (Already Built)

Documents connect to PM entities through typed attachment join tables:

| Entity | References | Role Enum |
|--------|-----------|-----------|
| `RfiAttachment` | RFI → Document | QuestionSupport, Response, Reference |
| `PmSubmittalAttachment` | Submittal → Document | Primary, Supporting, Response, Reference |
| `PmDailyReportPhoto` | Daily Report → Document | (with GPS: Latitude, Longitude, TakenAt) |
| `PmPunchListPhoto` | Punch List → Document | (with GPS: Latitude, Longitude, TakenAt) |
| `PmMeetingAttachment` | Meeting → Document | Agenda, Minutes, Reference |
| `PmCommunicationAttachment` | Communication → Document | (filename + MIME type) |
| `BillingPackageDocument` | Billing App → Document | G702, G703, LienWaiver, InsuranceCert, etc. |

### 2.3 Plans & Specs Entities (Already Built)

| Entity | Purpose |
|--------|---------|
| `PmPlanSet` | Drawing set (IFC, Bulletin, ASI, Addendum, RecordDrawing) |
| `PmPlanSheet` | Individual drawing sheet (DrawingNumber, Title, Discipline, Scale, DocumentId) |
| `PmPlanSheetRevision` | Revision history per sheet (RevisionNumber, RevisionDate, DocumentId) |
| `PmSpecSection` | Specification section (DivisionCode, SectionCode, Title, DocumentId) |
| `PmSpecSectionRevision` | Spec revision history |

### 2.4 AI Document Analysis (Already Built)

- `AiDocumentController` at `api/ai/analyze-document`
- Vision API extracts: documentType, dates, amounts, parties, keyTerms, summary, recommendations
- Used for invoice extraction (existing) — extensible to any document type

### 2.5 Existing Enums

```
ProjectFolderType: Plans, Specs, Contracts, Correspondence, Photos, Reports, Custom
DocumentStorageProvider: LocalFileSystem, S3Compatible, AzureBlob
PlanDiscipline: Architectural, Structural, Civil, Mechanical, Electrical, Plumbing, FireProtection, Other
PlanRevisionType: IFC, Bulletin, ASI, Addendum, RecordDrawing, Other
PlanSetStatus: Draft, Issued, Superseded, Archived
DistributionDocumentType: PlanSheet, SpecSection, GeneralDocument
DistributionMethod: Email, DownloadLink, PortalNotification, Printed
GeneratedDocumentType: Transmittal, MeetingMinutes, DailyReport, Letter, Narrative
GeneratedDocumentReferenceType: Project, Rfi, Submittal, Meeting, DailyReport, Narrative, Task
GeneratedOutputFormat: Pdf, Docx
TemplateEngineType: Razor, Handlebars
```

---

## 3) New Entities Required

### 3.1 `PmDocumentMetadata` — Rich Searchable Metadata

The existing `PmDocument` stores file metadata (name, MIME type, size, path). But construction documents need richer metadata for search and classification:

```csharp
public class PmDocumentMetadata : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid DocumentId { get; set; }              // FK to PmDocument

    // Classification
    public DocumentCategory Category { get; set; }    // Contract, Drawing, Spec, Submittal, RFI, Photo, etc.
    public string? SubCategory { get; set; }           // "Shop Drawing", "Product Data", "Insurance Certificate"
    public string? Title { get; set; }                 // Human-readable title (vs. FileName)
    public string? Description { get; set; }
    public string? DocumentNumber { get; set; }        // External document number (e.g., "ASI-007")

    // Context
    public Guid? FolderId { get; set; }                // FK to PmDocumentFolder
    public Guid? CostCodeId { get; set; }              // Cost code association
    public Guid? PhaseId { get; set; }                 // Phase association
    public string? SpecSectionCode { get; set; }       // CSI spec section (e.g., "03 30 00")
    public string? Tags { get; set; }                  // Comma-separated tags for ad hoc categorization

    // Dates
    public DateOnly? DocumentDate { get; set; }        // Date on the document (vs. upload date)
    public DateOnly? ReceivedDate { get; set; }        // When we received it
    public DateOnly? ExpirationDate { get; set; }      // Insurance certs, permits, bonds

    // Origin
    public string? Author { get; set; }                // Document author/company
    public string? ReceivedFrom { get; set; }          // Who sent it to us
    public DocumentOrigin Origin { get; set; }         // Internal, Subcontractor, Owner, Architect, Vendor, Regulatory

    // Access control
    public DocumentAccessLevel AccessLevel { get; set; }  // Internal, Subcontractor, Owner, Public
    public bool IsConfidential { get; set; }

    // Status
    public DocumentReviewStatus ReviewStatus { get; set; }  // NotReviewed, UnderReview, Approved, Rejected
    public Guid? ReviewedByUserId { get; set; }
    public DateTime? ReviewedAt { get; set; }

    // Search
    public string? ExtractedText { get; set; }          // Full-text content (OCR or text extraction)
    public string? AiSummary { get; set; }              // AI-generated summary
    public string? AiClassification { get; set; }       // AI-suggested category (for unclassified uploads)
}

public enum DocumentCategory
{
    Contract = 0,
    Drawing = 1,
    Specification = 2,
    Submittal = 3,
    Rfi = 4,
    Photo = 5,
    DailyReport = 6,
    Correspondence = 7,
    InsuranceBond = 8,
    Permit = 9,
    ChangeOrder = 10,
    PayApplication = 11,
    LienWaiver = 12,
    SafetyDocument = 13,
    InspectionReport = 14,
    MeetingMinutes = 15,
    OMManual = 16,
    Warranty = 17,
    AsBuilt = 18,
    TestReport = 19,
    Other = 20
}

public enum DocumentOrigin { Internal = 0, Subcontractor = 1, Owner = 2, Architect = 3, Vendor = 4, Regulatory = 5, Other = 6 }
public enum DocumentAccessLevel { Internal = 0, Subcontractor = 1, Owner = 2, Public = 3 }
public enum DocumentReviewStatus { NotReviewed = 0, UnderReview = 1, Approved = 2, Rejected = 3 }
```

### 3.2 `PmDocumentCheckout` — Check-In/Check-Out

When someone is editing a document (especially drawings or contracts), others should not overwrite their changes. Check-out locks the document for editing:

```csharp
public class PmDocumentCheckout : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid DocumentId { get; set; }
    public Guid CheckedOutByUserId { get; set; }
    public DateTime CheckedOutAt { get; set; }
    public string? CheckoutNote { get; set; }           // "Updating structural details per ASI-007"
    public DateTime? CheckedInAt { get; set; }
    public int? NewVersionNumber { get; set; }          // Version created on check-in
    public bool IsActive { get; set; }                  // True = currently checked out
}
```

**Checkout rules:**
- Only one active checkout per document
- Admin can force-release a checkout (with audit trail)
- Checkout expires after configurable timeout (default: 72 hours)
- Read/download is always available even when checked out
- Upload of new version requires active checkout (or admin override)

### 3.3 `PmTransmittal` — Formal Document Transmittal

A transmittal is more than a distribution record. It is a numbered, formal cover sheet:

```csharp
public class PmTransmittal : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public string TransmittalNumber { get; set; }      // Auto: "T-001", sequential per project
    public DateOnly TransmittalDate { get; set; }
    public string Subject { get; set; }

    // Recipient
    public string RecipientCompany { get; set; }
    public string RecipientName { get; set; }
    public string? RecipientEmail { get; set; }
    public string? RecipientAddress { get; set; }

    // Sender
    public Guid SentByUserId { get; set; }
    public string SentByName { get; set; }

    // Delivery
    public TransmittalMethod Method { get; set; }
    public TransmittalAction Action { get; set; }       // ForYourUse, ForReview, ForApproval, AsRequested, ForRecord

    // Status
    public TransmittalStatus Status { get; set; }
    public DateTime? SentAt { get; set; }
    public DateTime? AcknowledgedAt { get; set; }
    public string? AcknowledgedBy { get; set; }

    // Content
    public string? Remarks { get; set; }
    public string? CopyTo { get; set; }                 // CC list
}

public class PmTransmittalItem : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid TransmittalId { get; set; }
    public Guid? DocumentId { get; set; }               // FK to PmDocument
    public int ItemNumber { get; set; }
    public string Description { get; set; }
    public int? Copies { get; set; }                    // Number of copies (for printed transmittals)
    public string? DrawingNumber { get; set; }          // Denormalized for cover sheet
    public string? Revision { get; set; }               // Denormalized for cover sheet
}

public enum TransmittalMethod { Email = 0, Hand = 1, Mail = 2, Courier = 3, Ftp = 4, Portal = 5 }
public enum TransmittalAction { ForYourUse = 0, ForReview = 1, ForApproval = 2, AsRequested = 3, ForRecord = 4, ForBidding = 5 }
public enum TransmittalStatus { Draft = 0, Sent = 1, Acknowledged = 2, Void = 3 }
```

### 3.4 `PmCloseoutPackage` — Closeout Document Assembly

Closeout is the most document-intensive phase. A closeout package assembles all required documents for handoff to the owner:

```csharp
public class PmCloseoutPackage : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public string Name { get; set; }                   // "Building A Closeout Package"
    public CloseoutPackageStatus Status { get; set; }
    public Guid PreparedByUserId { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public string? AcceptedByName { get; set; }         // Owner representative
    public string? Notes { get; set; }
}

public class PmCloseoutPackageItem : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid CloseoutPackageId { get; set; }
    public string ItemName { get; set; }               // "Mechanical O&M Manual"
    public CloseoutItemCategory Category { get; set; }
    public int SortOrder { get; set; }
    public bool IsRequired { get; set; }               // Per spec/contract
    public CloseoutItemStatus Status { get; set; }
    public Guid? DocumentId { get; set; }              // FK to PmDocument when uploaded
    public Guid? ResponsibleSubcontractorId { get; set; }
    public string? ResponsiblePartyName { get; set; }
    public DateOnly? DueDate { get; set; }
    public DateOnly? ReceivedDate { get; set; }
    public string? Notes { get; set; }
    public string? SpecSectionCode { get; set; }       // Spec section requiring this item
}

public enum CloseoutPackageStatus { Draft = 0, InProgress = 1, Submitted = 2, Accepted = 3 }
public enum CloseoutItemStatus { Pending = 0, Requested = 1, Received = 2, Approved = 3, Rejected = 4, NotApplicable = 5 }
public enum CloseoutItemCategory
{
    OMManual = 0,
    AsBuiltDrawing = 1,
    WarrantyLetter = 2,
    LienWaiver = 3,
    InsuranceCertificate = 4,
    InspectionReport = 5,
    TestReport = 6,
    AtticStock = 7,
    TrainingDocumentation = 8,
    CommissioningReport = 9,
    EquipmentStartup = 10,
    Permit = 11,
    CertificateOfOccupancy = 12,
    Other = 13
}
```

### 3.5 `PmDocumentAccessGrant` — Fine-Grained Access Control

Beyond the `AccessLevel` on metadata, specific documents or folders can be shared with external parties:

```csharp
public class PmDocumentAccessGrant : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid? FolderId { get; set; }                // Folder-level access
    public Guid? DocumentId { get; set; }              // Document-level access
    public AccessGrantType GrantType { get; set; }
    public Guid? GrantedToUserId { get; set; }         // Internal user
    public string? GrantedToEmail { get; set; }        // External user (via portal)
    public string? GrantedToCompany { get; set; }      // Company name for audit
    public AccessPermission Permission { get; set; }
    public DateOnly? ExpiresAt { get; set; }           // Auto-revoke after date
    public Guid GrantedByUserId { get; set; }
    public DateTime GrantedAt { get; set; }
    public bool IsActive { get; set; }
}

public enum AccessGrantType { Folder = 0, Document = 1 }
public enum AccessPermission { View = 0, Download = 1, Upload = 2, Edit = 3, Admin = 4 }
```

---

## 4) Core Feature: Project Document Repository

### 4.1 Default Folder Structure

When a project is created, the system auto-generates a standard folder hierarchy:

```
PRJ-2026-001 — Office Tower Phase II
├── 01 - Preconstruction
│   ├── Bid Documents
│   ├── Geotechnical Reports
│   └── Surveys
├── 02 - Contracts
│   ├── Owner Contract
│   ├── Subcontracts
│   └── Insurance & Bonds
├── 03 - Drawings
│   ├── IFC Set
│   ├── Bulletins / ASIs
│   ├── Shop Drawings
│   └── As-Builts
├── 04 - Specifications
├── 05 - Submittals
├── 06 - RFIs
├── 07 - Correspondence
│   ├── Letters
│   ├── Memos
│   └── Emails of Record
├── 08 - Meeting Minutes
│   ├── OAC Meetings
│   └── Sub Coordination
├── 09 - Daily Reports
├── 10 - Change Orders
├── 11 - Pay Applications
│   ├── Owner Billing
│   └── Sub Pay Apps
├── 12 - Photos
│   ├── Progress Photos
│   └── Safety / Incidents
├── 13 - Safety
├── 14 - Inspections & Testing
├── 15 - Permits
└── 16 - Closeout
    ├── O&M Manuals
    ├── Warranties
    ├── As-Builts
    └── Punch List
```

This structure is configurable per company. Companies can create templates that are applied to new projects.

### 4.2 Folder Template Service

```csharp
public interface IFolderTemplateService
{
    /// Creates the default folder structure for a new project
    Task ApplyTemplateAsync(Guid projectId, Guid? templateId, CancellationToken ct);

    /// Gets the company's folder template (or system default)
    Task<List<FolderTemplateNode>> GetTemplateAsync(CancellationToken ct);

    /// Saves a custom company folder template
    Task SaveTemplateAsync(List<FolderTemplateNode> nodes, CancellationToken ct);
}
```

---

## 5) Core Feature: Version Control

### 5.1 How Versioning Works

Every document upload that replaces an existing file creates a new `PmDocumentVersion`:

1. User uploads new version of "Structural S-101 Rev C.pdf"
2. System creates `PmDocumentVersion` with VersionNumber = 3, copies old `PmDocument.StoragePath` to version record
3. `PmDocument.StoragePath` is updated to point to the new file
4. `PmDocument.Checksum` is updated
5. Viewer always sees the latest version; version history is accessible via drill-through

### 5.2 Version Comparison

For document types that support it (PDF, images), the system can show:
- Side-by-side comparison of two versions
- Version metadata: who uploaded, when, what changed (from ChangeNote)
- File size delta

### 5.3 Check-In/Check-Out Workflow

```
Available ──[Check Out]──▶ Locked (by User A)
                              │
                     User A edits locally
                              │
                    ──[Check In + Upload]──▶ Available (new version created)
                              │
                    ──[Cancel Checkout]──▶ Available (no new version)
                              │
         Admin ──[Force Release]──▶ Available (audit logged)
```

### 5.4 Service Interface

```csharp
public interface IDocumentVersionService
{
    Task<PmDocumentVersion> UploadNewVersionAsync(Guid documentId, Stream content, string changeNote, CancellationToken ct);
    Task<List<PmDocumentVersion>> GetVersionHistoryAsync(Guid documentId, CancellationToken ct);
    Task<Stream> DownloadVersionAsync(Guid documentId, int versionNumber, CancellationToken ct);

    // Check-in/check-out
    Task<PmDocumentCheckout> CheckOutAsync(Guid documentId, string? note, CancellationToken ct);
    Task<PmDocumentVersion> CheckInAsync(Guid documentId, Stream content, string changeNote, CancellationToken ct);
    Task CancelCheckoutAsync(Guid documentId, CancellationToken ct);
    Task ForceReleaseCheckoutAsync(Guid documentId, string reason, CancellationToken ct);
}
```

---

## 6) Core Feature: Full-Text Search

### 6.1 Search Architecture

Construction PMs need to find documents by content, not just filename. "Find the RFI where we discussed the waterproofing membrane change" is a real query.

**Phase 1: Metadata Search**
- Search across: FileName, Title, Description, DocumentNumber, Tags, Author, SpecSectionCode
- Filter by: Category, Origin, AccessLevel, DateRange, FolderId, CostCodeId
- PostgreSQL `tsvector` full-text search on metadata fields

**Phase 2: Content Search**
- Extract text from PDFs (pdftotext or iTextSharp)
- Extract text from DOCX (OpenXML SDK)
- OCR for scanned documents (Tesseract or cloud OCR)
- Store extracted text in `PmDocumentMetadata.ExtractedText`
- PostgreSQL full-text search on extracted content

**Phase 3: AI-Enhanced Search**
- Semantic search using embeddings (vector similarity)
- Natural language queries: "show me the letter where we disagreed about the HVAC ductwork routing"
- AI classification: auto-categorize uploads based on content

### 6.2 Search Service

```csharp
public interface IDocumentSearchService
{
    Task<PagedResult<DocumentSearchResult>> SearchAsync(DocumentSearchQuery query, CancellationToken ct);
    Task<List<DocumentSearchResult>> QuickSearchAsync(string searchTerm, Guid projectId, CancellationToken ct);
}

public record DocumentSearchQuery(
    Guid ProjectId,
    string? SearchTerm,
    DocumentCategory? Category,
    DocumentOrigin? Origin,
    Guid? FolderId,
    Guid? CostCodeId,
    string? SpecSectionCode,
    DateOnly? DateFrom,
    DateOnly? DateTo,
    DocumentAccessLevel? MaxAccessLevel,
    bool IncludeContentSearch = false,
    int Page = 1,
    int PageSize = 25
);

public record DocumentSearchResult(
    Guid DocumentId,
    string FileName,
    string? Title,
    DocumentCategory Category,
    string? DocumentNumber,
    long FileSizeBytes,
    string MimeType,
    DateTime UploadedAt,
    string? UploadedByName,
    string? FolderPath,
    string? Snippet,           // Highlighted text match from content search
    decimal? Relevance          // Search relevance score
);
```

### 6.3 PostgreSQL Full-Text Search Setup

```sql
-- Add tsvector column for fast full-text search
ALTER TABLE pm_document_metadata ADD COLUMN search_vector tsvector;

-- Build search vector from multiple fields
CREATE OR REPLACE FUNCTION pm_document_metadata_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW."Title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."Description", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."DocumentNumber", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."Tags", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."Author", '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW."ExtractedText", '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pm_document_metadata_search_vector_trigger
  BEFORE INSERT OR UPDATE ON pm_document_metadata
  FOR EACH ROW EXECUTE FUNCTION pm_document_metadata_search_vector_update();

CREATE INDEX IX_pm_document_metadata_search ON pm_document_metadata USING gin(search_vector);
```

---

## 7) Core Feature: Access Control

### 7.1 Access Control Model

Documents have three layers of access control:

**Layer 1: Role-Based (System-wide)**
| Role | Default Access |
|------|---------------|
| System Admin | Full access to all documents |
| PM / Project Engineer | Full access to their projects |
| Superintendent | Read/upload for their projects |
| Controller/CFO | Read access to financial documents across all projects |
| AP/AR Clerk | Read access to pay apps, invoices, lien waivers |

**Layer 2: Document-Level (`DocumentAccessLevel`)**
| Level | Who Can See |
|-------|-------------|
| Internal | Company employees only |
| Subcontractor | Company + project subcontractors |
| Owner | Company + owner representatives |
| Public | Anyone with link (rare, for bid documents) |

**Layer 3: Explicit Grants (`PmDocumentAccessGrant`)**
- Share specific folders or documents with specific external users
- Time-limited access (auto-expires)
- Permission levels: View, Download, Upload, Edit, Admin

### 7.2 Access Check Service

```csharp
public interface IDocumentAccessService
{
    /// Checks if a user can perform an action on a document
    Task<bool> CanAccessAsync(Guid userId, Guid documentId, AccessPermission requiredPermission, CancellationToken ct);

    /// Returns all documents the user can see in a project (for listing)
    Task<IQueryable<PmDocument>> GetAccessibleDocumentsAsync(Guid userId, Guid projectId, CancellationToken ct);

    /// Grants access to a document or folder
    Task<PmDocumentAccessGrant> GrantAccessAsync(GrantAccessCommand cmd, CancellationToken ct);

    /// Revokes access
    Task RevokeAccessAsync(Guid grantId, CancellationToken ct);
}
```

### 7.3 Subcontractor Portal Access

Subcontractors access documents through the external portal (Pitbull.Portal module). They see:
- Documents in folders shared with them
- Submittals they've been assigned to
- Their pay applications and lien waivers
- Drawings marked as "Subcontractor" access level
- They can upload: submittals, insurance certs, pay apps, closeout items

They **cannot** see:
- Internal correspondence
- Cost/budget information
- Other subcontractors' documents
- Meeting minutes (unless explicitly shared)

---

## 8) Core Feature: Bulk Upload & Processing

### 8.1 Bulk Upload Workflow

PMs frequently receive hundreds of files at once (a complete drawing set, a spec package, closeout docs from a sub). Bulk upload must be fast and smart:

1. **Drag and drop** multiple files (or select folder)
2. **Auto-classify** based on filename patterns and content:
   - `S-101.pdf` → Category: Drawing, Discipline: Structural
   - `03 30 00 - Cast in Place Concrete.pdf` → Category: Specification, SpecSectionCode: 03 30 00
   - `Insurance Certificate - ABC Electric.pdf` → Category: InsuranceBond
3. **Batch metadata** — apply common metadata to all files in the upload (folder, phase, tags)
4. **Review and confirm** — user reviews auto-classification, corrects any errors
5. **Upload and process** — files upload with progress indicator

### 8.2 Filename Pattern Recognition

```csharp
public interface IDocumentClassificationService
{
    /// Classifies a document based on filename, MIME type, and optionally content
    Task<DocumentClassification> ClassifyAsync(string fileName, string mimeType, Stream? content, CancellationToken ct);
}

public record DocumentClassification(
    DocumentCategory SuggestedCategory,
    string? SuggestedSubCategory,
    string? SuggestedSpecSection,
    PlanDiscipline? SuggestedDiscipline,
    string? SuggestedDrawingNumber,
    decimal Confidence
);
```

**Pattern examples:**
| Filename Pattern | Classification |
|-----------------|---------------|
| `A-101`, `A1.1` | Drawing, Architectural |
| `S-201`, `S2.1` | Drawing, Structural |
| `M-301`, `M3.1` | Drawing, Mechanical |
| `E-401`, `E4.1` | Drawing, Electrical |
| `03 30 00*` | Specification, Div 03 |
| `*O&M*`, `*Operation*Maintenance*` | OMManual |
| `*warranty*` | Warranty |
| `*lien*waiver*` | LienWaiver |
| `*insurance*cert*`, `*COI*` | InsuranceBond |
| `*daily*report*` | DailyReport |
| `*RFI*` | RFI |

### 8.3 Upload Limits

| Limit | Value | Rationale |
|-------|-------|-----------|
| Single file max | 50 MB | Construction drawings can be 20-30 MB |
| Batch upload max | 500 MB | A full drawing set can be 200-400 MB |
| Files per batch | 200 | Practical UI limit |
| Allowed types | Images, PDF, Office, CAD/BIM, text, archives | See `IFileValidationService` |
| Blocked types | Executables, scripts | Security |

---

## 9) Core Feature: Document Transmittals

### 9.1 Transmittal Workflow

```
Draft ──[Add Items]──▶ Ready ──[Send]──▶ Sent ──[Recipient Acknowledges]──▶ Acknowledged
                                                           │
                                                     ──[No Response]──▶ Follow-up notification
```

### 9.2 Transmittal Cover Sheet (PDF)

The generated transmittal PDF includes:

```
┌──────────────────────────────────────────────────────┐
│  [COMPANY LOGO]           TRANSMITTAL                │
│  Company Name                                        │
│  Address                      No: T-047              │
│  Phone / Email                Date: Jan 15, 2026     │
│                                                      │
│  TO:                          PROJECT:               │
│  John Smith                   Office Tower Phase II  │
│  ABC Architecture             PRJ-2026-001           │
│  123 Main Street                                     │
│                                                      │
│  RE: Revised Structural Drawings per ASI-007         │
│                                                      │
│  ┌──────┬────────────────┬─────────┬────────┬──────┐ │
│  │ Item │ Description    │ Dwg No  │ Rev    │ Qty  │ │
│  ├──────┼────────────────┼─────────┼────────┼──────┤ │
│  │  1   │ Foundation Pln │ S-101   │ C      │  2   │ │
│  │  2   │ Framing Plan   │ S-201   │ C      │  2   │ │
│  │  3   │ Detail Sheet   │ S-501   │ B      │  2   │ │
│  └──────┴────────────────┴─────────┴────────┴──────┘ │
│                                                      │
│  ACTION:  ☑ For Your Use  ☐ For Review               │
│           ☐ For Approval  ☐ As Requested             │
│                                                      │
│  REMARKS: Please note revised column sizes on S-201. │
│  Confirm no impact to MEP coordination.              │
│                                                      │
│  SENT BY: Mike Chen, PM        CC: Tom Reilly, VP    │
│                                                      │
│  ☐ ACKNOWLEDGED: _____________ DATE: _____________   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 9.3 Digital Acknowledgment

Recipients can acknowledge via:
- Email link → acknowledgment page (no login required, token-based)
- Portal login → acknowledge button
- System tracks: acknowledged by, date/time, IP address

---

## 10) Core Feature: Closeout Packages

### 10.1 Why Closeout Is Hard

Closeout is the PM's most hated task. It requires collecting dozens of documents from 20+ subcontractors, verifying each one, and assembling them into a package that meets the owner's requirements and the specification.

**Typical closeout items by spec section:**
- Every spec section that requires a submittal also requires a closeout document
- O&M manuals for every mechanical/electrical system
- Warranty letters for every product/system
- As-built markups for every trade
- Test and inspection reports
- Commissioning records

### 10.2 Closeout Tracking Dashboard

The closeout package page shows a checklist:

| Item | Spec Section | Responsible | Status | Due Date | Document |
|------|-------------|-------------|--------|----------|----------|
| Mechanical O&M Manual | 23 01 00 | ABC Mechanical | Received | Jan 15 | [View] |
| Electrical O&M Manual | 26 01 00 | XYZ Electric | Requested | Jan 30 | — |
| Roofing Warranty | 07 50 00 | DEF Roofing | Pending | Feb 15 | — |
| Fire Alarm Inspection | 28 31 00 | GHI Fire | Approved | Jan 10 | [View] |

**Progress bar:** 42 of 78 items received (54%)

### 10.3 Automated Closeout Requests

The system can auto-generate request emails to subcontractors for their closeout items:

```
Subject: Closeout Documents Required — Office Tower Phase II

Dear ABC Mechanical,

The following closeout documents are required for your scope on Office Tower Phase II:

1. Mechanical O&M Manual (Spec Section 23 01 00) — Due: January 15, 2026
2. Equipment Warranty Letters (Spec Section 23 05 00) — Due: January 15, 2026
3. As-Built Drawings (Spec Section 23 00 00) — Due: January 30, 2026

Please upload these documents via your portal at [link] or email them to mike.chen@acmeconstruction.com.

Final retention release is contingent upon receipt of all required closeout documents.

Best regards,
Mike Chen, Project Manager
```

---

## 11) Core Feature: Thumbnail Preview & Viewer

### 11.1 Thumbnail Generation

For visual browsing (especially photos and drawings), generate thumbnails on upload:

| File Type | Thumbnail Method |
|-----------|-----------------|
| Images (JPEG, PNG) | Resize to 200x200px |
| PDF | Render first page at 200x200px (ImageMagick or MuPdf) |
| Office docs | Convert first page to image (LibreOffice headless) |
| CAD (.dwg, .dwf) | Placeholder icon (Phase 1), render preview (Phase 3) |
| Video | Extract frame at 1 second |
| Other | File-type icon |

### 11.2 In-Browser Document Viewer

| File Type | Viewer |
|-----------|--------|
| PDF | Browser native PDF viewer or PDF.js |
| Images | Lightbox with zoom/pan |
| Office docs | Convert to PDF on-the-fly (LibreOffice) |
| Video | HTML5 video player |
| Text/CSV | Syntax-highlighted code viewer |
| Other | Download only |

---

## 12) Integration Points

### 12.1 Document ↔ RFI

| Direction | What | How |
|-----------|------|-----|
| RFI → Document | RFI attachments (question, response, reference) | `RfiAttachment.DocumentId` → `PmDocument` |
| Document → RFI | Search shows which RFI references a drawing | Metadata query by RelatedEntityType = "Rfi" |
| Auto-link | When RFI references a drawing number, link to the drawing document | AI or pattern matching on RFI subject/body |

### 12.2 Document ↔ Submittal

| Direction | What | How |
|-----------|------|-----|
| Submittal → Document | Submittal attachments (primary, supporting, response) | `PmSubmittalAttachment.DocumentId` → `PmDocument` |
| Submittal → Spec | Submittal references spec section | `PmSubmittal.SpecSectionCode` → `PmSpecSection.DocumentId` |
| Closeout | Submittal approval docs feed closeout package | Auto-populate closeout items from approved submittals |

### 12.3 Document ↔ Daily Report

| Direction | What | How |
|-----------|------|-----|
| Daily Report → Document | Photos with GPS and timestamp | `PmDailyReportPhoto.DocumentId` → `PmDocument` |
| AI → Daily Report | Photo auto-captioning | Vision API generates captions for uploaded photos |
| Daily Report → Closeout | Daily reports are part of the project record | Archived as closeout documentation |

### 12.4 Document ↔ Contract / Change Order

| Direction | What | How |
|-----------|------|-----|
| Contract → Document | Signed contract PDFs | Folder: "02 - Contracts", Category: Contract |
| Change Order → Document | CO backup documentation (proposals, correspondence) | `FileAttachment` with RelatedEntityType = "ChangeOrder" |
| Lien Waiver → Document | Signed lien waiver PDFs | Category: LienWaiver, linked to pay app via `BillingPackageDocument` |

### 12.5 Document ↔ Billing

| Direction | What | How |
|-----------|------|-----|
| Billing → Document | G702/G703 PDFs, supporting docs | `BillingPackageDocument` tracks required/received status |
| Pay App → Document | Sub pay apps with backup | `FileAttachment` with RelatedEntityType = "PaymentApplication" |
| AI → Invoice | Vision API extracts data from uploaded invoices | Existing `AiDocumentController` |

### 12.6 Document ↔ Schedule

| Direction | What | How |
|-----------|------|-----|
| Drawing → Schedule | Drawing revision triggers activity re-sequencing | ASI/Bulletin linked to affected schedule activities |
| Schedule → Closeout | Schedule tracks closeout milestone dates | Closeout item due dates derived from schedule |

---

## 13) API Design

### 13.1 Documents CRUD

```
POST   /api/projects/{projectId}/documents                             Upload document
POST   /api/projects/{projectId}/documents/bulk                        Bulk upload
GET    /api/projects/{projectId}/documents                             List with filters
GET    /api/projects/{projectId}/documents/{docId}                     Get document details
GET    /api/projects/{projectId}/documents/{docId}/download            Download file
PUT    /api/projects/{projectId}/documents/{docId}                     Update metadata
DELETE /api/projects/{projectId}/documents/{docId}                     Soft delete
```

### 13.2 Folders

```
GET    /api/projects/{projectId}/documents/folders                     List folder tree
POST   /api/projects/{projectId}/documents/folders                     Create folder
PUT    /api/projects/{projectId}/documents/folders/{folderId}          Rename/move folder
DELETE /api/projects/{projectId}/documents/folders/{folderId}          Delete empty folder
POST   /api/projects/{projectId}/documents/folders/initialize          Apply folder template
```

### 13.3 Versioning & Checkout

```
GET    /api/projects/{projectId}/documents/{docId}/versions            Version history
POST   /api/projects/{projectId}/documents/{docId}/versions            Upload new version
GET    /api/projects/{projectId}/documents/{docId}/versions/{ver}/download  Download specific version
POST   /api/projects/{projectId}/documents/{docId}/checkout            Check out
POST   /api/projects/{projectId}/documents/{docId}/checkin             Check in (with upload)
DELETE /api/projects/{projectId}/documents/{docId}/checkout            Cancel checkout
POST   /api/projects/{projectId}/documents/{docId}/checkout/force-release  Admin force release
```

### 13.4 Search

```
GET    /api/projects/{projectId}/documents/search?q={term}&category={cat}...   Full search
GET    /api/projects/{projectId}/documents/quick-search?q={term}               Quick search (top 10)
```

### 13.5 Transmittals

```
POST   /api/projects/{projectId}/transmittals                          Create transmittal
GET    /api/projects/{projectId}/transmittals                          List transmittals
GET    /api/projects/{projectId}/transmittals/{id}                     Get transmittal detail
PUT    /api/projects/{projectId}/transmittals/{id}                     Update transmittal
POST   /api/projects/{projectId}/transmittals/{id}/send                Send transmittal
GET    /api/projects/{projectId}/transmittals/{id}/pdf                 Download cover sheet PDF
POST   /api/projects/{projectId}/transmittals/{id}/acknowledge         Acknowledge receipt
```

### 13.6 Closeout Packages

```
POST   /api/projects/{projectId}/closeout-packages                     Create closeout package
GET    /api/projects/{projectId}/closeout-packages                     List packages
GET    /api/projects/{projectId}/closeout-packages/{id}                Get package with items
POST   /api/projects/{projectId}/closeout-packages/{id}/items          Add item
PUT    /api/projects/{projectId}/closeout-packages/{id}/items/{itemId} Update item status
POST   /api/projects/{projectId}/closeout-packages/{id}/request-docs   Send bulk requests to subs
POST   /api/projects/{projectId}/closeout-packages/{id}/submit         Submit package to owner
GET    /api/projects/{projectId}/closeout-packages/{id}/pdf            Download compiled package
```

### 13.7 Access Control

```
POST   /api/projects/{projectId}/documents/access-grants               Grant access
GET    /api/projects/{projectId}/documents/access-grants               List grants
DELETE /api/projects/{projectId}/documents/access-grants/{id}          Revoke access
```

### 13.8 Thumbnails & Preview

```
GET    /api/projects/{projectId}/documents/{docId}/thumbnail           Get thumbnail
GET    /api/projects/{projectId}/documents/{docId}/preview             Get preview (PDF conversion)
```

---

## 14) Database Considerations

### 14.1 New Tables (Require Migration)

| Table | Entity | Key Indexes |
|-------|--------|-------------|
| `pm_document_metadata` | PmDocumentMetadata | (TenantId, CompanyId, ProjectId), (DocumentId), GIN(search_vector), (Category), (ExpirationDate) |
| `pm_document_checkouts` | PmDocumentCheckout | (DocumentId, IsActive), (CheckedOutByUserId) |
| `pm_transmittals` | PmTransmittal | (TenantId, CompanyId, ProjectId), (TransmittalNumber) |
| `pm_transmittal_items` | PmTransmittalItem | (TransmittalId) |
| `pm_closeout_packages` | PmCloseoutPackage | (TenantId, CompanyId, ProjectId) |
| `pm_closeout_package_items` | PmCloseoutPackageItem | (CloseoutPackageId), (Status) |
| `pm_document_access_grants` | PmDocumentAccessGrant | (ProjectId, DocumentId), (ProjectId, FolderId), (GrantedToUserId), (ExpiresAt) |

### 14.2 Storage Estimates

| Project Size | Documents | Storage | Notes |
|-------------|-----------|---------|-------|
| $5M (small) | 1,000-3,000 | 5-15 GB | Mostly PDFs and photos |
| $20M (mid) | 5,000-15,000 | 20-75 GB | Full drawing sets, submittals |
| $100M (large) | 20,000-50,000 | 100-500 GB | Multiple buildings, phases |

**S3-compatible storage** is the target for production. LocalFileSystem for development only.

### 14.3 Query Patterns

| Query | Expected Volume | Strategy |
|-------|----------------|----------|
| Folder contents | 20-200 docs/folder | Filter by FolderId, paginate |
| Full-text search | All project docs | PostgreSQL GIN index on tsvector |
| Category filter | Varies | Index on Category column |
| Expiring documents | 5-20 docs | Index on ExpirationDate WHERE NOT null |
| Access check | Per request | Cache grants per user session |
| Transmittal list | 50-200/project | Paginated, sorted by date |
| Closeout status | 50-150 items | Single query per package |

---

## 15) Frontend Pages

### 15.1 Page Map

| Page | Route | Purpose |
|------|-------|---------|
| Document Browser | `/projects/{id}/documents` | Folder tree + file list (primary workspace) |
| Document Detail | `/projects/{id}/documents/{docId}` | Metadata, versions, preview, access |
| Search | `/projects/{id}/documents/search` | Full-text search with filters |
| Upload | `/projects/{id}/documents/upload` | Bulk upload with classification |
| Transmittals | `/projects/{id}/transmittals` | Transmittal log |
| Transmittal Detail | `/projects/{id}/transmittals/{id}` | Items, cover sheet, status |
| Closeout | `/projects/{id}/closeout` | Closeout package checklist |
| Closeout Detail | `/projects/{id}/closeout/{id}` | Item-level tracking |

### 15.2 Document Browser (Primary Page)

Split-pane layout:

**Left pane (25%):** Folder tree
- Collapsible hierarchy matching project folder structure
- Drag-and-drop to move documents between folders
- Right-click: New folder, rename, delete
- Badge counts showing document count per folder

**Right pane (75%):** File list
- View toggle: List / Grid (thumbnails) / Detail
- Sort: Name, Date, Size, Category, Status
- Multi-select for bulk operations (move, delete, download ZIP, create transmittal)
- Quick actions: Download, Preview, Share, Version History, Check Out
- Inline metadata editing (click to edit title, category, tags)

**Toolbar:**
- Upload button (single + bulk)
- Search bar (quick search → full search page)
- Filter chips: Category, Origin, Date Range, Status
- New Transmittal (from selected documents)

### 15.3 Upload Page

Step-by-step wizard:

**Step 1: Select Files**
- Drag-and-drop zone (large, prominent)
- Or click to browse
- File count, total size, any rejected files shown
- Progress bar during upload

**Step 2: Classify**
- Table showing each file with auto-suggested classification
- Editable columns: Category, Title, SpecSection, Tags
- Batch apply: set folder/category/tags for all selected files
- AI classify button: "Auto-classify remaining"

**Step 3: Confirm**
- Final review of all files with metadata
- Confirm button → uploads with progress

### 15.4 Closeout Package Page

Kanban-style view:

**Columns:** Pending → Requested → Received → Approved
**Cards:** Each closeout item with responsible party, due date, spec section
**Progress bar:** Overall completion percentage
**Actions:** Request docs (bulk email), upload item, approve/reject, generate report

---

## 16) Competitive Differentiation

| Capability | SharePoint | Procore Docs | Pitbull |
|-----------|------------|-------------|---------|
| **Construction context** | None — generic file storage | Good — project-scoped | Best — connected to RFIs, submittals, schedule, billing, cost |
| **Price** | $12.50/user/month (M365) | Included in $400+/user/month platform | Included in ERP subscription |
| **Search** | Basic filename search | Good metadata search | Full-text + content search + AI semantic (Phase 3) |
| **Version control** | Check-in/check-out | Version history | Both: check-in/check-out + version history |
| **Transmittals** | None — use email | Basic correspondence | Formal numbered transmittals with cover sheet PDF, acknowledgment tracking |
| **Closeout** | Manual folder organization | Basic checklist | Structured closeout packages with sub notifications, progress tracking, compiled PDF |
| **Mobile** | SharePoint mobile app (mediocre) | Good mobile app | Responsive web, same app |
| **CAD/BIM** | View only with add-ons | View only | View (Phase 1), BIM integration (Phase 3) |
| **AI** | Copilot (generic, not construction) | None | Document classification, content extraction, AI search |
| **Access control** | Complex SharePoint permissions | Project-level roles | Three-layer: role + document level + explicit grants |
| **GL integration** | None | None | Documents linked to invoices, pay apps, journal entries |
| **Billing integration** | None | Separate module | Billing package documents tracked as required/received |
| **RFI/Submittal integration** | None | Same platform, good | Same platform + cross-entity search + closeout auto-population |

**The killer advantage:** In SharePoint, a document is a file in a folder. In Procore, a document is a file in a project. In Pitbull, a document is a file that knows what it is, who it's for, what spec section it satisfies, which RFI it answers, which submittal it supports, which schedule activity it affects, and whether it's been received for closeout. Context is everything.

---

## 17) Implementation Phases

### Phase 1: Foundation

1. `PmDocumentMetadata` entity + EF configuration + migration
2. `PmDocumentCheckout` entity + EF configuration + migration
3. Default folder template system
4. Enhanced document upload with metadata and classification
5. Version history UI (existing `PmDocumentVersion`)
6. Check-in/check-out workflow
7. Metadata search (PostgreSQL full-text on metadata fields)
8. Frontend: Document Browser (folder tree + file list), Upload page, Document Detail
9. Unit tests

### Phase 2: Transmittals & Distribution

1. `PmTransmittal` + `PmTransmittalItem` entities + migration
2. Transmittal cover sheet PDF generation (using existing template engine)
3. Email delivery with acknowledgment tracking
4. Frontend: Transmittal list and detail pages
5. Bulk document operations (ZIP download, multi-select move)
6. Thumbnail generation for PDFs and images

### Phase 3: Closeout & Access Control

1. `PmCloseoutPackage` + `PmCloseoutPackageItem` entities + migration
2. `PmDocumentAccessGrant` entity + migration
3. Closeout package assembly workflow
4. Automated closeout document requests to subcontractors
5. Compiled closeout package PDF export
6. Access control enforcement (three-layer model)
7. Frontend: Closeout Package pages, Access Grant UI

### Phase 4: Intelligence

1. Full-text content extraction (PDF text, DOCX, OCR)
2. PostgreSQL full-text search on extracted content
3. AI-powered document classification (auto-categorize uploads)
4. AI-powered search (semantic similarity)
5. S3-compatible storage provider implementation
6. In-browser document viewer (PDF.js, image lightbox)
7. BIM/CAD file preview

---

## 18) Acceptance Criteria

1. PM can upload a document and assign it to a folder, category, and spec section
2. Bulk upload of 50 files with auto-classification completes in < 60 seconds
3. Full-text metadata search returns relevant results within 200ms for a 10,000-document project
4. Version history shows all past versions with download and change notes
5. Check-out prevents other users from uploading new versions (read/download remains available)
6. Transmittal generates a professional cover sheet PDF with item list and acknowledgment block
7. Closeout package tracks required vs. received documents with progress percentage
8. Subcontractors can only see documents at their access level or explicitly shared
9. Documents are linked to RFIs, submittals, and other entities via existing attachment tables
10. Default folder structure is auto-created for new projects
11. Expiring documents (insurance certs, permits) surface in dashboard alerts
12. All uploads are validated against blocked file types and size limits

---

## 19) Open Decisions

1. **Storage provider for production:** S3-compatible (Railway supports S3 via Tigris) vs. Azure Blob Storage? S3 is more portable for self-hosted customers.
2. **Full-text extraction library:** iTextSharp (C#, mature) vs. Apache Tika (Java, more formats) vs. cloud API? iTextSharp keeps it in-process.
3. **OCR for scanned documents:** Tesseract (open source, on-premise) vs. Google Cloud Vision vs. Azure AI Document Intelligence? Tesseract for self-hosted, cloud for SaaS.
4. **Thumbnail generation:** ImageMagick (system dependency) vs. SkiaSharp (pure C#) vs. MuPdf? SkiaSharp avoids system dependencies.
5. **CAD file preview:** No good open-source DWG viewer exists. Accept download-only for DWG in Phase 1? Or integrate with Autodesk Viewer API (free tier available)?
6. **Maximum file size:** 50 MB per file currently. Construction drawings and BIM models can be 100-500 MB. Increase to 200 MB with chunked upload?
7. **Document retention policy:** How long to keep deleted documents before permanent removal? Recommendation: 7 years (construction statute of repose in most states).

---

*Addresses Executive Review concerns: PMs spending 45 min/day searching for files, closeout packages taking weeks to assemble, subcontractor document exchange via email.*
*References existing infrastructure: `Pitbull.Documents` module (FileAttachment, IFileValidationService, IFileStorageService), `Pitbull.ProjectManagement` (PmDocument, PmDocumentVersion, PmDocumentFolder, all attachment entities).*
