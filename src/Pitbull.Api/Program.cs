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
using Pitbull.Api.Services;
using Pitbull.Core.Messaging;
using PostHog;
using QuestPDF.Infrastructure;
using Savorboard.CAP.InMemoryMessageQueue;
using Serilog;
using Serilog.Formatting.Json;

var builder = WebApplication.CreateBuilder(args);

// QuestPDF community license
QuestPDF.Settings.License = LicenseType.Community;

// In-memory error store powers the admin health dashboard "recent errors" panel.
var inMemoryErrorStore = new InMemoryErrorLogStore();

// Validate configuration early to catch issues before startup
EnvironmentValidator.ValidateRequiredConfiguration(builder.Configuration, builder.Environment.IsDevelopment());

// Serilog
builder.Host.UseSerilog((context, config) => config
    .ReadFrom.Configuration(context.Configuration)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("Application", "PitbullApi")
    .WriteTo.Console(new JsonFormatter())
    .WriteTo.Sink(new InMemorySerilogErrorSink(inMemoryErrorStore)));

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

// In-memory caching for reference data (chart of accounts, cost codes, etc.)
builder.Services.AddMemoryCache();
builder.Services.AddScoped<Pitbull.Api.Services.ICacheService, Pitbull.Api.Services.CacheService>();

// Core services (DbContext, MediatR, validation, multi-tenancy)
builder.Services.AddPitbullCore(builder.Configuration, builder.Environment);
builder.Services.AddSingleton<IErrorLogStore>(inMemoryErrorStore);
builder.Services.AddSingleton<IRequestMetricsStore, RequestMetricsStore>();
builder.Services.AddScoped<IHealthDashboardService, HealthDashboardService>();

// Persist DataProtection keys to PostgreSQL so encrypted data survives redeploys.
builder.Services.AddDataProtection()
    .PersistKeysToDbContext<PitbullDbContext>()
    .SetApplicationName("Pitbull");

// Field-level encryption for [Encrypted] attribute (uses DataProtection)
builder.Services.AddSingleton<Pitbull.Core.Services.IFieldEncryptionService, Pitbull.Core.Services.FieldEncryptionService>();

// Demo bootstrap and seed data (optional)
builder.Services.Configure<DemoOptions>(builder.Configuration.GetSection(DemoOptions.SectionName));
builder.Services.AddScoped<DemoBootstrapper>();
builder.Services.AddScoped<Pitbull.Api.Features.SeedData.ISeedDataService, Pitbull.Api.Features.SeedData.SeedDataService>();

// Configure forwarded headers for reverse proxy (Railway, Docker, etc.)
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // Only trust the first hop (Railway's edge proxy).
    // Do NOT clear KnownNetworks/KnownProxies — that trusts ALL X-Forwarded-For headers,
    // allowing rate limit bypass via header spoofing.
    options.ForwardLimit = 1;
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

// Weather service (Open-Meteo, no API key required)
builder.Services.AddHttpClient("OpenMeteo", client =>
{
    client.BaseAddress = new Uri("https://api.open-meteo.com/");
    client.Timeout = TimeSpan.FromSeconds(10);
});
builder.Services.AddScoped<Pitbull.Core.Services.Weather.IWeatherService, Pitbull.Core.Services.Weather.WeatherService>();

// AI Invoice Vision Extraction (OpenAI Vision API)
builder.Services.AddScoped<Pitbull.Api.Features.AI.IInvoiceVisionExtractionService, Pitbull.Api.Features.AI.InvoiceVisionExtractionService>();

// AI Insights service (uses Claude for project analysis)
builder.Services.AddScoped<Pitbull.Api.Services.IAiInsightsService, Pitbull.Api.Services.AiInsightsService>();
builder.Services.AddScoped<Pitbull.Api.Services.IRoleService, Pitbull.Api.Services.RoleService>();
builder.Services.AddScoped<Pitbull.Api.Services.IComplianceDocumentService, Pitbull.Api.Services.ComplianceDocumentService>();
builder.Services.AddScoped<Pitbull.Api.Services.IDataImportService, Pitbull.Api.Services.DataImportService>();
builder.Services.AddScoped<Pitbull.Core.Services.IMigrationAcceleratorService, Pitbull.Core.Services.MigrationAcceleratorService>();
builder.Services.AddScoped<Pitbull.Api.Services.IDataExportService, Pitbull.Api.Services.DataExportService>();
builder.Services.AddScoped<Pitbull.Api.Services.IIntegrationExportService, Pitbull.Api.Services.IntegrationExportService>();

