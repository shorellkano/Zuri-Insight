import { useState, useRef, useEffect } from "react";
import {
  Palette, ChevronDown, Megaphone, LayoutGrid, Quote,
  Package, Layers, Star, Video, Zap,
} from "lucide-react";
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

const ALL_FORMATS = [
  { id: "announcement",     label: "Announcement",     Icon: Megaphone, desc: "Bold launch or event post",         color: "text-amber-600 bg-amber-50"  },
  { id: "carousel",         label: "Carousel",          Icon: LayoutGrid, desc: "Multi-slide story or tips",         color: "text-blue-600 bg-blue-50"    },
  { id: "quote-card",       label: "Quote Card",        Icon: Quote,     desc: "Bold quote or stat visual",          color: "text-purple-600 bg-purple-50"},
  { id: "product-showcase", label: "Product Showcase",  Icon: Package,   desc: "Product with price and CTA",         color: "text-green-600 bg-green-50"  },
  { id: "story-cover",      label: "Story Cover",       Icon: Layers,    desc: "Vertical 9:16 story format",         color: "text-rose-600 bg-rose-50"    },
  { id: "testimonial",      label: "Testimonial",       Icon: Star,      desc: "Customer review card",               color: "text-yellow-600 bg-yellow-50"},
  { id: "ugc-video",        label: "UGC Video",         Icon: Video,     desc: "Short social video (Higgsfield AI)", color: "text-orange-600 bg-orange-50"},
  { id: "ad-creative",      label: "Ad Creative",       Icon: Zap,       desc: "Meta, TikTok or Google ad visual",   color: "text-red-600 bg-red-50"      },
];

function suggestedId(format: VisualFormat, platform: string, angle?: string): string {
  const fmt = format.toLowerCase();
  const plat = (platform || "").toLowerCase();
  const ang  = (angle  || "").toLowerCase();
  if (fmt.includes("carousel"))                                               return "carousel";
  if (fmt.includes("story") || plat === "story")                             return "story-cover";
  if (fmt.includes("reel") || fmt.includes("video") || plat === "tiktok")   return "ugc-video";
  if (ang.includes("testimonial") || ang.includes("review"))                return "testimonial";
  if (ang.includes("quote") || ang.includes("engagement") || ang.includes("poll")) return "quote-card";
  if (ang.includes("educational") || ang.includes("tip") || ang.includes("how"))   return "quote-card";
  if (ang.includes("product") || ang.includes("showcase") || ang.includes("price"))return "product-showcase";
  return "announcement";
}

function buildPath(id: string, text: string, script?: string): string {
  const base = "/generate/creative-studio";
  const paramMap: Record<string, string> = {
    "carousel": "topic", "story-cover": "topic", "announcement": "topic",
    "product-showcase": "topic", "ad-creative": "topic",
    "quote-card": "quote", "testimonial": "testimonial",
    "ugc-video": "description",
  };
  const key = paramMap[id] ?? "topic";
  const val = id === "ugc-video" ? (script || text) : text;
  return `${base}/${id}?${key}=${encodeURIComponent(val.slice(0, 400))}`;
}

export function CreateVisualButton({
  format, angle, hook, caption, script, platform = "", className, size = "sm",
}: CreateVisualButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const suggested = suggestedId(format, platform, angle);
  const text = hook || caption || "";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function navigate(id: string) {
    setOpen(false);
    window.location.href = buildPath(id, text, script);
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        title="Choose a visual format for this content"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-border font-medium text-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors",
          size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm",
          open && "border-primary text-primary bg-primary/5",
          className,
        )}
      >
        <Palette className={cn(size === "sm" ? "h-3 w-3" : "h-4 w-4")} />
        Create Visual
        <ChevronDown className={cn(
          size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5",
          "transition-transform", open && "rotate-180",
        )} />
      </button>

      {open && (
        <div className="absolute z-50 bottom-full mb-2 right-0 w-64 bg-card border border-border rounded-2xl shadow-xl p-2 space-y-0.5">
          <p className="text-[10px] font-semibold text-muted-foreground px-2.5 py-1.5 uppercase tracking-wider">
            Choose format
          </p>
          {ALL_FORMATS.map(({ id, label, Icon, desc, color }) => {
            const isSuggested = id === suggested;
            return (
              <button
                key={id}
                onClick={() => navigate(id)}
                className={cn(
                  "w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors",
                  isSuggested
                    ? "bg-primary/8 hover:bg-primary/12"
                    : "hover:bg-muted",
                )}
              >
                <span className={cn("shrink-0 w-8 h-8 rounded-lg flex items-center justify-center", color)}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <span className={cn("text-xs font-semibold", isSuggested ? "text-primary" : "text-foreground")}>
                      {label}
                    </span>
                    {isSuggested && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-white leading-none">
                        Suggested
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-tight block">{desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
