using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <summary>
    /// Enables FORCE RLS + tenant isolation policies on Project Management (pm_*) tables.
    /// These tables previously relied only on EF global query filters.
    /// </summary>
    public partial class AddPmTablesTenantRls : Migration
    {
        // All BaseEntity-backed pm_* tables from the model snapshot.
        private static readonly string[] PmTables =
        [
            "pm_activity_progress",
            "pm_communication_attachments",
            "pm_communications",
            "pm_cost_code_activity_mappings",
            "pm_cost_code_ev_snapshots",
            "pm_cost_code_progress",
            "pm_daily_report_crews",
            "pm_daily_report_deliveries",
            "pm_daily_report_equipment",
            "pm_daily_report_photos",
            "pm_daily_report_rollups",
            "pm_daily_report_safety_incidents",
            "pm_daily_report_visitors",
            "pm_daily_reports",
            "pm_document_distributions",
            "pm_document_folders",
            "pm_document_templates",
            "pm_document_versions",
            "pm_documents",
            "pm_earned_value_snapshots",
            "pm_field_progress_entries",
            "pm_generated_documents",
            "pm_job_cost_actuals",
            "pm_job_cost_budgets",
            "pm_job_cost_commitments",
            "pm_job_cost_forecasts",
            "pm_job_cost_unit_progress",
            "pm_letterhead_configs",
            "pm_meeting_action_items",
            "pm_meeting_agenda_items",
            "pm_meeting_attachments",
            "pm_meeting_minutes",
            "pm_meeting_series",
            "pm_meetings",
            "pm_model_assets",
            "pm_monthly_projections",
            "pm_plan_sets",
            "pm_plan_sheet_revisions",
            "pm_plan_sheets",
            "pm_progress_entries",
            "pm_progress_time_entry_links",
            "pm_project_narrative_revisions",
            "pm_project_narratives",
            "pm_projection_cost_codes",
            "pm_punch_list_items",
            "pm_punch_list_photos",
            "pm_rfi_attachments",
            "pm_rfi_cost_impact_links",
            "pm_rfi_distribution_recipients",
            "pm_s_curve_points",
            "pm_schedule_activities",
            "pm_schedule_baseline_activities",
            "pm_schedule_baselines",
            "pm_schedule_calendar_exceptions",
            "pm_schedule_dependencies",
            "pm_schedule_import_logs",
            "pm_schedule_resource_assignments",
            "pm_schedules",
            "pm_spatial_graphs",
            "pm_spatial_nodes",
            "pm_spatial_plan_links",
            "pm_spec_section_revisions",
            "pm_spec_sections",
            "pm_submittal_attachments",
            "pm_submittal_workflow_events",
            "pm_submittals",
            "pm_task_comments",
            "pm_tasks",
        ];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            foreach (var table in PmTables)
            {
                // Idempotent: safe if a prior partial deploy left policies behind.
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_select ON ""{table}"";");
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_insert ON ""{table}"";");
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_update ON ""{table}"";");
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_delete ON ""{table}"";");

                migrationBuilder.Sql($@"ALTER TABLE ""{table}"" ENABLE ROW LEVEL SECURITY;");
                migrationBuilder.Sql($@"ALTER TABLE ""{table}"" FORCE ROW LEVEL SECURITY;");

                migrationBuilder.Sql($@"
                    CREATE POLICY {table}_tenant_isolation_select ON ""{table}""
                    FOR SELECT
                    USING (""TenantId""::text = current_setting('app.current_tenant', true));
                ");
                migrationBuilder.Sql($@"
                    CREATE POLICY {table}_tenant_isolation_insert ON ""{table}""
                    FOR INSERT
                    WITH CHECK (""TenantId""::text = current_setting('app.current_tenant', true));
                ");
                migrationBuilder.Sql($@"
                    CREATE POLICY {table}_tenant_isolation_update ON ""{table}""
                    FOR UPDATE
                    USING (""TenantId""::text = current_setting('app.current_tenant', true))
                    WITH CHECK (""TenantId""::text = current_setting('app.current_tenant', true));
                ");
                migrationBuilder.Sql($@"
                    CREATE POLICY {table}_tenant_isolation_delete ON ""{table}""
                    FOR DELETE
                    USING (""TenantId""::text = current_setting('app.current_tenant', true));
                ");
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var table in PmTables)
            {
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_select ON ""{table}"";");
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_insert ON ""{table}"";");
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_update ON ""{table}"";");
                migrationBuilder.Sql($@"DROP POLICY IF EXISTS {table}_tenant_isolation_delete ON ""{table}"";");
                migrationBuilder.Sql($@"ALTER TABLE ""{table}"" DISABLE ROW LEVEL SECURITY;");
            }
        }
    }
}
