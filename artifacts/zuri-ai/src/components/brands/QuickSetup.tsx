import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useCreateBrand, useUpdateBrand, useBuildBrandDna, getListBrandsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useBrand } from "@/context/brand-context";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, ChevronRight, X, Instagram, Youtube } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_COUNTRIES = [
  // Africa first
  "Nigeria", "Kenya", "Ghana", "South Africa", "Egypt", "Senegal", "Ethiopia",
  "Tanzania", "Uganda", "Rwanda", "Côte d'Ivoire", "Cameroon", "Zambia", "Zimbabwe",
  "Mozambique", "Angola", "Botswana", "Namibia", "Malawi", "Sudan",
  // Rest
  "United Kingdom", "United States", "Canada", "Australia", "Germany", "France",
  "Netherlands", "Spain", "Brazil", "Mexico", "Colombia", "Argentina",
  "Philippines", "Indonesia", "Malaysia", "Singapore", "Thailand", "India",
  "UAE", "Saudi Arabia", "Jordan", "Morocco",
];

const DNA_STEPS = [
  { msg: "Reading your website...", ms: 2000 },
  { msg: "Analysing your content...", ms: 2000 },
  { msg: "Reading your social profiles...", ms: 2500 },
  { msg: "Understanding your audience...", ms: 2000 },
  { msg: "Applying cultural context...", ms: 2000 },
  { msg: "Building your Brand DNA...", ms: 2000 },
];

const SOCIAL_INPUTS = [
  { key: "instagram", label: "Instagram", prefix: "@", icon: Instagram, color: "text-pink-600", bg: "bg-pink-50" },
  { key: "tiktok", label: "TikTok", prefix: "@", icon: ({ className }: any) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.54V6.78a4.85 4.85 0 01-1.02-.09z" />
    </svg>
  ), color: "text-gray-900", bg: "bg-gray-100" },
  { key: "facebook", label: "Facebook", prefix: "", icon: ({ className }: any) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ), color: "text-blue-600", bg: "bg-blue-50" },
  { key: "twitter", label: "X / Twitter", prefix: "@", icon: ({ className }: any) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ), color: "text-sky-500", bg: "bg-sky-50" },
];

const MORE_SOCIAL = [
  { key: "linkedin", label: "LinkedIn", prefix: "" },
  { key: "youtube", label: "YouTube", prefix: "@" },
  { key: "snapchat", label: "Snapchat", prefix: "@" },
];

interface FormState {
  name: string;
  description: string;
  country: string;
  website: string;
  instagram: string;
  tiktok: string;
  facebook: string;
  twitter: string;
  linkedin: string;
  youtube: string;
  snapchat: string;
}

interface Props {
  onClose?: () => void;
}

