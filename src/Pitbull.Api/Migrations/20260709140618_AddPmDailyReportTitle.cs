using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPmDailyReportTitle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Title was also added in 20260626223208_AddOwnerChangeOrderAndVendorInvoiceAccrual.
            // This migration was added later for DBs that never received that column.
            // Use IF NOT EXISTS so a full history apply on a fresh database does not 42701.
            migrationBuilder.Sql(
                """
                ALTER TABLE pm_daily_reports
                ADD COLUMN IF NOT EXISTS "Title" character varying(200) NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Do not drop Title here — the earlier migration owns the column for DBs
            // that applied the full chain. Dropping would remove a still-required column
            // when only this migration is rolled back.
        }
    }
}
