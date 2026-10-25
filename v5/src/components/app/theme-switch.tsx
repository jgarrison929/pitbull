"use client";

import { useRouter } from "next/navigation";
import { setTheme } from "@/app/theme/actions";
import type { Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** Light/Dark control for the user menu. Cookie is set server-side; refresh applies SSR class. */
export function ThemeSwitch({ current }: { current: Theme }) {
  const router = useRouter();
  return (
    <div
      className="mt-3"
      data-testid="theme-switch"
      role="group"
      aria-label="Theme"
    >
      <div className="mb-1 text-xs text-muted-foreground">Theme</div>
      <div className="grid grid-cols-2 gap-1 rounded-md border p-0.5">
        {(["light", "dark"] as const).map((value) => {
          const selected = current === value;
          return (
            <form
              key={value}
              action={async (formData) => {
                await setTheme(formData);
                router.refresh();
              }}
            >
              <input type="hidden" name="theme" value={value} />
              <button
                type="submit"
                data-testid={`theme-${value}`}
                aria-pressed={selected}
                className={cn(
                  "w-full rounded-sm px-2 py-1.5 text-xs font-medium capitalize",
                  selected
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {value === "light" ? "Light" : "Dark"}
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}
