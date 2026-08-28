// The one deliberate signature moment in this app's motion language — shown over the
// sketch while a Detect job is running. Reuses the SAME corner-bracket/viewfinder motif
// already established everywhere else (BrandMark, AnnotationCanvas's own selection
// brackets, the Fit-to-screen and Full-view toolbar icons, CanvasLegend's registration
// marks), rather than inventing a new visual idea for this one moment — the restraint is
// the point: a professional CV tool gets exactly one flourish, and it has to look like it
// belongs to the same object language as everything around it, not like a mascot bolted
// onto the side. Detection-model violet, not brand indigo or selection orange: this is
// specifically the "AI is looking" color everywhere else in the canvas too.
//
// Static brackets frame the whole sketch; the only moving part is one thin line
// sweeping top-to-bottom (the `animate-scan-sweep` keyframe in tailwind.config.js) with a
// soft glow — a flatbed-scanner/viewfinder-autofocus read, not a generic progress bar.
// `motion-reduce:hidden` on the line only — the static brackets still show, so reduced-
// motion users still see "something is happening here," just without the sweep.

const BRACKET_ARM = 16;

const CORNERS = [
  "left-0 top-0 border-l-2 border-t-2",
  "right-0 top-0 border-r-2 border-t-2",
  "left-0 bottom-0 border-b-2 border-l-2",
  "right-0 bottom-0 border-b-2 border-r-2",
] as const;

export function DetectionScanOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {CORNERS.map((cls) => (
        <span
          key={cls}
          className={`absolute border-detection-model ${cls}`}
          style={{ width: BRACKET_ARM, height: BRACKET_ARM }}
        />
      ))}
      <div
        className="absolute inset-x-0 h-px animate-scan-sweep bg-detection-model motion-reduce:hidden"
        style={{ boxShadow: "0 0 8px 1.5px rgba(139, 92, 246, 0.55)" }}
      />
    </div>
  );
}
