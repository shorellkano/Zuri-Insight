import { useState } from "react";
import { Link } from "wouter";
import { LayoutGrid, Quote, Megaphone, ShoppingBag, Smartphone, Cake, ArrowRight, Palette, Settings2, Video, Star } from "lucide-react";
import { useBrand } from "@/context/brand-context";
import { useListBrands } from "@workspace/api-client-react";
import { VisualPrefsSheet } from "@/components/visual-prefs-sheet";
import { useQuery } from "@tanstack/react-query";

const API = (path: string) => `/api${path}`;

const designTypes = [
  {
    href: "/generate/creative-studio/carousel",
    icon: LayoutGrid,
    label: "Carousel Post",
    desc: "Multi-slide content: tips, product showcases, before/after",
    color: "text-blue-700 bg-blue-100",
    platforms: ["Instagram", "LinkedIn", "Facebook"],
  },
  {
    href: "/generate/creative-studio/quote-card",
    icon: Quote,
    label: "Quote Card",
    desc: "Bold text-forward image with brand quote or stat",
    color: "text-purple-700 bg-purple-100",
    platforms: ["All platforms"],
  },
  {
    href: "/generate/creative-studio/announcement",
    icon: Megaphone,
    label: "Announcement",
    desc: "Event, launch, or milestone announcement post",
    color: "text-amber-700 bg-amber-100",
    platforms: ["All platforms"],
  },
  {
    href: "/generate/creative-studio/product-showcase",
    icon: ShoppingBag,
    label: "Product Showcase",
    desc: "Product in a branded frame with price and CTA",
    color: "text-green-700 bg-green-100",
    platforms: ["Instagram", "Facebook", "TikTok"],
  },
  {
    href: "/generate/creative-studio/story-cover",
    icon: Smartphone,
    label: "Story Cover",
    desc: "Vertical 9:16 format with bold hook and brand colours",
    color: "text-rose-700 bg-rose-100",
    platforms: ["Instagram Stories", "TikTok"],
  },
  {
    href: "/generate/creative-studio/birthday-post",
    icon: Cake,
    label: "Birthday Post",
    desc: "Personalised posts for staff or CEO birthdays",
    color: "text-pink-700 bg-pink-100",
    platforms: ["All platforms"],
  },
  {
    href: "/generate/creative-studio/testimonial",
    icon: Star,
    label: "Testimonial Card",
    desc: "Turn a customer review into a shareable branded graphic",
    color: "text-yellow-700 bg-yellow-100",
    platforms: ["All platforms"],
  },
  {
    href: "/generate/creative-studio/ugc-video",
    icon: Video,
    label: "UGC Video",
    desc: "Realistic influencer-style video from your product description or image",
    color: "text-amber-700 bg-amber-100",
    platforms: ["Instagram", "TikTok", "YouTube"],
    badge: "Higgsfield AI",
  },
];

const styleLabels: Record<string, string> = {
  professional: "Professional",
  minimal: "Clean & Minimal",
  bold: "Bold & Vibrant",
  warm: "Warm & Friendly",
  dark: "Dark & Premium",
};

export default function CreativeStudio() {
  const { activeBrandId } = useBrand();
  const { data: brands } = useListBrands();
  const activeBrand = brands?.find(b => b.id === activeBrandId);
  const [showPrefsSheet, setShowPrefsSheet] = useState(false);

  const { data: prefs, refetch: refetchPrefs } = useQuery<{ designStyle?: string; includeLogo?: string; brandColors?: string[] } | null>({
    queryKey: ["visual-prefs", activeBrandId],
    queryFn: async () => {
      if (!activeBrandId) return null;
      const r = await fetch(API(`/brands/${activeBrandId}/visual-prefs`));
      if (r.status === 404) return null;
      return r.json();
    },
    enabled: !!activeBrandId,
    retry: false,
  });

  const hasPrefs = !!prefs;
  const needsSetup = activeBrandId && !hasPrefs;

  if (!activeBrandId || !activeBrand) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground">Creative Studio</h1></div>
        <div className="flex flex-col items-center justify-center py-20 text-center bg-muted/30 border border-dashed border-border rounded-2xl">
          <Palette className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">No brand selected</p>
          <p className="text-xs text-muted-foreground mb-4">Select a brand to start creating designs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Creative Studio</h1>
          <p className="text-muted-foreground mt-1 text-sm">Design on-brand visuals ready to post.</p>
        </div>
        <div className="flex items-center gap-3">
          {prefs && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted text-muted-foreground rounded-full text-xs font-medium border border-border">
              {styleLabels[prefs.designStyle ?? "professional"] ?? prefs.designStyle}
            </span>
          )}
          <button
            onClick={() => setShowPrefsSheet(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Settings2 className="h-4 w-4" />
            {hasPrefs ? "Edit preferences" : "Set up preferences"}
          </button>
        </div>
      </div>

      {needsSetup && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Palette className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Set up your visual preferences first</p>
            <p className="text-xs text-amber-700 mt-0.5">Tell Zuri your brand colours, logo preference, and design style so every design looks on-brand.</p>
            <button
              onClick={() => setShowPrefsSheet(true)}
              className="mt-3 px-4 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-colors"
            >
              Set up preferences
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {(designTypes as any[]).map(({ href, icon: Icon, label, desc, color, platforms, badge }) => (
          <Link key={href} href={href}>
            <div className="bg-card border border-border rounded-2xl p-6 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer group flex flex-col gap-4 h-full">
              <div className="flex items-start justify-between">
                <div className={`h-12 w-12 rounded-2xl ${color} flex items-center justify-center shrink-0`}>
                  <Icon className="h-6 w-6" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all mt-1" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-foreground">{label}</h3>
                  {badge && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                      {badge}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {platforms.map((p: string) => (
                  <span key={p} className="px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-muted-foreground">{p}</span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {showPrefsSheet && activeBrandId && (
        <VisualPrefsSheet
          brandId={activeBrandId}
          existingPrefs={prefs}
          onClose={() => setShowPrefsSheet(false)}
          onSaved={() => { setShowPrefsSheet(false); refetchPrefs(); }}
        />
      )}
    </div>
  );
}
