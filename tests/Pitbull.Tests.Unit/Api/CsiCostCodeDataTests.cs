using FluentAssertions;
using Pitbull.Api.Controllers;
using Pitbull.Core.Domain;

namespace Pitbull.Tests.Unit.Api;

public class CsiCostCodeDataTests
{
    [Fact]
    public void GetStandardCodes_ReturnsNonEmptyList()
    {
        var codes = CsiCostCodeData.GetStandardCodes();
        codes.Should().NotBeEmpty();
    }

    [Fact]
    public void GetStandardCodes_Has16Divisions()
    {
        var codes = CsiCostCodeData.GetStandardCodes();
        var divisions = codes.Select(c => c.Division).Distinct().ToList();
        divisions.Should().HaveCount(16);
    }

    [Fact]
    public void GetStandardCodes_AllCodesHaveRequiredFields()
    {
        var codes = CsiCostCodeData.GetStandardCodes();
        codes.Should().AllSatisfy(c =>
        {
            c.Code.Should().NotBeNullOrWhiteSpace();
            c.Description.Should().NotBeNullOrWhiteSpace();
            c.Division.Should().NotBeNullOrWhiteSpace();
        });
    }

    [Fact]
    public void GetStandardCodes_AllCodesAreActive()
    {
        var codes = CsiCostCodeData.GetStandardCodes();
        codes.Should().AllSatisfy(c => c.IsActive.Should().BeTrue());
    }

    [Fact]
    public void GetStandardCodes_AllCodesAreCompanyStandard()
    {
        var codes = CsiCostCodeData.GetStandardCodes();
        codes.Should().AllSatisfy(c => c.IsCompanyStandard.Should().BeTrue());
    }

    [Fact]
    public void GetStandardCodes_AllCodesHave5DigitFormat()
    {
        var codes = CsiCostCodeData.GetStandardCodes();
        codes.Should().AllSatisfy(c => c.Code.Should().MatchRegex(@"^\d{5}$"));
    }

    [Fact]
    public void GetStandardCodes_CodesAreUnique()
    {
        var codes = CsiCostCodeData.GetStandardCodes();
        var uniqueCodes = codes.Select(c => c.Code).Distinct().ToList();
        uniqueCodes.Should().HaveCount(codes.Count);
    }

    [Fact]
    public void GetStandardCodes_ContainsAllCostTypes()
    {
        var codes = CsiCostCodeData.GetStandardCodes();
        var costTypes = codes.Select(c => c.CostType).Distinct().ToList();
        costTypes.Should().Contain(CostType.Labor);
        costTypes.Should().Contain(CostType.Material);
        costTypes.Should().Contain(CostType.Equipment);
        costTypes.Should().Contain(CostType.Other);
        // Job-cost sub splits + legacy umbrella + overhead
        costTypes.Should().Contain(CostType.SubLabor);
        costTypes.Should().Contain(CostType.SubMaterial);
        costTypes.Should().Contain(CostType.SubThirdParty);
        costTypes.Should().Contain(CostType.Subcontract);
        costTypes.Should().Contain(CostType.Overhead);
    }

    [Fact]
    public void GetStandardCodes_DivisionNamesFollowNumberDashNameFormat()
    {
        var codes = CsiCostCodeData.GetStandardCodes();
        var divisions = codes.Select(c => c.Division).Distinct().ToList();
        divisions.Should().AllSatisfy(d => d.Should().MatchRegex(@"^\d{2} - .+$"));
    }

    [Fact]
    public void GetStandardCodes_DivisionsSpanFrom01To16()
    {
        var codes = CsiCostCodeData.GetStandardCodes();
        var divisions = codes.Select(c => c.Division).Distinct().OrderBy(d => d).ToList();
        divisions.First().Should().StartWith("01");
        divisions.Last().Should().StartWith("16");
    }

    [Fact]
    public void GetStandardCodes_CodesAlignWithDivisionNumbers()
    {
        var codes = CsiCostCodeData.GetStandardCodes();
        codes.Should().AllSatisfy(c =>
        {
            var divPrefix = c.Division![..2];
            c.Code[..2].Should().Be(divPrefix,
                because: $"code {c.Code} should start with its division prefix {divPrefix}");
        });
    }

    [Fact]
    public void GetStandardCodes_ReturnsNewListEachCall()
    {
        var codes1 = CsiCostCodeData.GetStandardCodes();
        var codes2 = CsiCostCodeData.GetStandardCodes();
        codes1.Should().NotBeSameAs(codes2);
    }

    [Theory]
    [InlineData("01 - General Requirements")]
    [InlineData("03 - Concrete")]
    [InlineData("15 - Mechanical")]
    [InlineData("16 - Electrical")]
    public void GetStandardCodes_ContainsDivision(string division)
    {
        var codes = CsiCostCodeData.GetStandardCodes();
        codes.Should().Contain(c => c.Division == division);
    }
}
