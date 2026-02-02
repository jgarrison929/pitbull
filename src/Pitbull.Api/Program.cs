using Pitbull.Api.Features.SeedData;
using Pitbull.Api.Middleware;
using Pitbull.Bids.Features.CreateBid;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.Extensions;
using Pitbull.Core.MultiTenancy;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.RFIs.Features.CreateRfi;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using HealthChecks.UI.Client;
using Serilog;
using FluentValidation;

var builder = WebApplication.CreateBuilder(args);

// Serilog
builder.Host.UseSerilog((context, config) => config
    .ReadFrom.Configuration(context.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console());

// Register module assemblies for EF configuration discovery
PitbullDbContext.RegisterModuleAssembly(typeof(PitbullDbContext).Assembly); // Core module
PitbullDbContext.RegisterModuleAssembly(typeof(CreateProjectCommand).Assembly);
PitbullDbContext.RegisterModuleAssembly(typeof(CreateBidCommand).Assembly);
PitbullDbContext.RegisterModuleAssembly(typeof(CreateRfiCommand).Assembly);

// Core services (DbContext, MediatR, validation, multi-tenancy)
builder.Services.AddPitbullCore(builder.Configuration);

// Module registrations (MediatR handlers + FluentValidation)
builder.Services.AddPitbullModule<CreateProjectCommand>();
builder.Services.AddPitbullModule<CreateBidCommand>();
builder.Services.AddPitbullModule<CreateRfiCommand>();

// Seed data handler (lives in Api assembly)
builder.Services.AddPitbullModule<SeedDataCommand>();

// Auth validators (since auth doesn't use CQRS pattern yet)
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

// ASP.NET Identity
builder.Services.AddIdentity<AppUser, AppRole>(options =>
{
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequiredLength = 8;
    options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores<PitbullDbContext>()
.AddDefaultTokenProviders();

// Prevent Identity cookie auth from redirecting API requests
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = context =>
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    };
});

// JWT Authentication - set JWT Bearer as default scheme so [Authorize]
// returns 401 instead of Identity's cookie 302 redirect
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(
                System.Text.Encoding.UTF8.GetBytes(
                    builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT key not configured")))
        };
    });

builder.Services.AddAuthorization();

// API
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "Pitbull Construction Solutions API",
        Version = "v1",
        Description = "REST API for Pitbull Construction Solutions -- a multi-tenant platform for managing construction projects, bids, contracts, and documents. All endpoints (except auth) require a valid JWT bearer token.",
        Contact = new Microsoft.OpenApi.Models.OpenApiContact
        {
            Name = "Pitbull Dev Team",
            Url = new Uri("https://github.com/jgarrison929/pitbull")
        }
    });

    // JWT Bearer auth definition
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter your token below (do not include 'Bearer ' prefix).",
        Name = "Authorization",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });

    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });

    // Include XML comments from API assembly
    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
        c.IncludeXmlComments(xmlPath);
});

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("Dev", policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());

    options.AddPolicy("Production", policy =>
        policy.WithOrigins(
                builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                ?? Array.Empty<string>())
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials());
});

// Rate limiting
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("auth", opt =>
    {
        opt.PermitLimit = 5;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueLimit = 0;
    });
    
    options.AddFixedWindowLimiter("api", opt =>
    {
        opt.PermitLimit = 60;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueLimit = 2;
    });
    
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = 429;
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { error = "Too many requests. Try again later." }, token);
    };
});

// Health checks with deep dependency checks
builder.Services.AddHealthChecks()
    .AddNpgSql(
        builder.Configuration.GetConnectionString("PitbullDb")!,
        name: "postgresql",
        tags: new[] { "db", "ready" })
    .AddCheck("self", () => HealthCheckResult.Healthy("API is running"), 
        tags: new[] { "live" });

var app = builder.Build();

// Auto-migrate database on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<PitbullDbContext>();
    await db.Database.MigrateAsync();
}

// Global exception handling (must be first in pipeline)
app.UseMiddleware<ExceptionMiddleware>();

// Correlation IDs (must run early so all downstream logs include it)
app.UseMiddleware<CorrelationIdMiddleware>();

// Pipeline
if (app.Environment.IsDevelopment())
{
    app.UseCors("Dev");
}
else
{
    app.UseCors("Production");
}

// Swagger available in all environments for API documentation
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Pitbull API v1");
    c.DocumentTitle = "Pitbull Construction Solutions - API Docs";
});

app.UseSerilogRequestLogging();
app.UseRateLimiter();
app.UseAuthentication();
app.UseMiddleware<TenantMiddleware>();
app.UseAuthorization();
app.MapControllers();

// Health check endpoints with deep dependency checks
app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});

app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("live"),
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});

app.Run();

// Make the implicit Program class accessible for WebApplicationFactory in integration tests
public partial class Program { }
