"use client";

import { usePathname } from "next/navigation";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { ArrowUp, Mic, Sparkles } from "lucide-react";
import { ask, type AskState } from "@/app/app/assistant/actions";
import { LocalTime } from "@/components/app/local-time";
import { actionRailLabel } from "@/lib/assistant/labels";
import { examples } from "@/lib/assistant/route";
import { captureAiQuestionAsked } from "@/lib/posthog";
import type { DemoRole } from "@/lib/posthog-config";
import { cn } from "@/lib/utils";
import type { RunView } from "@/server/assistant/actions";

type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: (e: {
    results: ArrayLike<ArrayLike<{ transcript: string }>>;
  }) => void;
  onend: () => void;
  onerror: () => void;
  start(): void;
};
type RecognitionCtor = new () => Recognition;

const noop = () => () => {};
function speechCtor(): RecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * The assistant transcript and composer. Every reply is an action run read
 * back from Postgres.
 *
 * 5.0.4-f: type scale + 44px targets apply on the phone `page` variant. The
 * desktop `rail` keeps 5.0.4-c sizing so job-page visual baselines (driven by
 * rail height via fitViewportToPage) stay stable. Compact mode (foreman phone
 * home) is unchanged from #16.
 */
export function AssistantPanel({
  runs,
  variant,
  demoRole,
  compact = false,
}: {
  runs: RunView[];
  variant: "rail" | "page";
  demoRole: DemoRole;
  /** Foreman phone home: input + last 3 messages, rest behind Show conversation. */
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState<AskState, FormData>(
    ask,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const pathname = usePathname();
  const [listening, setListening] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const canSpeak = useSyncExternalStore(
    noop,
    () => speechCtor() !== null,
    () => false,
  );
  const phone = variant === "page";
  const visibleRuns =
    compact && !showAll && runs.length > 3 ? runs.slice(-3) : runs;
  const hiddenCount =
    compact && !showAll && runs.length > 3 ? runs.length - 3 : 0;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const prompt = String(fd.get("prompt") ?? "").trim();
    if (!prompt) return;
    captureAiQuestionAsked({
      prompt,
      role: demoRole,
      path: pathname,
    });
  }

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [runs.length]);

  function send(text: string) {
    if (!inputRef.current) return;
    inputRef.current.value = text;
    formRef.current?.requestSubmit();
  }

  function listen() {
    const Ctor = speechCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-US";
    r.interimResults = false;
    r.onresult = (e) => send(e.results[0][0].transcript);
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    setListening(true);
    r.start();
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col",
        phone && "rounded-xl border bg-card",
      )}
      data-testid={`assistant-${variant}`}
    >
      <div
        className={cn(
          "flex items-center gap-2 border-b px-4 py-2.5 font-semibold",
          phone ? "text-body" : "text-sm",
        )}
      >
        <Sparkles className="size-4 text-brand" /> Assistant
        <span
          data-text="label"
          className={cn(
            "ml-auto font-normal text-muted-foreground",
            phone ? "text-label" : "text-xs",
          )}
        >
          Runs the same actions as the screens
        </span>
      </div>
      {hiddenCount > 0 ? (
        <div className="border-b px-4 py-2">
          <button
            type="button"
            className="tap-target text-label font-medium text-foreground underline underline-offset-2"
            data-testid="assistant-show-conversation"
            onClick={() => setShowAll(true)}
          >
            Show conversation ({hiddenCount} earlier)
          </button>
        </div>
      ) : null}
      <ol
        ref={listRef}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-4 p-4",
          variant === "rail" && "overflow-y-auto",
          compact && !showAll && "max-h-72 overflow-y-auto",
        )}
        aria-live="polite"
      >
        {visibleRuns.length === 0 && (
          <li
            data-text={phone ? "label" : undefined}
            className={cn(
              "text-muted-foreground",
              phone ? "text-label" : "text-sm",
            )}
          >
            Ask about cost, schedule or tomorrow&apos;s crew plan. Each answer
            shows the action it ran.
          </li>
        )}
        {visibleRuns.map((r) => (
          <li key={r.id} data-testid="assistant-message">
            <div
              className="flex flex-col gap-1.5"
              data-testid="action-run"
              data-action={r.action}
            >
            <div
              className={cn(
                "ml-6 self-end rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground",
                phone ? "text-body" : "text-sm",
              )}
            >
              {r.prompt}
            </div>
            <div
              className={cn(
                "mr-6 rounded-2xl rounded-bl-sm border bg-background px-3 py-2",
                phone ? "text-body" : "text-sm",
              )}
            >
              <p data-testid="action-summary">{r.summary}</p>
              <div
                data-text="label"
                className={cn(
                  "mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground",
                  phone ? "text-label" : "text-[11px]",
                )}
              >
                <span
                  className="rounded bg-muted px-1.5 py-0.5 text-foreground"
                  data-testid="action-name"
                >
                  {actionRailLabel(
                    r.action,
                    r.args.job ?? r.args.requested ?? null,
                    { refused: Boolean(r.args.refused) },
                  )}
                </span>
                {r.args.job && r.args.requested === null && (
                  <span data-testid="job-picked">job picked by the action</span>
                )}
                <span>
                  {r.userName} · <LocalTime iso={r.createdAt} />
                </span>
                {r.args.href && (
                  // Plain <a>: next/link still fires ?_rsc= after paint (even with
                  // prefetch={false}) and the desktop rail is visible at lg+, so
                  // those prefetches held cost-item networkidle in CI @1280.
                  <a
                    href={r.args.href}
                    className={cn(
                      "font-medium text-foreground underline underline-offset-2",
                      phone && "inline-flex min-h-11 items-center",
                    )}
                  >
                    Open
                  </a>
                )}
              </div>
            </div>
            </div>
          </li>
        ))}
        {pending && (
          <li
            data-text={phone ? "label" : undefined}
            className={cn(
              "text-muted-foreground",
              phone ? "text-label" : "text-sm",
            )}
          >
            Working…
          </li>
        )}
        {state.help && (
          <li
            data-text={phone ? "label" : undefined}
            className={cn(
              "text-muted-foreground",
              phone ? "text-label" : "text-sm",
            )}
            data-testid="assistant-help"
          >
            {state.help}
          </li>
        )}
      </ol>
      <div
        className="flex w-full min-w-0 flex-wrap gap-1.5 px-4 pb-2"
        data-testid="assistant-chips"
      >
        {examples.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => send(e)}
            disabled={pending}
            data-text="label"
            className={cn(
              "max-w-full min-w-11 whitespace-normal break-words rounded-full border text-left text-muted-foreground hover:bg-muted",
              phone ? "min-h-11 px-3 py-2 text-label" : "px-2.5 py-1 text-xs",
            )}
          >
            {e}
          </button>
        ))}
      </div>
      <form
        ref={formRef}
        action={formAction}
        onSubmit={onSubmit}
        className={cn(
          "flex items-center gap-2 border-t bg-card p-3",
          phone && "sticky bottom-[4.25rem] rounded-b-xl md:bottom-0",
        )}
      >
        {/*
          aria-label on the input — not a visually-hidden label. Tailwind
          `sr-only` uses overflow:hidden + 1×1 clip, which the phone clip
          scan counts as "Ask the assistant" (skill clipping @320).
        */}
        <input
          ref={inputRef}
          id={`prompt-${variant}`}
          name="prompt"
          aria-label="Ask the assistant"
          autoComplete="off"
          placeholder={listening ? "Listening…" : "Ask or tell me what to do"}
          className={cn(
            "min-w-0 flex-1 rounded-full border bg-background px-3.5 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring",
            phone ? "text-body" : "text-sm",
          )}
          data-testid="assistant-input"
          data-ph-unmask=""
        />
        {(phone || canSpeak) && (
          <button
            type="button"
            onClick={listen}
            aria-label="Speak"
            aria-pressed={listening}
            disabled={!canSpeak}
            className={cn(
              "grid place-items-center rounded-full border disabled:opacity-50",
              phone ? "size-11" : "size-9",
              listening && "bg-negative text-chrome-emphasis",
            )}
          >
            <Mic className="size-4" />
          </button>
        )}
        <button
          type="submit"
          aria-label="Send"
          disabled={pending}
          className={cn(
            "grid place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50",
            phone ? "size-11" : "size-9",
          )}
        >
          <ArrowUp className="size-4" />
        </button>
      </form>
    </div>
  );
}
