using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <summary>
    /// 1) Fix: remove FORCE RLS from vendor_portal_tokens (token hash lookup must run before tenant GUC is known).
    /// 2) Add FORCE RLS + tenant isolation for remaining tenant-scoped tables that only load under authenticated tenant context.
    /// Skips: rbac_*, roles, diagnostic_errors (nullable TenantId), team_invitations (pre-tenant token lookup).
    /// </summary>
    public partial class AddResidualTablesTenantRls : Migration
    {
        private static readonly string[] Tables =
        [
            "vendor_invoices",
            "vendor_payment_applications",
            "wip_reports",
            "wip_report_lines",
            "wage_determinations",
            "wage_determination_rates",
            "work_classifications",
            "tax_rates",
            "tenant_settings",
            "migration_projects",
            "workflow_definitions",
            "workflow_transitions",
            "workflow_approval_steps",
            "workflow_approval_actions",
        ];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // --- Critical fix: public portal token lookup is pre-tenant ---
            // IgnoreQueryFilters does not bypass PostgreSQL RLS. Lookup by hash must succeed
            // before BindPortalContextAsync sets app.current_tenant.
            migrationBuilder.Sql(@"DROP POLICY IF EXISTS vendor_portal_tokens_tenant_isolation_select ON ""vendor_portal_tokens"";");
            migrationBuilder.Sql(@"DROP POLICY IF EXISTS vendor_portal_tokens_tenant_isolation_insert ON ""vendor_portal_tokens"";");
            migrationBuilder.Sql(@"DROP POLICY IF EXISTS vendor_portal_tokens_tenant_isolation_update ON ""vendor_portal_tokens"";");
            migrationBuilder.Sql(@"DROP POLICY IF EXISTS vendor_portal_tokens_tenant_isolation_delete ON ""vendor_portal_tokens"";");
            migrationBuilder.Sql(@"ALTER TABLE ""vendor_portal_tokens"" DISABLE ROW LEVEL SECURITY;");

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

            // Do not re-enable vendor_portal_tokens RLS on Down (would re-break portal token auth).
        }
    }
}
