import { useState, useRef, useEffect } from "react";
import { useBrand } from "@/context/brand-context";
import { Loader2, Download, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import html2canvas from "html2canvas";
import { removeBackground } from "@imgly/background-removal";
import { PhotoUploadPanel } from "@/components/photo-upload-panel";
import { StudioPageShell } from "@/components/studio-page-shell";
import { SchedulePostSheet } from "@/components/schedule-post-sheet";

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
  const [showSchedule, setShowSchedule] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [renderingSchedule, setRenderingSchedule] = useState(false);
  const [logoPosition, setLogoPosition] = useState("bottom-center");
  const [contactInfo, setContactInfo] = useState({ website: "", instagram: "", phone: "" });
  const [celebrantPhotoDataUrl, setCelebrantPhotoDataUrl] = useState<string | null>(null);
  const [removingBg, setRemovingBg] = useState(false);
  const [customPhotoDataUrl, setCustomPhotoDataUrl] = useState<string | null>(null);
  const [smoothFace, setSmoothFace] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setPreviewScale(e.contentRect.width / 1080));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  async function generate() {
    if (!activeBrandId || !personName.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(API("/generate/birthday-post"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: activeBrandId, personName, personRole, shortMessage, showBrandName, logoPosition, contactInfo, celebrantPhotoDataUrl, customPhotoDataUrl, smoothFace }),
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

  async function renderToPng(): Promise<string | null> {
    if (!html) return null;
    const container = document.createElement("div");
    container.style.cssText = `position:fixed;left:-9999px;top:-9999px;width:1080px;height:1080px;overflow:hidden;`;
    container.innerHTML = html;
    document.body.appendChild(container);
    try {
      const canvas = await html2canvas(container, { width: 1080, height: 1080, scale: 1, useCORS: true, backgroundColor: null });
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
      link.download = `zuri-birthday-${Date.now()}.png`;
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

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setCelebrantPhotoDataUrl(ev.target?.result as string ?? null);
    reader.readAsDataURL(file);
  }

  async function handleRemoveBg() {
    if (!celebrantPhotoDataUrl) return;
    setRemovingBg(true);
    try {
      const res = await fetch(celebrantPhotoDataUrl);
      const blob = await res.blob();
      const resultBlob = await removeBackground(blob);
      const reader = new FileReader();
      reader.onload = ev => setCelebrantPhotoDataUrl(ev.target?.result as string ?? null);
      reader.readAsDataURL(resultBlob);
    } catch {
      toast({ title: "Background removal failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setRemovingBg(false);
    }
  }

  const settingsNode = (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-foreground mb-1">Create a Birthday Post</h2>
        <p className="text-xs text-muted-foreground">Celebrate your team, founder, or loyal customers.</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Person's name</label>
        <input type="text" value={personName} onChange={e => setPersonName(e.target.value)} placeholder="e.g. Amara Okafor" className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Their role</label>
        <div className="grid grid-cols-2 gap-2">
          {roles.map(r => (
            <button key={r} onClick={() => setPersonRole(r)} className={cn("py-2 px-3 rounded-lg border text-xs font-medium transition-all text-left", personRole === r ? "border-primary bg-primary/8 text-primary" : "border-border text-muted-foreground hover:border-foreground/30")}>{r}</button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Custom message <span className="normal-case font-normal">(optional)</span></label>
        <textarea value={shortMessage} onChange={e => setShortMessage(e.target.value)} placeholder="Leave blank and AI will write a heartfelt message" rows={2} className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
      </div>

      <div className="flex items-center justify-between py-1">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Show brand on post</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Logo or brand name at the bottom</p>
        </div>
        <button type="button" onClick={() => setShowBrandName(v => !v)} className="relative rounded-full transition-colors shrink-0" style={{ width: "40px", height: "22px", background: showBrandName ? "var(--primary)" : "rgba(100,100,100,0.3)" }}>
          <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform" style={{ transform: showBrandName ? "translateX(20px)" : "translateX(2px)" }} />
        </button>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Celebrant photo <span className="normal-case font-normal">(optional)</span></label>
        {celebrantPhotoDataUrl ? (
          <div className="space-y-2">
            <div className="relative rounded-lg overflow-hidden" style={{ background: "repeating-conic-gradient(#80808020 0% 25%, transparent 0% 50%) 0 0 / 12px 12px" }}>
              <img src={celebrantPhotoDataUrl} alt="Celebrant" className="w-full h-28 object-contain" />
              <button type="button" onClick={() => { setCelebrantPhotoDataUrl(null); setSmoothFace(false); }} className="absolute top-2 right-2 bg-background/80 border border-border rounded-full px-2.5 py-0.5 text-xs font-medium text-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors">✕</button>
            </div>
            <button type="button" onClick={handleRemoveBg} disabled={removingBg} className="w-full py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5">
              {removingBg ? <><Loader2 className="h-3 w-3 animate-spin" />Removing background...</> : "✨ Remove background"}
            </button>
            <div className="flex items-center justify-between py-0.5">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Smooth skin</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Soften skin &amp; reduce blemishes</p>
              </div>
              <button type="button" onClick={() => setSmoothFace(v => !v)} className="relative rounded-full transition-colors shrink-0" style={{ width: "40px", height: "22px", background: smoothFace ? "var(--primary)" : "rgba(100,100,100,0.3)" }}>
                <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform" style={{ transform: smoothFace ? "translateX(20px)" : "translateX(2px)" }} />
              </button>
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
            <span className="text-2xl">📷</span>
            <span className="text-xs text-muted-foreground mt-1">Click to upload photo</span>
            <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
          </label>
        )}
      </div>

      {!celebrantPhotoDataUrl && <PhotoUploadPanel onPhotoChange={setCustomPhotoDataUrl} onSmoothChange={setSmoothFace} />}

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Logo position</label>
        <div className="grid grid-cols-5 gap-1.5">
          {[{ value: "top-left", label: "↖ Top L" }, { value: "top-right", label: "↗ Top R" }, { value: "bottom-left", label: "↙ Bot L" }, { value: "bottom-center", label: "↓ Center" }, { value: "bottom-right", label: "↘ Bot R" }].map(pos => (
            <button key={pos.value} type="button" onClick={() => setLogoPosition(pos.value)} className={cn("py-2 rounded-lg border text-xs font-medium transition-all", logoPosition === pos.value ? "border-primary bg-primary/8 text-primary" : "border-border text-muted-foreground hover:border-foreground/30")}>{pos.label}</button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact on post <span className="normal-case font-normal">(optional)</span></label>
        <div className="space-y-2">
          <input type="text" value={contactInfo.website} onChange={e => setContactInfo(ci => ({ ...ci, website: e.target.value }))} placeholder="🌐 Website (e.g. yoursite.com)" className="w-full px-3.5 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          <input type="text" value={contactInfo.instagram} onChange={e => setContactInfo(ci => ({ ...ci, instagram: e.target.value }))} placeholder="📷 Instagram (@yourbrand)" className="w-full px-3.5 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          <input type="text" value={contactInfo.phone} onChange={e => setContactInfo(ci => ({ ...ci, phone: e.target.value }))} placeholder="📞 Phone number" className="w-full px-3.5 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>

      <button onClick={generate} disabled={loading || !personName.trim() || !activeBrandId} className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Generating...</> : "Generate Birthday Post"}
      </button>
    </div>
  );

  const previewNode = (
    <div className="space-y-4 max-w-2xl mx-auto">
      {!html ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-3" style={{ aspectRatio: "1/1" }}>
          <div className="h-16 w-16 rounded-xl bg-muted opacity-30 flex items-center justify-center text-3xl text-muted-foreground">🎂</div>
          <p className="text-sm font-medium text-muted-foreground">Your birthday post will appear here</p>
          <p className="text-xs text-muted-foreground">Enter a name and click Generate</p>
        </div>
      ) : (
        <>
          <div ref={containerRef} className="bg-card border border-border rounded-2xl overflow-hidden relative w-full" style={{ aspectRatio: "1/1" }}>
            <div style={{ position: "absolute", top: 0, left: 0, width: 1080, height: 1080, transform: `scale(${previewScale})`, transformOrigin: "top left" }} dangerouslySetInnerHTML={{ __html: html }} />
          </div>
          {generatedMessage && (
            <div className="bg-muted/40 rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">AI message</p>
              <p className="text-sm text-foreground">{generatedMessage}</p>
            </div>
          )}
          <div className="flex gap-3 flex-wrap">
            <button onClick={downloadPng} disabled={downloading} className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60">
              {downloading ? <><Loader2 className="h-4 w-4 animate-spin" />Exporting...</> : <><Download className="h-4 w-4" />Download PNG</>}
            </button>
            <button onClick={handleScheduleClick} disabled={renderingSchedule} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
              {renderingSchedule ? <><Loader2 className="h-4 w-4 animate-spin" />Preparing...</> : <><Calendar className="h-4 w-4" />Schedule</>}
            </button>
          </div>
        </>
      )}
    </div>
  );

  const captionForSchedule = generatedMessage ?? "";

  return (
    <>
      <StudioPageShell title="Birthday Post" settings={settingsNode} preview={previewNode} />
      {showSchedule && activeBrandId && (
        <SchedulePostSheet
          brandId={activeBrandId}
          defaultCaption={captionForSchedule}
          previewHtml={html ?? undefined}
          previewDataUrl={previewDataUrl ?? undefined}
          canvasH={1080}
          onClose={() => setShowSchedule(false)}
          onSaved={() => setShowSchedule(false)}
        />
      )}
    </>
  );
}
