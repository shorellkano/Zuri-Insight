import { Link } from "wouter";
import { PublicNav, PublicFooter } from "@/components/public-nav";

const Z_BG = "#0C0A08";
const Z_SURFACE = "#141210";
const Z_TEXT = "#F5F0EB";
const Z_MUTED = "rgba(245,240,235,0.5)";
const Z_FAINT = "rgba(245,240,235,0.3)";
const Z_BORDER = "rgba(255,255,255,0.06)";
const Z_ORANGE = "#E05C2A";
const Z_ORANGE_DARK = "#C4391A";
const Z_TEAL = "#2A9D8A";
const Z_GOLD = "#D4A017";

const STATS = [
  { value: "600M+", label: "Social media users in Africa", color: Z_ORANGE },
  { value: "45%", label: "Average annual social growth", color: Z_TEAL },
  { value: "2B+", label: "Projected African internet users by 2030", color: Z_GOLD },
];

const WHY_ITEMS = [
  {
    icon: "🗣️",
    title: "We speak your language",
    description: "Zuri AI understands Pidgin English, Yoruba business culture, Swahili market dynamics, and Naija internet slang. Content that feels local because it is local.",
  },
  {
    icon: "💰",
    title: "Priced for African realities",
    description: "Plans denominated in Nigerian Naira and paid via Paystack — no international card required, no dollar conversion headaches. Built for the African pocket.",
  },
  {
    icon: "📱",
    title: "Mobile-first by design",
    description: "Over 70% of African users access the internet on mobile. Zuri AI is built to work beautifully on any device, on any connection speed.",
  },
  {
    icon: "🎯",
    title: "Culturally intelligent AI",
    description: "Our AI understands African holidays, market days, cultural moments, and business etiquette — from Ramadan campaigns to NYSC service content to end-of-year sales.",
  },
  {
    icon: "🏪",
    title: "For every size of business",
    description: "Whether you run a boutique in Lagos, a tech startup in Nairobi, or an agribusiness in Accra — Zuri AI scales with your needs and budget.",
  },
  {
    icon: "🌍",
    title: "Pan-African coverage",
    description: "Nigeria, Ghana, Kenya, South Africa, Tanzania, Egypt, Senegal, and beyond. Zuri AI is calibrated for every major African market.",
  },
];

const MARKETS = ["Nigeria", "Ghana", "Kenya", "South Africa", "Tanzania", "Uganda", "Senegal", "Cameroon", "Rwanda", "Zambia", "Zimbabwe", "Ethiopia"];

export default function Africa() {
  return (
    <div style={{ background: Z_BG, minHeight: "100vh", color: Z_TEXT, fontFamily: "Inter, system-ui, sans-serif" }}>
      <PublicNav />

      <main>
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "80px 24px 72px", textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(224,92,42,0.1)", border: "1px solid rgba(224,92,42,0.2)",
            borderRadius: 24, padding: "6px 16px", marginBottom: 24,
          }}>
            <span style={{ fontSize: 14 }}>🌍</span>
            <span style={{ fontSize: 13, color: Z_ORANGE, fontWeight: 600 }}>Built for Africa. Designed for the world.</span>
          </div>
          <h1 style={{ fontSize: "clamp(34px, 6vw, 60px)", fontWeight: 800, letterSpacing: "-2.5px", marginBottom: 20, lineHeight: 1.1 }}>
            Africa's marketing<br />
            <span style={{ color: Z_ORANGE }}>moment is now</span>
          </h1>
          <p style={{ color: Z_MUTED, fontSize: 18, maxWidth: 580, margin: "0 auto 48px", lineHeight: 1.65 }}>
            Africa has the world's youngest population, fastest-growing internet base, and most vibrant creator economy. Zuri AI exists to give African businesses the tools to own that moment.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <Link href="/signup">
              <button style={{
                background: Z_ORANGE, border: "none", color: "#fff",
                padding: "14px 32px", borderRadius: 10, fontSize: 16, fontWeight: 700,
                cursor: "pointer", transition: "background 0.2s",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = Z_ORANGE_DARK)}
                onMouseLeave={e => (e.currentTarget.style.background = Z_ORANGE)}>
                Start free
              </button>
            </Link>
          </div>
        </section>

        <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 80px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {STATS.map(({ value, label, color }) => (
              <div key={label} style={{
                background: Z_SURFACE, border: `1px solid ${Z_BORDER}`,
                borderRadius: 16, padding: "32px 24px", textAlign: "center",
              }}>
                <p style={{ fontSize: "clamp(36px, 6vw, 52px)", fontWeight: 800, color, margin: 0, letterSpacing: "-2px" }}>{value}</p>
                <p style={{ color: Z_MUTED, fontSize: 14, margin: "8px 0 0" }}>{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-1.5px", marginBottom: 12 }}>
              Why Zuri AI is different<br />
              <span style={{ color: Z_ORANGE }}>for African businesses</span>
            </h2>
            <p style={{ color: Z_MUTED, fontSize: 16, maxWidth: 520, margin: "0 auto" }}>
              Every other AI marketing tool was built for Western markets, then localised as an afterthought. Zuri was built for Africa first.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {WHY_ITEMS.map((item) => (
              <div key={item.title} style={{
                background: Z_SURFACE, border: `1px solid ${Z_BORDER}`,
                borderRadius: 16, padding: "28px",
                transition: "border-color 0.2s",
              }}
                onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.borderColor = "rgba(224,92,42,0.25)")}
                onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.borderColor = Z_BORDER)}
              >
                <span style={{ fontSize: 32, display: "block", marginBottom: 14 }}>{item.icon}</span>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.3px" }}>{item.title}</h3>
                <p style={{ color: Z_MUTED, fontSize: 14, lineHeight: 1.65, margin: 0 }}>{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ background: Z_SURFACE, borderTop: `1px solid ${Z_BORDER}`, borderBottom: `1px solid ${Z_BORDER}`, padding: "64px 24px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
            <h2 style={{ fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 800, letterSpacing: "-1px", marginBottom: 12 }}>
              Serving businesses across Africa
            </h2>
            <p style={{ color: Z_MUTED, fontSize: 15, marginBottom: 36 }}>With specific cultural context for every major market</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
              {MARKETS.map(market => (
                <span key={market} style={{
                  background: Z_BG, border: `1px solid ${Z_BORDER}`,
                  borderRadius: 24, padding: "7px 18px",
                  fontSize: 14, color: Z_MUTED,
                }}>
                  🌍 {market}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section style={{ maxWidth: 640, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-1.5px", marginBottom: 16 }}>
            Your brand deserves a<br />
            <span style={{ color: Z_ORANGE }}>tool built for it</span>
          </h2>
          <p style={{ color: Z_MUTED, fontSize: 16, marginBottom: 36, lineHeight: 1.65 }}>
            Start free today. No credit card required. No dollar conversion. Just your brand, your voice, your market.
          </p>
          <Link href="/signup">
            <button style={{
              background: Z_ORANGE, border: "none", color: "#fff",
              padding: "15px 36px", borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: "pointer",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = Z_ORANGE_DARK)}
              onMouseLeave={e => (e.currentTarget.style.background = Z_ORANGE)}>
              Get started — it's free
            </button>
          </Link>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
