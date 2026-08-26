import { Badge } from "../components/Badge.js";
import { Card } from "../components/Card.js";
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

const TIERS = [
  {
    name: "Free",
    price: "$0",
    body: "For trying the full pipeline on your own sketches.",
    features: ["Unlimited projects", "Component detection & correction", "Code editor & versioning", "Sandboxed preview & ZIP export"],
  },
  {
    name: "Pro",
    price: "$—",
    body: "For heavier, ongoing use — illustrative tier, not yet available.",
    features: ["Everything in Free", "Priority detection processing", "Extended version history", "Multi-page project templates"],
  },
  {
    name: "Enterprise",
    price: "Contact",
    body: "For teams — illustrative tier, not yet available.",
    features: ["Everything in Pro", "Team accounts & roles", "Audit logging", "Dedicated support"],
  },
] as const;

export default function Pricing() {
  const { status } = useAuth();

  return (
    <div className="min-h-full bg-bg">
      <MarketingHeader />

      <section className="mx-auto max-w-[880px] px-lg pb-xl pt-3xl text-center">
        <Badge tone="brand">Pricing</Badge>
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
            <Card key={tier.name} className="flex flex-col gap-md">
              <div>
                <h2 className="text-md font-semibold text-text-primary">{tier.name}</h2>
                <p className="mt-2xs text-sm text-text-secondary">{tier.body}</p>
              </div>
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
