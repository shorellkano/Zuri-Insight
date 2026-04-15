import { Palette } from "lucide-react";
import { cn } from "@/lib/utils";

type VisualFormat = "Reel" | "Carousel" | "Story" | "UGC Video" | "Video" | string;

interface CreateVisualButtonProps {
  format: VisualFormat;
  hook?: string;
  caption?: string;
  script?: string;
  platform?: string;
  className?: string;
  size?: "sm" | "md";
}

function studioPath(format: VisualFormat, platform: string, hook?: string, caption?: string, script?: string): string {
  const base = "/generate/creative-studio";
  const text = hook || caption || "";
  const fmt = format.toLowerCase();
  const plat = (platform || "").toLowerCase();

  if (fmt.includes("carousel")) {
    const topic = encodeURIComponent(text.slice(0, 200));
    return `${base}/carousel?topic=${topic}`;
  }
  if (fmt.includes("story") || plat === "story") {
    const topic = encodeURIComponent(text.slice(0, 200));
    return `${base}/story-cover?topic=${topic}`;
  }
  if (fmt.includes("ugc") || fmt.includes("video") || plat === "tiktok") {
    const desc = encodeURIComponent((script || caption || hook || "").slice(0, 400));
    return `${base}/ugc-video?description=${desc}`;
  }
  // Reel, feed post, or anything else → quote card
  const quote = encodeURIComponent(text.slice(0, 200));
  return `${base}/quote-card?quote=${quote}`;
}

export function CreateVisualButton({
  format,
  hook,
  caption,
  script,
  platform = "",
  className,
  size = "sm",
}: CreateVisualButtonProps) {
  const path = studioPath(format, platform, hook, caption, script);

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
        className
      )}
    >
      <Palette className={cn(size === "sm" ? "h-3 w-3" : "h-4 w-4")} />
      Create Visual
    </button>
  );
}
