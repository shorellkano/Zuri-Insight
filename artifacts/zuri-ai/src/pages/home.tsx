import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";

const Z_ORANGE = "#E05C2A";
const Z_ORANGE_DARK = "#C4391A";
const Z_TEAL = "#2A9D8A";
const Z_GOLD = "#D4A017";
const Z_BG = "#0C0A08";
const Z_SURFACE = "#141210";
const Z_TEXT = "#F5F0EB";
const Z_MUTED = "rgba(245,240,235,0.5)";
const Z_FAINT = "rgba(245,240,235,0.3)";
const Z_BORDER = "rgba(255,255,255,0.06)";
const Z_BORDER_STRONG = "rgba(255,255,255,0.12)";

function LogoCanvas({ size, threshold = 220, zoom = 1.7, offsetX = 0.02, offsetY = -0.02 }: {
  size: number; threshold?: number; zoom?: number; offsetX?: number; offsetY?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = size;
      canvas.height = size;

      const drawW = size * zoom;
      const drawH = size * zoom;
      const drawX = (size - drawW) / 2 + offsetX * size;
      const drawY = (size - drawH) / 2 + offsetY * size;

      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      const imageData = ctx.getImageData(0, 0, size, size);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (r > threshold && g > threshold && b > threshold) {
          const brightness = (r + g + b) / 3;
          const alpha = Math.max(0, 255 - (brightness - threshold) * 8);
          d[i + 3] = Math.round(alpha);
        }
      }
      ctx.putImageData(imageData, 0, 0);
    };
    img.src = "/zuri-logo-head.png";
  }, [size, threshold, zoom, offsetX, offsetY]);

  return <canvas ref={canvasRef} width={size} height={size} style={{ display: "block" }} />;
}

function HeroLogoRings() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 300, height: 300 }}>
      <div
        className="zuri-spin absolute"
        style={{
          width: 300, height: 300,
          borderRadius: "50%",
          border: `1.5px dashed ${Z_ORANGE}`,
          opacity: 0.35,
        }}
      >
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const x = 150 + 148 * Math.cos(rad) - 4;
          const y = 150 + 148 * Math.sin(rad) - 4;
          return (
            <div
              key={angle}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: 7,
                height: 7,
                background: Z_ORANGE,
                opacity: 0.8,
                clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
                transform: `rotate(${angle}deg)`,
              }}
            />
          );
        })}
      </div>

      <div
        className="zuri-ring-pulse absolute"
        style={{
          width: 236, height: 236,
          borderRadius: "50%",
          border: `1px solid rgba(224,92,42,0.18)`,
        }}
      />

      <div
        style={{
          width: 210, height: 210,
          borderRadius: "50%",
          backgroundImage: "url('/zuri-logo-head.png')",
          backgroundSize: "733px 489px",
          backgroundPosition: "-273px -105px",
          backgroundRepeat: "no-repeat",
          border: `2px solid rgba(224,92,42,0.35)`,
          boxShadow: "0 0 70px rgba(224,92,42,0.4), 0 0 120px rgba(224,92,42,0.15)",
          position: "relative",
          zIndex: 2,
        }}
      />
    </div>
  );
}

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*";

const BADGE_PHRASES = [
  { prefix: "AI built for", word: "Lagos" },
  { prefix: "Speaks fluent", word: "Naija" },
  { prefix: "Rooted in", word: "Africa" },
  { prefix: "Made for", word: "Nairobi" },
  { prefix: "Created for", word: "Accra" },
  { prefix: "Designed for", word: "Jo'burg" },
  { prefix: "Built for", word: "Abuja" },
];

function ScrambleBadge() {
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [displayed, setDisplayed] = useState(BADGE_PHRASES[0].word);
  const [prefixIdx, setPrefixIdx] = useState(0);
  const frameRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const cycle = setInterval(() => {
      const nextIdx = (phraseIdx + 1) % BADGE_PHRASES.length;
      const target = BADGE_PHRASES[nextIdx].word;
      const nextPrefixIdx = nextIdx;

      let frame = 0;
      const totalFrames = 18;

      const animate = () => {
        frame++;
        const progress = frame / totalFrames;

        const resolved = Math.floor(progress * target.length);
        const scrambled = target
          .split("")
          .map((char, i) => {
            if (i < resolved) return char;
            return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
          })
          .join("");

        setDisplayed(scrambled);

        if (frame < totalFrames) {
          frameRef.current = setTimeout(animate, 45);
        } else {
          setDisplayed(target);
          setPhraseIdx(nextIdx);
          setPrefixIdx(nextPrefixIdx);
        }
      };

      frameRef.current = setTimeout(animate, 30);
    }, 2800);

    return () => {
      clearInterval(cycle);
      if (frameRef.current) clearTimeout(frameRef.current);
    };
  }, [phraseIdx]);

  const { prefix } = BADGE_PHRASES[prefixIdx];

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        background: "rgba(255,255,255,0.04)",
        border: `1px solid rgba(255,255,255,0.10)`,
        padding: "8px 18px",
        borderRadius: 100,
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: "0.01em",
        color: Z_TEXT,
        backdropFilter: "blur(8px)",
      }}
    >
      <span style={{ color: Z_MUTED, fontWeight: 400 }}>{prefix}</span>
      <span
        style={{
          color: Z_ORANGE,
          fontWeight: 700,
          fontFamily: "monospace",
          minWidth: 72,
          display: "inline-block",
          letterSpacing: "0.04em",
        }}
      >
        {displayed}
      </span>
    </div>
  );
}

