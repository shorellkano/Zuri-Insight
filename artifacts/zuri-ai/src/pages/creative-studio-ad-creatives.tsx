import { useState, useRef, useEffect } from "react";
import { useBrand } from "@/context/brand-context";
import { useListBrands } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import html2canvas from "html2canvas";
import {
  Zap, Download, RefreshCw, Loader2, Sparkles, Calendar,
  Instagram, PlaySquare, Monitor, Smile,
} from "lucide-react";
import { PhotoUploadPanel } from "@/components/photo-upload-panel";
import { StudioPageShell } from "@/components/studio-page-shell";
import { SchedulePostSheet } from "@/components/schedule-post-sheet";

const API = (path: string) => `/api${path}`;

type AdPlatform = "meta" | "tiktok" | "google" | "snapchat";
type AdFormat   = "feed" | "story" | "banner";

interface PlatformDef {
  id: AdPlatform;
  label: string;
  Icon: any;
  formats: Array<{ id: AdFormat; label: string; dims: string }>;
  color: string;
}

const PLATFORMS: PlatformDef[] = [
  {
    id: "meta", label: "Meta (Facebook / Instagram)", Icon: Instagram, color: "text-blue-600 bg-blue-50",
    formats: [
      { id: "feed",  label: "Feed Ad",           dims: "1080 × 1080 (square)" },
      { id: "story", label: "Story / Reels Ad",   dims: "1080 × 1920 (vertical)" },
    ],
  },
  {
    id: "tiktok", label: "TikTok", Icon: PlaySquare, color: "text-pink-600 bg-pink-50",
    formats: [
      { id: "story", label: "In-Feed Ad",  dims: "1080 × 1920 (vertical)" },
      { id: "feed",  label: "Brand Image", dims: "1080 × 1080 (square)" },
    ],
  },
  {
    id: "google", label: "Google Display", Icon: Monitor, color: "text-amber-600 bg-amber-50",
    formats: [
      { id: "banner", label: "Display Banner",    dims: "1200 × 628 (landscape)" },
      { id: "feed",   label: "Square Display",    dims: "1080 × 1080 (square)" },
    ],
  },
  {
    id: "snapchat", label: "Snapchat", Icon: Smile, color: "text-yellow-600 bg-yellow-50",
    formats: [
      { id: "story", label: "Story Ad",    dims: "1080 × 1920 (vertical)" },
      { id: "feed",  label: "Square Post", dims: "1080 × 1080 (square)" },
    ],
  },
];

function dimsForFormat(adFormat: AdFormat): { w: number; h: number; aspect: string } {
  if (adFormat === "story")  return { w: 1080, h: 1920, aspect: "9/16"  };
  if (adFormat === "banner") return { w: 1200, h: 628,  aspect: "1200/628" };
  return { w: 1080, h: 1080, aspect: "1/1" };
}

