/** True when Try again is wired to the App Router `retry()` prop. */
export function retryWired(src: string): boolean {
  return /\bonClick=\{\(\)\s*=>\s*retry\(\)\}/.test(src);
}

/** True when JSX would surface the raw thrown message or digest to the user. */
export function rendersRawErrorMessage(src: string): boolean {
  return (
    /\{[^}]*error\.message/.test(src) ||
    /String\(\s*error\s*\)/.test(src) ||
    /Error id/.test(src)
  );
}
