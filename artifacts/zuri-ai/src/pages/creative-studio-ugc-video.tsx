import { useState, useRef, useCallback, useEffect } from "react";
import { useBrand } from "@/context/brand-context";
import { useListBrands } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Video, Clapperboard, Star, Package, User, Instagram, Youtube,
  PlaySquare, Upload, X, Download, Loader2, Sparkles, RefreshCw,
  Zap, CheckCircle, AlertCircle,
} from "lucide-react";
import { Link } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

type VideoStyle = "ugc" | "cinematic" | "product_demo" | "testimonial";
type VideoPlatform = "instagram" | "tiktok" | "youtube";

// ─── Constants ────────────────────────────────────────────────────────────────

const STYLES: Array<{ id: VideoStyle; label: string; desc: string; Icon: any }> = [
  { id: "ugc", label: "UGC", desc: "Authentic, hand-held feel — creator-style content", Icon: User },
  { id: "cinematic", label: "Cinematic", desc: "Premium, polished — high-production look", Icon: Clapperboard },
  { id: "product_demo", label: "Product Demo", desc: "Clear, informative — shows product in action", Icon: Package },
  { id: "testimonial", label: "Testimonial", desc: "Person facing camera — trust-building and real", Icon: Star },
];

const PLATFORMS: Array<{ id: VideoPlatform; label: string; Icon: any; aspectRatio: "9:16" | "1:1" | "16:9" }> = [
  { id: "instagram", label: "Instagram Reel", Icon: Instagram, aspectRatio: "9:16" },
  { id: "tiktok", label: "TikTok", Icon: PlaySquare, aspectRatio: "9:16" },
  { id: "youtube", label: "YouTube Short", Icon: Youtube, aspectRatio: "9:16" },
];

