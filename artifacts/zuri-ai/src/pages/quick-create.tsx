import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { useListBrands, useGetBrand } from "@workspace/api-client-react";
import { useBrand } from "@/context/brand-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Instagram, Youtube, Linkedin, Facebook, Ghost, PlaySquare,
  ChevronDown, ChevronUp, Copy, Check, X, Plus, Calendar,
  Info, Download, RefreshCw, Zap, Edit2, Loader2, Sparkles, Video, Type, Settings2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Variation {
  v: number;
  hook: string;
  caption: string;
  hashtags: string[];
  keywords: string[];
  hook_char_count: number;
  caption_char_count: number;
  platform_note: string;
}

interface GenerateResult {
  id: string;
  platform: string;
  format: string;
  contentType?: "post" | "video";
  variations: Array<{ id: string; content: string; platform: string; tone: string }>;
}

interface VideoScript {
  hook: string;
  script: string;
  cta: string;
  caption: string;
  hashtags: string[];
  duration: string;
  tips: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS = [
  { id: "instagram", label: "Instagram", Icon: Instagram, color: "text-pink-600", bg: "bg-pink-50" },
  { id: "tiktok", label: "TikTok", Icon: PlaySquare, color: "text-gray-900", bg: "bg-gray-100" },
  { id: "facebook", label: "Facebook", Icon: Facebook, color: "text-blue-600", bg: "bg-blue-50" },
  { id: "linkedin", label: "LinkedIn", Icon: Linkedin, color: "text-blue-700", bg: "bg-blue-50" },
  { id: "youtube", label: "YouTube", Icon: Youtube, color: "text-red-600", bg: "bg-red-50" },
  { id: "snapchat", label: "Snapchat", Icon: Ghost, color: "text-yellow-500", bg: "bg-yellow-50" },
];

const FORMATS: Record<string, string[]> = {
  instagram: ["Reel", "Story", "Feed Post", "Carousel"],
  tiktok: ["Video", "Story"],
  facebook: ["Post", "Reel", "Story"],
  linkedin: ["Post", "Article intro"],
  youtube: ["Short", "Video description"],
  snapchat: ["Snap", "Story"],
};

const PLACEHOLDERS = [
  "New collection dropping this Friday - bold colours, African print...",
  "Behind the scenes of how I make my products...",
  "Customer shoutout - they loved their order...",
  "Flash sale this weekend only - 30% off everything...",
  "Tips for my audience - 3 things to know about natural hair care...",
];

const TOPIC_CHIPS = [
  { label: "New product", text: "Introducing our new [product] - " },
  { label: "Sale / Promo", text: "Limited time offer - " },
  { label: "Customer story", text: "A customer shared how [product] changed their " },
  { label: "Behind scenes", text: "Ever wondered how we make our [product]? Here is a behind-the-scenes look at " },
  { label: "Quick Tip", text: "Quick tip for [your audience]: " },
  { label: "Educational", text: "3 things you should know about " },
  { label: "Quote / Inspire", text: "This is what drives us every day: " },
  { label: "Trending topic", text: "Everyone is talking about [topic]. Here is our take: " },
  { label: "Announcement", text: "Big news - we are excited to announce " },
  { label: "Product feature", text: "Have you tried [feature] yet? Here is what makes it different: " },
  { label: "Poll / Question", text: "We want to hear from you! Which do you prefer: " },
  { label: "Celebration", text: "We are celebrating " },
  { label: "Testimonial", text: "[Customer name] said: [quote]. This is why we do what we do." },
  { label: "How it works", text: "How [product/service] works in 3 simple steps: " },
];

const TONES = [
  { id: "professional", label: "Professional" },
  { id: "friendly", label: "Friendly" },
  { id: "bold", label: "Bold & Direct" },
  { id: "inspirational", label: "Inspirational" },
  { id: "playful", label: "Playful" },
];

const PLATFORM_LIMITS: Record<string, string> = {
  instagram: "Instagram max: 2,200 chars",
  tiktok: "TikTok max: 150 chars",
  facebook: "Facebook: no limit",
  linkedin: "LinkedIn max: 3,000 chars",
  youtube: "YouTube description max: 5,000 chars",
  snapchat: "Snapchat: short and punchy",
};

const PLATFORM_RULES_NOTICE: Record<string, Record<string, string>> = {
  instagram: {
    Reel: "Hook must land in first 3 seconds. Caption can be long but the hook does the work.",
    Story: "Text overlay should be readable in 3 seconds. Use a poll or question sticker to drive engagement.",
    "Feed Post": "First 125 characters show before 'more' - make them count.",
    Carousel: "Slide 1 does the selling. Make them swipe with a strong hook.",
  },
  tiktok: {
    Video: "First 2-3 words are critical. Post between 6pm-10pm WAT for Nigerian audiences.",
    Story: "Keep it under 15 seconds. Text should be bold and readable.",
  },
  facebook: {
    Post: "Facebook rewards longer posts with stories. Add your location tag for local discovery.",
    Reel: "First 3 seconds decide everything. Hook before the scroll.",
    Story: "Tap-friendly content works best. Keep text minimal.",
  },
  linkedin: {
    Post: "First 2 lines show before 'see more'. Make them count. No more than 5 hashtags.",
    "Article intro": "Write like you're opening a conversation. Professional but human.",
  },
  youtube: {
    Short: "First frame must be compelling. Speak the keyword in the first 10 seconds.",
    "Video description": "Put keywords in the first 2 sentences. Include timestamps if long.",
  },
  snapchat: {
    Snap: "You have 1-10 seconds. One idea, one action.",
    Story: "Tell a story across slides. Each snap should make them tap for more.",
  },
};

const LOADING_MESSAGES = [
  "Reading your brand voice...",
  "Crafting your hook...",
  "Writing your caption...",
  "Selecting hashtags...",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}

function SectionLabel({ children, badge }: { children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{children}</span>
      {badge}
    </div>
  );
}

function AmberTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
      {children}
    </span>
  );
}

