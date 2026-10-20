"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Select, type Option } from "@/components/form/form";

/**
 * A searchable list for coded fields. Typing filters, arrows move, Enter picks, Escape closes.
 * Only listed values can be chosen: leaving the field with unmatched text restores the last pick.
 */
export function Combobox({
  id,
  name,
  options,
  defaultValue,
  onChange,
  disabled,
  invalid,
  describedBy,
}: {
  id: string;
  name: string;
  options: Option[];
  defaultValue: string;
  onChange?: (value: string, option?: Option) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const listId = useId();
  const [value, setValue] = useState(defaultValue);
  const selected = options.find((o) => o.value === value);
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q === selected?.label.toLowerCase()) return options;
    return options.filter((o) =>
      `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q),
    );
  }, [options, query, selected]);

  function pick(o: Option) {
    setValue(o.value);
    setQuery(o.label);
    setOpen(false);
    onChange?.(o.value, o);
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && shown[active] ? `${listId}-${active}` : undefined
        }
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        disabled={disabled}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setQuery(selected?.label ?? "");
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, shown.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && open) {
            e.preventDefault();
            if (shown[active]) pick(shown[active]);
          } else if (e.key === "Escape" && open) {
            e.stopPropagation();
            setOpen(false);
            setQuery(selected?.label ?? "");
          }
        }}
        className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-negative"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover p-1 text-sm shadow-lg"
        >
          {shown.length === 0 && (
            <li className="px-2 py-1.5 text-muted-foreground">No match</li>
          )}
          {shown.map((o, i) => (
            <li
              key={o.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.value === value}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "cursor-pointer rounded px-2 py-1.5",
                i === active && "bg-muted",
                o.value === value && "font-medium",
              )}
            >
              {o.label}
              {o.hint && (
                <span className="ml-1 text-xs text-muted-foreground">
                  {o.hint}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The one way to render a coded field: a select for short lists, a searchable combobox for long ones. */
export function ChoiceField(
  props: React.ComponentProps<typeof Combobox> & { searchUrl?: string },
) {
  if (props.searchUrl)
    return <AsyncCombobox {...props} searchUrl={props.searchUrl} />;
  if (props.options.length > 8) return <Combobox {...props} />;
  return (
    <Select
      id={props.id}
      name={props.name}
      options={props.options}
      defaultValue={props.defaultValue}
      disabled={props.disabled}
      aria-invalid={props.invalid || undefined}
      aria-describedby={props.describedBy}
      onChange={(e) => {
        const o = props.options.find((x) => x.value === e.target.value);
        props.onChange?.(e.target.value, o);
      }}
    />
  );
}

/**
 * Server-backed typeahead for large WBS. Debounced GET to searchUrl?q=;
 * only listed values can be chosen (same allow-list rule as Combobox).
 * Opening with the selected label searches with an empty q so the job's
 * codes appear — never `q=<full selected label>` → "No matches".
 */
export function AsyncCombobox({
  id,
  name,
  options: initial,
  defaultValue,
  onChange,
  disabled,
  invalid,
  describedBy,
  searchUrl,
}: React.ComponentProps<typeof Combobox> & { searchUrl: string }) {
  const listId = useId();
  const [value, setValue] = useState(defaultValue);
  const selected0 = initial.find((o) => o.value === value);
  const [query, setQuery] = useState(selected0?.label ?? "");
  const [options, setOptions] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === value) ?? selected0;
  const selectedLabel = selected?.label ?? selected0?.label ?? "";

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    // Same rule as the sync Combobox: selected label means "show the list".
    const searchQ =
      selectedLabel && q.toLowerCase() === selectedLabel.toLowerCase()
        ? ""
        : q;
    const t = setTimeout(() => {
      startTransition(async () => {
        const res = await fetch(
          `${searchUrl}?q=${encodeURIComponent(searchQ)}&limit=20`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { items: Option[] };
        // Keep the selected option in the list so the label never blanks after search.
        setOptions((prev) => {
          const keep =
            prev.find((o) => o.value === value) ??
            initial.find((o) => o.value === value);
          if (keep && !data.items.some((i) => i.value === keep.value)) {
            return [keep, ...data.items];
          }
          return data.items;
        });
        setActive(0);
      });
    }, 150);
    return () => clearTimeout(t);
  }, [query, open, searchUrl, selectedLabel, value, initial]);

  function pick(o: Option) {
    setValue(o.value);
    setQuery(o.label);
    setOpen(false);
    onChange?.(o.value, o);
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        disabled={disabled}
        value={query}
        data-testid="async-cost-search"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setQuery(selected?.label ?? "");
        }}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
            setOpen(true);
            return;
          }
          if (e.key === "Escape") {
            // Don't bubble — the plan-line form treats Escape as "cancel edit".
            e.stopPropagation();
            setOpen(false);
            setQuery(selected?.label ?? "");
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, Math.max(0, options.length - 1)));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          }
          if (e.key === "Enter" && options[active]) {
            e.preventDefault();
            pick(options[active]);
          }
        }}
        className={cn(
          "flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none",
          invalid && "border-destructive",
        )}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-sm shadow-md"
        >
          {options.length === 0 ? (
            <li className="px-2 py-1.5 text-muted-foreground">No matches</li>
          ) : (
            options.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-1.5",
                  i === active && "bg-accent",
                )}
              >
                {o.label}
                {o.hint ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {o.hint}
                  </span>
                ) : null}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
