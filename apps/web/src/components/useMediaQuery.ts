import { useEffect, useState } from "react";

// docs/frontend/responsive-design.md — the breakpoint tiers (desktop ≥1280, laptop
// 1024–1279, tablet 768–1023, mobile <768) are implemented as plain media queries
// via this hook, not a JS-measured width — same source of truth the CSS itself would
// use, so there's no drift between "what a breakpoint class shows" and "what this
// hook reports."

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handleChange = () => setMatches(mql.matches);
    handleChange();
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}
