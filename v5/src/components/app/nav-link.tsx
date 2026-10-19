"use client";

import Link from "next/link";
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

/** A link that marks itself current. The pathname is request data, so it streams behind Suspense with a plain link as fallback. */
export function NavLink(props: Props) {
  const { href, label, children, className } = props;
  return (
    <Suspense
      fallback={
        <Link
          href={href}
          aria-label={label}
          title={label}
          className={className}
        >
          {children}
        </Link>
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
}: {
  href: string;
  label: string;
  children: React.ReactNode;
  exact?: boolean;
  className?: string;
  activeClassName?: string;
}) {
  const path = usePathname();
  const active = exact
    ? path === href
    : path === href || path.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      className={cn(className, active && activeClassName)}
    >
      {children}
    </Link>
  );
}
