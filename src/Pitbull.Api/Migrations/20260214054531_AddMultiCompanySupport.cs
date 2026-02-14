using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <summary>
    /// Adds multi-company support:
    /// - Creates companies table and user_company_access table
    /// - Adds CompanyId to all company-scoped entities (13 tables)
    /// - Adds HomeCompanyId to employees
    /// - Creates a default company for each existing tenant
    /// - Backfills CompanyId from default company
    /// - Creates UserCompanyAccess entries for all existing users
    /// - Updates RLS policies for company-level isolation
    /// </summary>
    public partial class AddMultiCompanySupport : Migration
    {
        private static readonly string[] CompanyTables = new[]
        {
            "projects", "bids", "subcontracts", "rfis", "time_entries",
            "pay_periods", "project_phases", "project_budgets",
            "project_projections", "bid_items", "change_orders",
            "payment_applications", "project_assignments"
        };

        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ==========================================
            // Step 1: Create companies table
            // ==========================================
            migrationBuilder.CreateTable(
                name: "companies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ShortName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    TaxId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    City = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    State = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ZipCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Phone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Website = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Email = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    LogoUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    PrimaryColor = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Currency = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false, defaultValue: "USD"),
                    Timezone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "America/Los_Angeles"),
                    DateFormat = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "MM/dd/yyyy"),
                    FiscalYearStartMonth = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    Settings = table.Column<string>(type: "jsonb", nullable: false, defaultValue: "{}"),
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
                    table.PrimaryKey("PK_companies", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_companies_TenantId",
                table: "companies",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_companies_TenantId_Code",
                table: "companies",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            // ==========================================
            // Step 2: Create user_company_access table
            // ==========================================
            migrationBuilder.CreateTable(
                name: "user_company_access",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyRole = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
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
                    table.PrimaryKey("PK_user_company_access", x => x.Id);
                    table.ForeignKey(
                        name: "FK_user_company_access_companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_user_company_access_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_user_company_access_CompanyId",
                table: "user_company_access",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_user_company_access_TenantId",
                table: "user_company_access",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_user_company_access_TenantId_UserId_CompanyId",
                table: "user_company_access",
                columns: new[] { "TenantId", "UserId", "CompanyId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_user_company_access_UserId",
                table: "user_company_access",
                column: "UserId");

            // ==========================================
            // Step 3: Create default company for each existing tenant
            // ==========================================
            migrationBuilder.Sql(@"
                INSERT INTO companies (""Id"", ""TenantId"", ""Code"", ""Name"", ""IsDefault"", ""IsActive"",
                    ""SortOrder"", ""Currency"", ""Timezone"", ""DateFormat"", ""FiscalYearStartMonth"",
                    ""Settings"", ""CreatedAt"", ""CreatedBy"", ""IsDeleted"")
                SELECT gen_random_uuid(), t.""Id"", '01', t.""Name"", true, true,
                    0, 'USD', 'America/Los_Angeles', 'MM/dd/yyyy', 1,
                    '{}', NOW(), 'migration', false
                FROM tenants t
                WHERE NOT EXISTS (
                    SELECT 1 FROM companies c WHERE c.""TenantId"" = t.""Id""
                );
            ");

            // ==========================================
            // Step 4: Add CompanyId columns (nullable initially)
            // ==========================================
            foreach (var table in CompanyTables)
            {
                migrationBuilder.AddColumn<Guid>(
                    name: "CompanyId",
                    table: table,
                    type: "uuid",
                    nullable: true);
            }

            // Add HomeCompanyId to employees
            migrationBuilder.AddColumn<Guid>(
                name: "HomeCompanyId",
                table: "employees",
                type: "uuid",
                nullable: true);

            // ==========================================
            // Step 5: Backfill CompanyId from default company
            // ==========================================
            foreach (var table in CompanyTables)
            {
                migrationBuilder.Sql($@"
                    UPDATE ""{table}"" t
                    SET ""CompanyId"" = c.""Id""
                    FROM companies c
                    WHERE c.""TenantId"" = t.""TenantId"" AND c.""IsDefault"" = true
                    AND t.""CompanyId"" IS NULL;
                ");
            }

            // Backfill HomeCompanyId for employees
            migrationBuilder.Sql(@"
                UPDATE employees e
                SET ""HomeCompanyId"" = c.""Id""
                FROM companies c
                WHERE c.""TenantId"" = e.""TenantId"" AND c.""IsDefault"" = true
                AND e.""HomeCompanyId"" IS NULL;
            ");

            // ==========================================
            // Step 6: Make CompanyId NOT NULL and add FK/indexes
            // ==========================================
            foreach (var table in CompanyTables)
            {
                migrationBuilder.AlterColumn<Guid>(
                    name: "CompanyId",
                    table: table,
                    type: "uuid",
                    nullable: false,
                    defaultValue: Guid.Empty);

                migrationBuilder.AddForeignKey(
                    name: $"FK_{table}_companies_CompanyId",
                    table: table,
                    column: "CompanyId",
                    principalTable: "companies",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);

                migrationBuilder.CreateIndex(
                    name: $"IX_{table}_CompanyId",
                    table: table,
                    column: "CompanyId");
            }

            // Add FK for employees.HomeCompanyId (nullable)
            migrationBuilder.AddForeignKey(
                name: "FK_employees_companies_HomeCompanyId",
                table: "employees",
                column: "HomeCompanyId",
                principalTable: "companies",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.CreateIndex(
                name: "IX_employees_HomeCompanyId",
                table: "employees",
                column: "HomeCompanyId");

            // ==========================================
            // Step 7: Create UserCompanyAccess for existing users
            // ==========================================
            migrationBuilder.Sql(@"
                INSERT INTO user_company_access (""Id"", ""TenantId"", ""UserId"", ""CompanyId"",
                    ""IsDefault"", ""CreatedAt"", ""CreatedBy"", ""IsDeleted"")
                SELECT gen_random_uuid(), u.""TenantId"", u.""Id"", c.""Id"",
                    true, NOW(), 'migration', false
                FROM users u
                JOIN companies c ON c.""TenantId"" = u.""TenantId"" AND c.""IsDefault"" = true
                WHERE NOT EXISTS (
                    SELECT 1 FROM user_company_access uca
                    WHERE uca.""UserId"" = u.""Id"" AND uca.""CompanyId"" = c.""Id""
                );
            ");

            // ==========================================
            // Step 8: RLS policies for new tables
            // ==========================================

            // RLS for companies table (tenant-scoped)
            migrationBuilder.Sql(@"ALTER TABLE companies ENABLE ROW LEVEL SECURITY;");
            migrationBuilder.Sql(@"ALTER TABLE companies FORCE ROW LEVEL SECURITY;");
            migrationBuilder.Sql(@"
                CREATE POLICY companies_tenant_isolation_select ON companies
                FOR SELECT USING (""TenantId""::text = current_setting('app.current_tenant', true));
            ");
            migrationBuilder.Sql(@"
                CREATE POLICY companies_tenant_isolation_insert ON companies
                FOR INSERT WITH CHECK (""TenantId""::text = current_setting('app.current_tenant', true));
            ");
            migrationBuilder.Sql(@"
                CREATE POLICY companies_tenant_isolation_update ON companies
                FOR UPDATE USING (""TenantId""::text = current_setting('app.current_tenant', true))
                WITH CHECK (""TenantId""::text = current_setting('app.current_tenant', true));
            ");
            migrationBuilder.Sql(@"
                CREATE POLICY companies_tenant_isolation_delete ON companies
                FOR DELETE USING (""TenantId""::text = current_setting('app.current_tenant', true));
            ");

            // RLS for user_company_access table (tenant-scoped)
            migrationBuilder.Sql(@"ALTER TABLE user_company_access ENABLE ROW LEVEL SECURITY;");
            migrationBuilder.Sql(@"ALTER TABLE user_company_access FORCE ROW LEVEL SECURITY;");
            migrationBuilder.Sql(@"
                CREATE POLICY user_company_access_tenant_isolation_select ON user_company_access
                FOR SELECT USING (""TenantId""::text = current_setting('app.current_tenant', true));
            ");
            migrationBuilder.Sql(@"
                CREATE POLICY user_company_access_tenant_isolation_insert ON user_company_access
                FOR INSERT WITH CHECK (""TenantId""::text = current_setting('app.current_tenant', true));
            ");
            migrationBuilder.Sql(@"
                CREATE POLICY user_company_access_tenant_isolation_update ON user_company_access
                FOR UPDATE USING (""TenantId""::text = current_setting('app.current_tenant', true))
                WITH CHECK (""TenantId""::text = current_setting('app.current_tenant', true));
            ");
            migrationBuilder.Sql(@"
                CREATE POLICY user_company_access_tenant_isolation_delete ON user_company_access
                FOR DELETE USING (""TenantId""::text = current_setting('app.current_tenant', true));
            ");

            // ==========================================
            // Step 9: Update RLS policies on company-scoped tables
            // Add compound tenant + company isolation
            // ==========================================
            foreach (var table in CompanyTables)
            {
                // Drop existing policies
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_select ON ""{table}"";");
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_insert ON ""{table}"";");
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_update ON ""{table}"";");
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_delete ON ""{table}"";");

                // Create new compound policies (tenant + optional company)
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

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Restore original RLS policies
            foreach (var table in CompanyTables)
            {
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_company_isolation ON ""{table}"";");

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
                    FOR UPDATE USING (""TenantId""::text = current_setting('app.current_tenant', true))
                    WITH CHECK (""TenantId""::text = current_setting('app.current_tenant', true));
                ");
                migrationBuilder.Sql($@"
                    CREATE POLICY {table}_tenant_isolation_delete ON ""{table}""
                    FOR DELETE USING (""TenantId""::text = current_setting('app.current_tenant', true));
                ");
            }

            // Drop RLS on new tables
            migrationBuilder.Sql("DROP POLICY IF EXISTS companies_tenant_isolation_select ON companies;");
            migrationBuilder.Sql("DROP POLICY IF EXISTS companies_tenant_isolation_insert ON companies;");
            migrationBuilder.Sql("DROP POLICY IF EXISTS companies_tenant_isolation_update ON companies;");
            migrationBuilder.Sql("DROP POLICY IF EXISTS companies_tenant_isolation_delete ON companies;");
            migrationBuilder.Sql("ALTER TABLE companies DISABLE ROW LEVEL SECURITY;");

            migrationBuilder.Sql("DROP POLICY IF EXISTS user_company_access_tenant_isolation_select ON user_company_access;");
            migrationBuilder.Sql("DROP POLICY IF EXISTS user_company_access_tenant_isolation_insert ON user_company_access;");
            migrationBuilder.Sql("DROP POLICY IF EXISTS user_company_access_tenant_isolation_update ON user_company_access;");
            migrationBuilder.Sql("DROP POLICY IF EXISTS user_company_access_tenant_isolation_delete ON user_company_access;");
            migrationBuilder.Sql("ALTER TABLE user_company_access DISABLE ROW LEVEL SECURITY;");

            // Drop foreign keys and indexes on CompanyId
            foreach (var table in CompanyTables)
            {
                migrationBuilder.DropForeignKey(name: $"FK_{table}_companies_CompanyId", table: table);
                migrationBuilder.DropIndex(name: $"IX_{table}_CompanyId", table: table);
                migrationBuilder.DropColumn(name: "CompanyId", table: table);
            }

            migrationBuilder.DropForeignKey(name: "FK_employees_companies_HomeCompanyId", table: "employees");
            migrationBuilder.DropIndex(name: "IX_employees_HomeCompanyId", table: "employees");
            migrationBuilder.DropColumn(name: "HomeCompanyId", table: "employees");

            migrationBuilder.DropTable(name: "user_company_access");
            migrationBuilder.DropTable(name: "companies");
        }
    }
}
