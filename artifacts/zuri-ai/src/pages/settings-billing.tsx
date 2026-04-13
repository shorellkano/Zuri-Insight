import { useState } from "react";
import { Link } from "wouter";
import { CreditCard, Zap, Check, X, TrendingUp, AlertTriangle, ChevronRight, ExternalLink } from "lucide-react";
import { usePlan } from "@/hooks/use-plan";
import { PLANS, formatPrice, planRank, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";

const PLAN_IDS: PlanId[] = ['solo', 'growth', 'studio', 'enterprise'];

const WHAT_REPLACES: Record<string, string> = {
  solo: "Replaces a part-time social media helper",
  growth: "Replaces a full social media manager (NGN 80k-150k/mo)",
  studio: "Replaces an agency retainer (NGN 200k-500k/mo)",
  enterprise: "Built for teams that need custom capacity",
};

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const unlimited = limit === -1;
  const pct = unlimited ? 0 : Math.min((used / limit) * 100, 100);
  const isHigh = pct >= 80;
  const isMax = pct >= 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-medium text-foreground">
          {unlimited ? <span className="text-green-600">Unlimited</span> : `${used} of ${limit} used`}
        </span>
      </div>
      {!unlimited && (
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isMax ? "bg-red-500" : isHigh ? "bg-amber-500" : "bg-primary"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function PlanCard({
  planId,
  currentPlanId,
  isAfrica,
  isAnnual,
  onUpgrade,
  upgrading,
}: {
  planId: PlanId;
  currentPlanId: PlanId;
  isAfrica: boolean;
  isAnnual: boolean;
  onUpgrade: (planId: PlanId) => void;
  upgrading: boolean;
}) {
  const plan = PLANS[planId];
  const isCurrent = planId === currentPlanId;
  const isEnterprise = planId === 'enterprise';
  const isUpgrade = planRank(planId) > planRank(currentPlanId);
  const isDowngrade = planRank(planId) < planRank(currentPlanId);
  const priceStr = formatPrice(planId, isAfrica, isAnnual);

  return (
    <div
      className={cn(
        "border rounded-2xl p-6 flex flex-col relative",
        plan.popular ? "border-amber-400 bg-amber-50/50" : "border-border bg-card",
        isCurrent && "border-primary bg-primary/5"
      )}
    >
      {plan.popular && !isCurrent && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[11px] font-bold px-3 py-0.5 rounded-full whitespace-nowrap">
          Most popular
        </span>
      )}
      {isCurrent && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[11px] font-bold px-3 py-0.5 rounded-full whitespace-nowrap">
          Your plan
        </span>
      )}

      <div className="mb-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{plan.name}</span>
      </div>
      <div className="text-[11px] text-muted-foreground italic mb-4">{plan.tagline}</div>

      {isEnterprise ? (
        <div className="text-2xl font-bold text-foreground mb-1">Custom</div>
      ) : (
        <div className="text-2xl font-bold text-foreground mb-1">
          {isAfrica ? "\u20a6" : "$"}{priceStr}
          {planId !== 'free' && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
        </div>
      )}

      {isAnnual && !isEnterprise && planId !== 'free' && (
        <div className="text-[11px] text-green-600 mb-2">billed annually - save 17%</div>
      )}

      <div className="text-[11px] text-muted-foreground italic mb-5 min-h-[32px]">{WHAT_REPLACES[planId]}</div>

      <ul className="space-y-2 mb-5 flex-1">
        {[
          { label: "Quick Create and captions", key: "quick_create" as const },
          { label: "Media upload and posting", key: "media_first_creation" as const },
          { label: "Multi-platform posting", key: "multi_platform_post" as const },
          { label: "Content calendar", key: "content_calendar" as const },
          { label: "Bulk planning", key: "bulk_planning" as const },
          { label: "Creative Studio", key: "creative_studio" as const },
          { label: "UGC video", key: "ugc_video" as const },
          { label: "Team workspace", key: "team_workspace" as const },
        ].map(({ label, key }) => {
          const included = plan.features[key];
          return (
            <li key={key} className="flex items-center gap-2 text-xs">
              {included
                ? <Check size={13} className="text-green-600 shrink-0" />
                : <X size={13} className="text-muted-foreground/40 shrink-0" />}
              <span className={cn(included ? "text-foreground" : "text-muted-foreground/50")}>{label}</span>
            </li>
          );
        })}
      </ul>

      <div className="flex gap-1.5 flex-wrap mb-4">
        <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
          {plan.limits.brands === -1 ? "Unlimited" : plan.limits.brands} brand{plan.limits.brands !== 1 ? "s" : ""}
        </span>
        <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
          {plan.limits.media_posts_monthly === -1 ? "Unlimited" : plan.limits.media_posts_monthly} posts/mo
        </span>
      </div>

      {isCurrent ? (
        <button disabled className="w-full py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground bg-muted cursor-not-allowed">
          Your current plan
        </button>
      ) : isEnterprise ? (
        <a href="mailto:hello@zuriai.co" className="block">
          <button className="w-full py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">
            Contact us
          </button>
        </a>
      ) : isUpgrade ? (
        <button
          onClick={() => onUpgrade(planId)}
          disabled={upgrading}
          className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {upgrading ? "Processing..." : `Upgrade to ${plan.name}`}
        </button>
      ) : isDowngrade ? (
        <button
          onClick={() => onUpgrade(planId)}
          disabled={upgrading}
          className="w-full py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          Downgrade to {plan.name}
        </button>
      ) : null}
    </div>
  );
}

export default function SettingsBilling() {
  const { planId, plan, isAfrica, usage, profile, loading } = usePlan();
  const [isAnnual, setIsAnnual] = useState(profile?.billing_cycle === 'annual');
  const [africaToggle, setAfricaToggle] = useState(isAfrica);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState("");

  async function handleUpgrade(targetPlan: PlanId) {
    setUpgrading(true);
    setUpgradeError("");
    try {
      const resp = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: targetPlan,
          billingCycle: isAnnual ? "annual" : "monthly",
        }),
      });
      const data = await resp.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setUpgradeError(data.error || "Could not start checkout. Please try again.");
      }
    } catch {
      setUpgradeError("Network error. Please try again.");
    } finally {
      setUpgrading(false);
    }
  }

  const renewalDate = profile?.current_period_end
    ? new Date(profile.current_period_end).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const mediaLimit = plan.limits.media_posts_monthly;
  const ugcLimit = plan.limits.ugc_videos_monthly;
  const brandsLimit = plan.limits.brands;

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="h-8 w-48 bg-muted animate-pulse rounded-lg mb-6" />
        <div className="h-40 bg-muted animate-pulse rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="settings-billing-page">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Billing and Plan</h1>
        <p className="text-muted-foreground mt-1">Manage your subscription and usage.</p>
      </div>

      {/* CURRENT PLAN CARD */}
      <div className="bg-card border border-amber-300/40 rounded-2xl p-6" data-testid="current-plan-card">
        {planId === 'free' ? (
          <div className="flex items-center gap-4 mb-5">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Your current plan</div>
              <div className="flex items-center gap-2">
                <span className="bg-muted text-foreground text-sm font-bold px-3 py-1 rounded-full">Free</span>
                <span className="text-sm text-muted-foreground">You are on the free plan</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Your current plan</div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-amber-100 text-amber-800 text-sm font-bold px-3 py-1 rounded-full">{plan.name}</span>
                <span className="text-sm text-muted-foreground">{profile?.billing_cycle === 'annual' ? "Billed annually" : "Billed monthly"}</span>
              </div>
              {renewalDate && (
                <div className="text-xs text-muted-foreground">Renews on {renewalDate}</div>
              )}
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-foreground mb-2">
                {formatPrice(planId, isAfrica, profile?.billing_cycle === 'annual')}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </div>
              <button
                onClick={async () => {
                  const resp = await fetch("/api/billing/portal", { method: "POST" });
                  const data = await resp.json();
                  if (data.url) window.location.href = data.url;
                }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg px-3 py-1.5"
              >
                <ExternalLink size={12} />
                Manage subscription
              </button>
            </div>
          </div>
        )}

        {/* Usage bars */}
        <div className="space-y-4">
          <UsageBar label="Media posts this month" used={usage.mediaPostsUsed} limit={mediaLimit} />
          {ugcLimit !== 0 && (
            <UsageBar label="UGC videos this month" used={usage.ugcVideosUsed} limit={ugcLimit} />
          )}
          <UsageBar label="Brands" used={usage.brandsCount} limit={brandsLimit} />
        </div>

        {planId === 'free' && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-center gap-2">
            <Zap size={15} className="text-amber-600 shrink-0" />
            Upgrade to unlock unlimited content, Creative Studio, scheduling, and more.
          </div>
        )}

        {usage.mediaPostsAtLimit && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0" />
            Media post limit reached. Upgrade your plan or wait until next month.
          </div>
        )}
      </div>

      {/* BILLING CYCLE TOGGLE */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-semibold text-foreground">Billing cycle</div>
            <div className="text-sm text-muted-foreground">Annual plans save 17% (2 months free)</div>
          </div>
          <div className="flex bg-muted rounded-xl p-1 gap-1">
            {[false, true].map(annual => (
              <button
                key={String(annual)}
                onClick={() => setIsAnnual(annual)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                  isAnnual === annual ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                )}
              >
                {annual ? "Annual" : "Monthly"}
                {annual && (
                  <span className="ml-1.5 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">
                    -17%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* AFRICA TOGGLE */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={africaToggle}
            onChange={e => setAfricaToggle(e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
          />
          <div>
            <div className="font-medium text-foreground">Africa pricing (NGN)</div>
            <div className="text-sm text-muted-foreground">Toggle for Naira pricing - for businesses based in Africa</div>
          </div>
        </label>
      </div>

      {/* PLAN CARDS */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-4">Choose your plan</h2>
        {upgradeError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {upgradeError}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PLAN_IDS.map(pid => (
            <PlanCard
              key={pid}
              planId={pid}
              currentPlanId={planId}
              isAfrica={africaToggle}
              isAnnual={isAnnual}
              onUpgrade={handleUpgrade}
              upgrading={upgrading}
            />
          ))}
        </div>
      </div>

      {/* BILLING HISTORY */}
      <div className="bg-card border border-border rounded-2xl p-6" data-testid="billing-history">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <CreditCard className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Payment history</h2>
            <p className="text-xs text-muted-foreground">Your past subscription payments</p>
          </div>
        </div>

        <BillingHistory />
      </div>

      {/* LINK TO PUBLIC PRICING */}
      <div className="text-center">
        <Link href="/pricing" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          View full feature comparison
          <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  );
}

function BillingHistory() {
  const [events, setEvents] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    fetch("/api/billing/history")
      .then(r => r.json())
      .then(data => { setEvents(data.events || []); setLoading(false); })
      .catch(() => { setEvents([]); setLoading(false); });
  });

  if (loading) {
    return <div className="h-16 bg-muted animate-pulse rounded-lg" />;
  }

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No payment history yet. Your payments will appear here after your first subscription.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Date</th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Plan</th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Amount</th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Provider</th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev: any) => (
            <tr key={ev.id} className="border-b border-border/50 hover:bg-muted/30">
              <td className="py-2.5 px-3 text-muted-foreground">
                {new Date(ev.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
              </td>
              <td className="py-2.5 px-3 capitalize font-medium text-foreground">{ev.plan}</td>
              <td className="py-2.5 px-3 text-foreground">
                {ev.currency === 'NGN' ? `\u20a6${Number(ev.amount).toLocaleString()}` : `$${ev.amount}`}
              </td>
              <td className="py-2.5 px-3 capitalize text-muted-foreground">{ev.provider}</td>
              <td className="py-2.5 px-3">
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                  <Check size={10} />
                  Paid
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
