"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Every click in a prototype does something visible; nothing is sent anywhere. */
export function DemoButton({
  children,
  done,
  variant,
  className,
}: {
  children: React.ReactNode;
  done: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
}) {
  const [clicked, setClicked] = useState(false);
  return (
    <Button
      variant={variant}
      className={className}
      onClick={() => setClicked(true)}
      aria-live="polite"
    >
      {clicked ? (
        <>
          <Check /> {done}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
