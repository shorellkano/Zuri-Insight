import { useParams } from "wouter";
import { useGetBrand, useUpdateBrand, getListBrandsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import { BrandSubNav } from "@/components/brand-sub-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, CheckCircle2, Settings, Upload, X, ImageIcon, Sparkles } from "lucide-react";

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
  const { data: brand, isLoading } = useGetBrand(brandId);
  const updateBrand = useUpdateBrand();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saved, setSaved] = useState(false);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [analyseError, setAnalyseError] = useState("");
  const [analysed, setAnalysed] = useState(false);

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

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith("image/")).slice(0, 5 - screenshots.length);
    if (imageFiles.length === 0) return;
    const dataUrls = await Promise.all(imageFiles.map(readFileAsDataUrl));
    setScreenshots(prev => [...prev, ...dataUrls].slice(0, 5));
    setAnalysed(false);
    setAnalyseError("");
  }, [screenshots.length]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  async function handleAnalyse() {
    if (screenshots.length === 0) return;
    setAnalysing(true);
    setAnalyseError("");
    try {
      const res = await fetch(`${API_BASE}/brands/${brandId}/analyze-screenshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: screenshots }),
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

          {/* Screenshot upload zone */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Upload screenshots (optional)</p>
            <p className="text-xs text-muted-foreground">Screenshot your Instagram/TikTok/Twitter bio and first page of posts. Zuri reads the images and adds what it finds to the brief below.</p>

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
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => e.target.files && handleFiles(e.target.files)}
                data-testid="settings-input-screenshots"
              />
              <Upload className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">Drop screenshots here or tap to choose</p>
              <p className="text-xs text-muted-foreground mt-1">Up to 5 images - PNG, JPG, WEBP</p>
            </div>

            {/* Thumbnails */}
            {screenshots.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {screenshots.map((src, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={src}
                        alt={`Screenshot ${i + 1}`}
                        className="h-20 w-20 object-cover rounded-lg border border-border"
                      />
                      <button
                        onClick={() => setScreenshots(prev => prev.filter((_, j) => j !== i))}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {screenshots.length < 5 && (
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
                  {analysing ? "Reading screenshots..." : `Analyse ${screenshots.length} screenshot${screenshots.length > 1 ? "s" : ""}`}
                </button>

                {analysed && !analysing && (
                  <p className="flex items-center gap-1.5 text-xs text-green-700 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Added to your brief below - you can edit it, then add more screenshots or type additional details
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

      </div>
    </div>
  );
}
