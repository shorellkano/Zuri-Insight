import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Upload, Plus, X, Loader2, CheckCircle2, Sparkles, ExternalLink, Palette, Image } from "lucide-react";
import { useBrand } from "@/context/brand-context";
import { useToast } from "@/hooks/use-toast";

const API = (path: string) => `/api${path}`;

interface VisualPrefs {
  logoUrl?: string | null;
  brandColors?: string[];
}

export function BrandIdentityPanel() {
  const { activeBrandId } = useBrand();
  const { toast } = useToast();

  const [prefs, setPrefs] = useState<VisualPrefs | null>(null);
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
          setPrefs(d);
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

  async function handleLogoUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please upload an image file (PNG, JPG, SVG)", variant: "destructive" });
      return;
    }
    setLogoUploading(true);
    try {
      const presignRes = await fetch(API("/storage/uploads/request-url"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      const { uploadURL, objectPath } = await presignRes.json();
      await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      const serveUrl = API(`/storage/objects/${objectPath.replace(/^\/objects\//, "")}`);
      await fetch(API(`/brands/${activeBrandId}/visual-prefs`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: serveUrl }),
      });
      setLogoUrl(serveUrl);
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

  async function removeLogoUrl() {
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
                <div className="h-5 w-5 rounded border border-border bg-background overflow-hidden">
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
              Add your logo and brand colors so Zuri can use them on every post.
            </p>
          )}

          {/* Logo section */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Image className="h-3 w-3" />
              Logo
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ""; }}
            />
            {logoUrl ? (
              <div className="flex items-center gap-3 p-2.5 bg-background rounded-lg border border-border">
                <div className="h-12 w-12 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                  <img src={logoUrl} alt="Brand logo" className="h-full w-full object-contain p-0.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">Logo set</p>
                  <div className="flex gap-1.5 mt-1">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={logoUploading}
                      className="text-[11px] text-primary hover:underline disabled:opacity-50"
                    >
                      {logoUploading ? "Uploading…" : "Replace"}
                    </button>
                    <span className="text-[11px] text-border">·</span>
                    <button onClick={removeLogoUrl} className="text-[11px] text-muted-foreground hover:text-destructive">
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
                {logoUploading ? "Uploading logo…" : "Click to upload logo (PNG, JPG, SVG)"}
              </button>
            )}
          </div>

          {/* Colors section */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Palette className="h-3 w-3" />
              Brand colors
            </p>

            <div className="flex flex-wrap gap-2 items-center">
              {brandColors.map((color, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5 group relative">
                  <label
                    className="block h-9 w-9 rounded-lg cursor-pointer shadow-sm border-2 border-border hover:border-primary/60 transition-colors overflow-hidden"
                    style={{ backgroundColor: color }}
                    title={i === 0 ? "Primary" : i === 1 ? "Secondary" : i === 2 ? "Accent" : `Color ${i + 1}`}
                  >
                    <input
                      type="color"
                      value={color}
                      onChange={e => {
                        const next = [...brandColors];
                        next[i] = e.target.value;
                        setBrandColors(next);
                      }}
                      className="opacity-0 w-full h-full cursor-pointer"
                    />
                  </label>
                  <button
                    onClick={() => setBrandColors(brandColors.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-2 w-2" />
                  </button>
                  <span className="text-[9px] text-muted-foreground">
                    {i === 0 ? "Main" : i === 1 ? "2nd" : i === 2 ? "3rd" : `${i + 1}`}
                  </span>
                </div>
              ))}
              {brandColors.length < 5 && (
                <button
                  onClick={() => setBrandColors([...brandColors, "#0D6B8C"])}
                  className="h-9 w-9 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                  title="Add color"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>

            {brandColors.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                Click <strong>+</strong> to add your brand colors, then click each swatch to adjust the exact shade.
              </p>
            )}

            {brandColors.length > 0 && (
              <button
                onClick={() => saveColors(brandColors)}
                disabled={colorsSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {colorsSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                {colorsSaving ? "Saving…" : "Save colors"}
              </button>
            )}
          </div>

          <div className="pt-1 border-t border-border/50 flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">Changes apply to all new posts</p>
            <Link href={`/brands/${activeBrandId}/settings`} className="flex items-center gap-1 text-[11px] text-primary hover:underline">
              Full settings <ExternalLink className="h-2.5 w-2.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
