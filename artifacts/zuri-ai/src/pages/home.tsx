import { Link } from "wouter";
import { Sparkles, Zap, Globe, Shield, ArrowRight, CheckCircle2, Star } from "lucide-react";
import { useState, useEffect } from "react";

const features = [
  {
    icon: Sparkles,
    title: "Brand DNA Intelligence",
    desc: "Zuri reads your website and social profiles to build a deep understanding of your brand's voice, values, and cultural context."
  },
  {
    icon: Globe,
    title: "African Market Expertise",
    desc: "Every piece of content is crafted with cultural awareness for West, East, Southern, and Pan-African markets."
  },
  {
    icon: Zap,
    title: "Instant Multi-Format Content",
    desc: "Generate ad copy, social posts, email campaigns, WhatsApp messages, and video scripts in seconds."
  },
  {
    icon: Shield,
    title: "On-Brand Every Time",
    desc: "Your Brand DNA profile ensures every output stays true to your voice, never generic or off-message."
  },
];

const formats = [
  { label: "Ad Copy", color: "bg-primary/10 text-primary border border-primary/20" },
  { label: "Instagram Posts", color: "bg-secondary/10 text-secondary border border-secondary/20" },
  { label: "Email Campaigns", color: "bg-accent/20 text-foreground border border-accent/30" },
  { label: "WhatsApp Messages", color: "bg-green-100 text-green-700 border border-green-200" },
  { label: "Video Scripts", color: "bg-purple-100 text-purple-700 border border-purple-200" },
  { label: "LinkedIn Content", color: "bg-blue-100 text-blue-700 border border-blue-200" },
  { label: "Twitter/X Posts", color: "bg-sky-100 text-sky-700 border border-sky-200" },
  { label: "TikTok Scripts", color: "bg-pink-100 text-pink-700 border border-pink-200" },
];

const testimonials = [
  { quote: "Zuri AI understands our market in a way no other tool does. Our engagement rates doubled.", name: "Amara Diallo", company: "Lagos Fashion Week" },
  { quote: "Finally, AI that gets African business culture. The content feels authentic, not copy-paste.", name: "Kwame Asante", company: "Savanna Tech, Nairobi" },
  { quote: "We cut our content creation time by 80% while maintaining our brand voice perfectly.", name: "Lerato Molefe", company: "Ubuntu Foods, Johannesburg" },
];

const BADGE_LINES = [
  { flag: "🇳🇬", text: "Nigeria-First Brand Intelligence" },
  { flag: "⚡", text: "Your design agency - open 24/7" },
  { flag: "🧬", text: "Built on real Brand DNA, not guesswork" },
  { flag: "🌍", text: "Cultural AI that speaks your market" },
  { flag: "🚀", text: "Beta - Now powering African brands" },
];

