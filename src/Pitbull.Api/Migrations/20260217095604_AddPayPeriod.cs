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
            // Make ALL operations idempotent to handle partial migration reruns
            migrationBuilder.Sql(@"
                -- Drop foreign keys if they exist
                ALTER TABLE pay_periods DROP CONSTRAINT IF EXISTS ""FK_pay_periods_locked_by"";
                ALTER TABLE pay_periods DROP CONSTRAINT IF EXISTS ""FK_pay_periods_processed_by"";

                -- Drop ALL RLS policies on pay_periods
                DO $$
                DECLARE pol RECORD;
                BEGIN
                    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'pay_periods'
                    LOOP
                        EXECUTE format('DROP POLICY IF EXISTS %I ON pay_periods', pol.policyname);
                    END LOOP;
                END $$;
                ALTER TABLE pay_periods DISABLE ROW LEVEL SECURITY;

                -- Drop indexes if they exist
                DROP INDEX IF EXISTS ""IX_pay_periods_CompanyId"";
                DROP INDEX IF EXISTS ""IX_pay_periods_LockedById"";
                DROP INDEX IF EXISTS ""IX_pay_periods_ProcessedById"";

                -- Drop columns if they exist
                ALTER TABLE pay_periods DROP COLUMN IF EXISTS ""CompanyId"";
                ALTER TABLE pay_periods DROP COLUMN IF EXISTS ""Notes"";
                ALTER TABLE pay_periods DROP COLUMN IF EXISTS ""ProcessedAt"";
                ALTER TABLE pay_periods DROP COLUMN IF EXISTS ""ProcessedById"";

                -- Update status comment
                COMMENT ON COLUMN pay_periods.""Status"" IS 'Status: 0=Open, 1=Locked, 2=Closed';

                -- Add columns if they don't exist
                ALTER TABLE pay_periods ADD COLUMN IF NOT EXISTS ""Name"" character varying(100) NOT NULL DEFAULT '';
                COMMENT ON COLUMN pay_periods.""Name"" IS 'Auto-generated display name for the period';
                ALTER TABLE pay_periods ADD COLUMN IF NOT EXISTS ""PayrollExportMarkedAt"" timestamp with time zone;
                COMMENT ON COLUMN pay_periods.""PayrollExportMarkedAt"" IS 'When payroll export was finalized on close';
            ");

            // Use IF NOT EXISTS to handle partial migration reruns where table was already created
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS file_attachments (
                    ""Id"" uuid NOT NULL,
                    ""FileName"" character varying(500) NOT NULL,
                    ""ContentType"" character varying(200) NOT NULL,
                    ""FileSize"" bigint NOT NULL,
                    ""StoragePath"" character varying(1000) NOT NULL,
                    ""UploadedById"" uuid NOT NULL,
                    ""RelatedEntityType"" character varying(100),
                    ""RelatedEntityId"" uuid,
                    ""TenantId"" uuid NOT NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL,
                    ""CreatedBy"" text NOT NULL,
                    ""UpdatedAt"" timestamp with time zone,
                    ""UpdatedBy"" text,
                    ""IsDeleted"" boolean NOT NULL,
                    ""DeletedAt"" timestamp with time zone,
                    ""DeletedBy"" text,
                    CONSTRAINT ""PK_file_attachments"" PRIMARY KEY (""Id"")
                );
                CREATE INDEX IF NOT EXISTS ""IX_file_attachments_related_entity"" ON file_attachments (""RelatedEntityType"", ""RelatedEntityId"");
                CREATE INDEX IF NOT EXISTS ""IX_file_attachments_tenant_user_created"" ON file_attachments (""TenantId"", ""UploadedById"", ""CreatedAt"");
                CREATE INDEX IF NOT EXISTS ""IX_file_attachments_TenantId"" ON file_attachments (""TenantId"");
            ");
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
