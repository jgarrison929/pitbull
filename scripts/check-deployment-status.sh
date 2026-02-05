#!/bin/bash
set -e

# Deployment Status Checker for Pitbull Construction Solutions
# Checks health and version across all environments

echo "🏗️  Pitbull Deployment Status Check"
echo "=================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check endpoint health
check_endpoint() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -n "📡 $name: "
    
    if command -v curl >/dev/null 2>&1; then
        response=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 10) || response="000"
        
        if [ "$response" = "$expected_status" ]; then
            echo -e "${GREEN}✅ HTTP $response${NC}"
            return 0
        elif [ "$response" = "000" ]; then
            echo -e "${RED}❌ Timeout/Connection Failed${NC}"
            return 1
        else
            echo -e "${YELLOW}⚠️  HTTP $response (expected $expected_status)${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  curl not available${NC}"
        return 1
    fi
}

# Function to get version info
get_version_info() {
    local name=$1
    local url=$2
    
    echo -n "🔍 $name version: "
    
    if command -v curl >/dev/null 2>&1; then
        version_info=$(curl -s "$url" --max-time 5 2>/dev/null) || version_info=""
        
        if [ -n "$version_info" ]; then
            # Try to extract version from JSON response
            if command -v jq >/dev/null 2>&1; then
                version=$(echo "$version_info" | jq -r '.version // .Version // "unknown"' 2>/dev/null) || version="unknown"
                env=$(echo "$version_info" | jq -r '.environment // .Environment // "unknown"' 2>/dev/null) || env="unknown"
                echo -e "${GREEN}$version ($env)${NC}"
            else
                echo -e "${YELLOW}Available (jq not installed)${NC}"
            fi
        else
            echo -e "${RED}❌ Not available${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  curl not available${NC}"
    fi
}

# Environment configurations
declare -A environments
environments[Development]="duke.pitbullconstructionsolutions.com"
environments[Staging]="theo.pitbullconstructionsolutions.com" 
environments[Demo]="demo.pitbullconstructionsolutions.com"
environments[Production]="app.pitbullconstructionsolutions.com"

# Check each environment
for env_name in "${!environments[@]}"; do
    domain="${environments[$env_name]}"
    echo "🌐 $env_name Environment ($domain)"
    echo "----------------------------------------"
    
    # Health check endpoints
    check_endpoint "Health Check" "https://$domain/health"
    check_endpoint "Health Live" "https://$domain/health/live"
    check_endpoint "Health Ready" "https://$domain/health/ready"
    
    # API endpoints (these require auth, so we expect 401)
    check_endpoint "API Base" "https://$domain/api/dashboard/stats" "401"
    
    # Version info (if monitoring endpoints are available)
    get_version_info "$env_name API" "https://$domain/api/monitoring/version"
    
    # Swagger/OpenAPI
    check_endpoint "API Docs" "https://$domain/swagger/index.html"
    
    echo ""
done

# GitHub deployment status
echo "📦 GitHub Deployments"
echo "--------------------"

if command -v gh >/dev/null 2>&1; then
    echo "🔄 Recent deployments:"
    gh api repos/jgarrison929/pitbull/deployments --jq '.[0:3] | .[] | "• " + .environment + ": " + .ref + " (" + .created_at + ")"' 2>/dev/null || echo "❌ Unable to fetch deployment info"
    
    echo ""
    echo "🚀 Active workflow runs:"
    gh run list --limit 3 --json status,conclusion,name,createdAt,url --jq '.[] | "• " + .name + ": " + .status + " (" + (.createdAt | split("T")[0]) + ")"' 2>/dev/null || echo "❌ Unable to fetch workflow info"
else
    echo "❌ GitHub CLI (gh) not available"
fi

echo ""
echo "✅ Deployment status check complete"
echo ""
echo "💡 Tips:"
echo "   • Install jq for detailed version info: apt install jq"
echo "   • Install gh CLI for deployment history: https://cli.github.com/"
echo "   • Run with --verbose for detailed curl output"