// TimeTracking singleton services (don't require DI scope)
builder.Services.AddSingleton<Pitbull.TimeTracking.Services.ILaborCostCalculator, Pitbull.TimeTracking.Services.LaborCostCalculator>();
builder.Services.AddSingleton<Pitbull.TimeTracking.Services.IGeofenceService, Pitbull.TimeTracking.Services.GeofenceService>();

// TimeTracking scoped services (require DbContext)
builder.Services.AddScoped<Pitbull.TimeTracking.Services.IPayPeriodService, Pitbull.TimeTracking.Services.PayPeriodService>();
builder.Services.AddScoped<Pitbull.TimeTracking.Services.IEmployeeService, Pitbull.TimeTracking.Services.EmployeeService>();

// Dashboard service (Core module - migrated from MediatR)
builder.Services.AddScoped<Pitbull.Core.Features.Dashboard.IDashboardService, Pitbull.Core.Features.Dashboard.DashboardService>();
builder.Services.AddScoped<Pitbull.Api.Services.IDashboardAnalyticsService, Pitbull.Api.Services.DashboardAnalyticsService>();
builder.Services.AddScoped<Pitbull.Api.Services.IBriefingService, Pitbull.Api.Services.BriefingService>();
builder.Services.AddScoped<Pitbull.Api.Services.IDashboardPreferencesService, Pitbull.Api.Services.DashboardPreferencesService>();
builder.Services.AddScoped<Pitbull.Api.Services.IPdfReportService, Pitbull.Api.Services.PdfReportService>();
builder.Services.AddScoped<Pitbull.Core.Features.Feedback.IFeedbackService, Pitbull.Core.Features.Feedback.FeedbackService>();
builder.Services.AddScoped<Pitbull.Billing.Features.Aging.IAgingReportService, Pitbull.Billing.Features.Aging.AgingReportService>();
builder.Services.AddScoped<Pitbull.Billing.Features.Wip.IWipGlPostingService, Pitbull.Billing.Features.Wip.WipGlPostingService>();
builder.Services.AddScoped<Pitbull.Billing.Features.BankReconciliation.IBankReconciliationService, Pitbull.Billing.Features.BankReconciliation.BankReconciliationService>();

// Vendor portal service (token-based access for vendors)
builder.Services.AddScoped<Pitbull.Billing.Services.IVendorPortalService, Pitbull.Billing.Services.VendorPortalService>();

// Tax & currency services
builder.Services.AddScoped<Pitbull.Billing.Services.ITaxJurisdictionService, Pitbull.Billing.Services.TaxJurisdictionService>();
builder.Services.AddScoped<Pitbull.Billing.Services.ITaxCalculationService, Pitbull.Billing.Services.TaxCalculationService>();

// Equipment service (Core module - for time entry equipment tracking)
builder.Services.AddScoped<Pitbull.Core.Features.Equipment.IEquipmentService, Pitbull.Core.Features.Equipment.EquipmentService>();

// Cost code service (Core module - for job cost accounting)
builder.Services.AddScoped<Pitbull.Core.Features.CostCode.ICostCodeService, Pitbull.Core.Features.CostCode.CostCodeService>();
builder.Services.AddScoped<Pitbull.Core.Features.ChartOfAccounts.IChartOfAccountService, Pitbull.Core.Features.ChartOfAccounts.ChartOfAccountService>();
builder.Services.AddSingleton<IDocumentStorageProvider, LocalFileSystemDocumentStorageProvider>();
builder.Services.AddScoped<Pitbull.Reports.Services.IReportService, Pitbull.Reports.Services.ReportService>();
builder.Services.AddScoped<Pitbull.Reports.Services.ICostPredictionService, Pitbull.Reports.Services.CostPredictionService>();
builder.Services.AddScoped<Pitbull.Api.Features.CostPredictions.ICostToCompleteService, Pitbull.Api.Features.CostPredictions.CostToCompleteService>();
builder.Services.AddScoped<Pitbull.Api.Features.Workflow.WorkflowTransitionService>();
builder.Services.AddScoped<Pitbull.Core.Services.IWorkflowTransitionService>(sp => sp.GetRequiredService<Pitbull.Api.Features.Workflow.WorkflowTransitionService>());