function VariationCard({
  variation,
  platform,
  format,
  index,
  brandId,
}: {
  variation: Variation;
  platform: string;
  format: string;
  index: number;
  brandId?: string;
}) {
  const [hashtags, setHashtags] = useState<string[]>(variation.hashtags ?? []);
  const [newTag, setNewTag] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduling, setScheduling] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const { toast } = useToast();

  const platformLimit = PLATFORM_LIMITS[platform.toLowerCase()] ?? "";
  const platformNote =
    PLATFORM_RULES_NOTICE[platform.toLowerCase()]?.[format] ?? variation.platform_note;
  const showKeywords = ["youtube", "linkedin"].includes(platform.toLowerCase()) && variation.keywords?.length > 0;

  const allText = [
    variation.hook,
    "",
    variation.caption,
    "",
    hashtags.join(" "),
    ...(showKeywords && variation.keywords?.length ? ["", variation.keywords.join(", ")] : []),
  ].join("\n").trim();

  async function handleSchedule() {
    if (!scheduleDate) { toast({ title: "Pick a date first", variant: "destructive" }); return; }
    if (!brandId) { toast({ title: "No brand selected", variant: "destructive" }); return; }
    setScheduling(true);
    try {
      const scheduledFor = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
      const res = await fetch("/api/schedule/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          platform,
          postType: format,
          caption: `${variation.hook}\n\n${variation.caption}`,
          hashtags,
          scheduledFor,
          timezone: "Africa/Lagos",
        }),
      });
      if (!res.ok) throw new Error("Failed to schedule");
      setScheduled(true);
      setScheduleOpen(false);
      toast({ title: "Post scheduled!", description: `Saved to your content calendar for ${scheduleDate} at ${scheduleTime}.` });
    } catch {
      toast({ title: "Could not schedule", description: "Please try again.", variant: "destructive" });
    } finally {
      setScheduling(false);
    }
  }

  function addTag() {
    const tag = newTag.trim().replace(/^#*/, "#");
    if (tag && tag !== "#") {
      setHashtags((h) => [...h, tag]);
      setNewTag("");
      setAddingTag(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Hook */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel badge={<AmberTag>Hook</AmberTag>}>
            <span className="sr-only">Hook</span>
          </SectionLabel>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">{variation.hook_char_count ?? variation.hook?.length ?? 0} chars</span>
            <CopyButton text={variation.hook} />
          </div>
        </div>
        <div className="relative group">
          <p className="text-lg font-bold text-foreground leading-snug">{variation.hook}</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Info className="h-3 w-3 text-muted-foreground/60 shrink-0" />
            <span className="text-[11px] text-muted-foreground/60">The first line - it is what stops someone from scrolling.</span>
          </div>
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Caption */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>Caption</SectionLabel>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {variation.caption_char_count ?? variation.caption?.length ?? 0} chars
              {platformLimit ? ` · ${platformLimit}` : ""}
            </span>
            <CopyButton text={variation.caption} />
          </div>
        </div>
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{variation.caption}</p>
      </div>

      <div className="border-t border-border" />

      {/* Hashtags */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>Hashtags</SectionLabel>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {hashtags.length} hashtags
              {platform.toLowerCase() === "instagram" ? " · Instagram allows up to 30" : ""}
              {platform.toLowerCase() === "tiktok" ? " · 3-5 hashtags perform best" : ""}
              {platform.toLowerCase() === "linkedin" ? " · Keep to 3-5 max" : ""}
            </span>
            <CopyButton text={hashtags.join(" ")} label="Copy all" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {hashtags.map((tag, i) => (
            <button
              key={i}
              onClick={() => setHashtags((h) => h.filter((_, j) => j !== i))}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-sm text-foreground hover:bg-destructive/10 hover:text-destructive transition-colors group"
            >
              {tag}
              <X className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
          {addingTag ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addTag(); if (e.key === "Escape") setAddingTag(false); }}
                placeholder="#newtag"
                className="px-2 py-1 rounded-full border border-primary bg-background text-sm w-28 focus:outline-none"
              />
              <button onClick={addTag} className="p-1 rounded-full bg-primary text-primary-foreground">
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingTag(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          )}
        </div>
        {platform.toLowerCase() === "tiktok" && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">3-5 hashtags perform best on TikTok. Keep them broad.</p>
        )}
      </div>

      {/* Keywords (YouTube + LinkedIn only) */}
      {showKeywords && (
        <>
          <div className="border-t border-border" />
          <div>
            <div className="flex items-center justify-between mb-2">
              <SectionLabel>Keywords / SEO terms</SectionLabel>
              <CopyButton text={variation.keywords.join(", ")} />
            </div>
            <div className="flex flex-wrap gap-2">
              {variation.keywords.map((kw, i) => (
                <span key={i} className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">{kw}</span>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Use these in your {platform.toLowerCase() === "youtube" ? "video description, alt text, and spoken in the first 30 seconds" : "post body and comments"}.
            </p>
          </div>
        </>
      )}

      {/* Platform rules notice */}
      {platformNote && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
          <p className="text-xs text-amber-800">
            <span className="font-semibold">{platform} {format}:</span> {platformNote}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={() => navigator.clipboard.writeText(allText)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
        >
          <Copy className="h-3.5 w-3.5" /> Copy all
        </button>
        <button
          onClick={() => {
            const blob = new Blob([allText], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `zuri-content-v${index + 1}.txt`;
            a.click();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          <Download className="h-3.5 w-3.5" /> Download
        </button>
        <button
          onClick={() => setScheduleOpen((o) => !o)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
            scheduled
              ? "border-green-500 text-green-700 bg-green-50"
              : scheduleOpen
              ? "border-primary text-primary bg-primary/5"
              : "border-border text-foreground hover:bg-muted"
          )}
        >
          <Calendar className="h-3.5 w-3.5" />
          {scheduled ? "Scheduled" : "Schedule"}
        </button>
      </div>

      {/* Schedule panel */}
      {scheduleOpen && (
        <div className="mt-3 p-4 rounded-xl border border-border bg-muted/30 space-y-3">
          <p className="text-xs font-semibold text-foreground">Schedule this post</p>
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-muted-foreground mb-1">Date</label>
              <input
                type="date"
                value={scheduleDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs text-muted-foreground mb-1">Time (Lagos)</label>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSchedule}
              disabled={scheduling || !scheduleDate}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {scheduling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calendar className="h-3.5 w-3.5" />}
              {scheduling ? "Scheduling..." : "Confirm schedule"}
            </button>
            <button
              onClick={() => setScheduleOpen(false)}
              className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Video Script Card ────────────────────────────────────────────────────────

function VideoScriptCard({
  script,
  platform,
  brandId,
}: {
  script: VideoScript;
  platform: string;
  brandId?: string;
}) {
  const { toast } = useToast();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduling, setScheduling] = useState(false);
  const [scheduled, setScheduled] = useState(false);

  const fullScript = [
    `HOOK (say this first):\n${script.hook}`,
    `\nSCRIPT:\n${script.script}`,
    `\nCALL TO ACTION:\n${script.cta}`,
    `\nCAPTION (for post):\n${script.caption}`,
    `\nHASHTAGS:\n${script.hashtags.join(" ")}`,
  ].join("\n").trim();

  async function handleSchedule() {
    if (!scheduleDate) { toast({ title: "Pick a date first", variant: "destructive" }); return; }
    if (!brandId) { toast({ title: "No brand selected", variant: "destructive" }); return; }
    setScheduling(true);
    try {
      const scheduledFor = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
      const res = await fetch("/api/schedule/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, platform, postType: "Video Script", caption: script.caption, hashtags: script.hashtags, scheduledFor, timezone: "Africa/Lagos" }),
      });
      if (!res.ok) throw new Error("Failed");
      setScheduled(true);
      setScheduleOpen(false);
      toast({ title: "Video scheduled!", description: `Saved to your content calendar for ${scheduleDate}.` });
    } catch {
      toast({ title: "Could not schedule", variant: "destructive" });
    } finally {
      setScheduling(false);
    }
  }

  return (
    <div className="space-y-5">
      {script.duration && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-100 text-xs font-medium text-purple-700">
          <Video className="h-3.5 w-3.5" /> Estimated duration: {script.duration}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-semibold uppercase tracking-wide">Hook</span>
          <CopyButton text={script.hook} />
        </div>
        <p className="text-lg font-bold text-foreground leading-snug">{script.hook}</p>
        <p className="text-[11px] text-muted-foreground/60 mt-1">Say this in the first 3 seconds before anything else.</p>
      </div>

      <div className="border-t border-border" />

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-foreground">Script</span>
          <CopyButton text={script.script} />
        </div>
        <div className="bg-muted/40 rounded-xl p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap font-mono">{script.script}</div>
      </div>

      <div className="border-t border-border" />

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-foreground">Call to Action</span>
          <CopyButton text={script.cta} />
        </div>
        <p className="text-sm text-foreground leading-relaxed">{script.cta}</p>
      </div>

      <div className="border-t border-border" />

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-foreground">Caption for post</span>
          <CopyButton text={script.caption} />
        </div>
        <p className="text-sm text-foreground leading-relaxed">{script.caption}</p>
      </div>

      <div className="border-t border-border" />

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-foreground">Hashtags</span>
          <CopyButton text={script.hashtags.join(" ")} label="Copy all" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {script.hashtags.map((tag) => (
            <span key={tag} className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary/8 text-primary text-xs font-medium">{tag}</span>
          ))}
        </div>
      </div>

      {script.tips && (
        <>
          <div className="border-t border-border" />
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
            <p className="text-xs text-amber-800"><span className="font-semibold">Filming tips:</span> {script.tips}</p>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button onClick={() => navigator.clipboard.writeText(fullScript)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
          <Copy className="h-3.5 w-3.5" /> Copy full script
        </button>
        <button
          onClick={() => {
            const blob = new Blob([fullScript], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "zuri-video-script.txt";
            a.click();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          <Download className="h-3.5 w-3.5" /> Download
        </button>
        <button
          onClick={() => setScheduleOpen((o) => !o)}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors", scheduled ? "border-green-500 text-green-700 bg-green-50" : scheduleOpen ? "border-primary text-primary bg-primary/5" : "border-border text-foreground hover:bg-muted")}
        >
          <Calendar className="h-3.5 w-3.5" /> {scheduled ? "Scheduled" : "Schedule"}
        </button>
      </div>

      {scheduleOpen && (
        <div className="mt-3 p-4 rounded-xl border border-border bg-muted/30 space-y-3">
          <p className="text-xs font-semibold text-foreground">Schedule this video</p>
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-muted-foreground mb-1">Date</label>
              <input type="date" value={scheduleDate} min={new Date().toISOString().split("T")[0]} onChange={(e) => setScheduleDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs text-muted-foreground mb-1">Time (Lagos)</label>
              <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSchedule} disabled={scheduling || !scheduleDate} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
              {scheduling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calendar className="h-3.5 w-3.5" />}
              {scheduling ? "Scheduling..." : "Confirm"}
            </button>
            <button onClick={() => setScheduleOpen(false)} className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function QuickCreate() {
  const { activeBrandId } = useBrand();
  const { data: brands } = useListBrands();
  const { data: brand } = useGetBrand(activeBrandId ?? "", { query: { enabled: !!activeBrandId } as any });
  const { toast } = useToast();

  const [simpleMode, setSimpleMode] = useState(true);
  const [contentType, setContentType] = useState<"post" | "video">("post");
  const [platform, setPlatform] = useState("instagram");
  const [format, setFormat] = useState("Reel");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("professional");
  const [toneOpen, setToneOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [extraProduct, setExtraProduct] = useState("");
  const [extraTag, setExtraTag] = useState("");
  const [extraDate, setExtraDate] = useState("");
  const [generating, setGenerating] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const loadingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // Rotate placeholder
  useEffect(() => {
    const t = setInterval(() => setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length), 4000);
    return () => clearInterval(t);
  }, []);

  // Reset format when platform changes
  useEffect(() => {
    const formats = FORMATS[platform] ?? [];
    if (!formats.includes(format)) setFormat(formats[0] ?? "");
  }, [platform]);

  // Animate loading messages
  useEffect(() => {
    if (generating) {
      setLoadingMsg(0);
      loadingRef.current = setInterval(() => {
        setLoadingMsg((m) => (m + 1) % LOADING_MESSAGES.length);
      }, 1500);
    } else {
      if (loadingRef.current) clearInterval(loadingRef.current);
    }
    return () => { if (loadingRef.current) clearInterval(loadingRef.current); };
  }, [generating]);

  const generate = useCallback(async () => {
    if (!activeBrandId) {
      toast({ title: "No brand selected", description: "Please select or create a brand first.", variant: "destructive" });
      return;
    }
    if (!topic.trim()) {
      toast({ title: "Tell Zuri what to post about", description: "Add a topic to get started.", variant: "destructive" });
      return;
    }

    setGenerating(true);
    setResult(null);

    const context = [
      extraProduct && `Product/offer: ${extraProduct}`,
      extraTag && `Tag: ${extraTag}`,
      extraDate && `Date/event: ${extraDate}`,
    ].filter(Boolean).join(". ") || undefined;

    try {
      const res = await fetch("/api/generate/quick-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: activeBrandId, platform, format, topic: topic.trim(), tone, additionalContext: context, contentType }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `Server error ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
      setActiveTab(0);
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err: any) {
      toast({ title: "Generation failed", description: err?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }, [activeBrandId, platform, format, topic, tone, extraProduct, extraTag, extraDate]);

  function parseVariation(raw: string): Variation | null {
    try {
      const parsed = JSON.parse(raw);
      return {
        v: parsed.v ?? 1,
        hook: parsed.hook ?? "",
        caption: parsed.caption ?? "",
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        hook_char_count: parsed.hook_char_count ?? (parsed.hook?.length ?? 0),
        caption_char_count: parsed.caption_char_count ?? (parsed.caption?.length ?? 0),
        platform_note: parsed.platform_note ?? "",
      };
    } catch {
      return null;
    }
  }

  const variations = result?.variations?.map((v) => parseVariation(v.content)).filter(Boolean) as Variation[] ?? [];

  function parseVideoScript(raw: string): VideoScript | null {
    try {
      const parsed = JSON.parse(raw);
      return {
        hook: parsed.hook ?? "",
        script: parsed.script ?? "",
        cta: parsed.cta ?? parsed.call_to_action ?? "",
        caption: parsed.caption ?? "",
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
        duration: parsed.duration ?? parsed.duration_estimate ?? "",
        tips: parsed.tips ?? parsed.filming_tips ?? "",
      };
    } catch {
      return null;
    }
  }

  const videoScript = (result?.contentType === "video" && result.variations?.[0])
    ? parseVideoScript(result.variations[0].content)
    : null;

  const countryFlag: Record<string, string> = {
    Nigeria: "🇳🇬", Kenya: "🇰🇪", Ghana: "🇬🇭", "South Africa": "🇿🇦",
    Egypt: "🇪🇬", Senegal: "🇸🇳", Ethiopia: "🇪🇹", Tanzania: "🇹🇿",
  };

  return (
    <div className="min-h-full py-8 bg-[#FAFAF9]">
      <div className="max-w-[680px] mx-auto px-4 space-y-6">

        {/* Brand context bar */}
        {brand && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-sm font-medium text-foreground">
                {countryFlag[brand.country ?? ""] && <span>{countryFlag[brand.country!]}</span>}
                <span>{brand.name}</span>
                {brand.industry && <span className="text-muted-foreground">· {brand.industry}</span>}
              </span>
            </div>
            <Link href={`/brands/${activeBrandId}/settings`}>
              <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Edit2 className="h-3.5 w-3.5" /> Edit brand
              </button>
            </Link>
          </div>
        )}

        {/* Page heading */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Solo Founder</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              {simpleMode ? "Pick your platform, type your idea, hit Create. Done." : "Full control over format, tone, and context."}
            </p>
          </div>
          <button
            onClick={() => setSimpleMode(v => !v)}
            className={cn(
              "flex items-center gap-1.5 shrink-0 mt-1 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors",
              simpleMode ? "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30" : "border-primary text-primary bg-primary/5"
            )}
          >
            <Settings2 className="h-3.5 w-3.5" />
            {simpleMode ? "Advanced" : "Simple"}
          </button>
        </div>

        {/* DNA nudge - soft, non-blocking, shown when brand exists but DNA not built */}
        {brand && !brand.dnaBuilt && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
            <Sparkles className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-amber-800">
                <span className="font-semibold">Generating from your business description.</span>{" "}
                Add a website or social handle to let Zuri learn your full brand voice and improve results.
              </p>
            </div>
            <Link href={`/brands/${activeBrandId}/settings`}>
              <button className="text-xs font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap shrink-0">
                Add handles
              </button>
            </Link>
          </div>
        )}

        {/* ── SIMPLE MODE FORM ── */}
        {simpleMode && (
          <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-3">Where is this post going?</label>
              <div className="grid grid-cols-3 gap-2.5">
                {PLATFORMS.map(({ id, label, Icon, bg, color }) => (
                  <button
                    key={id}
                    onClick={() => { setPlatform(id); const fmts = FORMATS[id] ?? []; setFormat(fmts[0] ?? ""); }}
                    className={cn(
                      "flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all",
                      platform === id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30 hover:bg-muted/30"
                    )}
                  >
                    <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", platform === id ? "bg-primary/10" : bg)}>
                      <Icon className={cn("h-5 w-5", platform === id ? "text-primary" : color)} />
                    </div>
                    <span className={cn("text-xs font-semibold", platform === id ? "text-primary" : "text-muted-foreground")}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">What do you want to say?</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={PLACEHOLDERS[placeholderIdx]}
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {TOPIC_CHIPS.slice(0, 6).map(({ label, text }) => (
                  <button
                    key={label}
                    onClick={() => setTopic(text)}
                    className="px-2.5 py-1 rounded-full bg-muted text-xs text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors border border-border"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={generate}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:bg-primary/90 transition-colors disabled:opacity-70"
            >
              {generating ? (
                <><Loader2 className="h-5 w-5 animate-spin" />{LOADING_MESSAGES[loadingMsg]}</>
              ) : (
                <><Sparkles className="h-5 w-5" />Create My Post</>
              )}
            </button>
          </div>
        )}

        {/* ── MAIN FORM (Advanced Mode) ── */}
        {!simpleMode && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-7">

          {/* Content type toggle */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-3">What are you creating?</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setContentType("post"); setResult(null); }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all text-left",
                  contentType === "post"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                )}
              >
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", contentType === "post" ? "bg-primary/10" : "bg-muted")}>
                  <Type className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight">Caption / Post</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Hook, caption and hashtags</p>
                </div>
              </button>
              <button
                onClick={() => { setContentType("video"); setResult(null); }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all text-left",
                  contentType === "video"
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : "border-border text-muted-foreground hover:border-purple-300 hover:text-foreground"
                )}
              >
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", contentType === "video" ? "bg-purple-100" : "bg-muted")}>
                  <Video className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight">Video Script</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">CEO or staff talking to camera</p>
                </div>
              </button>
            </div>
            <a
              href="/generate/creative-studio/ugc-video"
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors text-left mt-1"
            >
              <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <span className="text-base">🎥</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800 leading-tight">CEO / Staff Video</p>
                <p className="text-[11px] text-amber-700 mt-0.5">Generate an AI talking head video - no camera needed</p>
              </div>
              <svg className="h-4 w-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </a>
          </div>

          {/* SECTION 1: Platform */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-3">Where is this going?</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {PLATFORMS.map(({ id, label, Icon, bg }) => (
                <button
                  key={id}
                  onClick={() => setPlatform(id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border transition-all text-xs font-medium",
                    platform === id
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/30 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center", platform === id ? "bg-primary/10" : bg)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {label}
                </button>
              ))}
            </div>

            {/* Format pills */}
            {platform && (
              <div className="flex flex-wrap gap-2 mt-3">
                {(FORMATS[platform] ?? []).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                      format === f
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 2: Topic */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">What do you want to post about?</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={PLACEHOLDERS[placeholderIdx]}
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring resize-none transition-all"
            />
            {/* Quick topic chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {TOPIC_CHIPS.map(({ label, text }) => (
                <button
                  key={label}
                  onClick={() => setTopic(text)}
                  className="px-2.5 py-1 rounded-full bg-muted text-xs text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors border border-border"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* SECTION 3: Tone (collapsed) */}
          <div>
            <button
              onClick={() => setToneOpen((o) => !o)}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {toneOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Adjust tone
            </button>
            {toneOpen && (
              <div className="flex flex-wrap gap-2 mt-3">
                {TONES.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setTone(id)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                      tone === id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 4: Additional context (collapsed) */}
          <div>
            <button
              onClick={() => setContextOpen((o) => !o)}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {contextOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Add more context
            </button>
            {contextOpen && (
              <div className="space-y-3 mt-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Mention a specific product, price, or offer?</label>
                  <input
                    value={extraProduct}
                    onChange={(e) => setExtraProduct(e.target.value)}
                    placeholder="e.g. Glow serum - ₦12,500"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Tag anyone or any account?</label>
                  <input
                    value={extraTag}
                    onChange={(e) => setExtraTag(e.target.value)}
                    placeholder="e.g. @zuriofficial"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Is this for a specific date or event?</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="date"
                      value={extraDate}
                      onChange={(e) => setExtraDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Generate button */}
          <button
            onClick={generate}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-70"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {LOADING_MESSAGES[loadingMsg]}
              </>
            ) : (
              <>
                Generate content <span className="ml-1">→</span>
              </>
            )}
          </button>
        </div>
        )}

        {/* ── OUTPUT ── */}
        {result && (variations.length > 0 || videoScript) && (
          <div ref={outputRef} className="bg-card border border-border rounded-2xl overflow-hidden" data-testid="quick-create-output">
            {/* Output header */}
            <div className="px-6 pt-6 pb-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    {contentType === "video" ? "Your video script" : "Here is your content"}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium", contentType === "video" ? "bg-purple-50 text-purple-700" : "bg-primary/8 text-primary")}>
                      {contentType === "video" ? <><Video className="h-3 w-3" /> Video Script</> : <>{PLATFORMS.find((p) => p.id === platform)?.label} {format}</>}
                    </span>
                  </div>
                </div>
                <button
                  onClick={generate}
                  disabled={generating}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", generating && "animate-spin")} />
                  Regenerate
                </button>
              </div>

              {/* Variation tabs - only for text posts */}
              {contentType === "post" && variations.length > 1 && (
                <div className="flex gap-1 mt-4">
                  {variations.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveTab(i)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                        activeTab === i
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      Variation {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6">
              {contentType === "video" && videoScript ? (
                <VideoScriptCard
                  script={videoScript}
                  platform={platform}
                  brandId={activeBrandId ?? undefined}
                />
              ) : variations[activeTab] ? (
                <VariationCard
                  variation={variations[activeTab]}
                  platform={platform}
                  format={format}
                  index={activeTab}
                  brandId={activeBrandId ?? undefined}
                />
              ) : null}

              <div className="mt-4 pt-4 border-t border-border flex items-center gap-3 text-xs text-muted-foreground">
                <button
                  onClick={generate}
                  disabled={generating}
                  className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                </button>
                <span>·</span>
                <span>Give Zuri feedback</span>
              </div>
            </div>
          </div>
        )}

        {/* Empty state when no brand */}
        {!activeBrandId && (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Set up your brand first</h3>
            <p className="text-sm text-muted-foreground mb-4">Solo Founder uses your brand voice and DNA to generate content that sounds like you.</p>
            <Link href="/brands/new">
              <button className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                Create your brand
              </button>
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
