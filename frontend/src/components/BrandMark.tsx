// brand mark. A corner-bracket / registration-mark motif deliberately echoing the canvas's
// own detection-box resize handles (four corner squares around a rect) — the one piece of
// "identity" this app already draws well, reused here instead of an unrelated invented
// logo.

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" className={className} aria-hidden="true">
      <path
        d="M2 7V3.5A1.5 1.5 0 0 1 3.5 2H7M18 7V3.5A1.5 1.5 0 0 0 16.5 2H13M2 13v3.5A1.5 1.5 0 0 0 3.5 18H7M18 13v3.5a1.5 1.5 0 0 1-1.5 1.5H13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect x="8" y="8" width="4" height="4" rx="0.5" fill="currentColor" />
    </svg>
  );
}
