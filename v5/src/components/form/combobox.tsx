"use client";

import { useId, useMemo, useRef, useState } from "react";
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
  onChange?: (value: string) => void;
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
    onChange?.(o.value);
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
export function ChoiceField(props: React.ComponentProps<typeof Combobox>) {
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
      onChange={(e) => props.onChange?.(e.target.value)}
    />
  );
}