function LiveBadge() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % BADGE_LINES.length);
        setVisible(true);
      }, 300);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const { flag, text } = BADGE_LINES[idx];

  return (
    <div className="inline-flex items-center gap-3 px-4 py-2 bg-background border border-primary/30 rounded-full text-sm font-medium shadow-sm shadow-primary/10 mb-6 select-none">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
      </span>
      <span
        className="transition-all duration-300 text-foreground"
        style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(-6px)" }}
      >
        <span className="mr-1">{flag}</span>
        {text}
      </span>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 inset-x-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border" data-testid="nav-home">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/zuri-ai-logo.png" alt="Zuri AI" className="h-9 w-9 rounded-full object-cover" data-testid="home-logo" />
            <span className="text-xl font-bold">Zuri <span className="text-primary">AI</span></span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" data-testid="nav-dashboard-link">
              <button className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5">
                Sign In
              </button>
            </Link>
            <Link href="/dashboard" data-testid="nav-get-started-btn">
              <button className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
                Get Started <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-4 text-center relative overflow-hidden" data-testid="hero-section">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5 pointer-events-none" />
        <div className="relative max-w-4xl mx-auto">
          <LiveBadge />
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-foreground leading-tight mb-6">
            Your AI design agency,
            <br />
            running <span className="text-primary">24 hours</span> a day.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Zuri AI learns your Brand DNA, understands African markets, and delivers on-brand campaigns, visuals, and copy the moment you need them - no briefs, no waiting.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/brands/new" data-testid="hero-cta-primary">
              <button className="flex items-center gap-2 px-7 py-3.5 bg-primary text-primary-foreground rounded-xl text-base font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25">
                <Sparkles className="h-5 w-5" />
                Build Your Brand DNA
              </button>
            </Link>
            <Link href="/dashboard" data-testid="hero-cta-secondary">
              <button className="flex items-center gap-2 px-7 py-3.5 bg-card text-foreground border border-border rounded-xl text-base font-semibold hover:bg-muted transition-colors">
                View Dashboard
              </button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-12 px-4 bg-muted/50 border-y border-border" data-testid="formats-section">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-sm font-medium text-muted-foreground mb-6 uppercase tracking-wider">Generate content for every platform</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {formats.map(({ label, color }) => (
              <span key={label} className={`px-4 py-2 rounded-full text-sm font-medium ${color}`} data-testid={`format-badge-${label}`}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4" data-testid="features-section">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-foreground mb-4">A full creative team - built into one platform.</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Most AI tools ignore the nuances of African markets. Zuri AI was built from the ground up with the cultural intelligence, brand depth, and creative range of an agency - without the agency costs.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-card border border-border rounded-2xl p-7 hover:border-primary/40 transition-colors" data-testid={`feature-card-${title}`}>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">{title}</h3>
                <p className="text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-muted/30" data-testid="how-it-works-section">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Onboard your agency in 3 steps.</h2>
          <p className="text-lg text-muted-foreground mb-14">No lengthy briefs. No waiting. Just point Zuri at your brand and your creative team is ready to work.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Add Your Brand", desc: "Enter your website URL and social media handles." },
              { step: "02", title: "Build Brand DNA", desc: "Zuri analyzes your brand and creates your unique intelligence profile." },
              { step: "03", title: "Generate Content", desc: "Choose a format, add a prompt, and get on-brand content instantly." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="relative" data-testid={`step-${step}`}>
                <div className="text-6xl font-bold text-primary/10 mb-3">{step}</div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4" data-testid="testimonials-section">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">Trusted by African Businesses</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map(({ quote, name, company }) => (
              <div key={name} className="bg-card border border-border rounded-2xl p-7" data-testid={`testimonial-${name}`}>
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 text-accent fill-accent" />)}
                </div>
                <p className="text-foreground mb-5 leading-relaxed italic">"{quote}"</p>
                <div>
                  <p className="font-semibold text-foreground text-sm">{name}</p>
                  <p className="text-muted-foreground text-xs">{company}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-primary/5 border-y border-primary/10" data-testid="pricing-section">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Agency output. Fraction of the cost.</h2>
          <p className="text-lg text-muted-foreground mb-10">Start free. Scale as your brand grows.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            {[
              {
                name: "Starter", price: "Free", period: "forever", highlight: false,
                features: ["1 Brand profile", "50 content generations/month", "Ad copy, social posts", "Email support"],
              },
              {
                name: "Growth", price: "$29", period: "per month", highlight: true,
                features: ["10 Brand profiles", "Unlimited generations", "All content formats", "Priority support", "WhatsApp & Video Scripts", "Brand DNA analytics"],
              },
            ].map(({ name, price, period, features, highlight }) => (
              <div key={name} className={`rounded-2xl p-8 border ${highlight ? "bg-primary text-primary-foreground border-primary shadow-xl shadow-primary/25" : "bg-card border-border"}`} data-testid={`pricing-${name.toLowerCase()}`}>
                <h3 className={`text-xl font-bold mb-1 ${highlight ? "text-primary-foreground" : "text-foreground"}`}>{name}</h3>
                <div className={`text-4xl font-bold mb-1 ${highlight ? "text-primary-foreground" : "text-foreground"}`}>{price}</div>
                <p className={`text-sm mb-6 ${highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{period}</p>
                <ul className="space-y-3 mb-8">
                  {features.map((f) => (
                    <li key={f} className={`flex items-center gap-2.5 text-sm ${highlight ? "text-primary-foreground/90" : "text-foreground"}`}>
                      <CheckCircle2 className={`h-4 w-4 shrink-0 ${highlight ? "text-primary-foreground" : "text-primary"}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/dashboard" data-testid={`pricing-cta-${name.toLowerCase()}`}>
                  <button className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${highlight ? "bg-white text-primary hover:bg-white/90" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}>
                    Get Started
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-12 px-4 border-t border-border" data-testid="footer">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/zuri-ai-logo.png" alt="Zuri AI" className="h-8 w-8 rounded-full object-cover" />
            <span className="font-bold text-foreground">Zuri <span className="text-primary">AI</span></span>
          </div>
          <p className="text-sm text-muted-foreground">Your AI design agency for African brands.</p>
          <p className="text-sm text-muted-foreground">© 2026 Zuri AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
