"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Suspense } from "react";

type Props = {
  href: string;
  label: string;
  children: React.ReactNode;
  exact?: boolean;
  className?: string;
  activeClassName?: string;
};

/**
 * Shell nav / job-strip link. Uses a plain <a>, not next/link: under Next 16.4
 * + cacheComponents/partialPrefetching, Link still fires ?_rsc= prefetches after
 * first paint even with prefetch={false}, which holds verify networkidle
 * (~1.5 s) on cost-item drills at desktop. Full document navigations are fine
 * for chrome; hover SPA prefetch is not required.
 */
export function NavLink(props: Props) {
  const { href, label, children, className } = props;
  return (
    <Suspense
      fallback={
        <a href={href} aria-label={label} title={label} className={className}>
          {children}
        </a>
      }
    >
      <ActiveLink {...props} />
    </Suspense>
  );
}

function ActiveLink({
  href,
  label,
  children,
  exact = false,
  className,
  activeClassName,
}: Props) {
  const path = usePathname();
  const active = exact
    ? path === href
    : path === href || path.startsWith(`${href}/`);
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      className={cn(className, active && activeClassName)}
    >
      {children}
    </a>
  );
}
