import { useState } from "react";
import { Link } from "wouter";
import { useBrand } from "@/context/brand-context";
import { useListBrands } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Sparkles, Loader2, Copy, Check, Instagram, PlaySquare,
  ChevronDown, ChevronUp, ArrowRight, Download, CalendarDays,
} from "lucide-react";
import { PptxExport } from "@/components/pptx-export";
import type { PptxSlide } from "@/components/pptx-export";

const API = (p: string) => `/api${p}`;

const LOADING_STEPS = [
  "Reading your brand DNA...",
  "Planning your content mix...",
  "Writing Instagram posts...",
  "Writing TikTok scripts...",
  "Crafting hooks and captions...",
  "Adding hashtags...",
  "Finalising your 7-day plan...",
];

const WEEK_FOCUS_IDEAS = [
  "New product launch",
  "Building awareness",
  "Customer education",
  "Flash sale this week",
  "Ramadan / festive season",
  "Behind the scenes",
];

interface DayContent {
  day: number;
  instagram: {
    format: string;
    contentType: string;
    hook: string;
    caption: string;
    hashtags: string[];
  };
  tiktok: {
    contentType: string;
    hook: string;
    script: string;
    cta: string;
    hashtags: string[];
  };
}

interface SevenDayPlan {
  weekTheme: string;
  days: DayContent[];
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
      className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
    >
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function DayCard({ day, index }: { day: DayContent; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);
  const igFull = [day.instagram.hook, "", day.instagram.caption, "", day.instagram.hashtags.join(" ")].join("\n");
  const tiktokFull = [
    `Hook: ${day.tiktok.hook}`,
    "",
    `Script: ${day.tiktok.script}`,
    "",
    `CTA: ${day.tiktok.cta}`,
    "",
    day.tiktok.hashtags.join(" "),
  ].join("\n");

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <span className="text-sm font-black text-primary-foreground">{day.day}</span>
          </div>
          <div>
            <p className="font-bold text-sm text-foreground">Day {day.day}</p>
            <p className="text-xs text-muted-foreground">
              Instagram {day.instagram.format} · TikTok UGC
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:block text-xs text-muted-foreground">{day.instagram.contentType}</span>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {/* Instagram Section */}
          <div className="p-5 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                  <Instagram className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-xs font-bold text-foreground">Instagram {day.instagram.format}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-50 text-pink-700 font-semibold">{day.instagram.contentType}</span>
              </div>
              <CopyBtn text={igFull} />
            </div>

            <div className="space-y-2">
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">Hook (first line)</p>
                <p className="text-sm font-bold text-foreground leading-snug">{day.instagram.hook}</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">Caption</p>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{day.instagram.caption}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {day.instagram.hashtags.map((h, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-primary/8 text-primary font-medium">{h}</span>
                ))}
              </div>
            </div>
          </div>

          {/* TikTok Section */}
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-gray-900 flex items-center justify-center">
                  <PlaySquare className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-xs font-bold text-foreground">TikTok UGC Video</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700 font-semibold">{day.tiktok.contentType}</span>
              </div>
              <CopyBtn text={tiktokFull} />
            </div>

            <div className="space-y-2">
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">Open with (say this first)</p>
                <p className="text-sm font-bold text-foreground">{day.tiktok.hook}</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">Script (talking to camera)</p>
                <p className="text-sm text-foreground leading-relaxed">{day.tiktok.script}</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">Call to Action</p>
                <p className="text-sm font-semibold text-primary">{day.tiktok.cta}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {day.tiktok.hashtags.map((h, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">{h}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildSevenDaySlides(plan: SevenDayPlan, brandName: string): PptxSlide[] {
  const slides: PptxSlide[] = [];

  slides.push({
    title: "7-Day Content Starter Plan",
    subtitle: plan.weekTheme,
    body: plan.days.map(d =>
      `Day ${d.day}: Instagram ${d.instagram.format} (${d.instagram.contentType}) + TikTok UGC (${d.tiktok.contentType})`
    ).join("\n"),
  });

  for (const d of plan.days) {
    slides.push({
      tag: `Day ${d.day} - Instagram ${d.instagram.format}`,
      title: d.instagram.hook,
      subtitle: d.instagram.contentType,
      body: `${d.instagram.caption}\n\n${d.instagram.hashtags.join(" ")}`,
      footer: `Instagram ${d.instagram.format}`,
    });
    slides.push({
      tag: `Day ${d.day} - TikTok UGC`,
      title: d.tiktok.hook,
      subtitle: d.tiktok.contentType,
      body: `${d.tiktok.script}\n\nCTA: ${d.tiktok.cta}\n\n${d.tiktok.hashtags.join(" ")}`,
      footer: `TikTok UGC Video`,
    });
  }

  slides.push({
    title: "You are ready. Now plan your full month.",
    subtitle: "Head to Month Planner for 30 days of content",
    body: "You have completed your 7-day starter pack. You now have:\n- 7 Instagram posts (Reels, Carousels, Stories)\n- 7 TikTok UGC video scripts\n\nYour next step: use the Month Planner to build a full 30-day content calendar.",
  });

  return slides;
}

export default function SevenDayStarter() {
  const { activeBrandId } = useBrand();
  const { data: brands } = useListBrands();
  const { toast } = useToast();

  const [weekFocus, setWeekFocus] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [plan, setPlan] = useState<SevenDayPlan | null>(null);

  const activeBrand = brands?.find(b => b.id === activeBrandId);

  async function generate() {
    if (!activeBrandId) {
      toast({ title: "Pick a brand first", description: "Set up a brand so Zuri knows your voice.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setPlan(null);
    let step = 0;
    const interval = setInterval(() => {
      step = (step + 1) % LOADING_STEPS.length;
      setLoadingStep(step);
    }, 1800);

    try {
      const r = await fetch(API("/generate/7day-starter"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: activeBrandId, weekFocus: weekFocus.trim() || undefined }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? `Error ${r.status}`);
      setPlan(data);
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message ?? "Please try again.", variant: "destructive" });
    } finally {
      clearInterval(interval);
      setLoading(false);
      setLoadingStep(0);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="text-xl">🗓️</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">7-Day Content Starter</h1>
            <p className="text-sm text-muted-foreground">Instagram + TikTok. 7 days. Ready to post.</p>
          </div>
        </div>
      </div>

      {/* What you get strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { icon: "📸", label: "7 Instagram posts", sub: "Reels, Carousels, Stories" },
          { icon: "🎥", label: "7 TikTok scripts", sub: "UGC talking-camera" },
          { icon: "🔥", label: "Hooks + captions", sub: "Ready to copy-paste" },
          { icon: "📥", label: "PPTX export", sub: "Download & share" },
        ].map(({ icon, label, sub }) => (
          <div key={label} className="flex flex-col gap-1 p-3 rounded-xl bg-muted/40 border border-border">
            <span className="text-lg">{icon}</span>
            <p className="text-xs font-bold text-foreground leading-tight">{label}</p>
            <p className="text-[10px] text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      {/* Input card */}
      {!plan && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
          {/* Brand */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-bold text-primary text-sm">
              {activeBrand?.name?.charAt(0) ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{activeBrand?.name ?? "No brand selected"}</p>
              <p className="text-xs text-muted-foreground">{activeBrand?.country ?? ""}{activeBrand?.industry ? ` · ${activeBrand.industry}` : ""}</p>
            </div>
            {!activeBrand && (
              <Link href="/brands/new">
                <button className="text-xs font-semibold text-primary hover:underline shrink-0">Set up brand</button>
              </Link>
            )}
          </div>

          {/* Week focus */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              What is this week about? <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              value={weekFocus}
              onChange={e => setWeekFocus(e.target.value)}
              placeholder="e.g. Launching my new skincare range"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {WEEK_FOCUS_IDEAS.map(idea => (
                <button
                  key={idea}
                  onClick={() => setWeekFocus(idea)}
                  className="px-2.5 py-1 rounded-full bg-muted border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                >
                  {idea}
                </button>
              ))}
            </div>
          </div>

          {/* Generate */}
          <button
            onClick={generate}
            disabled={loading || !activeBrandId}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {loading ? (
              <><Loader2 className="h-5 w-5 animate-spin" />{LOADING_STEPS[loadingStep]}</>
            ) : (
              <><Sparkles className="h-5 w-5" />Build My 7-Day Plan</>
            )}
          </button>
        </div>
      )}

      {/* Loading overlay (when plan is generating) */}
      {loading && !plan && (
        <div className="text-center py-6 space-y-3">
          <div className="flex justify-center gap-1">
            {LOADING_STEPS.map((s, i) => (
              <div key={i} className={cn("h-1 rounded-full transition-all duration-500", i <= loadingStep ? "bg-primary w-6" : "bg-muted w-2")} />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">{LOADING_STEPS[loadingStep]}</p>
        </div>
      )}

      {/* Results */}
      {plan && (
        <div className="space-y-5">
          {/* Plan header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">Your 7-Day Plan is ready</h2>
              {plan.weekTheme && (
                <p className="text-sm text-muted-foreground mt-0.5">Theme: <span className="font-medium text-foreground">{plan.weekTheme}</span></p>
              )}
            </div>
            <button
              onClick={() => { setPlan(null); setWeekFocus(""); }}
              className="text-xs text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-lg transition-colors shrink-0"
            >
              Start over
            </button>
          </div>

          {/* Platform legend */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-5 w-5 rounded-md bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                <Instagram className="h-3 w-3 text-white" />
              </div>
              <span className="text-muted-foreground">Instagram (Reel / Carousel / Story)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-5 w-5 rounded-md bg-gray-900 flex items-center justify-center">
                <PlaySquare className="h-3 w-3 text-white" />
              </div>
              <span className="text-muted-foreground">TikTok UGC Video</span>
            </div>
          </div>

          {/* Day cards */}
          <div className="space-y-3">
            {plan.days.map((day, i) => (
              <DayCard key={day.day} day={day} index={i} />
            ))}
          </div>

          {/* Export + CTA */}
          <div className="space-y-3 pt-2">
            <PptxExport
              variant="card"
              deckTitle={`7-Day Content Plan - ${activeBrand?.name ?? "My Brand"}`}
              brandName={activeBrand?.name}
              buttonLabel="Download 7-Day Plan as PowerPoint"
              slides={buildSevenDaySlides(plan, activeBrand?.name ?? "My Brand")}
              filename="7_day_content_plan"
            />

            <div className="rounded-2xl bg-gradient-to-br from-primary/8 to-primary/3 border border-primary/20 p-5 flex items-center justify-between gap-4">
              <div>
                <p className="font-bold text-sm text-foreground">Ready for more?</p>
                <p className="text-xs text-muted-foreground mt-0.5">Build a full month of content - 30 days, all platforms, auto-scheduled.</p>
              </div>
              <Link href="/generate/bulk-plan">
                <button className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors shrink-0 whitespace-nowrap">
                  <CalendarDays className="h-4 w-4" />
                  Plan my month
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
