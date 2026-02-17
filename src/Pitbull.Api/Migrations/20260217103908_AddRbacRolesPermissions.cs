using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRbacRolesPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // file_attachments table already created by AddFileAttachments migration (20260217071309)

            migrationBuilder.CreateTable(
                name: "rbac_permissions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Category = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
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
                    table.PrimaryKey("PK_rbac_permissions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "rbac_roles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsSystem = table.Column<bool>(type: "boolean", nullable: false),
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
                    table.PrimaryKey("PK_rbac_roles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "rbac_role_permissions",
                columns: table => new
                {
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoleId = table.Column<Guid>(type: "uuid", nullable: false),
                    PermissionId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rbac_role_permissions", x => new { x.TenantId, x.RoleId, x.PermissionId });
                    table.ForeignKey(
                        name: "FK_rbac_role_permissions_rbac_permissions_PermissionId",
                        column: x => x.PermissionId,
                        principalTable: "rbac_permissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_rbac_role_permissions_rbac_roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "rbac_roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "rbac_user_roles",
                columns: table => new
                {
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoleId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rbac_user_roles", x => new { x.TenantId, x.UserId, x.RoleId });
                    table.ForeignKey(
                        name: "FK_rbac_user_roles_rbac_roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "rbac_roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_rbac_user_roles_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // file_attachments indexes already created by AddFileAttachments migration (20260217071309)

            migrationBuilder.CreateIndex(
                name: "IX_rbac_permissions_TenantId",
                table: "rbac_permissions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_rbac_permissions_TenantId_Category",
                table: "rbac_permissions",
                columns: new[] { "TenantId", "Category" });

            migrationBuilder.CreateIndex(
                name: "IX_rbac_permissions_TenantId_Name",
                table: "rbac_permissions",
                columns: new[] { "TenantId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_rbac_role_permissions_PermissionId",
                table: "rbac_role_permissions",
                column: "PermissionId");

            migrationBuilder.CreateIndex(
                name: "IX_rbac_role_permissions_RoleId",
                table: "rbac_role_permissions",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_rbac_role_permissions_TenantId_PermissionId",
                table: "rbac_role_permissions",
                columns: new[] { "TenantId", "PermissionId" });

            migrationBuilder.CreateIndex(
                name: "IX_rbac_roles_TenantId",
                table: "rbac_roles",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_rbac_roles_TenantId_Name",
                table: "rbac_roles",
                columns: new[] { "TenantId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_rbac_user_roles_RoleId",
                table: "rbac_user_roles",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_rbac_user_roles_TenantId_RoleId",
                table: "rbac_user_roles",
                columns: new[] { "TenantId", "RoleId" });

            migrationBuilder.CreateIndex(
                name: "IX_rbac_user_roles_UserId",
                table: "rbac_user_roles",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // file_attachments managed by AddFileAttachments migration (20260217071309)

            migrationBuilder.DropTable(
                name: "rbac_role_permissions");

            migrationBuilder.DropTable(
                name: "rbac_user_roles");

            migrationBuilder.DropTable(
                name: "rbac_permissions");

            migrationBuilder.DropTable(
                name: "rbac_roles");
        }
    }
}
