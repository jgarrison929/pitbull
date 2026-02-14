export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background animate-[fadeIn_0.3s_ease-out]">
      {/* Logo */}
      <div className="relative mb-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 text-white font-bold text-2xl shadow-lg animate-[pulse_2s_ease-in-out_infinite]">
          P
        </div>
        {/* Subtle ring pulse */}
        <div className="absolute inset-0 rounded-2xl border-2 border-amber-500/30 animate-[ping_2s_ease-in-out_infinite]" />
      </div>

      {/* Brand name */}
      <h1 className="text-xl font-bold tracking-tight text-foreground mb-1">
        Pitbull
      </h1>
      <p className="text-xs text-muted-foreground tracking-widest uppercase mb-8">
        Construction Solutions
      </p>

      {/* Loading bar */}
      <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 rounded-full animate-[loadingBar_1.5s_ease-in-out_infinite]"
        />
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes loadingBar {
          0% { width: 0%; margin-left: 0%; }
          50% { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
    </div>
  );
}
