import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useCreateBrand, useUpdateBrand, useBuildBrandDna, getListBrandsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ChevronLeft, CheckCircle2, Loader2, Globe, Instagram, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = ["Brand Basics", "Your Market", "Social Handles", "Brand Brief", "Build DNA"];

const INDUSTRIES = [
  "Fashion & Apparel", "Beauty & Cosmetics", "Food & Beverage", "Fintech & Payments",
  "Health & Wellness", "Real Estate", "Education & Training", "Technology & SaaS",
  "Retail & Ecommerce", "Entertainment", "Other",
];

const CONTINENTS = [
  { id: "africa", label: "Africa", flag: "🌍" },
  { id: "latin_america", label: "Latin America", flag: "🌎" },
  { id: "southeast_asia", label: "Southeast Asia", flag: "🌏" },
  { id: "mena", label: "Middle East & North Africa", flag: "🕌" },
  { id: "europe", label: "Europe", flag: "🌍" },
];

const COUNTRIES: Record<string, string[]> = {
  africa: ["Nigeria", "Kenya", "Ghana", "South Africa", "Egypt", "Senegal", "Ethiopia", "Tanzania", "Uganda", "Rwanda", "Côte d'Ivoire", "Cameroon"],
  latin_america: ["Brazil", "Mexico", "Colombia", "Argentina", "Chile"],
  southeast_asia: ["Philippines", "Indonesia", "Malaysia", "Singapore", "Thailand"],
  mena: ["UAE", "Saudi Arabia", "Jordan", "Morocco"],
  europe: ["United Kingdom", "Germany", "France", "Netherlands", "Spain"],
};

const LANGUAGES = [
  "English", "Nigerian Pidgin", "Swahili", "Yoruba", "Igbo", "Hausa",
  "Afrikaans", "Amharic", "French", "Portuguese", "Spanish", "Arabic",
];

const SOCIAL_PLATFORMS = [
  { key: "instagramHandle", label: "Instagram", color: "text-pink-600", bg: "bg-pink-50", icon: Instagram },
  { key: "twitterHandle", label: "X / Twitter", color: "text-sky-500", bg: "bg-sky-50", icon: ({ className }: any) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg> },
  { key: "facebookUrl", label: "Facebook", color: "text-blue-600", bg: "bg-blue-50", icon: ({ className }: any) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg> },
  { key: "tiktokHandle", label: "TikTok", color: "text-black", bg: "bg-gray-50", icon: ({ className }: any) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.54V6.78a4.85 4.85 0 01-1.02-.09z" /></svg> },
  { key: "linkedinUrl", label: "LinkedIn", color: "text-blue-700", bg: "bg-blue-50", icon: ({ className }: any) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg> },
  { key: "youtubeHandle", label: "YouTube", color: "text-red-600", bg: "bg-red-50", icon: Youtube },
  { key: "whatsappHandle", label: "WhatsApp Business", color: "text-green-600", bg: "bg-green-50", icon: ({ className }: any) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg> },
];

const DNA_STEPS = [
  { msg: "Reading your website…", ms: 2000 },
  { msg: "Analysing your content…", ms: 2000 },
  { msg: "Reading your social profiles…", ms: 3000 },
  { msg: "Understanding your audience…", ms: 2000 },
  { msg: "Applying cultural context…", ms: 2000 },
  { msg: "Building your Brand DNA…", ms: 2000 },
];

// ─── Step Indicator ────────────────────────────────────────────────────────────

function StepBar({ step }: { step: number }) {
  const pct = Math.round(((step + 1) / STEPS.length) * 100);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Step {step + 1} of {STEPS.length}: {STEPS[step]}</span>
        <span className="text-xs text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex gap-1">
        {STEPS.map((label, i) => (
          <div key={label} className={cn("flex-1 h-1 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-muted")} />
        ))}
      </div>
    </div>
  );
}

// ─── Form helpers ─────────────────────────────────────────────────────────────

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label} {required && <span className="text-primary">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring", className)} {...props} />;
}

function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn("w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring", className)} {...props}>
      {children}
    </select>
  );
}

