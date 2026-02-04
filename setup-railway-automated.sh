#!/bin/bash
# Automated Railway Environment Setup

set -e

cd /mnt/c/pitbull

echo "🚂 Starting automated Railway setup..."

# Development Environment
echo "Setting up DEVELOPMENT environment..."
railway link --project pretty-communication --environment development

expect << 'EOF'
spawn railway add --service
expect "What do you need?"
send "Empty Service\r"
expect "Enter a service name"  
send "pitbull-dev\r"
expect "Enter a variable"
send "\r"
expect eof
EOF

echo "Adding domain to dev service..."
railway domain add duke.pitbullconstructionsolutions.com --service pitbull-dev

echo "Adding database to dev..."
expect << 'EOF'
spawn railway add --database postgres
expect "What do you need?"
send "Database\r"
expect eof
EOF

# Staging Environment
echo "Setting up STAGING environment..."
sleep 35  # Rate limit
railway link --project pretty-communication --environment staging

expect << 'EOF'
spawn railway add --service
expect "What do you need?"
send "Empty Service\r"
expect "Enter a service name"
send "pitbull-staging\r" 
expect "Enter a variable"
send "\r"
expect eof
EOF

echo "Adding domain to staging service..."
railway domain add theo.pitbullconstructionsolutions.com --service pitbull-staging

echo "Adding database to staging..."
expect << 'EOF'
spawn railway add --database postgres
expect "What do you need?"
send "Database\r"
expect eof
EOF

# Demo Environment  
echo "Setting up DEMO environment..."
sleep 35  # Rate limit
railway link --project pretty-communication --environment demo

expect << 'EOF'
spawn railway add --service
expect "What do you need?"
send "Empty Service\r"
expect "Enter a service name"
send "pitbull-demo\r"
expect "Enter a variable" 
send "\r"
expect eof
EOF

echo "Adding domain to demo service..."
railway domain add demo.pitbullconstructionsolutions.com --service pitbull-demo

echo "🎉 Railway setup complete!"
echo "Services created: pitbull-dev, pitbull-staging, pitbull-demo"
echo "Domains configured: duke, theo, demo subdomains"
echo "Databases: PostgreSQL in each environment"