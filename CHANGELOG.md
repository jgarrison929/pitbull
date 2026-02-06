# Changelog

All notable changes to Pitbull Construction Solutions are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Planned

- Contract management module
- Document management module
- Billing/invoicing module
- Client portal
- Subdomain-based tenant resolution

---

## [0.4.0] - 2026-02-05

### 🤖 AI Features

- **AI Project Health Insights** - Claude-powered analysis at `/api/projects/{id}/ai-summary`
  - Health score (0-100) with color-coded status
  - Executive summary with natural language overview
  - Highlights, concerns, and actionable recommendations
  - Key metrics: hours logged, labor costs, budget utilization, pending approvals
- **Interactive AI Insights UI** - Beautiful frontend integration on project detail pages
  - Animated circular health gauge with color transitions
  - Metrics grid with key project statistics
  - Categorized insights cards (highlights, concerns, recommendations)
  - Loading skeleton with shimmer animations

### 🔒 Security & Access Control

- **Role-Based Access Control (RBAC)** - Complete permission system
  - Four built-in roles: Admin, Manager, Supervisor, User
  - Automatic Admin role assignment for first user per tenant
  - JWT tokens include role claims for API authorization
  - Role-protected endpoints for sensitive operations
- **User Management Dashboard** - Admin panel at `/admin/users`
  - View all users with roles and status
  - Assign and remove roles via UI
  - Search and filter capabilities
  - Prevents self-demotion (can't remove own Admin role)
- **Frontend Role Enforcement** - UI adapts to user permissions
  - Admin-only navigation section
  - `hasRole()`, `isAdmin`, `isManager` helper functions
  - Conditional rendering based on user roles

### 🚀 Features

- **Enhanced Dashboard** - Real-time project insights
  - Personalized greeting with user name
  - Clickable stat cards for quick navigation
  - Quick actions panel (create project, bid, employee, log time)
  - Live activity feed showing recent changes
  - Portfolio summary with total values
- **Settings Page** - User profile management at `/settings`
  - View profile info, roles, and tenant details
  - Change password functionality
  - Admin link to user management
- **Employee Management** - Complete CRUD workflow
  - Employee directory with search and filters
  - Create employee form with validation
  - Employee detail page with assignments and time entries
  - Employee edit form with status toggle
  - Clickable list rows for quick navigation
- **Onboarding Experience** - Guide new users
  - Getting Started checklist on dashboard
  - Progress tracking for first project, employee, bid, time entry
  - Dismissible with localStorage persistence

### ⚡ User Experience

- **Form Improvements**
  - Phone number auto-formatting `(XXX) XXX-XXXX`
  - Loading buttons with spinner during submission
  - Disabled forms while submitting
  - Required field indicators
  - Inline validation messages
- **Accessibility Enhancements**
  - ARIA labels on all icon-only buttons
  - Screen reader support for form errors
  - Keyboard navigation improvements
  - Focus management in dialogs
- **Confirmation Dialogs** - Prevent accidental actions
  - Danger/warning/info variants
  - Loading states during operations
- **Tooltips & Help Text**
  - Tooltips for complex form fields
  - Help text for business concepts (Classification, Cost Code)

### 🏗️ Infrastructure

- **Demo Data Seeder** - Investor-ready demonstration data
  - 60 standard construction cost codes (CSI divisions)
  - 15 realistic employees (PMs, superintendents, tradespeople)
  - Project assignments linking workers to projects
  - 30 days of time entries with realistic patterns
- **Code Quality**
  - 172 tests passing (163 unit + 9 integration)
  - ESLint errors resolved across all components
  - Repository cleanup (40 stale branches removed)

---

## [0.3.0] - 2026-02-05

### 🔒 Security & Reliability

- **Fixed critical Row-Level Security issues** - Resolved database tenant isolation failures affecting all create operations
- **Enhanced database connection stability** - Added connection interceptor to ensure tenant context persists across connection pooling
- **Improved API authentication** - Confirmed production API returns proper 401 status codes instead of redirects
- **Added comprehensive integration testing** - All 9 integration test suites now passing consistently

### 🚀 Features  

- **Enhanced deployment monitoring** - Added database health scripts and deployment status tracking ([PR #135](https://github.com/jgarrison929/pitbull/pull/135))
- **HTTP response caching** - Implemented read endpoint caching for improved performance ([PR #134](https://github.com/jgarrison929/pitbull/pull/134))
- **Domain event dispatching** - Added MediatR-based event system for future module integration ([PR #132](https://github.com/jgarrison929/pitbull/pull/132))
- **Cost code management** - Added foundation for job cost tracking and accounting ([PR #129](https://github.com/jgarrison929/pitbull/pull/129))

### 🐛 Bug Fixes

- **Frontend build stability** - Resolved duplicate import errors in error boundary components
- **Dashboard statistics** - Fixed SQL query compatibility issues with EF Core SqlQueryRaw
- **Docker build reliability** - Added missing RFIs module to container build process
- **Architecture test resilience** - Improved null safety in test failure reporting

### ⚡ Performance

- **API security headers** - Comprehensive security header implementation with monitoring ([PR #133](https://github.com/jgarrison929/pitbull/pull/133))
- **Request timeout protection** - Added configurable timeouts to prevent slow loris attacks
- **Rate limiting enhancements** - Refined authentication endpoint rate limits for better UX

### 🏗️ Infrastructure

- **CI/CD improvements** - Enhanced test reliability and failure diagnostics
- **Documentation updates** - Added comprehensive design docs for cost codes and time tracking
- **Pull request workflow** - Added standardized PR template with goal/risk/test checklist ([PR #128](https://github.com/jgarrison929/pitbull/pull/128))

### Technical Notes

- Tenant sanitization research completed for future white-label opportunities
- Architecture tests now provide actionable failure information
- Integration test coverage expanded across all major API endpoints
- Database migrations pipeline enhanced for production stability

---

## [0.1.0] - 2026-01-xx

Initial feature-complete MVP for construction project and bid management.

### Authentication & Multi-Tenancy

- **JWT authentication** with login and registration endpoints
- **Multi-tenant architecture** with shared database, shared schema model
- Tenant resolution from JWT claims and `X-Tenant-Id` header
- Automatic `TenantId` stamping on entity creation
- **PostgreSQL Row-Level Security (RLS)** policies for database-level tenant isolation
- Parameterized tenant SET to prevent SQL injection
- JWT returns 401 (not 302) on protected endpoints

### Projects Module

- Full CRUD (create, read, update, soft delete) for construction projects
- **Server-side pagination** with configurable page size
- Project detail view with phases, budgets, and status tracking
- Project types: Commercial, Residential, Infrastructure, Industrial, Renovation
- Project status workflow: Planning, Pre-Construction, Active, On Hold, Completed, Cancelled
- Client information fields (name, email, phone)
- Contract amount and budget tracking

### Bids Module

- Full CRUD for bids/estimates
- **Bid line items** with quantity, unit price, and calculated totals
- **Server-side pagination** with status filtering and search
- Bid status workflow: Draft, Submitted, Under Review, Won, Lost, Withdrawn
- Bid-to-project conversion (won bids only, prevents duplicate conversion)
- Estimated value tracking and bid numbering

### API Infrastructure

- **Rate limiting** on auth and API endpoints to prevent abuse
- **Correlation ID middleware** for request tracing across services
- **Global exception handling** with structured error responses and trace IDs
- **Deep health checks** with database connectivity verification
- Consistent error response format (`{ error, code }`)
- **Serilog** structured logging

### Frontend

- **Next.js** App Router with TypeScript
- **Mobile-responsive UI** audit and fixes across all views
  - Minimum 375px viewport support (iPhone SE)
  - Touch-friendly tap targets (44px minimum)
  - Collapsible navigation on small screens
  - Responsive tables and card layouts
- **Dashboard with real statistics** (project counts, bid win rates, contract totals)
- Project list, detail, and create/edit views
- Bid list, detail, and create/edit views with line item management
- **shadcn/ui** component library with Tailwind CSS
- Auth context with automatic token management
- API client with auto-auth headers and 401 redirect handling

### Data & Database

- **Seed data generator** for realistic construction demo data
- PostgreSQL 17 with EF Core migrations (auto-apply on startup)
- snake_case table naming convention
- Soft delete with global query filters
- Audit fields (CreatedAt, UpdatedAt) auto-populated on save
- Composite unique indexes with TenantId for multi-tenant safety

### DevOps & CI/CD

- **GitHub Actions CI** pipeline for backend (.NET build + tests) and frontend (build + lint)
- **Railway deployment** with three environments: dev, staging, production
- Three-branch promotion model: `develop` -> `staging` -> `main`
- PostgreSQL 17 service container for CI integration tests

### Documentation

- Best practices and patterns guide (`docs/BEST-PRACTICES.md`)
- Module creation guide (`docs/ADDING-A-MODULE.md`)
- Team protocol (`docs/TEAM-PROTOCOL.md`)
- Quality strategy (`docs/QUALITY-STRATEGY.md`)
- Vision document (`docs/VISION.md`)
- RLS implementation documentation
- Release plan

### Known Issues

- Domain events collected but not yet dispatched (MediatR integration pending)
- `CreatedBy`/`UpdatedBy`/`DeletedBy` audit fields not auto-populated from user context
- `PagedResult<T>` defined in Projects module but used cross-module (should move to Core)
- Subdomain tenant resolution placeholder (not yet implemented)
