import { PublicNav, PublicFooter } from "@/components/public-nav";

const Z_BG = "#0C0A08";
const Z_SURFACE = "#141210";
const Z_TEXT = "#F5F0EB";
const Z_MUTED = "rgba(245,240,235,0.5)";
const Z_FAINT = "rgba(245,240,235,0.3)";
const Z_BORDER = "rgba(255,255,255,0.06)";
const Z_ORANGE = "#E05C2A";
const Z_TEAL = "#2A9D8A";

type ContactCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
};

function ContactCard({ icon, label, value, href }: ContactCardProps) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer"
      style={{ textDecoration: "none" }}
    >
      <div style={{
        background: Z_SURFACE,
        border: `1px solid ${Z_BORDER}`,
        borderRadius: 16,
        padding: "28px 32px",
        display: "flex", flexDirection: "column", gap: 12,
        cursor: "pointer",
        transition: "border-color 0.2s",
      }}
        onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.borderColor = "rgba(224,92,42,0.4)")}
        onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.borderColor = Z_BORDER)}
      >
        <div style={{ color: Z_ORANGE, fontSize: 28 }}>{icon}</div>
        <p style={{ color: Z_FAINT, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>{label}</p>
        <p style={{ color: Z_TEXT, fontSize: 17, fontWeight: 600, margin: 0 }}>{value}</p>
      </div>
    </a>
  );
}

export default function Contact() {
  return (
    <div style={{ background: Z_BG, minHeight: "100vh", color: Z_TEXT, fontFamily: "Inter, system-ui, sans-serif" }}>
      <PublicNav />

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px 100px" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <p style={{ fontSize: 13, color: Z_FAINT, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Get in touch</p>
          <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 800, letterSpacing: "-2px", marginBottom: 16 }}>
            We'd love to <span style={{ color: Z_ORANGE }}>hear from you</span>
          </h1>
          <p style={{ color: Z_MUTED, fontSize: 17, maxWidth: 520, margin: "0 auto" }}>
            Whether you have a question, want a demo, or need support — our team is here for you. We typically respond within one business day.
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
          marginBottom: 64,
        }}>
          <ContactCard
            icon={
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            }
            label="Email us"
            value="hello@zuriai.africa"
            href="mailto:hello@zuriai.africa"
          />
          <ContactCard
            icon={
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.09 6.09l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
              </svg>
            }
            label="Call or WhatsApp"
            value="+234 802 724 4825"
            href="tel:+2348027244825"
          />
          <ContactCard
            icon={
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            }
            label="Follow us on Instagram"
            value="@zuriai"
            href="https://instagram.com/zuriai"
          />
        </div>

        <div style={{
          background: Z_SURFACE,
          border: `1px solid ${Z_BORDER}`,
          borderRadius: 20,
          padding: "40px 40px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 48,
          flexWrap: "wrap",
        }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, letterSpacing: "-0.5px" }}>
              For enterprise enquiries
            </h2>
            <p style={{ color: Z_MUTED, fontSize: 15, lineHeight: 1.7, marginBottom: 20 }}>
              Looking to deploy Zuri AI across your organisation, agency, or government initiative? We offer custom packages for teams and enterprises across Africa.
            </p>
            <p style={{ color: Z_MUTED, fontSize: 15, lineHeight: 1.7 }}>
              Send us a message at <a href="mailto:hello@zuriai.africa" style={{ color: Z_ORANGE, textDecoration: "none" }}>hello@zuriai.africa</a> with your organisation's name and requirements.
            </p>
          </div>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, letterSpacing: "-0.5px" }}>
              Support hours
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { day: "Monday – Friday", hours: "8:00 AM – 8:00 PM WAT" },
                { day: "Saturday", hours: "10:00 AM – 4:00 PM WAT" },
                { day: "Sunday", hours: "Closed (urgent emails monitored)" },
              ].map(({ day, hours }) => (
                <div key={day} style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                  <span style={{ color: Z_MUTED, fontSize: 14 }}>{day}</span>
                  <span style={{ color: Z_TEXT, fontSize: 14, fontWeight: 500 }}>{hours}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, padding: "14px 18px", background: "rgba(42,157,138,0.1)", border: "1px solid rgba(42,157,138,0.2)", borderRadius: 10 }}>
              <p style={{ color: Z_TEAL, fontSize: 13, margin: 0 }}>
                Average response time: <strong>under 4 hours</strong> on business days
              </p>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
