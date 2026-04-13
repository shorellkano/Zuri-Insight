import { useState } from "react";
import { Link } from "wouter";
import { Check, X, ChevronDown } from "lucide-react";
import { PLANS, formatPrice, type PlanId } from "@/lib/plans";

const Z_ORANGE = "#E05C2A";
const Z_ORANGE_DARK = "#C4391A";
const Z_TEAL = "#2A9D8A";
const Z_BG = "#0C0A08";
const Z_SURFACE = "#141210";
const Z_TEXT = "#F5F0EB";
const Z_MUTED = "rgba(245,240,235,0.5)";
const Z_FAINT = "rgba(245,240,235,0.3)";
const Z_BORDER = "rgba(255,255,255,0.06)";
const Z_BORDER_STRONG = "rgba(255,255,255,0.12)";

const PLAN_IDS: PlanId[] = ['solo', 'growth', 'studio', 'enterprise'];

const WHAT_REPLACES: Record<string, string> = {
  solo: "Replaces a part-time social media helper",
  growth: "Replaces a full social media manager (NGN 80k-150k/mo)",
  studio: "Replaces an agency retainer (NGN 200k-500k/mo)",
  enterprise: "Built for teams that need custom capacity",
};

const FEATURE_ROWS = [
  { label: "Brands", key: "brands", type: "limit" as const, limitKey: "brands" as const },
  { label: "Media posts per month", key: "media_posts", type: "limit" as const, limitKey: "media_posts_monthly" as const },
  { label: "Platforms connected", key: "platforms", type: "limit" as const, limitKey: "platforms_connected" as const },
  { label: "UGC video generation", key: "ugc", type: "ugc" as const, limitKey: "ugc_videos_monthly" as const },
  { label: "Team members", key: "team", type: "limit" as const, limitKey: "team_members" as const },
  { label: "Quick Create and captions", key: "quick_create", type: "feature" as const, featureKey: "quick_create" as const },
  { label: "Media upload and posting", key: "media_first", type: "feature" as const, featureKey: "media_first_creation" as const },
  { label: "Caption enhancement", key: "caption", type: "feature" as const, featureKey: "caption_enhancement" as const },
  { label: "Multi-platform posting", key: "multi", type: "feature" as const, featureKey: "multi_platform_post" as const },
  { label: "Post scheduling", key: "scheduling", type: "feature" as const, featureKey: "scheduling" as const },
  { label: "Content calendar", key: "calendar", type: "feature" as const, featureKey: "content_calendar" as const },
  { label: "Bulk week and month planner", key: "bulk", type: "bulk" as const, limitKey: "bulk_plan_days" as const },
  { label: "Brand calendar with events", key: "brand_cal", type: "feature" as const, featureKey: "brand_calendar" as const },
  { label: "Voice File", key: "voice", type: "voice" as const, limitKey: "voice_examples" as const },
  { label: "Lessons Bank", key: "lessons", type: "feature" as const, featureKey: "lessons_bank" as const },
  { label: "Creative Studio", key: "creative", type: "feature" as const, featureKey: "creative_studio" as const },
  { label: "Carousel builder", key: "carousel", type: "feature" as const, featureKey: "carousel_builder" as const },
  { label: "Client approval workflows", key: "approvals", type: "feature" as const, featureKey: "client_approvals" as const },
  { label: "Analytics dashboard", key: "analytics", type: "feature" as const, featureKey: "analytics" as const },
  { label: "Priority support", key: "support", type: "feature" as const, featureKey: "priority_support" as const },
  { label: "API access", key: "api", type: "feature" as const, featureKey: "api_access" as const },
  { label: "White label", key: "white", type: "feature" as const, featureKey: "white_label" as const },
];

const FAQ_ITEMS = [
  {
    q: "Can I change my plan at any time?",
    a: "Yes. You can upgrade immediately and your new features activate straight away. Downgrading takes effect at the end of your current billing period.",
  },
  {
    q: "What is Africa pricing?",
    a: "We price specifically for African markets because we know the economic reality. If your billing address is in Nigeria, Kenya, Ghana, South Africa, Egypt, Senegal, Ethiopia, Tanzania, Uganda, Rwanda, Cameroon, or Cote d'Ivoire, you qualify for Africa pricing - verified automatically at checkout.",
  },
  {
    q: "Do you offer annual billing?",
    a: "Yes. Annual plans save you 17% - equivalent to getting 2 months free. You can switch between monthly and annual at any time.",
  },
  {
    q: "What happens when I hit my media post limit?",
    a: "You will see a notification when you reach 80% of your limit. At 100% you can purchase a top-up (30 posts for NGN 2,500 or $2), or upgrade your plan for unlimited posts.",
  },
  {
    q: "Do you offer refunds?",
    a: "We offer a 7-day money-back guarantee on your first payment. After that, payments are non-refundable but you keep access until the end of your billing period.",
  },
  {
    q: "Which payment methods do you accept?",
    a: "For Africa: Paystack (card, bank transfer, USSD, mobile money). For global: Stripe (all major credit and debit cards).",
  },
  {
    q: "Is my content data private?",
    a: "Completely. Your Brand DNA, voice files, uploaded media, and generated content are private to your account. We never use your data to train AI models or share it with third parties.",
  },
  {
    q: "Can I use Zuri AI for multiple businesses?",
    a: "Yes. Growth plan supports 3 brands, Studio supports 10, Enterprise supports unlimited. Each brand has its own Brand DNA and content library.",
  },
];

