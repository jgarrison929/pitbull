using System.Reflection;
using System.Runtime.Versioning;
using FluentAssertions;
using Microsoft.OpenApi;
using Pitbull.Api.Controllers;
using Pitbull.Core.Domain;

namespace Pitbull.Tests.Unit.Architecture;

/// <summary>
/// Guards the .NET 10 LTS upgrade (#218): shipped assemblies must target net10.0
/// and Microsoft.OpenApi 2.x types used by Program.cs OpenAPI transformers must resolve.
/// </summary>
[Trait("Category", "Architecture")]
public class Net10TargetFrameworkTests
{
    [Theory]
    [InlineData(typeof(ProjectsController))] // Pitbull.Api
    [InlineData(typeof(Tenant))]             // Pitbull.Core
    public void Shipped_Assembly_Targets_Net10(Type typeFromAssembly)
    {
        var assembly = typeFromAssembly.Assembly;
        var tfm = assembly.GetCustomAttribute<TargetFrameworkAttribute>()?.FrameworkName;

        tfm.Should().NotBeNullOrEmpty($"{assembly.GetName().Name} must declare a target framework");
        tfm.Should().Contain("Version=v10.0",
            because: $"{assembly.GetName().Name} must target .NET 10 (net10.0), got '{tfm}'");
    }

    [Fact]
    public void Runtime_Is_DotNet_10_Or_Higher()
    {
        // FrameworkDescription is like ".NET 10.0.x" when running under net10.0
        var description = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription;
        description.Should().StartWith(".NET 10",
            because: $"tests must execute on the .NET 10 runtime, got '{description}'");
    }

    [Fact]
    public void Microsoft_OpenApi_2x_Types_Used_By_Api_Host_Are_Available()
    {
        // Program.cs document transformer depends on OpenAPI.NET 2.x shape (no Models namespace).
        // This fails to compile/load if package major drifts back to 1.x or breaks 2.x APIs.
        var scheme = new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            In = ParameterLocation.Header,
            BearerFormat = "JWT"
        };

        scheme.Type.Should().Be(SecuritySchemeType.Http);
        scheme.Scheme.Should().Be("bearer");

        var components = new OpenApiComponents
        {
            SecuritySchemes = new Dictionary<string, IOpenApiSecurityScheme>
            {
                ["Bearer"] = scheme
            }
        };

        components.SecuritySchemes.Should().ContainKey("Bearer");
        typeof(OpenApiSecuritySchemeReference).Assembly.GetName().Name.Should().Be("Microsoft.OpenApi");
    }
}