// Project Management module services
builder.Services.AddScoped<Pitbull.ProjectManagement.Services.IScheduleService, Pitbull.ProjectManagement.Services.ScheduleService>();
builder.Services.AddScoped<Pitbull.ProjectManagement.Services.IJobCostService, Pitbull.ProjectManagement.Services.JobCostService>();
builder.Services.AddScoped<Pitbull.ProjectManagement.Services.ISubmittalService, Pitbull.ProjectManagement.Services.SubmittalService>();
builder.Services.AddScoped<Pitbull.ProjectManagement.Services.IPlansSpecsService, Pitbull.ProjectManagement.Services.PlansSpecsService>();
builder.Services.AddScoped<Pitbull.ProjectManagement.Services.ICommunicationService, Pitbull.ProjectManagement.Services.CommunicationService>();
builder.Services.AddScoped<Pitbull.ProjectManagement.Services.IDailyReportService, Pitbull.ProjectManagement.Services.DailyReportService>();
builder.Services.AddScoped<Pitbull.ProjectManagement.Services.IProgressService, Pitbull.ProjectManagement.Services.ProgressService>();
builder.Services.AddScoped<Pitbull.ProjectManagement.Services.IProjectionService, Pitbull.ProjectManagement.Services.ProjectionService>();
builder.Services.AddScoped<Pitbull.ProjectManagement.Services.IMeetingService, Pitbull.ProjectManagement.Services.MeetingService>();
builder.Services.AddScoped<Pitbull.ProjectManagement.Services.IDocumentGenerationService, Pitbull.ProjectManagement.Services.DocumentGenerationService>();
builder.Services.AddScoped<Pitbull.ProjectManagement.Services.ITaskService, Pitbull.ProjectManagement.Services.TaskService>();
builder.Services.AddScoped<Pitbull.ProjectManagement.Services.INarrativeService, Pitbull.ProjectManagement.Services.NarrativeService>();
builder.Services.AddScoped<Pitbull.ProjectManagement.Services.IDocumentService, Pitbull.ProjectManagement.Services.DocumentService>();
builder.Services.AddScoped<Pitbull.ProjectManagement.Services.IPunchListService, Pitbull.ProjectManagement.Services.PunchListService>();

// Blob storage — provider-based (local filesystem or S3/MinIO)
{
    var blobSection = builder.Configuration.GetSection(Pitbull.Core.Services.BlobStorage.BlobStorageOptions.SectionName);
    builder.Services.Configure<Pitbull.Core.Services.BlobStorage.BlobStorageOptions>(blobSection);

    // Allow env vars to override config
    var blobOptions = new Pitbull.Core.Services.BlobStorage.BlobStorageOptions();
    blobSection.Bind(blobOptions);
    var provider = Environment.GetEnvironmentVariable("BLOB_PROVIDER") ?? blobOptions.Provider;

    if (string.Equals(provider, "s3", StringComparison.OrdinalIgnoreCase))
    {
        var bucket = Environment.GetEnvironmentVariable("S3_BUCKET") ?? blobOptions.S3Bucket;
        var region = Environment.GetEnvironmentVariable("S3_REGION") ?? blobOptions.S3Region ?? "us-east-1";
        var accessKey = Environment.GetEnvironmentVariable("S3_ACCESS_KEY") ?? blobOptions.S3AccessKey;
        var secretKey = Environment.GetEnvironmentVariable("S3_SECRET_KEY") ?? blobOptions.S3SecretKey;
        var endpoint = Environment.GetEnvironmentVariable("S3_ENDPOINT") ?? blobOptions.S3Endpoint;

        // Propagate env var overrides into the options so S3BlobService sees them
        builder.Services.PostConfigure<Pitbull.Core.Services.BlobStorage.BlobStorageOptions>(opts =>
        {
            opts.Provider = "s3";
            opts.S3Bucket = bucket;
            opts.S3Region = region;
            opts.S3AccessKey = accessKey;
            opts.S3SecretKey = secretKey;
            opts.S3Endpoint = endpoint;
        });

        var s3Config = new Amazon.S3.AmazonS3Config
        {
            RegionEndpoint = Amazon.RegionEndpoint.GetBySystemName(region),
        };

        if (!string.IsNullOrEmpty(endpoint))
        {
            s3Config.ServiceURL = endpoint;
            s3Config.ForcePathStyle = true; // Required for MinIO
        }

        builder.Services.AddSingleton<Amazon.S3.IAmazonS3>(_ =>
            new Amazon.S3.AmazonS3Client(
                new Amazon.Runtime.BasicAWSCredentials(accessKey, secretKey), s3Config));
        builder.Services.AddSingleton<Pitbull.Core.Services.BlobStorage.IBlobStorageService, Pitbull.Storage.S3BlobService>();
    }
    else
    {
        builder.Services.AddSingleton<Pitbull.Core.Services.BlobStorage.IBlobStorageService, Pitbull.Core.Services.BlobStorage.LocalFileSystemBlobService>();
    }
}

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

