// Public landing page — the first thing a visitor sees before signing in.
// Server component: no auth required, no client-side JS.
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <div className="max-w-2xl space-y-6">
          {/* Product badge */}
          <div className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-sm text-muted-foreground">
            Built for Indian retail traders
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Quantify the cost of your trading biases.
          </h1>

          <p className="text-lg text-muted-foreground sm:text-xl">
            Most retail investors lose to themselves, not the market.
            AlphaJournal shows you how much.
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/auth/signin"
              className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
            >
              Sign in with Google
            </Link>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-1 gap-4 pt-8 text-left sm:grid-cols-3">
            <FeatureCard
              title="Frictionless journaling"
              description="Log trades with voice or text. AI auto-tags your strategy and emotional state."
            />
            <FeatureCard
              title="Bias engine"
              description="Disposition effect, revenge trading, and FOMO quantified in ₹ — not percentages."
            />
            <FeatureCard
              title="Shadow Portfolio"
              description="See exactly what you'd have made if you'd followed your own rules."
            />
          </div>
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      {/* Required by job description — fill in name, GitHub, LinkedIn below */}
      <footer className="border-t border-border px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 text-center text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <span>Built by Albin Joseph</span>
          <div className="flex gap-4">
            <a
              href="https://github.com/amous4822"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/albinj-ooz/"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              LinkedIn
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-card-foreground">
      <h3 className="mb-1 font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