const MARQUEE_ITEMS = [
  "Brand DNA from your social handles",
  "Instagram Reels and TikTok videos",
  "Multi-platform scheduling",
  "Week and month content plans",
  "Caption enhancement for realtors, caterers, car dealers",
  "UGC video generation",
  "WhatsApp marketing",
  "Carousel and quote cards",
  "Calendar intelligence - Eid, Christmas, Detty December",
];

function MarqueeItem({ text }: { text: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, paddingRight: 40, whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: Z_ORANGE, flexShrink: 0 }} />
      <span style={{ color: Z_MUTED, fontSize: 13, fontWeight: 500 }}>{text}</span>
    </span>
  );
}

const AVATAR_COLORS = [Z_ORANGE, Z_TEAL, Z_GOLD, "#8B5CF6", "#6B7280"];
const AVATAR_INITIALS = ["A", "K", "L", "T", "O"];

const STEP_CARDS = [
  {
    num: "01",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={Z_ORANGE} strokeWidth="2" strokeLinecap="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
    title: "Drop your handle or URL",
    desc: "Paste your Instagram, TikTok, website, or just describe what you do. Zuri reads everything.",
  },
  {
    num: "02",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={Z_ORANGE} strokeWidth="2" strokeLinecap="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    title: "Zuri builds your Brand DNA",
    desc: "Your voice, your audience, your cultural context, your visual identity - extracted in minutes.",
  },
  {
    num: "03",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={Z_ORANGE} strokeWidth="2" strokeLinecap="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    title: "Generate, schedule, publish",
    desc: "Create a week of content or a single post. Approve and publish to all platforms at once.",
  },
];

const FEATURE_CARDS = [
  {
    emoji: "📸",
    title: "Media-First Creation",
    desc: "Upload your own images and videos. Zuri generates captions, hashtags, and hooks - then posts to every platform simultaneously. Perfect for realtors, car dealers, caterers, and event planners.",
    tag: "Realtors - Car dealers - Caterers - Event planners",
    tagColor: "rgba(212,160,23,0.15)",
    tagTextColor: Z_GOLD,
  },
  {
    emoji: "📅",
    title: "Calendar Intelligence",
    desc: "Zuri knows Eid, Christmas, Detty December, Independence Day, and your company birthdays. Every important date becomes a content opportunity - built into your monthly plan automatically.",
    tag: "Never miss a moment",
    tagColor: `rgba(42,157,138,0.15)`,
    tagTextColor: Z_TEAL,
  },
  {
    emoji: "🎬",
    title: "UGC Video Generation",
    desc: "Realistic influencer-style video ads from a single product description or image. Powered by Higgsfield AI. Available on Growth plan and above.",
    tag: null,
    tagColor: "",
    tagTextColor: "",
  },
  {
    emoji: "🗓️",
    title: "Bulk Content Planning",
    desc: "Tell Zuri you want a week or month of content. It builds the plan, shows every slot for your approval, then generates and schedules everything in one go.",
    tag: null,
    tagColor: "",
    tagTextColor: "",
  },
];

const PRICING_PLANS = [
  {
    name: "Solo",
    price: "9,500",
    currency: "NGN",
    period: "/mo",
    highlight: false,
    badge: null,
    brands: "1 brand",
    features: ["Quick Create", "30 media posts", "2 platforms", "Scheduling", "Voice File and Lessons"],
    cta: "Start with Solo",
    plan: "solo",
  },
  {
    name: "Growth",
    price: "24,000",
    currency: "NGN",
    period: "/mo",
    highlight: true,
    badge: "Most popular",
    brands: "3 brands",
    features: ["Everything in Solo", "Unlimited media posts", "All 6 platforms", "Bulk plans", "Creative Studio + UGC video"],
    cta: "Start with Growth",
    plan: "growth",
  },
  {
    name: "Studio",
    price: "55,000",
    currency: "NGN",
    period: "/mo",
    highlight: false,
    badge: null,
    brands: "10 brands",
    features: ["Everything in Growth", "Team workspace", "Client approvals", "20 UGC videos", "Priority support"],
    cta: "Start with Studio",
    plan: "studio",
  },
  {
    name: "Enterprise",
    price: "Custom",
    currency: "",
    period: "",
    highlight: false,
    badge: null,
    brands: "Unlimited",
    features: ["Unlimited brands and team", "White label", "API access", "Custom DNA training", "Dedicated support"],
    cta: "Contact us",
    plan: "enterprise",
  },
];

