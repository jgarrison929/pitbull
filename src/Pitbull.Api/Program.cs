using Pitbull.Api.Configuration;
using Pitbull.Api.Demo;
using Pitbull.Api.Features.SeedData;
using Pitbull.Api.Infrastructure;
using Pitbull.Api.Middleware;
using Pitbull.Bids.Features.CreateBid;
using Pitbull.RFIs.Features.CreateRfi;
using Pitbull.TimeTracking.Features.CreateTimeEntry;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.Extensions;
using Pitbull.Core.MultiTenancy;
using Pitbull.Projects.Features.CreateProject;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Server.IIS;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using HealthChecks.UI.Client;
using Serilog;
using FluentValidation;

var builder = WebApplication.CreateBuilder(args);

// Validate configuration early to catch issues before startup
EnvironmentValidator.ValidateRequiredConfiguration(builder.Configuration);

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
PitbullDbContext.RegisterModuleAssembly(typeof(CreateTimeEntryCommand).Assembly);

// Core services (DbContext, MediatR, validation, multi-tenancy)
builder.Services.AddPitbullCore(builder.Configuration);

// Demo bootstrap (optional)
builder.Services.Configure<DemoOptions>(builder.Configuration.GetSection(DemoOptions.SectionName));
builder.Services.AddScoped<DemoBootstrapper>();

// Configure forwarded headers for reverse proxy (Railway, Docker, etc.)
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// Module registrations (MediatR handlers + FluentValidation)
builder.Services.AddPitbullModule<CreateProjectCommand>();
builder.Services.AddPitbullModule<CreateBidCommand>();
builder.Services.AddPitbullModule<CreateRfiCommand>();
builder.Services.AddPitbullModule<CreateTimeEntryCommand>(); // TimeTracking module

// Direct service registrations (MediatR migration)
builder.Services.AddPitbullModuleServices<CreateProjectCommand>();
builder.Services.AddPitbullModuleServices<CreateBidCommand>();
builder.Services.AddPitbullModuleServices<CreateRfiCommand>();
builder.Services.AddPitbullModuleServices<CreateTimeEntryCommand>(); // TimeTracking module

// AI Insights service (uses Claude for project analysis)
builder.Services.AddHttpClient("Anthropic");
builder.Services.AddScoped<Pitbull.Api.Services.IAiInsightsService, Pitbull.Api.Services.AiInsightsService>();

// TimeTracking singleton services (don't require DI scope)
builder.Services.AddSingleton<Pitbull.TimeTracking.Services.ILaborCostCalculator, Pitbull.TimeTracking.Services.LaborCostCalculator>();

// Seed data handler (lives in Api assembly)
builder.Services.AddPitbullModule<SeedDataCommand>();

// Auth validators (since auth doesn't use CQRS pattern yet)
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

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

// Role seeder for RBAC
builder.Services.AddScoped<RoleSeeder>();

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

// HTTP Context access for audit fields in DbContext
builder.Services.AddHttpContextAccessor();

// Request size limits for security
builder.Services.Configure<RequestSizeLimitOptions>(
    builder.Configuration.GetSection(RequestSizeLimitOptions.SectionName));
var sizeLimitOptions = builder.Configuration
    .GetSection(RequestSizeLimitOptions.SectionName)
    .Get<RequestSizeLimitOptions>() ?? new RequestSizeLimitOptions();

builder.Services.Configure<IISServerOptions>(options =>
{
    options.MaxRequestBodySize = sizeLimitOptions.GlobalMaxSize;
});
builder.Services.Configure<KestrelServerOptions>(options =>
{
    options.Limits.MaxRequestBodySize = sizeLimitOptions.GlobalMaxSize;
});

// API
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// Request timeouts for security (protection against slow loris attacks)
builder.Services.AddRequestTimeouts(options =>
{
    options.DefaultPolicy = new Microsoft.AspNetCore.Http.Timeouts.RequestTimeoutPolicy
    {
        Timeout = TimeSpan.FromSeconds(30),
        TimeoutStatusCode = 408
    };
    
    // Longer timeout for seed data operations (development only)
    options.AddPolicy("seed", new Microsoft.AspNetCore.Http.Timeouts.RequestTimeoutPolicy
    {
        Timeout = TimeSpan.FromMinutes(2),
        TimeoutStatusCode = 408
    });
});
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
    // Registration: 5 requests per hour (stricter for account creation)
    options.AddFixedWindowLimiter("register", opt =>
    {
        opt.PermitLimit = 5;
        opt.Window = TimeSpan.FromHours(1);
        opt.QueueLimit = 0;
    });
    
    // Login: 10 requests per minute (allows for typos/retries)
    options.AddFixedWindowLimiter("login", opt =>
    {
        opt.PermitLimit = 10;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueLimit = 0;
    });
    
    // General auth fallback (currently unused but could be applied broadly)
    options.AddFixedWindowLimiter("auth", opt =>
    {
        opt.PermitLimit = 5;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueLimit = 0;
    });
    
    // API endpoints: 60 requests per minute
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

// Response compression for better bandwidth utilization
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.BrotliCompressionProvider>();
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.GzipCompressionProvider>();
});

var app = builder.Build();

// Handle forwarded headers from reverse proxy (must be very early)
app.UseForwardedHeaders();

// Auto-migrate database on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<PitbullDbContext>();
    await db.Database.MigrateAsync();

    // Optional: bootstrap the public demo tenant + seed data
    var demoBootstrapper = scope.ServiceProvider.GetRequiredService<DemoBootstrapper>();
    await demoBootstrapper.EnsureSeededIfEnabledAsync();
}

// Global exception handling (must be first in pipeline)
app.UseMiddleware<ExceptionMiddleware>();

// Security headers (early in pipeline for all responses)
app.UseMiddleware<SecurityHeadersMiddleware>();

// Correlation IDs (must run early so all downstream logs include it)
app.UseMiddleware<CorrelationIdMiddleware>();

// Request/response logging for API debugging (after correlation ID)
app.UseMiddleware<RequestResponseLoggingMiddleware>();

// Request size limits (early in pipeline for security)
app.UseMiddleware<RequestSizeLimitMiddleware>();

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

// Response compression (before other middlewares that generate responses)
app.UseResponseCompression();

app.UseSerilogRequestLogging();
app.UseRequestTimeouts();
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
