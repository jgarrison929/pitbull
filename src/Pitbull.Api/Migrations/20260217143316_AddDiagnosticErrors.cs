using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDiagnosticErrors : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "diagnostic_errors",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Timestamp = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Source = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Level = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "error"),
                    HttpStatusCode = table.Column<int>(type: "integer", nullable: true),
                    RequestMethod = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    RequestPath = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    QueryString = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    Message = table.Column<string>(type: "text", nullable: false),
                    ExceptionType = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    StackTrace = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: true),
                    UserId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    UserEmail = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CorrelationId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    TraceId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    UserAgent = table.Column<string>(type: "text", nullable: true),
                    IpAddress = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ComponentStack = table.Column<string>(type: "text", nullable: true),
                    BrowserInfo = table.Column<string>(type: "text", nullable: true),
                    PageUrl = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    Metadata = table.Column<string>(type: "jsonb", nullable: true),
                    Acknowledged = table.Column<bool>(type: "boolean", nullable: false),
                    AcknowledgedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AcknowledgedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Resolution = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_diagnostic_errors", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "file_attachments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FileName = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    StoragePath = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    UploadedById = table.Column<Guid>(type: "uuid", nullable: false),
                    RelatedEntityType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    RelatedEntityId = table.Column<Guid>(type: "uuid", nullable: true),
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
                    table.PrimaryKey("PK_file_attachments", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_diagnostic_errors_Source_Level",
                table: "diagnostic_errors",
                columns: new[] { "Source", "Level" });

            migrationBuilder.CreateIndex(
                name: "IX_diagnostic_errors_Timestamp",
                table: "diagnostic_errors",
                column: "Timestamp",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "IX_diagnostic_errors_Unacknowledged",
                table: "diagnostic_errors",
                column: "Acknowledged",
                filter: "\"Acknowledged\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_file_attachments_related_entity",
                table: "file_attachments",
                columns: new[] { "RelatedEntityType", "RelatedEntityId" });

            migrationBuilder.CreateIndex(
                name: "IX_file_attachments_tenant_user_created",
                table: "file_attachments",
                columns: new[] { "TenantId", "UploadedById", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_file_attachments_TenantId",
                table: "file_attachments",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "diagnostic_errors");

            migrationBuilder.DropTable(
                name: "file_attachments");
        }
    }
}
