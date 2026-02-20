using FluentValidation;
using HealthChecks.UI.Client;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Server.IIS;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Pitbull.Api.Configuration;
using Pitbull.Api.Demo;
using Pitbull.Api.Features.SeedData;
using Pitbull.Api.Infrastructure;
using Pitbull.Api.Middleware;
using Pitbull.Bids.Features.CreateBid;
using Pitbull.Contracts.Features.CreateSubcontract;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.Extensions;
using Pitbull.Core.MultiTenancy;
using Pitbull.Projects.Features.CreateProject;
using Pitbull.ProjectManagement.Features;
using Pitbull.AI;
using Pitbull.AI.Features;
using Pitbull.RFIs.Features.CreateRfi;
using Pitbull.TimeTracking.Features.CreateTimeEntry;
using Pitbull.ProjectManagement.Storage;
using Pitbull.Billing.Features;
using Pitbull.Api.Data;
using Pitbull.Core.Messaging;
using PostHog;
using QuestPDF.Infrastructure;
using Savorboard.CAP.InMemoryMessageQueue;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// QuestPDF community license
QuestPDF.Settings.License = LicenseType.Community;

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
PitbullDbContext.RegisterModuleAssembly(typeof(CreateSubcontractCommand).Assembly);
PitbullDbContext.RegisterModuleAssembly(typeof(CreateProjectManagementModuleCommand).Assembly);
PitbullDbContext.RegisterModuleAssembly(typeof(CreateAiModuleCommand).Assembly);
PitbullDbContext.RegisterModuleAssembly(typeof(Pitbull.Documents.Features.DocumentsModuleMarker).Assembly);
PitbullDbContext.RegisterModuleAssembly(typeof(Pitbull.Notifications.Features.NotificationsModuleMarker).Assembly);
PitbullDbContext.RegisterModuleAssembly(typeof(Pitbull.SystemAdmin.Features.SystemAdminModuleMarker).Assembly);
PitbullDbContext.RegisterModuleAssembly(typeof(BillingModuleMarker).Assembly);

// PostHog server-side analytics (optional — only if API key is configured)
if (!string.IsNullOrEmpty(builder.Configuration["PostHog:ProjectApiKey"]))
{
    builder.AddPostHog();
}

// Core services (DbContext, MediatR, validation, multi-tenancy)
builder.Services.AddPitbullCore(builder.Configuration, builder.Environment);

// Persist DataProtection keys to PostgreSQL so encrypted data survives redeploys.
builder.Services.AddDataProtection()
    .PersistKeysToDbContext<PitbullDbContext>()
    .SetApplicationName("Pitbull");

// Demo bootstrap and seed data (optional)
builder.Services.Configure<DemoOptions>(builder.Configuration.GetSection(DemoOptions.SectionName));
builder.Services.AddScoped<DemoBootstrapper>();
builder.Services.AddScoped<Pitbull.Api.Features.SeedData.ISeedDataService, Pitbull.Api.Features.SeedData.SeedDataService>();

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
builder.Services.AddPitbullModule<CreateSubcontractCommand>(); // Contracts module
builder.Services.AddPitbullModule<CreateProjectManagementModuleCommand>(); // ProjectManagement module
builder.Services.AddPitbullModule<CreateAiModuleCommand>(); // AI module
builder.Services.AddPitbullModule<BillingModuleMarker>(); // Billing module

// Direct service registrations (MediatR migration)
builder.Services.AddPitbullModuleServices<CreateProjectCommand>();
builder.Services.AddPitbullModuleServices<CreateBidCommand>();
builder.Services.AddPitbullModuleServices<CreateRfiCommand>();
builder.Services.AddPitbullModuleServices<CreateTimeEntryCommand>(); // TimeTracking module
builder.Services.AddPitbullModuleServices<CreateSubcontractCommand>(); // Contracts module
builder.Services.AddPitbullModuleServices<CreateProjectManagementModuleCommand>(); // ProjectManagement module
builder.Services.AddPitbullModuleServices<CreateAiModuleCommand>(); // AI module
builder.Services.AddPitbullModuleServices<BillingModuleMarker>(); // Billing module

// AI module registration (providers + HttpClients)
builder.Services.AddPitbullAiModule(builder.Configuration);

// AI Insights service (uses Claude for project analysis)
builder.Services.AddScoped<Pitbull.Api.Services.IAiInsightsService, Pitbull.Api.Services.AiInsightsService>();
builder.Services.AddScoped<Pitbull.Api.Services.IRoleService, Pitbull.Api.Services.RoleService>();
builder.Services.AddScoped<Pitbull.Api.Services.IComplianceDocumentService, Pitbull.Api.Services.ComplianceDocumentService>();
builder.Services.AddScoped<Pitbull.Api.Services.IDataImportService, Pitbull.Api.Services.DataImportService>();
builder.Services.AddScoped<Pitbull.Api.Services.IDataExportService, Pitbull.Api.Services.DataExportService>();

