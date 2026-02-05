using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;
using Pitbull.Core.MultiTenancy;

namespace Pitbull.Core.Extensions;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Register all Pitbull Core services: DbContext, MediatR, validation, multi-tenancy.
    /// </summary>
    public static IServiceCollection AddPitbullCore(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // PostgreSQL + EF Core
        services.AddDbContext<PitbullDbContext>(options =>
            options.UseNpgsql(
                configuration.GetConnectionString("PitbullDb"),
                npgsql =>
                {
                    npgsql.MigrationsAssembly("Pitbull.Api");
                    npgsql.EnableRetryOnFailure(3);
                }));

        // Multi-tenancy
        services.AddScoped<TenantContext>();
        services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());

        // MediatR + pipeline behaviors
        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblyContaining<PitbullDbContext>();
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });

        // FluentValidation - auto-register validators from all loaded assemblies
        services.AddValidatorsFromAssemblyContaining<PitbullDbContext>();

        return services;
    }

    /// <summary>
    /// Register a module's MediatR handlers and validators.
    /// Call this for each module (Projects, Bids, etc).
    /// </summary>
    public static IServiceCollection AddPitbullModule<TAssemblyMarker>(
        this IServiceCollection services)
    {
        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssemblyContaining<TAssemblyMarker>());
        services.AddValidatorsFromAssemblyContaining<TAssemblyMarker>();
        return services;
    }

    /// <summary>
    /// Register a module's direct services (replacing MediatR handlers).
    /// Use during MediatR migration to register both patterns side-by-side.
    /// </summary>
    public static IServiceCollection AddPitbullModuleServices<TAssemblyMarker>(
        this IServiceCollection services)
    {
        // Auto-register all services implementing interfaces in the assembly
        var assembly = typeof(TAssemblyMarker).Assembly;
        
        var serviceTypes = assembly.GetTypes()
            .Where(type => type.IsClass && !type.IsAbstract)
            .Where(type => type.GetInterfaces().Any(i => 
                i.Name.EndsWith("Service") && i.IsPublic))
            .ToArray();

        foreach (var serviceType in serviceTypes)
        {
            var serviceInterface = serviceType.GetInterfaces()
                .FirstOrDefault(i => i.Name.EndsWith("Service") && i.IsPublic);

            if (serviceInterface != null)
            {
                services.AddScoped(serviceInterface, serviceType);
            }
        }

        // Still register validators - needed for the service implementations
        services.AddValidatorsFromAssemblyContaining<TAssemblyMarker>();
        
        return services;
    }
}
