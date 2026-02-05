# Documentation Lifecycle Management

## Document Categories & Lifecycle

### 📋 Active Planning Docs (Keep Updated)
**Location:** `/mnt/c/pitbull/*.md`
**Examples:** `REMOVE-MEDIATR.md`, `AI-ARCHITECTURE-REQUIREMENTS.md`, `RAILWAY-DEPLOYMENT.md`
**Lifecycle:**
- ✅ **Active:** Actively being implemented
- 🔄 **Update:** Keep current during implementation  
- ✅ **Complete:** Move to archive when done
- 🗑️ **Delete:** Remove when superseded

### 📚 Knowledge Base (Permanent)
**Examples:** Architecture decisions, API docs, deployment guides
**Action:** Keep updated, becomes permanent documentation

### 📊 Status Reports (Archive)
**Examples:** `dependabot-strategy.md`, audit reports
**Action:** Move to `docs/archive/` when complete

### 🎯 Task/Issue Docs (Convert or Delete)
**Examples:** Specific implementation plans
**Action:** 
- Convert to GitHub issues/tickets
- Delete markdown file after conversion
- Keep only if it becomes permanent documentation

## Proposed Cleanup Strategy

### 1. Archive Completed Work
```bash
mkdir -p /mnt/c/pitbull/docs/archive/2026-02/
mv dependabot-strategy.md docs/archive/2026-02/
mv local-ai-infrastructure-research.md docs/archive/2026-02/
```

### 2. Convert to Issues/Tickets  
**Move these to GitHub Issues:**
- `REMOVE-MEDIATR.md` → GitHub Issue #XXX "Remove MediatR Dependency"
- `RAILWAY-DEPLOYMENT.md` → GitHub Issue #XXX "Setup Railway Environments" 
- Keep implementation details in issue description
- Delete markdown file after conversion

### 3. Promote to Permanent Docs
**Keep as permanent documentation:**
- `AI-ARCHITECTURE-REQUIREMENTS.md` → Move to `/docs/architecture/`
- Architecture audit findings → `/docs/security/`
- Performance optimization guides → `/docs/performance/`

### 4. Regular Cleanup Schedule
**Weekly cleanup (Fridays):**
- Archive completed planning docs
- Convert tasks to GitHub issues  
- Update permanent documentation
- Remove obsolete files

## Folder Structure Proposal

```
/mnt/c/pitbull/
├── docs/
│   ├── architecture/        # Permanent architecture docs
│   ├── deployment/         # Deployment guides & configs
│   ├── security/           # Security policies & findings
│   ├── archive/            # Completed planning docs
│   │   ├── 2026-02/       # Monthly archives
│   │   └── 2026-03/
│   └── templates/          # Document templates
├── planning/               # Active planning docs (temporary)
│   ├── TASK-*.md          # Active task planning
│   └── RESEARCH-*.md      # Active research
└── README.md              # Project overview
```

## Cleanup Actions for Current Files

### ✅ Keep & Update
- `AI-ARCHITECTURE-REQUIREMENTS.md` → Move to `/docs/architecture/`
- `RAILWAY-DEPLOYMENT.md` → Convert to GitHub issue, keep deployment guide parts

### 📦 Archive  
- `dependabot-strategy.md` → Archive (completed analysis)
- `local-ai-infrastructure-research.md` → Archive (completed research)

### 🔄 Convert to Issues
- `REMOVE-MEDIATR.md` → GitHub Issue with checklist
- Railway setup tasks → GitHub Issues with specific actions
- Architecture audit findings → GitHub Issues for each action item

### 🗑️ Delete After Conversion
- Implementation-specific planning docs after converting to issues
- Temporary research files once findings are captured
- Obsolete strategy documents

## Implementation Plan

1. **This week:** Set up folder structure
2. **Create GitHub issues** from current planning docs  
3. **Archive completed** analysis documents
4. **Establish weekly cleanup** routine
5. **Document templates** for future planning docs

## Benefits

- ✅ **Clean repository** - only active/permanent docs
- ✅ **Issue tracking** - work items in proper system
- ✅ **Historical record** - archived decisions and analysis  
- ✅ **Easy navigation** - clear organization
- ✅ **Reduced noise** - focus on current priorities

---

**Immediate action:** Want me to start this cleanup process and convert the current planning docs to GitHub issues?