// TimeTracking singleton services (don't require DI scope)
builder.Services.AddSingleton<Pitbull.TimeTracking.Services.ILaborCostCalculator, Pitbull.TimeTracking.Services.LaborCostCalculator>();

// TimeTracking scoped services (require DbContext)
builder.Services.AddScoped<Pitbull.TimeTracking.Services.IPayPeriodService, Pitbull.TimeTracking.Services.PayPeriodService>();
builder.Services.AddScoped<Pitbull.TimeTracking.Services.IEmployeeService, Pitbull.TimeTracking.Services.EmployeeService>();

// Dashboard service (Core module - migrated from MediatR)
builder.Services.AddScoped<Pitbull.Core.Features.Dashboard.IDashboardService, Pitbull.Core.Features.Dashboard.DashboardService>();
builder.Services.AddScoped<Pitbull.Api.Services.IDashboardAnalyticsService, Pitbull.Api.Services.DashboardAnalyticsService>();
builder.Services.AddScoped<Pitbull.Api.Services.IPdfReportService, Pitbull.Api.Services.PdfReportService>();
builder.Services.AddScoped<Pitbull.Billing.Features.Aging.IAgingReportService, Pitbull.Billing.Features.Aging.AgingReportService>();
builder.Services.AddScoped<Pitbull.Billing.Features.Wip.IWipGlPostingService, Pitbull.Billing.Features.Wip.WipGlPostingService>();

// Equipment service (Core module - for time entry equipment tracking)
builder.Services.AddScoped<Pitbull.Core.Features.Equipment.IEquipmentService, Pitbull.Core.Features.Equipment.EquipmentService>();

// Cost code service (Core module - for job cost accounting)
builder.Services.AddScoped<Pitbull.Core.Features.CostCode.ICostCodeService, Pitbull.Core.Features.CostCode.CostCodeService>();
builder.Services.AddScoped<Pitbull.Core.Features.ChartOfAccounts.IChartOfAccountService, Pitbull.Core.Features.ChartOfAccounts.ChartOfAccountService>();
builder.Services.AddSingleton<IDocumentStorageProvider, LocalFileSystemDocumentStorageProvider>();
builder.Services.AddScoped<Pitbull.Reports.Services.IReportService, Pitbull.Reports.Services.ReportService>();

// Documents module (file attachments)
builder.Services.AddSingleton<Pitbull.Documents.Services.IFileValidationService, Pitbull.Documents.Services.FileValidationService>();
builder.Services.AddScoped<Pitbull.Documents.Services.IFileStorageService, Pitbull.Documents.Services.FileStorageService>();

// Notifications module — decorator adds fire-and-forget email on notification creation
builder.Services.AddScoped<Pitbull.Notifications.Services.NotificationService>();
builder.Services.AddScoped<Pitbull.Notifications.Services.INotificationService>(sp =>
    new Pitbull.Api.Services.EmailNotificationDecorator(
        sp.GetRequiredService<Pitbull.Notifications.Services.NotificationService>(),
        sp.GetRequiredService<Pitbull.Api.Services.IEmailService>(),
        sp.GetRequiredService<Pitbull.Api.Services.INotificationPreferenceService>(),
        sp.GetRequiredService<Pitbull.Core.Data.PitbullDbContext>(),
        sp.GetRequiredService<ILogger<Pitbull.Api.Services.EmailNotificationDecorator>>()));
builder.Services.AddScoped<Pitbull.Api.Services.INotificationPreferenceService, Pitbull.Api.Services.NotificationPreferenceService>();

// Audit interceptor for automatic change tracking via EF SaveChanges
builder.Services.AddScoped<AuditInterceptor>();
builder.Services.AddScoped<Microsoft.EntityFrameworkCore.Diagnostics.ISaveChangesInterceptor>(
    sp => sp.GetRequiredService<AuditInterceptor>());

// PostHog DB performance interceptor (slow query tracking, N+1 detection)
builder.Services.AddScoped<Pitbull.Api.Infrastructure.PostHogDbInterceptor>();
builder.Services.AddScoped<Microsoft.EntityFrameworkCore.Diagnostics.DbCommandInterceptor>(
    sp => sp.GetRequiredService<Pitbull.Api.Infrastructure.PostHogDbInterceptor>());

// SystemAdmin module services
builder.Services.AddScoped<Pitbull.SystemAdmin.Services.ITenantSettingsService, Pitbull.SystemAdmin.Services.TenantSettingsService>();
builder.Services.AddScoped<Pitbull.SystemAdmin.Services.IApiKeyService, Pitbull.SystemAdmin.Services.ApiKeyService>();
builder.Services.AddScoped<Pitbull.SystemAdmin.Services.ISystemHealthService, Pitbull.SystemAdmin.Services.SystemHealthService>();

