using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class FixOnboardingStatusColumnType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Only convert if column is currently text/varchar (some DBs already have integer).
            // The DO block checks the actual column type before attempting conversion.
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'employees' 
                          AND column_name = 'OnboardingStatus' 
                          AND data_type IN ('character varying', 'text')
                    ) THEN
                        ALTER TABLE employees ALTER COLUMN ""OnboardingStatus"" DROP DEFAULT;
                        ALTER TABLE employees 
                            ALTER COLUMN ""OnboardingStatus"" TYPE integer 
                            USING CASE ""OnboardingStatus""
                                WHEN 'NotStarted' THEN 0
                                WHEN 'InProgress' THEN 1
                                WHEN 'Complete' THEN 2
                                WHEN 'Incomplete' THEN 3
                                ELSE 0
                            END;
                        ALTER TABLE employees ALTER COLUMN ""OnboardingStatus"" SET DEFAULT 0;
                    END IF;
                END $$;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "OnboardingStatus",
                table: "employees",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "NotStarted",
                oldClrType: typeof(int),
                oldType: "integer",
                oldDefaultValue: 0);
        }
    }
}
