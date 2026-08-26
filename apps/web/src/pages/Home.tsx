import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Badge } from "../components/Badge.js";
import { Card } from "../components/Card.js";
import { LinkButton } from "../components/LinkButton.js";
import { MarketingHeader } from "../components/MarketingHeader.js";
import { MarketingFooter } from "../components/MarketingFooter.js";
import { useAuth } from "../context/AuthContext.js";

// SaaS phase S3 — public marketing site. Product-structure/design-direction inspired
// by a supplied SaaS reference (per the brief); no wording, statistics, or visual
// assets were copied from it. Every capability named below is real and already shipped
// (cross-checked against PROJECT_STATUS.md and packages/shared-types/src/taxonomy.ts
// during the D0 audit) — no invented stats ("10K+ users" etc.), consistent with the
// design-direction.md constraint against decoration that doesn't encode information.
//
// Section ids (#features, #how-it-works) are the anchor targets MarketingHeader/
// MarketingFooter link to, including from Pricing ("/#features"). The effect below
// handles both a fresh load with a hash already in the URL and an in-page nav click
// that only changes the hash on an already-mounted Home.

function useHashScroll() {
  const location = useLocation();
  useEffect(() => {
    if (!location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash]);
}

function SectionHeading({ eyebrow, title, lede }: { eyebrow: string; title: string; lede?: string }) {
  return (
    <div className="mx-auto max-w-[640px] text-center">
      <Badge tone="brand">{eyebrow}</Badge>
      <h2 className="mt-md text-xl font-semibold text-text-primary sm:text-2xl">{title}</h2>
      {lede && <p className="mt-sm text-md text-text-secondary">{lede}</p>}
    </div>
  );
}

// Small outline icons, matching the app's existing hand-rolled icon convention
// (Dashboard.tsx's TrashIcon/SearchIcon) rather than pulling in a new icon library for
// one page — 1.5px stroke, geometric, per design-direction.md.

function UploadIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M10 12.5V3.5M10 3.5L6.5 7M10 3.5l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 13v2a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M3.5 6.5v-2A1 1 0 0 1 4.5 3.5h2M13.5 3.5h2a1 1 0 0 1 1 1v2M16.5 13.5v2a1 1 0 0 1-1 1h-2M6.5 16.5h-2a1 1 0 0 1-1-1v-2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="7" y="7" width="6" height="6" rx="0.5" />
    </svg>
  );
}

function CorrectIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M12.4 3.6l4 4-9 9H3.4v-4l9-9Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M7 6l-4 4 4 4M13 6l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M10 3.5v8M10 11.5L7 8.5M10 11.5l3-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 13v2a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M10 3.5 3 7.5l7 4 7-4-7-4Z" strokeLinejoin="round" />
      <path d="M3 12.5l7 4 7-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M4 5h12M4 10h12M4 15h12" strokeLinecap="round" />
      <circle cx="7.5" cy="5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="13" cy="10" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="9" cy="15" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="10" cy="10.5" r="6.2" />
      <path d="M10 7.2v3.6l2.4 1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.4 3.6 4.6 5.4" strokeLinecap="round" />
    </svg>
  );
}

function PreviewIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M2.5 10S5.2 4.8 10 4.8 17.5 10 17.5 10 14.8 15.2 10 15.2 2.5 10 2.5 10Z" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2.2" />
    </svg>
  );
}

function PagesIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="5.5" y="3" width="10" height="13" rx="1" />
      <path d="M4.5 5.5H3M4.5 8.5H3M4.5 11.5H3" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M10 2.8 16 5v4.3c0 4-2.6 6.9-6 8.2-3.4-1.3-6-4.2-6-8.2V5l6-2.2Z" strokeLinejoin="round" />
      <path d="M7.3 10.1l1.9 1.9 3.5-3.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PIPELINE_STEPS = [
  { icon: UploadIcon, title: "Upload your sketch", body: "Photograph or scan a hand-drawn wireframe and upload it to a project." },
  { icon: ScanIcon, title: "Detect components", body: "A trained detector finds buttons, cards, navigation, and text inside the page boundary." },
  { icon: CorrectIcon, title: "Correct and refine", body: "Reclassify, resize, reparent, or remove any detection — every correction is recorded, never silently overwritten." },
  { icon: CodeIcon, title: "Generate code", body: "Real semantic HTML and CSS are generated from the corrected layout, with a live sandboxed preview." },
  { icon: ExportIcon, title: "Export", body: "Download a self-contained ZIP with your HTML, CSS, image crops, and the original sketch." },
] as const;

