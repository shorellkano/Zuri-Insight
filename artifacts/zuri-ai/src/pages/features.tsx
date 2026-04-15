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

type Feature = {
  icon: string;
  title: string;
  description: string;
  tag?: string;
  tagColor?: string;
};

const FEATURES: Feature[] = [
  {
    icon: "🧬",
    title: "Brand DNA Intelligence",
    description: "Zuri scans your website, Instagram bio, TikTok captions, Facebook page, and LinkedIn simultaneously — building a brand profile richer than any tool on the market. Your voice, your lessons, your cultural context. It gets smarter every time you use it.",
    tag: "Core",
    tagColor: Z_ORANGE,
  },
  {
    icon: "📱",
    title: "7-Day Starter Pack",
    description: "New to content creation? Generate a full week of Instagram Reels, Carousels, Stories, and TikTok UGC scripts in one click — all tailored to your brand. Export as PowerPoint or start creating visuals immediately.",
    tag: "Popular",
    tagColor: Z_TEAL,
  },
  {
    icon: "✍️",
    title: "Solo Founder Content Plan",
    description: "Built for the founder who is the brand. Generate a complete month of content across all your platforms, optimised for your audience, your industry, and your voice — without needing a marketing team.",
  },
  {
    icon: "📅",
    title: "Content Calendar",
    description: "Plan, schedule, and organise your content across platforms with a visual calendar. See the week and month at a glance, and never miss a posting day again.",
  },
  {
    icon: "🎨",
    title: "Creative Studio",
    description: "Design Instagram Carousels, Quote Cards, Story Covers, UGC video scripts, Announcements, Product Showcases, Testimonials, and Birthday Posts — all with AI-generated text and prompts tailored to your brand.",
  },
  {
    icon: "📋",
    title: "Bulk Content Planner",
    description: "Generate up to 30 days of content in one session. Each post is uniquely crafted with captions, hashtags, and creative direction — ready to schedule or publish.",
    tag: "Growth+",
    tagColor: Z_GOLD,
  },
  {
    icon: "📊",
    title: "Caption Studio",
    description: "Transform any topic, product, or idea into scroll-stopping captions across every format — Instagram, LinkedIn, Twitter/X, TikTok, WhatsApp broadcasts, and email newsletters.",
  },
  {
    icon: "🌍",
    title: "African Cultural Context",
    description: "Content that understands Afrobeats references, Naija slang, Pidgin, Swahili, and pan-African cultural moments. No more generic Western templates. Zuri speaks your audience's language.",
    tag: "Unique",
    tagColor: Z_ORANGE,
  },
  {
    icon: "🎯",
    title: "Ad Copy Generator",
    description: "Create high-converting Facebook, Instagram, and Google ad copy in seconds. Zuri understands your brand tone and writes copy that speaks directly to your target market.",
  },
  {
    icon: "📦",
    title: "Content Library",
    description: "Every piece of content you generate is saved and searchable. Revisit, repurpose, or build on previous content without starting from scratch.",
  },
  {
    icon: "🔗",
    title: "Multi-Platform Posting",
    description: "Connect your social accounts and post directly from Zuri AI. Publish to Instagram, Twitter/X, LinkedIn, Facebook, and TikTok from one dashboard.",
    tag: "Growth+",
    tagColor: Z_GOLD,
  },
  {
    icon: "📤",
    title: "PPTX Export",
    description: "Export your content plans as polished PowerPoint decks — perfect for client presentations, team briefings, or offline planning.",
  },
];

export default function Features() {
  return (
    <div style={{ background: Z_BG, minHeight: "100vh", color: Z_TEXT, fontFamily: "Inter, system-ui, sans-serif" }}>
      <PublicNav />

      <main>
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "72px 24px 64px", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: Z_FAINT, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Everything you need</p>
          <h1 style={{ fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 800, letterSpacing: "-2px", marginBottom: 20 }}>
            Built for brands that<br />
            <span style={{ color: Z_ORANGE }}>mean business</span>
          </h1>
          <p style={{ color: Z_MUTED, fontSize: 18, maxWidth: 560, margin: "0 auto 40px" }}>
            Every feature in Zuri AI is designed specifically for African businesses and emerging market brands. No fluff. No generic templates.
          </p>
          <Link href="/signup">
            <button style={{
              background: Z_ORANGE, border: "none", color: "#fff",
              padding: "14px 32px", borderRadius: 10, fontSize: 16, fontWeight: 700,
              cursor: "pointer", transition: "background 0.2s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = Z_ORANGE_DARK)}
              onMouseLeave={e => (e.currentTarget.style.background = Z_ORANGE)}>
              Start free — no card needed
            </button>
          </Link>
        </section>

        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 100px" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 16,
          }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{
                background: Z_SURFACE,
                border: `1px solid ${Z_BORDER}`,
                borderRadius: 16,
                padding: "28px",
                display: "flex", flexDirection: "column", gap: 12,
                transition: "border-color 0.2s",
              }}
                onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.borderColor = "rgba(224,92,42,0.25)")}
                onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.borderColor = Z_BORDER)}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 28 }}>{f.icon}</span>
                  {f.tag && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                      color: f.tagColor, border: `1px solid ${f.tagColor}`,
                      padding: "3px 9px", borderRadius: 20,
                      opacity: 0.85,
                    }}>{f.tag}</span>
                  )}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, letterSpacing: "-0.3px" }}>{f.title}</h3>
                <p style={{ color: Z_MUTED, fontSize: 14, lineHeight: 1.65, margin: 0 }}>{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{
          background: Z_SURFACE, borderTop: `1px solid ${Z_BORDER}`, borderBottom: `1px solid ${Z_BORDER}`,
          padding: "80px 24px",
        }}>
          <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
            <h2 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-1.5px", marginBottom: 16 }}>
              Ready to grow your brand?
            </h2>
            <p style={{ color: Z_MUTED, fontSize: 16, marginBottom: 32 }}>
              Join hundreds of African businesses using Zuri AI to create content that connects.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/signup">
                <button style={{
                  background: Z_ORANGE, border: "none", color: "#fff",
                  padding: "13px 28px", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer",
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = Z_ORANGE_DARK)}
                  onMouseLeave={e => (e.currentTarget.style.background = Z_ORANGE)}>
                  Get started free
                </button>
              </Link>
              <Link href="/pricing">
                <button style={{
                  background: "transparent", border: `1px solid rgba(255,255,255,0.12)`, color: Z_TEXT,
                  padding: "13px 28px", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer",
                }}>
                  View pricing
                </button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
