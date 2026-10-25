using FluentAssertions;
using Pitbull.Core.Domain;

namespace Pitbull.Tests.Unit.Domain;

public class CostTypeEnumTests
{
    [Fact]
    public void CostType_HasAllRequiredValues()
    {
        // Verify all cost types needed for crew timecard auto-assignment exist
        Enum.IsDefined(typeof(CostType), CostType.Labor).Should().BeTrue();
        Enum.IsDefined(typeof(CostType), CostType.Material).Should().BeTrue();
        Enum.IsDefined(typeof(CostType), CostType.Equipment).Should().BeTrue();
        Enum.IsDefined(typeof(CostType), CostType.Subcontract).Should().BeTrue();
        Enum.IsDefined(typeof(CostType), CostType.Overhead).Should().BeTrue();
        Enum.IsDefined(typeof(CostType), CostType.Other).Should().BeTrue();
    }

    [Fact]
    public void CostType_Overhead_HasExpectedValue()
    {
        ((int)CostType.Overhead).Should().Be(6);
    }

    [Fact]
    public void CostType_ExistingValues_AreUnchanged()
    {
        // Ensure existing enum values haven't shifted
        ((int)CostType.Labor).Should().Be(1);
        ((int)CostType.Material).Should().Be(2);
        ((int)CostType.Equipment).Should().Be(3);
        ((int)CostType.Subcontract).Should().Be(4);
        ((int)CostType.Other).Should().Be(5);
    }
}
