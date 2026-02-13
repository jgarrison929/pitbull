using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPayPeriods : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Create pay_period_configurations table
            migrationBuilder.CreateTable(
                name: "pay_period_configurations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false, comment: "Period type: 0=Weekly, 1=BiWeekly, 2=SemiMonthly, 3=Monthly"),
                    WeekStartDay = table.Column<int>(type: "integer", nullable: false, comment: "Day of week that starts the period (0=Sunday)"),
                    SemiMonthlyFirstDay = table.Column<int>(type: "integer", nullable: false, comment: "First day of month for semi-monthly (e.g., 1)"),
                    SemiMonthlySecondDay = table.Column<int>(type: "integer", nullable: false, comment: "Second day of month for semi-monthly (e.g., 16)"),
                    AutoLockEnabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false, comment: "Whether to auto-lock periods after grace days"),
                    AutoLockDaysAfterEnd = table.Column<int>(type: "integer", nullable: false, defaultValue: 3, comment: "Days after period ends before auto-lock"),
                    PeriodsToGenerateAhead = table.Column<int>(type: "integer", nullable: false, defaultValue: 4, comment: "How many periods ahead to auto-generate"),
                    BiWeeklyReferenceDate = table.Column<DateOnly>(type: "date", nullable: true, comment: "Reference date for bi-weekly calculation"),
                    EnforcementEnabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true, comment: "Whether pay period locking is enforced"),
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
                    table.PrimaryKey("PK_pay_period_configurations", x => x.Id);
                });

            // Create pay_periods table
            migrationBuilder.CreateTable(
                name: "pay_periods",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false, comment: "Start date of the pay period (inclusive)"),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false, comment: "End date of the pay period (inclusive)"),
                    Status = table.Column<int>(type: "integer", nullable: false, comment: "Status: 0=Open, 1=Locked, 2=Processed"),
                    LockedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true, comment: "When the period was locked"),
                    LockedById = table.Column<Guid>(type: "uuid", nullable: true, comment: "User who locked the period"),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true, comment: "Optional notes about the pay period"),
                    ProcessedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true, comment: "When the period was processed for payroll"),
                    ProcessedById = table.Column<Guid>(type: "uuid", nullable: true, comment: "User who marked it as processed"),
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
                    table.PrimaryKey("PK_pay_periods", x => x.Id);
                    table.ForeignKey(
                        name: "FK_pay_periods_locked_by",
                        column: x => x.LockedById,
                        principalTable: "employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_pay_periods_processed_by",
                        column: x => x.ProcessedById,
                        principalTable: "employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            // Create indexes for pay_period_configurations
            migrationBuilder.CreateIndex(
                name: "IX_pay_period_configurations_tenant_unique",
                table: "pay_period_configurations",
                column: "TenantId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pay_period_configurations_TenantId",
                table: "pay_period_configurations",
                column: "TenantId");

            // Create indexes for pay_periods
            migrationBuilder.CreateIndex(
                name: "IX_pay_periods_tenant",
                table: "pay_periods",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_pay_periods_date_range",
                table: "pay_periods",
                columns: new[] { "TenantId", "StartDate", "EndDate" });

            migrationBuilder.CreateIndex(
                name: "IX_pay_periods_status",
                table: "pay_periods",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_pay_periods_unique_start",
                table: "pay_periods",
                columns: new[] { "TenantId", "StartDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pay_periods_LockedById",
                table: "pay_periods",
                column: "LockedById");

            migrationBuilder.CreateIndex(
                name: "IX_pay_periods_ProcessedById",
                table: "pay_periods",
                column: "ProcessedById");

            // Add RLS policies for the new tables
            migrationBuilder.Sql(@"
                -- Enable RLS on pay_periods
                ALTER TABLE pay_periods ENABLE ROW LEVEL SECURITY;
                ALTER TABLE pay_periods FORCE ROW LEVEL SECURITY;

                -- Drop existing policies if they exist (for idempotency)
                DROP POLICY IF EXISTS pay_periods_tenant_isolation ON pay_periods;

                -- Create tenant isolation policy
                CREATE POLICY pay_periods_tenant_isolation ON pay_periods
                    USING (""TenantId""::text = current_setting('app.current_tenant', true));

                -- Enable RLS on pay_period_configurations
                ALTER TABLE pay_period_configurations ENABLE ROW LEVEL SECURITY;
                ALTER TABLE pay_period_configurations FORCE ROW LEVEL SECURITY;

                -- Drop existing policies if they exist
                DROP POLICY IF EXISTS pay_period_configurations_tenant_isolation ON pay_period_configurations;

                -- Create tenant isolation policy
                CREATE POLICY pay_period_configurations_tenant_isolation ON pay_period_configurations
                    USING (""TenantId""::text = current_setting('app.current_tenant', true));
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Remove RLS policies first
            migrationBuilder.Sql(@"
                DROP POLICY IF EXISTS pay_periods_tenant_isolation ON pay_periods;
                DROP POLICY IF EXISTS pay_period_configurations_tenant_isolation ON pay_period_configurations;
            ");

            migrationBuilder.DropTable(
                name: "pay_periods");

            migrationBuilder.DropTable(
                name: "pay_period_configurations");
        }
    }
}
