import { Card } from "../components/Card.js";
import { Eyebrow } from "../components/Eyebrow.js";
import { LinkButton } from "../components/LinkButton.js";
import { MarketingHeader } from "../components/MarketingHeader.js";
import { MarketingFooter } from "../components/MarketingFooter.js";
import { useAuth } from "../context/AuthContext.js";

// SaaS phase S3, Phase 19 of the brief — "do NOT implement real payment/billing
// unless explicitly required... clearly label it as informational/mock if billing
// does not exist." Sketch2UI has no billing integration at all (confirmed in D0's
// audit), so every tier below routes to the same free registration flow and the page
// carries an explicit, un-missable "not live" notice rather than a checkout button
// that would silently do nothing (or worse, look real).
//
// 2026-08-27 — restyled to match Home.tsx's redesign (mono eyebrow tag instead of a
// pill Badge, tier "id" tags instead of decoration).

const TIERS = [
  {
    id: "01",
    name: "Free",
    price: "$0",
    body: "For trying the full pipeline on your own sketches.",
    features: ["Unlimited projects", "Component detection & correction", "Code editor & versioning", "Sandboxed preview & ZIP export"],
    highlight: true,
  },
  {
    id: "02",
    name: "Pro",
    price: "$—",
    body: "For heavier, ongoing use — illustrative tier, not yet available.",
    features: ["Everything in Free", "Priority detection processing", "Extended version history", "Multi-page project templates"],
    highlight: false,
  },
  {
    id: "03",
    name: "Enterprise",
    price: "Contact",
    body: "For teams — illustrative tier, not yet available.",
    features: ["Everything in Pro", "Team accounts & roles", "Audit logging", "Dedicated support"],
    highlight: false,
  },
] as const;

export default function Pricing() {
  const { status } = useAuth();

  return (
    <div className="min-h-full bg-bg">
      <MarketingHeader />

      <section className="mx-auto max-w-[880px] px-lg pb-xl pt-3xl text-center">
        <div className="flex justify-center">
          <Eyebrow>Pricing</Eyebrow>
        </div>
        <h1 className="mt-lg text-3xl font-semibold text-text-primary sm:text-4xl">Simple, illustrative pricing</h1>
        <p className="mx-auto mt-lg max-w-[520px] text-md text-text-secondary">
          Sketch2UI does not process payments yet. The tiers below describe the intended shape of the product, not
          a live billing plan — every "Get started" button below leads to the same free account.
        </p>
      </section>

      <div className="mx-auto max-w-[720px] px-lg pb-xl">
        <div className="rounded-md border border-warning/40 bg-warning-subtle px-lg py-md text-sm text-warning">
          <strong className="font-semibold">Not live.</strong> No plan here is billed. Registering creates a single
          free account with full access to every feature currently shipped.
        </div>
      </div>

      <section className="mx-auto max-w-[1120px] px-lg pb-3xl">
        <div className="grid gap-lg sm:grid-cols-3">
          {TIERS.map((tier) => (
            <Card
              key={tier.name}
              className={
                tier.highlight
                  ? "relative flex flex-col gap-md border-primary/40 ring-1 ring-primary/40"
                  : "flex flex-col gap-md"
              }
            >
              {tier.highlight && (
                <>
                  <span className="absolute -left-px -top-px h-4 w-4 border-l-2 border-t-2 border-primary" aria-hidden="true" />
                  <span className="absolute -right-px -top-px h-4 w-4 border-r-2 border-t-2 border-primary" aria-hidden="true" />
                </>
              )}
              <div className="flex items-baseline justify-between gap-sm">
                <h2 className="text-md font-semibold text-text-primary">{tier.name}</h2>
                <span className="font-mono text-2xs text-text-muted">{tier.id}</span>
              </div>
              <p className="text-sm text-text-secondary">{tier.body}</p>
              <p className="text-2xl font-semibold text-text-primary">
                {tier.price}
                {tier.name === "Free" && <span className="text-sm font-normal text-text-muted"> / forever</span>}
              </p>
              <ul className="flex flex-1 flex-col gap-xs text-sm text-text-secondary">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-xs">
                    <span aria-hidden="true" className="mt-2xs text-primary">
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <LinkButton
                to={status === "authenticated" ? "/app" : "/register"}
                variant={tier.name === "Free" ? "primary" : "secondary"}
                size="md"
              >
                {status === "authenticated" ? "Open App" : "Get started free"}
              </LinkButton>
            </Card>
          ))}
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
