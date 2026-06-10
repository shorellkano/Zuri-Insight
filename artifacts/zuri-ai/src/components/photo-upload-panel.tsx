import { useState } from "react";
import { Loader2 } from "lucide-react";
import { removeBackground } from "@imgly/background-removal";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface PhotoUploadPanelProps {
  onPhotoChange: (dataUrl: string | null) => void;
  onSmoothChange: (smooth: boolean) => void;
}

export function PhotoUploadPanel({ onPhotoChange, onSmoothChange }: PhotoUploadPanelProps) {
  const { toast } = useToast();
  const [useCustom, setUseCustom] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [removingBg, setRemovingBg] = useState(false);
  const [smoothFace, setSmoothFace] = useState(false);

  function setPhoto(url: string | null) {
    setPhotoDataUrl(url);
    onPhotoChange(url);
  }

  function handleToggle(custom: boolean) {
    setUseCustom(custom);
    if (!custom) {
      setPhoto(null);
      setSmoothFace(false);
      onSmoothChange(false);
    }
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPhoto(ev.target?.result as string ?? null);
    reader.readAsDataURL(file);
  }

  async function handleRemoveBg() {
    if (!photoDataUrl) return;
    setRemovingBg(true);
    try {
      const res = await fetch(photoDataUrl);
      const blob = await res.blob();
      const resultBlob = await removeBackground(blob);
      const reader = new FileReader();
      reader.onload = ev => setPhoto(ev.target?.result as string ?? null);
      reader.readAsDataURL(resultBlob);
    } catch {
      toast({ title: "Background removal failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setRemovingBg(false);
    }
  }

  function handleSmooth(val: boolean) {
    setSmoothFace(val);
    onSmoothChange(val);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Background photo</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {useCustom ? "Using your uploaded photo" : "Zuri picks a matching photo"}
          </p>
        </div>
        <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
          <button type="button" onClick={() => handleToggle(false)}
            className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-all",
              !useCustom ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
            Auto
          </button>
          <button type="button" onClick={() => handleToggle(true)}
            className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-all",
              useCustom ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
            My photo
          </button>
        </div>
      </div>

      {useCustom && (
        <div className="space-y-2">
          {photoDataUrl ? (
            <>
              <div className="relative rounded-lg overflow-hidden"
                style={{ background: "repeating-conic-gradient(#80808020 0% 25%, transparent 0% 50%) 0 0 / 12px 12px" }}>
                <img src={photoDataUrl} alt="Upload preview" className="w-full h-28 object-contain" />
                <button type="button" onClick={() => { setPhoto(null); handleSmooth(false); }}
                  className="absolute top-2 right-2 bg-background/80 border border-border rounded-full px-2.5 py-0.5 text-xs font-medium hover:bg-destructive hover:text-destructive-foreground transition-colors">
                  ✕
                </button>
              </div>
              <button type="button" onClick={handleRemoveBg} disabled={removingBg}
                className="w-full py-1.5 rounded-lg border border-border text-xs font-medium hover:border-primary hover:text-primary transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5">
                {removingBg
                  ? <><Loader2 className="h-3 w-3 animate-spin" />Removing background...</>
                  : "✨ Remove background"}
              </button>
              <div className="flex items-center justify-between py-0.5">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Smooth skin</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Soften skin tones &amp; reduce blemishes</p>
                </div>
                <button type="button" onClick={() => handleSmooth(!smoothFace)}
                  className="relative rounded-full transition-colors shrink-0"
                  style={{ width: "40px", height: "22px", background: smoothFace ? "var(--primary)" : "rgba(100,100,100,0.3)" }}>
                  <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
                    style={{ transform: smoothFace ? "translateX(20px)" : "translateX(2px)" }} />
                </button>
              </div>
            </>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
              <span className="text-2xl">🖼️</span>
              <span className="text-xs text-muted-foreground mt-1">Click to upload your photo</span>
              <span className="text-[11px] text-muted-foreground opacity-60">PNG, JPG, WebP</span>
              <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
