using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <summary>
    /// Upgrades tenant-only RLS policies to compound tenant + company isolation for
    /// ICompanyScoped tables that already have FORCE RLS + TenantId policies.
    /// When app.current_company is empty/null, all companies in the tenant remain visible
    /// (matches EF query-filter semantics for unresolved company context).
    /// </summary>
    public partial class UpgradeCompanyScopedRlsPolicies : Migration
    {
        private static readonly string[] Tables =
        [
            // Owner / billing
            "owner_contracts",
            "owner_change_orders",
            "owner_schedules_of_values",
            "owner_sov_line_items",
            "billing_applications",
            "billing_application_line_items",
            "billing_periods",
            "billing_package_documents",
            "lien_waivers",
            "retention_holds",
            "retention_policies",
            "payment_application_line_items",
            "payment_application_book_entries",
            // AP/AR / procurement
            "vendors",
            "customers",
            "purchase_orders",
            "purchase_order_lines",
            "vendor_invoices",
            "vendor_payment_applications",
            // Payroll / banking / GL
            "payroll_runs",
            "payroll_run_lines",
            "payroll_exports",
            "payroll_export_lines",
            "bank_accounts",
            "bank_transactions",
            "bank_reconciliations",
            "journal_entries",
            "journal_entry_lines",
            "chart_of_accounts",
            "accounting_periods",
            "wip_reports",
            "wip_report_lines",
            // Key PM surfaces
            "pm_daily_reports",
            "pm_submittals",
            "pm_tasks",
            "pm_schedules",
            "pm_punch_list_items",
            "pm_rfi_attachments",
            "pm_meetings",
            "pm_documents",
            "pm_field_progress_entries",
        ];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            foreach (var table in Tables)
            {
                // Drop prior tenant-only policies (from AddPm / AddFinancial / AddResidual migrations).
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_select ON ""{table}"";");
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_insert ON ""{table}"";");
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_update ON ""{table}"";");
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_delete ON ""{table}"";");
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_company_isolation ON ""{table}"";");

                migrationBuilder.Sql($@"ALTER TABLE ""{table}"" ENABLE ROW LEVEL SECURITY;");
                migrationBuilder.Sql($@"ALTER TABLE ""{table}"" FORCE ROW LEVEL SECURITY;");

                migrationBuilder.Sql($@"
                    CREATE POLICY {table}_tenant_company_isolation ON ""{table}""
                    FOR ALL
                    USING (
                        ""TenantId""::text = current_setting('app.current_tenant', true)
                        AND (
                            current_setting('app.current_company', true) IS NULL
                            OR current_setting('app.current_company', true) = ''
                            OR ""CompanyId""::text = current_setting('app.current_company', true)
                        )
                    )
                    WITH CHECK (
                        ""TenantId""::text = current_setting('app.current_tenant', true)
                        AND (
                            current_setting('app.current_company', true) IS NULL
                            OR current_setting('app.current_company', true) = ''
                            OR ""CompanyId""::text = current_setting('app.current_company', true)
                        )
                    );
                ");
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var table in Tables)
            {
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_company_isolation ON ""{table}"";");

                migrationBuilder.Sql($@"
                    CREATE POLICY {table}_tenant_isolation_select ON ""{table}""
                    FOR SELECT
                    USING (""TenantId""::text = current_setting('app.current_tenant', true));
                ");
                migrationBuilder.Sql($@"
                    CREATE POLICY {table}_tenant_isolation_insert ON ""{table}""
                    FOR INSERT
                    WITH CHECK (""TenantId""::text = current_setting('app.current_tenant', true));
                ");
                migrationBuilder.Sql($@"
                    CREATE POLICY {table}_tenant_isolation_update ON ""{table}""
                    FOR UPDATE
                    USING (""TenantId""::text = current_setting('app.current_tenant', true))
                    WITH CHECK (""TenantId""::text = current_setting('app.current_tenant', true));
                ");
                migrationBuilder.Sql($@"
                    CREATE POLICY {table}_tenant_isolation_delete ON ""{table}""
                    FOR DELETE
                    USING (""TenantId""::text = current_setting('app.current_tenant', true));
                ");
            }
        }
    }
}
