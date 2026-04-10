import { useState } from "react";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const API = (path: string) => `/api${path}`;

const DESIGN_STYLES = [
  { value: "minimal", label: "Clean & Minimal" },
  { value: "bold", label: "Bold & Vibrant" },
  { value: "professional", label: "Professional & Corporate" },
  { value: "warm", label: "Warm & Friendly" },
  { value: "dark", label: "Dark & Premium" },
];

interface VisualPrefsSheetProps {
  brandId: string;
  existingPrefs?: { designStyle?: string; includeLogo?: string; brandColors?: string[] } | null;
  onClose: () => void;
  onSaved: () => void;
}

export function VisualPrefsSheet({ brandId, existingPrefs, onClose, onSaved }: VisualPrefsSheetProps) {
  const { toast } = useToast();
  const [includeLogo, setIncludeLogo] = useState<string>(existingPrefs?.includeLogo ?? "ask");
  const [designStyle, setDesignStyle] = useState<string>(existingPrefs?.designStyle ?? "professional");
  const [colors, setColors] = useState<string[]>(existingPrefs?.brandColors?.length ? existingPrefs.brandColors : ["#D97706", "#1C1917"]);
  const [saving, setSaving] = useState(false);

  function updateColor(index: number, value: string) {
    const next = [...colors];
    next[index] = value;
    setColors(next);
  }

  function addColor() {
    if (colors.length < 3) setColors([...colors, "#FFFFFF"]);
  }

  async function save() {
    setSaving(true);
    try {
      const r = await fetch(API(`/brands/${brandId}/visual-prefs`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeLogo, brandColors: colors, designStyle }),
      });
      if (!r.ok) throw new Error("Failed to save");
      toast({ title: "Preferences saved" });
      onSaved();
    } catch {
      toast({ title: "Failed to save preferences", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full max-w-md bg-background border-l border-border flex flex-col shadow-xl z-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Visual Preferences</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <div>
            <label className="text-sm font-semibold text-foreground block mb-1">Include your logo in designs?</label>
            <p className="text-xs text-muted-foreground mb-3">Zuri will apply this to every design created for your brand.</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "always", label: "Always include" },
                { value: "ask", label: "Ask me each time" },
                { value: "never", label: "No - colours only" },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setIncludeLogo(opt.value)}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 rounded-xl border-2 text-center text-xs font-medium transition-all gap-2",
                    includeLogo === opt.value
                      ? "border-primary bg-primary/8 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/30"
                  )}
                >
                  {includeLogo === opt.value && <Check className="h-4 w-4" />}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground block mb-1">Brand colours</label>
            <p className="text-xs text-muted-foreground mb-3">Up to 3 hex colours. These are applied to every design.</p>
            <div className="flex items-center gap-3 flex-wrap">
              {colors.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg border border-border overflow-hidden">
                    <input
                      type="color"
                      value={c}
                      onChange={e => updateColor(i, e.target.value)}
                      className="h-full w-full cursor-pointer border-0 p-0"
                    />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{c}</span>
                  {colors.length > 1 && (
                    <button onClick={() => setColors(colors.filter((_, j) => j !== i))} className="text-xs text-muted-foreground hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {colors.length < 3 && (
                <button onClick={addColor} className="h-9 w-9 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center text-lg">
                  +
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground block mb-1">Design style</label>
            <p className="text-xs text-muted-foreground mb-3">Sets the overall look and feel for all designs.</p>
            <div className="grid grid-cols-1 gap-2">
              {DESIGN_STYLES.map(s => (
                <button
                  key={s.value}
                  onClick={() => setDesignStyle(s.value)}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all",
                    designStyle === s.value
                      ? "border-primary bg-primary/8 text-primary"
                      : "border-border text-foreground hover:border-foreground/30"
                  )}
                >
                  {s.label}
                  {designStyle === s.value && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border">
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}
