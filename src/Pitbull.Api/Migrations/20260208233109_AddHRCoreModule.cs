using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddHRCoreModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "hr");

            migrationBuilder.RenameIndex(
                name: "IX_employees_SupervisorId",
                table: "employees",
                newName: "IX_employees_SupervisorId1");

            migrationBuilder.CreateTable(
                name: "employees",
                schema: "hr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    FirstName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    MiddleName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    LastName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    PreferredName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Suffix = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    SSNEncrypted = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    SSNLast4 = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: false),
                    DateOfBirth = table.Column<DateOnly>(type: "date", nullable: false),
                    Email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    PersonalEmail = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    SecondaryPhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    AddressLine1 = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    AddressLine2 = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    City = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    State = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    ZipCode = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    Country = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true, defaultValue: "US"),
                    Status = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    OriginalHireDate = table.Column<DateOnly>(type: "date", nullable: false),
                    MostRecentHireDate = table.Column<DateOnly>(type: "date", nullable: false),
                    TerminationDate = table.Column<DateOnly>(type: "date", nullable: true),
                    EligibleForRehire = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    WorkerType = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    FLSAStatus = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    EmploymentType = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    JobTitle = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    TradeCode = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    WorkersCompClassCode = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    DepartmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    SupervisorId = table.Column<Guid>(type: "uuid", nullable: true),
                    HomeState = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    SUIState = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    PayFrequency = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    DefaultPayType = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    DefaultHourlyRate = table.Column<decimal>(type: "numeric(10,4)", precision: 10, scale: 4, nullable: true),
                    PaymentMethod = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    IsUnionMember = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    I9Status = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    EVerifyStatus = table.Column<int>(type: "integer", nullable: true),
                    BackgroundCheckStatus = table.Column<int>(type: "integer", nullable: true),
                    DrugTestStatus = table.Column<int>(type: "integer", nullable: true),
                    AppUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
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
                    table.PrimaryKey("PK_employees", x => x.Id);
                    table.ForeignKey(
                        name: "FK_employees_employees_SupervisorId",
                        column: x => x.SupervisorId,
                        principalSchema: "hr",
                        principalTable: "employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "certifications",
                schema: "hr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    CertificationTypeCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CertificationName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CertificateNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    IssuingAuthority = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    IssueDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ExpirationDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    VerifiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    VerifiedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    VerificationNotes = table.Column<string>(type: "text", nullable: true),
                    Warning90DaysSentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Warning60DaysSentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Warning30DaysSentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ExpiredNotificationSentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DocumentId = table.Column<Guid>(type: "uuid", nullable: true),
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
                    table.PrimaryKey("PK_certifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_certifications_employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalSchema: "hr",
                        principalTable: "employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "employment_episodes",
                schema: "hr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    EpisodeNumber = table.Column<int>(type: "integer", nullable: false),
                    HireDate = table.Column<DateOnly>(type: "date", nullable: false),
                    TerminationDate = table.Column<DateOnly>(type: "date", nullable: true),
                    SeparationReason = table.Column<int>(type: "integer", nullable: true),
                    EligibleForRehire = table.Column<bool>(type: "boolean", nullable: true),
                    SeparationNotes = table.Column<string>(type: "text", nullable: true),
                    WasVoluntary = table.Column<bool>(type: "boolean", nullable: true),
                    UnionDispatchReference = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    JobClassificationAtHire = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    HourlyRateAtHire = table.Column<decimal>(type: "numeric(10,4)", precision: 10, scale: 4, nullable: true),
                    PositionAtHire = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    PositionAtTermination = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
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
                    table.PrimaryKey("PK_employment_episodes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_employment_episodes_employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalSchema: "hr",
                        principalTable: "employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pay_rates",
                schema: "hr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Description = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    RateType = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    Amount = table.Column<decimal>(type: "numeric(10,4)", precision: 10, scale: 4, nullable: false),
                    Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false, defaultValue: "USD"),
                    EffectiveDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ExpirationDate = table.Column<DateOnly>(type: "date", nullable: true),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: true),
                    ShiftCode = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    WorkState = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    Priority = table.Column<int>(type: "integer", nullable: false, defaultValue: 10),
                    IncludesFringe = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    FringeRate = table.Column<decimal>(type: "numeric(10,4)", precision: 10, scale: 4, nullable: true),
                    HealthWelfareRate = table.Column<decimal>(type: "numeric(10,4)", precision: 10, scale: 4, nullable: true),
                    PensionRate = table.Column<decimal>(type: "numeric(10,4)", precision: 10, scale: 4, nullable: true),
                    TrainingRate = table.Column<decimal>(type: "numeric(10,4)", precision: 10, scale: 4, nullable: true),
                    OtherFringeRate = table.Column<decimal>(type: "numeric(10,4)", precision: 10, scale: 4, nullable: true),
                    Source = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    Notes = table.Column<string>(type: "text", nullable: true),
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
                    table.PrimaryKey("PK_pay_rates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_pay_rates_employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalSchema: "hr",
                        principalTable: "employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_certifications_CertificationTypeCode",
                schema: "hr",
                table: "certifications",
                column: "CertificationTypeCode");

            migrationBuilder.CreateIndex(
                name: "IX_certifications_EmployeeId",
                schema: "hr",
                table: "certifications",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_certifications_ExpirationDate",
                schema: "hr",
                table: "certifications",
                column: "ExpirationDate");

            migrationBuilder.CreateIndex(
                name: "IX_certifications_Status",
                schema: "hr",
                table: "certifications",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_employees_Email",
                schema: "hr",
                table: "employees",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_employees_Status",
                schema: "hr",
                table: "employees",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_employees_SupervisorId",
                schema: "hr",
                table: "employees",
                column: "SupervisorId");

            migrationBuilder.CreateIndex(
                name: "IX_employees_TenantId_EmployeeNumber",
                schema: "hr",
                table: "employees",
                columns: new[] { "TenantId", "EmployeeNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_employees_TradeCode",
                schema: "hr",
                table: "employees",
                column: "TradeCode");

            migrationBuilder.CreateIndex(
                name: "IX_employment_episodes_EmployeeId",
                schema: "hr",
                table: "employment_episodes",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_employment_episodes_TenantId_EmployeeId_EpisodeNumber",
                schema: "hr",
                table: "employment_episodes",
                columns: new[] { "TenantId", "EmployeeId", "EpisodeNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pay_rates_EffectiveDate",
                schema: "hr",
                table: "pay_rates",
                column: "EffectiveDate");

            migrationBuilder.CreateIndex(
                name: "IX_pay_rates_EmployeeId",
                schema: "hr",
                table: "pay_rates",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_pay_rates_ExpirationDate",
                schema: "hr",
                table: "pay_rates",
                column: "ExpirationDate");

            migrationBuilder.CreateIndex(
                name: "IX_pay_rates_ProjectId",
                schema: "hr",
                table: "pay_rates",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_pay_rates_ShiftCode",
                schema: "hr",
                table: "pay_rates",
                column: "ShiftCode");

            migrationBuilder.CreateIndex(
                name: "IX_pay_rates_WorkState",
                schema: "hr",
                table: "pay_rates",
                column: "WorkState");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "certifications",
                schema: "hr");

            migrationBuilder.DropTable(
                name: "employment_episodes",
                schema: "hr");

            migrationBuilder.DropTable(
                name: "pay_rates",
                schema: "hr");

            migrationBuilder.DropTable(
                name: "employees",
                schema: "hr");

            migrationBuilder.RenameIndex(
                name: "IX_employees_SupervisorId1",
                table: "employees",
                newName: "IX_employees_SupervisorId");
        }
    }
}
