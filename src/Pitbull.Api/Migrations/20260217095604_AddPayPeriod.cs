using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPayPeriod : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_pay_periods_locked_by",
                table: "pay_periods");

            migrationBuilder.DropForeignKey(
                name: "FK_pay_periods_processed_by",
                table: "pay_periods");

            // Drop ALL RLS policies on pay_periods before dropping CompanyId column
            migrationBuilder.Sql(@"
                DO $$
                DECLARE pol RECORD;
                BEGIN
                    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'pay_periods'
                    LOOP
                        EXECUTE format('DROP POLICY IF EXISTS %I ON pay_periods', pol.policyname);
                    END LOOP;
                END $$;
            ");
            migrationBuilder.Sql("ALTER TABLE pay_periods DISABLE ROW LEVEL SECURITY;");

            migrationBuilder.DropIndex(
                name: "IX_pay_periods_CompanyId",
                table: "pay_periods");

            migrationBuilder.DropIndex(
                name: "IX_pay_periods_LockedById",
                table: "pay_periods");

            migrationBuilder.DropIndex(
                name: "IX_pay_periods_ProcessedById",
                table: "pay_periods");

            migrationBuilder.DropColumn(
                name: "CompanyId",
                table: "pay_periods");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "pay_periods");

            migrationBuilder.DropColumn(
                name: "ProcessedAt",
                table: "pay_periods");

            migrationBuilder.DropColumn(
                name: "ProcessedById",
                table: "pay_periods");

            migrationBuilder.AlterColumn<int>(
                name: "Status",
                table: "pay_periods",
                type: "integer",
                nullable: false,
                comment: "Status: 0=Open, 1=Locked, 2=Closed",
                oldClrType: typeof(int),
                oldType: "integer",
                oldComment: "Status: 0=Open, 1=Locked, 2=Processed");

            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "pay_periods",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "",
                comment: "Auto-generated display name for the period");

            migrationBuilder.AddColumn<DateTime>(
                name: "PayrollExportMarkedAt",
                table: "pay_periods",
                type: "timestamp with time zone",
                nullable: true,
                comment: "When payroll export was finalized on close");

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

            migrationBuilder.DropColumn(
                name: "Name",
                table: "pay_periods");

            migrationBuilder.DropColumn(
                name: "PayrollExportMarkedAt",
                table: "pay_periods");

            migrationBuilder.AlterColumn<int>(
                name: "Status",
                table: "pay_periods",
                type: "integer",
                nullable: false,
                comment: "Status: 0=Open, 1=Locked, 2=Processed",
                oldClrType: typeof(int),
                oldType: "integer",
                oldComment: "Status: 0=Open, 1=Locked, 2=Closed");

            migrationBuilder.AddColumn<Guid>(
                name: "CompanyId",
                table: "pay_periods",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "pay_periods",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true,
                comment: "Optional notes about the pay period");

            migrationBuilder.AddColumn<DateTime>(
                name: "ProcessedAt",
                table: "pay_periods",
                type: "timestamp with time zone",
                nullable: true,
                comment: "When the period was processed for payroll");

            migrationBuilder.AddColumn<Guid>(
                name: "ProcessedById",
                table: "pay_periods",
                type: "uuid",
                nullable: true,
                comment: "User who marked it as processed");

            migrationBuilder.CreateIndex(
                name: "IX_pay_periods_CompanyId",
                table: "pay_periods",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_pay_periods_LockedById",
                table: "pay_periods",
                column: "LockedById");

            migrationBuilder.CreateIndex(
                name: "IX_pay_periods_ProcessedById",
                table: "pay_periods",
                column: "ProcessedById");

            migrationBuilder.AddForeignKey(
                name: "FK_pay_periods_locked_by",
                table: "pay_periods",
                column: "LockedById",
                principalTable: "employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pay_periods_processed_by",
                table: "pay_periods",
                column: "ProcessedById",
                principalTable: "employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
