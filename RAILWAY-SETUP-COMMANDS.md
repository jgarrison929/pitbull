# Railway Setup Commands - Run These Manually

## ✅ COMPLETED
- DNS records added to Cloudflare
- Railway CLI connected to `pretty-communication`
- Environments created: `development`, `staging`, `demo`

## 🔄 REMAINING STEPS (Josh to run)

### 1. Create Services in Each Environment (3-5 minutes)
```bash
cd /mnt/c/pitbull

# Link to development and add database
railway link --project pretty-communication --environment development
railway add --database postgres

# Link to staging and add database  
sleep 35  # Rate limit wait
railway link --project pretty-communication --environment staging
railway add --database postgres

# Link to demo and add database
sleep 35  # Rate limit wait  
railway link --project pretty-communication --environment demo
railway add --database postgres
```

### 2. Configure Custom Domains (2 minutes)
```bash
# Add domains to each service (after services are created)
railway domain add duke.pitbullconstructionsolutions.com
railway domain add theo.pitbullconstructionsolutions.com  
railway domain add demo.pitbullconstructionsolutions.com
```

### 3. Set Environment Variables (1 minute per environment)
```bash
# For each environment, set:
railway variable set ASPNETCORE_ENVIRONMENT=Development
railway variable set CORS_ORIGINS="https://duke.pitbullconstructionsolutions.com"
railway variable set JWT_SECRET="<generate-unique-key>"

# Repeat for staging (ASPNETCORE_ENVIRONMENT=Staging, theo domain)
# Repeat for demo (ASPNETCORE_ENVIRONMENT=Demo, demo domain)
```

## ⚡ TOTAL TIME: ~8-10 minutes
- Environments: Created ✅
- Services: 3-5 minutes (with rate limits)
- Domains: 2 minutes  
- Variables: 3 minutes
- DNS propagation: 5-15 minutes (already started)

## 🚨 CRITICAL SUCCESS FACTORS
1. **DNS records added** ✅ (done)
2. **Railway environments** ✅ (done) 
3. **Services + databases** (in progress)
4. **Domain mapping** (depends on services)
5. **Environment variables** (final step)

**We're 60% done!** The foundation is in place, just need the service creation completed.