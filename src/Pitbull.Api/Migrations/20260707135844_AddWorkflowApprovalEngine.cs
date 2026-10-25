using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkflowApprovalEngine : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "workflow_definitions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    EntityType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TriggerStatus = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ApprovedStatus = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    RejectedStatus = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    AmountThreshold = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    Mode = table.Column<int>(type: "integer", nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
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
                    table.PrimaryKey("PK_workflow_definitions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "workflow_approval_steps",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkflowDefinitionId = table.Column<Guid>(type: "uuid", nullable: false),
                    StepOrder = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ApproverType = table.Column<int>(type: "integer", nullable: false),
                    ApproverRole = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ApproverUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ApproverRelationship = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    IsOptional = table.Column<bool>(type: "boolean", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
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
                    table.PrimaryKey("PK_workflow_approval_steps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_workflow_approval_steps_workflow_definitions_WorkflowDefini~",
                        column: x => x.WorkflowDefinitionId,
                        principalTable: "workflow_definitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "workflow_approval_actions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkflowDefinitionId = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkflowApprovalStepId = table.Column<Guid>(type: "uuid", nullable: false),
                    EntityType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    EntityId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignedToUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignedToUserName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ResolvedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Comment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    StepOrder = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
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
                    table.PrimaryKey("PK_workflow_approval_actions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_workflow_approval_actions_workflow_approval_steps_WorkflowA~",
                        column: x => x.WorkflowApprovalStepId,
                        principalTable: "workflow_approval_steps",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_workflow_approval_actions_assignee_status",
                table: "workflow_approval_actions",
                columns: new[] { "AssignedToUserId", "Status", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_workflow_approval_actions_CompanyId",
                table: "workflow_approval_actions",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_workflow_approval_actions_entity_status",
                table: "workflow_approval_actions",
                columns: new[] { "EntityType", "EntityId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_workflow_approval_actions_TenantId",
                table: "workflow_approval_actions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_workflow_approval_actions_WorkflowApprovalStepId",
                table: "workflow_approval_actions",
                column: "WorkflowApprovalStepId");

            migrationBuilder.CreateIndex(
                name: "IX_workflow_approval_steps_CompanyId",
                table: "workflow_approval_steps",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_workflow_approval_steps_definition_order",
                table: "workflow_approval_steps",
                columns: new[] { "WorkflowDefinitionId", "StepOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_workflow_approval_steps_TenantId",
                table: "workflow_approval_steps",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_workflow_definitions_company_entity_active",
                table: "workflow_definitions",
                columns: new[] { "CompanyId", "EntityType", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_workflow_definitions_CompanyId",
                table: "workflow_definitions",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_workflow_definitions_TenantId",
                table: "workflow_definitions",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "workflow_approval_actions");

            migrationBuilder.DropTable(
                name: "workflow_approval_steps");

            migrationBuilder.DropTable(
                name: "workflow_definitions");
        }
    }
}
