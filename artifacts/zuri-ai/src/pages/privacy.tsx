import { PublicNav, PublicFooter } from "@/components/public-nav";

const Z_BG = "#0C0A08";
const Z_SURFACE = "#141210";
const Z_TEXT = "#F5F0EB";
const Z_MUTED = "rgba(245,240,235,0.5)";
const Z_FAINT = "rgba(245,240,235,0.3)";
const Z_BORDER = "rgba(255,255,255,0.06)";
const Z_ORANGE = "#E05C2A";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: Z_TEXT, marginBottom: 12, letterSpacing: "-0.3px" }}>{title}</h2>
      <div style={{ color: Z_MUTED, fontSize: 15, lineHeight: 1.75 }}>{children}</div>
    </div>
  );
}

export default function Privacy() {
  return (
    <div style={{ background: Z_BG, minHeight: "100vh", color: Z_TEXT, fontFamily: "Inter, system-ui, sans-serif" }}>
      <PublicNav />

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "60px 24px 100px" }}>
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 13, color: Z_FAINT, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Legal</p>
          <h1 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, letterSpacing: "-1.5px", marginBottom: 12 }}>
            Privacy <span style={{ color: Z_ORANGE }}>Policy</span>
          </h1>
          <p style={{ color: Z_MUTED, fontSize: 15 }}>Last updated: April 15, 2026</p>
        </div>

        <div style={{ background: Z_SURFACE, border: `1px solid ${Z_BORDER}`, borderRadius: 12, padding: "20px 24px", marginBottom: 40 }}>
          <p style={{ color: Z_MUTED, fontSize: 14, lineHeight: 1.7 }}>
            Zuri AI ("we", "us", or "our") is committed to protecting your privacy. This policy explains what data we collect, how we use it, and the choices you have. By using Zuri AI, you agree to this policy.
          </p>
        </div>

        <Section title="1. Information We Collect">
          <p style={{ marginBottom: 10 }}>We collect information you provide directly when you:</p>
          <ul style={{ paddingLeft: 20, marginBottom: 10 }}>
            <li style={{ marginBottom: 6 }}>Create an account (name, email address, password)</li>
            <li style={{ marginBottom: 6 }}>Set up a brand profile (brand name, website URL, industry, social handles)</li>
            <li style={{ marginBottom: 6 }}>Generate content (prompts, preferences, selected formats)</li>
            <li style={{ marginBottom: 6 }}>Make a payment (processed by Paystack; we do not store card details)</li>
          </ul>
          <p>We also automatically collect usage data such as pages visited, features used, and device/browser information to improve the platform.</p>
        </Section>

        <Section title="2. How We Use Your Information">
          <ul style={{ paddingLeft: 20 }}>
            <li style={{ marginBottom: 6 }}>Provide, personalise, and improve the Zuri AI platform</li>
            <li style={{ marginBottom: 6 }}>Generate AI-powered marketing content tailored to your brand</li>
            <li style={{ marginBottom: 6 }}>Process payments and manage your subscription</li>
            <li style={{ marginBottom: 6 }}>Send product updates, tips, and important service notices</li>
            <li style={{ marginBottom: 6 }}>Comply with legal obligations and enforce our Terms of Service</li>
          </ul>
        </Section>

        <Section title="3. Third-Party Services">
          <p style={{ marginBottom: 10 }}>We work with trusted third-party providers to deliver the platform:</p>
          <ul style={{ paddingLeft: 20 }}>
            <li style={{ marginBottom: 6 }}><strong style={{ color: Z_TEXT }}>Supabase</strong> — user authentication and database storage</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: Z_TEXT }}>OpenRouter</strong> — AI model inference for content generation</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: Z_TEXT }}>Firecrawl</strong> — website crawling to build your Brand DNA</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: Z_TEXT }}>Paystack</strong> — payment processing for African markets</li>
          </ul>
          <p style={{ marginTop: 10 }}>These services process data only as required to provide their service and are bound by their own privacy policies.</p>
        </Section>

        <Section title="4. Data Storage & Security">
          <p>Your data is stored on secure servers in compliance with industry-standard security practices. We use encryption in transit (TLS) and at rest. We do not sell your personal data to third parties under any circumstances.</p>
        </Section>

        <Section title="5. Data Retention">
          <p>We retain your data for as long as your account is active or as needed to provide services. You can request deletion of your account and associated data at any time by contacting us at <a href="mailto:hello@zuriai.africa" style={{ color: Z_ORANGE, textDecoration: "none" }}>hello@zuriai.africa</a>.</p>
        </Section>

        <Section title="6. Your Rights">
          <p style={{ marginBottom: 10 }}>Depending on your location, you may have the right to:</p>
          <ul style={{ paddingLeft: 20 }}>
            <li style={{ marginBottom: 6 }}>Access the personal data we hold about you</li>
            <li style={{ marginBottom: 6 }}>Correct inaccurate data</li>
            <li style={{ marginBottom: 6 }}>Request deletion of your data</li>
            <li style={{ marginBottom: 6 }}>Opt out of marketing communications at any time</li>
          </ul>
          <p style={{ marginTop: 10 }}>To exercise any of these rights, contact us at <a href="mailto:hello@zuriai.africa" style={{ color: Z_ORANGE, textDecoration: "none" }}>hello@zuriai.africa</a>.</p>
        </Section>

        <Section title="7. Cookies">
          <p>We use essential cookies to keep you logged in and remember your preferences. We do not use tracking or advertising cookies. You can disable cookies in your browser settings, though this may affect functionality.</p>
        </Section>

        <Section title="8. Changes to This Policy">
          <p>We may update this policy from time to time. We will notify you of significant changes by email or via an in-app notice. Continued use of Zuri AI after the changes take effect constitutes your acceptance of the updated policy.</p>
        </Section>

        <Section title="9. Contact Us">
          <p>If you have questions or concerns about this Privacy Policy, please contact us:</p>
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <a href="mailto:hello@zuriai.africa" style={{ color: Z_ORANGE, textDecoration: "none", fontSize: 15 }}>hello@zuriai.africa</a>
            <a href="tel:+2348027244825" style={{ color: Z_MUTED, textDecoration: "none", fontSize: 15 }}>+234 802 724 4825</a>
          </div>
        </Section>
      </main>

      <PublicFooter />
    </div>
  );
}
