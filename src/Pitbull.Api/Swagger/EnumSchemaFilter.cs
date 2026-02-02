using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Pitbull.Api.Swagger;

/// <summary>
/// Ensure OpenAPI/Swagger enums are documented as strings to match JSON serialization
/// (JsonStringEnumConverter).
/// </summary>
public sealed class EnumSchemaFilter : ISchemaFilter
{
    public void Apply(OpenApiSchema schema, SchemaFilterContext context)
    {
        if (!context.Type.IsEnum)
            return;

        schema.Type = "string";
        schema.Format = null;
        schema.Enum = Enum.GetNames(context.Type)
            .Select(n => (IOpenApiAny)new OpenApiString(n))
            .ToList();
    }
}
