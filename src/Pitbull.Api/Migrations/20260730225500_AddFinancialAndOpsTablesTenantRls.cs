using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <summary>
    /// Enables FORCE RLS + tenant isolation on residual high-value tables that previously
    /// relied only on EF query filters: owner contracts/billing, lien waivers, notifications,
    /// vendors/customers, payroll, banking/GL, AI keys/usage, secrets/api keys, etc.
    /// Idempotent: drops same-named policies before recreate.
    /// </summary>
    public partial class AddFinancialAndOpsTablesTenantRls : Migration
    {
        private static readonly string[] Tables =
        [
            // Owner contracts / AIA billing
            "owner_contracts",
            "owner_change_orders",
            "owner_schedules_of_values",
            "owner_sov_line_items",
            "billing_applications",
            "billing_application_line_items",
            "billing_periods",
            "billing_package_documents",
            "schedule_of_values",
            "sov_line_items",
            "lien_waivers",
            "retention_holds",
            "retention_policies",
            "payment_application_line_items",
            "payment_application_book_entries",
            // AP/AR / procurement / vendor portal
            "vendors",
            "customers",
            "purchase_orders",
            "purchase_order_lines",
            "vendor_portal_tokens",
            "vendor_payments",
            "invoice_match_results",
            // Payroll / HR extensions
            "payroll_runs",
            "payroll_run_lines",
            "payroll_exports",
            "payroll_export_lines",
            "payroll_run_reviews",
            "certified_payroll_reports",
            "employee_certifications",
            "employee_emergency_contacts",
            "employee_tax_compliance",
            "employee_union_affiliations",
            "fringe_benefit_allocations",
            "onboarding_checklists",
            // Banking / GL / tax
            "bank_accounts",
            "bank_transactions",
            "bank_reconciliations",
            "journal_entries",
            "journal_entry_lines",
            "chart_of_accounts",
            "accounting_periods",
            "tax_exemptions",
            "tax_jurisdictions",
            "currency_exchange_rates",
            // Notifications / prefs
            "notifications",
            "notification_preferences",
            "deadline_notifications",
            "email_digest_settings",
            "dashboard_preferences",
            // AI / admin secrets / RBAC
            "ai_api_keys",
            "ai_usage_records",
            "api_keys",
            "secret_vault",
            "audit_logs",
            "rbac_permissions",
            "rbac_roles",
            "rbac_role_permissions",
            "rbac_user_roles",
            // Supporting
            "equipment",
            "file_attachments",
            "compliance_documents",
            "cost_predictions",
            "import_batches",
            "field_mappings",
            "feedback",
            "password_reset_tokens",
        ];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            foreach (var table in Tables)
            {
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_select ON ""{table}"";");
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_insert ON ""{table}"";");
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_update ON ""{table}"";");
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_delete ON ""{table}"";");

                migrationBuilder.Sql($@"ALTER TABLE ""{table}"" ENABLE ROW LEVEL SECURITY;");
                migrationBuilder.Sql($@"ALTER TABLE ""{table}"" FORCE ROW LEVEL SECURITY;");

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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var table in Tables)
            {
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_select ON ""{table}"";");
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_insert ON ""{table}"";");
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_update ON ""{table}"";");
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_delete ON ""{table}"";");
                migrationBuilder.Sql($@"ALTER TABLE ""{table}"" DISABLE ROW LEVEL SECURITY;");
            }
        }
    }
}