// Diagnostics service (production error tracking)
builder.Services.AddScoped<Pitbull.Api.Services.IDiagnosticsService, Pitbull.Api.Services.DiagnosticsService>();

// Email service: Resend in production, console stub in development
var resendApiKey = builder.Configuration["Email:Resend:ApiKey"];
if (string.IsNullOrWhiteSpace(resendApiKey))
    resendApiKey = Environment.GetEnvironmentVariable("RESEND_API_KEY");

if (!string.IsNullOrWhiteSpace(resendApiKey))
{
    builder.Services.AddOptions();
    builder.Services.AddHttpClient<Resend.ResendClient>();
    builder.Services.Configure<Resend.ResendClientOptions>(o => o.ApiToken = resendApiKey);
    builder.Services.AddTransient<Resend.IResend, Resend.ResendClient>();
    builder.Services.AddScoped<Pitbull.Api.Services.IEmailService, Pitbull.Api.Services.ResendEmailService>();
}
else
{
    builder.Services.AddScoped<Pitbull.Api.Services.IEmailService, Pitbull.Api.Services.ConsoleEmailService>();
}
builder.Services.AddScoped<Pitbull.Api.Services.ITenantProvisioningService, Pitbull.Api.Services.TenantProvisioningService>();
builder.Services.AddScoped<Pitbull.Api.Services.ITeamInvitationService, Pitbull.Api.Services.TeamInvitationService>();
builder.Services.AddScoped<Pitbull.Api.Services.IOnboardingService, Pitbull.Api.Services.OnboardingService>();
builder.Services.AddScoped<Pitbull.Api.Services.IWelcomeService, Pitbull.Api.Services.WelcomeService>();

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

// CAP event bus — PostgreSQL outbox + Redis Streams transport (in-memory fallback for local dev)
builder.Services.AddCap(x =>
{
    // Outbox: always use PostgreSQL (same DB as the app)
    x.UsePostgreSql(opt =>
    {
        opt.ConnectionString = builder.Configuration.GetConnectionString("PitbullDb")!;
        opt.Schema = "cap";
    });

    // Transport: Redis Streams if configured, else in-memory
    var redisConn = builder.Configuration.GetValue<string>("EventBus:Redis:ConnectionString");
    if (!string.IsNullOrEmpty(redisConn))
    {
        x.UseRedis(redisConn);
    }
    else
    {
        x.UseInMemoryMessageQueue();
    }

    x.UseDashboard(d => d.PathMatch = "/cap");
    x.FailedRetryCount = 5;
    x.JsonSerializerOptions.PropertyNamingPolicy = null;
});

// CAP subscriber filter for multi-tenant context propagation
// (CAP auto-discovers SubscribeFilter implementations from DI)
builder.Services.AddTransient<TenantCapFilter>();

// Register CAP subscribers (consumers) so DI can inject their dependencies
builder.Services.AddTransient<Pitbull.TimeTracking.Consumers.TimeEntriesSubmittedConsumer>();
builder.Services.AddTransient<Pitbull.TimeTracking.Consumers.TimeEntriesDraftSavedConsumer>();

// API
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
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

    // AI endpoints: per-user rate limits (keyed by user ID from JWT, fallback to IP)
    options.AddPolicy("ai-chat", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                ?? context.Connection.RemoteIpAddress?.ToString()
                ?? "anonymous",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    options.AddPolicy("ai-document", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                ?? context.Connection.RemoteIpAddress?.ToString()
                ?? "anonymous",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    options.AddPolicy("ai-suggest", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                ?? context.Connection.RemoteIpAddress?.ToString()
                ?? "anonymous",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

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

// Auto-migrate database on startup (skipped in integration tests where
// PostgresFixture applies migrations once to avoid parallel race conditions).
if (!string.Equals(app.Configuration["SkipMigrations"], "true", StringComparison.OrdinalIgnoreCase))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<PitbullDbContext>();
    var roleSeeder = scope.ServiceProvider.GetRequiredService<RoleSeeder>();
    await db.Database.MigrateAsync();

    // Optional: bootstrap the public demo tenant + seed data
    var demoBootstrapper = scope.ServiceProvider.GetRequiredService<DemoBootstrapper>();
    await demoBootstrapper.EnsureSeededIfEnabledAsync();

    // Ensure Josh has Admin role on his existing tenant (idempotent startup seed)
    await roleSeeder.EnsureAdminForEmailAsync("jgarrison929@gmail.com");
}

// Global exception handling (must be first in pipeline)
app.UseMiddleware<ExceptionMiddleware>();

// Request performance tracking (slow requests, N+1 detection — sends to PostHog)
app.UseMiddleware<RequestPerformanceMiddleware>();

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
app.UseMiddleware<Pitbull.Core.MultiTenancy.CompanyMiddleware>();
app.UseAuthorization();
app.MapControllers();

// Capture 404s on /api/ routes as diagnostic errors (after endpoint routing)
app.UseMiddleware<ApiNotFoundMiddleware>();

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
