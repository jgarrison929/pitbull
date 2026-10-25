using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Pitbull.Api.Controllers;

namespace Pitbull.Tests.Unit.Modules.Spatial;

/// <summary>2.16.9 — model upload endpoints require Spatial.Manage.</summary>
public class ModelAssetAuthzAttributeTests
{
    [Fact]
    public void RegisterModelAsset_requires_Spatial_Manage()
    {
        var method = typeof(ProjectSpatialController).GetMethod(
            nameof(ProjectSpatialController.RegisterModelAsset));
        Assert.NotNull(method);
        var auth = method!.GetCustomAttributes<AuthorizeAttribute>(inherit: true).ToList();
        Assert.Contains(auth, a => a.Policy == "Spatial.Manage");
    }

    [Fact]
    public void StartConversion_and_retry_require_Spatial_Manage()
    {
        foreach (var name in new[]
                 {
                     nameof(ProjectSpatialController.StartModelConversion),
                     nameof(ProjectSpatialController.RetryModelConversion),
                     nameof(ProjectSpatialController.FailModelConversion),
                     nameof(ProjectSpatialController.SetActiveModelAsset),
                 })
        {
            var method = typeof(ProjectSpatialController).GetMethod(name);
            Assert.NotNull(method);
            var auth = method!.GetCustomAttributes<AuthorizeAttribute>(inherit: true).ToList();
            Assert.Contains(auth, a => a.Policy == "Spatial.Manage");
        }
    }

    [Fact]
    public void ListModelAssets_requires_Spatial_View()
    {
        var method = typeof(ProjectSpatialController).GetMethod(
            nameof(ProjectSpatialController.ListModelAssets));
        Assert.NotNull(method);
        var auth = method!.GetCustomAttributes<AuthorizeAttribute>(inherit: true).ToList();
        Assert.Contains(auth, a => a.Policy == "Spatial.View");
    }
}