// Deadline notification background service — checks RFI/Submittal deadlines hourly
builder.Services.Configure<Pitbull.Api.Services.DeadlineCheckOptions>(
    builder.Configuration.GetSection(Pitbull.Api.Services.DeadlineCheckOptions.SectionName));
builder.Services.AddScoped<Pitbull.Api.Services.IDeadlineNotificationTracker, Pitbull.Api.Services.DeadlineNotificationTracker>();
builder.Services.AddHostedService<Pitbull.Api.Services.DeadlineCheckService>();

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
builder.Services.AddScoped<Pitbull.SystemAdmin.Services.ISecretVaultService, Pitbull.SystemAdmin.Services.SecretVaultService>();

// Diagnostics service (production error tracking)
builder.Services.AddScoped<Pitbull.Api.Services.IDiagnosticsService, Pitbull.Api.Services.DiagnosticsService>();

// Secrets management service (auditable config access for sensitive values)
builder.Services.AddSingleton<Pitbull.Api.Services.ISecretsService, Pitbull.Api.Services.SecretsService>();

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

// Permission-based authorization handler (RBAC)
builder.Services.AddSingleton<Microsoft.AspNetCore.Authorization.IAuthorizationHandler, PermissionAuthorizationHandler>();

builder.Services.AddAuthorization(options =>
{
    // Register a policy for each permission in the system.
    // Controllers use [Authorize(Policy = "Admin.Users")] etc.
    foreach (var permission in Pitbull.Core.Constants.PermissionConstants.All)
    {
        options.AddPolicy(permission, policy =>
            policy.Requirements.Add(new PermissionRequirement(permission)));
    }
});

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
var redisConn = builder.Configuration.GetValue<string>("EventBus:Redis:ConnectionString");
builder.Services.AddCap(x =>
{
    // Outbox: always use PostgreSQL (same DB as the app)
    x.UsePostgreSql(opt =>
    {
        opt.ConnectionString = builder.Configuration.GetConnectionString("PitbullDb")!;
        opt.Schema = "cap";
    });

    // Transport: Redis Streams if configured, else in-memory
    if (!string.IsNullOrEmpty(redisConn))
    {
        x.UseRedis(redisConn);
    }
    else
    {
        x.UseInMemoryMessageQueue();
    }

    if (builder.Environment.IsDevelopment())
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
builder.Services.AddControllers(options =>
    {
        options.Filters.Add<Pitbull.Api.Infrastructure.ClampPageSizeFilter>();
    })
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

    // Longer timeout for seed data operations (needed in all environments
    // because SeedDataController references the policy via attribute)
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
        Title = "Pitbull Construction Solutions \u2014 API Reference",
        Version = "v1",
        Description = "RESTful API for AI-native construction ERP. Multi-tenant, role-based access control, real-time event bus. " +
                      "Covers the full construction lifecycle: bids, projects, contracts, billing (AIA G702/G703), " +
                      "time tracking, payroll, RFIs, submittals, and AI-powered document intelligence.",
        Contact = new Microsoft.OpenApi.Models.OpenApiContact
        {
            Name = "Pitbull Construction Solutions",
            Email = "joshuag@pitbullconstructionsolutions.com",
            Url = new Uri("https://pitbullconstructionsolutions.com")
        },
        License = new Microsoft.OpenApi.Models.OpenApiLicense
        {
            Name = "Proprietary"
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

    // Demo registration: 10 signups per hour per IP
    options.AddPolicy("demo-register", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromHours(1),
                QueueLimit = 0
            }));

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

    options.AddPolicy("ai-invoice", context =>
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

    // Vendor portal: 30 requests per minute per IP (public, anonymous)
    options.AddPolicy("portal", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
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
var healthChecks = builder.Services.AddHealthChecks()
    .AddNpgSql(
        builder.Configuration.GetConnectionString("PitbullDb")!,
        name: "postgresql",
        tags: new[] { "db", "ready" })
    .AddCheck("self", () => HealthCheckResult.Healthy("API is running"),
        tags: new[] { "live" });

if (!string.IsNullOrEmpty(redisConn))
    healthChecks.AddRedis(redisConn, name: "redis", tags: new[] { "ready" });

// Response compression for better bandwidth utilization
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.BrotliCompressionProvider>();
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.GzipCompressionProvider>();
});

var app = builder.Build();

// Log CAP transport selection for operational visibility
app.Logger.LogInformation("CAP transport: {Transport}", string.IsNullOrEmpty(redisConn) ? "InMemory" : "Redis");

// Register field encryption service for [Encrypted] attribute auto-discovery in DbContext
PitbullDbContext.RegisterEncryptionService(
    app.Services.GetRequiredService<Pitbull.Core.Services.IFieldEncryptionService>());

// Handle forwarded headers from reverse proxy (must be very early)
app.UseForwardedHeaders();
app.UseSerilogRequestLogging();

// Auto-migrate database on startup (skipped in integration tests where
// PostgresFixture applies migrations once to avoid parallel race conditions).
if (!string.Equals(app.Configuration["SkipMigrations"], "true", StringComparison.OrdinalIgnoreCase))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<PitbullDbContext>();
    var roleSeeder = scope.ServiceProvider.GetRequiredService<RoleSeeder>();
    await db.Database.MigrateAsync();

    // Optional: bootstrap the public demo tenant + seed data
    try
    {
        var demoBootstrapper = scope.ServiceProvider.GetRequiredService<DemoBootstrapper>();
        await demoBootstrapper.EnsureSeededIfEnabledAsync();
    }
    catch (Exception ex)
    {
        var startupLogger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        startupLogger.LogWarning(ex, "DemoBootstrapper failed — skipping seed refresh. App continues normally.");
    }

    // Development-only: ensure dev admin has Admin role (idempotent startup seed)
    if (app.Environment.IsDevelopment())
    {
        await roleSeeder.EnsureAdminForEmailAsync("jgarrison929@gmail.com");
    }
}

