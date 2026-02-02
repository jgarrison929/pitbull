using System.Reflection;
using FluentAssertions;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NetArchTest.Rules;
using Pitbull.Api.Controllers;
using Pitbull.Core.CQRS;
using Pitbull.Projects.Features.CreateProject;

namespace Pitbull.Tests.Unit.Architecture;

[Trait("Category", "Architecture")]
public class ArchitectureTests
{
    private readonly Assembly _apiAssembly = typeof(ProjectsController).Assembly;
    private readonly Assembly _projectsAssembly = typeof(CreateProjectCommand).Assembly;
    private readonly Assembly _coreAssembly = typeof(ICommand<>).Assembly;

    [Fact]
    public void Controllers_ShouldAll_HaveAuthorizeAttribute()
    {
        var result = Types.InAssembly(_apiAssembly)
            .That().Inherit(typeof(ControllerBase))
            .And().DoNotHaveName("AuthController")
            .Should().HaveCustomAttribute(typeof(AuthorizeAttribute))
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Controllers missing [Authorize] attribute: {string.Join(", ", result.FailingTypeNames)}");
    }

    [Fact]
    public void AuthController_ShouldNotHave_AuthorizeAttribute()
    {
        var authControllerType = Types.InAssembly(_apiAssembly)
            .That().HaveName("AuthController")
            .GetTypes()
            .FirstOrDefault();

        authControllerType.Should().NotBeNull("AuthController should exist");
        
        var hasAuthorizeAttribute = authControllerType!
            .GetCustomAttributes(typeof(AuthorizeAttribute), true)
            .Any();

        hasAuthorizeAttribute.Should().BeFalse(
            "AuthController should not have [Authorize] attribute as it handles public auth endpoints");
    }

