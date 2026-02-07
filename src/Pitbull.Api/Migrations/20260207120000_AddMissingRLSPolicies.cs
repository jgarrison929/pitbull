using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <summary>
    /// Adds RLS policies to TimeTracking and RFI tables that were missing from initial migration.
    /// This is a security fix - tenant isolation was not enforced on these tables.
    /// </summary>
    public partial class AddMissingRLSPolicies : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Tables that need RLS policies added
            // Note: CostCodes uses PascalCase table name (EF Core default wasn't overridden)
            var tables = new[]
            {
                "employees",
                "time_entries",
                "project_assignments",
                "rfis",
                "CostCodes"
            };

            foreach (var table in tables)
            {
                // Enable RLS
                migrationBuilder.Sql($"ALTER TABLE \"{table}\" ENABLE ROW LEVEL SECURITY;");

                // Force RLS even for table owners (defense-in-depth)
                migrationBuilder.Sql($"ALTER TABLE \"{table}\" FORCE ROW LEVEL SECURITY;");

                // Create SELECT policy
                migrationBuilder.Sql($@"
                    CREATE POLICY {table.ToLower()}_tenant_isolation_select ON ""{table}"" 
                    FOR SELECT 
                    USING (""TenantId""::text = current_setting('app.current_tenant', true));
                ");

                // Create INSERT policy
                migrationBuilder.Sql($@"
                    CREATE POLICY {table.ToLower()}_tenant_isolation_insert ON ""{table}"" 
                    FOR INSERT 
                    WITH CHECK (""TenantId""::text = current_setting('app.current_tenant', true));
                ");

                // Create UPDATE policy
                migrationBuilder.Sql($@"
                    CREATE POLICY {table.ToLower()}_tenant_isolation_update ON ""{table}"" 
                    FOR UPDATE 
                    USING (""TenantId""::text = current_setting('app.current_tenant', true))
                    WITH CHECK (""TenantId""::text = current_setting('app.current_tenant', true));
                ");

                // Create DELETE policy
                migrationBuilder.Sql($@"
                    CREATE POLICY {table.ToLower()}_tenant_isolation_delete ON ""{table}"" 
                    FOR DELETE 
                    USING (""TenantId""::text = current_setting('app.current_tenant', true));
                ");
            }
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            var tables = new[]
            {
                "employees",
                "time_entries",
                "project_assignments",
                "rfis",
                "CostCodes"
            };

            foreach (var table in tables)
            {
                // Drop policies
                migrationBuilder.Sql($"DROP POLICY IF EXISTS {table.ToLower()}_tenant_isolation_select ON \"{table}\";");
                migrationBuilder.Sql($"DROP POLICY IF EXISTS {table.ToLower()}_tenant_isolation_insert ON \"{table}\";");
                migrationBuilder.Sql($"DROP POLICY IF EXISTS {table.ToLower()}_tenant_isolation_update ON \"{table}\";");
                migrationBuilder.Sql($"DROP POLICY IF EXISTS {table.ToLower()}_tenant_isolation_delete ON \"{table}\";");
                
                // Disable RLS
                migrationBuilder.Sql($"ALTER TABLE \"{table}\" DISABLE ROW LEVEL SECURITY;");
            }
        }
    }
}