// Correlation IDs (outermost — so all downstream logs and responses include it)
app.UseMiddleware<CorrelationIdMiddleware>();

// Security headers (before exception handler so error responses also get CSP, HSTS, X-Frame-Options)
app.UseMiddleware<SecurityHeadersMiddleware>();

// Global exception handling (catches all downstream exceptions)
app.UseMiddleware<ExceptionMiddleware>();
app.UseMiddleware<RequestMetricsMiddleware>();

// Request performance tracking (slow requests, N+1 detection — sends to PostHog)
app.UseMiddleware<RequestPerformanceMiddleware>();

// Request size limits (before body-reading middleware to reject oversized payloads early)
app.UseMiddleware<RequestSizeLimitMiddleware>();

// Request/response logging for API debugging (after size limits, has correlation ID context)
app.UseMiddleware<RequestResponseLoggingMiddleware>();

// Pipeline
if (app.Environment.IsDevelopment())
{
    app.UseCors("Dev");
}
else
{
    app.UseCors("Production");
}

// Swagger — available in all environments, gated by ApiDocs:Enabled + ApiDocs:RequireAuth
app.UseMiddleware<Pitbull.Api.Middleware.SwaggerAuthMiddleware>();
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Pitbull API v1");
    c.DocumentTitle = "Pitbull Construction Solutions \u2014 API Reference";
});

// Response compression (before other middlewares that generate responses)
app.UseResponseCompression();

app.UseRequestTimeouts();
app.UseAuthentication();
// Demo restriction MUST run after auth (needs claims) but before authorization
// to prevent demo users from reaching admin endpoints
if (app.Configuration.GetValue<bool>("Demo:Enabled"))
    app.UseMiddleware<Pitbull.Api.Middleware.DemoRestrictionMiddleware>();
app.UseAuthorization();
app.UseRateLimiter();
app.UseMiddleware<TenantMiddleware>();
app.UseMiddleware<Pitbull.Core.MultiTenancy.CompanyMiddleware>();
app.MapControllers();

// Capture 404s on /api/ routes as diagnostic errors (after endpoint routing)
app.UseMiddleware<ApiNotFoundMiddleware>();

// Health check endpoints
// /health/live is unauthenticated (k8s liveness probe) — minimal output, no infrastructure details
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("live"),
});

// /health and /health/ready expose component details — require auth
app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
}).RequireAuthorization();

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
}).RequireAuthorization();

app.Run();

// Make the implicit Program class accessible for WebApplicationFactory in integration tests
public partial class Program { }
