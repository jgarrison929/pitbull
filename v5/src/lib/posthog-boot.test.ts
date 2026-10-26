import { describe, expect, it, vi } from "vitest";
import {
  POSTHOG_BOOT_MIN_DELAY_MS,
  schedulePostHogBoot,
} from "./posthog-boot";

describe("schedulePostHogBoot", () => {
  it("waits for load, min delay, then idle before booting", () => {
    const boot = vi.fn();
    const timers: Array<{ id: number; ms: number; fn: () => void }> = [];
    let nextId = 1;
    let loadHandler: (() => void) | undefined;
    let idleCb: IdleRequestCallback | undefined;

    const cancel = schedulePostHogBoot(boot, {
      minDelayMs: POSTHOG_BOOT_MIN_DELAY_MS,
      schedule: {
        readyState: "loading",
        setTimeout: ((fn: () => void, ms: number) => {
          const id = nextId++;
          timers.push({ id, ms, fn });
          return id as unknown as ReturnType<typeof setTimeout>;
        }) as typeof setTimeout,
        clearTimeout: ((id: ReturnType<typeof setTimeout>) => {
          const i = timers.findIndex((t) => t.id === (id as unknown as number));
          if (i >= 0) timers.splice(i, 1);
        }) as typeof clearTimeout,
        requestIdleCallback: (cb) => {
          idleCb = cb;
          return 99;
        },
        cancelIdleCallback: vi.fn(),
        addLoadListener: (handler) => {
          loadHandler = handler;
        },
        removeLoadListener: vi.fn(),
      },
    });

    expect(boot).not.toHaveBeenCalled();
    expect(timers).toHaveLength(0);

    loadHandler!();
    expect(timers).toHaveLength(1);
    expect(timers[0]!.ms).toBe(POSTHOG_BOOT_MIN_DELAY_MS);
    expect(boot).not.toHaveBeenCalled();

    timers[0]!.fn();
    expect(idleCb).toBeTypeOf("function");
    expect(boot).not.toHaveBeenCalled();

    idleCb!({
      didTimeout: false,
      timeRemaining: () => 10,
    } as IdleDeadline);
    expect(boot).toHaveBeenCalledOnce();

    cancel();
  });

  it("cancel before delay prevents boot", () => {
    const boot = vi.fn();
    const timers: Array<{ id: number; fn: () => void }> = [];
    let nextId = 1;

    const cancel = schedulePostHogBoot(boot, {
      minDelayMs: 100,
      schedule: {
        readyState: "complete",
        setTimeout: ((fn: () => void) => {
          const id = nextId++;
          timers.push({ id, fn });
          return id as unknown as ReturnType<typeof setTimeout>;
        }) as typeof setTimeout,
        clearTimeout: ((id: ReturnType<typeof setTimeout>) => {
          const i = timers.findIndex((t) => t.id === (id as unknown as number));
          if (i >= 0) timers.splice(i, 1);
        }) as typeof clearTimeout,
        requestIdleCallback: (cb) => {
          cb({ didTimeout: false, timeRemaining: () => 1 } as IdleDeadline);
          return 1;
        },
      },
    });

    expect(timers).toHaveLength(1);
    cancel();
    expect(timers).toHaveLength(0);
    expect(boot).not.toHaveBeenCalled();
  });

  it("boots via setTimeout path when requestIdleCallback is missing", () => {
    const boot = vi.fn();
    let delayFn: (() => void) | undefined;

    schedulePostHogBoot(boot, {
      minDelayMs: 50,
      schedule: {
        readyState: "complete",
        setTimeout: ((fn: () => void) => {
          delayFn = fn;
          return 1 as unknown as ReturnType<typeof setTimeout>;
        }) as typeof setTimeout,
        clearTimeout: vi.fn() as unknown as typeof clearTimeout,
        // no requestIdleCallback
      },
    });

    expect(boot).not.toHaveBeenCalled();
    delayFn!();
    expect(boot).toHaveBeenCalledOnce();
  });
});
