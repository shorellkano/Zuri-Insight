import { useState } from "react";
import { useBrand } from "@/context/brand-context";
import { Loader2, Download, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import html2canvas from "html2canvas";

const API = (path: string) => `/api${path}`;

const roles = ["Founder / CEO", "Team Member", "Customer", "Partner", "Other"];

export default function CreativeStudioBirthdayPost() {
  const { activeBrandId } = useBrand();
  const { toast } = useToast();

  const [personName, setPersonName] = useState("");
  const [personRole, setPersonRole] = useState("Team Member");
  const [shortMessage, setShortMessage] = useState("");
  const [showBrandName, setShowBrandName] = useState(true);
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [generatedMessage, setGeneratedMessage] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  async function generate() {
    if (!activeBrandId || !personName.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(API("/generate/birthday-post"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: activeBrandId, personName, personRole, shortMessage, showBrandName }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Generation failed");
      setHtml(data.html);
      setGeneratedMessage(data.message);
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
      const container = document.createElement("div");
      container.style.cssText = `position:fixed;left:-9999px;top:-9999px;width:1080px;height:1080px;overflow:hidden;`;
      container.innerHTML = html;
      document.body.appendChild(container);
      const canvas = await html2canvas(container, { width: 1080, height: 1080, scale: 1, useCORS: true, backgroundColor: null });
      document.body.removeChild(container);
      const link = document.createElement("a");
      link.download = `zuri-birthday-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      toast({ title: "Download failed", description: "Could not export the image.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/generate/creative-studio" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
          Creative Studio
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium text-foreground">Birthday Post</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6 items-start">
        <div className="space-y-5 bg-card border border-border rounded-2xl p-6">
          <div>
            <h2 className="font-semibold text-foreground mb-1">Create a Birthday Post</h2>
            <p className="text-xs text-muted-foreground">Celebrate your team, founder, or loyal customers.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Person's name</label>
            <input
              type="text"
              value={personName}
              onChange={e => setPersonName(e.target.value)}
              placeholder="e.g. Amara Okafor"
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Their role</label>
            <div className="grid grid-cols-2 gap-2">
              {roles.map(r => (
                <button
                  key={r}
                  onClick={() => setPersonRole(r)}
                  className={cn(
                    "py-2 px-3 rounded-lg border text-xs font-medium transition-all text-left",
                    personRole === r ? "border-primary bg-primary/8 text-primary" : "border-border text-muted-foreground hover:border-foreground/30"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Custom message <span className="normal-case font-normal">(optional)</span></label>
            <textarea
              value={shortMessage}
              onChange={e => setShortMessage(e.target.value)}
              placeholder="Leave blank and AI will write a heartfelt message"
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Show brand on post</p>
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
            disabled={loading || !personName.trim() || !activeBrandId}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Generating...</> : "Generate Birthday Post"}
          </button>
        </div>

        <div className="space-y-4">
          {!html ? (
            <div className="bg-card border border-dashed border-border rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-3" style={{ aspectRatio: "1/1" }}>
              <div className="h-16 w-16 rounded-xl bg-muted opacity-30 flex items-center justify-center text-3xl text-muted-foreground">
                🎂
              </div>
              <p className="text-sm font-medium text-muted-foreground">Your birthday post will appear here</p>
              <p className="text-xs text-muted-foreground">Enter a name and click Generate</p>
            </div>
          ) : (
            <>
              <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ aspectRatio: "1/1" }}>
                <div style={{ width: "100%", height: "100%", position: "relative" }} dangerouslySetInnerHTML={{ __html: html }} />
              </div>
              {generatedMessage && (
                <div className="bg-muted/40 rounded-xl p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">AI message</p>
                  <p className="text-sm text-foreground">{generatedMessage}</p>
                </div>
              )}
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
