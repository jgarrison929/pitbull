using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pitbull.Api.Migrations
{
    /// <inheritdoc />
    public partial class FixAuditLogActionValues : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The 20260217105325_EnhancedAuditLog migration converted the "Action" column
            // from integer to varchar using USING "Action"::text, which turned the enum's
            // integer values (1,2,3,...) into string digits ("1","2","3",...) instead of
            // the enum name strings that EF's HasConversion<string>() expects.
            // This fixes any remaining integer-string values to their correct enum names.
            migrationBuilder.Sql(@"
                UPDATE ""audit_logs""
                SET ""Action"" = CASE ""Action""
                    WHEN '1'  THEN 'Create'
                    WHEN '2'  THEN 'Read'
                    WHEN '3'  THEN 'Update'
                    WHEN '4'  THEN 'Delete'
                    WHEN '5'  THEN 'Login'
                    WHEN '6'  THEN 'Logout'
                    WHEN '7'  THEN 'FailedLogin'
                    WHEN '8'  THEN 'PasswordReset'
                    WHEN '9'  THEN 'RoleChange'
                    WHEN '10' THEN 'Export'
                    WHEN '11' THEN 'Import'
                    WHEN '12' THEN 'StatusChange'
                    WHEN '13' THEN 'Approval'
                    WHEN '14' THEN 'Rejection'
                    WHEN '15' THEN 'Locked'
                    WHEN '16' THEN 'Unlocked'
                    ELSE ""Action""
                END
                WHERE ""Action"" ~ '^[0-9]+$';
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Reverse: convert enum name strings back to integer strings.
            // This is a best-effort reversal for rollback scenarios.
            migrationBuilder.Sql(@"
                UPDATE ""audit_logs""
                SET ""Action"" = CASE ""Action""
                    WHEN 'Create'        THEN '1'
                    WHEN 'Read'          THEN '2'
                    WHEN 'Update'        THEN '3'
                    WHEN 'Delete'        THEN '4'
                    WHEN 'Login'         THEN '5'
                    WHEN 'Logout'        THEN '6'
                    WHEN 'FailedLogin'   THEN '7'
                    WHEN 'PasswordReset' THEN '8'
                    WHEN 'RoleChange'    THEN '9'
                    WHEN 'Export'        THEN '10'
                    WHEN 'Import'        THEN '11'
                    WHEN 'StatusChange'  THEN '12'
                    WHEN 'Approval'      THEN '13'
                    WHEN 'Rejection'     THEN '14'
                    WHEN 'Locked'        THEN '15'
                    WHEN 'Unlocked'      THEN '16'
                    ELSE ""Action""
                END
                WHERE ""Action"" IN ('Create','Read','Update','Delete','Login','Logout',
                    'FailedLogin','PasswordReset','RoleChange','Export','Import',
                    'StatusChange','Approval','Rejection','Locked','Unlocked');
            ");
        }
    }
}
