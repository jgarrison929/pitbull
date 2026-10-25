using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class SyncModelSnapshot : Migration
    {
        // This migration is intentionally empty.
        // The file_attachments table was already created by AddFileAttachments,
        // but the model snapshot was not updated. This migration corrects the
        // snapshot without duplicating the table creation.

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
