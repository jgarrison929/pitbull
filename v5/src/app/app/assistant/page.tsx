import { Suspense } from "react";
import { Assistant } from "@/components/app/assistant";
import { PageHeader } from "@/components/app/page-shell";

/** The assistant as a full screen, for phones and narrow windows. Wide screens show it as the right rail. */
export default function AssistantPage() {
  return (
    <>
      <PageHeader
        title="Assistant"
        meta="Ask, dictate, or act. Every answer names the action it ran."
      />
      <div className="lg:hidden">
        <Suspense
          fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" />}
        >
          <Assistant variant="page" />
        </Suspense>
      </div>
      <p className="hidden text-sm text-muted-foreground lg:block">
        The assistant is open in the right rail.
      </p>
    </>
  );
}
