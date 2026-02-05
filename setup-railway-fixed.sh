#!/bin/bash
# Fixed Railway Environment Setup

set -e
cd /mnt/c/pitbull

echo "🚂 Setting up Railway environments with proper service naming..."

# Development Environment
echo "=== DEVELOPMENT ENVIRONMENT ==="
railway link --project pretty-communication --environment development

# Check existing services first
echo "Current development services:"
railway service status --all

echo "Adding domain to existing service..."
# Get the service name from status and add domain
SERVICE_NAME=$(railway service status --all --json 2>/dev/null | jq -r '.[] | select(.name != "Postgres") | .name' | head -1)

if [ "$SERVICE_NAME" != "null" ] && [ -n "$SERVICE_NAME" ]; then
    echo "Found service: $SERVICE_NAME"
    railway domain add duke.pitbullconstructionsolutions.com --service "$SERVICE_NAME"
    echo "✅ Dev domain added"
else
    echo "No web service found in dev environment"
fi

echo ""
sleep 35

# Staging Environment
echo "=== STAGING ENVIRONMENT ==="
railway link --project pretty-communication --environment staging

echo "Current staging services:"
railway service status --all

SERVICE_NAME=$(railway service status --all --json 2>/dev/null | jq -r '.[] | select(.name != "Postgres") | .name' | head -1)

if [ "$SERVICE_NAME" != "null" ] && [ -n "$SERVICE_NAME" ]; then
    echo "Found service: $SERVICE_NAME"
    railway domain add theo.pitbullconstructionsolutions.com --service "$SERVICE_NAME"
    echo "✅ Staging domain added"
else
    echo "No web service found in staging environment"
fi

echo ""
sleep 35

# Demo Environment
echo "=== DEMO ENVIRONMENT ==="
railway link --project pretty-communication --environment demo

echo "Current demo services:"
railway service status --all

SERVICE_NAME=$(railway service status --all --json 2>/dev/null | jq -r '.[] | select(.name != "Postgres") | .name' | head -1)

if [ "$SERVICE_NAME" != "null" ] && [ -n "$SERVICE_NAME" ]; then
    echo "Found service: $SERVICE_NAME"
    railway domain add demo.pitbullconstructionsolutions.com --service "$SERVICE_NAME"
    echo "✅ Demo domain added"
else
    echo "Creating demo web service..."
    
    expect << 'EOF'
spawn railway add --service
expect "Enter a service name"
send "pitbull-demo\r"
expect "Enter a variable"
send "\r"
expect eof
EOF

    railway domain add demo.pitbullconstructionsolutions.com --service pitbull-demo
    echo "✅ Demo service and domain added"
fi

echo ""
echo "🎉 Railway setup complete!"
echo ""
echo "Verify with: railway service status --all in each environment"