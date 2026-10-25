"use client";

import Link from "next/link";
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

/** The assistant transcript and composer. Every reply is an action run read back from Postgres. */
export function AssistantPanel({
  runs,
  variant,
  demoRole,
}: {
  runs: RunView[];
  variant: "rail" | "page";
  demoRole: DemoRole;
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
  const canSpeak = useSyncExternalStore(
    noop,
    () => speechCtor() !== null,
    () => false,
  );

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
        variant === "page" && "rounded-xl border bg-card",
      )}
      data-testid={`assistant-${variant}`}
    >
      <div className="flex items-center gap-2 border-b px-4 py-2.5 text-sm font-semibold">
        <Sparkles className="size-4 text-brand" /> Assistant
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          Runs the same actions as the screens
        </span>
      </div>
      <ol
        ref={listRef}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-4 p-4",
          variant === "rail" && "overflow-y-auto",
        )}
        aria-live="polite"
      >
        {runs.length === 0 && (
          <li className="text-sm text-muted-foreground">
            Ask about cost, schedule or tomorrow&apos;s crew plan. Each answer
            shows the action it ran.
          </li>
        )}
        {runs.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-1.5"
            data-testid="action-run"
            data-action={r.action}
          >
            <div className="ml-6 self-end rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
              {r.prompt}
            </div>
            <div className="mr-6 rounded-2xl rounded-bl-sm border bg-background px-3 py-2 text-sm">
              <p data-testid="action-summary">{r.summary}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
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
                  <Link
                    href={r.args.href}
                    className="font-medium text-foreground underline underline-offset-2"
                  >
                    Open
                  </Link>
                )}
              </div>
            </div>
          </li>
        ))}
        {pending && <li className="text-sm text-muted-foreground">Working…</li>}
        {state.help && (
          <li
            className="text-sm text-muted-foreground"
            data-testid="assistant-help"
          >
            {state.help}
          </li>
        )}
      </ol>
      <div className="flex gap-1.5 overflow-x-auto px-4 pb-2">
        {examples.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => send(e)}
            disabled={pending}
            className="shrink-0 rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
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
          variant === "page" &&
            "sticky bottom-[4.25rem] rounded-b-xl md:bottom-0",
        )}
      >
        <label htmlFor={`prompt-${variant}`} className="sr-only">
          Ask the assistant
        </label>
        <input
          ref={inputRef}
          id={`prompt-${variant}`}
          name="prompt"
          autoComplete="off"
          placeholder={listening ? "Listening…" : "Ask or tell me what to do"}
          className="min-w-0 flex-1 rounded-full border bg-background px-3.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="assistant-input"
          data-ph-unmask=""
        />
        {canSpeak && (
          <button
            type="button"
            onClick={listen}
            aria-label="Speak"
            aria-pressed={listening}
            className={cn(
              "grid size-9 place-items-center rounded-full border",
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
          className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
        >
          <ArrowUp className="size-4" />
        </button>
      </form>
    </div>
  );
}
