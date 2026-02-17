using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerOnboardingEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "PaidAmount",
                table: "payment_applications",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaidReference",
                table: "payment_applications",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReviewedBy",
                table: "payment_applications",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReviewedNotes",
                table: "payment_applications",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ScheduleOfValuesId",
                table: "payment_applications",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "OnboardingCompletedAt",
                table: "employees",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OnboardingStatus",
                table: "employees",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "NotStarted");

            migrationBuilder.AddColumn<string>(
                name: "OnboardingDefaultPrevailingWageClass",
                table: "companies",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "OnboardingEnableUnionFields",
                table: "companies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "OnboardingEnabled",
                table: "companies",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "OnboardingRequireApprovalWorkflow",
                table: "companies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "OnboardingRequireCertifications",
                table: "companies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "OnboardingRequireEmergencyContact",
                table: "companies",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "OnboardingRequireI9",
                table: "companies",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "OnboardingRequireW4",
                table: "companies",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "OnboardingRequiredCertificationTypes",
                table: "companies",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "PayAppAllowRetainageOverride",
                table: "companies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "PayAppAllowRetainageReleaseBeforeFinal",
                table: "companies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "PayAppDefaultBookMode",
                table: "companies",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Both");

            migrationBuilder.AddColumn<decimal>(
                name: "PayAppDefaultRetainagePercent",
                table: "companies",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 10m);

            migrationBuilder.AddColumn<bool>(
                name: "PayAppEnableApprovalWorkflow",
                table: "companies",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "PayAppLockSubmittedLineItems",
                table: "companies",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "PayAppRequireLienWaiverBeforePaid",
                table: "companies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "PayAppRequireSignedSubcontract",
                table: "companies",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.CreateTable(
                name: "employee_certifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    CertificationType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CertificationName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CertificationNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    IssuedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IssuingAuthority = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    VerificationStatus = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
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
                    table.PrimaryKey("PK_employee_certifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_employee_certifications_employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalTable: "employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "employee_emergency_contacts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Relationship = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Phone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    Address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsPrimary = table.Column<bool>(type: "boolean", nullable: false),
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
                    table.PrimaryKey("PK_employee_emergency_contacts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_employee_emergency_contacts_employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalTable: "employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "employee_tax_compliance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    W4FilingStatus = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    W4AdditionalWithholding = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    W4Exempt = table.Column<bool>(type: "boolean", nullable: false),
                    I9Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    I9Section1Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    I9Section2Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    I9VerifiedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CertifiedPayrollRequired = table.Column<bool>(type: "boolean", nullable: false),
                    DavisBaconApplicable = table.Column<bool>(type: "boolean", nullable: false),
                    PayrollNotes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
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
                    table.PrimaryKey("PK_employee_tax_compliance", x => x.Id);
                    table.ForeignKey(
                        name: "FK_employee_tax_compliance_employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalTable: "employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "employee_union_affiliations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    UnionName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    LocalNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    MemberId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Craft = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ApprenticeLevel = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ClassificationCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ClassificationName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Jurisdiction = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    EffectiveDate = table.Column<DateOnly>(type: "date", nullable: true),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
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
                    table.PrimaryKey("PK_employee_union_affiliations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_employee_union_affiliations_employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalTable: "employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "onboarding_checklists",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyProfileCompleted = table.Column<bool>(type: "boolean", nullable: false),
                    ContractorTypeSelected = table.Column<bool>(type: "boolean", nullable: false),
                    ModulesActivated = table.Column<bool>(type: "boolean", nullable: false),
                    ModulesConfigured = table.Column<bool>(type: "boolean", nullable: false),
                    TeamMembersInvited = table.Column<bool>(type: "boolean", nullable: false),
                    FirstProjectCreated = table.Column<bool>(type: "boolean", nullable: false),
                    EmployeesAdded = table.Column<bool>(type: "boolean", nullable: false),
                    CostCodesConfigured = table.Column<bool>(type: "boolean", nullable: false),
                    Dismissed = table.Column<bool>(type: "boolean", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
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
                    table.PrimaryKey("PK_onboarding_checklists", x => x.Id);
                    table.ForeignKey(
                        name: "FK_onboarding_checklists_companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_onboarding_checklists_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "payment_application_book_entries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    PaymentApplicationId = table.Column<Guid>(type: "uuid", nullable: false),
                    BookType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    EarnedRevenueToDate = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CurrentPeriodRevenue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    BillingsToDate = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CurrentPeriodBilling = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RetainageHeldToDate = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OverUnderBilling = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    GeneratedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
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
                    table.PrimaryKey("PK_payment_application_book_entries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_payment_application_book_entries_payment_applications_Payme~",
                        column: x => x.PaymentApplicationId,
                        principalTable: "payment_applications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "payment_application_line_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    PaymentApplicationId = table.Column<Guid>(type: "uuid", nullable: false),
                    SOVLineItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    ItemNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ScheduledValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    WorkCompletedPrevious = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    WorkCompletedThisPeriod = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MaterialsStoredPrevious = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MaterialsStoredThisPeriod = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MaterialsStoredToDate = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalCompletedAndStoredToDate = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PercentComplete = table.Column<decimal>(type: "numeric(8,4)", precision: 8, scale: 4, nullable: false),
                    BalanceToFinish = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RetainagePercent = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    RetainageAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
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
                    table.PrimaryKey("PK_payment_application_line_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_payment_application_line_items_payment_applications_Payment~",
                        column: x => x.PaymentApplicationId,
                        principalTable: "payment_applications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_payment_application_line_items_sov_line_items_SOVLineItemId",
                        column: x => x.SOVLineItemId,
                        principalTable: "sov_line_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "team_invitations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Role = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AcceptedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AcceptedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Message = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    InvitedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
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
                    table.PrimaryKey("PK_team_invitations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_team_invitations_companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_payment_applications_ScheduleOfValuesId",
                table: "payment_applications",
                column: "ScheduleOfValuesId");

            migrationBuilder.CreateIndex(
                name: "IX_employees_onboarding_status",
                table: "employees",
                column: "OnboardingStatus");

            migrationBuilder.CreateIndex(
                name: "IX_employee_certifications_EmployeeId",
                table: "employee_certifications",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_employee_certifications_ExpiresDate",
                table: "employee_certifications",
                column: "ExpiresDate");

            migrationBuilder.CreateIndex(
                name: "IX_employee_certifications_TenantId",
                table: "employee_certifications",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_employee_emergency_contacts_EmployeeId",
                table: "employee_emergency_contacts",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_employee_emergency_contacts_TenantId",
                table: "employee_emergency_contacts",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_employee_tax_compliance_EmployeeId",
                table: "employee_tax_compliance",
                column: "EmployeeId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_employee_tax_compliance_TenantId",
                table: "employee_tax_compliance",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_employee_union_affiliations_EmployeeId",
                table: "employee_union_affiliations",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_employee_union_affiliations_TenantId",
                table: "employee_union_affiliations",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_onboarding_checklists_CompanyId",
                table: "onboarding_checklists",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_onboarding_checklists_TenantId",
                table: "onboarding_checklists",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_onboarding_checklists_TenantId_UserId_CompanyId",
                table: "onboarding_checklists",
                columns: new[] { "TenantId", "UserId", "CompanyId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_onboarding_checklists_UserId",
                table: "onboarding_checklists",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_payment_application_book_entries_CompanyId",
                table: "payment_application_book_entries",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_payment_application_book_entries_PaymentApplicationId_BookT~",
                table: "payment_application_book_entries",
                columns: new[] { "PaymentApplicationId", "BookType" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_payment_application_book_entries_TenantId",
                table: "payment_application_book_entries",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_payment_application_line_items_CompanyId",
                table: "payment_application_line_items",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_payment_application_line_items_PaymentApplicationId",
                table: "payment_application_line_items",
                column: "PaymentApplicationId");

            migrationBuilder.CreateIndex(
                name: "IX_payment_application_line_items_PaymentApplicationId_SOVLine~",
                table: "payment_application_line_items",
                columns: new[] { "PaymentApplicationId", "SOVLineItemId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_payment_application_line_items_SOVLineItemId",
                table: "payment_application_line_items",
                column: "SOVLineItemId");

            migrationBuilder.CreateIndex(
                name: "IX_payment_application_line_items_TenantId",
                table: "payment_application_line_items",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_team_invitations_CompanyId",
                table: "team_invitations",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_team_invitations_TenantId",
                table: "team_invitations",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_team_invitations_TenantId_Email_CompanyId",
                table: "team_invitations",
                columns: new[] { "TenantId", "Email", "CompanyId" });

            migrationBuilder.CreateIndex(
                name: "IX_team_invitations_TokenHash",
                table: "team_invitations",
                column: "TokenHash",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_payment_applications_schedule_of_values_ScheduleOfValuesId",
                table: "payment_applications",
                column: "ScheduleOfValuesId",
                principalTable: "schedule_of_values",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_payment_applications_schedule_of_values_ScheduleOfValuesId",
                table: "payment_applications");

            migrationBuilder.DropTable(
                name: "employee_certifications");

            migrationBuilder.DropTable(
                name: "employee_emergency_contacts");

            migrationBuilder.DropTable(
                name: "employee_tax_compliance");

            migrationBuilder.DropTable(
                name: "employee_union_affiliations");

            migrationBuilder.DropTable(
                name: "onboarding_checklists");

            migrationBuilder.DropTable(
                name: "payment_application_book_entries");

            migrationBuilder.DropTable(
                name: "payment_application_line_items");

            migrationBuilder.DropTable(
                name: "team_invitations");

            migrationBuilder.DropIndex(
                name: "IX_payment_applications_ScheduleOfValuesId",
                table: "payment_applications");

            migrationBuilder.DropIndex(
                name: "IX_employees_onboarding_status",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "PaidAmount",
                table: "payment_applications");

            migrationBuilder.DropColumn(
                name: "PaidReference",
                table: "payment_applications");

            migrationBuilder.DropColumn(
                name: "ReviewedBy",
                table: "payment_applications");

            migrationBuilder.DropColumn(
                name: "ReviewedNotes",
                table: "payment_applications");

            migrationBuilder.DropColumn(
                name: "ScheduleOfValuesId",
                table: "payment_applications");

            migrationBuilder.DropColumn(
                name: "OnboardingCompletedAt",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "OnboardingStatus",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "OnboardingDefaultPrevailingWageClass",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "OnboardingEnableUnionFields",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "OnboardingEnabled",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "OnboardingRequireApprovalWorkflow",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "OnboardingRequireCertifications",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "OnboardingRequireEmergencyContact",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "OnboardingRequireI9",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "OnboardingRequireW4",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "OnboardingRequiredCertificationTypes",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "PayAppAllowRetainageOverride",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "PayAppAllowRetainageReleaseBeforeFinal",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "PayAppDefaultBookMode",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "PayAppDefaultRetainagePercent",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "PayAppEnableApprovalWorkflow",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "PayAppLockSubmittedLineItems",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "PayAppRequireLienWaiverBeforePaid",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "PayAppRequireSignedSubcontract",
                table: "companies");
        }
    }
}
