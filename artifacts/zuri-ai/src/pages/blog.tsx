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

const COMING_SOON_TOPICS = [
  "How to build a brand that resonates with Nigerian consumers",
  "The African creator economy: what's next in 2026",
  "Social media strategies that actually work in Ghana",
  "Why your captions need more culture and less copy",
  "Building a Brand DNA: the Zuri AI guide",
  "Content calendar templates for African businesses",
  "Instagram vs TikTok vs WhatsApp: where African brands win",
  "How to use AI without losing your brand's authentic voice",
];

export default function Blog() {
  return (
    <div style={{ background: Z_BG, minHeight: "100vh", color: Z_TEXT, fontFamily: "Inter, system-ui, sans-serif" }}>
      <PublicNav />

      <main style={{ maxWidth: 800, margin: "0 auto", padding: "80px 24px 100px" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <p style={{ fontSize: 13, color: Z_FAINT, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Insights & resources</p>
          <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 800, letterSpacing: "-2px", marginBottom: 16 }}>
            The Zuri <span style={{ color: Z_ORANGE }}>Blog</span>
          </h1>
          <p style={{ color: Z_MUTED, fontSize: 17, maxWidth: 480, margin: "0 auto 40px" }}>
            Marketing strategies, AI insights, and brand building tips — written specifically for African businesses.
          </p>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: "rgba(224,92,42,0.08)", border: "1px solid rgba(224,92,42,0.2)",
            borderRadius: 12, padding: "12px 24px",
          }}>
            <span style={{ fontSize: 20 }}>✍️</span>
            <span style={{ color: Z_ORANGE, fontSize: 15, fontWeight: 600 }}>Coming soon — articles are being written</span>
          </div>
        </div>

        <div style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, letterSpacing: "-0.3px" }}>
            What's coming first
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {COMING_SOON_TOPICS.map((topic, i) => (
              <div key={i} style={{
                background: Z_SURFACE, border: `1px solid ${Z_BORDER}`,
                borderRadius: 12, padding: "16px 20px",
                display: "flex", alignItems: "center", gap: 16,
              }}>
                <span style={{ color: Z_ORANGE, fontSize: 13, fontWeight: 700, minWidth: 24, opacity: 0.6 }}>
                  0{i + 1}
                </span>
                <p style={{ color: Z_MUTED, fontSize: 15, margin: 0 }}>{topic}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          background: Z_SURFACE, border: `1px solid ${Z_BORDER}`,
          borderRadius: 20, padding: "40px", textAlign: "center",
        }}>
          <span style={{ fontSize: 36, display: "block", marginBottom: 16 }}>📬</span>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Get notified when we publish</h3>
          <p style={{ color: Z_MUTED, fontSize: 15, marginBottom: 24 }}>
            Sign up for Zuri AI and we'll notify you when new articles are ready — plus you'll get early access to all new features.
          </p>
          <Link href="/signup">
            <button style={{
              background: Z_ORANGE, border: "none", color: "#fff",
              padding: "12px 28px", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = Z_ORANGE_DARK)}
              onMouseLeave={e => (e.currentTarget.style.background = Z_ORANGE)}>
              Create free account
            </button>
          </Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
