import { useParams, useLocation } from "wouter";
import { useGetBrand, useUpdateBrand, useDeleteBrand, getListBrandsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import { BrandSubNav } from "@/components/brand-sub-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, CheckCircle2, Settings, Upload, X, ImageIcon, Sparkles, Film, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE = "/api";

const INDUSTRIES = [
  "Fashion & Beauty", "Food & Beverage", "Technology", "Fintech",
  "Health & Wellness", "Education", "Real Estate", "Entertainment",
  "Media & Publishing", "E-commerce & Retail", "Agriculture", "Logistics",
  "Travel & Hospitality", "Professional Services", "Non-profit", "Other",
];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${props.className ?? ""}`}
    />
  );
}

export default function BrandSettings() {
  const { brandId } = useParams<{ brandId: string }>();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { data: brand, isLoading } = useGetBrand(brandId);
  const updateBrand = useUpdateBrand();
  const deleteBrand = useDeleteBrand();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mediaItems, setMediaItems] = useState<{ id: string; type: "image" | "video"; thumbnail: string; frames: string[]; name: string }[]>([]);
  const [extractingVideo, setExtractingVideo] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [analyseError, setAnalyseError] = useState("");
  const [analysed, setAnalysed] = useState(false);

  const [logoUrl, setLogoUrl] = useState<string>("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPasteMode, setLogoPasteMode] = useState(false);
  const [logoPasteUrl, setLogoPasteUrl] = useState("");

  const [form, setForm] = useState({
    name: "",
    websiteUrl: "",
    industry: "",
    brandBrief: "",
    instagramHandle: "",
    twitterHandle: "",
    tiktokHandle: "",
    linkedinUrl: "",
    facebookUrl: "",
  });

  useEffect(() => {
    if (brand) {
      setForm({
        name: brand.name ?? "",
        websiteUrl: brand.websiteUrl ?? "",
        industry: brand.industry ?? "",
        brandBrief: (brand as any).brandBrief ?? "",
        instagramHandle: (brand as any).instagramHandle ?? "",
        twitterHandle: (brand as any).twitterHandle ?? "",
        tiktokHandle: (brand as any).tiktokHandle ?? "",
        linkedinUrl: (brand as any).linkedinUrl ?? "",
        facebookUrl: (brand as any).facebookUrl ?? "",
      });
    }
  }, [brand]);

  useEffect(() => {
    if (!brandId) return;
    fetch(`${API_BASE}/brands/${brandId}/visual-prefs`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.logoUrl) setLogoUrl(d.logoUrl); })
      .catch(() => {});
  }, [brandId]);

  async function handleLogoUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please upload an image file (PNG, JPG, SVG)", variant: "destructive" });
      return;
    }
    setLogoUploading(true);
    try {
      const presignRes = await fetch(`${API_BASE}/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      const { uploadURL, objectPath } = await presignRes.json();
      await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      const serveUrl = `${API_BASE}/storage/objects/${objectPath.replace(/^\/objects\//, "")}`;
      await fetch(`${API_BASE}/brands/${brandId}/visual-prefs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: serveUrl }),
      });
      setLogoUrl(serveUrl);
      toast({ title: "Logo uploaded and saved!" });
    } catch {
      toast({ title: "Logo upload failed. Please try again.", variant: "destructive" });
    } finally {
      setLogoUploading(false);
    }
  }

  async function saveLogoUrl(url: string) {
    if (!url.trim()) return;
    setLogoUploading(true);
    try {
      await fetch(`${API_BASE}/brands/${brandId}/visual-prefs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: url.trim() }),
      });
      setLogoUrl(url.trim());
      setLogoPasteMode(false);
      setLogoPasteUrl("");
      toast({ title: "Logo URL saved!" });
    } catch {
      toast({ title: "Could not save logo URL.", variant: "destructive" });
    } finally {
      setLogoUploading(false);
    }
  }

  function set(key: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [key]: value }));
    setSaved(false);
  }

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const extractVideoFrames = (file: File, count = 4): Promise<string[]> =>
    new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      const url = URL.createObjectURL(file);
      video.src = url;
      video.onloadedmetadata = () => {
        const canvas = document.createElement("canvas");
        const maxW = 1024;
        canvas.width = Math.min(video.videoWidth, maxW);
        canvas.height = Math.round(canvas.width * (video.videoHeight / video.videoWidth));
        const ctx = canvas.getContext("2d")!;
        const duration = video.duration;
        const frames: string[] = [];
        let captured = 0;
        function captureNext() {
          if (captured >= count) {
            URL.revokeObjectURL(url);
            resolve(frames);
            return;
          }
          const t = duration * (0.1 + 0.8 * (captured / Math.max(count - 1, 1)));
          video.currentTime = t;
        }
        video.onseeked = () => {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          frames.push(canvas.toDataURL("image/jpeg", 0.75));
          captured++;
          captureNext();
        };
        video.onerror = reject;
        captureNext();
      };
      video.onerror = reject;
      video.load();
    });

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const allowed = Array.from(files)
      .filter(f => f.type.startsWith("image/") || f.type.startsWith("video/"))
      .slice(0, 5 - mediaItems.length);
    if (allowed.length === 0) return;
    setExtractingVideo(allowed.some(f => f.type.startsWith("video/")));
    setAnalysed(false);
    setAnalyseError("");
    const newItems = await Promise.all(allowed.map(async f => {
      const id = Math.random().toString(36).slice(2);
      if (f.type.startsWith("image/")) {
        const dataUrl = await readFileAsDataUrl(f);
        return { id, type: "image" as const, thumbnail: dataUrl, frames: [dataUrl], name: f.name };
      } else {
        const frames = await extractVideoFrames(f, 4);
        return { id, type: "video" as const, thumbnail: frames[0] ?? "", frames, name: f.name };
      }
    }));
    setMediaItems(prev => [...prev, ...newItems].slice(0, 5));
    setExtractingVideo(false);
  }, [mediaItems.length]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  async function handleAnalyse() {
    if (mediaItems.length === 0) return;
    setAnalysing(true);
    setAnalyseError("");
    try {
      const allFrames = mediaItems.flatMap(m => m.frames).slice(0, 15);
      const hasVideo = mediaItems.some(m => m.type === "video");
      const res = await fetch(`${API_BASE}/brands/${brandId}/analyze-screenshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: allFrames, hasVideo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      const existing = form.brandBrief.trim();
      set("brandBrief", existing ? `${existing}\n\n${data.brief}` : data.brief);
      setAnalysed(true);
    } catch (err: any) {
      setAnalyseError(err.message || "Something went wrong. Please try again.");
    } finally {
      setAnalysing(false);
    }
  }

  function handleDelete() {
    deleteBrand.mutate({ brandId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() });
        setLocation("/brands");
      },
    });
  }

  function handleSave() {
    updateBrand.mutate({
      brandId,
      data: {
        name: form.name || undefined,
        websiteUrl: form.websiteUrl || undefined,
        industry: form.industry || undefined,
        brandBrief: form.brandBrief || undefined,
        instagramHandle: form.instagramHandle || undefined,
        twitterHandle: form.twitterHandle || undefined,
        tiktokHandle: form.tiktokHandle || undefined,
        linkedinUrl: form.linkedinUrl || undefined,
        facebookUrl: form.facebookUrl || undefined,
      } as any,
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() });
        setSaved(true);
      },
    });
  }

  if (isLoading) return (
    <div>
      <div className="h-12 border-b border-border" />
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
      </div>
    </div>
  );

  if (!brand) return (
    <div className="p-6 text-center"><p className="text-muted-foreground">Brand not found.</p></div>
  );

  return (
    <div data-testid="brand-settings-page">
      <BrandSubNav brandId={brandId} />

      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Brand Settings</h1>
            <p className="text-sm text-muted-foreground">Update your brand details and social profiles</p>
          </div>
        </div>

        {/* Brand Brief - the most important field */}
        <div className="bg-primary/5 border-2 border-primary/20 rounded-2xl p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Brand Brief</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Zuri reads this to understand your brand voice, audience and personality. Use screenshots, type it yourself, or both - they combine together.
            </p>
          </div>

          {/* Media upload zone */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Upload screenshots or videos (optional)</p>
            <p className="text-xs text-muted-foreground">Screenshot your bio/profile, or upload a short video. Zuri reads the content and adds what it finds to the brief below.</p>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                isDragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={e => e.target.files && handleFiles(e.target.files)}
                data-testid="settings-input-screenshots"
              />
              <div className="flex items-center justify-center gap-2 mb-2">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Drop files here or tap to choose</p>
              <p className="text-xs text-muted-foreground mt-1">Images (PNG, JPG) or videos (MP4, MOV) - up to 5 files</p>
            </div>

            {/* Extracting frames indicator */}
            {extractingVideo && (
              <div className="flex items-center gap-2 text-xs text-primary font-medium">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Extracting frames from video...
              </div>
            )}

            {/* Thumbnails */}
            {mediaItems.length > 0 && !extractingVideo && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {mediaItems.map((item) => (
                    <div key={item.id} className="relative group">
                      <img
                        src={item.thumbnail}
                        alt={item.name}
                        className="h-20 w-20 object-cover rounded-lg border border-border"
                      />
                      {item.type === "video" && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30">
                          <Film className="h-6 w-6 text-white" />
                        </div>
                      )}
                      {item.type === "video" && (
                        <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded font-medium">
                          {item.frames.length}f
                        </span>
                      )}
                      <button
                        onClick={() => setMediaItems(prev => prev.filter(m => m.id !== item.id))}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {mediaItems.length < 5 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="h-20 w-20 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:border-primary/50 transition-colors"
                    >
                      <ImageIcon className="h-5 w-5 mb-1" />
                      <span className="text-[10px]">Add more</span>
                    </button>
                  )}
                </div>

                <button
                  onClick={handleAnalyse}
                  disabled={analysing}
                  data-testid="btn-analyse-screenshots"
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {analysing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {analysing
                    ? "Analysing..."
                    : `Analyse ${mediaItems.length} file${mediaItems.length > 1 ? "s" : ""} (${mediaItems.flatMap(m => m.frames).length} frames)`}
                </button>

                {analysed && !analysing && (
                  <p className="flex items-center gap-1.5 text-xs text-green-700 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Added to your brief below - edit it freely, then save
                  </p>
                )}
                {analyseError && (
                  <p className="text-xs text-destructive">{analyseError}</p>
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-medium">your brand brief</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Manual text input */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Screenshot analysis fills this in automatically. You can also type here directly, or add extra details on top of what was extracted.</p>
            <textarea
              value={form.brandBrief}
              onChange={e => set("brandBrief", e.target.value)}
              placeholder="e.g. We are a Nigerian fintech platform helping SMEs get paid faster. Our tone is confident and practical - we speak to hustling business owners aged 25-45 in Lagos and Abuja who are tired of chasing late payments."
              rows={5}
              data-testid="settings-input-brief"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {form.brandBrief.length} characters{" "}
              {form.brandBrief.length === 0 ? "" : form.brandBrief.length < 100 ? "- aim for at least 100" : form.brandBrief.length < 300 ? "- more detail = better DNA" : "- great, lots to work with"}
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Basic Details</h2>

          <Field label="Brand Name">
            <Input
              value={form.name}
              onChange={e => set("name", e.target.value)}
              placeholder="e.g. Storvo"
              data-testid="settings-input-name"
            />
          </Field>

          <Field label="Website URL" hint="Optional - use your main public marketing site, not an app login page">
            <Input
              value={form.websiteUrl}
              onChange={e => set("websiteUrl", e.target.value)}
              placeholder="https://yourbrand.com"
              data-testid="settings-input-website"
            />
            {form.websiteUrl && /^https?:\/\/app\./i.test(form.websiteUrl) && (
              <div className="mt-2 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <svg className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <p className="text-xs text-amber-800">
                  <strong>Heads up:</strong> App subdomains (app.*) are login pages - Zuri cannot read them.
                  Use your main marketing website instead, e.g. <strong>{form.websiteUrl.replace(/^https?:\/\/app\./, "https://")}</strong>
                </p>
              </div>
            )}
          </Field>

          <Field label="Industry">
            <select
              value={form.industry}
              onChange={e => set("industry", e.target.value)}
              data-testid="settings-select-industry"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            >
              <option value="">Select industry...</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </Field>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Brand Logo</h2>
            <p className="text-xs text-muted-foreground mt-1">Upload your logo and Zuri will use it on carousels, quote cards, and other creative assets.</p>
          </div>

          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ""; }}
          />

          {logoUrl ? (
            <div className="flex items-center gap-4 p-4 bg-muted/40 rounded-xl border border-border">
              <div className="h-16 w-16 rounded-lg border border-border bg-background flex items-center justify-center overflow-hidden shrink-0">
                <img src={logoUrl} alt="Brand logo" className="h-full w-full object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Logo saved</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{logoUrl.length > 60 ? logoUrl.slice(0, 57) + "..." : logoUrl}</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => logoInputRef.current?.click()} disabled={logoUploading} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
                    {logoUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    Replace
                  </button>
                  <button onClick={() => saveLogoUrl("")} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors">
                    <X className="h-3 w-3" />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div
                onClick={() => logoInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-muted/30 transition-all"
              >
                {logoUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-7 w-7 text-primary animate-spin" />
                    <p className="text-sm font-medium text-foreground">Uploading logo...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Image className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Click to upload your logo</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG or SVG recommended. Transparent background works best.</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground font-medium">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {logoPasteMode ? (
                <div className="flex gap-2">
                  <input
                    value={logoPasteUrl}
                    onChange={e => setLogoPasteUrl(e.target.value)}
                    placeholder="https://yourbrand.com/logo.png"
                    className="flex-1 px-3 py-2.5 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                    onKeyDown={e => e.key === "Enter" && saveLogoUrl(logoPasteUrl)}
                    autoFocus
                  />
                  <button onClick={() => saveLogoUrl(logoPasteUrl)} disabled={!logoPasteUrl.trim() || logoUploading} className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
                    Save
                  </button>
                  <button onClick={() => { setLogoPasteMode(false); setLogoPasteUrl(""); }} className="px-3 py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button onClick={() => setLogoPasteMode(true)} className="w-full py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  Paste logo URL instead
                </button>
              )}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Social Profiles</h2>
            <p className="text-xs text-muted-foreground mt-1">Adding social profiles gives Zuri more content to build a better Brand DNA</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Instagram">
              <div className="flex items-center border border-border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-colors">
                <span className="px-3 py-2.5 bg-muted text-muted-foreground text-sm border-r border-border shrink-0">@</span>
                <input
                  value={form.instagramHandle.replace("@", "")}
                  onChange={e => set("instagramHandle", e.target.value)}
                  placeholder="yourbrand"
                  className="flex-1 px-3 py-2.5 bg-background text-sm focus:outline-none"
                  data-testid="settings-input-instagram"
                />
              </div>
            </Field>

            <Field label="X / Twitter">
              <div className="flex items-center border border-border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-colors">
                <span className="px-3 py-2.5 bg-muted text-muted-foreground text-sm border-r border-border shrink-0">@</span>
                <input
                  value={form.twitterHandle.replace("@", "")}
                  onChange={e => set("twitterHandle", e.target.value)}
                  placeholder="yourbrand"
                  className="flex-1 px-3 py-2.5 bg-background text-sm focus:outline-none"
                  data-testid="settings-input-twitter"
                />
              </div>
            </Field>

            <Field label="TikTok">
              <div className="flex items-center border border-border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-colors">
                <span className="px-3 py-2.5 bg-muted text-muted-foreground text-sm border-r border-border shrink-0">@</span>
                <input
                  value={form.tiktokHandle.replace("@", "")}
                  onChange={e => set("tiktokHandle", e.target.value)}
                  placeholder="yourbrand"
                  className="flex-1 px-3 py-2.5 bg-background text-sm focus:outline-none"
                  data-testid="settings-input-tiktok"
                />
              </div>
            </Field>

            <Field label="LinkedIn URL">
              <Input
                value={form.linkedinUrl}
                onChange={e => set("linkedinUrl", e.target.value)}
                placeholder="https://linkedin.com/company/..."
                data-testid="settings-input-linkedin"
              />
            </Field>

            <Field label="Facebook URL">
              <Input
                value={form.facebookUrl}
                onChange={e => set("facebookUrl", e.target.value)}
                placeholder="https://facebook.com/..."
                data-testid="settings-input-facebook"
              />
            </Field>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={updateBrand.isPending}
            data-testid="btn-save-settings"
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {updateBrand.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {updateBrand.isPending ? "Saving..." : "Save changes"}
          </button>

          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-green-700 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Saved! Rebuild your DNA to apply the changes.
            </span>
          )}

          {updateBrand.isError && (
            <span className="text-sm text-destructive">Something went wrong. Please try again.</span>
          )}
        </div>

        {/* Danger Zone */}
        <div className="border border-red-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wider">Danger Zone</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Permanently delete this brand and all its data - DNA, content, voice examples, lessons and calendar events. This cannot be undone.
            </p>
          </div>

          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              data-testid="btn-delete-brand-init"
              className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
            >
              Delete this brand
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-red-800">
                Are you sure? This will permanently delete <strong>{brand?.name}</strong> and everything associated with it.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={deleteBrand.isPending}
                  data-testid="btn-delete-brand-confirm"
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deleteBrand.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {deleteBrand.isPending ? "Deleting..." : "Yes, delete permanently"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleteBrand.isPending}
                  className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
              {deleteBrand.isError && (
                <p className="text-xs text-red-600">Something went wrong. Please try again.</p>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