const CORE_FEATURES = [
  { icon: ScanIcon, title: "Component detection", body: "A trained detector proposes structural, content, and interactive elements straight from your sketch photo." },
  { icon: LayersIcon, title: "Page boundary detection", body: "The page's edges in the photo are found automatically, or adjust the boundary by hand." },
  { icon: CorrectIcon, title: "Manual correction", body: "Every detection can be reclassified, resized, reparented, or removed on the canvas." },
  { icon: SlidersIcon, title: "Style, Content, Geometry & Structure Inspector", body: "Four focused panels for fine-tuning spacing, text, position, and hierarchy on any element." },
  { icon: HistoryIcon, title: "Versioned code editor", body: "Hand-edit the generated HTML and CSS; every save creates a new immutable version you can revert to." },
  { icon: PreviewIcon, title: "Live sandboxed preview", body: "See the generated page render in a sandboxed frame before you export it." },
  { icon: PagesIcon, title: "Multi-page projects", body: "Add pages to a project, each with its own sketch and generated code, linked together and exported as one bundle." },
  { icon: ExportIcon, title: "Self-contained export", body: "A ZIP with your HTML, CSS, real image crops, and the original sketch — ready to open in a browser." },
] as const;

const WHY_POINTS = [
  { title: "Human-in-the-loop, not black-box", body: "The detector proposes, you decide. A model correction never silently overwrites a human one — that rule holds for the page boundary too." },
  { title: "Real, inspectable output", body: "No proprietary format. The HTML and CSS you see in preview is exactly what you export." },
  { title: "Built for iteration", body: "Every code version is kept and every correction is logged, so you can always see how a page got to where it is." },
] as const;

const COMPONENT_GROUPS = [
  { label: "Structural", items: ["page", "header", "section", "footer", "navbar", "sidebar", "form", "card", "table"] },
  { label: "Content", items: ["logo", "heading", "text", "link", "image", "video", "icon", "avatar", "nav_item", "carousel"] },
  { label: "Interactive", items: ["button", "input", "textarea", "select", "menu_button", "search_box", "checkbox", "radio_button"] },
] as const;

const TRUST_POINTS = [
  { title: "Durable persistence", body: "Every project, correction, and code version is stored in PostgreSQL — not just held in browser memory." },
  { title: "Sandboxed preview", body: "The live preview renders in an iframe with no script execution (sandbox=\"\"), so a generated page can never run code against your session." },
  { title: "Immutable code versions", body: "Saving never overwrites history — you can always activate an older version of a page's code." },
  { title: "Your projects, your account", body: "Every project belongs to the account that created it. Nothing is visible across accounts." },
] as const;

function HeroCTA() {
  const { status } = useAuth();
  return status === "authenticated" ? (
    <LinkButton to="/app" variant="primary" size="lg">
      Open App
    </LinkButton>
  ) : (
    <LinkButton to="/register" variant="primary" size="lg">
      Start Building
    </LinkButton>
  );
}

function BottomCTA() {
  const { status } = useAuth();
  return status === "authenticated" ? (
    <LinkButton to="/app" variant="primary" size="lg">
      Open App
    </LinkButton>
  ) : (
    <LinkButton to="/register" variant="primary" size="lg">
      Start Building — it's free
    </LinkButton>
  );
}

