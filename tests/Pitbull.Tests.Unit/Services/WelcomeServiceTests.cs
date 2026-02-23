using Pitbull.Api.Services;

namespace Pitbull.Tests.Unit.Services;

public class WelcomeServiceTests
{
    [Theory]
    [InlineData("Chief Executive Officer", "Executive")]
    [InlineData("Chief Operating Officer", "Executive")]
    [InlineData("VP of Operations", "Executive")]
    [InlineData("Sr Director of Safety", "Executive")]
    [InlineData("President", "Executive")]
    public void DetectTourProfile_ExecutiveTitles_ReturnsExecutive(string title, string _)
    {
        var roles = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Admin" };
        var result = WelcomeService.DetectTourProfile(title, roles);
        Assert.Equal(TourProfile.Executive, result);
    }

    [Theory]
    [InlineData("Chief Financial Officer")]
    [InlineData("VP of Accounting")]
    [InlineData("VP Controller")]
    [InlineData("Sr Director of Accounting")]
    [InlineData("Accounting Manager")]
    public void DetectTourProfile_CfoTitles_ReturnsCfo(string title)
    {
        var roles = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Admin" };
        var result = WelcomeService.DetectTourProfile(title, roles);
        Assert.Equal(TourProfile.Cfo, result);
    }

    [Theory]
    [InlineData("Project Manager")]
    [InlineData("Sr Project Manager")]
    [InlineData("Project Engineer")]
    [InlineData("Sr Project Engineer")]
    [InlineData("Project Coordinator")]
    public void DetectTourProfile_PmTitles_ReturnsProjectManager(string title)
    {
        var roles = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Supervisor" };
        var result = WelcomeService.DetectTourProfile(title, roles);
        Assert.Equal(TourProfile.ProjectManager, result);
    }

    [Theory]
    [InlineData("Field Engineer")]
    [InlineData("Foreman")]
    [InlineData("Commissioning Officer")]
    public void DetectTourProfile_FieldTitles_ReturnsField(string title)
    {
        var roles = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "User" };
        var result = WelcomeService.DetectTourProfile(title, roles);
        Assert.Equal(TourProfile.Field, result);
    }

    [Theory]
    [InlineData("AP Clerk")]
    [InlineData("AR Clerk")]
    [InlineData("Payroll Clerk")]
    [InlineData("Staff Accountant")]
    public void DetectTourProfile_ClerkTitles_ReturnsClerk(string title)
    {
        var roles = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "User" };
        var result = WelcomeService.DetectTourProfile(title, roles);
        Assert.Equal(TourProfile.Clerk, result);
    }

    [Theory]
    [InlineData("HR Manager")]
    [InlineData("HR Coordinator")]
    [InlineData("VP of HR")]
    [InlineData("Chief People Officer")]
    public void DetectTourProfile_HrTitles_ReturnsHr(string title)
    {
        var roles = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Manager" };
        var result = WelcomeService.DetectTourProfile(title, roles);
        Assert.Equal(TourProfile.Hr, result);
    }

    [Theory]
    [InlineData("Estimator")]
    [InlineData("Sr Estimator")]
    [InlineData("Chief Estimator")]
    public void DetectTourProfile_EstimatorTitles_ReturnsEstimator(string title)
    {
        var roles = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "User" };
        var result = WelcomeService.DetectTourProfile(title, roles);
        Assert.Equal(TourProfile.Estimator, result);
    }

    [Theory]
    [InlineData("Chief Information Officer")]
    [InlineData("Chief Technology Officer")]
    [InlineData("IT Manager")]
    [InlineData("VP of IT")]
    public void DetectTourProfile_ItTitles_ReturnsItAdmin(string title)
    {
        var roles = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Admin" };
        var result = WelcomeService.DetectTourProfile(title, roles);
        Assert.Equal(TourProfile.ItAdmin, result);
    }

    [Fact]
    public void DetectTourProfile_AdminRoleNoTitle_FallsBackToExecutive()
    {
        var roles = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Admin" };
        var result = WelcomeService.DetectTourProfile(null, roles);
        Assert.Equal(TourProfile.Executive, result);
    }

    [Fact]
    public void DetectTourProfile_SupervisorRoleNoTitle_FallsBackToProjectManager()
    {
        var roles = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Supervisor" };
        var result = WelcomeService.DetectTourProfile("", roles);
        Assert.Equal(TourProfile.ProjectManager, result);
    }

    [Fact]
    public void DetectTourProfile_ManagerRoleNoTitle_FallsBackToProjectManager()
    {
        var roles = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Manager" };
        var result = WelcomeService.DetectTourProfile("", roles);
        Assert.Equal(TourProfile.ProjectManager, result);
    }

    [Fact]
    public void DetectTourProfile_UserRoleNoTitle_FallsBackToGeneral()
    {
        var roles = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "User" };
        var result = WelcomeService.DetectTourProfile("Laborer", roles);
        Assert.Equal(TourProfile.General, result);
    }

    [Fact]
    public void DetectTourProfile_NoRoleNoTitle_ReturnsGeneral()
    {
        var roles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var result = WelcomeService.DetectTourProfile(null, roles);
        Assert.Equal(TourProfile.General, result);
    }

    [Fact]
    public void DetectTourProfile_CfoWithAdminRole_ReturnsCfoNotExecutive()
    {
        // Title should take priority over Admin role
        var roles = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Admin" };
        var result = WelcomeService.DetectTourProfile("Chief Financial Officer", roles);
        Assert.Equal(TourProfile.Cfo, result);
    }

    [Fact]
    public void DetectTourProfile_CisoWithAdminRole_ReturnsItAdminNotExecutive()
    {
        var roles = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Admin" };
        var result = WelcomeService.DetectTourProfile("Chief Information Security Officer", roles);
        Assert.Equal(TourProfile.ItAdmin, result);
    }

    [Fact]
    public void DetectTourProfile_ShortAcronyms_MatchAsWholeWords()
    {
        var roles = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Admin" };
        Assert.Equal(TourProfile.ItAdmin, WelcomeService.DetectTourProfile("CTO", roles));
        Assert.Equal(TourProfile.Cfo, WelcomeService.DetectTourProfile("CFO", roles));
        Assert.Equal(TourProfile.ItAdmin, WelcomeService.DetectTourProfile("CIO", roles));
        Assert.Equal(TourProfile.ProjectManager, WelcomeService.DetectTourProfile("PM", roles));
    }

    [Fact]
    public void DetectTourProfile_DirectorTitles_DoNotFalseMatchAcronyms()
    {
        // "CTO" appears inside "Director" — must not match
        var roles = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Admin" };
        Assert.Equal(TourProfile.Executive, WelcomeService.DetectTourProfile("Sr Director of Safety", roles));
        Assert.Equal(TourProfile.Cfo, WelcomeService.DetectTourProfile("Sr Director of Accounting", roles));
        Assert.Equal(TourProfile.Executive, WelcomeService.DetectTourProfile("Director of Construction", roles));
    }
}
