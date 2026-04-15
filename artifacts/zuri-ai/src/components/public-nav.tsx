import { Link } from "wouter";

const Z_ORANGE = "#E05C2A";
const Z_ORANGE_DARK = "#C4391A";
const Z_BG = "#0C0A08";
const Z_TEXT = "#F5F0EB";
const Z_MUTED = "rgba(245,240,235,0.5)";
const Z_FAINT = "rgba(245,240,235,0.3)";
const Z_BORDER = "rgba(255,255,255,0.06)";
const Z_BORDER_STRONG = "rgba(255,255,255,0.12)";

const NAV_LINKS = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "For Africa", href: "/africa" },
  { label: "Blog", href: "/blog" },
];

const FOOTER_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact", href: "/contact" },
];

export function PublicNav() {
  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 100,
      background: "rgba(12,10,8,0.95)",
      backdropFilter: "blur(16px)",
      borderBottom: `1px solid ${Z_BORDER}`,
      padding: "0 24px",
      display: "flex", alignItems: "center",
      justifyContent: "space-between",
      height: 64,
    }}>
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          backgroundImage: "url('/zuri-logo-head.png')",
          backgroundSize: "126px 84px",
          backgroundPosition: "-47px -18px",
          backgroundRepeat: "no-repeat",
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 18, fontWeight: 700, color: Z_TEXT }}>
          Zuri <span style={{ color: Z_ORANGE }}>AI</span>
        </span>
      </Link>

      <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
        {NAV_LINKS.map(({ label, href }) => (
          <Link key={label} href={href} style={{ fontSize: 14, color: Z_MUTED, textDecoration: "none", transition: "color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.color = Z_TEXT)}
            onMouseLeave={e => (e.currentTarget.style.color = Z_MUTED)}>
            {label}
          </Link>
        ))}
        <Link href="/login">
          <button style={{
            background: "transparent", border: `1px solid ${Z_BORDER_STRONG}`, color: Z_TEXT,
            padding: "7px 16px", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer",
          }}>Sign in</button>
        </Link>
        <Link href="/signup">
          <button style={{
            background: Z_ORANGE, border: "none", color: "#fff",
            padding: "7px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
            onMouseEnter={e => (e.currentTarget.style.background = Z_ORANGE_DARK)}
            onMouseLeave={e => (e.currentTarget.style.background = Z_ORANGE)}>
            Get started
          </button>
        </Link>
      </div>
    </nav>
  );
}

export function PublicFooter() {
  return (
    <footer style={{
      borderTop: `1px solid ${Z_BORDER}`,
      padding: "32px 24px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      flexWrap: "wrap", gap: 16, background: Z_BG,
    }}>
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          backgroundImage: "url('/zuri-logo-head.png')",
          backgroundSize: "112px 75px",
          backgroundPosition: "-42px -16px",
          backgroundRepeat: "no-repeat",
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 16, fontWeight: 700, color: Z_TEXT }}>
          Zuri <span style={{ color: Z_ORANGE }}>AI</span>
        </span>
      </Link>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {FOOTER_LINKS.map(({ label, href }) => (
          <Link key={label} href={href} style={{ fontSize: 13, color: Z_FAINT, textDecoration: "none", transition: "color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.color = Z_MUTED)}
            onMouseLeave={e => (e.currentTarget.style.color = Z_FAINT)}>
            {label}
          </Link>
        ))}
      </div>
      <p style={{ fontSize: 12, color: Z_FAINT }}>© 2026 Zuri AI. Built for Africa.</p>
    </footer>
  );
}