export default function Home() {
  useHashScroll();

  return (
    <div className="min-h-full bg-bg">
      <MarketingHeader />

      {/* Hero */}
      <section className="mx-auto max-w-[880px] px-lg pb-3xl pt-3xl text-center sm:pt-[64px]">
        <Badge tone="brand">Sketch to working UI</Badge>
        <h1 className="mt-lg text-4xl font-semibold leading-tight text-text-primary sm:text-5xl">
          Turn hand-drawn wireframes into working websites.
        </h1>
        <p className="mx-auto mt-lg max-w-[560px] text-md text-text-secondary">
          Draw a layout on paper, upload the photo, and Sketch2UI detects each component, lets you correct it by
          hand, and generates real HTML and CSS you can preview, edit, and export.
        </p>
        <div className="mt-xl flex flex-wrap items-center justify-center gap-sm">
          <HeroCTA />
          <a
            href="#how-it-works"
            className="inline-flex h-10 items-center justify-center rounded-sm px-lg text-md font-medium text-text-secondary transition-colors duration-fast hover:text-text-primary"
          >
            See how it works
          </a>
        </div>
      </section>

      {/* Product demonstration — a schematic of the real pipeline, not a screenshot */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-[1120px] px-lg py-2xl">
          <div className="grid grid-cols-2 gap-sm sm:grid-cols-5">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step.title} className="flex flex-col items-center gap-xs rounded-md border border-border p-md text-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-subtle text-primary">
                  <step.icon />
                </span>
                <span className="font-mono text-2xs text-text-muted">{`0${i + 1}`}</span>
                <span className="text-sm font-medium text-text-primary">{step.title}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-[1120px] px-lg py-3xl">
        <SectionHeading
          eyebrow="How it works"
          title="From a photo of a sketch to an exported page"
          lede="Five steps, the same ones the workspace walks you through on every project."
        />
        <div className="mt-2xl grid gap-lg lg:grid-cols-5">
          {PIPELINE_STEPS.map((step, i) => (
            <Card key={step.title} className="flex flex-col gap-sm">
              <div className="flex items-center gap-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-subtle text-primary">
                  <step.icon />
                </span>
                <span className="font-mono text-2xs text-text-muted">{`Step ${i + 1}`}</span>
              </div>
              <h3 className="text-sm font-semibold text-text-primary">{step.title}</h3>
              <p className="text-sm text-text-secondary">{step.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Core features */}
      <section id="features" className="border-t border-border bg-surface">
        <div className="mx-auto max-w-[1120px] px-lg py-3xl">
          <SectionHeading
            eyebrow="Core features"
            title="Everything from first detection to final export"
            lede="The same tools that power the workspace, not a stripped-down demo of them."
          />
          <div className="mt-2xl grid gap-lg sm:grid-cols-2 lg:grid-cols-4">
            {CORE_FEATURES.map((f) => (
              <Card key={f.title} className="flex flex-col gap-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-subtle text-primary">
                  <f.icon />
                </span>
                <h3 className="text-sm font-semibold text-text-primary">{f.title}</h3>
                <p className="text-sm text-text-secondary">{f.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Why Sketch2UI */}
      <section className="mx-auto max-w-[1120px] px-lg py-3xl">
        <SectionHeading eyebrow="Why Sketch2UI" title="Precision over automation theater" />
        <div className="mt-2xl grid gap-lg sm:grid-cols-3">
          {WHY_POINTS.map((p) => (
            <div key={p.title} className="rounded-md border border-border p-lg">
              <h3 className="text-sm font-semibold text-text-primary">{p.title}</h3>
              <p className="mt-xs text-sm text-text-secondary">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow — multi-page projects */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto grid max-w-[1120px] items-center gap-2xl px-lg py-3xl lg:grid-cols-2">
          <div>
            <Badge tone="brand">Workflow</Badge>
            <h2 className="mt-md text-xl font-semibold text-text-primary sm:text-2xl">
              One project, as many pages as your site needs
            </h2>
            <p className="mt-sm text-md text-text-secondary">
              A project can hold multiple pages. Each page keeps its own sketch, detections, and generated code —
              detect and generate them independently, link one page to another, then export the whole project as
              one bundle with a single shared stylesheet.
            </p>
          </div>
          <div className="flex flex-wrap gap-sm">
            {["Page 1", "Page 2", "Page 3"].map((label) => (
              <div key={label} className="flex w-[140px] flex-col gap-xs rounded-md border border-border bg-bg p-sm">
                <div className="flex items-center gap-2xs">
                  <PagesIcon />
                  <span className="text-xs font-medium text-text-primary">{label}</span>
                </div>
                <div className="h-14 rounded-sm border border-dashed border-border-strong bg-surface" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported UI components */}
      <section className="mx-auto max-w-[1120px] px-lg py-3xl">
        <SectionHeading
          eyebrow="Supported components"
          title="A taxonomy built for real UI, not a toy demo"
          lede="Detection accuracy currently varies by component type — the detector is labeled Beta in the app, and every detection can be corrected by hand."
        />
        <div className="mt-2xl grid gap-lg sm:grid-cols-3">
          {COMPONENT_GROUPS.map((group) => (
            <div key={group.label} className="rounded-md border border-border p-lg">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{group.label}</h3>
              <div className="mt-sm flex flex-wrap gap-2xs">
                {group.items.map((item) => (
                  <span key={item} className="rounded-sm bg-surface-sunken px-xs py-2xs font-mono text-2xs text-text-secondary">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Technology / trust */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-[1120px] px-lg py-3xl">
          <SectionHeading eyebrow="Technology" title="Built to be inspected, not just trusted" />
          <div className="mt-2xl grid gap-lg sm:grid-cols-2 lg:grid-cols-4">
            {TRUST_POINTS.map((p) => (
              <div key={p.title} className="flex flex-col gap-xs rounded-md border border-border p-lg">
                <ShieldIcon />
                <h3 className="text-sm font-semibold text-text-primary">{p.title}</h3>
                <p className="text-sm text-text-secondary">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="mx-auto max-w-[640px] px-lg py-3xl text-center">
        <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">
          Start turning sketches into working pages.
        </h2>
        <div className="mt-lg flex justify-center">
          <BottomCTA />
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
