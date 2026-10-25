# Pitbull DevOps Scripts

Collection of operational scripts for monitoring and maintaining Pitbull Construction Solutions infrastructure.

## 🚀 Quick Start

```bash
# Check deployment status across all environments
./scripts/check-deployment-status.sh

# Verify database health and connectivity
./scripts/check-database-health.sh

# Custom database connection
DB_CONNECTION_STRING="Host=prod-db;Database=pitbull;Username=app;Password=***" ./scripts/check-database-health.sh
```

## 📋 Scripts

### `preflight.ps1`
**Purpose:** Local pre-ship gates before PR / merge (version stamps, vitest, eslint). Cuts CI thrash from version drift and frontend lint.

```powershell
./scripts/preflight.ps1              # version + vitest + changed-file eslint
./scripts/preflight.ps1 -FullWeb     # + full lint + next build
./scripts/preflight.ps1 -DotNet      # + unit tests
```

### `check-deployment-status.sh`
**Purpose:** Health check across all deployment environments (dev, staging, demo, production)

**Features:**
- HTTP health endpoint validation
- API version information retrieval
- GitHub deployment history
- Color-coded status output
- Timeout handling for unreachable services

**Dependencies:**
- `curl` (required)
- `jq` (optional - for detailed version parsing)
- `gh` CLI (optional - for GitHub deployment info)

**Environments Checked:**
- Local: `localhost:5081` (hosted environments decommissioned)

### `check-database-health.sh`
**Purpose:** Database connectivity, schema validation, and performance metrics

**Features:**
- PostgreSQL connection testing
- Core table existence and record counts
- Migration history validation
- Foreign key constraint verification
- Performance statistics (if available)

**Dependencies:**
- `psql` (PostgreSQL client)

**Configuration:**
Set `DB_CONNECTION_STRING` environment variable:
```bash
export DB_CONNECTION_STRING="Host=localhost;Database=pitbull_dev;Username=pitbull;Password=pitbull_dev"
```

## 🔧 Installation

### Ubuntu/Debian
```bash
# Install dependencies
sudo apt update
sudo apt install curl jq postgresql-client

# Install GitHub CLI
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh
```

### macOS
```bash
# Install dependencies
brew install curl jq postgresql gh
```

## 🚨 CI/CD Integration

These scripts can be integrated into CI/CD pipelines for automated health checks:

```yaml
# GitHub Actions example
- name: Check Deployment Health
  run: |
    chmod +x ./scripts/check-deployment-status.sh
    ./scripts/check-deployment-status.sh

- name: Validate Database
  env:
    DB_CONNECTION_STRING: ${{ secrets.DATABASE_URL }}
  run: |
    chmod +x ./scripts/check-database-health.sh
    ./scripts/check-database-health.sh
```

## 📊 Output Examples

### Deployment Status
```
🏗️  Pitbull Deployment Status Check
==================================

🌐 Local Environment (localhost:5081)
----------------------------------------
📡 Health Check: ✅ HTTP 200
📡 Health Live: ✅ HTTP 200
📡 Health Ready: ✅ HTTP 200
📡 API Base: ✅ HTTP 401
🔍 Production API version: 1.0.0 (Production)
📡 API Docs: ✅ HTTP 200
```

### Database Health
```
🗄️  Pitbull Database Health Check
=================================

🔗 Database Connection
---------------------
📡 Connection test: ✅ Connected successfully
🔢 PostgreSQL Version: PostgreSQL 17.2 on x86_64-pc-linux-gnu
💾 Database Size: 45 MB

🏗️  Schema Health
-----------------
📊 Tenants table: ✅ 12 records
📊 Users (AppUser) table: ✅ 47 records
📊 Projects table: ✅ 23 records
📊 Bids table: ✅ 156 records
🔍 Applied Migrations: ✅ 15
🔗 Foreign Key Constraints: ✅ 8 constraints defined
```

## 🛠 Troubleshooting

### Common Issues
- **Connection timeout:** Check network connectivity and firewall rules
- **Database access denied:** Verify credentials and user permissions
- **curl not found:** Install curl package
- **psql not found:** Install PostgreSQL client package

### Environment Variables
- `DB_CONNECTION_STRING`: PostgreSQL connection string
- `GITHUB_TOKEN`: GitHub Personal Access Token (for enhanced API limits)

## 🔐 Security Notes

- Scripts expect public health endpoints to be available
- Database connections require proper credentials
- GitHub CLI respects existing authentication
- No sensitive data is logged or stored by these scripts