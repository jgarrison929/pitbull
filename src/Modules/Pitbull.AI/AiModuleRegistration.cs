using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Pitbull.AI.Providers;
using Pitbull.AI.Services;
using Pitbull.AI.Services.Handlers;

namespace Pitbull.AI;

public static class AiModuleRegistration
{
    public static IServiceCollection AddPitbullAiModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddHttpClient("Anthropic", client =>
        {
            client.BaseAddress = new Uri("https://api.anthropic.com/");
            client.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");
        });

        services.AddHttpClient("OpenAI", client =>
        {
            client.BaseAddress = new Uri("https://api.openai.com/");
        });

        services.AddScoped<IAiProvider, AnthropicProvider>();
        services.AddScoped<IAiProvider, OpenAiProvider>();

        // Feature handlers (discovered via IEnumerable<IAiFeatureHandler>)
        services.AddScoped<IAiFeatureHandler, InvoiceExtractionHandler>();
        services.AddScoped<IAiFeatureHandler, SmartFieldHandler>();
        services.AddScoped<IAiFeatureHandler, CostPredictionHandler>();

        // Orchestrator (routes feature requests to handlers)
        services.AddScoped<IAiOrchestrator, AiOrchestrator>();

        return services;
    }
}
