using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTimeEntrySubmissionFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "SubmittedAt",
                table: "time_entries",
                type: "timestamp with time zone",
                nullable: true,
                comment: "When this entry was submitted (from Draft to Submitted)");

            migrationBuilder.AddColumn<Guid>(
                name: "SubmittedById",
                table: "time_entries",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_time_entries_SubmittedById",
                table: "time_entries",
                column: "SubmittedById");

            migrationBuilder.AddForeignKey(
                name: "FK_time_entries_submitted_by",
                table: "time_entries",
                column: "SubmittedById",
                principalTable: "employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_time_entries_submitted_by",
                table: "time_entries");

            migrationBuilder.DropIndex(
                name: "IX_time_entries_SubmittedById",
                table: "time_entries");

            migrationBuilder.DropColumn(
                name: "SubmittedAt",
                table: "time_entries");

            migrationBuilder.DropColumn(
                name: "SubmittedById",
                table: "time_entries");
        }
    }
}
