import { Palette } from "lucide-react";
import { cn } from "@/lib/utils";

type VisualFormat = "Reel" | "Carousel" | "Story" | "UGC Video" | "Video" | string;

interface CreateVisualButtonProps {
  format: VisualFormat;
  angle?: string;
  hook?: string;
  caption?: string;
  script?: string;
  platform?: string;
  className?: string;
  size?: "sm" | "md";
}

function studioPath(
  format: VisualFormat,
  platform: string,
  angle?: string,
  hook?: string,
  caption?: string,
  script?: string,
): string {
  const base = "/generate/creative-studio";
  const text = hook || caption || "";
  const fmt = format.toLowerCase();
  const plat = (platform || "").toLowerCase();
  const ang = (angle || "").toLowerCase();

  // ── Post type/format takes priority ──────────────────────────────────────
  if (fmt.includes("carousel")) {
    return `${base}/carousel?topic=${encodeURIComponent(text.slice(0, 200))}`;
  }
  if (fmt.includes("story") || plat === "story") {
    return `${base}/story-cover?topic=${encodeURIComponent(text.slice(0, 200))}`;
  }
  if (fmt.includes("reel") || fmt.includes("video") || plat === "tiktok") {
    const desc = encodeURIComponent((script || caption || hook || "").slice(0, 400));
    return `${base}/ugc-video?description=${desc}`;
  }

  // ── For feed/static posts, use content angle to pick the best template ──
  if (ang.includes("testimonial") || ang.includes("review")) {
    return `${base}/testimonial?testimonial=${encodeURIComponent(text.slice(0, 400))}`;
  }
  if (ang.includes("engagement") || ang.includes("quote") || ang.includes("poll")) {
    return `${base}/quote-card?quote=${encodeURIComponent(text.slice(0, 300))}`;
  }
  if (ang.includes("educational") || ang.includes("education") || ang.includes("tip") || ang.includes("how")) {
    return `${base}/quote-card?quote=${encodeURIComponent(text.slice(0, 300))}`;
  }
  if (ang.includes("product") || ang.includes("showcase") || ang.includes("price")) {
    return `${base}/product-showcase?topic=${encodeURIComponent(text.slice(0, 300))}`;
  }

  // Promotional, Brand Story, Behind the scenes, and anything else → announcement
  return `${base}/announcement?topic=${encodeURIComponent(text.slice(0, 400))}`;
}

export function CreateVisualButton({
  format,
  angle,
  hook,
  caption,
  script,
  platform = "",
  className,
  size = "sm",
}: CreateVisualButtonProps) {
  const path = studioPath(format, platform, angle, hook, caption, script);

  function go(e: React.MouseEvent) {
    e.stopPropagation();
    window.location.href = path;
  }

  return (
    <button
      onClick={go}
      title="Create a visual design from this content"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-border font-medium text-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors",
        size === "sm" && "px-2.5 py-1 text-xs",
        size === "md" && "px-3.5 py-2 text-sm",
        className,
      )}
    >
      <Palette className={cn(size === "sm" ? "h-3 w-3" : "h-4 w-4")} />
      Create Visual
    </button>
  );
}
