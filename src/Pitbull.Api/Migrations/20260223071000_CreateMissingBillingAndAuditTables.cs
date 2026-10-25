using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <summary>
    /// Creates tables that were added to the DbContext/ModelSnapshot but never had
    /// a migration generated: owner_contracts, owner_schedules_of_values,
    /// owner_sov_line_items, billing_applications, billing_application_line_items,
    /// billing_periods, billing_package_documents, and audit_logs.
    /// Uses IF NOT EXISTS throughout for production safety.
    /// </summary>
    public partial class CreateMissingBillingAndAuditTables : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── audit_logs ──
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS audit_logs (
                    ""Id"" uuid NOT NULL,
                    ""TenantId"" uuid NOT NULL,
                    ""UserId"" uuid,
                    ""UserEmail"" character varying(200),
                    ""UserName"" character varying(200),
                    ""Action"" character varying(50) NOT NULL,
                    ""ResourceType"" character varying(100) NOT NULL,
                    ""ResourceId"" character varying(100),
                    ""Description"" character varying(1000) NOT NULL,
                    ""Details"" jsonb,
                    ""Changes"" jsonb,
                    ""Metadata"" jsonb,
                    ""IpAddress"" character varying(50),
                    ""UserAgent"" character varying(500),
                    ""Timestamp"" timestamp with time zone NOT NULL,
                    ""Success"" boolean NOT NULL DEFAULT true,
                    ""ErrorMessage"" character varying(2000),
                    CONSTRAINT ""PK_audit_logs"" PRIMARY KEY (""Id"")
                );
                CREATE INDEX IF NOT EXISTS ""IX_audit_logs_TenantId_Timestamp""
                    ON audit_logs (""TenantId"", ""Timestamp"" DESC);
                CREATE INDEX IF NOT EXISTS ""IX_audit_logs_TenantId_ResourceType_ResourceId""
                    ON audit_logs (""TenantId"", ""ResourceType"", ""ResourceId"");
            ");

            // ── owner_contracts ──
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS owner_contracts (
                    ""Id"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
                    ""ProjectId"" uuid NOT NULL,
                    ""ContractNumber"" character varying(100) NOT NULL,
                    ""ProjectName"" character varying(500) NOT NULL,
                    ""OwnerName"" character varying(500),
                    ""OwnerAddress"" character varying(1000),
                    ""ArchitectName"" character varying(500),
                    ""ArchitectProjectNumber"" character varying(100),
                    ""OriginalContractSum"" numeric(18,2) NOT NULL,
                    ""ApprovedChangeOrderAmount"" numeric(18,2) NOT NULL,
                    ""ContractSumToDate"" numeric(18,2) NOT NULL,
                    ""DefaultRetainagePercent"" numeric(5,2) NOT NULL DEFAULT 10,
                    ""RetainagePercentMaterials"" numeric(5,2) NOT NULL DEFAULT 10,
                    ""ContractDate"" date,
                    ""PaymentTermsDays"" integer NOT NULL DEFAULT 30,
                    ""Status"" character varying(20) NOT NULL DEFAULT 'Active',
                    ""Notes"" character varying(2000),
                    ""TenantId"" uuid NOT NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL,
                    ""CreatedBy"" text NOT NULL,
                    ""UpdatedAt"" timestamp with time zone,
                    ""UpdatedBy"" text,
                    ""IsDeleted"" boolean NOT NULL DEFAULT false,
                    ""DeletedAt"" timestamp with time zone,
                    ""DeletedBy"" text,
                    CONSTRAINT ""PK_owner_contracts"" PRIMARY KEY (""Id"")
                );
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_owner_contracts_tenant_company_number""
                    ON owner_contracts (""TenantId"", ""CompanyId"", ""ContractNumber"") WHERE ""IsDeleted"" = false;
                CREATE INDEX IF NOT EXISTS ""IX_owner_contracts_tenant_company_project""
                    ON owner_contracts (""TenantId"", ""CompanyId"", ""ProjectId"");
                CREATE INDEX IF NOT EXISTS ""IX_owner_contracts_TenantId""
                    ON owner_contracts (""TenantId"");
                CREATE INDEX IF NOT EXISTS ""IX_owner_contracts_CompanyId""
                    ON owner_contracts (""CompanyId"");
            ");

            // ── owner_schedules_of_values ──
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS owner_schedules_of_values (
                    ""Id"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
                    ""ProjectId"" uuid NOT NULL,
                    ""OwnerContractId"" uuid NOT NULL,
                    ""Name"" character varying(200) NOT NULL DEFAULT 'Main SOV',
                    ""OriginalContractAmount"" numeric(18,2) NOT NULL,
                    ""ApprovedChangeOrderAmount"" numeric(18,2) NOT NULL,
                    ""RevisedContractAmount"" numeric(18,2) NOT NULL,
                    ""TotalScheduledValue"" numeric(18,2) NOT NULL,
                    ""DefaultRetainagePercent"" numeric(5,2) NOT NULL DEFAULT 10,
                    ""Status"" character varying(20) NOT NULL DEFAULT 'Draft',
                    ""LockedDate"" timestamp with time zone,
                    ""Notes"" character varying(2000),
                    ""TenantId"" uuid NOT NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL,
                    ""CreatedBy"" text NOT NULL,
                    ""UpdatedAt"" timestamp with time zone,
                    ""UpdatedBy"" text,
                    ""IsDeleted"" boolean NOT NULL DEFAULT false,
                    ""DeletedAt"" timestamp with time zone,
                    ""DeletedBy"" text,
                    CONSTRAINT ""PK_owner_schedules_of_values"" PRIMARY KEY (""Id"")
                );
                CREATE INDEX IF NOT EXISTS ""IX_owner_sov_tenant_company_contract""
                    ON owner_schedules_of_values (""TenantId"", ""CompanyId"", ""OwnerContractId"");
                CREATE INDEX IF NOT EXISTS ""IX_owner_sov_tenant_company_project""
                    ON owner_schedules_of_values (""TenantId"", ""CompanyId"", ""ProjectId"");
                CREATE INDEX IF NOT EXISTS ""IX_owner_sov_TenantId""
                    ON owner_schedules_of_values (""TenantId"");
                CREATE INDEX IF NOT EXISTS ""IX_owner_sov_CompanyId""
                    ON owner_schedules_of_values (""CompanyId"");
            ");

            // ── owner_sov_line_items ──
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS owner_sov_line_items (
                    ""Id"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
                    ""OwnerScheduleOfValuesId"" uuid NOT NULL,
                    ""ItemNumber"" character varying(50) NOT NULL,
                    ""Description"" character varying(500) NOT NULL,
                    ""SortOrder"" integer NOT NULL,
                    ""OriginalValue"" numeric(18,2) NOT NULL,
                    ""ApprovedChangeOrderValue"" numeric(18,2) NOT NULL,
                    ""ScheduledValue"" numeric(18,2) NOT NULL,
                    ""RetainagePercent"" numeric(5,2),
                    ""CostCodeId"" uuid,
                    ""PhaseId"" uuid,
                    ""IsFromChangeOrder"" boolean NOT NULL DEFAULT false,
                    ""SourceChangeOrderId"" uuid,
                    ""Notes"" character varying(1000),
                    ""TenantId"" uuid NOT NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL,
                    ""CreatedBy"" text NOT NULL,
                    ""UpdatedAt"" timestamp with time zone,
                    ""UpdatedBy"" text,
                    ""IsDeleted"" boolean NOT NULL DEFAULT false,
                    ""DeletedAt"" timestamp with time zone,
                    ""DeletedBy"" text,
                    CONSTRAINT ""PK_owner_sov_line_items"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_owner_sov_line_items_owner_schedules_of_values""
                        FOREIGN KEY (""OwnerScheduleOfValuesId"")
                        REFERENCES owner_schedules_of_values(""Id"") ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS ""IX_owner_sov_lines_tenant_sov_sort""
                    ON owner_sov_line_items (""TenantId"", ""OwnerScheduleOfValuesId"", ""SortOrder"");
                CREATE INDEX IF NOT EXISTS ""IX_owner_sov_lines_TenantId""
                    ON owner_sov_line_items (""TenantId"");
                CREATE INDEX IF NOT EXISTS ""IX_owner_sov_lines_CompanyId""
                    ON owner_sov_line_items (""CompanyId"");
            ");

            // ── billing_applications ──
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS billing_applications (
                    ""Id"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
                    ""ProjectId"" uuid NOT NULL,
                    ""OwnerContractId"" uuid NOT NULL,
                    ""OwnerScheduleOfValuesId"" uuid NOT NULL,
                    ""ApplicationNumber"" integer NOT NULL,
                    ""PeriodFrom"" date NOT NULL,
                    ""PeriodThrough"" date NOT NULL,
                    ""ApplicationDate"" date NOT NULL,
                    ""OriginalContractSum"" numeric(18,2) NOT NULL,
                    ""NetChangeByChangeOrders"" numeric(18,2) NOT NULL,
                    ""ContractSumToDate"" numeric(18,2) NOT NULL,
                    ""TotalCompletedAndStoredToDate"" numeric(18,2) NOT NULL,
                    ""RetainageOnCompletedWork"" numeric(18,2) NOT NULL,
                    ""RetainageOnStoredMaterials"" numeric(18,2) NOT NULL,
                    ""TotalRetainage"" numeric(18,2) NOT NULL,
                    ""RetainagePercentWork"" numeric(5,2) NOT NULL,
                    ""RetainagePercentMaterials"" numeric(5,2) NOT NULL,
                    ""TotalEarnedLessRetainage"" numeric(18,2) NOT NULL,
                    ""LessPreviousCertificates"" numeric(18,2) NOT NULL,
                    ""CurrentPaymentDue"" numeric(18,2) NOT NULL,
                    ""BalanceToFinishIncludingRetainage"" numeric(18,2) NOT NULL,
                    ""Status"" character varying(30) NOT NULL DEFAULT 'Draft',
                    ""InternalNotes"" character varying(4000),
                    ""BillingNarrative"" character varying(4000),
                    ""TenantId"" uuid NOT NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL,
                    ""CreatedBy"" text NOT NULL,
                    ""UpdatedAt"" timestamp with time zone,
                    ""UpdatedBy"" text,
                    ""IsDeleted"" boolean NOT NULL DEFAULT false,
                    ""DeletedAt"" timestamp with time zone,
                    ""DeletedBy"" text,
                    CONSTRAINT ""PK_billing_applications"" PRIMARY KEY (""Id"")
                );
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_billing_apps_tenant_company_contract_number""
                    ON billing_applications (""TenantId"", ""CompanyId"", ""OwnerContractId"", ""ApplicationNumber"")
                    WHERE ""IsDeleted"" = false;
                CREATE INDEX IF NOT EXISTS ""IX_billing_apps_tenant_company_project""
                    ON billing_applications (""TenantId"", ""CompanyId"", ""ProjectId"");
                CREATE INDEX IF NOT EXISTS ""IX_billing_apps_tenant_company_status""
                    ON billing_applications (""TenantId"", ""CompanyId"", ""Status"");
                CREATE INDEX IF NOT EXISTS ""IX_billing_apps_TenantId""
                    ON billing_applications (""TenantId"");
                CREATE INDEX IF NOT EXISTS ""IX_billing_apps_CompanyId""
                    ON billing_applications (""CompanyId"");
            ");

            // ── billing_application_line_items ──
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS billing_application_line_items (
                    ""Id"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
                    ""BillingApplicationId"" uuid NOT NULL,
                    ""OwnerSOVLineItemId"" uuid NOT NULL,
                    ""ItemNumber"" character varying(50) NOT NULL,
                    ""Description"" character varying(500) NOT NULL,
                    ""ScheduledValue"" numeric(18,2) NOT NULL,
                    ""SortOrder"" integer NOT NULL,
                    ""WorkCompletedPrevious"" numeric(18,2) NOT NULL,
                    ""WorkCompletedThisPeriod"" numeric(18,2) NOT NULL,
                    ""MaterialsStoredToDate"" numeric(18,2) NOT NULL,
                    ""TotalCompletedAndStored"" numeric(18,2) NOT NULL,
                    ""PercentComplete"" numeric(5,2) NOT NULL,
                    ""BalanceToFinish"" numeric(18,2) NOT NULL,
                    ""RetainagePercent"" numeric(5,2),
                    ""RetainageAmount"" numeric(18,2) NOT NULL,
                    ""CostCodeId"" uuid,
                    ""TenantId"" uuid NOT NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL,
                    ""CreatedBy"" text NOT NULL,
                    ""UpdatedAt"" timestamp with time zone,
                    ""UpdatedBy"" text,
                    ""IsDeleted"" boolean NOT NULL DEFAULT false,
                    ""DeletedAt"" timestamp with time zone,
                    ""DeletedBy"" text,
                    CONSTRAINT ""PK_billing_application_line_items"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_billing_app_line_items_billing_applications""
                        FOREIGN KEY (""BillingApplicationId"")
                        REFERENCES billing_applications(""Id"") ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS ""IX_billing_app_lines_tenant_app_sort""
                    ON billing_application_line_items (""TenantId"", ""BillingApplicationId"", ""SortOrder"");
                CREATE INDEX IF NOT EXISTS ""IX_billing_app_lines_TenantId""
                    ON billing_application_line_items (""TenantId"");
                CREATE INDEX IF NOT EXISTS ""IX_billing_app_lines_CompanyId""
                    ON billing_application_line_items (""CompanyId"");
            ");

            // ── billing_periods ──
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS billing_periods (
                    ""Id"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
                    ""Name"" character varying(200) NOT NULL,
                    ""PeriodStart"" date NOT NULL,
                    ""PeriodEnd"" date NOT NULL,
                    ""BillingDeadlineDay"" integer NOT NULL DEFAULT 25,
                    ""Status"" character varying(20) NOT NULL DEFAULT 'Open',
                    ""Notes"" character varying(1000),
                    ""TenantId"" uuid NOT NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL,
                    ""CreatedBy"" text NOT NULL,
                    ""UpdatedAt"" timestamp with time zone,
                    ""UpdatedBy"" text,
                    ""IsDeleted"" boolean NOT NULL DEFAULT false,
                    ""DeletedAt"" timestamp with time zone,
                    ""DeletedBy"" text,
                    CONSTRAINT ""PK_billing_periods"" PRIMARY KEY (""Id"")
                );
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_billing_periods_tenant_company_start""
                    ON billing_periods (""TenantId"", ""CompanyId"", ""PeriodStart"")
                    WHERE ""IsDeleted"" = false;
                CREATE INDEX IF NOT EXISTS ""IX_billing_periods_TenantId""
                    ON billing_periods (""TenantId"");
                CREATE INDEX IF NOT EXISTS ""IX_billing_periods_CompanyId""
                    ON billing_periods (""CompanyId"");
            ");

            // ── billing_package_documents ──
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS billing_package_documents (
                    ""Id"" uuid NOT NULL,
                    ""CompanyId"" uuid NOT NULL,
                    ""BillingApplicationId"" uuid NOT NULL,
                    ""DocumentType"" character varying(100) NOT NULL,
                    ""FileName"" character varying(500) NOT NULL,
                    ""FilePath"" character varying(1000),
                    ""IsRequired"" boolean NOT NULL DEFAULT false,
                    ""IsReceived"" boolean NOT NULL DEFAULT false,
                    ""Notes"" character varying(1000),
                    ""TenantId"" uuid NOT NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL,
                    ""CreatedBy"" text NOT NULL,
                    ""UpdatedAt"" timestamp with time zone,
                    ""UpdatedBy"" text,
                    ""IsDeleted"" boolean NOT NULL DEFAULT false,
                    ""DeletedAt"" timestamp with time zone,
                    ""DeletedBy"" text,
                    CONSTRAINT ""PK_billing_package_documents"" PRIMARY KEY (""Id"")
                );
                CREATE INDEX IF NOT EXISTS ""IX_billing_pkg_docs_tenant_app""
                    ON billing_package_documents (""TenantId"", ""BillingApplicationId"");
                CREATE INDEX IF NOT EXISTS ""IX_billing_pkg_docs_TenantId""
                    ON billing_package_documents (""TenantId"");
                CREATE INDEX IF NOT EXISTS ""IX_billing_pkg_docs_CompanyId""
                    ON billing_package_documents (""CompanyId"");
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Intentionally empty — these tables use IF NOT EXISTS in Up()
            // and should not be dropped during rollback. Manual cleanup
            // required if rollback is needed.
        }
    }
}
