using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPayrollRLSPolicies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Enable RLS on all Payroll tenant-scoped tables
            var tables = new[]
            {
                "payroll.pay_periods",
                "payroll.payroll_batches",
                "payroll.payroll_entries",
                "payroll.payroll_deduction_lines"
            };

            foreach (var table in tables)
            {
                var policyName = table.Replace(".", "_");
                
                // Enable RLS
                migrationBuilder.Sql($"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;");

                // Force RLS even for table owners (defense-in-depth)
                migrationBuilder.Sql($"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;");

                // Create SELECT policy
                migrationBuilder.Sql($@"
                    CREATE POLICY {policyName}_tenant_isolation_select ON {table} 
                    FOR SELECT 
                    USING (""TenantId""::text = current_setting('app.current_tenant', true));
                ");

                // Create INSERT policy  
                migrationBuilder.Sql($@"
                    CREATE POLICY {policyName}_tenant_isolation_insert ON {table} 
                    FOR INSERT 
                    WITH CHECK (""TenantId""::text = current_setting('app.current_tenant', true));
                ");

                // Create UPDATE policy
                migrationBuilder.Sql($@"
                    CREATE POLICY {policyName}_tenant_isolation_update ON {table} 
                    FOR UPDATE 
                    USING (""TenantId""::text = current_setting('app.current_tenant', true))
                    WITH CHECK (""TenantId""::text = current_setting('app.current_tenant', true));
                ");

                // Create DELETE policy
                migrationBuilder.Sql($@"
                    CREATE POLICY {policyName}_tenant_isolation_delete ON {table} 
                    FOR DELETE 
                    USING (""TenantId""::text = current_setting('app.current_tenant', true));
                ");
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Disable RLS and drop policies
            var tables = new[]
            {
                "payroll.pay_periods",
                "payroll.payroll_batches",
                "payroll.payroll_entries",
                "payroll.payroll_deduction_lines"
            };

            foreach (var table in tables)
            {
                var policyName = table.Replace(".", "_");
                
                // Drop policies
                migrationBuilder.Sql($"DROP POLICY IF EXISTS {policyName}_tenant_isolation_select ON {table};");
                migrationBuilder.Sql($"DROP POLICY IF EXISTS {policyName}_tenant_isolation_insert ON {table};");
                migrationBuilder.Sql($"DROP POLICY IF EXISTS {policyName}_tenant_isolation_update ON {table};");
                migrationBuilder.Sql($"DROP POLICY IF EXISTS {policyName}_tenant_isolation_delete ON {table};");
                
                // Disable RLS
                migrationBuilder.Sql($"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;");
            }
        }
    }
}
