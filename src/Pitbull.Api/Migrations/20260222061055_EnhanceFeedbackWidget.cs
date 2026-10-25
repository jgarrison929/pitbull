using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class EnhanceFeedbackWidget : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BrowserInfo",
                table: "feedback",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ScreenshotUrl",
                table: "feedback",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Type",
                table: "feedback",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "General");

            migrationBuilder.CreateIndex(
                name: "IX_feedback_TenantId_Type",
                table: "feedback",
                columns: new[] { "TenantId", "Type" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_feedback_TenantId_Type",
                table: "feedback");

            migrationBuilder.DropColumn(
                name: "BrowserInfo",
                table: "feedback");

            migrationBuilder.DropColumn(
                name: "ScreenshotUrl",
                table: "feedback");

            migrationBuilder.DropColumn(
                name: "Type",
                table: "feedback");
        }
    }
}
