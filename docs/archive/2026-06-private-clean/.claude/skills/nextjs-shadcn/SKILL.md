---
name: nextjs-shadcn
description: Next.js 16 + React 19 + shadcn/ui frontend expert. Use when building pages, components, forms, data tables, or any UI work. Knows the project's design system, component library, and responsive patterns.
---

# AAI-ERP Frontend — Next.js + shadcn/ui Expert

## Your Role
You build the frontend UI for a construction ERP. Every page must work for a 60-year-old GC superintendent on a dusty phone AND a 28-year-old controller on a 4K monitor.

## Project Structure

```
src/Pitbull.Web/pitbull-web/src/
├── app/(dashboard)/                    # Protected routes (sidebar layout)
│   ├── page.tsx                       # Dashboard (role-based views)
│   ├── projects/                      # Project pages
│   ├── time-tracking/                 # Time entry, approval, crew, mobile
│   ├── billing/                       # Payment apps, aging, contracts
│   ├── accounting/                    # GL, WIP, periods, retention, lien waivers
│   ├── payroll/                       # Payroll runs, certified, wage dets
│   ├── admin/                         # Users, roles, settings, health
│   └── ...
├── components/
│   ├── ui/                            # shadcn/ui base (button, card, input, etc.)
│   ├── layout/                        # Sidebar, header, company switcher
│   ├── dashboard/                     # Dashboard widgets, role views
│   ├── skeletons/                     # Loading skeletons per page type
│   └── {feature}/                     # Feature-specific components
├── contexts/                          # Auth, Company, Theme, KeyboardShortcuts
└── lib/
    ├── api.ts                         # Typed fetch wrapper (handles auth, errors)
    └── types.ts                       # Shared TypeScript types
```

## Page Pattern

Every list page follows this structure:
```tsx
export default function ResourcePage() {
  const [data, setData] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    api<Resource[]>("/api/resources")
      .then(setData)
      .catch(handleError)
      .finally(() => setLoading(false));
  }, []);
  
  if (loading) return <TableSkeleton />;
  if (data.length === 0) return <EmptyState title="No resources yet" action={...} />;
  
  return (
    <div className="space-y-6">
      <PageHeader title="Resources" action={<Button>Create</Button>} />
      <DataTable data={data} columns={columns} />
    </div>
  );
}
```

## Component Conventions

### Cards
```tsx
<Card>
  <CardHeader><CardTitle>Title</CardTitle></CardHeader>
  <CardContent>{content}</CardContent>
</Card>
```

### Forms
Use controlled components with inline validation:
```tsx
<FormField label="Project Name" error={errors.name}>
  <Input value={form.name} onChange={...} />
</FormField>
```

### Status Badges
```tsx
<Badge variant={status === "Active" ? "default" : "secondary"}>
  {status}
</Badge>
```

### Loading States
Every route MUST have either:
- A `loading.tsx` sibling file with skeleton, OR
- Inline loading state with skeleton components

### Empty States
Every list page MUST handle zero results with `<EmptyState>`:
```tsx
<EmptyState
  icon={FileText}
  title="No contracts yet"
  description="Create your first subcontract to get started."
  action={<Button onClick={...}>Create Contract</Button>}
/>
```

## Design System

### Colors (via Tailwind + CSS variables)
- Primary: blue (buttons, links, active states)
- Destructive: red (delete, errors)
- Warning: amber/yellow (overdue, attention needed)
- Success: green (completed, approved)
- Muted: gray (secondary text, borders)

### Typography
- Page titles: `text-2xl font-bold`
- Section headers: `text-lg font-semibold`
- Body: `text-sm` (default Tailwind)
- Muted text: `text-muted-foreground`

### Spacing
- Page padding: `p-6` (desktop), `p-4` (mobile)
- Card gaps: `space-y-6`
- Form field gaps: `space-y-4`

### Responsive Breakpoints
- Mobile: default (< 640px) — stacked, cards, big touch targets
- Tablet: `sm:` (640px+) — 2-column grids
- Desktop: `lg:` (1024px+) — full table layouts, sidebars visible

## API Integration

### The api() Wrapper
```typescript
// Always use this. Never raw fetch.
import { api } from "@/lib/api";

const project = await api<ProjectDto>("/api/projects/" + id);
const result = await api<ProjectDto>("/api/projects", {
  method: "POST",
  body: { name: "New Project", number: "2026-001" }
});
```

### Error Handling
```typescript
try {
  const result = await api<T>(url, options);
  // Success
} catch (error) {
  toast.error(error.message || "Something went wrong");
}
```

## Accessibility
- All interactive elements: `aria-label` when text isn't visible
- Form inputs: always paired with `<Label>`
- Color: never rely on color alone (add icons/text for status)
- Focus management: proper tab order, visible focus rings
- Skip to content: available via keyboard

## Performance
- Use `loading.tsx` for route-level code splitting
- Lazy load heavy components (charts, PDF viewers)
- Images: use `next/image` with proper width/height
- API calls: deduplicate with keys, use stale-while-revalidate pattern

## Common Mistakes
1. Using raw `fetch` instead of `api()` wrapper
2. Missing loading states (no skeleton = flash of empty content)
3. Missing empty states (blank page when no data)
4. Not handling 401/403 (user sees broken page instead of redirect)
5. Forgetting mobile: tables that can't scroll, tiny tap targets
6. Over-fetching data without pagination or selective fields (mirror backend AsNoTracking + projection)
