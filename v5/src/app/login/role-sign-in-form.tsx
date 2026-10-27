"use client";

import { signIn } from "./actions";

/**
 * Role-card submit. Uses a full document navigation to `/app` so the login
 * page (and its `page-purpose`) leaves the DOM — Next soft redirects leave a
 * hidden `/login` `<main>` mounted, which doubles `[data-testid=page-purpose]`.
 */
export function RoleSignInForm({
  role,
  children,
}: {
  role: string;
  children: React.ReactNode;
}) {
  return (
    <form
      action={async (formData) => {
        const result = await signIn(formData);
        if (result?.ok) {
          window.location.assign("/app");
        } else {
          window.location.assign("/login");
        }
      }}
    >
      <input type="hidden" name="role" value={role} />
      {children}
    </form>
  );
}
