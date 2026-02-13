using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations;

/// <inheritdoc />
public partial class AddPaymentApplications : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "payment_applications",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                SubcontractId = table.Column<Guid>(type: "uuid", nullable: false),
                ApplicationNumber = table.Column<int>(type: "integer", nullable: false),
                PeriodStart = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                PeriodEnd = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                ScheduledValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                WorkCompletedPrevious = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                WorkCompletedThisPeriod = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                WorkCompletedToDate = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                StoredMaterials = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                TotalCompletedAndStored = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                RetainagePercent = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                RetainageThisPeriod = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                RetainagePrevious = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                TotalRetainage = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                TotalEarnedLessRetainage = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                LessPreviousCertificates = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                CurrentPaymentDue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                SubmittedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                ReviewedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                ApprovedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                PaidDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                ApprovedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                ApprovedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                Notes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                InvoiceNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                CheckNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
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
                table.PrimaryKey("PK_payment_applications", x => x.Id);
                table.ForeignKey(
                    name: "FK_payment_applications_subcontracts_SubcontractId",
                    column: x => x.SubcontractId,
                    principalTable: "subcontracts",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_payment_applications_PeriodEnd",
            table: "payment_applications",
            column: "PeriodEnd");

        migrationBuilder.CreateIndex(
            name: "IX_payment_applications_Status",
            table: "payment_applications",
            column: "Status");

        migrationBuilder.CreateIndex(
            name: "IX_payment_applications_SubcontractId_ApplicationNumber",
            table: "payment_applications",
            columns: ["SubcontractId", "ApplicationNumber"],
            unique: true);

        // Add RLS policies for tenant isolation
        AddRlsPolicies(migrationBuilder, "payment_applications");
    }

    private static void AddRlsPolicies(MigrationBuilder migrationBuilder, string table)
    {
        migrationBuilder.Sql($@"ALTER TABLE ""{table}"" ENABLE ROW LEVEL SECURITY;");
        migrationBuilder.Sql($@"ALTER TABLE ""{table}"" FORCE ROW LEVEL SECURITY;");

        migrationBuilder.Sql($@"
                CREATE POLICY {table}_tenant_isolation_select ON ""{table}"" 
                FOR SELECT USING (""TenantId""::text = current_setting('app.current_tenant', true));
            ");
        migrationBuilder.Sql($@"
                CREATE POLICY {table}_tenant_isolation_insert ON ""{table}"" 
                FOR INSERT WITH CHECK (""TenantId""::text = current_setting('app.current_tenant', true));
            ");
        migrationBuilder.Sql($@"
                CREATE POLICY {table}_tenant_isolation_update ON ""{table}"" 
                FOR UPDATE 
                USING (""TenantId""::text = current_setting('app.current_tenant', true))
                WITH CHECK (""TenantId""::text = current_setting('app.current_tenant', true));
            ");
        migrationBuilder.Sql($@"
                CREATE POLICY {table}_tenant_isolation_delete ON ""{table}"" 
                FOR DELETE USING (""TenantId""::text = current_setting('app.current_tenant', true));
            ");
    }

    private static void DropRlsPolicies(MigrationBuilder migrationBuilder, string table)
    {
        migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_select ON ""{table}"";");
        migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_insert ON ""{table}"";");
        migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_update ON ""{table}"";");
        migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_delete ON ""{table}"";");
        migrationBuilder.Sql($@"ALTER TABLE ""{table}"" DISABLE ROW LEVEL SECURITY;");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        DropRlsPolicies(migrationBuilder, "payment_applications");
        migrationBuilder.DropTable(name: "payment_applications");
    }
}
