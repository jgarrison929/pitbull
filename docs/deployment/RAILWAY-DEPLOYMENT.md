# Railway Deployment Setup - Dev & Staging Environments

## Task: Wire in Railway Dev and Staging Environments

**Project:** `pretty-communication` (pitbull) on Railway
**Goal:** Set up automated deployments for development and staging branches

## Environment Setup

### Custom Domain Configuration
**DNS Requirements:**
- `duke.pitbullconstructionsolutions.com` → Railway dev service
- `theo.pitbullconstructionsolutions.com` → Railway staging service  
- `demo.pitbullconstructionsolutions.com` → Railway demo service
- `app.pitbullconstructionsolutions.com` → Railway production service
- All need CNAME records pointing to Railway's domain
- SSL certificates auto-provisioned by Railway

### Development Environment
- **Branch:** `develop`  
- **Railway Service:** `pitbull-dev`
- **Database:** PostgreSQL (dev instance)
- **Domain:** `duke.pitbullconstructionsolutions.com`

### Staging Environment  
- **Branch:** `staging`
- **Railway Service:** `pitbull-staging`
- **Database:** PostgreSQL (staging instance) 
- **Domain:** `theo.pitbullconstructionsolutions.com`

### Demo Environment
- **Branch:** `main` (or `demo` branch)
- **Railway Service:** `pitbull-demo`
- **Database:** PostgreSQL (demo instance with sample data)
- **Domain:** `demo.pitbullconstructionsolutions.com`

### Production Environment
- **Branch:** `main` (manual promotion)
- **Railway Service:** `pitbull-production`
- **Database:** PostgreSQL (production instance)
- **Domain:** `app.pitbullconstructionsolutions.com`

## Implementation Steps

### 1. Railway Project Configuration
```bash
# Connect to existing Railway project
railway login
railway link pretty-communication

# Create services for each environment
railway service create pitbull-dev
railway service create pitbull-staging
railway service create pitbull-demo
railway service create pitbull-production
```

### 2. Database Setup
```bash
# Add PostgreSQL to each environment
railway add postgresql --environment dev
railway add postgresql --environment staging
railway add postgresql --environment demo
railway add postgresql --environment production

# Generate connection strings
railway variables --environment dev
railway variables --environment staging
railway variables --environment demo
railway variables --environment production
```

### 3. Environment Variables
**Common variables needed:**
```
DATABASE_URL=postgresql://...
ASPNETCORE_ENVIRONMENT=Development|Staging
JWT_SECRET=...
CORS_ORIGINS=https://duke.pitbullconstructionsolutions.com,https://theo.pitbullconstructionsolutions.com,https://demo.pitbullconstructionsolutions.com,https://app.pitbullconstructionsolutions.com
FRONTEND_URL=...
```

### 4. Custom Domain Setup
```bash
# Configure custom domains in Railway
railway domain add duke.pitbullconstructionsolutions.com --service pitbull-dev
railway domain add theo.pitbullconstructionsolutions.com --service pitbull-staging
railway domain add demo.pitbullconstructionsolutions.com --service pitbull-demo
railway domain add app.pitbullconstructionsolutions.com --service pitbull-production

# Verify SSL certificate provisioning
railway domain list
```

## ⚠️ CLOUDFLARE DNS CONFIGURATION REQUIRED

**Critical:** These DNS changes must be made in Cloudflare for `pitbullconstructionsolutions.com`:

```bash
# Add these CNAME records in Cloudflare DNS dashboard:

duke     CNAME    pitbull-dev.up.railway.app         (Proxy status: DNS only)
theo     CNAME    pitbull-staging.up.railway.app     (Proxy status: DNS only)  
demo     CNAME    pitbull-demo.up.railway.app        (Proxy status: DNS only)
app      CNAME    pitbull-production.up.railway.app  (Proxy status: DNS only)
```

**IMPORTANT:** Set Proxy Status to **"DNS only"** (gray cloud) initially to avoid SSL cert issues. Can enable proxy (orange cloud) after Railway SSL is working.

**Cloudflare Access Required:**
- Login: `https://dash.cloudflare.com`
- Domain: `pitbullconstructionsolutions.com` 
- Navigate to: DNS → Records → Add record
- **TTL:** Auto or 300 seconds for faster propagation during setup