const PROGRESS_STAGES = [
  { label: "Writing your video concept...", durationMs: 5000 },
  { label: "Generating video with Higgsfield AI...", durationMs: 80000 },
  { label: "Finalising your video...", durationMs: 5000 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getApiBase() {
  return import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
}

async function requestUploadUrl(file: File) {
  const r = await fetch(`${getApiBase()}/api/storage/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  if (!r.ok) throw new Error("Upload URL failed");
  return r.json() as Promise<{ uploadURL: string; objectPath: string }>;
}

async function uploadToPresigned(file: File, url: string) {
  const r = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  if (!r.ok) throw new Error("Upload failed");
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreativeStudioUgcVideo() {
  const { activeBrandId } = useBrand();
  const { data: brands } = useListBrands();
  const { toast } = useToast();

  const [description, setDescription] = useState("");
  const [style, setStyle] = useState<VideoStyle>("ugc");
  const [platform, setPlatform] = useState<VideoPlatform>("instagram");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [promptUsed, setPromptUsed] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeBrand = brands?.find((b) => b.id === activeBrandId);
  const selectedPlatform = PLATFORMS.find((p) => p.id === platform)!;

  // ─── Image Upload ──────────────────────────────────────────────────────────

  const handleImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setUploadingImage(true);
    try {
      const { uploadURL, objectPath } = await requestUploadUrl(file);
      await uploadToPresigned(file, uploadURL);
      setUploadedImageUrl(`${getApiBase()}/api/storage/objects${objectPath.replace("/objects", "")}`);
    } catch {
      toast({ description: "Image upload failed", variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  }, [toast]);

  // ─── Stage Progress ────────────────────────────────────────────────────────

  const advanceStage = useCallback(() => {
    setStageIndex((i) => {
      const next = i + 1;
      if (next < PROGRESS_STAGES.length) {
        stageTimerRef.current = setTimeout(advanceStage, PROGRESS_STAGES[next].durationMs);
      }
      return next;
    });
  }, []);

  // ─── Poll for Video ────────────────────────────────────────────────────────

  const startPolling = useCallback((id: string) => {
    pollIntervalRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${getApiBase()}/api/generate/ugc-video/status/${id}`);
        if (!r.ok) return;
        const data = await r.json();
        if (data.status === "complete" && data.videoUrl) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          if (stageTimerRef.current) clearTimeout(stageTimerRef.current);
          setVideoUrl(data.videoUrl);
          setGenerating(false);
        } else if (data.status === "failed") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          if (stageTimerRef.current) clearTimeout(stageTimerRef.current);
          setGenerationError(data.error ?? "Video generation failed");
          setGenerating(false);
        }
      } catch {
        // silent retry
      }
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (stageTimerRef.current) clearTimeout(stageTimerRef.current);
    };
  }, []);

  // ─── Generate ─────────────────────────────────────────────────────────────

  const generate = async () => {
    if (!activeBrandId) { toast({ description: "Select a brand first", variant: "destructive" }); return; }
    if (!description.trim()) { toast({ description: "Describe your product or service", variant: "destructive" }); return; }

    setGenerating(true);
    setVideoUrl(null);
    setGenerationError(null);
    setStageIndex(0);
    setJobId(null);

    stageTimerRef.current = setTimeout(advanceStage, PROGRESS_STAGES[0].durationMs);

    try {
      const r = await fetch(`${getApiBase()}/api/generate/ugc-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: activeBrandId,
          productDescription: description,
          style,
          platform,
          aspectRatio: selectedPlatform.aspectRatio,
          ...(uploadedImageUrl && { imageUrl: uploadedImageUrl }),
        }),
      });

      const data = await r.json();

      if (!r.ok) {
        if (data.code === "missing_key") {
          throw new Error("HIGGSFIELD_API_KEY is not configured in Secrets. Add it via Replit Tools > Secrets.");
        }
        throw new Error(data.error ?? "Generation failed");
      }

      setJobId(data.jobId);
      setPromptUsed(data.promptUsed ?? null);
      startPolling(data.jobId);
    } catch (err: any) {
      if (stageTimerRef.current) clearTimeout(stageTimerRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      setGenerationError(err.message ?? "Something went wrong");
      setGenerating(false);
    }
  };

  const reset = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (stageTimerRef.current) clearTimeout(stageTimerRef.current);
    setVideoUrl(null);
    setGenerationError(null);
    setJobId(null);
    setStageIndex(0);
    setGenerating(false);
    setPromptUsed(null);
  };

  const currentStage = PROGRESS_STAGES[Math.min(stageIndex, PROGRESS_STAGES.length - 1)];

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">

        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link href="/generate/creative-studio" className="hover:text-foreground transition-colors">
              Creative Studio
            </Link>
            <span>/</span>
            <span className="text-foreground">UGC Video</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Video className="h-6 w-6 text-primary" />
            UGC Video
          </h1>
          <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Powered by Higgsfield AI
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">

          {/* ── Left Panel: Form ─────────────────────────────────────────── */}
          <div className="space-y-6">

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Describe your product or service <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={generating}
                placeholder="e.g. Handmade leather bags from Lagos — vibrant colours, durable quality. Targeting young professionals who love African craftsmanship..."
                rows={4}
                className="w-full text-sm border border-border rounded-xl px-4 py-3 bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none disabled:opacity-60"
              />
            </div>

            {/* Optional Image Upload */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Product image <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              {imagePreview ? (
                <div className="relative w-full h-32 rounded-xl overflow-hidden border border-border bg-muted">
                  <img src={imagePreview} alt="Product" className="w-full h-full object-cover" />
                  {uploadingImage && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 text-white animate-spin" />
                    </div>
                  )}
                  <button
                    onClick={() => { setImageFile(null); setImagePreview(null); setUploadedImageUrl(null); }}
                    className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-24 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-muted/40 transition-all text-muted-foreground"
                >
                  <Upload className="h-5 w-5" />
                  <span className="text-xs">Click to upload a product image</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }}
              />
            </div>

            {/* Style */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Video style</label>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map(({ id, label, desc, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setStyle(id)}
                    disabled={generating}
                    className={cn(
                      "flex flex-col items-start gap-1.5 p-3 rounded-xl border-2 text-left transition-all",
                      style === id
                        ? "border-primary bg-primary/8"
                        : "border-border hover:border-primary/30 bg-card"
                    )}
                  >
                    <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center", style === id ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className={cn("text-xs font-semibold", style === id ? "text-primary" : "text-foreground")}>{label}</span>
                    <span className="text-xs text-muted-foreground leading-tight">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Platform */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Platform</label>
              <div className="flex gap-2">
                {PLATFORMS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setPlatform(id)}
                    disabled={generating}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border-2 transition-all text-xs font-medium",
                      platform === id
                        ? "border-primary bg-primary/8 text-primary"
                        : "border-border hover:border-primary/30 text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Aspect ratio: <span className="font-medium">{selectedPlatform.aspectRatio}</span> (auto-selected for short-form)
              </p>
            </div>

            {/* Generate button */}
            <button
              onClick={generate}
              disabled={generating || !description.trim() || !activeBrandId}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors",
                generating || !description.trim() || !activeBrandId
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-amber-500 hover:bg-amber-600 text-white"
              )}
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
              ) : (
                <><Zap className="h-4 w-4" /> Generate UGC video</>
              )}
            </button>
          </div>

          {/* ── Right Panel: Output ──────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Empty state */}
            {!generating && !videoUrl && !generationError && (
              <div className="bg-card border border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-center gap-3 py-16 px-6">
                <div className="w-16 h-16 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                  <Video className="h-7 w-7 text-amber-500" />
                </div>
                <p className="text-sm font-medium text-foreground">Your UGC video will appear here</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Describe your product, choose a style, and click Generate. Videos take 1-2 minutes.
                </p>
              </div>
            )}

            {/* Generating state */}
            {generating && (
              <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">Zuri AI is creating your video...</p>
                    <p className="text-xs text-muted-foreground">UGC videos take 1-2 minutes to generate</p>
                  </div>
                </div>

                {/* Progress stages */}
                <div className="space-y-2">
                  {PROGRESS_STAGES.map((stage, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex items-center gap-2.5 py-2 px-3 rounded-lg text-xs transition-all",
                        i < stageIndex
                          ? "text-green-700 bg-green-50"
                          : i === stageIndex
                          ? "text-foreground bg-primary/8 font-medium"
                          : "text-muted-foreground"
                      )}
                    >
                      {i < stageIndex ? (
                        <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-500" />
                      ) : i === stageIndex ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                      ) : (
                        <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-border" />
                      )}
                      {stage.label}
                    </div>
                  ))}
                </div>

                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  Note: UGC videos take 1-2 minutes to generate. Your browser tab will update when ready.
                </p>
              </div>
            )}

            {/* Error state */}
            {generationError && (
              <div className="bg-card border border-destructive/20 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-3 text-destructive">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p className="text-sm font-medium">Video generation failed</p>
                </div>
                <p className="text-xs text-muted-foreground">{generationError}</p>
                <button
                  onClick={reset}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Try again
                </button>
              </div>
            )}

            {/* Video output */}
            {videoUrl && (
              <div className="space-y-4">
                <div className="bg-black rounded-2xl overflow-hidden" style={{ aspectRatio: "9/16", maxHeight: 480 }}>
                  <video
                    src={videoUrl}
                    autoPlay
                    muted
                    loop
                    controls
                    className="w-full h-full object-cover"
                  />
                </div>

                {promptUsed && (
                  <div className="bg-muted/50 border border-border rounded-xl p-3">
                    <p className="text-xs text-muted-foreground font-medium mb-1">Prompt used</p>
                    <p className="text-xs text-foreground leading-relaxed">{promptUsed}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <a
                    href={videoUrl}
                    download="ugc-video.mp4"
                    className="flex items-center justify-center gap-2 py-2.5 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Download MP4
                  </a>
                  <Link href={`/quick-create?context=${encodeURIComponent("UGC video: " + description)}`} className="flex-1">
                    <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary/10 text-primary border border-primary/20 rounded-xl text-sm font-medium hover:bg-primary/20 transition-colors">
                      <Sparkles className="h-4 w-4" />
                      Generate caption
                    </button>
                  </Link>
                </div>
                <button
                  onClick={reset}
                  disabled={generating}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <RefreshCw className="h-4 w-4" /> Regenerate
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
