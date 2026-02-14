export default function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 text-white font-bold text-xl shadow-md animate-pulse">
          P
        </div>
        <div className="w-32 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full"
            style={{
              animation: "authLoadingBar 1.5s ease-in-out infinite",
            }}
          />
        </div>
      </div>
      <style jsx global>{`
        @keyframes authLoadingBar {
          0% { width: 0%; margin-left: 0%; }
          50% { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
    </div>
  );
}