    [Fact]
    public void Controllers_Should_HaveCorrectNaming()
    {
        var result = Types.InAssembly(_apiAssembly)
            .That().Inherit(typeof(ControllerBase))
            .Should().HaveNameEndingWith("Controller")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"Controllers with incorrect naming: {string.Join(", ", result.FailingTypeNames)}");
    }

    [Fact]
    public void Handlers_Should_ReturnResult()
    {
        // Get all assemblies that might contain handlers
        var assemblies = new[]
        {
            _projectsAssembly,
            // Add other module assemblies as they are created
            // TODO: Add Pitbull.Bids assembly when available
        };

        foreach (var assembly in assemblies)
        {
            var handlerTypes = Types.InAssembly(assembly)
                .That().ImplementInterface(typeof(IRequestHandler<,>))
                .GetTypes();

            foreach (var handlerType in handlerTypes)
            {
                var interfaceTypes = handlerType.GetInterfaces()
                    .Where(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IRequestHandler<,>));

                foreach (var interfaceType in interfaceTypes)
                {
                    var responseType = interfaceType.GetGenericArguments()[1];
                    
                    // Check if response type is Result or Result<T>
                    var isResultType = responseType == typeof(Result) ||
                        (responseType.IsGenericType && responseType.GetGenericTypeDefinition() == typeof(Result<>));

                    isResultType.Should().BeTrue(
                        $"Handler {handlerType.Name} should return Result or Result<T>, but returns {responseType.Name}");
                }
            }
        }
    }

    [Fact]
    public void Handlers_Should_HaveCorrectNaming()
    {
        var assemblies = new[] { _projectsAssembly };

        foreach (var assembly in assemblies)
        {
            var result = Types.InAssembly(assembly)
                .That().ImplementInterface(typeof(IRequestHandler<,>))
                .Should().HaveNameEndingWith("Handler")
                .GetResult();

            result.IsSuccessful.Should().BeTrue(
                $"Handlers with incorrect naming in {assembly.GetName().Name}: {string.Join(", ", result.FailingTypeNames)}");
        }
    }

    [Fact]
    public void Commands_ShouldNot_Contain_DangerousProperties()
    {
        var assemblies = new[] { _projectsAssembly };
        var forbiddenProperties = new[] { "TenantId", "IsDeleted", "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy" };

        foreach (var assembly in assemblies)
        {
            var commandTypes = Types.InAssembly(assembly)
                .That().ImplementInterface(typeof(ICommand<>))
                .Or().ImplementInterface(typeof(ICommand))
                .GetTypes();

            foreach (var commandType in commandTypes)
            {
                var properties = commandType.GetProperties().Select(p => p.Name).ToList();
                var foundForbiddenProps = properties.Intersect(forbiddenProperties).ToList();

                foundForbiddenProps.Should().BeEmpty(
                    $"Command {commandType.Name} contains dangerous properties that could lead to mass assignment attacks: {string.Join(", ", foundForbiddenProps)}");
            }
        }
    }

    [Fact]
    public void Queries_ShouldNot_Contain_DangerousProperties()
    {
        var assemblies = new[] { _projectsAssembly };
        var forbiddenProperties = new[] { "TenantId", "IsDeleted", "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy" };

        foreach (var assembly in assemblies)
        {
            var queryTypes = Types.InAssembly(assembly)
                .That().ImplementInterface(typeof(IQuery<>))
                .GetTypes();

            foreach (var queryType in queryTypes)
            {
                var properties = queryType.GetProperties().Select(p => p.Name).ToList();
                var foundForbiddenProps = properties.Intersect(forbiddenProperties).ToList();

                foundForbiddenProps.Should().BeEmpty(
                    $"Query {queryType.Name} contains dangerous properties: {string.Join(", ", foundForbiddenProps)}");
            }
        }
    }

    [Fact]
    public void ProjectsModule_ShouldNot_DependOn_OtherModules()
    {
        // Projects module should not depend on Bids or other business modules
        // It can depend on Core (shared kernel)
        var forbiddenDeps = new[] { "Pitbull.Bids", "Pitbull.Contracts", "Pitbull.Documents", "Pitbull.Billing", "Pitbull.Portal" };
        foreach (var dep in forbiddenDeps)
        {
            var result = Types.InAssembly(_projectsAssembly)
                .ShouldNot().HaveDependencyOn(dep)
                .GetResult();

            result.IsSuccessful.Should().BeTrue(
                $"Projects module has forbidden dependency on {dep}: {string.Join(", ", result.FailingTypeNames ?? [])}");
        }
    }

    [Fact]
    public void CoreModule_ShouldNot_DependOn_BusinessModules()
    {
        // Core is the shared kernel and should not depend on any business modules
        var forbiddenDeps = new[] { "Pitbull.Projects", "Pitbull.Bids", "Pitbull.Contracts", "Pitbull.Documents", "Pitbull.Billing", "Pitbull.Portal" };
        foreach (var dep in forbiddenDeps)
        {
            var result = Types.InAssembly(_coreAssembly)
                .ShouldNot().HaveDependencyOn(dep)
                .GetResult();

            result.IsSuccessful.Should().BeTrue(
                $"Core module has forbidden dependency on {dep}: {string.Join(", ", result.FailingTypeNames ?? [])}");
        }
    }

    [Fact]
    public void Controllers_Should_OnlyDependOn_AllowedNamespaces()
    {
        // Controllers should only depend on:
        // - MediatR (for sending commands/queries)
        // - Microsoft.AspNetCore (framework)
        // - Domain objects for type safety
        // - Feature contracts (commands/queries)
        var forbiddenDeps = new[] { "System.Data", "Microsoft.EntityFrameworkCore" };
        foreach (var dep in forbiddenDeps)
        {
            var result = Types.InAssembly(_apiAssembly)
                .That().Inherit(typeof(ControllerBase))
                .ShouldNot().HaveDependencyOn(dep)
                .GetResult();

            result.IsSuccessful.Should().BeTrue(
                $"Controllers have forbidden dependency on {dep}: {string.Join(", ", result.FailingTypeNames ?? [])}");
        }
    }

    [Fact]
    public void Handlers_Should_BeSealed()
    {
        // Handlers should be sealed to prevent inheritance issues
        var assemblies = new[] { _projectsAssembly };

        foreach (var assembly in assemblies)
        {
            var handlerTypes = Types.InAssembly(assembly)
                .That().ImplementInterface(typeof(IRequestHandler<,>))
                .GetTypes();

            foreach (var handlerType in handlerTypes)
            {
                handlerType.IsSealed.Should().BeTrue(
                    $"Handler {handlerType.Name} should be sealed to prevent inheritance issues");
            }
        }
    }

    [Fact]
    public void DTOs_Should_BeRecords()
    {
        // DTOs should be records for immutability and value semantics
        var assemblies = new[] { _projectsAssembly };

        foreach (var assembly in assemblies)
        {
            var dtoTypes = Types.InAssembly(assembly)
                .That().HaveNameEndingWith("Dto")
                .GetTypes();

            foreach (var dtoType in dtoTypes)
            {
                // Check if it's a record type (records have a compiler-generated <Clone>$ method)
                var isRecord = dtoType.GetMethods(BindingFlags.Public | BindingFlags.Instance)
                    .Any(m => m.Name == "<Clone>$" || m.Name.Contains("Clone"));

                // Alternative check: records inherit from object and have specific characteristics
                var hasEqualityContract = dtoType.GetProperty("EqualityContract", BindingFlags.NonPublic | BindingFlags.Instance) != null;
                
                (isRecord || hasEqualityContract).Should().BeTrue(
                    $"DTO {dtoType.Name} should be a record for immutability and value semantics");
            }
        }
    }

    [Fact]
    public void Commands_And_Queries_Should_BeRecords()
    {
        // Commands and queries should be records for immutability
        var assemblies = new[] { _projectsAssembly };

        foreach (var assembly in assemblies)
        {
            var commandAndQueryTypes = Types.InAssembly(assembly)
                .That().ImplementInterface(typeof(ICommand<>))
                .Or().ImplementInterface(typeof(ICommand))
                .Or().ImplementInterface(typeof(IQuery<>))
                .GetTypes();

            foreach (var type in commandAndQueryTypes)
            {
                // Check if it's a record type
                var hasEqualityContract = type.GetProperty("EqualityContract", BindingFlags.NonPublic | BindingFlags.Instance) != null;
                
                hasEqualityContract.Should().BeTrue(
                    $"Command/Query {type.Name} should be a record for immutability");
            }
        }
    }
}