import { useState, useCallback, useRef } from "react";
import { useListBrands } from "@workspace/api-client-react";
import { useBrand } from "@/context/brand-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Upload, Image as ImageIcon, Video, X, Plus, Copy, Check,
  ChevronRight, ChevronLeft, Sparkles, Loader2, Camera,
  Instagram, Youtube, Linkedin, Facebook, Ghost, PlaySquare,
  Twitter, MessageCircle, ChevronDown, ChevronUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UploadedFile {
  file: File;
  preview: string;
  objectPath: string | null;
  uploading: boolean;
  error: string | null;
}

interface PlatformCaption {
  platform: string;
  caption: string;
  hashtags: string[];
  keywords: string[];
  char_count: number;
  platform_tip: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS = [
  { id: "instagram", label: "Instagram", Icon: Instagram, color: "text-pink-600", bg: "bg-pink-50 border-pink-200" },
  { id: "tiktok", label: "TikTok", Icon: PlaySquare, color: "text-gray-900", bg: "bg-gray-100 border-gray-300" },
  { id: "facebook", label: "Facebook", Icon: Facebook, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  { id: "linkedin", label: "LinkedIn", Icon: Linkedin, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  { id: "youtube", label: "YouTube", Icon: Youtube, color: "text-red-600", bg: "bg-red-50 border-red-200" },
  { id: "twitter", label: "X (Twitter)", Icon: Twitter, color: "text-gray-900", bg: "bg-gray-100 border-gray-300" },
  { id: "whatsapp", label: "WhatsApp", Icon: MessageCircle, color: "text-green-600", bg: "bg-green-50 border-green-200" },
  { id: "threads", label: "Threads", Icon: Ghost, color: "text-gray-800", bg: "bg-gray-100 border-gray-300" },
];

const CATEGORIES = [
  "Product showcase", "Service highlight", "Event promo", "Behind the scenes",
  "Educational tip", "Sale / Promo", "Customer story", "Announcement", "Inspiration", "Other",
];

const STEPS = ["Upload", "Context", "Platforms", "Captions"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getApiBase(): string {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  return base;
}

async function requestUploadUrl(file: File): Promise<{ uploadURL: string; objectPath: string }> {
  const r = await fetch(`${getApiBase()}/api/storage/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" }),
  });
  if (!r.ok) throw new Error("Failed to get upload URL");
  return r.json();
}

async function uploadToPresigned(file: File, url: string): Promise<void> {
  const r = await fetch(url, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
  if (!r.ok) throw new Error("Upload failed");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all",
                i < current
                  ? "bg-primary border-primary text-primary-foreground"
                  : i === current
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-muted border-border text-muted-foreground"
              )}
            >
              {i < current ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={cn("text-xs font-medium hidden sm:block", i === current ? "text-primary" : "text-muted-foreground")}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn("h-0.5 flex-1 mx-2 mb-4", i < current ? "bg-primary" : "bg-border")} />
          )}
        </div>
      ))}
    </div>
  );
}

function CaptionCard({ data, initialOpen = false }: { data: PlatformCaption; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const plat = PLATFORMS.find((p) => p.id === data.platform);
  const fullText = [data.caption, "", ...data.hashtags].join("\n");

  const copy = () => {
    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true);
      toast({ description: "Caption copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/50 transition-colors"
      >
        {plat && (
          <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center border", plat.bg)}>
            <plat.Icon className={cn("h-4 w-4", plat.color)} />
          </span>
        )}
        <span className="flex-1 text-left font-medium text-sm">{plat?.label ?? data.platform}</span>
        <span className="text-xs text-muted-foreground mr-2">{data.char_count} chars</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 bg-card border-t border-border space-y-3">
          <div className="mt-3">
            <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">{data.caption}</p>
          </div>

          {data.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.hashtags.map((tag, i) => (
                <span key={i} className="text-xs bg-primary/8 text-primary px-2 py-0.5 rounded-full font-medium">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {data.keywords.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">Keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {data.keywords.map((kw, i) => (
                  <span key={i} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.platform_tip && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Tip: {data.platform_tip}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={copy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/8 text-primary text-xs font-medium hover:bg-primary/15 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy caption"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PostPage() {
  const { activeBrandId, setActiveBrandId } = useBrand();
  const { data: brandsData } = useListBrands();
  const brands = brandsData ?? [];
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [context, setContext] = useState("");
  const [category, setCategory] = useState("");
  const [existingCaption, setExistingCaption] = useState("");
  const [callToAction, setCallToAction] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["instagram", "facebook"]);
  const [generating, setGenerating] = useState(false);
  const [captions, setCaptions] = useState<Record<string, PlatformCaption>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const brandId = activeBrandId ?? brands[0]?.id ?? "";

  // ─── File Handling ──────────────────────────────────────────────────────────

  const processFiles = useCallback(async (incoming: File[]) => {
    const allowed = incoming.filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (allowed.length === 0) {
      toast({ description: "Only image and video files are supported", variant: "destructive" });
      return;
    }

    const newEntries: UploadedFile[] = allowed.slice(0, 10 - files.length).map((f) => ({
      file: f,
      preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : "",
      objectPath: null,
      uploading: true,
      error: null,
    }));

    setFiles((prev) => [...prev, ...newEntries]);

    for (let i = 0; i < newEntries.length; i++) {
      const entry = newEntries[i];
      try {
        const { uploadURL, objectPath } = await requestUploadUrl(entry.file);
        await uploadToPresigned(entry.file, uploadURL);
        setFiles((prev) =>
          prev.map((f) => (f.file === entry.file ? { ...f, objectPath, uploading: false } : f))
        );
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.file === entry.file ? { ...f, uploading: false, error: "Upload failed" } : f
          )
        );
      }
    }
  }, [files.length, toast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  }, [processFiles]);

  const removeFile = (idx: number) => {
    setFiles((prev) => {
      const f = prev[idx];
      if (f.preview) URL.revokeObjectURL(f.preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  // ─── Generate ──────────────────────────────────────────────────────────────

  const generate = async () => {
    if (!brandId) {
      toast({ description: "Please select a brand first", variant: "destructive" });
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast({ description: "Select at least one platform", variant: "destructive" });
      return;
    }
    if (!context.trim() && !existingCaption.trim() && files.length === 0) {
      toast({ description: "Add some context about this post", variant: "destructive" });
      return;
    }

    setGenerating(true);
    const mediaUrls = files.map((f) => f.objectPath ?? "").filter(Boolean);
    const mediaLabels = files.map((f) => f.file.name);
    const mediaType = files.some((f) => f.file.type.startsWith("video/"))
      ? files.length > 1 ? "mixed" : "video"
      : files.length > 1 ? "carousel" : "image";

    try {
      const r = await fetch(`${getApiBase()}/api/generate/media-post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          mediaUrls,
          mediaLabels,
          mediaType,
          context,
          existingCaption,
          category,
          callToAction,
          platforms: selectedPlatforms,
        }),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Generation failed");
      }

      const data = await r.json();
      setCaptions(data.captions ?? {});
      setStep(3);
    } catch (err: any) {
      toast({ description: err.message ?? "Something went wrong", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  // ─── Step canProceed ───────────────────────────────────────────────────────

  const canProceed = () => {
    if (step === 0) return true;
    if (step === 1) return context.trim().length >= 5 || existingCaption.trim().length >= 5 || files.length > 0;
    if (step === 2) return selectedPlatforms.length > 0;
    return false;
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Camera className="h-6 w-6 text-primary" />
            Caption Studio
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Upload your photo or video and get platform-ready captions written in your brand voice
          </p>
        </div>

        {/* Brand selector */}
        {brands.length > 1 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-1.5">Brand</label>
            <select
              value={brandId}
              onChange={(e) => setActiveBrandId(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {brands.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Stepper */}
        <StepIndicator current={step} />

        {/* ── STEP 0: Upload ─────────────────────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Upload your media</h2>
            <p className="text-sm text-muted-foreground">
              Add the images or video you want to post. Up to 10 files.
            </p>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/40"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => processFiles(Array.from(e.target.files ?? []))}
              />
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">Drag files here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">Images (JPEG, PNG, GIF, WebP) or Video (MP4, MOV)</p>
            </div>

            {/* Thumbnails */}
            {files.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {files.map((f, i) => (
                  <div key={i} className="relative rounded-xl overflow-hidden border border-border aspect-square bg-muted">
                    {f.file.type.startsWith("image/") ? (
                      <img src={f.preview} alt={f.file.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground">
                        <Video className="h-6 w-6" />
                        <span className="text-xs text-center px-1 leading-tight">{f.file.name.slice(0, 16)}</span>
                      </div>
                    )}

                    {f.uploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="h-5 w-5 text-white animate-spin" />
                      </div>
                    )}
                    {f.error && (
                      <div className="absolute inset-0 bg-red-900/50 flex items-center justify-center">
                        <span className="text-white text-xs font-medium">Failed</span>
                      </div>
                    )}
                    {!f.uploading && !f.error && f.objectPath && (
                      <div className="absolute top-1 left-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                {files.length < 10 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 1: Context ────────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-foreground">Tell us about this post</h2>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                What does this media show? <span className="text-red-500">*</span>
              </label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g. New Ankara print collection - bold patterns, vibrant colours. Photoshoot at the workshop with our latest pieces..."
                rows={4}
                className="w-full text-sm border border-border rounded-xl px-4 py-3 bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">Be specific - the more detail you give, the better the captions</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Select category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Call to action</label>
                <input
                  type="text"
                  value={callToAction}
                  onChange={(e) => setCallToAction(e.target.value)}
                  placeholder="e.g. Shop the collection via link in bio"
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Existing caption to improve <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                value={existingCaption}
                onChange={(e) => setExistingCaption(e.target.value)}
                placeholder="Paste your existing caption here if you want us to improve it..."
                rows={3}
                className="w-full text-sm border border-border rounded-xl px-4 py-3 bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
          </div>
        )}

        {/* ── STEP 2: Platforms ──────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-foreground">Where will you post this?</h2>
            <p className="text-sm text-muted-foreground">Select all platforms you want captions for. Each gets its own optimized version.</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {PLATFORMS.map(({ id, label, Icon, color, bg }) => {
                const selected = selectedPlatforms.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => togglePlatform(id)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      selected
                        ? "border-primary bg-primary/8"
                        : "border-border hover:border-primary/30 bg-card hover:bg-muted/40"
                    )}
                  >
                    <span className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", bg)}>
                      <Icon className={cn("h-5 w-5", color)} />
                    </span>
                    <span className={cn("text-xs font-medium", selected ? "text-primary" : "text-foreground")}>
                      {label}
                    </span>
                    {selected && (
                      <span className="w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground">
              {selectedPlatforms.length === 0
                ? "Select at least one platform to continue"
                : `Generating captions for ${selectedPlatforms.length} platform${selectedPlatforms.length > 1 ? "s" : ""}`}
            </p>
          </div>
        )}

        {/* ── STEP 3: Captions ──────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Your captions are ready</h2>
              <button
                onClick={() => setStep(0)}
                className="text-xs text-primary font-medium hover:underline"
              >
                Start over
              </button>
            </div>

            {Object.values(captions).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No captions generated yet.
              </div>
            ) : (
              <div className="space-y-3">
                {Object.values(captions).map((cap, i) => (
                  <CaptionCard key={cap.platform} data={cap} initialOpen={i === 0} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Navigation ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
              step === 0
                ? "text-muted-foreground opacity-40 cursor-not-allowed"
                : "text-foreground border border-border hover:bg-muted"
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          {step < 2 && (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className={cn(
                "flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors",
                canProceed()
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          )}

          {step === 2 && (
            <button
              onClick={generate}
              disabled={generating || !canProceed()}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors",
                canProceed() && !generating
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Generate Captions</>
              )}
            </button>
          )}

          {step === 3 && (
            <button
              onClick={generate}
              disabled={generating}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Regenerating...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Regenerate</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
