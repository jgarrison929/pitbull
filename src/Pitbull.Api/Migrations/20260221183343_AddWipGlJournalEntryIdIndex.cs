using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddWipGlJournalEntryIdIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_wip_reports_gl_journal_entry_unique",
                table: "wip_reports",
                column: "GlJournalEntryId",
                unique: true,
                filter: "\"GlJournalEntryId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_wip_reports_gl_journal_entry_unique",
                table: "wip_reports");
        }
    }
}
