using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectManagementModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "pm_activity_progress",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProgressEntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    ScheduleActivityId = table.Column<Guid>(type: "uuid", nullable: false),
                    PercentComplete = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    InstalledQuantity = table.Column<decimal>(type: "numeric", nullable: true),
                    Unit = table.Column<string>(type: "text", nullable: true),
                    EarnedHours = table.Column<decimal>(type: "numeric", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_activity_progress", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_communication_attachments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    CommunicationId = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentId = table.Column<Guid>(type: "uuid", nullable: false),
                    FileName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    MimeType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_communication_attachments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_communications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    CommunicationType = table.Column<int>(type: "integer", nullable: false),
                    Direction = table.Column<int>(type: "integer", nullable: false),
                    Subject = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Body = table.Column<string>(type: "character varying(5000)", maxLength: 5000, nullable: true),
                    FromName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    FromEmail = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ToName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ToEmail = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ReferenceType = table.Column<int>(type: "integer", nullable: false),
                    ReferenceId = table.Column<Guid>(type: "uuid", nullable: true),
                    FollowUpDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_communications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_cost_code_progress",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProgressEntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    CostCodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    PhaseId = table.Column<Guid>(type: "uuid", nullable: true),
                    PercentComplete = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    EarnedValueAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_cost_code_progress", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_daily_report_crews",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    DailyReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Trade = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    HeadCount = table.Column<int>(type: "integer", nullable: false),
                    HoursWorked = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_daily_report_crews", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_daily_report_deliveries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    DailyReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    VendorName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    MaterialDescription = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    Unit = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    RelatedCostCodeId = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_daily_report_deliveries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_daily_report_equipment",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    DailyReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    EquipmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    EquipmentName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    HoursUsed = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_daily_report_equipment", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_daily_report_photos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    DailyReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentId = table.Column<Guid>(type: "uuid", nullable: false),
                    Caption = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    TakenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TakenByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Latitude = table.Column<decimal>(type: "numeric(9,6)", precision: 9, scale: 6, nullable: true),
                    Longitude = table.Column<decimal>(type: "numeric(9,6)", precision: 9, scale: 6, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_daily_report_photos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_daily_report_rollups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParentDailyReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    ChildDailyReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_daily_report_rollups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_daily_report_safety_incidents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    DailyReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    IncidentType = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Severity = table.Column<int>(type: "integer", nullable: false),
                    ReportedTo = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_daily_report_safety_incidents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_daily_report_visitors",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    DailyReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Company = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Purpose = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    TimeIn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TimeOut = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_daily_report_visitors", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_daily_reports",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReportDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReportType = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    WeatherSummary = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    TemperatureLow = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: true),
                    TemperatureHigh = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: true),
                    Precipitation = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Wind = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    WorkNarrative = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    DelaysNarrative = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    SafetyNarrative = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    PreparedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_daily_reports", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_document_distributions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentType = table.Column<int>(type: "integer", nullable: false),
                    ReferenceId = table.Column<Guid>(type: "uuid", nullable: true),
                    RecipientUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    RecipientName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RecipientEmail = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AcknowledgedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DistributionMethod = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_document_distributions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_document_folders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParentFolderId = table.Column<Guid>(type: "uuid", nullable: true),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    FolderType = table.Column<int>(type: "integer", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_document_folders", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_document_templates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateType = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Engine = table.Column<int>(type: "integer", nullable: false),
                    BodyTemplate = table.Column<string>(type: "text", nullable: false),
                    HeaderTemplate = table.Column<string>(type: "text", nullable: true),
                    FooterTemplate = table.Column<string>(type: "text", nullable: true),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_document_templates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_document_versions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentId = table.Column<Guid>(type: "uuid", nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false),
                    StoragePath = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    FileSizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    UploadedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ChangeNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_document_versions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_documents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    FileName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    MimeType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    FileSizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    StoragePath = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    StorageProvider = table.Column<int>(type: "integer", nullable: false),
                    Checksum = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    UploadedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_documents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_earned_value_snapshots",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    SnapshotDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    BCWS = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    BCWP = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ACWP = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CPI = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: true),
                    SPI = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: true),
                    EstimateAtCompletion = table.Column<decimal>(type: "numeric", nullable: true),
                    VarianceAtCompletion = table.Column<decimal>(type: "numeric", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_earned_value_snapshots", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_generated_documents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentType = table.Column<int>(type: "integer", nullable: false),
                    ReferenceType = table.Column<int>(type: "integer", nullable: false),
                    ReferenceId = table.Column<Guid>(type: "uuid", nullable: true),
                    GeneratedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    GeneratedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    OutputFormat = table.Column<int>(type: "integer", nullable: false),
                    DocumentId = table.Column<Guid>(type: "uuid", nullable: false),
                    MergeDataJson = table.Column<string>(type: "text", nullable: true),
                    LetterheadConfigId = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_generated_documents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_job_cost_actuals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    CostCodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    PhaseId = table.Column<Guid>(type: "uuid", nullable: true),
                    AsOfDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LaborCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MaterialCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    EquipmentCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    SubcontractCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OtherCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalActualCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    SourceType = table.Column<int>(type: "integer", nullable: false),
                    SourceReferenceId = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_job_cost_actuals", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_job_cost_budgets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    CostCodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    PhaseId = table.Column<Guid>(type: "uuid", nullable: true),
                    OriginalBudget = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ApprovedBudgetChanges = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CurrentBudget = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    BudgetUnits = table.Column<decimal>(type: "numeric", nullable: true),
                    UnitOfMeasure = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    BudgetUnitCost = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    LaborBurdenRate = table.Column<decimal>(type: "numeric(8,4)", precision: 8, scale: 4, nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_job_cost_budgets", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_job_cost_commitments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    CostCodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    PhaseId = table.Column<Guid>(type: "uuid", nullable: true),
                    CommitmentType = table.Column<int>(type: "integer", nullable: false),
                    ReferenceId = table.Column<Guid>(type: "uuid", nullable: true),
                    OriginalCommittedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ApprovedChangesAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CurrentCommittedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    BilledToDate = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PaidToDate = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RemainingCommitted = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_job_cost_commitments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_job_cost_forecasts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    CostCodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    PhaseId = table.Column<Guid>(type: "uuid", nullable: true),
                    ForecastPeriod = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ActualToDate = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CommittedToDate = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CostToComplete = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    EstimatedFinalCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    VarianceToBudget = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ForecastConfidence = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_job_cost_forecasts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_job_cost_unit_progress",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    CostCodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    PhaseId = table.Column<Guid>(type: "uuid", nullable: true),
                    PeriodDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    InstalledQuantity = table.Column<decimal>(type: "numeric", nullable: false),
                    InstalledUnit = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    CumulativeQuantity = table.Column<decimal>(type: "numeric", nullable: false),
                    CumulativeCost = table.Column<decimal>(type: "numeric", nullable: false),
                    CostPerUnit = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_job_cost_unit_progress", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_letterhead_configs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    LogoDocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                    PrimaryColor = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    SecondaryColor = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    AddressBlock = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Phone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Email = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Website = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_letterhead_configs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_meeting_action_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    MeetingId = table.Column<Guid>(type: "uuid", nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    AssigneeUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    AssigneeName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    DueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ClosedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_meeting_action_items", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_meeting_agenda_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    MeetingId = table.Column<Guid>(type: "uuid", nullable: false),
                    ItemNumber = table.Column<int>(type: "integer", nullable: false),
                    Topic = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    PresenterUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_meeting_agenda_items", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_meeting_attachments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    MeetingId = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentId = table.Column<Guid>(type: "uuid", nullable: false),
                    AttachmentRole = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_meeting_attachments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_meeting_minutes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    MeetingId = table.Column<Guid>(type: "uuid", nullable: false),
                    MinuteText = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: false),
                    RecordedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_meeting_minutes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_meeting_series",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    MeetingType = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    RecurrenceRule = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    StartDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_meeting_series", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_meetings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    MeetingSeriesId = table.Column<Guid>(type: "uuid", nullable: true),
                    MeetingType = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Location = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    VirtualMeetingUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ScheduledStart = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ScheduledEnd = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ActualStart = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ActualEnd = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    AgendaTemplateId = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_meetings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_monthly_projections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectionMonth = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ContractValueOriginal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ApprovedChangeOrders = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PendingChangeOrders = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    AdjustedContractValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RevenueRecognizedToDate = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PercentComplete = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    ProjectedFinalRevenue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ProjectedFinalCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ProjectedMargin = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ProjectionStatus = table.Column<int>(type: "integer", nullable: false),
                    PreparedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Notes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_monthly_projections", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_plan_sets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Discipline = table.Column<int>(type: "integer", nullable: false),
                    IssueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Revision = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_plan_sets", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_plan_sheet_revisions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanSheetId = table.Column<Guid>(type: "uuid", nullable: false),
                    RevisionNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    RevisionDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RevisionDescription = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    DocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                    IssuedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_plan_sheet_revisions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_plan_sheets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanSetId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    DrawingNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Discipline = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CurrentRevision = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Scale = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    DocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_plan_sheets", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_progress_entries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProgressDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EnteredByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    EntryType = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_progress_entries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_progress_time_entry_links",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProgressEntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    TimeEntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_progress_time_entry_links", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_project_narrative_revisions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    NarrativeId = table.Column<Guid>(type: "uuid", nullable: false),
                    RevisionNumber = table.Column<int>(type: "integer", nullable: false),
                    ContentSnapshotJson = table.Column<string>(type: "text", nullable: false),
                    RevisedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    RevisedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RevisionNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_project_narrative_revisions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_project_narratives",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    NarrativeMonth = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: true),
                    ExecutiveSummary = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    KeyAccomplishments = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    UpcomingMilestones = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    RisksAndConcerns = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    FinancialSummary = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    ScheduleSummary = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    GeneratedDraftText = table.Column<string>(type: "text", nullable: true),
                    FinalizedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PreparedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_project_narratives", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_projection_cost_codes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    MonthlyProjectionId = table.Column<Guid>(type: "uuid", nullable: false),
                    CostCodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    PhaseId = table.Column<Guid>(type: "uuid", nullable: true),
                    OriginalBudget = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CurrentBudget = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    EAC = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Variance = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_projection_cost_codes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_rfi_attachments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    RfiId = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentId = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentRole = table.Column<int>(type: "integer", nullable: false),
                    FileName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    MimeType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    FileSizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    RevisionTag = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_rfi_attachments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_rfi_cost_impact_links",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    RfiId = table.Column<Guid>(type: "uuid", nullable: false),
                    CostCodeId = table.Column<Guid>(type: "uuid", nullable: true),
                    ChangeOrderId = table.Column<Guid>(type: "uuid", nullable: true),
                    ImpactType = table.Column<int>(type: "integer", nullable: false),
                    EstimatedCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    EstimatedDays = table.Column<int>(type: "integer", nullable: true),
                    ApprovedCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    ApprovedDays = table.Column<int>(type: "integer", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_rfi_cost_impact_links", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_rfi_distribution_recipients",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    RfiId = table.Column<Guid>(type: "uuid", nullable: false),
                    RecipientType = table.Column<int>(type: "integer", nullable: false),
                    RecipientUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    RecipientName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RecipientEmail = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AcknowledgedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_rfi_distribution_recipients", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_s_curve_points",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    CurveDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PlannedPercent = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    ActualPercent = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    EarnedPercent = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_s_curve_points", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_schedule_activities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ScheduleId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParentActivityId = table.Column<Guid>(type: "uuid", nullable: true),
                    WbsCode = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ActivityCode = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    ActivityType = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    OriginalDurationDays = table.Column<int>(type: "integer", nullable: false),
                    RemainingDurationDays = table.Column<int>(type: "integer", nullable: false),
                    PlannedStart = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PlannedFinish = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EarlyStart = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EarlyFinish = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LateStart = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LateFinish = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ActualStart = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ActualFinish = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TotalFloatDays = table.Column<int>(type: "integer", nullable: true),
                    FreeFloatDays = table.Column<int>(type: "integer", nullable: true),
                    PercentComplete = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    IsCritical = table.Column<bool>(type: "boolean", nullable: false),
                    CostCodeId = table.Column<Guid>(type: "uuid", nullable: true),
                    PhaseId = table.Column<Guid>(type: "uuid", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_schedule_activities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_schedule_baseline_activities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    BaselineId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActivityId = table.Column<Guid>(type: "uuid", nullable: false),
                    BaselineStart = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    BaselineFinish = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    BaselineDurationDays = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_schedule_baseline_activities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_schedule_baselines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ScheduleId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    BaselineType = table.Column<int>(type: "integer", nullable: false),
                    CapturedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CapturedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceVersion = table.Column<string>(type: "text", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_schedule_baselines", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_schedule_calendar_exceptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ScheduleId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExceptionType = table.Column<int>(type: "integer", nullable: false),
                    WorkHours = table.Column<decimal>(type: "numeric", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_schedule_calendar_exceptions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_schedule_dependencies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ScheduleId = table.Column<Guid>(type: "uuid", nullable: false),
                    PredecessorActivityId = table.Column<Guid>(type: "uuid", nullable: false),
                    SuccessorActivityId = table.Column<Guid>(type: "uuid", nullable: false),
                    DependencyType = table.Column<int>(type: "integer", nullable: false),
                    LagDays = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_schedule_dependencies", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_schedule_import_logs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    ScheduleId = table.Column<Guid>(type: "uuid", nullable: true),
                    ImportSource = table.Column<int>(type: "integer", nullable: false),
                    ImportedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ImportedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    FileName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    RowsProcessed = table.Column<int>(type: "integer", nullable: false),
                    RowsFailed = table.Column<int>(type: "integer", nullable: false),
                    ErrorSummary = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_schedule_import_logs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_schedule_resource_assignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActivityId = table.Column<Guid>(type: "uuid", nullable: false),
                    ResourceType = table.Column<int>(type: "integer", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: true),
                    EquipmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    SubcontractId = table.Column<Guid>(type: "uuid", nullable: true),
                    PlannedUnits = table.Column<decimal>(type: "numeric", nullable: false),
                    ActualUnits = table.Column<decimal>(type: "numeric", nullable: false),
                    PlannedHours = table.Column<decimal>(type: "numeric", nullable: false),
                    ActualHours = table.Column<decimal>(type: "numeric", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_schedule_resource_assignments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_schedules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    DataDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CalendarType = table.Column<int>(type: "integer", nullable: false),
                    ImportedFrom = table.Column<int>(type: "integer", nullable: false),
                    LastCriticalPathRunAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_schedules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_spec_section_revisions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    SpecSectionId = table.Column<Guid>(type: "uuid", nullable: false),
                    RevisionNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    RevisionDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Summary = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    DocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_spec_section_revisions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_spec_sections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    DivisionCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    SectionCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    CsiEdition = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    CurrentRevision = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    DocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_spec_sections", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_submittal_attachments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubmittalId = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentId = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentRole = table.Column<int>(type: "integer", nullable: false),
                    FileName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    RevisionTag = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_submittal_attachments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_submittal_workflow_events",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubmittalId = table.Column<Guid>(type: "uuid", nullable: false),
                    EventType = table.Column<int>(type: "integer", nullable: false),
                    FromStatus = table.Column<int>(type: "integer", nullable: true),
                    ToStatus = table.Column<int>(type: "integer", nullable: false),
                    ActionByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActionAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Comments = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_submittal_workflow_events", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_submittals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubmittalNumber = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    SpecSectionCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    SpecSectionTitle = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    SubmittalType = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    RequiredByDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SubmittedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReturnedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FinalDueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ScheduleActivityId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsSubstitutionRequest = table.Column<bool>(type: "boolean", nullable: false),
                    RevisionNumber = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_submittals", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_task_comments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    TaskId = table.Column<Guid>(type: "uuid", nullable: false),
                    Comment = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    CommentedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CommentedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_task_comments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "pm_tasks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: true),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    TaskType = table.Column<int>(type: "integer", nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    AssignedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignedToUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    AssignedToName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    DueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReferenceType = table.Column<int>(type: "integer", nullable: false),
                    ReferenceId = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_tasks", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_pm_activity_progress_CompanyId",
                table: "pm_activity_progress",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_activity_progress_ProgressEntryId_ScheduleActivityId",
                table: "pm_activity_progress",
                columns: new[] { "ProgressEntryId", "ScheduleActivityId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_activity_progress_TenantId",
                table: "pm_activity_progress",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_communication_attachments_CommunicationId_DocumentId",
                table: "pm_communication_attachments",
                columns: new[] { "CommunicationId", "DocumentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_communication_attachments_CompanyId",
                table: "pm_communication_attachments",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_communication_attachments_TenantId",
                table: "pm_communication_attachments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_communications_CompanyId",
                table: "pm_communications",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_communications_ProjectId_Status_FollowUpDate",
                table: "pm_communications",
                columns: new[] { "ProjectId", "Status", "FollowUpDate" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_communications_TenantId",
                table: "pm_communications",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_cost_code_progress_CompanyId",
                table: "pm_cost_code_progress",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_cost_code_progress_ProgressEntryId_CostCodeId_PhaseId",
                table: "pm_cost_code_progress",
                columns: new[] { "ProgressEntryId", "CostCodeId", "PhaseId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_cost_code_progress_TenantId",
                table: "pm_cost_code_progress",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_crews_CompanyId",
                table: "pm_daily_report_crews",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_crews_TenantId",
                table: "pm_daily_report_crews",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_deliveries_CompanyId",
                table: "pm_daily_report_deliveries",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_deliveries_TenantId",
                table: "pm_daily_report_deliveries",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_equipment_CompanyId",
                table: "pm_daily_report_equipment",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_equipment_TenantId",
                table: "pm_daily_report_equipment",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_photos_CompanyId",
                table: "pm_daily_report_photos",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_photos_DailyReportId_DocumentId",
                table: "pm_daily_report_photos",
                columns: new[] { "DailyReportId", "DocumentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_photos_TenantId",
                table: "pm_daily_report_photos",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_rollups_CompanyId",
                table: "pm_daily_report_rollups",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_rollups_ParentDailyReportId_ChildDailyRepor~",
                table: "pm_daily_report_rollups",
                columns: new[] { "ParentDailyReportId", "ChildDailyReportId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_rollups_TenantId",
                table: "pm_daily_report_rollups",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_safety_incidents_CompanyId",
                table: "pm_daily_report_safety_incidents",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_safety_incidents_TenantId",
                table: "pm_daily_report_safety_incidents",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_visitors_CompanyId",
                table: "pm_daily_report_visitors",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_visitors_TenantId",
                table: "pm_daily_report_visitors",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_reports_CompanyId",
                table: "pm_daily_reports",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_reports_ProjectId_ReportDate_ReportType",
                table: "pm_daily_reports",
                columns: new[] { "ProjectId", "ReportDate", "ReportType" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_reports_TenantId",
                table: "pm_daily_reports",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_document_distributions_CompanyId",
                table: "pm_document_distributions",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_document_distributions_ProjectId_DocumentType_ReferenceId",
                table: "pm_document_distributions",
                columns: new[] { "ProjectId", "DocumentType", "ReferenceId" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_document_distributions_TenantId",
                table: "pm_document_distributions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_document_folders_CompanyId",
                table: "pm_document_folders",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_document_folders_ProjectId_ParentFolderId_Name",
                table: "pm_document_folders",
                columns: new[] { "ProjectId", "ParentFolderId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_document_folders_TenantId",
                table: "pm_document_folders",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_document_templates_CompanyId",
                table: "pm_document_templates",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_document_templates_CompanyId_TemplateType_Name",
                table: "pm_document_templates",
                columns: new[] { "CompanyId", "TemplateType", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_document_templates_TenantId",
                table: "pm_document_templates",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_document_versions_CompanyId",
                table: "pm_document_versions",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_document_versions_DocumentId_VersionNumber",
                table: "pm_document_versions",
                columns: new[] { "DocumentId", "VersionNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_document_versions_TenantId",
                table: "pm_document_versions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_documents_CompanyId",
                table: "pm_documents",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_documents_ProjectId_UploadedAt",
                table: "pm_documents",
                columns: new[] { "ProjectId", "UploadedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_documents_TenantId",
                table: "pm_documents",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_earned_value_snapshots_CompanyId",
                table: "pm_earned_value_snapshots",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_earned_value_snapshots_ProjectId_SnapshotDate",
                table: "pm_earned_value_snapshots",
                columns: new[] { "ProjectId", "SnapshotDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_earned_value_snapshots_TenantId",
                table: "pm_earned_value_snapshots",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_generated_documents_CompanyId",
                table: "pm_generated_documents",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_generated_documents_ProjectId_DocumentType_GeneratedAt",
                table: "pm_generated_documents",
                columns: new[] { "ProjectId", "DocumentType", "GeneratedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_generated_documents_TenantId",
                table: "pm_generated_documents",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_job_cost_actuals_CompanyId",
                table: "pm_job_cost_actuals",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_job_cost_actuals_ProjectId_CostCodeId_PhaseId_AsOfDate",
                table: "pm_job_cost_actuals",
                columns: new[] { "ProjectId", "CostCodeId", "PhaseId", "AsOfDate" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_job_cost_actuals_TenantId",
                table: "pm_job_cost_actuals",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_job_cost_budgets_CompanyId",
                table: "pm_job_cost_budgets",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_job_cost_budgets_ProjectId_CostCodeId_PhaseId",
                table: "pm_job_cost_budgets",
                columns: new[] { "ProjectId", "CostCodeId", "PhaseId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_job_cost_budgets_TenantId",
                table: "pm_job_cost_budgets",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_job_cost_commitments_CompanyId",
                table: "pm_job_cost_commitments",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_job_cost_commitments_ProjectId_CostCodeId_PhaseId_Refere~",
                table: "pm_job_cost_commitments",
                columns: new[] { "ProjectId", "CostCodeId", "PhaseId", "ReferenceId" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_job_cost_commitments_TenantId",
                table: "pm_job_cost_commitments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_job_cost_forecasts_CompanyId",
                table: "pm_job_cost_forecasts",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_job_cost_forecasts_ProjectId_CostCodeId_PhaseId_Forecast~",
                table: "pm_job_cost_forecasts",
                columns: new[] { "ProjectId", "CostCodeId", "PhaseId", "ForecastPeriod" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_job_cost_forecasts_TenantId",
                table: "pm_job_cost_forecasts",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_job_cost_unit_progress_CompanyId",
                table: "pm_job_cost_unit_progress",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_job_cost_unit_progress_ProjectId_CostCodeId_PhaseId_Peri~",
                table: "pm_job_cost_unit_progress",
                columns: new[] { "ProjectId", "CostCodeId", "PhaseId", "PeriodDate" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_job_cost_unit_progress_TenantId",
                table: "pm_job_cost_unit_progress",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_letterhead_configs_CompanyId",
                table: "pm_letterhead_configs",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_letterhead_configs_CompanyId_Name",
                table: "pm_letterhead_configs",
                columns: new[] { "CompanyId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_letterhead_configs_TenantId",
                table: "pm_letterhead_configs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_meeting_action_items_AssigneeUserId_Status_DueDate",
                table: "pm_meeting_action_items",
                columns: new[] { "AssigneeUserId", "Status", "DueDate" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_meeting_action_items_CompanyId",
                table: "pm_meeting_action_items",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_meeting_action_items_TenantId",
                table: "pm_meeting_action_items",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_meeting_agenda_items_CompanyId",
                table: "pm_meeting_agenda_items",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_meeting_agenda_items_MeetingId_ItemNumber",
                table: "pm_meeting_agenda_items",
                columns: new[] { "MeetingId", "ItemNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_meeting_agenda_items_TenantId",
                table: "pm_meeting_agenda_items",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_meeting_attachments_CompanyId",
                table: "pm_meeting_attachments",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_meeting_attachments_MeetingId_DocumentId",
                table: "pm_meeting_attachments",
                columns: new[] { "MeetingId", "DocumentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_meeting_attachments_TenantId",
                table: "pm_meeting_attachments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_meeting_minutes_CompanyId",
                table: "pm_meeting_minutes",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_meeting_minutes_MeetingId_VersionNumber",
                table: "pm_meeting_minutes",
                columns: new[] { "MeetingId", "VersionNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_meeting_minutes_TenantId",
                table: "pm_meeting_minutes",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_meeting_series_CompanyId",
                table: "pm_meeting_series",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_meeting_series_ProjectId_MeetingType_StartDate",
                table: "pm_meeting_series",
                columns: new[] { "ProjectId", "MeetingType", "StartDate" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_meeting_series_TenantId",
                table: "pm_meeting_series",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_meetings_CompanyId",
                table: "pm_meetings",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_meetings_ProjectId_ScheduledStart",
                table: "pm_meetings",
                columns: new[] { "ProjectId", "ScheduledStart" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_meetings_TenantId",
                table: "pm_meetings",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_monthly_projections_CompanyId",
                table: "pm_monthly_projections",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_monthly_projections_ProjectId_ProjectionMonth",
                table: "pm_monthly_projections",
                columns: new[] { "ProjectId", "ProjectionMonth" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_monthly_projections_TenantId",
                table: "pm_monthly_projections",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_plan_sets_CompanyId",
                table: "pm_plan_sets",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_plan_sets_ProjectId_Name_Revision",
                table: "pm_plan_sets",
                columns: new[] { "ProjectId", "Name", "Revision" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_plan_sets_TenantId",
                table: "pm_plan_sets",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_plan_sheet_revisions_CompanyId",
                table: "pm_plan_sheet_revisions",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_plan_sheet_revisions_PlanSheetId_RevisionNumber",
                table: "pm_plan_sheet_revisions",
                columns: new[] { "PlanSheetId", "RevisionNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_plan_sheet_revisions_TenantId",
                table: "pm_plan_sheet_revisions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_plan_sheets_CompanyId",
                table: "pm_plan_sheets",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_plan_sheets_PlanSetId_DrawingNumber_CurrentRevision",
                table: "pm_plan_sheets",
                columns: new[] { "PlanSetId", "DrawingNumber", "CurrentRevision" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_plan_sheets_TenantId",
                table: "pm_plan_sheets",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_progress_entries_CompanyId",
                table: "pm_progress_entries",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_progress_entries_ProjectId_ProgressDate_EntryType",
                table: "pm_progress_entries",
                columns: new[] { "ProjectId", "ProgressDate", "EntryType" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_progress_entries_TenantId",
                table: "pm_progress_entries",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_progress_time_entry_links_CompanyId",
                table: "pm_progress_time_entry_links",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_progress_time_entry_links_ProgressEntryId_TimeEntryId",
                table: "pm_progress_time_entry_links",
                columns: new[] { "ProgressEntryId", "TimeEntryId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_progress_time_entry_links_TenantId",
                table: "pm_progress_time_entry_links",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_project_narrative_revisions_CompanyId",
                table: "pm_project_narrative_revisions",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_project_narrative_revisions_NarrativeId_RevisionNumber",
                table: "pm_project_narrative_revisions",
                columns: new[] { "NarrativeId", "RevisionNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_project_narrative_revisions_TenantId",
                table: "pm_project_narrative_revisions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_project_narratives_CompanyId",
                table: "pm_project_narratives",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_project_narratives_ProjectId_NarrativeMonth",
                table: "pm_project_narratives",
                columns: new[] { "ProjectId", "NarrativeMonth" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_project_narratives_TenantId",
                table: "pm_project_narratives",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_projection_cost_codes_CompanyId",
                table: "pm_projection_cost_codes",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_projection_cost_codes_MonthlyProjectionId_CostCodeId_Pha~",
                table: "pm_projection_cost_codes",
                columns: new[] { "MonthlyProjectionId", "CostCodeId", "PhaseId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_projection_cost_codes_TenantId",
                table: "pm_projection_cost_codes",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_rfi_attachments_CompanyId",
                table: "pm_rfi_attachments",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_rfi_attachments_RfiId_DocumentId",
                table: "pm_rfi_attachments",
                columns: new[] { "RfiId", "DocumentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_rfi_attachments_TenantId",
                table: "pm_rfi_attachments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_rfi_cost_impact_links_CompanyId",
                table: "pm_rfi_cost_impact_links",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_rfi_cost_impact_links_RfiId_CostCodeId_ChangeOrderId",
                table: "pm_rfi_cost_impact_links",
                columns: new[] { "RfiId", "CostCodeId", "ChangeOrderId" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_rfi_cost_impact_links_TenantId",
                table: "pm_rfi_cost_impact_links",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_rfi_distribution_recipients_CompanyId",
                table: "pm_rfi_distribution_recipients",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_rfi_distribution_recipients_RfiId_RecipientEmail_Recipie~",
                table: "pm_rfi_distribution_recipients",
                columns: new[] { "RfiId", "RecipientEmail", "RecipientType" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_rfi_distribution_recipients_TenantId",
                table: "pm_rfi_distribution_recipients",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_s_curve_points_CompanyId",
                table: "pm_s_curve_points",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_s_curve_points_ProjectId_CurveDate",
                table: "pm_s_curve_points",
                columns: new[] { "ProjectId", "CurveDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_s_curve_points_TenantId",
                table: "pm_s_curve_points",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_activities_CompanyId",
                table: "pm_schedule_activities",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_activities_ScheduleId_ActivityCode",
                table: "pm_schedule_activities",
                columns: new[] { "ScheduleId", "ActivityCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_activities_ScheduleId_ParentActivityId_SortOrder",
                table: "pm_schedule_activities",
                columns: new[] { "ScheduleId", "ParentActivityId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_activities_TenantId",
                table: "pm_schedule_activities",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_baseline_activities_BaselineId_ActivityId",
                table: "pm_schedule_baseline_activities",
                columns: new[] { "BaselineId", "ActivityId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_baseline_activities_CompanyId",
                table: "pm_schedule_baseline_activities",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_baseline_activities_TenantId",
                table: "pm_schedule_baseline_activities",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_baselines_CompanyId",
                table: "pm_schedule_baselines",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_baselines_ProjectId_CapturedAt",
                table: "pm_schedule_baselines",
                columns: new[] { "ProjectId", "CapturedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_baselines_TenantId",
                table: "pm_schedule_baselines",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_calendar_exceptions_CompanyId",
                table: "pm_schedule_calendar_exceptions",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_calendar_exceptions_ScheduleId_Date",
                table: "pm_schedule_calendar_exceptions",
                columns: new[] { "ScheduleId", "Date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_calendar_exceptions_TenantId",
                table: "pm_schedule_calendar_exceptions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_dependencies_CompanyId",
                table: "pm_schedule_dependencies",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_dependencies_ScheduleId_PredecessorActivityId_S~",
                table: "pm_schedule_dependencies",
                columns: new[] { "ScheduleId", "PredecessorActivityId", "SuccessorActivityId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_dependencies_TenantId",
                table: "pm_schedule_dependencies",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_import_logs_CompanyId",
                table: "pm_schedule_import_logs",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_import_logs_ProjectId_ImportedAt",
                table: "pm_schedule_import_logs",
                columns: new[] { "ProjectId", "ImportedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_import_logs_TenantId",
                table: "pm_schedule_import_logs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_resource_assignments_ActivityId_ResourceType",
                table: "pm_schedule_resource_assignments",
                columns: new[] { "ActivityId", "ResourceType" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_resource_assignments_CompanyId",
                table: "pm_schedule_resource_assignments",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_resource_assignments_TenantId",
                table: "pm_schedule_resource_assignments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedules_CompanyId",
                table: "pm_schedules",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedules_ProjectId_Status",
                table: "pm_schedules",
                columns: new[] { "ProjectId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedules_TenantId",
                table: "pm_schedules",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedules_TenantId_CompanyId_ProjectId_Name",
                table: "pm_schedules",
                columns: new[] { "TenantId", "CompanyId", "ProjectId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_spec_section_revisions_CompanyId",
                table: "pm_spec_section_revisions",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_spec_section_revisions_SpecSectionId_RevisionNumber",
                table: "pm_spec_section_revisions",
                columns: new[] { "SpecSectionId", "RevisionNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_spec_section_revisions_TenantId",
                table: "pm_spec_section_revisions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_spec_sections_CompanyId",
                table: "pm_spec_sections",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_spec_sections_ProjectId_SectionCode_CurrentRevision",
                table: "pm_spec_sections",
                columns: new[] { "ProjectId", "SectionCode", "CurrentRevision" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_spec_sections_TenantId",
                table: "pm_spec_sections",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_submittal_attachments_CompanyId",
                table: "pm_submittal_attachments",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_submittal_attachments_SubmittalId_DocumentId",
                table: "pm_submittal_attachments",
                columns: new[] { "SubmittalId", "DocumentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_submittal_attachments_TenantId",
                table: "pm_submittal_attachments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_submittal_workflow_events_CompanyId",
                table: "pm_submittal_workflow_events",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_submittal_workflow_events_SubmittalId_ActionAt",
                table: "pm_submittal_workflow_events",
                columns: new[] { "SubmittalId", "ActionAt" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_submittal_workflow_events_TenantId",
                table: "pm_submittal_workflow_events",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_submittals_CompanyId",
                table: "pm_submittals",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_submittals_ProjectId_Status_RequiredByDate",
                table: "pm_submittals",
                columns: new[] { "ProjectId", "Status", "RequiredByDate" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_submittals_TenantId",
                table: "pm_submittals",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_submittals_TenantId_ProjectId_SubmittalNumber",
                table: "pm_submittals",
                columns: new[] { "TenantId", "ProjectId", "SubmittalNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pm_task_comments_CompanyId",
                table: "pm_task_comments",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_task_comments_TaskId_CommentedAt",
                table: "pm_task_comments",
                columns: new[] { "TaskId", "CommentedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_task_comments_TenantId",
                table: "pm_task_comments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_tasks_AssignedToUserId_Status_DueDate",
                table: "pm_tasks",
                columns: new[] { "AssignedToUserId", "Status", "DueDate" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_tasks_CompanyId",
                table: "pm_tasks",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_tasks_ProjectId_Status_DueDate",
                table: "pm_tasks",
                columns: new[] { "ProjectId", "Status", "DueDate" });

            migrationBuilder.CreateIndex(
                name: "IX_pm_tasks_TenantId",
                table: "pm_tasks",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "pm_activity_progress");

            migrationBuilder.DropTable(
                name: "pm_communication_attachments");

            migrationBuilder.DropTable(
                name: "pm_communications");

            migrationBuilder.DropTable(
                name: "pm_cost_code_progress");

            migrationBuilder.DropTable(
                name: "pm_daily_report_crews");

            migrationBuilder.DropTable(
                name: "pm_daily_report_deliveries");

            migrationBuilder.DropTable(
                name: "pm_daily_report_equipment");

            migrationBuilder.DropTable(
                name: "pm_daily_report_photos");

            migrationBuilder.DropTable(
                name: "pm_daily_report_rollups");

            migrationBuilder.DropTable(
                name: "pm_daily_report_safety_incidents");

            migrationBuilder.DropTable(
                name: "pm_daily_report_visitors");

            migrationBuilder.DropTable(
                name: "pm_daily_reports");

            migrationBuilder.DropTable(
                name: "pm_document_distributions");

            migrationBuilder.DropTable(
                name: "pm_document_folders");

            migrationBuilder.DropTable(
                name: "pm_document_templates");

            migrationBuilder.DropTable(
                name: "pm_document_versions");

            migrationBuilder.DropTable(
                name: "pm_documents");

            migrationBuilder.DropTable(
                name: "pm_earned_value_snapshots");

            migrationBuilder.DropTable(
                name: "pm_generated_documents");

            migrationBuilder.DropTable(
                name: "pm_job_cost_actuals");

            migrationBuilder.DropTable(
                name: "pm_job_cost_budgets");

            migrationBuilder.DropTable(
                name: "pm_job_cost_commitments");

            migrationBuilder.DropTable(
                name: "pm_job_cost_forecasts");

            migrationBuilder.DropTable(
                name: "pm_job_cost_unit_progress");

            migrationBuilder.DropTable(
                name: "pm_letterhead_configs");

            migrationBuilder.DropTable(
                name: "pm_meeting_action_items");

            migrationBuilder.DropTable(
                name: "pm_meeting_agenda_items");

            migrationBuilder.DropTable(
                name: "pm_meeting_attachments");

            migrationBuilder.DropTable(
                name: "pm_meeting_minutes");

            migrationBuilder.DropTable(
                name: "pm_meeting_series");

            migrationBuilder.DropTable(
                name: "pm_meetings");

            migrationBuilder.DropTable(
                name: "pm_monthly_projections");

            migrationBuilder.DropTable(
                name: "pm_plan_sets");

            migrationBuilder.DropTable(
                name: "pm_plan_sheet_revisions");

            migrationBuilder.DropTable(
                name: "pm_plan_sheets");

            migrationBuilder.DropTable(
                name: "pm_progress_entries");

            migrationBuilder.DropTable(
                name: "pm_progress_time_entry_links");

            migrationBuilder.DropTable(
                name: "pm_project_narrative_revisions");

            migrationBuilder.DropTable(
                name: "pm_project_narratives");

            migrationBuilder.DropTable(
                name: "pm_projection_cost_codes");

            migrationBuilder.DropTable(
                name: "pm_rfi_attachments");

            migrationBuilder.DropTable(
                name: "pm_rfi_cost_impact_links");

            migrationBuilder.DropTable(
                name: "pm_rfi_distribution_recipients");

            migrationBuilder.DropTable(
                name: "pm_s_curve_points");

            migrationBuilder.DropTable(
                name: "pm_schedule_activities");

            migrationBuilder.DropTable(
                name: "pm_schedule_baseline_activities");

            migrationBuilder.DropTable(
                name: "pm_schedule_baselines");

            migrationBuilder.DropTable(
                name: "pm_schedule_calendar_exceptions");

            migrationBuilder.DropTable(
                name: "pm_schedule_dependencies");

            migrationBuilder.DropTable(
                name: "pm_schedule_import_logs");

            migrationBuilder.DropTable(
                name: "pm_schedule_resource_assignments");

            migrationBuilder.DropTable(
                name: "pm_schedules");

            migrationBuilder.DropTable(
                name: "pm_spec_section_revisions");

            migrationBuilder.DropTable(
                name: "pm_spec_sections");

            migrationBuilder.DropTable(
                name: "pm_submittal_attachments");

            migrationBuilder.DropTable(
                name: "pm_submittal_workflow_events");

            migrationBuilder.DropTable(
                name: "pm_submittals");

            migrationBuilder.DropTable(
                name: "pm_task_comments");

            migrationBuilder.DropTable(
                name: "pm_tasks");
        }
    }
}
