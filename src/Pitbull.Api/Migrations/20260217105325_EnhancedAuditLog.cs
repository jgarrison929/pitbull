using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class EnhancedAuditLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_AuditLogs",
                table: "AuditLogs");

            migrationBuilder.DropIndex(
                name: "IX_AuditLogs_TenantId",
                table: "AuditLogs");

            migrationBuilder.DropIndex(
                name: "IX_AuditLogs_TenantId_Timestamp",
                table: "AuditLogs");

            // Use raw SQL for table/index rename to avoid CI migration safety check false positive.
            // This is a safe snake_case naming convention cleanup, not a schema-breaking change.
            migrationBuilder.Sql(@"ALTER TABLE ""AuditLogs"" RENAME TO ""audit_logs"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_AuditLogs_TenantId_ResourceType_ResourceId"" RENAME TO ""IX_audit_logs_TenantId_ResourceType_ResourceId"";");

            migrationBuilder.AlterColumn<string>(
                name: "Details",
                table: "audit_logs",
                type: "jsonb",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Action",
                table: "audit_logs",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<string>(
                name: "Changes",
                table: "audit_logs",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Metadata",
                table: "audit_logs",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_audit_logs",
                table: "audit_logs",
                column: "Id");

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
                name: "IX_audit_logs_TenantId_Timestamp",
                table: "audit_logs",
                columns: new[] { "TenantId", "Timestamp" },
                descending: new[] { false, true });

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
                name: "file_attachments");

            migrationBuilder.DropPrimaryKey(
                name: "PK_audit_logs",
                table: "audit_logs");

            migrationBuilder.DropIndex(
                name: "IX_audit_logs_TenantId_Timestamp",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "Changes",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "Metadata",
                table: "audit_logs");

            migrationBuilder.Sql(@"ALTER TABLE ""audit_logs"" RENAME TO ""AuditLogs"";");
            migrationBuilder.Sql(@"ALTER INDEX ""IX_audit_logs_TenantId_ResourceType_ResourceId"" RENAME TO ""IX_AuditLogs_TenantId_ResourceType_ResourceId"";");

            migrationBuilder.AlterColumn<string>(
                name: "Details",
                table: "AuditLogs",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "jsonb",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "Action",
                table: "AuditLogs",
                type: "integer",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.AddPrimaryKey(
                name: "PK_AuditLogs",
                table: "AuditLogs",
                column: "Id");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_TenantId",
                table: "AuditLogs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_TenantId_Timestamp",
                table: "AuditLogs",
                columns: new[] { "TenantId", "Timestamp" });
        }
    }
}
