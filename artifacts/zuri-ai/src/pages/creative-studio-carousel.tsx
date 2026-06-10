import { useState, useEffect } from "react";
import { useBrand } from "@/context/brand-context";
import { useListBrands } from "@workspace/api-client-react";
import { Loader2, Download, Calendar, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import html2canvas from "html2canvas";
import { StudioPageShell } from "@/components/studio-page-shell";

const API = (path: string) => `/api${path}`;

interface Slide { slide_number: number; headline: string; body: string; cta?: string; html: string; }

export default function CreativeStudioCarousel() {
  const { activeBrandId } = useBrand();
  const { data: brands } = useListBrands();
  const activeBrand = brands?.find(b => b.id === activeBrandId);
  const { toast } = useToast();

  const [topic, setTopic] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("topic") ?? "";
  });
  const [slideCount, setSlideCount] = useState(5);
  const [platform, setPlatform] = useState("instagram");
  const [showBrandName, setShowBrandName] = useState(true);
  const [logoMode, setLogoMode] = useState<"text" | "image">("text");
  const [customLogoUrl, setCustomLogoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [canvaConfigured, setCanvaConfigured] = useState(false);
  const [canvaEditUrl, setCanvaEditUrl] = useState<string | null>(null);
  const [canvaLoading, setCanvaLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch(API("/canva/status"))
      .then((r) => r.json())
      .then((d) => setCanvaConfigured(d.configured ?? false))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeBrandId) return;
    fetch(API(`/brands/${activeBrandId}/visual-prefs`))
      .then(r => r.ok ? r.json() : null)
      .then(prefs => {
        if (!prefs) return;
        if (prefs.logoUrl) { setCustomLogoUrl(prefs.logoUrl); setLogoMode("image"); }
        if (prefs.includeLogo === "always") setShowBrandName(true);
        if (prefs.includeLogo === "never") setShowBrandName(false);
      })
      .catch(() => {});
  }, [activeBrandId]);

  async function generate() {
    if (!activeBrandId) return;
    setLoading(true);
    setCanvaEditUrl(null);
    try {
      const logoUrl = showBrandName && logoMode === "image" && customLogoUrl.trim() ? customLogoUrl.trim() : undefined;
      const r = await fetch(API("/generate/carousel"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: activeBrandId, topic, slideCount, platform, showBrandName, logoUrl }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Generation failed");
      setSlides(data.slides);
      setActiveSlide(0);
      if (canvaConfigured) {
        setCanvaLoading(true);
        fetch(API("/canva/create-design"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: `Carousel: ${topic.slice(0, 40)}`, platform, format: "feed" }),
        })
          .then((r) => r.json())
          .then((d) => d.editUrl && setCanvaEditUrl(d.editUrl))
          .catch(() => {})
          .finally(() => setCanvaLoading(false));
      }
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function downloadSlides() {
    if (!slides.length) return;
    setDownloading(true);
    try {
      for (let i = 0; i < slides.length; i++) {
        const container = document.createElement("div");
        container.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1080px;height:1080px;overflow:hidden;";
        container.innerHTML = slides[i].html;
        document.body.appendChild(container);
        const canvas = await html2canvas(container, { width: 1080, height: 1080, scale: 1, useCORS: true, backgroundColor: null });
        document.body.removeChild(container);
        const link = document.createElement("a");
        link.download = `zuri-carousel-slide-${i + 1}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        await new Promise((r) => setTimeout(r, 300));
      }
      toast({ title: `${slides.length} slides downloaded` });
    } catch {
      toast({ title: "Download failed", description: "Could not export slides. Try again.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  }

  const settingsNode = (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-foreground mb-1">Create a Carousel</h2>
        <p className="text-xs text-muted-foreground">Each slide gets a headline, body text, and optional CTA.</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Topic or Theme <span className="text-muted-foreground font-normal normal-case">(optional)</span>
        </label>
        <textarea
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="Leave blank and AI will pick the best topic for your brand..."
          rows={3}
          className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Platform</label>
        <select
          value={platform}
          onChange={e => setPlatform(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="instagram">Instagram</option>
          <option value="linkedin">LinkedIn</option>
          <option value="facebook">Facebook</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Number of slides: <span className="text-primary">{slideCount}</span>
        </label>
        <input type="range" min={3} max={10} value={slideCount} onChange={e => setSlideCount(Number(e.target.value))} className="w-full accent-primary" />
        <div className="flex justify-between text-[10px] text-muted-foreground"><span>3</span><span>10</span></div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Brand mark on slides</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Show your brand on every slide</p>
          </div>
          <button
            type="button"
            onClick={() => setShowBrandName(v => !v)}
            className="relative rounded-full transition-colors shrink-0"
            style={{ width: "40px", height: "22px", background: showBrandName ? "var(--primary)" : "rgba(100,100,100,0.3)" }}
          >
            <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform" style={{ transform: showBrandName ? "translateX(20px)" : "translateX(2px)" }} />
          </button>
        </div>

        {showBrandName && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
            <p className="text-[11px] font-medium text-muted-foreground">How should your brand appear?</p>
            <div className="grid grid-cols-2 gap-2">
              {(["text", "image"] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setLogoMode(mode)}
                  className="py-2 px-3 rounded-lg border text-xs font-medium transition-colors text-left"
                  style={{
                    borderColor: logoMode === mode ? "var(--primary)" : "var(--border)",
                    background: logoMode === mode ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "transparent",
                    color: logoMode === mode ? "var(--primary)" : "var(--muted-foreground)",
                  }}
                >
                  <div className="font-bold text-sm mb-0.5">{mode === "text" ? "Aa" : "🖼"}</div>
                  {mode === "text" ? "Brand name as text" : "Upload logo image"}
                </button>
              ))}
            </div>
            {logoMode === "image" && (
              <div className="space-y-1">
                <input type="url" value={customLogoUrl} onChange={e => setCustomLogoUrl(e.target.value)} placeholder="Paste your logo image URL here..." className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                <p className="text-[10px] text-muted-foreground">Upload your logo somewhere (Google Drive, Dropbox, etc.) and paste the public link here. PNG with transparent background works best.</p>
              </div>
            )}
            {logoMode === "text" && activeBrand && (
              <p className="text-[10px] text-muted-foreground">Will display: <span className="font-semibold text-foreground">{activeBrand.name}</span></p>
            )}
          </div>
        )}
      </div>

      <button
        onClick={generate}
        disabled={loading || !activeBrandId}
        className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Generating...</> : "Generate Carousel"}
      </button>
    </div>
  );

  const previewNode = (
    <div className="space-y-4 max-w-xl mx-auto">
      {slides.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-3" style={{ aspectRatio: "1/1" }}>
          <div className="grid grid-cols-3 gap-1.5 opacity-30">
            {[1,2,3].map(i => <div key={i} className="h-16 w-12 bg-muted rounded-lg" />)}
          </div>
          <p className="text-sm font-medium text-muted-foreground">Your carousel slides will appear here</p>
          <p className="text-xs text-muted-foreground">Fill in the details and click Generate Carousel</p>
        </div>
      ) : (
        <>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="w-full" style={{ aspectRatio: "1/1" }}
              dangerouslySetInnerHTML={{ __html: `<div style="width:100%;height:100%;transform:scale(${300/1080});transform-origin:top left;width:1080px;height:1080px;">${slides[activeSlide]?.html ?? ""}</div>` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <button onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))} disabled={activeSlide === 0} className="p-2 rounded-lg border border-border disabled:opacity-30 hover:bg-muted transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-foreground">Slide {activeSlide + 1} of {slides.length}</span>
            <button onClick={() => setActiveSlide(Math.min(slides.length - 1, activeSlide + 1))} disabled={activeSlide === slides.length - 1} className="p-2 rounded-lg border border-border disabled:opacity-30 hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex gap-1.5 justify-center flex-wrap">
            {slides.map((_, i) => (
              <button key={i} onClick={() => setActiveSlide(i)} className={`h-2 rounded-full transition-all ${i === activeSlide ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30"}`} />
            ))}
          </div>

          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Slide {activeSlide + 1} copy</p>
            <p className="font-semibold text-foreground">{slides[activeSlide]?.headline}</p>
            <p className="text-sm text-muted-foreground">{slides[activeSlide]?.body}</p>
            {slides[activeSlide]?.cta && <p className="text-sm text-primary font-medium">CTA: {slides[activeSlide]?.cta}</p>}
          </div>

          <div className="flex gap-3 flex-wrap">
            <button onClick={downloadSlides} disabled={downloading} className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60">
              {downloading ? <><Loader2 className="h-4 w-4 animate-spin" />Exporting...</> : <><Download className="h-4 w-4" />Download Slides</>}
            </button>
            <Link href="/calendar" className="flex-1">
              <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
                <Calendar className="h-4 w-4" />Schedule
              </button>
            </Link>
          </div>
          {(canvaEditUrl || canvaLoading) && (
            <a href={canvaEditUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 py-2.5 border border-[#8B3DFF]/30 bg-[#8B3DFF]/8 text-[#8B3DFF] rounded-lg text-sm font-medium hover:bg-[#8B3DFF]/15 transition-colors">
              {canvaLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Opening in Canva...</> : <><ExternalLink className="h-4 w-4" /> Edit in Canva</>}
            </a>
          )}
        </>
      )}
    </div>
  );

  return <StudioPageShell title="Carousel Post" settings={settingsNode} preview={previewNode} />;
}
