using Pitbull.ProjectManagement.Domain;
using Pitbull.ProjectManagement.Features;

namespace Pitbull.Tests.Unit.Modules.Spatial;

/// <summary>2.16.3 — model asset status never claims ready while processing.</summary>
public class ModelAssetStatusTests
{
    [Theory]
    [InlineData("Succeeded", true)]
    [InlineData("Pending", false)]
    [InlineData("Processing", false)]
    [InlineData("Failed", false)]
    public void IsReady_only_when_succeeded(string status, bool expected)
    {
        Assert.Equal(expected, ModelAssetStatus.IsReady(status));
    }

    [Fact]
    public void ToDto_pending_is_not_ready()
    {
        var entity = new ModelAsset
        {
            Id = Guid.NewGuid(),
            ProjectId = Guid.NewGuid(),
            DisplayName = "Test",
            ConversionStatus = ModelConversionStatus.Pending,
            VersionNumber = 1,
        };
        var dto = ModelAssetStatus.ToDto(entity);
        Assert.False(dto.IsReady);
        Assert.Equal("Pending", dto.ConversionStatus);
    }

    [Fact]
    public void EmptyList_is_honest_not_failure()
    {
        var projectId = Guid.NewGuid();
        var empty = ModelAssetStatus.EmptyList(projectId);
        Assert.Empty(empty.Assets);
        Assert.Equal(projectId, empty.ProjectId);
        Assert.Contains("No model assets", empty.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("failed", empty.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ToDto_processing_is_never_ready()
    {
        var entity = new ModelAsset
        {
            Id = Guid.NewGuid(),
            ProjectId = Guid.NewGuid(),
            DisplayName = "Converting",
            ConversionStatus = ModelConversionStatus.Processing,
            VersionNumber = 1,
            RuntimeBlobKey = null,
        };
        var dto = ModelAssetStatus.ToDto(entity);
        Assert.False(dto.IsReady);
        Assert.Equal("Processing", dto.ConversionStatus);
    }

    [Fact]
    public void Active_pointer_requires_ready_semantics()
    {
        // Documented rule for SetActiveModelAssetAsync: only Succeeded → IsReady true.
        Assert.True(ModelAssetStatus.IsReady(nameof(ModelConversionStatus.Succeeded)));
        Assert.False(ModelAssetStatus.IsReady(nameof(ModelConversionStatus.Pending)));
        Assert.False(ModelAssetStatus.IsReady(nameof(ModelConversionStatus.Processing)));
    }
}
