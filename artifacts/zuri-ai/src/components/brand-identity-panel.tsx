import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Link } from "wouter";
import { Upload, Plus, X, Loader2, CheckCircle2, ExternalLink, Palette, Image } from "lucide-react";
import { useBrand } from "@/context/brand-context";
import { useToast } from "@/hooks/use-toast";

const API = (path: string) => `/api${path}`;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isValidHex(hex: string) {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex.trim());
}

function normalizeHex(raw: string): string {
  const s = raw.trim();
  if (!s.startsWith("#")) return `#${s}`;
  return s;
}

interface ColorRowProps {
  color: string;
  label: string;
  onChange: (val: string) => void;
  onRemove: () => void;
}

function ColorRow({ color, label, onChange, onRemove }: ColorRowProps) {
  const [hexInput, setHexInput] = useState(color);
  const nativeRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setHexInput(color); }, [color]);

  function commitHex(raw: string) {
    const normalized = normalizeHex(raw);
    if (isValidHex(normalized)) {
      onChange(normalized);
      setHexInput(normalized);
    } else {
      setHexInput(color);
    }
  }

  return (
    <div className="flex items-center gap-2 py-1">
      <label
        className="h-8 w-8 rounded-lg cursor-pointer border-2 border-border hover:border-primary/60 transition-colors shrink-0 overflow-hidden shadow-sm"
        style={{ backgroundColor: isValidHex(normalizeHex(hexInput)) ? normalizeHex(hexInput) : color }}
        title="Click to open color picker"
      >
        <input
          ref={nativeRef}
          type="color"
          value={color}
          onChange={e => { onChange(e.target.value); setHexInput(e.target.value); }}
          className="opacity-0 w-full h-full cursor-pointer"
        />
      </label>
      <div className="flex-1 flex items-center gap-1.5 min-w-0">
        <input
          type="text"
          value={hexInput}
          onChange={e => setHexInput(e.target.value)}
          onBlur={e => commitHex(e.target.value)}
          onKeyDown={e => e.key === "Enter" && commitHex((e.target as HTMLInputElement).value)}
          placeholder="#000000"
          maxLength={7}
          className="w-24 px-2 py-1 rounded-md border border-border bg-background text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary transition-colors"
        />
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <button
        onClick={onRemove}
        className="h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:bg-destructive hover:text-white transition-colors shrink-0"
        title="Remove color"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function BrandIdentityPanel() {
  const { activeBrandId } = useBrand();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [logoUploading, setLogoUploading] = useState(false);
  const [colorsSaving, setColorsSaving] = useState(false);
  const [brandColors, setBrandColors] = useState<string[]>([]);
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [expanded, setExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!activeBrandId) return;
    setLoading(true);
    fetch(API(`/brands/${activeBrandId}/visual-prefs`))
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setLogoUrl(d.logoUrl ?? "");
          setBrandColors(d.brandColors ?? []);
          if (!d.logoUrl && !(d.brandColors?.length)) setExpanded(true);
        } else {
          setExpanded(true);
        }
      })
      .catch(() => setExpanded(true))
      .finally(() => setLoading(false));
  }, [activeBrandId]);

  async function handleLogoFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please upload a PNG, JPG, or SVG file.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Logo too large", description: "Please use an image under 2 MB.", variant: "destructive" });
      return;
    }
    setLogoUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await fetch(API(`/brands/${activeBrandId}/visual-prefs`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: dataUrl }),
      });
      setLogoUrl(dataUrl);
      toast({ title: "Logo saved!", description: "Your logo will now appear on all posts." });
    } catch {
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setLogoUploading(false);
    }
  }

  async function saveColors(colors: string[]) {
    if (!activeBrandId) return;
    setColorsSaving(true);
    try {
      await fetch(API(`/brands/${activeBrandId}/visual-prefs`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandColors: colors }),
      });
      toast({ title: "Colors saved!", description: "All new posts will use these colors." });
    } catch {
      toast({ title: "Could not save colors.", variant: "destructive" });
    } finally {
      setColorsSaving(false);
    }
  }

  async function removeLogo() {
    await fetch(API(`/brands/${activeBrandId}/visual-prefs`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoUrl: "" }),
    });
    setLogoUrl("");
  }

  const hasLogo = !!logoUrl;
  const hasColors = brandColors.length > 0;
  const isComplete = hasLogo && hasColors;

  if (!activeBrandId || loading) return null;

  const COLOR_LABELS = ["Primary", "Secondary", "Accent", "4th", "5th"];

  return (
    <div className={`rounded-xl border ${isComplete ? "border-border bg-card" : "border-amber-200 bg-amber-50/60 dark:border-amber-800/50 dark:bg-amber-900/10"}`}>
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 gap-2"
      >
        <div className="flex items-center gap-2 min-w-0">
          {isComplete ? (
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          ) : (
            <span className="h-4 w-4 rounded-full bg-amber-400 shrink-0 flex items-center justify-center">
              <span className="text-[9px] text-white font-bold">!</span>
            </span>
          )}
          <span className="text-xs font-semibold text-foreground">
            {isComplete ? "Brand identity" : "Brand identity not set up"}
          </span>
          {isComplete && (
            <div className="flex items-center gap-1 ml-1">
              {logoUrl && (
                <div className="h-5 w-5 rounded border border-border bg-background overflow-hidden shrink-0">
                  <img src={logoUrl} alt="logo" className="h-full w-full object-contain" />
                </div>
              )}
              {brandColors.slice(0, 3).map((c, i) => (
                <div key={i} className="h-4 w-4 rounded-full border border-border/50 shadow-sm" style={{ backgroundColor: c }} />
              ))}
            </div>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-3.5 pb-3.5 space-y-4 border-t border-border/50 pt-3">
          {!isComplete && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Add your logo and brand colors so Zuri uses them on every post.
            </p>
          )}

          {/* ── Logo ── */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Image className="h-3 w-3" /> Logo
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/gif,image/webp"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); e.target.value = ""; }}
            />
            {logoUrl ? (
              <div className="flex items-center gap-3 p-2.5 bg-background rounded-lg border border-border">
                <div className="h-12 w-12 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                  <img src={logoUrl} alt="Brand logo" className="h-full w-full object-contain p-0.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">Logo set ✓</p>
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={logoUploading}
                      className="text-[11px] px-2 py-1 bg-primary text-primary-foreground rounded font-medium hover:bg-primary/90 disabled:opacity-50"
                    >
                      {logoUploading ? "Uploading…" : "Replace"}
                    </button>
                    <button onClick={removeLogo} className="text-[11px] px-2 py-1 border border-border rounded text-muted-foreground hover:bg-muted">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={logoUploading}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-lg text-xs text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-muted/30 transition-all disabled:opacity-60"
              >
                {logoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {logoUploading ? "Uploading…" : "Click to upload logo (PNG, JPG, SVG)"}
              </button>
            )}
          </div>

          {/* ── Colors ── */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Palette className="h-3 w-3" /> Brand colors
            </p>

            <div className="space-y-0.5">
              {brandColors.map((color, i) => (
                <ColorRow
                  key={i}
                  color={color}
                  label={COLOR_LABELS[i] ?? `Color ${i + 1}`}
                  onChange={val => { const next = [...brandColors]; next[i] = val; setBrandColors(next); }}
                  onRemove={() => setBrandColors(brandColors.filter((_, j) => j !== i))}
                />
              ))}
            </div>

            {brandColors.length < 5 && (
              <button
                onClick={() => setBrandColors([...brandColors, brandColors.length === 0 ? "#333333" : "#888888"])}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add color
              </button>
            )}

            {brandColors.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                Click <strong>Add color</strong> to add your first brand color. You can type the hex code (e.g. <code>#0097A7</code>) or use the color picker.
              </p>
            )}

            {brandColors.length > 0 && (
              <button
                onClick={() => saveColors(brandColors)}
                disabled={colorsSaving}
                className="mt-1 flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {colorsSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                {colorsSaving ? "Saving…" : "Save colors"}
              </button>
            )}
          </div>

          <div className="pt-1 border-t border-border/50 flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">Applies to all new posts</p>
            <Link href={`/brands/${activeBrandId}/settings`} className="flex items-center gap-1 text-[11px] text-primary hover:underline">
              Full settings <ExternalLink className="h-2.5 w-2.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