const PLATFORM_COLORS: Record<string, string> = {
  Instagram: "#E1306C",
  Facebook: "#1877F2",
  TikTok: "#010101",
  LinkedIn: "#0A66C2",
  Twitter: "#1DA1F2",
  YouTube: "#FF0000",
};

const PLATFORM_ICONS: Record<string, string> = {
  Instagram: "IG",
  Facebook: "FB",
  TikTok: "TK",
  LinkedIn: "LI",
  Twitter: "TW",
  YouTube: "YT",
};

type PlanPost = {
  id: string;
  day: number;
  platform: string;
  contentType: string;
  topic: string;
  angle: string;
  caption: string;
};

type QuickPlanResult = {
  brandName: string;
  brandSummary: string;
  plan: PlanPost[];
};

function TryZuriSection() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuickPlanResult | null>(null);
  const [error, setError] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = useCallback(async (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) return;
    let finalUrl = trimmed;
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = "https://" + finalUrl;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const resp = await fetch("/api/generate/quick-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUrl: finalUrl, duration: "1week" }),
      });
      if (!resp.ok) throw new Error("Could not read your website. Try a different URL.");
      const data: QuickPlanResult = await resp.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = () => run(url);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") run(url);
  };

  const previewPosts = result?.plan?.slice(0, 3) ?? [];

  return (
    <section
      data-testid="try-zuri-section"
      style={{
        padding: "80px 24px 96px",
        background: "linear-gradient(180deg, rgba(224,92,42,0.04) 0%, transparent 100%)",
        borderBottom: `1px solid ${Z_BORDER}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 700px 400px at 50% 0%, rgba(224,92,42,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 780, margin: "0 auto", position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span style={{
            display: "inline-block",
            background: "rgba(224,92,42,0.12)",
            border: `1px solid rgba(224,92,42,0.3)`,
            color: Z_ORANGE,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            padding: "5px 16px",
            borderRadius: 100,
            marginBottom: 20,
            textTransform: "uppercase",
          }}>
            Live Demo - No Signup Needed
          </span>
          <h2 style={{
            fontSize: "clamp(26px, 4vw, 44px)",
            fontWeight: 900,
            letterSpacing: "-1.5px",
            lineHeight: 1.1,
            marginBottom: 14,
            color: Z_TEXT,
          }}>
            See Zuri work on <em style={{ fontStyle: "italic", color: Z_ORANGE }}>your</em> brand.
          </h2>
          <p style={{ fontSize: 16, color: Z_MUTED, lineHeight: 1.65, maxWidth: 520, margin: "0 auto" }}>
            Paste your website URL below. Zuri reads your brand in seconds and generates real content ideas for you - free, right now.
          </p>
        </div>

        {/* URL Input */}
        <div style={{
          display: "flex",
          gap: 10,
          background: Z_SURFACE,
          border: `1.5px solid ${inputFocused ? Z_ORANGE : Z_BORDER_STRONG}`,
          borderRadius: 14,
          padding: "6px 6px 6px 18px",
          alignItems: "center",
          transition: "border-color 0.2s, box-shadow 0.2s",
          boxShadow: inputFocused ? `0 0 0 3px rgba(224,92,42,0.15)` : "none",
          marginBottom: 14,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={Z_MUTED} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder="yourwebsite.com or paste full URL..."
            disabled={loading}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: Z_TEXT,
              fontSize: 15,
              fontFamily: "inherit",
              padding: "8px 0",
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !url.trim()}
            onMouseEnter={() => setBtnHovered(true)}
            onMouseLeave={() => setBtnHovered(false)}
            style={{
              background: loading || !url.trim() ? "rgba(224,92,42,0.4)" : btnHovered ? Z_ORANGE_DARK : Z_ORANGE,
              border: "none",
              color: "#fff",
              padding: "10px 22px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading || !url.trim() ? "not-allowed" : "pointer",
              transition: "background 0.2s",
              whiteSpace: "nowrap",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {loading ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 0.8s linear infinite" }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Reading brand...
              </>
            ) : "Generate Content"}
          </button>
        </div>

        <p style={{ fontSize: 12, color: Z_FAINT, textAlign: "center", marginBottom: 40 }}>
          Works best with any Nigerian, Kenyan, or African business website
        </p>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                border: `2px solid ${Z_BORDER_STRONG}`,
                borderTop: `2px solid ${Z_ORANGE}`,
                animation: "spin 0.8s linear infinite",
              }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: Z_TEXT, marginBottom: 4 }}>Reading your brand...</div>
                <div style={{ fontSize: 13, color: Z_MUTED }}>Scanning your website and building content ideas</div>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 12,
            padding: "14px 18px",
            fontSize: 14,
            color: "#F87171",
            textAlign: "center",
            marginBottom: 24,
          }}>
            {error}
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div>
            {/* Brand summary */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${Z_BORDER_STRONG}`,
              borderRadius: 12,
              padding: "16px 20px",
              marginBottom: 20,
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                background: `rgba(224,92,42,0.15)`,
                border: `1px solid rgba(224,92,42,0.3)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                fontSize: 16,
              }}>
                🧬
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: Z_ORANGE, marginBottom: 4 }}>{result.brandName} - Brand Intelligence Ready</div>
                <div style={{ fontSize: 13, color: Z_MUTED, lineHeight: 1.55 }}>{result.brandSummary}</div>
              </div>
            </div>

            {/* Post preview cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              {previewPosts.map((post, i) => {
                const pColor = PLATFORM_COLORS[post.platform] ?? Z_ORANGE;
                const pIcon = PLATFORM_ICONS[post.platform] ?? "?";
                return (
                  <div
                    key={post.id || i}
                    style={{
                      background: Z_SURFACE,
                      border: `1px solid ${Z_BORDER_STRONG}`,
                      borderRadius: 12,
                      padding: "16px 18px",
                      display: "flex",
                      gap: 14,
                      alignItems: "flex-start",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: pColor, borderRadius: "3px 0 0 3px" }} />
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: pColor,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 800, color: "#fff",
                      flexShrink: 0,
                    }}>
                      {pIcon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: Z_TEXT }}>{post.platform}</span>
                        <span style={{ fontSize: 10, color: Z_MUTED, background: "rgba(255,255,255,0.05)", padding: "2px 7px", borderRadius: 100 }}>{post.contentType}</span>
                        <span style={{ fontSize: 10, color: Z_MUTED, background: "rgba(255,255,255,0.05)", padding: "2px 7px", borderRadius: 100 }}>{post.angle}</span>
                        <span style={{ fontSize: 10, color: Z_FAINT, marginLeft: "auto" }}>Day {post.day}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: Z_TEXT, marginBottom: 4 }}>{post.topic}</div>
                      <div style={{ fontSize: 12, color: Z_MUTED, lineHeight: 1.55 }}>{post.caption}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Blur teaser for remaining posts */}
            <div style={{
              position: "relative",
              height: 90,
              marginBottom: 28,
              borderRadius: 12,
              overflow: "hidden",
              pointerEvents: "none",
            }}>
              <div style={{ filter: "blur(4px)", opacity: 0.45 }}>
                {[4, 5].map(day => (
                  <div key={day} style={{
                    background: Z_SURFACE,
                    border: `1px solid ${Z_BORDER}`,
                    borderRadius: 12,
                    padding: "12px 16px",
                    marginBottom: 8,
                    height: 40,
                  }} />
                ))}
              </div>
              <div style={{
                position: "absolute", inset: 0,
                background: `linear-gradient(to bottom, transparent 0%, ${Z_BG} 100%)`,
              }} />
            </div>

            {/* CTA */}
            <div style={{
              textAlign: "center",
              background: "rgba(224,92,42,0.06)",
              border: `1px solid rgba(224,92,42,0.18)`,
              borderRadius: 16,
              padding: "28px 24px",
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: Z_TEXT, marginBottom: 6 }}>
                Your full {result?.plan?.length ?? 7}-post plan is ready
              </div>
              <div style={{ fontSize: 14, color: Z_MUTED, marginBottom: 20 }}>
                Sign up free to unlock the full calendar, one-click scheduling, and Brand DNA for {result.brandName}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <Link href={`/signup?url=${encodeURIComponent(url)}`}>
                  <button style={{
                    background: "linear-gradient(135deg, #E05C2A, #C4391A)",
                    border: "none", color: "#fff",
                    padding: "12px 28px", borderRadius: 10,
                    fontSize: 14, fontWeight: 700, cursor: "pointer",
                    transition: "transform 0.2s, box-shadow 0.2s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(224,92,42,0.45)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
                    Get Full Plan - Free
                  </button>
                </Link>
                <button
                  onClick={() => { setResult(null); setUrl(""); setError(""); }}
                  style={{
                    background: "transparent", border: `1px solid ${Z_BORDER_STRONG}`,
                    color: Z_MUTED, padding: "12px 20px", borderRadius: 10,
                    fontSize: 14, cursor: "pointer",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = Z_TEXT)}
                  onMouseLeave={e => (e.currentTarget.style.color = Z_MUTED)}
                >
                  Try another URL
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoveredCta, setHoveredCta] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const px = isMobile ? "16px" : "48px";

  return (
    <div style={{ background: Z_BG, color: Z_TEXT, fontFamily: "Inter, system-ui, sans-serif", minHeight: "100vh", overflowX: "hidden" }}>

      {/* NAV */}
      <nav
        data-testid="nav-home"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(12,10,8,0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${Z_BORDER}`,
          padding: `0 ${px}`,
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div
            data-testid="home-logo"
            style={{
              width: 36, height: 36,
              borderRadius: "50%",
              backgroundImage: "url('/zuri-logo-head.png')",
              backgroundSize: "126px 84px",
              backgroundPosition: "-47px -18px",
              backgroundRepeat: "no-repeat",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 18, fontWeight: 700, color: Z_TEXT }}>
            Zuri <span style={{ color: Z_ORANGE }}>AI</span>
          </span>
        </Link>

        <div className="hidden md:flex" style={{ gap: 32 }}>
          {["Features", "Pricing", "For Africa", "Blog"].map(link => (
            <a key={link} href="#" style={{ fontSize: 14, color: Z_MUTED, textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color = Z_TEXT)}
              onMouseLeave={e => (e.currentTarget.style.color = Z_MUTED)}>
              {link}
            </a>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/login" data-testid="nav-signin-link">
            <button style={{
              background: "transparent",
              border: `1px solid ${Z_BORDER_STRONG}`,
              color: Z_TEXT,
              padding: "8px 18px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              transition: "border-color 0.2s",
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = Z_BORDER_STRONG)}>
              Sign in
            </button>
          </Link>
          <Link href="/signup" data-testid="nav-get-started-btn">
            <button style={{
              background: Z_ORANGE,
              border: "none",
              color: "#fff",
              padding: "8px 18px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.2s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = Z_ORANGE_DARK)}
              onMouseLeave={e => (e.currentTarget.style.background = Z_ORANGE)}>
              Get started
            </button>
          </Link>
          <button
            className="flex md:hidden"
            onClick={() => setMobileMenuOpen(o => !o)}
            style={{ background: "transparent", border: "none", color: Z_TEXT, cursor: "pointer", padding: 4 }}
            aria-label="Toggle menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileMenuOpen
                ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
            </svg>
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div style={{
          position: "fixed", inset: 0, top: 64, zIndex: 99,
          background: "rgba(12,10,8,0.98)", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 32,
        }}>
          {["Features", "Pricing", "For Africa", "Blog"].map(link => (
            <a key={link} href="#" onClick={() => setMobileMenuOpen(false)}
              style={{ fontSize: 22, color: Z_TEXT, textDecoration: "none", fontWeight: 600 }}>
              {link}
            </a>
          ))}
          <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
            <button style={{ background: Z_ORANGE, color: "#fff", border: "none", padding: "12px 32px", borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
              Get started
            </button>
          </Link>
        </div>
      )}

      {/* HERO */}
      <section
        data-testid="hero-section"
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 20px",
          textAlign: "center",
          position: "relative",
          background: "radial-gradient(ellipse 800px 600px at 50% 60%, rgba(224,92,42,0.07) 0%, transparent 70%)",
        }}
      >
        <div className="zuri-fade-up-1" style={{ marginBottom: 32 }}>
          <ScrambleBadge />
        </div>

        <div className="zuri-fade-up-2" style={{ marginBottom: 40 }}>
          <HeroLogoRings />
        </div>

        <h1
          className="zuri-fade-up-3"
          style={{
            fontSize: "clamp(40px, 7vw, 80px)",
            fontWeight: 900,
            letterSpacing: "-2px",
            lineHeight: 1.0,
            maxWidth: 900,
            margin: "0 auto 24px",
          }}
        >
          <span style={{ display: "block", color: Z_TEXT }}>Your AI design agency,</span>
          <span style={{ display: "block", color: Z_TEXT }}>
            running <span style={{ color: Z_ORANGE }}>24 hours</span> a day.
          </span>
        </h1>

        <p
          className="zuri-fade-up-3"
          style={{
            fontSize: 18, color: "rgba(245,240,235,0.55)", maxWidth: 560,
            margin: "0 auto 36px", lineHeight: 1.65,
          }}
        >
          Zuri AI reads your website, your Instagram, your TikTok - and builds a Brand DNA that generates campaigns, visuals, and copy your audience actually connects with.
        </p>

        <div className="zuri-fade-up-4" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 40 }}>
          <Link href="/signup" data-testid="hero-cta-primary">
            <button
              onMouseEnter={() => setHoveredCta(true)}
              onMouseLeave={() => setHoveredCta(false)}
              style={{
                background: "linear-gradient(135deg, #E05C2A, #C4391A)",
                border: "none",
                color: "#fff",
                padding: "14px 32px",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                transition: "transform 0.2s, box-shadow 0.2s",
                transform: hoveredCta ? "translateY(-2px)" : "none",
                boxShadow: hoveredCta ? "0 8px 30px rgba(224,92,42,0.45)" : "none",
              }}
            >
              Build Your Brand DNA
            </button>
          </Link>
          <Link href="/dashboard" data-testid="hero-cta-secondary">
            <button style={{
              background: "transparent",
              border: `1px solid ${Z_BORDER_STRONG}`,
              color: Z_TEXT,
              padding: "14px 32px",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 500,
              cursor: "pointer",
              transition: "border-color 0.2s, background 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = Z_BORDER_STRONG; e.currentTarget.style.background = "transparent"; }}>
              View dashboard
            </button>
          </Link>
        </div>

        <div className="zuri-fade-up-5" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {AVATAR_COLORS.map((color, i) => (
              <div key={i} style={{
                width: 32, height: 32, borderRadius: "50%",
                background: color,
                border: `2px solid ${Z_BG}`,
                marginLeft: i > 0 ? -8 : 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#fff",
                zIndex: 5 - i,
                position: "relative",
              }}>
                {AVATAR_INITIALS[i]}
              </div>
            ))}
          </div>
          <span style={{ fontSize: 13, color: Z_MUTED }}>
            <span style={{ color: Z_TEXT, fontWeight: 600 }}>2,400+</span> brands already creating with Zuri
          </span>
          <div style={{ width: 1, height: 24, background: Z_BORDER_STRONG }} />
          <span style={{ fontSize: 14 }}>🇳🇬 🇰🇪 🇬🇭 🇿🇦 🇪🇬</span>
          <span style={{ fontSize: 12, color: Z_FAINT }}>+41 countries</span>
        </div>
      </section>

      {/* MARQUEE */}
      <div
        data-testid="marquee-section"
        style={{
          borderTop: `1px solid ${Z_BORDER}`,
          borderBottom: `1px solid ${Z_BORDER}`,
          background: "rgba(255,255,255,0.02)",
          padding: "14px 0",
          overflow: "hidden",
        }}
      >
        <div className="zuri-marquee-track">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <MarqueeItem key={i} text={item} />
          ))}
        </div>
      </div>

      {/* TRY ZURI LIVE */}
      <TryZuriSection />

      {/* HOW IT WORKS */}
      <section
        data-testid="how-it-works-section"
        style={{ padding: `${isMobile ? "60px" : "100px"} ${px}`, maxWidth: 1100, margin: "0 auto" }}
      >
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <span style={{
            display: "inline-block",
            border: `1px solid ${Z_BORDER_STRONG}`,
            color: Z_FAINT,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.12em",
            padding: "5px 14px",
            borderRadius: 100,
            marginBottom: 20,
            textTransform: "uppercase",
          }}>How it works</span>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, letterSpacing: "-1px", marginBottom: 12 }}>
            From your profile to published in{" "}
            <em style={{ fontStyle: "italic", color: Z_ORANGE }}>minutes.</em>
          </h2>
          <p style={{ color: Z_MUTED, fontSize: 16 }}>No briefs. No back-and-forth. No waiting.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: isMobile ? 12 : 2, borderRadius: 16, overflow: "hidden" }}>
          {STEP_CARDS.map(card => (
            <div
              key={card.num}
              data-testid={`step-${card.num}`}
              style={{
                background: "rgba(255,255,255,0.025)",
                padding: "36px 32px",
                transition: "background 0.2s",
                cursor: "default",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: Z_ORANGE, letterSpacing: "0.05em" }}>{card.num}</span>
                {card.icon}
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: Z_TEXT, marginBottom: 10 }}>{card.title}</h3>
              <p style={{ fontSize: 14, color: Z_MUTED, lineHeight: 1.65 }}>{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURE GRID */}
      <section
        data-testid="features-section"
        style={{ padding: `0 ${px} ${isMobile ? "60px" : "100px"}`, maxWidth: 1100, margin: "0 auto" }}
      >
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, letterSpacing: "-1px", marginBottom: 0 }}>
            Everything your brand needs.{" "}
            <em style={{ fontStyle: "italic", color: Z_ORANGE }}>Nothing it doesn&apos;t.</em>
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: isMobile ? 12 : 2, borderRadius: 16, overflow: "hidden" }}>
          {FEATURE_CARDS.map(card => (
            <div
              key={card.title}
              data-testid={`feature-card-${card.title}`}
              style={{
                background: "rgba(255,255,255,0.025)",
                padding: "36px 32px",
                transition: "background 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
            >
              <div style={{ fontSize: 28, marginBottom: 16 }}>{card.emoji}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: Z_TEXT, marginBottom: 10 }}>{card.title}</h3>
              <p style={{ fontSize: 14, color: Z_MUTED, lineHeight: 1.7, marginBottom: card.tag ? 16 : 0 }}>{card.desc}</p>
              {card.tag && (
                <span style={{
                  display: "inline-block",
                  background: card.tagColor,
                  color: card.tagTextColor,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 100,
                  letterSpacing: "0.04em",
                }}>
                  {card.tag}
                </span>
              )}
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 2,
          borderRadius: 0,
          background: "rgba(224,92,42,0.06)",
          borderTop: `1px solid rgba(224,92,42,0.15)`,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 0,
          padding: isMobile ? "28px 20px" : "40px 32px",
        }}>
          <div style={{ marginBottom: isMobile ? 24 : 0 }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>🧬</div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: Z_TEXT, marginBottom: 10 }}>
              Brand DNA - the intelligence layer
            </h3>
            <p style={{ fontSize: 14, color: Z_MUTED, lineHeight: 1.7 }}>
              Zuri reads your website, Instagram bio, TikTok captions, Facebook page, and LinkedIn simultaneously - building a Brand DNA richer than any tool on the market. Your voice file, your lessons, your cultural context. It gets smarter every time you use it.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingLeft: isMobile ? 0 : 40 }}>
            {[
              { stat: "6", label: "Social platforms read" },
              { stat: "150+", label: "Calendar events known" },
              { stat: "41+", label: "Countries served" },
              { stat: "24hr", label: "Your AI agency runs" },
            ].map(({ stat, label }) => (
              <div key={stat} style={{
                background: Z_SURFACE,
                border: `1px solid ${Z_BORDER}`,
                borderRadius: 12,
                padding: "16px 18px",
              }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: Z_ORANGE }}>{stat}</div>
                <div style={{ fontSize: 12, color: Z_MUTED, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AFRICA SECTION */}
      <section
        data-testid="africa-section"
        style={{
          background: "linear-gradient(135deg, rgba(224,92,42,0.08) 0%, rgba(42,157,138,0.05) 100%)",
          borderTop: `1px solid ${Z_BORDER}`,
          borderBottom: `1px solid ${Z_BORDER}`,
          padding: `${isMobile ? "48px" : "80px"} ${px}`,
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 36 : 64, alignItems: "center" }}>
          <div>
            <span style={{
              display: "inline-block",
              background: `rgba(224,92,42,0.12)`,
              border: `1px solid rgba(224,92,42,0.25)`,
              color: Z_ORANGE,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "5px 14px",
              borderRadius: 100,
              marginBottom: 20,
            }}>
              Built for Africa
            </span>
            <h2 style={{ fontSize: "clamp(26px, 3.5vw, 40px)", fontWeight: 800, letterSpacing: "-1px", marginBottom: 16 }}>
              The first AI marketing platform that{" "}
              <em style={{ fontStyle: "italic", color: Z_ORANGE }}>speaks your market.</em>
            </h2>
            <p style={{ fontSize: 15, color: Z_MUTED, lineHeight: 1.7, marginBottom: 24 }}>
              Other AI tools were built for Western markets. Zuri AI was built for Lagos, Nairobi, Accra, Johannesburg - and the 40 million African businesses that deserve better tools.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
              {["🇳🇬 Nigeria", "🇰🇪 Kenya", "🇬🇭 Ghana", "🇿🇦 South Africa", "🇪🇬 Egypt", "🇸🇳 Senegal", "+35 more"].map(flag => (
                <span key={flag} style={{
                  background: Z_SURFACE,
                  border: `1px solid ${Z_BORDER}`,
                  fontSize: 12,
                  padding: "5px 12px",
                  borderRadius: 100,
                  color: Z_TEXT,
                }}>
                  {flag}
                </span>
              ))}
            </div>
            <div>
              <span style={{ fontSize: 12, color: Z_MUTED }}>Africa pricing from</span>
              <div style={{ fontSize: 28, fontWeight: 800, color: Z_ORANGE }}>9,500 / month</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { stat: "40M+", label: "African businesses with no proper AI marketing tool" },
              { stat: "79%", label: "Less than a social media manager costs per month" },
              { stat: "10 min", label: "Average time from sign-up to first piece of content" },
              { stat: "#1", label: "AI platform built specifically for African markets" },
            ].map(({ stat, label }) => (
              <div key={stat} style={{
                background: Z_SURFACE,
                border: `1px solid ${Z_BORDER}`,
                borderRadius: 12,
                padding: "24px 20px",
              }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: Z_ORANGE, letterSpacing: "-1px" }}>{stat}</div>
                <div style={{ fontSize: 12, color: Z_MUTED, marginTop: 6, lineHeight: 1.5 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section
        data-testid="pricing-section"
        style={{ padding: `${isMobile ? "60px" : "100px"} ${px}`, maxWidth: 1100, margin: "0 auto" }}
      >
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, letterSpacing: "-1px", marginBottom: 10 }}>
            Honest pricing.{" "}
            <em style={{ fontStyle: "italic", color: Z_ORANGE }}>Built for your market.</em>
          </h2>
          <p style={{ color: Z_MUTED, fontSize: 15 }}>Africa pricing in Naira. Global pricing in USD. Annual plans save 17%.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12 }}>
          {PRICING_PLANS.map(plan => (
            <div
              key={plan.name}
              data-testid={`pricing-${plan.name.toLowerCase()}`}
              style={{
                background: plan.highlight ? `rgba(224,92,42,0.06)` : Z_SURFACE,
                border: `1px solid ${plan.highlight ? Z_ORANGE : Z_BORDER}`,
                borderRadius: 16,
                padding: "28px 24px",
                display: "flex",
                flexDirection: "column",
                position: "relative",
                boxShadow: plan.highlight ? `0 0 0 1px ${Z_ORANGE}` : "none",
              }}
            >
              {plan.badge && (
                <span style={{
                  position: "absolute",
                  top: -12,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: Z_ORANGE,
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 12px",
                  borderRadius: 100,
                  whiteSpace: "nowrap",
                }}>
                  {plan.badge}
                </span>
              )}
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: Z_MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {plan.name}
                </span>
              </div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: plan.price === "Custom" ? 28 : 24, fontWeight: 800, color: Z_TEXT }}>
                  {plan.currency && <span style={{ fontSize: 14, fontWeight: 500, color: Z_MUTED }}></span>}
                  {plan.price === "Custom" ? "Custom" : `${plan.price}`}
                </span>
                <span style={{ fontSize: 13, color: Z_MUTED }}>{plan.period}</span>
              </div>
              <div style={{ fontSize: 12, color: Z_ORANGE, fontWeight: 600, marginBottom: 20 }}>{plan.brands}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: Z_MUTED, lineHeight: 1.4 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={Z_TEAL} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href={plan.plan === "enterprise" ? "/contact" : `/signup?plan=${plan.plan}`}>
                <button style={{
                  width: "100%",
                  padding: "11px",
                  borderRadius: 10,
                  border: plan.highlight ? "none" : `1px solid ${Z_BORDER_STRONG}`,
                  background: plan.highlight ? Z_ORANGE : "transparent",
                  color: plan.highlight ? "#fff" : Z_TEXT,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
                  onMouseEnter={e => { if (plan.highlight) e.currentTarget.style.background = Z_ORANGE_DARK; else e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = plan.highlight ? Z_ORANGE : "transparent"; }}>
                  {plan.cta}
                </button>
              </Link>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 24 }}>
          <a href="/pricing" style={{ fontSize: 13, color: Z_MUTED, textDecoration: "none" }}
            onMouseEnter={e => (e.currentTarget.style.color = Z_TEXT)}
            onMouseLeave={e => (e.currentTarget.style.color = Z_MUTED)}>
            View full pricing
          </a>
        </div>
      </section>

      {/* FINAL CTA */}
      <section
        data-testid="final-cta-section"
        style={{
          padding: `${isMobile ? "60px" : "100px"} ${px}`,
          textAlign: "center",
          position: "relative",
          background: "radial-gradient(ellipse 600px 400px at 50% 50%, rgba(224,92,42,0.06) 0%, transparent 70%)",
        }}
      >
        <h2 style={{ fontSize: "clamp(28px, 5vw, 56px)", fontWeight: 900, letterSpacing: "-2px", marginBottom: 16 }}>
          Your brand deserves{" "}
          <em style={{ fontStyle: "italic", color: Z_ORANGE }}>better tools.</em>
        </h2>
        <p style={{ fontSize: 16, color: Z_MUTED, marginBottom: 36 }}>
          Start free. No credit card required. Your Brand DNA is ready in 10 minutes.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/signup">
            <button style={{
              background: "linear-gradient(135deg, #E05C2A, #C4391A)",
              border: "none", color: "#fff",
              padding: "14px 32px", borderRadius: 10,
              fontSize: 15, fontWeight: 700, cursor: "pointer",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(224,92,42,0.45)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
              Build Your Brand DNA - Free
            </button>
          </Link>
          <a href="mailto:hello@zuri.ai">
            <button style={{
              background: "transparent", border: `1px solid ${Z_BORDER_STRONG}`,
              color: Z_TEXT, padding: "14px 32px", borderRadius: 10,
              fontSize: 15, fontWeight: 500, cursor: "pointer",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = Z_BORDER_STRONG; e.currentTarget.style.background = "transparent"; }}>
              Talk to us
            </button>
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        data-testid="footer"
        style={{
          borderTop: `1px solid ${Z_BORDER}`,
          padding: `32px ${px}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <div
            style={{
              width: 32, height: 32,
              borderRadius: "50%",
              backgroundImage: "url('/zuri-logo-head.png')",
              backgroundSize: "112px 75px",
              backgroundPosition: "-42px -16px",
              backgroundRepeat: "no-repeat",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 16, fontWeight: 700, color: Z_TEXT }}>
            Zuri <span style={{ color: Z_ORANGE }}>AI</span>
          </span>
        </Link>
        <div style={{ display: "flex", gap: 24 }}>
          {["Privacy", "Terms", "Pricing", "Contact"].map(link => (
            <a key={link} href="#" style={{ fontSize: 13, color: Z_FAINT, textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget.style.color = Z_MUTED)}
              onMouseLeave={e => (e.currentTarget.style.color = Z_FAINT)}>
              {link}
            </a>
          ))}
        </div>
        <p style={{ fontSize: 12, color: Z_FAINT }}>© 2026 Zuri AI. Built for Africa.</p>
      </footer>
    </div>
  );
}
