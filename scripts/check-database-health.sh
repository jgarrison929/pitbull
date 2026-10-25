#!/bin/bash
set -e

# Database Health Check for Pitbull Construction Solutions
# Verifies database connectivity and basic schema health

echo "🗄️  Pitbull Database Health Check"
echo "================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default connection string (can be overridden)
DB_CONNECTION_STRING="${DB_CONNECTION_STRING:-Host=localhost;Database=pitbull_dev;Username=pitbull;Password=pitbull_dev}"

# Function to run SQL query
run_sql() {
    local query="$1"
    local description="$2"
    
    echo -n "🔍 $description: "
    
    if command -v psql >/dev/null 2>&1; then
        result=$(psql "$DB_CONNECTION_STRING" -t -c "$query" 2>/dev/null | xargs) || result=""
        
        if [ -n "$result" ] && [ "$result" != "0" ]; then
            echo -e "${GREEN}✅ $result${NC}"
            return 0
        else
            echo -e "${RED}❌ Failed or returned 0${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  psql not available${NC}"
        return 1
    fi
}

# Function to check table exists and has data
check_table() {
    local table_name="$1"
    local display_name="${2:-$table_name}"
    
    echo -n "📊 $display_name table: "
    
    if command -v psql >/dev/null 2>&1; then
        count=$(psql "$DB_CONNECTION_STRING" -t -c "SELECT COUNT(*) FROM $table_name;" 2>/dev/null | xargs) || count="ERROR"
        
        if [ "$count" = "ERROR" ]; then
            echo -e "${RED}❌ Table missing or access denied${NC}"
            return 1
        elif [ "$count" -gt 0 ]; then
            echo -e "${GREEN}✅ $count records${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠️  0 records (empty table)${NC}"
            return 0
        fi
    else
        echo -e "${YELLOW}⚠️  psql not available${NC}"
        return 1
    fi
}

echo "🔗 Database Connection"
echo "---------------------"

# Basic connectivity test
if command -v psql >/dev/null 2>&1; then
    echo -n "📡 Connection test: "
    if psql "$DB_CONNECTION_STRING" -c "SELECT 1;" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Connected successfully${NC}"
        
        # Get database version
        version=$(psql "$DB_CONNECTION_STRING" -t -c "SELECT version();" 2>/dev/null | head -n1 | xargs) || version="Unknown"
        echo "🔢 PostgreSQL Version: $version"
        
        # Get database size
        db_size=$(psql "$DB_CONNECTION_STRING" -t -c "SELECT pg_size_pretty(pg_database_size(current_database()));" 2>/dev/null | xargs) || db_size="Unknown"
        echo "💾 Database Size: $db_size"
    else
        echo -e "${RED}❌ Connection failed${NC}"
        echo ""
        echo "💡 Make sure:"
        echo "   • PostgreSQL is running"
        echo "   • Database 'pitbull_dev' exists" 
        echo "   • User has proper permissions"
        echo "   • Connection string is correct: $DB_CONNECTION_STRING"
        exit 1
    fi
else
    echo -e "${RED}❌ psql command not found${NC}"
    echo ""
    echo "💡 Install PostgreSQL client: apt install postgresql-client"
    exit 1
fi

echo ""
echo "🏗️  Schema Health"
echo "-----------------"

# Check core tables exist and have data
check_table "tenants" "Tenants"
check_table "users" "Users (AppUser)" 
check_table "projects" "Projects"
check_table "bids" "Bids"

# Check migrations table
run_sql "SELECT COUNT(*) FROM __EFMigrationsHistory;" "Applied Migrations"

# Check for any foreign key violations
echo -n "🔗 Foreign Key Constraints: "
fk_violations=$(psql "$DB_CONNECTION_STRING" -t -c "
    SELECT COUNT(*) 
    FROM information_schema.table_constraints 
    WHERE constraint_type = 'FOREIGN KEY' 
    AND constraint_schema = 'public';" 2>/dev/null | xargs) || fk_violations="ERROR"

if [ "$fk_violations" != "ERROR" ] && [ "$fk_violations" -gt 0 ]; then
    echo -e "${GREEN}✅ $fk_violations constraints defined${NC}"
else
    echo -e "${YELLOW}⚠️  Unable to verify constraints${NC}"
fi

echo ""
echo "📈 Performance Metrics"
echo "--------------------"

# Check for recent activity
run_sql "SELECT COUNT(*) FROM users WHERE \"LastLoginAt\" > NOW() - INTERVAL '7 days';" "Active Users (7 days)"

# Database performance indicators
echo -n "🚀 Recent Query Performance: "
if psql "$DB_CONNECTION_STRING" -c "SELECT pg_stat_statements_reset();" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Query stats available${NC}"
else
    echo -e "${YELLOW}⚠️  pg_stat_statements not enabled${NC}"
fi

echo ""
echo "✅ Database health check complete"
echo ""
echo "💡 Tips:"
echo "   • Set DB_CONNECTION_STRING env var for custom connection"
echo "   • Enable pg_stat_statements for query performance monitoring"
echo "   • Run 'ANALYZE;' periodically to update table statistics"