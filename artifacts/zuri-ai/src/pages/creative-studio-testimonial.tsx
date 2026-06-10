import { useState } from "react";
import { useBrand } from "@/context/brand-context";
import { Loader2, Download, Calendar, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import html2canvas from "html2canvas";

const API = (path: string) => `/api${path}`;

export default function CreativeStudioTestimonial() {
  const { activeBrandId } = useBrand();
  const { toast } = useToast();

  const [testimonialText, setTestimonialText] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("testimonial") ?? p.get("quote") ?? p.get("topic") ?? "";
  });
  const [customerName, setCustomerName] = useState("");
  const [customerRole, setCustomerRole] = useState("");
  const [rating, setRating] = useState(5);
  const [format, setFormat] = useState("square");
  const [showBrandName, setShowBrandName] = useState(true);
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  async function generate() {
    if (!activeBrandId || !testimonialText.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(API("/generate/testimonial"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: activeBrandId, testimonialText, customerName, customerRole, rating, format, showBrandName }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Generation failed");
      setHtml(data.html);
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
      link.download = `zuri-testimonial-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      toast({ title: "Download failed", description: "Could not export the image.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  }

  const aspectRatio = format === "story" ? "9/16" : format === "portrait" ? "4/5" : "1/1";

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <button onClick={() => window.history.back()} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />Back
        </button>
        <div className="flex items-center gap-2 text-sm">
          <Link href="/generate/creative-studio" className="text-muted-foreground hover:text-foreground transition-colors">Creative Studio</Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium text-foreground">Testimonial Card</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6 items-start">
        <div className="space-y-5 bg-card border border-border rounded-2xl p-6">
          <div>
            <h2 className="font-semibold text-foreground mb-1">Create a Testimonial Card</h2>
            <p className="text-xs text-muted-foreground">Turn customer reviews into shareable visuals.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer's review</label>
            <textarea
              value={testimonialText}
              onChange={e => setTestimonialText(e.target.value)}
              placeholder="e.g. The best service I've ever experienced. My business doubled in 3 months!"
              rows={4}
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer name <span className="normal-case font-normal">(optional)</span></label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="e.g. Emeka A."
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role / location <span className="normal-case font-normal">(optional)</span></label>
              <input
                type="text"
                value={customerRole}
                onChange={e => setCustomerRole(e.target.value)}
                placeholder="e.g. Lagos, Nigeria"
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Star rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  className="text-2xl transition-transform hover:scale-110"
                >
                  <span style={{ color: n <= rating ? "var(--primary)" : "rgba(150,150,150,0.4)" }}>★</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Format</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "square", label: "Square 1:1" },
                { value: "portrait", label: "Portrait 4:5" },
                { value: "story", label: "Story 9:16" },
              ].map(f => (
                <button
                  key={f.value}
                  onClick={() => setFormat(f.value)}
                  className={cn(
                    "py-2 rounded-lg border text-xs font-medium transition-all",
                    format === f.value ? "border-primary bg-primary/8 text-primary" : "border-border text-muted-foreground hover:border-foreground/30"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Show brand on card</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Logo or brand name at the bottom</p>
            </div>
            <button
              type="button"
              onClick={() => setShowBrandName(v => !v)}
              className="relative rounded-full transition-colors shrink-0"
              style={{ width: "40px", height: "22px", background: showBrandName ? "var(--primary)" : "rgba(100,100,100,0.3)" }}
            >
              <span
                className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
                style={{ transform: showBrandName ? "translateX(20px)" : "translateX(2px)" }}
              />
            </button>
          </div>

          <button
            onClick={generate}
            disabled={loading || !testimonialText.trim() || !activeBrandId}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Generating...</> : "Generate Testimonial Card"}
          </button>
        </div>

        <div className="space-y-4">
          {!html ? (
            <div className="bg-card border border-dashed border-border rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-3" style={{ aspectRatio }}>
              <div className="h-16 w-16 rounded-xl bg-muted opacity-30 flex items-center justify-center text-3xl text-muted-foreground">
                ⭐
              </div>
              <p className="text-sm font-medium text-muted-foreground">Your testimonial card will appear here</p>
              <p className="text-xs text-muted-foreground">Paste a customer review and click Generate</p>
            </div>
          ) : (
            <>
              <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ aspectRatio }}>
                <div style={{ width: "100%", height: "100%", position: "relative" }} dangerouslySetInnerHTML={{ __html: html }} />
              </div>
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={downloadPng}
                  disabled={downloading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60"
                >
                  {downloading ? <><Loader2 className="h-4 w-4 animate-spin" />Exporting...</> : <><Download className="h-4 w-4" />Download PNG</>}
                </button>
                <Link href="/calendar" className="flex-1">
                  <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
                    <Calendar className="h-4 w-4" />
                    Schedule
                  </button>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