### 5. Deployment Configuration
**railway.json** or **railway.toml:**
```toml
[build]
builder = "dockerfile"
buildCommand = "dotnet publish -c Release -o out"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"

[environments.dev]
source = "develop"
variables = { ASPNETCORE_ENVIRONMENT = "Development" }

[environments.staging] 
source = "staging"
variables = { ASPNETCORE_ENVIRONMENT = "Staging" }
```

### 5. GitHub Actions Integration
**Update .github/workflows/deploy.yml:**
```yaml
deploy-dev:
  if: github.ref == 'refs/heads/develop'
  runs-on: ubuntu-latest
  steps:
    - name: Deploy to Railway Dev
      run: |
        railway deploy --service pitbull-dev --environment dev

deploy-staging:
  if: github.ref == 'refs/heads/staging'  
  runs-on: ubuntu-latest
  steps:
    - name: Deploy to Railway Staging
      run: |
        railway deploy --service pitbull-staging --environment staging
```

### 6. Database Migrations
**Ensure migrations run automatically:**
```csharp
// In Program.cs or startup
if (app.Environment.IsDevelopment() || app.Environment.IsStaging())
{
    using var scope = app.Services.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<PitbullDbContext>();
    await context.Database.MigrateAsync();
}
```

## Branch Flow Setup

### Current Git Flow
```
develop → staging → main
   ↓        ↓        ↓
railway   railway   railway (demo + production)
  dev     staging   demo/prod
```

### Deployment Triggers
- **Push to `develop`** → Auto-deploy to Railway dev environment (duke)
- **Push to `staging`** → Auto-deploy to Railway staging environment (theo)
- **Push to `main`** → Auto-deploy to Railway demo environment (demo)
- **Manual promotion** → Production deployment (app) - manual trigger only

## Environment-Specific Configuration

### Development Environment
- **Purpose:** Feature development and testing
- **Database:** Seed data, can be reset frequently
- **Logs:** Verbose logging enabled
- **Authentication:** Relaxed for testing
- **CORS:** Allow development domains

### Staging Environment  
- **Purpose:** Pre-production validation
- **Database:** Production-like data (sanitized)
- **Logs:** Production-level logging
- **Authentication:** Production settings
- **CORS:** Staging domain only

## Health Checks & Monitoring

### Required Endpoints
```csharp
// Add to Program.cs
app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
});
```

### Railway Health Check Configuration
```toml
[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 300
```

## Secret Management

### Required Secrets (Railway Variables)
- `DATABASE_URL` (auto-generated by Railway PostgreSQL)
- `JWT_SECRET` (generate unique for each environment)
- `ASPNETCORE_ENVIRONMENT`
- `CORS_ORIGINS`
- `FRONTEND_URL`

### Security Considerations
- Different JWT secrets per environment
- Environment-specific CORS policies
- Separate databases (no shared data)
- Proper logging levels per environment

## Testing Strategy

### Development Environment Testing
- Continuous integration on every develop push
- Feature branch testing
- Database migration validation
- API contract testing

### Staging Environment Testing  
- Pre-production acceptance testing
- Performance testing
- Security scanning
- Full user journey validation

## Rollback Strategy

### Quick Rollback Options
```bash
# Railway CLI rollback
railway rollback --service pitbull-staging

# Git-based rollback  
git revert <commit>
git push origin staging
```

### Database Rollback
- Keep migration scripts reversible
- Database snapshots before major changes
- Separate staging data from production

## Success Criteria

### ✅ Completion Checklist
- [ ] Railway project `pretty-communication` connected
- [ ] Dev environment auto-deploys from `develop` branch  
- [ ] Staging environment auto-deploys from `staging` branch
- [ ] PostgreSQL databases provisioned for both environments
- [ ] Environment variables configured properly
- [ ] Health checks responding correctly
- [ ] Database migrations running automatically
- [ ] GitHub Actions deploying successfully
- [ ] Domains accessible and functional

### ✅ Validation Tests
- [ ] Push to develop → Railway dev updates
- [ ] Push to staging → Railway staging updates
- [ ] Database connections working
- [ ] API endpoints responding
- [ ] Frontend can connect to backend
- [ ] Environment-specific configs active

---

**Next Steps:**
1. Access Railway dashboard for `pretty-communication` project
2. Configure dev and staging services
3. Set up PostgreSQL instances
4. Configure deployment workflows
5. Test the complete deploy pipeline

**Timeline:** 1-2 days for complete setup and validation