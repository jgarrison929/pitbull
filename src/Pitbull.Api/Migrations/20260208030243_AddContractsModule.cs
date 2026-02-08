using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddContractsModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "subcontracts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubcontractNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    SubcontractorName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SubcontractorContact = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    SubcontractorEmail = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    SubcontractorPhone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    SubcontractorAddress = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ScopeOfWork = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    TradeCode = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    OriginalValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CurrentValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    BilledToDate = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PaidToDate = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RetainagePercent = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    RetainageHeld = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ExecutionDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    StartDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletionDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ActualCompletionDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    InsuranceExpirationDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    InsuranceCurrent = table.Column<bool>(type: "boolean", nullable: false),
                    LicenseNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
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
                    table.PrimaryKey("PK_subcontracts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "change_orders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SubcontractId = table.Column<Guid>(type: "uuid", nullable: false),
                    ChangeOrderNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DaysExtension = table.Column<int>(type: "integer", nullable: true),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    SubmittedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    RejectedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    RejectionReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ReferenceNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
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
                    table.PrimaryKey("PK_change_orders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_change_orders_subcontracts_SubcontractId",
                        column: x => x.SubcontractId,
                        principalTable: "subcontracts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_change_orders_Status",
                table: "change_orders",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_change_orders_SubcontractId_ChangeOrderNumber",
                table: "change_orders",
                columns: new[] { "SubcontractId", "ChangeOrderNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_subcontracts_ProjectId",
                table: "subcontracts",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_subcontracts_Status",
                table: "subcontracts",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_subcontracts_SubcontractorName",
                table: "subcontracts",
                column: "SubcontractorName");

            migrationBuilder.CreateIndex(
                name: "IX_subcontracts_TenantId_SubcontractNumber",
                table: "subcontracts",
                columns: new[] { "TenantId", "SubcontractNumber" },
                unique: true);

            // Add RLS policies for tenant isolation (security)
            AddRlsPolicies(migrationBuilder, "subcontracts");
            AddRlsPolicies(migrationBuilder, "change_orders");
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
            // Drop RLS policies first
            DropRlsPolicies(migrationBuilder, "change_orders");
            DropRlsPolicies(migrationBuilder, "subcontracts");

            migrationBuilder.DropTable(name: "change_orders");
            migrationBuilder.DropTable(name: "subcontracts");
        }
    }
}
