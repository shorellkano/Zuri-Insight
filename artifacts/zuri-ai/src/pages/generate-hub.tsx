import { Link } from "wouter";
import { Megaphone, Share2, Mail, MessageCircle, Video, ArrowRight, Sparkles } from "lucide-react";
import { useBrand } from "@/context/brand-context";
import { useListBrands } from "@workspace/api-client-react";
import { BrandDNASummaryBar } from "@/components/brand-dna-summary-bar";

const generators = [
  {
    href: "/generate/ad-copy",
    icon: Megaphone,
    label: "Ad Copy",
    desc: "High-converting ads for every platform",
    color: "text-primary bg-primary/10",
    platforms: ["FB", "IG", "TikTok", "Google", "LinkedIn"],
    platformColors: "bg-primary/8 text-primary",
  },
  {
    href: "/generate/social-posts",
    icon: Share2,
    label: "Social Posts",
    desc: "Captions that actually get engagement",
    color: "text-teal-700 bg-teal-100",
    platforms: ["IG", "TikTok", "FB", "X", "LinkedIn"],
    platformColors: "bg-teal-50 text-teal-700",
  },
  {
    href: "/generate/email",
    icon: Mail,
    label: "Email Campaigns",
    desc: "Campaigns that get opened and clicked",
    color: "text-amber-700 bg-amber-100",
    platforms: ["All platforms"],
    platformColors: "bg-amber-50 text-amber-700",
  },
  {
    href: "/generate/whatsapp",
    icon: MessageCircle,
    label: "WhatsApp Messages",
    desc: "Personal messages that convert",
    color: "text-green-700 bg-green-100",
    platforms: ["WhatsApp Business"],
    platformColors: "bg-green-50 text-green-700",
  },
  {
    href: "/generate/video-scripts",
    icon: Video,
    label: "Video Scripts",
    desc: "Scripts for ads, reels, and demos",
    color: "text-purple-700 bg-purple-100",
    platforms: ["TikTok", "IG", "YouTube"],
    platformColors: "bg-purple-50 text-purple-700",
  },
];

export default function GenerateHub() {
  const { activeBrandId } = useBrand();
  const { data: brands } = useListBrands();
  const activeBrand = brands?.find(b => b.id === activeBrandId);

  if (!activeBrandId || !activeBrand) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6" data-testid="generate-hub-page">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Generate Content</h1>
          <p className="text-muted-foreground mt-1 text-sm">AI-powered content with African cultural intelligence.</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center bg-muted/30 border border-dashed border-border rounded-2xl">
          <Sparkles className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">No brand selected</p>
          <p className="text-xs text-muted-foreground mb-4">Select or create a brand to start generating content.</p>
          <Link href="/brands/new">
            <button className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
              Create your first brand
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" data-testid="generate-hub-page">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Generate Content</h1>
          <p className="text-muted-foreground mt-1 text-sm">AI-powered content with African cultural intelligence.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-sm font-semibold border border-amber-200">
          <Sparkles className="h-3.5 w-3.5" />
          {activeBrand.name}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {generators.map(({ href, icon: Icon, label, desc, color, platforms, platformColors }) => (
          <Link key={href} href={href} data-testid={`generator-card-${label}`}>
            <div className="bg-card border border-border rounded-2xl p-6 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer group flex flex-col gap-4 h-full">
              <div className="flex items-start justify-between">
                <div className={`h-12 w-12 rounded-2xl ${color} flex items-center justify-center shrink-0`}>
                  <Icon className="h-6 w-6" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all mt-1" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">{label}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {platforms.map(p => (
                  <span key={p} className={`px-2 py-0.5 rounded text-[11px] font-medium ${platformColors}`}>{p}</span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <BrandDNASummaryBar brandId={activeBrandId} />
    </div>
  );
}
