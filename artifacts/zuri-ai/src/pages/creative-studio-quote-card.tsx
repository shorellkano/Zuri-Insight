import { useState, useEffect } from "react";
import { useBrand } from "@/context/brand-context";
import { Loader2, Download, Calendar, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import html2canvas from "html2canvas";
import { StudioPageShell } from "@/components/studio-page-shell";

const API = (path: string) => `/api${path}`;

export default function CreativeStudioQuoteCard() {
  const { activeBrandId } = useBrand();
  const { toast } = useToast();

  const [quoteText, setQuoteText] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("quote") ?? "";
  });
  const [attribution, setAttribution] = useState("");
  const [backgroundStyle, setBackgroundStyle] = useState("solid");
  const [format, setFormat] = useState("square");
  const [showBrandName, setShowBrandName] = useState(true);
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
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

  async function generate() {
    if (!activeBrandId || !quoteText.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(API("/generate/quote-card"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: activeBrandId, quoteText, attribution, backgroundStyle, format, showBrandName }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Generation failed");
      setHtml(data.html);
      setCanvaEditUrl(null);
      if (canvaConfigured) {
        setCanvaLoading(true);
        fetch(API("/canva/create-design"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: `Quote Card: ${quoteText.slice(0, 40)}`, platform: "instagram", format }),
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

  async function downloadPng() {
    if (!html) return;
    setDownloading(true);
    try {
      const size = format === "story" ? { w: 1080, h: 1920 } : format === "portrait" ? { w: 1080, h: 1350 } : { w: 1080, h: 1080 };
      const container = document.createElement("div");
      container.style.cssText = `position:fixed;left:-9999px;top:-9999px;width:${size.w}px;height:${size.h}px;overflow:hidden;`;
      container.innerHTML = html;
      document.body.appendChild(container);
      const canvas = await html2canvas(container, { width: size.w, height: size.h, scale: 1, useCORS: true, backgroundColor: null });
      document.body.removeChild(container);
      const link = document.createElement("a");
      link.download = `zuri-quote-card-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      toast({ title: "Download failed", description: "Could not export the image. Try again.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  }

  const aspectRatio = format === "story" ? "9/16" : format === "portrait" ? "4/5" : "1/1";

  const settingsNode = (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-foreground mb-1">Create a Quote Card</h2>
        <p className="text-xs text-muted-foreground">Bold text-forward design with your brand colours.</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quote text</label>
        <textarea value={quoteText} onChange={e => setQuoteText(e.target.value)} placeholder="e.g. The best marketing doesn't feel like marketing." rows={3} className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attribution (optional)</label>
        <input type="text" value={attribution} onChange={e => setAttribution(e.target.value)} placeholder="e.g. Founder's name or brand name" className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Background style</label>
        <div className="grid grid-cols-3 gap-2">
          {["solid", "gradient", "abstract"].map(s => (
            <button key={s} onClick={() => setBackgroundStyle(s)} className={cn("py-2 rounded-lg border text-xs font-medium capitalize transition-all", backgroundStyle === s ? "border-primary bg-primary/8 text-primary" : "border-border text-muted-foreground hover:border-foreground/30")}>{s}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Format</label>
        <div className="grid grid-cols-3 gap-2">
          {[{ value: "square", label: "Square 1:1" }, { value: "portrait", label: "Portrait 4:5" }, { value: "story", label: "Story 9:16" }].map(f => (
            <button key={f.value} onClick={() => setFormat(f.value)} className={cn("py-2 rounded-lg border text-xs font-medium transition-all", format === f.value ? "border-primary bg-primary/8 text-primary" : "border-border text-muted-foreground hover:border-foreground/30")}>{f.label}</button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between py-1">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Show brand on card</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Logo or brand name at the bottom</p>
        </div>
        <button type="button" onClick={() => setShowBrandName(v => !v)} className="relative rounded-full transition-colors shrink-0" style={{ width: "40px", height: "22px", background: showBrandName ? "var(--primary)" : "rgba(100,100,100,0.3)" }}>
          <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform" style={{ transform: showBrandName ? "translateX(20px)" : "translateX(2px)" }} />
        </button>
      </div>

      <button onClick={generate} disabled={loading || !quoteText.trim() || !activeBrandId} className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Generating...</> : "Generate Quote Card"}
      </button>
    </div>
  );

  const previewNode = (
    <div className="space-y-4 max-w-2xl mx-auto">
      {!html ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-3" style={{ aspectRatio }}>
          <div className="h-16 w-16 rounded-xl bg-muted opacity-30 flex items-center justify-center"><span className="text-3xl text-muted-foreground">"</span></div>
          <p className="text-sm font-medium text-muted-foreground">Your quote card will appear here</p>
          <p className="text-xs text-muted-foreground">Fill in the text and click Generate</p>
        </div>
      ) : (
        <>
          <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ aspectRatio }}>
            <div style={{ width: "100%", height: "100%", position: "relative" }} dangerouslySetInnerHTML={{ __html: html }} />
          </div>
          <div className="flex gap-3 flex-wrap">
            <button onClick={downloadPng} disabled={downloading} className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60">
              {downloading ? <><Loader2 className="h-4 w-4 animate-spin" />Exporting...</> : <><Download className="h-4 w-4" />Download PNG</>}
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

  return <StudioPageShell title="Quote Card" settings={settingsNode} preview={previewNode} />;
}