function limitDisplay(value: number, ugcSuffix = false): string {
  if (value === -1) return "Unlimited";
  if (ugcSuffix) return value === 0 ? "None" : `${value}/mo`;
  return String(value);
}

function getCellValue(row: typeof FEATURE_ROWS[0], planId: PlanId): React.ReactNode {
  const plan = PLANS[planId];
  if (row.type === 'feature') {
    const val = plan.features[row.featureKey!];
    return val
      ? <Check size={16} color={Z_TEAL} strokeWidth={2.5} />
      : <X size={16} color="rgba(245,240,235,0.2)" strokeWidth={2} />;
  }
  if (row.type === 'limit') {
    const val = plan.limits[row.limitKey!];
    return <span style={{ fontSize: 13, color: val === -1 ? Z_TEAL : Z_TEXT }}>{limitDisplay(val)}</span>;
  }
  if (row.type === 'ugc') {
    const val = plan.limits.ugc_videos_monthly;
    if (val === -1) return <span style={{ fontSize: 13, color: Z_TEAL }}>Unlimited</span>;
    if (val === 0) return <X size={16} color="rgba(245,240,235,0.2)" strokeWidth={2} />;
    return <span style={{ fontSize: 13, color: Z_TEXT }}>{val}/mo</span>;
  }
  if (row.type === 'bulk') {
    const days = plan.limits.bulk_plan_days;
    if (days === 0) return <X size={16} color="rgba(245,240,235,0.2)" strokeWidth={2} />;
    return <span style={{ fontSize: 13, color: Z_TEXT }}>{days} days</span>;
  }
  if (row.type === 'voice') {
    const ex = plan.limits.voice_examples;
    if (ex === -1) return <Check size={16} color={Z_TEAL} strokeWidth={2.5} />;
    return <span style={{ fontSize: 13, color: Z_TEXT }}>{ex} examples</span>;
  }
  return null;
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${Z_BORDER}` }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", textAlign: "left", padding: "18px 0",
          background: "transparent", border: "none", cursor: "pointer",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: Z_TEXT }}>{q}</span>
        <ChevronDown
          size={18}
          color={Z_MUTED}
          style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
        />
      </button>
      {open && (
        <p style={{ fontSize: 14, color: Z_MUTED, lineHeight: 1.7, paddingBottom: 18, marginTop: -4 }}>{a}</p>
      )}
    </div>
  );
}

export default function Pricing() {
  const [isAfrica, setIsAfrica] = useState(true);
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <div style={{ background: Z_BG, color: Z_TEXT, fontFamily: "Inter, system-ui, sans-serif", minHeight: "100vh" }}>

      {/* NAV */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(12,10,8,0.92)", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${Z_BORDER}`,
        padding: "0 48px", height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            backgroundImage: "url('/zuri-logo-head.png')",
            backgroundSize: "126px 84px", backgroundPosition: "-47px -18px", backgroundRepeat: "no-repeat",
          }} />
          <span style={{ fontSize: 18, fontWeight: 700, color: Z_TEXT }}>Zuri <span style={{ color: Z_ORANGE }}>AI</span></span>
        </Link>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/login">
            <button style={{ background: "transparent", border: `1px solid ${Z_BORDER_STRONG}`, color: Z_TEXT, padding: "8px 18px", borderRadius: 8, fontSize: 14, cursor: "pointer" }}>Sign in</button>
          </Link>
          <Link href="/signup">
            <button style={{ background: Z_ORANGE, border: "none", color: "#fff", padding: "8px 18px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Get started</button>
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ textAlign: "center", padding: "80px 24px 48px" }}>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 900, letterSpacing: "-2px", marginBottom: 12 }}>
          Simple, honest <span style={{ color: Z_ORANGE }}>pricing.</span>
        </h1>
        <p style={{ fontSize: 17, color: Z_MUTED, marginBottom: 40 }}>
          Built for African businesses. Priced for African businesses.
        </p>

        {/* Toggles */}
        <div style={{ display: "flex", gap: 24, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
          {/* Africa toggle */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <div
              onClick={() => setIsAfrica(v => !v)}
              style={{
                width: 40, height: 22, borderRadius: 11,
                background: isAfrica ? Z_ORANGE : "rgba(255,255,255,0.15)",
                position: "relative", transition: "background 0.2s", cursor: "pointer",
              }}
            >
              <div style={{
                position: "absolute", top: 3, left: isAfrica ? 21 : 3,
                width: 16, height: 16, borderRadius: "50%",
                background: "#fff", transition: "left 0.2s",
              }} />
            </div>
            <span style={{ fontSize: 13, color: isAfrica ? Z_TEXT : Z_MUTED }}>Africa pricing (NGN)</span>
          </label>

          {/* Billing cycle toggle */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: 4, gap: 2 }}>
            {[false, true].map(annual => (
              <button
                key={String(annual)}
                onClick={() => setIsAnnual(annual)}
                style={{
                  padding: "7px 16px", borderRadius: 8, border: "none",
                  background: isAnnual === annual ? "rgba(224,92,42,0.2)" : "transparent",
                  color: isAnnual === annual ? Z_ORANGE : Z_MUTED,
                  fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
                }}
              >
                {annual ? "Annual" : "Monthly"}
                {annual && (
                  <span style={{ marginLeft: 6, background: "rgba(42,157,138,0.2)", color: Z_TEAL, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 100 }}>
                    -17%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* PLAN CARDS */}
      <section style={{ padding: "0 24px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          {PLAN_IDS.map(planId => {
            const plan = PLANS[planId];
            const priceStr = formatPrice(planId, isAfrica, isAnnual);
            const isEnterprise = planId === 'enterprise';
            const pricing = isAfrica ? plan.price.africa : plan.price.global;
            const annualMonthly = isAnnual && !isEnterprise
              ? (isAfrica ? `${pricing.annual.toLocaleString()} NGN/mo` : `$${pricing.annual}/mo`)
              : null;

            return (
              <div
                key={planId}
                style={{
                  background: plan.popular ? "rgba(224,92,42,0.06)" : Z_SURFACE,
                  border: `1px solid ${plan.popular ? Z_ORANGE : Z_BORDER_STRONG}`,
                  borderRadius: 16,
                  padding: "28px 24px",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  boxShadow: plan.popular ? `0 0 0 1px ${Z_ORANGE}` : "none",
                }}
              >
                {plan.popular && (
                  <span style={{
                    position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                    background: Z_ORANGE, color: "#fff", fontSize: 11, fontWeight: 700,
                    padding: "3px 12px", borderRadius: 100, whiteSpace: "nowrap",
                  }}>Most popular</span>
                )}

                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: Z_MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>{plan.name}</span>
                </div>
                <div style={{ fontSize: 12, color: Z_FAINT, marginBottom: 16, fontStyle: "italic" }}>{plan.tagline}</div>

                {isEnterprise ? (
                  <div style={{ fontSize: 28, fontWeight: 800, color: Z_TEXT, marginBottom: 4 }}>Custom</div>
                ) : (
                  <>
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 32, fontWeight: 900, color: Z_TEXT }}>
                        {isAfrica ? "" : ""}{priceStr}
                      </span>
                      {!isEnterprise && planId !== 'free' && (
                        <span style={{ fontSize: 13, color: Z_MUTED }}>/mo</span>
                      )}
                    </div>
                    {annualMonthly && isAnnual && (
                      <div style={{ fontSize: 11, color: Z_TEAL, marginBottom: 4 }}>billed annually</div>
                    )}
                  </>
                )}

                <div style={{ fontSize: 11, color: Z_MUTED, fontStyle: "italic", marginBottom: 20, minHeight: 28 }}>
                  {WHAT_REPLACES[planId]}
                </div>

                {/* Feature list - 8 key ones */}
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", flex: 1, display: "flex", flexDirection: "column", gap: 9 }}>
                  {[
                    { label: "Quick Create and captions", key: "quick_create" as const },
                    { label: "Media upload and posting", key: "media_first_creation" as const },
                    { label: "Multi-platform posting", key: "multi_platform_post" as const },
                    { label: "Content calendar and scheduling", key: "content_calendar" as const },
                    { label: "Bulk week and month planning", key: "bulk_planning" as const },
                    { label: "Creative Studio and carousel", key: "creative_studio" as const },
                    { label: "UGC video generation", key: "ugc_video" as const },
                    { label: "Team workspace", key: "team_workspace" as const },
                  ].map(({ label, key }) => {
                    const included = plan.features[key];
                    return (
                      <li key={key} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: included ? Z_TEXT : Z_FAINT, lineHeight: 1.4 }}>
                        {included
                          ? <Check size={13} color={Z_TEAL} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 1 }} />
                          : <X size={13} color="rgba(245,240,235,0.2)" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                        }
                        {label}
                      </li>
                    );
                  })}
                </ul>

                {/* Limit pills */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
                  <span style={{ fontSize: 10, background: "rgba(255,255,255,0.06)", color: Z_MUTED, padding: "3px 8px", borderRadius: 100 }}>
                    {plan.limits.brands === -1 ? "Unlimited" : plan.limits.brands} brand{plan.limits.brands !== 1 ? "s" : ""}
                  </span>
                  <span style={{ fontSize: 10, background: "rgba(255,255,255,0.06)", color: Z_MUTED, padding: "3px 8px", borderRadius: 100 }}>
                    {plan.limits.media_posts_monthly === -1 ? "Unlimited" : plan.limits.media_posts_monthly} posts/mo
                  </span>
                </div>

                {isEnterprise ? (
                  <a href="mailto:hello@zuriai.co">
                    <button style={{ width: "100%", padding: 11, borderRadius: 10, border: `1px solid ${Z_BORDER_STRONG}`, background: "transparent", color: Z_TEXT, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      Contact us
                    </button>
                  </a>
                ) : (
                  <Link href={`/signup?plan=${planId}`}>
                    <button style={{
                      width: "100%", padding: 11, borderRadius: 10,
                      border: plan.popular ? "none" : `1px solid ${Z_BORDER_STRONG}`,
                      background: plan.popular ? Z_ORANGE : "transparent",
                      color: plan.popular ? "#fff" : Z_TEXT,
                      fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background 0.2s",
                    }}>
                      {plan.cta}
                    </button>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section style={{ padding: "0 24px 100px", maxWidth: 1100, margin: "0 auto" }}>
        <h2 style={{ fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 800, letterSpacing: "-1px", textAlign: "center", marginBottom: 36 }}>
          Full feature comparison
        </h2>

        <div style={{ overflowX: "auto", borderRadius: 16, border: `1px solid ${Z_BORDER}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${Z_BORDER}`, position: "sticky", top: 0, background: Z_SURFACE, zIndex: 10 }}>
                <th style={{ textAlign: "left", padding: "14px 20px", fontSize: 12, color: Z_MUTED, fontWeight: 600, width: "40%" }}>Feature</th>
                {(['free', 'solo', 'growth', 'studio', 'enterprise'] as PlanId[]).map(pid => (
                  <th key={pid} style={{ padding: "14px 16px", fontSize: 12, fontWeight: 700, color: pid === 'growth' ? Z_ORANGE : Z_TEXT, textAlign: "center", width: "12%" }}>
                    {PLANS[pid].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row, i) => (
                <tr key={row.key} style={{ borderBottom: `1px solid ${Z_BORDER}`, background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
                  <td style={{ padding: "12px 20px", fontSize: 13, color: Z_MUTED }}>{row.label}</td>
                  {(['free', 'solo', 'growth', 'studio', 'enterprise'] as PlanId[]).map(pid => (
                    <td key={pid} style={{ padding: "12px 16px", textAlign: "center" }}>
                      {getCellValue(row, pid)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "0 24px 100px", maxWidth: 720, margin: "0 auto" }}>
        <h2 style={{ fontSize: "clamp(22px, 3vw, 36px)", fontWeight: 800, letterSpacing: "-1px", textAlign: "center", marginBottom: 48 }}>
          Frequently asked questions
        </h2>
        <div>
          {FAQ_ITEMS.map(item => <FaqItem key={item.q} q={item.q} a={item.a} />)}
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ padding: "60px 24px 100px", textAlign: "center", borderTop: `1px solid ${Z_BORDER}` }}>
        <h2 style={{ fontSize: "clamp(24px, 4vw, 44px)", fontWeight: 900, letterSpacing: "-1.5px", marginBottom: 12 }}>
          Ready to start? <span style={{ color: Z_ORANGE }}>No credit card needed.</span>
        </h2>
        <p style={{ fontSize: 16, color: Z_MUTED, marginBottom: 28 }}>Your Brand DNA is ready in 10 minutes.</p>
        <Link href="/signup">
          <button style={{
            background: "linear-gradient(135deg, #E05C2A, #C4391A)",
            border: "none", color: "#fff", padding: "14px 36px",
            borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer",
          }}>
            Get started free
          </button>
        </Link>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: `1px solid ${Z_BORDER}`, padding: "32px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <Link href="/" style={{ fontSize: 15, fontWeight: 700, color: Z_TEXT, textDecoration: "none" }}>
          Zuri <span style={{ color: Z_ORANGE }}>AI</span>
        </Link>
        <p style={{ fontSize: 12, color: Z_FAINT }}>© 2026 Zuri AI. Built for Africa.</p>
      </footer>
    </div>
  );
}
