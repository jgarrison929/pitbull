using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectManagementForeignKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_pm_tasks_AssignedByUserId",
                table: "pm_tasks",
                column: "AssignedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_task_comments_CommentedByUserId",
                table: "pm_task_comments",
                column: "CommentedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_submittals_ScheduleActivityId",
                table: "pm_submittals",
                column: "ScheduleActivityId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_submittal_workflow_events_ActionByUserId",
                table: "pm_submittal_workflow_events",
                column: "ActionByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_submittal_attachments_DocumentId",
                table: "pm_submittal_attachments",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_spec_sections_DocumentId",
                table: "pm_spec_sections",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_spec_section_revisions_DocumentId",
                table: "pm_spec_section_revisions",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_resource_assignments_EmployeeId",
                table: "pm_schedule_resource_assignments",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_resource_assignments_EquipmentId",
                table: "pm_schedule_resource_assignments",
                column: "EquipmentId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_resource_assignments_SubcontractId",
                table: "pm_schedule_resource_assignments",
                column: "SubcontractId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_import_logs_ImportedByUserId",
                table: "pm_schedule_import_logs",
                column: "ImportedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_import_logs_ScheduleId",
                table: "pm_schedule_import_logs",
                column: "ScheduleId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_dependencies_PredecessorActivityId",
                table: "pm_schedule_dependencies",
                column: "PredecessorActivityId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_dependencies_SuccessorActivityId",
                table: "pm_schedule_dependencies",
                column: "SuccessorActivityId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_baselines_CapturedByUserId",
                table: "pm_schedule_baselines",
                column: "CapturedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_baselines_ScheduleId",
                table: "pm_schedule_baselines",
                column: "ScheduleId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_baseline_activities_ActivityId",
                table: "pm_schedule_baseline_activities",
                column: "ActivityId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_activities_CostCodeId",
                table: "pm_schedule_activities",
                column: "CostCodeId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_activities_ParentActivityId",
                table: "pm_schedule_activities",
                column: "ParentActivityId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_activities_PhaseId",
                table: "pm_schedule_activities",
                column: "PhaseId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_schedule_activities_ProjectId",
                table: "pm_schedule_activities",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_rfi_distribution_recipients_RecipientUserId",
                table: "pm_rfi_distribution_recipients",
                column: "RecipientUserId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_rfi_cost_impact_links_ChangeOrderId",
                table: "pm_rfi_cost_impact_links",
                column: "ChangeOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_rfi_cost_impact_links_CostCodeId",
                table: "pm_rfi_cost_impact_links",
                column: "CostCodeId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_rfi_attachments_DocumentId",
                table: "pm_rfi_attachments",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_projection_cost_codes_CostCodeId",
                table: "pm_projection_cost_codes",
                column: "CostCodeId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_projection_cost_codes_PhaseId",
                table: "pm_projection_cost_codes",
                column: "PhaseId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_project_narratives_PreparedByUserId",
                table: "pm_project_narratives",
                column: "PreparedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_project_narratives_TemplateId",
                table: "pm_project_narratives",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_project_narrative_revisions_RevisedByUserId",
                table: "pm_project_narrative_revisions",
                column: "RevisedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_progress_time_entry_links_TimeEntryId",
                table: "pm_progress_time_entry_links",
                column: "TimeEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_progress_entries_EnteredByUserId",
                table: "pm_progress_entries",
                column: "EnteredByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_plan_sheets_DocumentId",
                table: "pm_plan_sheets",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_plan_sheets_ProjectId",
                table: "pm_plan_sheets",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_plan_sheet_revisions_DocumentId",
                table: "pm_plan_sheet_revisions",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_plan_sheet_revisions_IssuedByUserId",
                table: "pm_plan_sheet_revisions",
                column: "IssuedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_monthly_projections_PreparedByUserId",
                table: "pm_monthly_projections",
                column: "PreparedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_monthly_projections_ReviewedByUserId",
                table: "pm_monthly_projections",
                column: "ReviewedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_meetings_AgendaTemplateId",
                table: "pm_meetings",
                column: "AgendaTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_meetings_MeetingSeriesId",
                table: "pm_meetings",
                column: "MeetingSeriesId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_meeting_minutes_RecordedByUserId",
                table: "pm_meeting_minutes",
                column: "RecordedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_meeting_attachments_DocumentId",
                table: "pm_meeting_attachments",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_meeting_agenda_items_PresenterUserId",
                table: "pm_meeting_agenda_items",
                column: "PresenterUserId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_meeting_action_items_MeetingId",
                table: "pm_meeting_action_items",
                column: "MeetingId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_letterhead_configs_LogoDocumentId",
                table: "pm_letterhead_configs",
                column: "LogoDocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_job_cost_unit_progress_CostCodeId",
                table: "pm_job_cost_unit_progress",
                column: "CostCodeId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_job_cost_unit_progress_PhaseId",
                table: "pm_job_cost_unit_progress",
                column: "PhaseId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_job_cost_forecasts_CostCodeId",
                table: "pm_job_cost_forecasts",
                column: "CostCodeId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_job_cost_forecasts_PhaseId",
                table: "pm_job_cost_forecasts",
                column: "PhaseId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_job_cost_commitments_CostCodeId",
                table: "pm_job_cost_commitments",
                column: "CostCodeId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_job_cost_commitments_PhaseId",
                table: "pm_job_cost_commitments",
                column: "PhaseId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_job_cost_budgets_CostCodeId",
                table: "pm_job_cost_budgets",
                column: "CostCodeId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_job_cost_budgets_PhaseId",
                table: "pm_job_cost_budgets",
                column: "PhaseId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_job_cost_actuals_CostCodeId",
                table: "pm_job_cost_actuals",
                column: "CostCodeId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_job_cost_actuals_PhaseId",
                table: "pm_job_cost_actuals",
                column: "PhaseId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_generated_documents_DocumentId",
                table: "pm_generated_documents",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_generated_documents_GeneratedByUserId",
                table: "pm_generated_documents",
                column: "GeneratedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_generated_documents_LetterheadConfigId",
                table: "pm_generated_documents",
                column: "LetterheadConfigId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_generated_documents_TemplateId",
                table: "pm_generated_documents",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_documents_UploadedByUserId",
                table: "pm_documents",
                column: "UploadedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_document_versions_UploadedByUserId",
                table: "pm_document_versions",
                column: "UploadedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_document_folders_ParentFolderId",
                table: "pm_document_folders",
                column: "ParentFolderId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_document_distributions_RecipientUserId",
                table: "pm_document_distributions",
                column: "RecipientUserId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_reports_PreparedByUserId",
                table: "pm_daily_reports",
                column: "PreparedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_visitors_DailyReportId",
                table: "pm_daily_report_visitors",
                column: "DailyReportId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_safety_incidents_DailyReportId",
                table: "pm_daily_report_safety_incidents",
                column: "DailyReportId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_rollups_ChildDailyReportId",
                table: "pm_daily_report_rollups",
                column: "ChildDailyReportId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_photos_DocumentId",
                table: "pm_daily_report_photos",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_photos_TakenByUserId",
                table: "pm_daily_report_photos",
                column: "TakenByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_equipment_DailyReportId",
                table: "pm_daily_report_equipment",
                column: "DailyReportId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_equipment_EquipmentId",
                table: "pm_daily_report_equipment",
                column: "EquipmentId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_deliveries_DailyReportId",
                table: "pm_daily_report_deliveries",
                column: "DailyReportId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_deliveries_RelatedCostCodeId",
                table: "pm_daily_report_deliveries",
                column: "RelatedCostCodeId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_daily_report_crews_DailyReportId",
                table: "pm_daily_report_crews",
                column: "DailyReportId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_cost_code_progress_CostCodeId",
                table: "pm_cost_code_progress",
                column: "CostCodeId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_cost_code_progress_PhaseId",
                table: "pm_cost_code_progress",
                column: "PhaseId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_communication_attachments_DocumentId",
                table: "pm_communication_attachments",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_activity_progress_ScheduleActivityId",
                table: "pm_activity_progress",
                column: "ScheduleActivityId");

            migrationBuilder.AddForeignKey(
                name: "FK_pm_activity_progress_pm_progress_entries_ProgressEntryId",
                table: "pm_activity_progress",
                column: "ProgressEntryId",
                principalTable: "pm_progress_entries",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_activity_progress_pm_schedule_activities_ScheduleActivit~",
                table: "pm_activity_progress",
                column: "ScheduleActivityId",
                principalTable: "pm_schedule_activities",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_communication_attachments_pm_communications_Communicatio~",
                table: "pm_communication_attachments",
                column: "CommunicationId",
                principalTable: "pm_communications",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_communication_attachments_pm_documents_DocumentId",
                table: "pm_communication_attachments",
                column: "DocumentId",
                principalTable: "pm_documents",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_communications_projects_ProjectId",
                table: "pm_communications",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_cost_code_progress_CostCodes_CostCodeId",
                table: "pm_cost_code_progress",
                column: "CostCodeId",
                principalTable: "CostCodes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_cost_code_progress_pm_progress_entries_ProgressEntryId",
                table: "pm_cost_code_progress",
                column: "ProgressEntryId",
                principalTable: "pm_progress_entries",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_cost_code_progress_project_phases_PhaseId",
                table: "pm_cost_code_progress",
                column: "PhaseId",
                principalTable: "project_phases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_daily_report_crews_pm_daily_reports_DailyReportId",
                table: "pm_daily_report_crews",
                column: "DailyReportId",
                principalTable: "pm_daily_reports",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_daily_report_deliveries_CostCodes_RelatedCostCodeId",
                table: "pm_daily_report_deliveries",
                column: "RelatedCostCodeId",
                principalTable: "CostCodes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_daily_report_deliveries_pm_daily_reports_DailyReportId",
                table: "pm_daily_report_deliveries",
                column: "DailyReportId",
                principalTable: "pm_daily_reports",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_daily_report_equipment_equipment_EquipmentId",
                table: "pm_daily_report_equipment",
                column: "EquipmentId",
                principalTable: "equipment",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_daily_report_equipment_pm_daily_reports_DailyReportId",
                table: "pm_daily_report_equipment",
                column: "DailyReportId",
                principalTable: "pm_daily_reports",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_daily_report_photos_pm_daily_reports_DailyReportId",
                table: "pm_daily_report_photos",
                column: "DailyReportId",
                principalTable: "pm_daily_reports",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_daily_report_photos_pm_documents_DocumentId",
                table: "pm_daily_report_photos",
                column: "DocumentId",
                principalTable: "pm_documents",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_daily_report_photos_users_TakenByUserId",
                table: "pm_daily_report_photos",
                column: "TakenByUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_daily_report_rollups_pm_daily_reports_ChildDailyReportId",
                table: "pm_daily_report_rollups",
                column: "ChildDailyReportId",
                principalTable: "pm_daily_reports",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_daily_report_rollups_pm_daily_reports_ParentDailyReportId",
                table: "pm_daily_report_rollups",
                column: "ParentDailyReportId",
                principalTable: "pm_daily_reports",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_daily_report_safety_incidents_pm_daily_reports_DailyRepo~",
                table: "pm_daily_report_safety_incidents",
                column: "DailyReportId",
                principalTable: "pm_daily_reports",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_daily_report_visitors_pm_daily_reports_DailyReportId",
                table: "pm_daily_report_visitors",
                column: "DailyReportId",
                principalTable: "pm_daily_reports",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_daily_reports_projects_ProjectId",
                table: "pm_daily_reports",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_daily_reports_users_PreparedByUserId",
                table: "pm_daily_reports",
                column: "PreparedByUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_document_distributions_projects_ProjectId",
                table: "pm_document_distributions",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_document_distributions_users_RecipientUserId",
                table: "pm_document_distributions",
                column: "RecipientUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_document_folders_pm_document_folders_ParentFolderId",
                table: "pm_document_folders",
                column: "ParentFolderId",
                principalTable: "pm_document_folders",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_document_folders_projects_ProjectId",
                table: "pm_document_folders",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_document_versions_pm_documents_DocumentId",
                table: "pm_document_versions",
                column: "DocumentId",
                principalTable: "pm_documents",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_document_versions_users_UploadedByUserId",
                table: "pm_document_versions",
                column: "UploadedByUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_documents_projects_ProjectId",
                table: "pm_documents",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_documents_users_UploadedByUserId",
                table: "pm_documents",
                column: "UploadedByUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_earned_value_snapshots_projects_ProjectId",
                table: "pm_earned_value_snapshots",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_generated_documents_pm_document_templates_TemplateId",
                table: "pm_generated_documents",
                column: "TemplateId",
                principalTable: "pm_document_templates",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_generated_documents_pm_documents_DocumentId",
                table: "pm_generated_documents",
                column: "DocumentId",
                principalTable: "pm_documents",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_generated_documents_pm_letterhead_configs_LetterheadConf~",
                table: "pm_generated_documents",
                column: "LetterheadConfigId",
                principalTable: "pm_letterhead_configs",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_generated_documents_projects_ProjectId",
                table: "pm_generated_documents",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_generated_documents_users_GeneratedByUserId",
                table: "pm_generated_documents",
                column: "GeneratedByUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_job_cost_actuals_CostCodes_CostCodeId",
                table: "pm_job_cost_actuals",
                column: "CostCodeId",
                principalTable: "CostCodes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_job_cost_actuals_project_phases_PhaseId",
                table: "pm_job_cost_actuals",
                column: "PhaseId",
                principalTable: "project_phases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_job_cost_actuals_projects_ProjectId",
                table: "pm_job_cost_actuals",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_job_cost_budgets_CostCodes_CostCodeId",
                table: "pm_job_cost_budgets",
                column: "CostCodeId",
                principalTable: "CostCodes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_job_cost_budgets_project_phases_PhaseId",
                table: "pm_job_cost_budgets",
                column: "PhaseId",
                principalTable: "project_phases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_job_cost_budgets_projects_ProjectId",
                table: "pm_job_cost_budgets",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_job_cost_commitments_CostCodes_CostCodeId",
                table: "pm_job_cost_commitments",
                column: "CostCodeId",
                principalTable: "CostCodes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_job_cost_commitments_project_phases_PhaseId",
                table: "pm_job_cost_commitments",
                column: "PhaseId",
                principalTable: "project_phases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_job_cost_commitments_projects_ProjectId",
                table: "pm_job_cost_commitments",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_job_cost_forecasts_CostCodes_CostCodeId",
                table: "pm_job_cost_forecasts",
                column: "CostCodeId",
                principalTable: "CostCodes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_job_cost_forecasts_project_phases_PhaseId",
                table: "pm_job_cost_forecasts",
                column: "PhaseId",
                principalTable: "project_phases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_job_cost_forecasts_projects_ProjectId",
                table: "pm_job_cost_forecasts",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_job_cost_unit_progress_CostCodes_CostCodeId",
                table: "pm_job_cost_unit_progress",
                column: "CostCodeId",
                principalTable: "CostCodes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_job_cost_unit_progress_project_phases_PhaseId",
                table: "pm_job_cost_unit_progress",
                column: "PhaseId",
                principalTable: "project_phases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_job_cost_unit_progress_projects_ProjectId",
                table: "pm_job_cost_unit_progress",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_letterhead_configs_pm_documents_LogoDocumentId",
                table: "pm_letterhead_configs",
                column: "LogoDocumentId",
                principalTable: "pm_documents",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_meeting_action_items_pm_meetings_MeetingId",
                table: "pm_meeting_action_items",
                column: "MeetingId",
                principalTable: "pm_meetings",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_meeting_action_items_users_AssigneeUserId",
                table: "pm_meeting_action_items",
                column: "AssigneeUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_meeting_agenda_items_pm_meetings_MeetingId",
                table: "pm_meeting_agenda_items",
                column: "MeetingId",
                principalTable: "pm_meetings",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_meeting_agenda_items_users_PresenterUserId",
                table: "pm_meeting_agenda_items",
                column: "PresenterUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_meeting_attachments_pm_documents_DocumentId",
                table: "pm_meeting_attachments",
                column: "DocumentId",
                principalTable: "pm_documents",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_meeting_attachments_pm_meetings_MeetingId",
                table: "pm_meeting_attachments",
                column: "MeetingId",
                principalTable: "pm_meetings",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_meeting_minutes_pm_meetings_MeetingId",
                table: "pm_meeting_minutes",
                column: "MeetingId",
                principalTable: "pm_meetings",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_meeting_minutes_users_RecordedByUserId",
                table: "pm_meeting_minutes",
                column: "RecordedByUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_meeting_series_projects_ProjectId",
                table: "pm_meeting_series",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_meetings_pm_document_templates_AgendaTemplateId",
                table: "pm_meetings",
                column: "AgendaTemplateId",
                principalTable: "pm_document_templates",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_meetings_pm_meeting_series_MeetingSeriesId",
                table: "pm_meetings",
                column: "MeetingSeriesId",
                principalTable: "pm_meeting_series",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_meetings_projects_ProjectId",
                table: "pm_meetings",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_monthly_projections_projects_ProjectId",
                table: "pm_monthly_projections",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_monthly_projections_users_PreparedByUserId",
                table: "pm_monthly_projections",
                column: "PreparedByUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_monthly_projections_users_ReviewedByUserId",
                table: "pm_monthly_projections",
                column: "ReviewedByUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_plan_sets_projects_ProjectId",
                table: "pm_plan_sets",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_plan_sheet_revisions_pm_documents_DocumentId",
                table: "pm_plan_sheet_revisions",
                column: "DocumentId",
                principalTable: "pm_documents",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_plan_sheet_revisions_pm_plan_sheets_PlanSheetId",
                table: "pm_plan_sheet_revisions",
                column: "PlanSheetId",
                principalTable: "pm_plan_sheets",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_plan_sheet_revisions_users_IssuedByUserId",
                table: "pm_plan_sheet_revisions",
                column: "IssuedByUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_plan_sheets_pm_documents_DocumentId",
                table: "pm_plan_sheets",
                column: "DocumentId",
                principalTable: "pm_documents",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_plan_sheets_pm_plan_sets_PlanSetId",
                table: "pm_plan_sheets",
                column: "PlanSetId",
                principalTable: "pm_plan_sets",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_plan_sheets_projects_ProjectId",
                table: "pm_plan_sheets",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_progress_entries_projects_ProjectId",
                table: "pm_progress_entries",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_progress_entries_users_EnteredByUserId",
                table: "pm_progress_entries",
                column: "EnteredByUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_progress_time_entry_links_pm_progress_entries_ProgressEn~",
                table: "pm_progress_time_entry_links",
                column: "ProgressEntryId",
                principalTable: "pm_progress_entries",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_progress_time_entry_links_time_entries_TimeEntryId",
                table: "pm_progress_time_entry_links",
                column: "TimeEntryId",
                principalTable: "time_entries",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_project_narrative_revisions_pm_project_narratives_Narrat~",
                table: "pm_project_narrative_revisions",
                column: "NarrativeId",
                principalTable: "pm_project_narratives",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_project_narrative_revisions_users_RevisedByUserId",
                table: "pm_project_narrative_revisions",
                column: "RevisedByUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_project_narratives_pm_document_templates_TemplateId",
                table: "pm_project_narratives",
                column: "TemplateId",
                principalTable: "pm_document_templates",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_project_narratives_projects_ProjectId",
                table: "pm_project_narratives",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_project_narratives_users_PreparedByUserId",
                table: "pm_project_narratives",
                column: "PreparedByUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_projection_cost_codes_CostCodes_CostCodeId",
                table: "pm_projection_cost_codes",
                column: "CostCodeId",
                principalTable: "CostCodes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_projection_cost_codes_pm_monthly_projections_MonthlyProj~",
                table: "pm_projection_cost_codes",
                column: "MonthlyProjectionId",
                principalTable: "pm_monthly_projections",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_projection_cost_codes_project_phases_PhaseId",
                table: "pm_projection_cost_codes",
                column: "PhaseId",
                principalTable: "project_phases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_rfi_attachments_pm_documents_DocumentId",
                table: "pm_rfi_attachments",
                column: "DocumentId",
                principalTable: "pm_documents",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_rfi_attachments_rfis_RfiId",
                table: "pm_rfi_attachments",
                column: "RfiId",
                principalTable: "rfis",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_rfi_cost_impact_links_CostCodes_CostCodeId",
                table: "pm_rfi_cost_impact_links",
                column: "CostCodeId",
                principalTable: "CostCodes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_rfi_cost_impact_links_change_orders_ChangeOrderId",
                table: "pm_rfi_cost_impact_links",
                column: "ChangeOrderId",
                principalTable: "change_orders",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_rfi_cost_impact_links_rfis_RfiId",
                table: "pm_rfi_cost_impact_links",
                column: "RfiId",
                principalTable: "rfis",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_rfi_distribution_recipients_rfis_RfiId",
                table: "pm_rfi_distribution_recipients",
                column: "RfiId",
                principalTable: "rfis",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_rfi_distribution_recipients_users_RecipientUserId",
                table: "pm_rfi_distribution_recipients",
                column: "RecipientUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_s_curve_points_projects_ProjectId",
                table: "pm_s_curve_points",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_schedule_activities_CostCodes_CostCodeId",
                table: "pm_schedule_activities",
                column: "CostCodeId",
                principalTable: "CostCodes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_schedule_activities_pm_schedule_activities_ParentActivit~",
                table: "pm_schedule_activities",
                column: "ParentActivityId",
                principalTable: "pm_schedule_activities",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_schedule_activities_pm_schedules_ScheduleId",
                table: "pm_schedule_activities",
                column: "ScheduleId",
                principalTable: "pm_schedules",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_schedule_activities_project_phases_PhaseId",
                table: "pm_schedule_activities",
                column: "PhaseId",
                principalTable: "project_phases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_schedule_activities_projects_ProjectId",
                table: "pm_schedule_activities",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_schedule_baseline_activities_pm_schedule_activities_Acti~",
                table: "pm_schedule_baseline_activities",
                column: "ActivityId",
                principalTable: "pm_schedule_activities",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_schedule_baseline_activities_pm_schedule_baselines_Basel~",
                table: "pm_schedule_baseline_activities",
                column: "BaselineId",
                principalTable: "pm_schedule_baselines",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_schedule_baselines_pm_schedules_ScheduleId",
                table: "pm_schedule_baselines",
                column: "ScheduleId",
                principalTable: "pm_schedules",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_schedule_baselines_projects_ProjectId",
                table: "pm_schedule_baselines",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_schedule_baselines_users_CapturedByUserId",
                table: "pm_schedule_baselines",
                column: "CapturedByUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_schedule_calendar_exceptions_pm_schedules_ScheduleId",
                table: "pm_schedule_calendar_exceptions",
                column: "ScheduleId",
                principalTable: "pm_schedules",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_schedule_dependencies_pm_schedule_activities_Predecessor~",
                table: "pm_schedule_dependencies",
                column: "PredecessorActivityId",
                principalTable: "pm_schedule_activities",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_schedule_dependencies_pm_schedule_activities_SuccessorAc~",
                table: "pm_schedule_dependencies",
                column: "SuccessorActivityId",
                principalTable: "pm_schedule_activities",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_schedule_dependencies_pm_schedules_ScheduleId",
                table: "pm_schedule_dependencies",
                column: "ScheduleId",
                principalTable: "pm_schedules",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_schedule_import_logs_pm_schedules_ScheduleId",
                table: "pm_schedule_import_logs",
                column: "ScheduleId",
                principalTable: "pm_schedules",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_schedule_import_logs_projects_ProjectId",
                table: "pm_schedule_import_logs",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_schedule_import_logs_users_ImportedByUserId",
                table: "pm_schedule_import_logs",
                column: "ImportedByUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_schedule_resource_assignments_employees_EmployeeId",
                table: "pm_schedule_resource_assignments",
                column: "EmployeeId",
                principalTable: "employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_schedule_resource_assignments_equipment_EquipmentId",
                table: "pm_schedule_resource_assignments",
                column: "EquipmentId",
                principalTable: "equipment",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_schedule_resource_assignments_pm_schedule_activities_Act~",
                table: "pm_schedule_resource_assignments",
                column: "ActivityId",
                principalTable: "pm_schedule_activities",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_schedule_resource_assignments_subcontracts_SubcontractId",
                table: "pm_schedule_resource_assignments",
                column: "SubcontractId",
                principalTable: "subcontracts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_schedules_projects_ProjectId",
                table: "pm_schedules",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_spec_section_revisions_pm_documents_DocumentId",
                table: "pm_spec_section_revisions",
                column: "DocumentId",
                principalTable: "pm_documents",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_spec_section_revisions_pm_spec_sections_SpecSectionId",
                table: "pm_spec_section_revisions",
                column: "SpecSectionId",
                principalTable: "pm_spec_sections",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_spec_sections_pm_documents_DocumentId",
                table: "pm_spec_sections",
                column: "DocumentId",
                principalTable: "pm_documents",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_spec_sections_projects_ProjectId",
                table: "pm_spec_sections",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_submittal_attachments_pm_documents_DocumentId",
                table: "pm_submittal_attachments",
                column: "DocumentId",
                principalTable: "pm_documents",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_submittal_attachments_pm_submittals_SubmittalId",
                table: "pm_submittal_attachments",
                column: "SubmittalId",
                principalTable: "pm_submittals",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_submittal_workflow_events_pm_submittals_SubmittalId",
                table: "pm_submittal_workflow_events",
                column: "SubmittalId",
                principalTable: "pm_submittals",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_submittal_workflow_events_users_ActionByUserId",
                table: "pm_submittal_workflow_events",
                column: "ActionByUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_submittals_pm_schedule_activities_ScheduleActivityId",
                table: "pm_submittals",
                column: "ScheduleActivityId",
                principalTable: "pm_schedule_activities",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_submittals_projects_ProjectId",
                table: "pm_submittals",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_task_comments_pm_tasks_TaskId",
                table: "pm_task_comments",
                column: "TaskId",
                principalTable: "pm_tasks",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_task_comments_users_CommentedByUserId",
                table: "pm_task_comments",
                column: "CommentedByUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_tasks_projects_ProjectId",
                table: "pm_tasks",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_tasks_users_AssignedByUserId",
                table: "pm_tasks",
                column: "AssignedByUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_pm_tasks_users_AssignedToUserId",
                table: "pm_tasks",
                column: "AssignedToUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_pm_activity_progress_pm_progress_entries_ProgressEntryId",
                table: "pm_activity_progress");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_activity_progress_pm_schedule_activities_ScheduleActivit~",
                table: "pm_activity_progress");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_communication_attachments_pm_communications_Communicatio~",
                table: "pm_communication_attachments");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_communication_attachments_pm_documents_DocumentId",
                table: "pm_communication_attachments");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_communications_projects_ProjectId",
                table: "pm_communications");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_cost_code_progress_CostCodes_CostCodeId",
                table: "pm_cost_code_progress");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_cost_code_progress_pm_progress_entries_ProgressEntryId",
                table: "pm_cost_code_progress");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_cost_code_progress_project_phases_PhaseId",
                table: "pm_cost_code_progress");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_daily_report_crews_pm_daily_reports_DailyReportId",
                table: "pm_daily_report_crews");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_daily_report_deliveries_CostCodes_RelatedCostCodeId",
                table: "pm_daily_report_deliveries");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_daily_report_deliveries_pm_daily_reports_DailyReportId",
                table: "pm_daily_report_deliveries");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_daily_report_equipment_equipment_EquipmentId",
                table: "pm_daily_report_equipment");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_daily_report_equipment_pm_daily_reports_DailyReportId",
                table: "pm_daily_report_equipment");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_daily_report_photos_pm_daily_reports_DailyReportId",
                table: "pm_daily_report_photos");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_daily_report_photos_pm_documents_DocumentId",
                table: "pm_daily_report_photos");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_daily_report_photos_users_TakenByUserId",
                table: "pm_daily_report_photos");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_daily_report_rollups_pm_daily_reports_ChildDailyReportId",
                table: "pm_daily_report_rollups");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_daily_report_rollups_pm_daily_reports_ParentDailyReportId",
                table: "pm_daily_report_rollups");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_daily_report_safety_incidents_pm_daily_reports_DailyRepo~",
                table: "pm_daily_report_safety_incidents");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_daily_report_visitors_pm_daily_reports_DailyReportId",
                table: "pm_daily_report_visitors");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_daily_reports_projects_ProjectId",
                table: "pm_daily_reports");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_daily_reports_users_PreparedByUserId",
                table: "pm_daily_reports");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_document_distributions_projects_ProjectId",
                table: "pm_document_distributions");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_document_distributions_users_RecipientUserId",
                table: "pm_document_distributions");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_document_folders_pm_document_folders_ParentFolderId",
                table: "pm_document_folders");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_document_folders_projects_ProjectId",
                table: "pm_document_folders");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_document_versions_pm_documents_DocumentId",
                table: "pm_document_versions");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_document_versions_users_UploadedByUserId",
                table: "pm_document_versions");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_documents_projects_ProjectId",
                table: "pm_documents");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_documents_users_UploadedByUserId",
                table: "pm_documents");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_earned_value_snapshots_projects_ProjectId",
                table: "pm_earned_value_snapshots");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_generated_documents_pm_document_templates_TemplateId",
                table: "pm_generated_documents");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_generated_documents_pm_documents_DocumentId",
                table: "pm_generated_documents");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_generated_documents_pm_letterhead_configs_LetterheadConf~",
                table: "pm_generated_documents");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_generated_documents_projects_ProjectId",
                table: "pm_generated_documents");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_generated_documents_users_GeneratedByUserId",
                table: "pm_generated_documents");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_job_cost_actuals_CostCodes_CostCodeId",
                table: "pm_job_cost_actuals");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_job_cost_actuals_project_phases_PhaseId",
                table: "pm_job_cost_actuals");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_job_cost_actuals_projects_ProjectId",
                table: "pm_job_cost_actuals");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_job_cost_budgets_CostCodes_CostCodeId",
                table: "pm_job_cost_budgets");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_job_cost_budgets_project_phases_PhaseId",
                table: "pm_job_cost_budgets");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_job_cost_budgets_projects_ProjectId",
                table: "pm_job_cost_budgets");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_job_cost_commitments_CostCodes_CostCodeId",
                table: "pm_job_cost_commitments");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_job_cost_commitments_project_phases_PhaseId",
                table: "pm_job_cost_commitments");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_job_cost_commitments_projects_ProjectId",
                table: "pm_job_cost_commitments");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_job_cost_forecasts_CostCodes_CostCodeId",
                table: "pm_job_cost_forecasts");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_job_cost_forecasts_project_phases_PhaseId",
                table: "pm_job_cost_forecasts");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_job_cost_forecasts_projects_ProjectId",
                table: "pm_job_cost_forecasts");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_job_cost_unit_progress_CostCodes_CostCodeId",
                table: "pm_job_cost_unit_progress");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_job_cost_unit_progress_project_phases_PhaseId",
                table: "pm_job_cost_unit_progress");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_job_cost_unit_progress_projects_ProjectId",
                table: "pm_job_cost_unit_progress");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_letterhead_configs_pm_documents_LogoDocumentId",
                table: "pm_letterhead_configs");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_meeting_action_items_pm_meetings_MeetingId",
                table: "pm_meeting_action_items");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_meeting_action_items_users_AssigneeUserId",
                table: "pm_meeting_action_items");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_meeting_agenda_items_pm_meetings_MeetingId",
                table: "pm_meeting_agenda_items");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_meeting_agenda_items_users_PresenterUserId",
                table: "pm_meeting_agenda_items");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_meeting_attachments_pm_documents_DocumentId",
                table: "pm_meeting_attachments");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_meeting_attachments_pm_meetings_MeetingId",
                table: "pm_meeting_attachments");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_meeting_minutes_pm_meetings_MeetingId",
                table: "pm_meeting_minutes");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_meeting_minutes_users_RecordedByUserId",
                table: "pm_meeting_minutes");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_meeting_series_projects_ProjectId",
                table: "pm_meeting_series");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_meetings_pm_document_templates_AgendaTemplateId",
                table: "pm_meetings");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_meetings_pm_meeting_series_MeetingSeriesId",
                table: "pm_meetings");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_meetings_projects_ProjectId",
                table: "pm_meetings");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_monthly_projections_projects_ProjectId",
                table: "pm_monthly_projections");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_monthly_projections_users_PreparedByUserId",
                table: "pm_monthly_projections");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_monthly_projections_users_ReviewedByUserId",
                table: "pm_monthly_projections");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_plan_sets_projects_ProjectId",
                table: "pm_plan_sets");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_plan_sheet_revisions_pm_documents_DocumentId",
                table: "pm_plan_sheet_revisions");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_plan_sheet_revisions_pm_plan_sheets_PlanSheetId",
                table: "pm_plan_sheet_revisions");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_plan_sheet_revisions_users_IssuedByUserId",
                table: "pm_plan_sheet_revisions");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_plan_sheets_pm_documents_DocumentId",
                table: "pm_plan_sheets");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_plan_sheets_pm_plan_sets_PlanSetId",
                table: "pm_plan_sheets");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_plan_sheets_projects_ProjectId",
                table: "pm_plan_sheets");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_progress_entries_projects_ProjectId",
                table: "pm_progress_entries");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_progress_entries_users_EnteredByUserId",
                table: "pm_progress_entries");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_progress_time_entry_links_pm_progress_entries_ProgressEn~",
                table: "pm_progress_time_entry_links");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_progress_time_entry_links_time_entries_TimeEntryId",
                table: "pm_progress_time_entry_links");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_project_narrative_revisions_pm_project_narratives_Narrat~",
                table: "pm_project_narrative_revisions");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_project_narrative_revisions_users_RevisedByUserId",
                table: "pm_project_narrative_revisions");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_project_narratives_pm_document_templates_TemplateId",
                table: "pm_project_narratives");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_project_narratives_projects_ProjectId",
                table: "pm_project_narratives");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_project_narratives_users_PreparedByUserId",
                table: "pm_project_narratives");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_projection_cost_codes_CostCodes_CostCodeId",
                table: "pm_projection_cost_codes");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_projection_cost_codes_pm_monthly_projections_MonthlyProj~",
                table: "pm_projection_cost_codes");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_projection_cost_codes_project_phases_PhaseId",
                table: "pm_projection_cost_codes");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_rfi_attachments_pm_documents_DocumentId",
                table: "pm_rfi_attachments");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_rfi_attachments_rfis_RfiId",
                table: "pm_rfi_attachments");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_rfi_cost_impact_links_CostCodes_CostCodeId",
                table: "pm_rfi_cost_impact_links");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_rfi_cost_impact_links_change_orders_ChangeOrderId",
                table: "pm_rfi_cost_impact_links");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_rfi_cost_impact_links_rfis_RfiId",
                table: "pm_rfi_cost_impact_links");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_rfi_distribution_recipients_rfis_RfiId",
                table: "pm_rfi_distribution_recipients");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_rfi_distribution_recipients_users_RecipientUserId",
                table: "pm_rfi_distribution_recipients");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_s_curve_points_projects_ProjectId",
                table: "pm_s_curve_points");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_schedule_activities_CostCodes_CostCodeId",
                table: "pm_schedule_activities");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_schedule_activities_pm_schedule_activities_ParentActivit~",
                table: "pm_schedule_activities");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_schedule_activities_pm_schedules_ScheduleId",
                table: "pm_schedule_activities");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_schedule_activities_project_phases_PhaseId",
                table: "pm_schedule_activities");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_schedule_activities_projects_ProjectId",
                table: "pm_schedule_activities");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_schedule_baseline_activities_pm_schedule_activities_Acti~",
                table: "pm_schedule_baseline_activities");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_schedule_baseline_activities_pm_schedule_baselines_Basel~",
                table: "pm_schedule_baseline_activities");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_schedule_baselines_pm_schedules_ScheduleId",
                table: "pm_schedule_baselines");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_schedule_baselines_projects_ProjectId",
                table: "pm_schedule_baselines");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_schedule_baselines_users_CapturedByUserId",
                table: "pm_schedule_baselines");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_schedule_calendar_exceptions_pm_schedules_ScheduleId",
                table: "pm_schedule_calendar_exceptions");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_schedule_dependencies_pm_schedule_activities_Predecessor~",
                table: "pm_schedule_dependencies");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_schedule_dependencies_pm_schedule_activities_SuccessorAc~",
                table: "pm_schedule_dependencies");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_schedule_dependencies_pm_schedules_ScheduleId",
                table: "pm_schedule_dependencies");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_schedule_import_logs_pm_schedules_ScheduleId",
                table: "pm_schedule_import_logs");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_schedule_import_logs_projects_ProjectId",
                table: "pm_schedule_import_logs");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_schedule_import_logs_users_ImportedByUserId",
                table: "pm_schedule_import_logs");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_schedule_resource_assignments_employees_EmployeeId",
                table: "pm_schedule_resource_assignments");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_schedule_resource_assignments_equipment_EquipmentId",
                table: "pm_schedule_resource_assignments");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_schedule_resource_assignments_pm_schedule_activities_Act~",
                table: "pm_schedule_resource_assignments");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_schedule_resource_assignments_subcontracts_SubcontractId",
                table: "pm_schedule_resource_assignments");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_schedules_projects_ProjectId",
                table: "pm_schedules");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_spec_section_revisions_pm_documents_DocumentId",
                table: "pm_spec_section_revisions");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_spec_section_revisions_pm_spec_sections_SpecSectionId",
                table: "pm_spec_section_revisions");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_spec_sections_pm_documents_DocumentId",
                table: "pm_spec_sections");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_spec_sections_projects_ProjectId",
                table: "pm_spec_sections");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_submittal_attachments_pm_documents_DocumentId",
                table: "pm_submittal_attachments");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_submittal_attachments_pm_submittals_SubmittalId",
                table: "pm_submittal_attachments");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_submittal_workflow_events_pm_submittals_SubmittalId",
                table: "pm_submittal_workflow_events");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_submittal_workflow_events_users_ActionByUserId",
                table: "pm_submittal_workflow_events");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_submittals_pm_schedule_activities_ScheduleActivityId",
                table: "pm_submittals");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_submittals_projects_ProjectId",
                table: "pm_submittals");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_task_comments_pm_tasks_TaskId",
                table: "pm_task_comments");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_task_comments_users_CommentedByUserId",
                table: "pm_task_comments");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_tasks_projects_ProjectId",
                table: "pm_tasks");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_tasks_users_AssignedByUserId",
                table: "pm_tasks");

            migrationBuilder.DropForeignKey(
                name: "FK_pm_tasks_users_AssignedToUserId",
                table: "pm_tasks");

            migrationBuilder.DropIndex(
                name: "IX_pm_tasks_AssignedByUserId",
                table: "pm_tasks");

            migrationBuilder.DropIndex(
                name: "IX_pm_task_comments_CommentedByUserId",
                table: "pm_task_comments");

            migrationBuilder.DropIndex(
                name: "IX_pm_submittals_ScheduleActivityId",
                table: "pm_submittals");

            migrationBuilder.DropIndex(
                name: "IX_pm_submittal_workflow_events_ActionByUserId",
                table: "pm_submittal_workflow_events");

            migrationBuilder.DropIndex(
                name: "IX_pm_submittal_attachments_DocumentId",
                table: "pm_submittal_attachments");

            migrationBuilder.DropIndex(
                name: "IX_pm_spec_sections_DocumentId",
                table: "pm_spec_sections");

            migrationBuilder.DropIndex(
                name: "IX_pm_spec_section_revisions_DocumentId",
                table: "pm_spec_section_revisions");

            migrationBuilder.DropIndex(
                name: "IX_pm_schedule_resource_assignments_EmployeeId",
                table: "pm_schedule_resource_assignments");

            migrationBuilder.DropIndex(
                name: "IX_pm_schedule_resource_assignments_EquipmentId",
                table: "pm_schedule_resource_assignments");

            migrationBuilder.DropIndex(
                name: "IX_pm_schedule_resource_assignments_SubcontractId",
                table: "pm_schedule_resource_assignments");

            migrationBuilder.DropIndex(
                name: "IX_pm_schedule_import_logs_ImportedByUserId",
                table: "pm_schedule_import_logs");

            migrationBuilder.DropIndex(
                name: "IX_pm_schedule_import_logs_ScheduleId",
                table: "pm_schedule_import_logs");

            migrationBuilder.DropIndex(
                name: "IX_pm_schedule_dependencies_PredecessorActivityId",
                table: "pm_schedule_dependencies");

            migrationBuilder.DropIndex(
                name: "IX_pm_schedule_dependencies_SuccessorActivityId",
                table: "pm_schedule_dependencies");

            migrationBuilder.DropIndex(
                name: "IX_pm_schedule_baselines_CapturedByUserId",
                table: "pm_schedule_baselines");

            migrationBuilder.DropIndex(
                name: "IX_pm_schedule_baselines_ScheduleId",
                table: "pm_schedule_baselines");

            migrationBuilder.DropIndex(
                name: "IX_pm_schedule_baseline_activities_ActivityId",
                table: "pm_schedule_baseline_activities");

            migrationBuilder.DropIndex(
                name: "IX_pm_schedule_activities_CostCodeId",
                table: "pm_schedule_activities");

            migrationBuilder.DropIndex(
                name: "IX_pm_schedule_activities_ParentActivityId",
                table: "pm_schedule_activities");

            migrationBuilder.DropIndex(
                name: "IX_pm_schedule_activities_PhaseId",
                table: "pm_schedule_activities");

            migrationBuilder.DropIndex(
                name: "IX_pm_schedule_activities_ProjectId",
                table: "pm_schedule_activities");

            migrationBuilder.DropIndex(
                name: "IX_pm_rfi_distribution_recipients_RecipientUserId",
                table: "pm_rfi_distribution_recipients");

            migrationBuilder.DropIndex(
                name: "IX_pm_rfi_cost_impact_links_ChangeOrderId",
                table: "pm_rfi_cost_impact_links");

            migrationBuilder.DropIndex(
                name: "IX_pm_rfi_cost_impact_links_CostCodeId",
                table: "pm_rfi_cost_impact_links");

            migrationBuilder.DropIndex(
                name: "IX_pm_rfi_attachments_DocumentId",
                table: "pm_rfi_attachments");

            migrationBuilder.DropIndex(
                name: "IX_pm_projection_cost_codes_CostCodeId",
                table: "pm_projection_cost_codes");

            migrationBuilder.DropIndex(
                name: "IX_pm_projection_cost_codes_PhaseId",
                table: "pm_projection_cost_codes");

            migrationBuilder.DropIndex(
                name: "IX_pm_project_narratives_PreparedByUserId",
                table: "pm_project_narratives");

            migrationBuilder.DropIndex(
                name: "IX_pm_project_narratives_TemplateId",
                table: "pm_project_narratives");

            migrationBuilder.DropIndex(
                name: "IX_pm_project_narrative_revisions_RevisedByUserId",
                table: "pm_project_narrative_revisions");

            migrationBuilder.DropIndex(
                name: "IX_pm_progress_time_entry_links_TimeEntryId",
                table: "pm_progress_time_entry_links");

            migrationBuilder.DropIndex(
                name: "IX_pm_progress_entries_EnteredByUserId",
                table: "pm_progress_entries");

            migrationBuilder.DropIndex(
                name: "IX_pm_plan_sheets_DocumentId",
                table: "pm_plan_sheets");

            migrationBuilder.DropIndex(
                name: "IX_pm_plan_sheets_ProjectId",
                table: "pm_plan_sheets");

            migrationBuilder.DropIndex(
                name: "IX_pm_plan_sheet_revisions_DocumentId",
                table: "pm_plan_sheet_revisions");

            migrationBuilder.DropIndex(
                name: "IX_pm_plan_sheet_revisions_IssuedByUserId",
                table: "pm_plan_sheet_revisions");

            migrationBuilder.DropIndex(
                name: "IX_pm_monthly_projections_PreparedByUserId",
                table: "pm_monthly_projections");

            migrationBuilder.DropIndex(
                name: "IX_pm_monthly_projections_ReviewedByUserId",
                table: "pm_monthly_projections");

            migrationBuilder.DropIndex(
                name: "IX_pm_meetings_AgendaTemplateId",
                table: "pm_meetings");

            migrationBuilder.DropIndex(
                name: "IX_pm_meetings_MeetingSeriesId",
                table: "pm_meetings");

            migrationBuilder.DropIndex(
                name: "IX_pm_meeting_minutes_RecordedByUserId",
                table: "pm_meeting_minutes");

            migrationBuilder.DropIndex(
                name: "IX_pm_meeting_attachments_DocumentId",
                table: "pm_meeting_attachments");

            migrationBuilder.DropIndex(
                name: "IX_pm_meeting_agenda_items_PresenterUserId",
                table: "pm_meeting_agenda_items");

            migrationBuilder.DropIndex(
                name: "IX_pm_meeting_action_items_MeetingId",
                table: "pm_meeting_action_items");

            migrationBuilder.DropIndex(
                name: "IX_pm_letterhead_configs_LogoDocumentId",
                table: "pm_letterhead_configs");

            migrationBuilder.DropIndex(
                name: "IX_pm_job_cost_unit_progress_CostCodeId",
                table: "pm_job_cost_unit_progress");

            migrationBuilder.DropIndex(
                name: "IX_pm_job_cost_unit_progress_PhaseId",
                table: "pm_job_cost_unit_progress");

            migrationBuilder.DropIndex(
                name: "IX_pm_job_cost_forecasts_CostCodeId",
                table: "pm_job_cost_forecasts");

            migrationBuilder.DropIndex(
                name: "IX_pm_job_cost_forecasts_PhaseId",
                table: "pm_job_cost_forecasts");

            migrationBuilder.DropIndex(
                name: "IX_pm_job_cost_commitments_CostCodeId",
                table: "pm_job_cost_commitments");

            migrationBuilder.DropIndex(
                name: "IX_pm_job_cost_commitments_PhaseId",
                table: "pm_job_cost_commitments");

            migrationBuilder.DropIndex(
                name: "IX_pm_job_cost_budgets_CostCodeId",
                table: "pm_job_cost_budgets");

            migrationBuilder.DropIndex(
                name: "IX_pm_job_cost_budgets_PhaseId",
                table: "pm_job_cost_budgets");

            migrationBuilder.DropIndex(
                name: "IX_pm_job_cost_actuals_CostCodeId",
                table: "pm_job_cost_actuals");

            migrationBuilder.DropIndex(
                name: "IX_pm_job_cost_actuals_PhaseId",
                table: "pm_job_cost_actuals");

            migrationBuilder.DropIndex(
                name: "IX_pm_generated_documents_DocumentId",
                table: "pm_generated_documents");

            migrationBuilder.DropIndex(
                name: "IX_pm_generated_documents_GeneratedByUserId",
                table: "pm_generated_documents");

            migrationBuilder.DropIndex(
                name: "IX_pm_generated_documents_LetterheadConfigId",
                table: "pm_generated_documents");

            migrationBuilder.DropIndex(
                name: "IX_pm_generated_documents_TemplateId",
                table: "pm_generated_documents");

            migrationBuilder.DropIndex(
                name: "IX_pm_documents_UploadedByUserId",
                table: "pm_documents");

            migrationBuilder.DropIndex(
                name: "IX_pm_document_versions_UploadedByUserId",
                table: "pm_document_versions");

            migrationBuilder.DropIndex(
                name: "IX_pm_document_folders_ParentFolderId",
                table: "pm_document_folders");

            migrationBuilder.DropIndex(
                name: "IX_pm_document_distributions_RecipientUserId",
                table: "pm_document_distributions");

            migrationBuilder.DropIndex(
                name: "IX_pm_daily_reports_PreparedByUserId",
                table: "pm_daily_reports");

            migrationBuilder.DropIndex(
                name: "IX_pm_daily_report_visitors_DailyReportId",
                table: "pm_daily_report_visitors");

            migrationBuilder.DropIndex(
                name: "IX_pm_daily_report_safety_incidents_DailyReportId",
                table: "pm_daily_report_safety_incidents");

            migrationBuilder.DropIndex(
                name: "IX_pm_daily_report_rollups_ChildDailyReportId",
                table: "pm_daily_report_rollups");

            migrationBuilder.DropIndex(
                name: "IX_pm_daily_report_photos_DocumentId",
                table: "pm_daily_report_photos");

            migrationBuilder.DropIndex(
                name: "IX_pm_daily_report_photos_TakenByUserId",
                table: "pm_daily_report_photos");

            migrationBuilder.DropIndex(
                name: "IX_pm_daily_report_equipment_DailyReportId",
                table: "pm_daily_report_equipment");

            migrationBuilder.DropIndex(
                name: "IX_pm_daily_report_equipment_EquipmentId",
                table: "pm_daily_report_equipment");

            migrationBuilder.DropIndex(
                name: "IX_pm_daily_report_deliveries_DailyReportId",
                table: "pm_daily_report_deliveries");

            migrationBuilder.DropIndex(
                name: "IX_pm_daily_report_deliveries_RelatedCostCodeId",
                table: "pm_daily_report_deliveries");

            migrationBuilder.DropIndex(
                name: "IX_pm_daily_report_crews_DailyReportId",
                table: "pm_daily_report_crews");

            migrationBuilder.DropIndex(
                name: "IX_pm_cost_code_progress_CostCodeId",
                table: "pm_cost_code_progress");

            migrationBuilder.DropIndex(
                name: "IX_pm_cost_code_progress_PhaseId",
                table: "pm_cost_code_progress");

            migrationBuilder.DropIndex(
                name: "IX_pm_communication_attachments_DocumentId",
                table: "pm_communication_attachments");

            migrationBuilder.DropIndex(
                name: "IX_pm_activity_progress_ScheduleActivityId",
                table: "pm_activity_progress");
        }
    }
}
