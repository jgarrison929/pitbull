using Pitbull.Api.Middleware;
using Pitbull.Bids.Features.CreateBid;
using Pitbull.Core.Data;
using Pitbull.Core.Domain;
using Pitbull.Core.Extensions;
using Pitbull.Core.MultiTenancy;
using Pitbull.Projects.Features.CreateProject;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Serilog
builder.Host.UseSerilog((context, config) => config
    .ReadFrom.Configuration(context.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console());

// Register module assemblies for EF configuration discovery
PitbullDbContext.RegisterModuleAssembly(typeof(CreateProjectCommand).Assembly);
PitbullDbContext.RegisterModuleAssembly(typeof(CreateBidCommand).Assembly);

// Core services (DbContext, MediatR, validation, multi-tenancy)
builder.Services.AddPitbullCore(builder.Configuration);

// Module registrations (MediatR handlers + FluentValidation)
builder.Services.AddPitbullModule<CreateProjectCommand>();
builder.Services.AddPitbullModule<CreateBidCommand>();

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
    c.SwaggerDoc("v1", new() { Title = "Pitbull Construction Solutions API", Version = "v1" });
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
    app.UseSwagger();
    app.UseSwaggerUI();
    app.UseCors("Dev");
}
else
{
    app.UseCors("Production");
}

app.UseSerilogRequestLogging();
app.UseAuthentication();
app.UseMiddleware<TenantMiddleware>();
app.UseAuthorization();
app.MapControllers();

// Health check
app.MapGet("/health", () => Results.Ok(new
{
    status = "healthy",
    service = "Pitbull Construction Solutions",
    timestamp = DateTime.UtcNow
}));

app.Run();