export default function CreativeStudioAdCreatives() {
  const { activeBrandId } = useBrand();
  const { data: brands } = useListBrands();
  const { toast } = useToast();

  const [platform, setPlatform] = useState<AdPlatform>("meta");
  const [adFormat, setAdFormat] = useState<AdFormat>("feed");
  const [offerText, setOfferText] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("topic") ?? "";
  });
  const [headline, setHeadline] = useState("");
  const [tagline,  setTagline]  = useState("");
  const [ctaText,  setCtaText]  = useState("");
  const [showBrandName, setShowBrandName] = useState(true);
  const [customPhotoDataUrl, setCustomPhotoDataUrl] = useState<string | null>(null);

  const [loading,     setLoading]     = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [html,        setHtml]        = useState<string | null>(null);
  const [generated,   setGenerated]   = useState<{ headline: string; tagline: string; cta: string } | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [renderingSchedule, setRenderingSchedule] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => {
      const { w } = dimsForFormat(adFormat);
      setPreviewScale(e.contentRect.width / w);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [adFormat]);

  const currentPlatform = PLATFORMS.find(p => p.id === platform)!;
  const formatDef = currentPlatform.formats.find(f => f.id === adFormat) ?? currentPlatform.formats[0];
  const dims = dimsForFormat(adFormat);

  function selectPlatform(p: AdPlatform) {
    setPlatform(p);
    const first = PLATFORMS.find(pl => pl.id === p)!.formats[0];
    setAdFormat(first.id);
    setHtml(null);
    setGenerated(null);
  }

  async function generate() {
    if (!activeBrandId) { toast({ description: "Select a brand first", variant: "destructive" }); return; }
    setLoading(true);
    setHtml(null);
    setGenerated(null);
    try {
      const r = await fetch(API("/generate/ad-creative"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: activeBrandId, platform, adFormat,
          offerText: offerText || undefined, headline: headline || undefined,
          tagline: tagline || undefined, cta: ctaText || undefined,
          showBrandName, customPhotoDataUrl: customPhotoDataUrl || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Generation failed");
      setHtml(data.html);
      setGenerated({ headline: data.headline, tagline: data.tagline, cta: data.cta });
      if (!headline && data.headline) setHeadline(data.headline);
      if (!tagline  && data.tagline)  setTagline(data.tagline);
      if (!ctaText  && data.cta)      setCtaText(data.cta);
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function renderToPng(): Promise<string | null> {
    if (!html) return null;
    const container = document.createElement("div");
    container.style.cssText = `position:fixed;left:-9999px;top:-9999px;width:${dims.w}px;height:${dims.h}px;overflow:hidden;`;
    container.innerHTML = html;
    document.body.appendChild(container);
    try {
      const canvas = await html2canvas(container, { width: dims.w, height: dims.h, scale: 1, useCORS: true, backgroundColor: null });
      return canvas.toDataURL("image/png");
    } finally {
      document.body.removeChild(container);
    }
  }

  async function downloadPng() {
    if (!html) return;
    setDownloading(true);
    try {
      const dataUrl = await renderToPng();
      if (!dataUrl) throw new Error("Render failed");
      const link = document.createElement("a");
      link.download = `zuri-ad-${platform}-${adFormat}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      toast({ title: "Download failed", description: "Could not export the image.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  }

  async function handleScheduleClick() {
    if (!html) return;
    setRenderingSchedule(true);
    try {
      const dataUrl = await renderToPng();
      setPreviewDataUrl(dataUrl);
    } catch {
      setPreviewDataUrl(null);
    } finally {
      setRenderingSchedule(false);
      setShowSchedule(true);
    }
  }

  const aspectRatio = adFormat === "story" ? "9/16" : adFormat === "banner" ? "1200/628" : "1/1";

  const settingsNode = (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-foreground flex items-center gap-2 mb-1">
          <Zap className="h-4 w-4 text-primary" />Ad Creatives
        </h2>
        <p className="text-xs text-muted-foreground">Generate on-brand ad visuals for Meta, TikTok, Google and Snapchat.</p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ad platform</label>
        <div className="grid grid-cols-2 gap-2">
          {PLATFORMS.map(({ id, label, Icon, color }) => (
            <button key={id} onClick={() => selectPlatform(id)} className={cn("flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all text-left", platform === id ? "border-primary bg-primary/8 text-primary" : "border-border hover:border-primary/30 text-foreground")}>
              <span className={cn("w-6 h-6 rounded-md flex items-center justify-center shrink-0", color)}><Icon className="h-3.5 w-3.5" /></span>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ad format</label>
        <div className="space-y-1.5">
          {currentPlatform.formats.map(f => (
            <button key={f.id} onClick={() => { setAdFormat(f.id); setHtml(null); setGenerated(null); }} className={cn("w-full flex items-center justify-between px-4 py-2.5 rounded-xl border-2 text-sm transition-all text-left", adFormat === f.id ? "border-primary bg-primary/8 text-primary" : "border-border hover:border-primary/30 text-foreground")}>
              <span className="font-medium">{f.label}</span>
              <span className="text-xs text-muted-foreground">{f.dims}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">What are you promoting? <span className="normal-case font-normal">(optional)</span></label>
        <textarea value={offerText} onChange={e => setOfferText(e.target.value)} placeholder="e.g. 30% off our handmade skincare range this weekend only — free delivery on orders over ₦5,000" rows={3} className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
        <p className="text-[11px] text-muted-foreground">Leave blank and Zuri will write copy based on your brand profile.</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Headline <span className="normal-case font-normal">(optional)</span></label>
        <input type="text" value={headline} onChange={e => setHeadline(e.target.value)} placeholder="e.g. Your Skin Deserves Better" className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tagline <span className="normal-case font-normal">(optional)</span></label>
        <input type="text" value={tagline} onChange={e => setTagline(e.target.value)} placeholder="e.g. Handcrafted with natural Nigerian ingredients" className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CTA button text <span className="normal-case font-normal">(optional)</span></label>
        <input type="text" value={ctaText} onChange={e => setCtaText(e.target.value)} placeholder="e.g. Shop Now, Order Today, Get 30% Off" className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <div className="flex items-center justify-between py-1">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Show brand name / logo</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Include your logo or brand name on the ad</p>
        </div>
        <button type="button" onClick={() => setShowBrandName(v => !v)} className="relative rounded-full transition-colors shrink-0" style={{ width: "40px", height: "22px", background: showBrandName ? "var(--primary)" : "rgba(100,100,100,0.3)" }}>
          <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform" style={{ transform: showBrandName ? "translateX(20px)" : "translateX(2px)" }} />
        </button>
      </div>

      <PhotoUploadPanel onPhotoChange={setCustomPhotoDataUrl} label="Custom background photo" />

      <button onClick={generate} disabled={loading || !activeBrandId} className={cn("w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors", loading || !activeBrandId ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-primary hover:bg-primary/90 text-white")}>
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating ad...</> : <><Sparkles className="h-4 w-4" /> Generate Ad Creative</>}
      </button>
      {!activeBrandId && <p className="text-xs text-center text-muted-foreground">Select a brand from the top bar to get started</p>}
    </div>
  );

  const previewNode = (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 border border-border rounded-xl px-4 py-2.5">
        <span className="font-semibold text-foreground">{currentPlatform.label}</span>
        <span>—</span>
        <span>{formatDef.label}</span>
        <span>—</span>
        <span>{formatDef.dims}</span>
      </div>

      <div ref={containerRef} className="w-full rounded-2xl overflow-hidden border border-border bg-muted/20">
        {html ? (
          <div style={{ aspectRatio, position: "relative", overflow: "hidden" }}>
            <div dangerouslySetInnerHTML={{ __html: html }} style={{ transformOrigin: "top left", transform: `scale(${previewScale})`, width: dims.w, height: dims.h, position: "absolute", top: 0, left: 0 }} />
          </div>
        ) : (
          <div style={{ aspectRatio }} className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
            {loading ? (
              <>
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center"><Sparkles className="h-7 w-7 text-primary animate-pulse" /></div>
                <p className="text-sm font-medium text-foreground">Creating your ad...</p>
                <p className="text-xs text-muted-foreground">Using your brand colors and copy style</p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center"><Zap className="h-7 w-7 text-muted-foreground/40" /></div>
                <p className="text-sm font-medium text-foreground">Ad preview will appear here</p>
                <p className="text-xs text-muted-foreground max-w-xs">Configure your ad above and click Generate. Your brand colors will be used automatically.</p>
              </>
            )}
          </div>
        )}
      </div>

      {generated && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Generated copy</p>
          <div className="space-y-1.5">
            <div className="flex gap-2"><span className="text-xs text-muted-foreground w-16 shrink-0">Headline</span><span className="text-xs font-semibold text-foreground">{generated.headline}</span></div>
            <div className="flex gap-2"><span className="text-xs text-muted-foreground w-16 shrink-0">Tagline</span><span className="text-xs text-foreground">{generated.tagline}</span></div>
            <div className="flex gap-2"><span className="text-xs text-muted-foreground w-16 shrink-0">CTA</span><span className="text-xs font-semibold text-primary">{generated.cta}</span></div>
          </div>
        </div>
      )}

      {html && (
        <div className="grid grid-cols-3 gap-3">
          <button onClick={downloadPng} disabled={downloading} className="flex items-center justify-center gap-2 py-2.5 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors">
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Download PNG
          </button>
          <button onClick={generate} disabled={loading} className="flex items-center justify-center gap-2 py-2.5 bg-primary/10 text-primary border border-primary/20 rounded-xl text-sm font-medium hover:bg-primary/20 transition-colors">
            <RefreshCw className="h-4 w-4" /> Regenerate
          </button>
          <button onClick={handleScheduleClick} disabled={renderingSchedule} className="flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
            {renderingSchedule ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}{renderingSchedule ? "Preparing..." : "Schedule"}
          </button>
        </div>
      )}

      {!html && !loading && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-blue-900">Tips for great ad creatives</p>
          <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
            <li>Upload your brand's visual preferences in Brand Settings for on-brand colors</li>
            <li>Add a product photo via "Custom background photo" for the best results</li>
            <li>Keep your headline to 6-8 words — shorter headlines get more clicks</li>
            <li>Test different formats: Story ads typically have higher engagement on Meta</li>
          </ul>
        </div>
      )}
    </div>
  );

  const captionForSchedule = generated ? `${generated.headline}\n\n${generated.tagline}\n\n${generated.cta}` : "";

  return (
    <>
      <StudioPageShell title="Ad Creatives" settings={settingsNode} preview={previewNode} />
      {showSchedule && activeBrandId && (
        <SchedulePostSheet
          brandId={activeBrandId}
          defaultCaption={captionForSchedule}
          previewHtml={html ?? undefined}
          previewDataUrl={previewDataUrl ?? undefined}
          canvasH={dims.h}
          onClose={() => setShowSchedule(false)}
          onSaved={() => setShowSchedule(false)}
        />
      )}
    </>
  );
}