// ─── Progress indicator ───────────────────────────────────────────────────────

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "rounded-full transition-all",
            i === current ? "w-5 h-2 bg-primary" : i < current ? "w-2 h-2 bg-primary/40" : "w-2 h-2 bg-muted"
          )}
        />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QuickSetup({ onClose }: Props) {
  const [screen, setScreen] = useState(0);
  const [form, setForm] = useState<FormState>({
    name: "", description: "", country: "Nigeria", website: "",
    instagram: "", tiktok: "", facebook: "", twitter: "",
    linkedin: "", youtube: "", snapchat: "",
  });
  const [showMore, setShowMore] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [showCountryList, setShowCountryList] = useState(false);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [dnaPhase, setDnaPhase] = useState(-1);
  const [dnaError, setDnaError] = useState("");
  const dnaStarted = useRef(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { setActiveBrandId } = useBrand();
  const { toast } = useToast();

  const createBrand = useCreateBrand();
  const updateBrand = useUpdateBrand();
  const buildDna = useBuildBrandDna();

  function set(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const filteredCountries = ALL_COUNTRIES.filter((c) =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  async function handleScreen1() {
    if (!form.name.trim()) return;

    // Map continent from country
    const africaCountries = ["Nigeria","Kenya","Ghana","South Africa","Egypt","Senegal","Ethiopia","Tanzania","Uganda","Rwanda","Côte d'Ivoire","Cameroon","Zambia","Zimbabwe","Mozambique","Angola","Botswana","Namibia","Malawi","Sudan"];
    const continent = africaCountries.includes(form.country) ? "africa" : "other";

    createBrand.mutate(
      {
        data: {
          name: form.name,
          country: form.country,
          continent,
          industry: "Other",
          language: "English",
        },
      },
      {
        onSuccess: (brand) => {
          setBrandId(brand.id);
          setActiveBrandId(brand.id);
          setScreen(1);
        },
        onError: (err: any) => toast({ title: "Error", description: err?.data?.error ?? err?.message ?? "Failed to save brand.", variant: "destructive" }),
      }
    );
  }

  async function handleScreen2() {
    if (!brandId) { setScreen(2); return; }

    const updates: Record<string, string | undefined> = {};
    if (form.instagram) updates.instagramHandle = form.instagram;
    if (form.tiktok) updates.tiktokHandle = form.tiktok;
    if (form.facebook) updates.facebookUrl = form.facebook;
    if (form.twitter) updates.twitterHandle = form.twitter;
    if (form.linkedin) updates.linkedinUrl = form.linkedin;
    if (form.youtube) updates.youtubeHandle = form.youtube;
    if (form.website) updates.websiteUrl = form.website;

    if (Object.keys(updates).length > 0) {
      updateBrand.mutate({ brandId, data: updates }, {
        onSuccess: () => setScreen(2),
      });
    } else {
      setScreen(2);
    }
  }

  // DNA build on screen 2
  useEffect(() => {
    if (screen !== 2 || dnaStarted.current || !brandId) return;
    dnaStarted.current = true;

    async function runDna() {
      let idx = 0;
      setDnaPhase(0);

      async function next() {
        if (idx >= DNA_STEPS.length) {
          buildDna.mutate(
            { brandId: brandId! },
            {
              onSuccess: () => {
                setDnaPhase(6);
                queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() });
              },
              onError: (err: any) => {
                setDnaPhase(7);
                setDnaError(err?.message ?? "DNA build failed");
              },
            }
          );
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
  }, [screen, brandId]);

  function handleDone() {
    queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() });
    setLocation("/quick-create");
    onClose?.();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-card rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <img src="/zuri-ai-logo.png" alt="Zuri AI" className="h-8 w-8 rounded-full object-cover" />
            <div>
              <p className="text-xs text-muted-foreground">Quick Setup</p>
              <ProgressDots current={screen} total={3} />
            </div>
          </div>
          {onClose && screen < 2 && (
            <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Screen 1: Tell us about your business */}
        {screen === 0 && (
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-foreground">Welcome to Zuri AI.</h2>
              <p className="text-muted-foreground text-sm mt-1">Let's learn about your brand in 3 minutes.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">What is your business called?</label>
                <input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Kente Market"
                  className="w-full px-3.5 py-3 rounded-xl border border-border bg-background text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">What do you sell or do?</label>
                <textarea
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="e.g. I sell handmade skincare products for African women"
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Which country are you based in?</label>
                <div className="relative">
                  <input
                    value={showCountryList ? countrySearch : form.country}
                    onFocus={() => { setShowCountryList(true); setCountrySearch(""); }}
                    onChange={(e) => { setCountrySearch(e.target.value); setShowCountryList(true); }}
                    placeholder="Search country..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {showCountryList && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-10 max-h-44 overflow-y-auto">
                      {filteredCountries.map((c) => (
                        <button
                          key={c}
                          onClick={() => { set("country", c); setCountrySearch(""); setShowCountryList(false); }}
                          className={cn(
                            "w-full text-left px-3.5 py-2 text-sm hover:bg-muted transition-colors",
                            form.country === c ? "text-primary font-medium" : "text-foreground"
                          )}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleScreen1}
              disabled={!form.name.trim() || createBrand.isPending}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {createBrand.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Continue <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Screen 2: Social handles */}
        {screen === 1 && (
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-foreground">Add your social handles</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Zuri reads your public profile to understand your brand voice. You don't need to connect your account - just type your handle.
              </p>
            </div>

            <div className="space-y-3">
              {SOCIAL_INPUTS.map(({ key, label, prefix, icon: Icon, color, bg }) => (
                <div key={key} className="flex items-center gap-3">
                  <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", bg)}>
                    <Icon className={cn("h-4 w-4", color)} />
                  </div>
                  <div className="flex-1 relative">
                    {prefix && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{prefix}</span>
                    )}
                    <input
                      value={form[key as keyof FormState]}
                      onChange={(e) => set(key as keyof FormState, e.target.value)}
                      placeholder={label}
                      className={cn(
                        "w-full py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring",
                        prefix ? "pl-7 pr-3" : "px-3"
                      )}
                    />
                  </div>
                </div>
              ))}

              {/* More platforms */}
              {showMore && MORE_SOCIAL.map(({ key, label, prefix }) => (
                <div key={key} className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-muted-foreground">{label[0]}</span>
                  </div>
                  <div className="flex-1 relative">
                    {prefix && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{prefix}</span>
                    )}
                    <input
                      value={form[key as keyof FormState]}
                      onChange={(e) => set(key as keyof FormState, e.target.value)}
                      placeholder={label}
                      className={cn(
                        "w-full py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring",
                        prefix ? "pl-7 pr-3" : "px-3"
                      )}
                    />
                  </div>
                </div>
              ))}

              <button
                onClick={() => setShowMore((v) => !v)}
                className="text-xs text-primary hover:underline"
              >
                {showMore ? "Fewer platforms" : "More platforms (LinkedIn, YouTube, Snapchat)"}
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Do you have a website?</label>
              <input
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://yourbrand.com"
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              No handles yet? No problem - Zuri will use what you told us.
            </p>

            <button
              onClick={handleScreen2}
              disabled={updateBrand.isPending}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {updateBrand.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Continue <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Screen 3: DNA building */}
        {screen === 2 && (
          <div className="p-6 text-center space-y-6 py-10">
            {dnaPhase === 7 ? (
              <div className="space-y-4">
                <div className="h-14 w-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto">
                  <Loader2 className="h-7 w-7 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">Almost there</h2>
                  <p className="text-sm text-muted-foreground">{dnaError || "DNA build had some issues, but your brand is ready."}</p>
                </div>
                <button onClick={handleDone} className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                  Continue to Solo Founder
                </button>
              </div>
            ) : dnaPhase === 6 ? (
              <div className="space-y-4">
                <div className="h-16 w-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-1">Zuri has learned your brand.</h2>
                  <p className="text-muted-foreground text-sm">Time to create.</p>
                </div>
                <button onClick={handleDone} className="px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                  Start creating <ChevronRight className="h-4 w-4 inline" />
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-1">Building your Brand DNA</h2>
                  <p className="text-muted-foreground text-sm">About 15 seconds. Sit tight.</p>
                </div>
                <div className="max-w-xs mx-auto space-y-2 text-left">
                  {DNA_STEPS.map((s, i) => (
                    <div key={i} className={cn(
                      "flex items-center gap-2.5 text-sm transition-all",
                      i < dnaPhase ? "text-green-600" : i === dnaPhase ? "text-foreground font-medium" : "text-muted-foreground/40"
                    )}>
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
