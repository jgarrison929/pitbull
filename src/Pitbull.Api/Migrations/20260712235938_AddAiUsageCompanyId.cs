using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAiUsageCompanyId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CompanyId",
                table: "ai_usage_records",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ai_usage_records_TenantId_CompanyId_RequestedAt",
                table: "ai_usage_records",
                columns: new[] { "TenantId", "CompanyId", "RequestedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ai_usage_records_TenantId_CompanyId_RequestedAt",
                table: "ai_usage_records");

            migrationBuilder.DropColumn(
                name: "CompanyId",
                table: "ai_usage_records");
        }
    }
}