function Btn({ children, variant = "primary", className, ...props }: { variant?: "primary" | "ghost" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50",
        variant === "primary" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border text-foreground hover:bg-muted",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

interface FormData {
  name: string;
  websiteUrl: string;
  industry: string;
  continent: string;
  country: string;
  city: string;
  language: string;
  instagramHandle: string;
  twitterHandle: string;
  facebookUrl: string;
  tiktokHandle: string;
  linkedinUrl: string;
  youtubeHandle: string;
  whatsappHandle: string;
  brandBrief: string;
}

const defaults: FormData = {
  name: "", websiteUrl: "", industry: "", continent: "africa", country: "Nigeria",
  city: "", language: "English", instagramHandle: "", twitterHandle: "",
  facebookUrl: "", tiktokHandle: "", linkedinUrl: "", youtubeHandle: "", whatsappHandle: "",
  brandBrief: "",
};

export default function BrandsNew() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(defaults);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [dnaPhase, setDnaPhase] = useState(-1); // -1=idle, 0-5=animating, 6=done, 7=error
  const [dnaError, setDnaError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createBrand = useCreateBrand();
  const updateBrand = useUpdateBrand();
  const buildDna = useBuildBrandDna();
  const dnaStarted = useRef(false);

  function set(key: keyof FormData, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: "" }));
  }

  // ── Step 1 validation ──────────────────────────────────────────────────────
  function validateStep1() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Brand name is required";
    if (form.websiteUrl && !/^https?:\/\/.+/.test(form.websiteUrl)) errs.websiteUrl = "Enter a valid URL (https://...)";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submitStep1() {
    if (!validateStep1()) return;
    if (brandId) {
      updateBrand.mutate({ brandId, data: { name: form.name, websiteUrl: form.websiteUrl || undefined, industry: form.industry || undefined } }, {
        onSuccess: () => setStep(1),
        onError: () => toast({ title: "Error", description: "Failed to save brand.", variant: "destructive" }),
      });
    } else {
      createBrand.mutate({ data: { name: form.name, websiteUrl: form.websiteUrl || undefined, industry: form.industry || undefined } }, {
        onSuccess: (b) => { setBrandId(b.id); queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() }); setStep(1); },
        onError: () => toast({ title: "Error", description: "Failed to save brand.", variant: "destructive" }),
      });
    }
  }

  // ── Step 2 → save market data ──────────────────────────────────────────────
  async function submitStep2() {
    if (!brandId) { setStep(2); return; }
    updateBrand.mutate({ brandId, data: { continent: form.continent, country: form.country, city: form.city || undefined, language: form.language, targetMarket: `${form.continent} - ${form.country}` } }, {
      onSuccess: () => setStep(2),
      onError: () => toast({ title: "Error", description: "Failed to save market info.", variant: "destructive" }),
    });
  }

  // ── Step 3 → save handles ─────────────────────────────────────────────────
  async function submitStep3() {
    if (!brandId) { setStep(3); return; }
    updateBrand.mutate({
      brandId, data: {
        instagramHandle: form.instagramHandle || undefined,
        twitterHandle: form.twitterHandle || undefined,
        facebookUrl: form.facebookUrl || undefined,
        tiktokHandle: form.tiktokHandle || undefined,
        linkedinUrl: form.linkedinUrl || undefined,
        youtubeHandle: form.youtubeHandle || undefined,
        whatsappHandle: form.whatsappHandle || undefined,
      }
    }, {
      onSuccess: () => setStep(3),
      onError: () => toast({ title: "Error", description: "Failed to save handles.", variant: "destructive" }),
    });
  }

  // ── Step 4 → save brand brief then go to DNA ──────────────────────────────
  async function submitStep4() {
    if (!brandId) { setStep(4); return; }
    const brief = form.brandBrief.trim();
    if (!brief) { setStep(4); return; }
    updateBrand.mutate({ brandId, data: { brandBrief: brief } }, {
      onSuccess: () => setStep(4),
      onError: () => toast({ title: "Error", description: "Failed to save brief.", variant: "destructive" }),
    });
  }

  // ── Step 5 DNA animation ───────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 4 || dnaStarted.current || !brandId) return;
    dnaStarted.current = true;

    async function runDna() {
      let idx = 0;
      setDnaPhase(0);

      async function next() {
        if (idx >= DNA_STEPS.length) {
          // Trigger actual build
          buildDna.mutate({ brandId: brandId! }, {
            onSuccess: () => { setDnaPhase(6); queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() }); },
            onError: (err: any) => { setDnaPhase(7); setDnaError(err?.message ?? "DNA build failed"); },
          });
          return;
        }
        setDnaPhase(idx);
        await new Promise((r) => setTimeout(r, DNA_STEPS[idx].ms));
        idx++;
        next();
      }
      next();
    }

    runDna();
  }, [step, brandId]);

  const isPending = createBrand.isPending || updateBrand.isPending;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-7" data-testid="brands-new-page">
      <div>
        <h1 className="text-2xl font-bold text-foreground">New Brand</h1>
        <p className="text-muted-foreground mt-1">Set up your brand profile and build its DNA intelligence.</p>
      </div>

      <StepBar step={step} />

      <div className="bg-card border border-border rounded-2xl p-7">
        {/* ── STEP 1: Brand Basics ───────────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-5" data-testid="step-1-brand-basics">
            <h2 className="text-lg font-semibold text-foreground">Brand basics</h2>
            <Field label="Brand Name" required>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Kente Market" data-testid="input-brand-name" />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </Field>
            <Field label="Website URL" hint="We'll crawl this to build your Brand DNA">
              <Input value={form.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} placeholder="https://yourbrand.com" data-testid="input-website-url" />
              {errors.websiteUrl && <p className="text-xs text-destructive mt-1">{errors.websiteUrl}</p>}
              {form.websiteUrl && /^https?:\/\/app\./i.test(form.websiteUrl) && (
                <div className="mt-2 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <svg className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                  <p className="text-xs text-amber-800"><strong>Heads up:</strong> App subdomains (app.*) are usually login pages - Zuri cannot read their content. Use your main marketing website instead, e.g. <strong>storvo.co</strong> not app.storvo.co</p>
                </div>
              )}
            </Field>
            <Field label="Industry">
              <Select value={form.industry} onChange={(e) => set("industry", e.target.value)} data-testid="select-industry">
                <option value="">Select industry…</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </Select>
            </Field>
            <div className="pt-2">
              <Btn onClick={submitStep1} disabled={isPending} data-testid="btn-next-step1">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Next: Your Market <ChevronRight className="h-4 w-4" />
              </Btn>
            </div>
          </div>
        )}

        {/* ── STEP 2: Market & Culture ───────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-6" data-testid="step-2-market">
            <h2 className="text-lg font-semibold text-foreground">Your market</h2>
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">Continent</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CONTINENTS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { set("continent", c.id); set("country", COUNTRIES[c.id][0]); }}
                    data-testid={`continent-${c.id}`}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium text-left transition-all",
                      form.continent === c.id
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/40 hover:bg-muted/50"
                    )}
                  >
                    <span className="text-xl">{c.flag}</span>
                    <span>{c.label}</span>
                    {form.continent === c.id && <CheckCircle2 className="h-4 w-4 ml-auto text-primary shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Country">
              <Select value={form.country} onChange={(e) => set("country", e.target.value)} data-testid="select-country">
                {(COUNTRIES[form.continent] ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="City" hint="Optional - helps with hyper-local content">
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Lagos, Nairobi, Accra" data-testid="input-city" />
            </Field>
            <Field label="Primary content language">
              <Select value={form.language} onChange={(e) => set("language", e.target.value)} data-testid="select-language">
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </Select>
            </Field>
            <div className="flex gap-3 pt-2">
              <Btn variant="ghost" onClick={() => setStep(0)} data-testid="btn-back-step2"><ChevronLeft className="h-4 w-4" /> Back</Btn>
              <Btn onClick={submitStep2} disabled={isPending} data-testid="btn-next-step2">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Next: Social Handles <ChevronRight className="h-4 w-4" />
              </Btn>
            </div>
          </div>
        )}

        {/* ── STEP 3: Social Handles ─────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5" data-testid="step-3-social">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Where does your brand live online?</h2>
              <p className="text-sm text-muted-foreground mt-1">Add your handles. We'll read your public profiles to understand your brand voice.</p>
            </div>
            <div className="space-y-3">
              {SOCIAL_PLATFORMS.map(({ key, label, color, bg, icon: Icon }) => (
                <div key={key} className="flex items-center gap-3">
                  <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", bg)}>
                    <Icon className={cn("h-4 w-4", color)} />
                  </div>
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                    <Input
                      value={form[key as keyof FormData]}
                      onChange={(e) => set(key as keyof FormData, e.target.value)}
                      placeholder={label}
                      className="pl-7"
                      data-testid={`input-${key}`}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              💡 Add at least 2 handles for the best Brand DNA results.
            </p>
            <div className="flex gap-3 pt-2">
              <Btn variant="ghost" onClick={() => setStep(1)} data-testid="btn-back-step3"><ChevronLeft className="h-4 w-4" /> Back</Btn>
              <Btn onClick={submitStep3} disabled={isPending} data-testid="btn-next-step3">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Next: Brand Brief <ChevronRight className="h-4 w-4" />
              </Btn>
            </div>
          </div>
        )}

        {/* ── STEP 4: Brand Brief ────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5" data-testid="step-4-brief">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Tell Zuri about your brand</h2>
              <p className="text-sm text-muted-foreground mt-1">
                If you have a website we can usually figure this out automatically. But a brief helps a lot - especially if your site is behind a login or your social pages are new.
              </p>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Brand Brief <span className="text-muted-foreground font-normal">(optional)</span></label>
              <textarea
                value={form.brandBrief}
                onChange={e => set("brandBrief", e.target.value)}
                placeholder={`e.g. "We are a Lagos-based streetwear brand targeting fashion-forward Nigerian youth aged 18-28. Our tone is bold, playful and unapologetically African. We create limited-edition drops inspired by Afrobeats culture."`}
                rows={6}
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                data-testid="input-brand-brief"
              />
              <p className="text-xs text-muted-foreground">Describe what you sell, who your customers are, your tone of voice, and anything that makes your brand unique.</p>
            </div>
            <div className="flex gap-3 pt-1">
              <Btn variant="ghost" onClick={() => setStep(2)} data-testid="btn-back-step4"><ChevronLeft className="h-4 w-4" /> Back</Btn>
              <Btn onClick={submitStep4} disabled={isPending} data-testid="btn-next-step4">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {form.brandBrief.trim() ? "Save & Build My DNA" : "Skip & Build DNA"} <ChevronRight className="h-4 w-4" />
              </Btn>
            </div>
          </div>
        )}

        {/* ── STEP 5: DNA Building ───────────────────────────────────────── */}
        {step === 4 && (
          <div className="text-center py-4 space-y-6" data-testid="step-4-dna">
            {dnaPhase === 7 ? (
              <div className="space-y-4">
                <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
                  <Globe className="h-7 w-7 text-destructive" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">DNA build failed</h2>
                  <p className="text-sm text-muted-foreground">{dnaError || "Something went wrong. Please try again."}</p>
                </div>
                <Btn onClick={() => { dnaStarted.current = false; setDnaPhase(-1); setDnaError(""); setStep(4); }} className="mx-auto">
                  Try again
                </Btn>
              </div>
            ) : dnaPhase === 6 ? (
              <div className="space-y-5">
                <div className="h-16 w-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-1">Your Brand DNA is ready!</h2>
                  <p className="text-muted-foreground text-sm">Zuri AI now understands your brand's voice, culture, and audience.</p>
                </div>
                <Btn onClick={() => brandId && setLocation(`/brands/${brandId}`)} className="mx-auto" data-testid="btn-view-brand">
                  View Brand Profile <ChevronRight className="h-4 w-4" />
                </Btn>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-1">Building your Brand DNA</h2>
                  <p className="text-muted-foreground text-sm">This takes about 15 seconds. Sit tight!</p>
                </div>
                <div className="max-w-sm mx-auto space-y-2 text-left">
                  {DNA_STEPS.map((s, i) => (
                    <div key={i} className={cn("flex items-center gap-2.5 text-sm transition-all", i < dnaPhase ? "text-green-600" : i === dnaPhase ? "text-foreground font-medium" : "text-muted-foreground/40")}>
                      {i < dnaPhase ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                      ) : i === dnaPhase ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-current shrink-0 opacity-30" />
                      )}
                      {s.msg}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
