using FluentAssertions;
using Pitbull.Core.Domain;
using Xunit;

namespace Pitbull.Tests.Unit.Domain;

public class CostTypeLabelsTests
{
    [Theory]
    [InlineData(CostType.Labor, "Labor")]
    [InlineData(CostType.Material, "Material")]
    [InlineData(CostType.Equipment, "Equipment")]
    [InlineData(CostType.Subcontract, "Sub (general)")]
    [InlineData(CostType.Other, "Other")]
    [InlineData(CostType.Overhead, "Overhead")]
    [InlineData(CostType.SubLabor, "Sub Labor")]
    [InlineData(CostType.SubMaterial, "Sub Material")]
    [InlineData(CostType.SubThirdParty, "Sub Third Party")]
    public void DisplayName_matches_job_cost_language(CostType type, string expected)
    {
        CostTypeLabels.DisplayName(type).Should().Be(expected);
    }

    [Fact]
    public void Wire_values_are_stable()
    {
        ((int)CostType.Labor).Should().Be(1);
        ((int)CostType.Overhead).Should().Be(6);
        ((int)CostType.SubLabor).Should().Be(7);
        ((int)CostType.SubMaterial).Should().Be(8);
        ((int)CostType.SubThirdParty).Should().Be(9);
    }

    [Fact]
    public void IsSubRelated_includes_legacy_and_splits()
    {
        CostTypeLabels.IsSubRelated(CostType.Subcontract).Should().BeTrue();
        CostTypeLabels.IsSubRelated(CostType.SubLabor).Should().BeTrue();
        CostTypeLabels.IsSubRelated(CostType.SubMaterial).Should().BeTrue();
        CostTypeLabels.IsSubRelated(CostType.SubThirdParty).Should().BeTrue();
        CostTypeLabels.IsSubRelated(CostType.Labor).Should().BeFalse();
        CostTypeLabels.IsSubRelated(CostType.Overhead).Should().BeFalse();
    }
}
