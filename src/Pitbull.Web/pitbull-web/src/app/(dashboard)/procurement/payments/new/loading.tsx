export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-56 bg-muted animate-pulse rounded" />
        <div className="h-4 w-72 bg-muted animate-pulse rounded" />
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="h-6 w-40 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
              <div className="h-10 w-full bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              <div className="h-10 w-full bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
