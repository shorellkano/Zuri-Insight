import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Sparkles, Layers, TrendingUp, ArrowRight, Activity, Globe, AtSign, Loader2, Calendar, Copy, CheckCircle2, X, Zap, CalendarDays, Film, LayoutGrid } from "lucide-react";
import { useGetDashboardStats, useGetDashboardActivity, useListBrands } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { useBrand } from "@/context/brand-context";
import { useToast } from "@/hooks/use-toast";
import { PptxExport, buildContentPlanSlides } from "@/components/pptx-export";

const API = (p: string) => `/api${p}`;

function StatCard({ label, value, icon: Icon, sub }: { label: string; value: string | number; icon: React.ElementType; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-6" data-testid={`stat-card-${label}`}>
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <span className="text-xs sm:text-sm text-muted-foreground font-medium truncate pr-1">{label}</span>
        <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
        </div>
      </div>
      <div className="text-2xl sm:text-3xl font-bold text-foreground mb-0.5 truncate">{value}</div>
      {sub && <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{sub}</p>}
    </div>
  );
}

const contentTypes = [
  { type: "ad-copy", label: "Ad Copy", href: "/generate/ad-copy", color: "bg-primary/10 text-primary" },
  { type: "social-posts", label: "Social Posts", href: "/generate/social-posts", color: "bg-secondary/10 text-secondary" },
  { type: "email", label: "Email", href: "/generate/email", color: "bg-accent/20 text-amber-700" },
  { type: "whatsapp", label: "WhatsApp", href: "/generate/whatsapp", color: "bg-green-100 text-green-700" },
  { type: "video-scripts", label: "Video Scripts", href: "/generate/video-scripts", color: "bg-purple-100 text-purple-700" },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

type PlanPost = { id: string; day: number; platform: string; contentType: string; topic: string; angle: string; caption: string };
type QuickPlan = { brandName: string; brandSummary: string; duration: string; totalPosts: number; plan: PlanPost[] };

const platformColors: Record<string, string> = {
  Instagram: "bg-pink-100 text-pink-700",
  Facebook: "bg-blue-100 text-blue-700",
  LinkedIn: "bg-sky-100 text-sky-700",
  TikTok: "bg-gray-900 text-white",
  Twitter: "bg-gray-100 text-gray-700",
  "Twitter/X": "bg-gray-100 text-gray-700",
};

function SmartStart({ brandId, websiteUrl }: { brandId?: string; websiteUrl?: string }) {
  const [url, setUrl] = useState(websiteUrl ?? "");
  const [handle, setHandle] = useState("");
  const [platform, setPlatform] = useState("Instagram");
  const [duration, setDuration] = useState<"1week" | "1month" | "3months">("1month");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<QuickPlan | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [mobileRoute, setMobileRoute] = useState<"website" | "social">("website");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  async function generatePlan(overrideUrl?: string) {
    const effectiveUrl = overrideUrl ?? url;
    if (!effectiveUrl.trim() && !brandId) return;
    setLoading(true);
    setPlan(null);
    try {
      const body: any = { duration };
      if (effectiveUrl.trim()) {
        const full = effectiveUrl.trim().startsWith("http") ? effectiveUrl.trim() : `https://${effectiveUrl.trim()}`;
        body.websiteUrl = full;
      }
      if (brandId) body.brandId = brandId;
      const r = await fetch(API("/generate/quick-plan"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed");
      setPlan(data);
    } catch (err: any) {
      toast({ title: "Could not generate plan", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function goSocial() {
    navigate(`/generate/social-posts?handle=${encodeURIComponent(handle)}&platform=${encodeURIComponent(platform)}`);
  }

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  return (
    <div className="space-y-4">
      {/* Hero heading */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 px-6 py-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Generate your content plan now</h2>
        </div>
        <p className="text-sm text-muted-foreground ml-11">
          Give Zuri your website or social handle and it will scan your brand, understand your voice, and build you a ready-to-post content plan.
        </p>
      </div>

      {/* Mobile: choose one route */}
      <div className="flex lg:hidden rounded-xl border border-border overflow-hidden bg-muted/30">
        <button
          onClick={() => setMobileRoute("website")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${mobileRoute === "website" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Globe className="h-4 w-4" />
          Website
        </button>
        <button
          onClick={() => setMobileRoute("social")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${mobileRoute === "social" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <AtSign className="h-4 w-4" />
          Social Handle
        </button>
      </div>

      {/* Two entry points */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Card 1 — From Website */}
        <div className={`bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 ${mobileRoute !== "website" ? "hidden lg:flex" : ""}`}>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">From your website</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Paste your website link. Zuri will read your brand and write a full content plan - ready to post.
              </p>
            </div>
          </div>

          {/* URL input */}
          <div className="flex items-center border border-border bg-background rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-colors">
            <span className="px-3 text-muted-foreground text-sm shrink-0 border-r border-border py-3 bg-muted/50">https://</span>
            <input
              value={url.replace(/^https?:\/\//, "")}
              onChange={e => setUrl(e.target.value)}
              placeholder="yourbrand.com"
              className="flex-1 px-3 py-3 bg-transparent text-sm focus:outline-none min-w-0"
              onKeyDown={e => e.key === "Enter" && generatePlan()}
              onPaste={e => {
                const pasted = e.clipboardData.getData("text").trim();
                if (pasted.includes(".")) {
                  const clean = pasted.replace(/^https?:\/\//, "");
                  setUrl(clean);
                  e.preventDefault();
                  setTimeout(() => generatePlan(clean), 50);
                }
              }}
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-primary mx-3 shrink-0" />}
          </div>

          {/* Duration picker */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">How much content do you want?</p>
            <div className="grid grid-cols-3 gap-2">
              {(["1week", "1month", "3months"] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${duration === d ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}
                >
                  {d === "1week" ? "1 Week" : d === "1month" ? "1 Month" : "3 Months"}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => generatePlan()}
            disabled={loading || (!url.trim() && !brandId)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" />Scanning your brand...</>
              : <><Sparkles className="h-4 w-4" />Build My Content Plan</>}
          </button>
        </div>

        {/* Card 2 — From Socials */}
        <div className={`bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 ${mobileRoute !== "social" ? "hidden lg:flex" : ""}`}>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
              <AtSign className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">From your social handle</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Enter your Instagram, TikTok or Facebook handle. Zuri will study your vibe and write posts that match it.
              </p>
            </div>
          </div>

          {/* Handle input */}
          <div className="flex items-center border border-border bg-background rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-secondary/20 focus-within:border-secondary transition-colors">
            <span className="px-3 py-3 bg-muted/50 text-muted-foreground text-base font-bold border-r border-border shrink-0">@</span>
            <input
              value={handle}
              onChange={e => setHandle(e.target.value)}
              placeholder="yourbrand"
              className="flex-1 px-3 py-3 bg-transparent text-sm focus:outline-none min-w-0"
              onKeyDown={e => e.key === "Enter" && handle.trim() && goSocial()}
            />
          </div>

          {/* Platform picker */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Which platform?</p>
            <div className="flex gap-1.5 flex-wrap">
              {["Instagram", "TikTok", "Facebook", "Twitter/X", "LinkedIn"].map(p => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${platform === p ? "bg-secondary text-secondary-foreground border-secondary" : "border-border text-muted-foreground hover:border-secondary/40 hover:text-foreground"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={goSocial}
            disabled={!handle.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 bg-secondary text-secondary-foreground rounded-xl font-bold text-sm hover:bg-secondary/90 disabled:opacity-50 transition-colors mt-auto"
          >
            <Sparkles className="h-4 w-4" />
            <span className="truncate">Write Posts for @{handle || "yourbrand"}</span>
          </button>
        </div>
      </div>

      {/* Plan results */}
      {plan && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="p-5 pb-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-foreground text-sm">{plan.brandName} - {plan.duration} Content Plan</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{plan.brandSummary}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-medium">{plan.totalPosts} posts</span>
                <button onClick={() => setPlan(null)} className="h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center transition-colors">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {plan.plan.map((post) => (
                <div key={post.id} className="flex items-start gap-3 p-3 rounded-xl bg-background border border-border group hover:border-primary/30 transition-colors">
                  <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Day</span>
                    <span className="text-base font-black text-primary leading-none">{post.day}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${platformColors[post.platform] ?? "bg-muted text-foreground"}`}>{post.platform}</span>
                      <span className="text-[10px] text-muted-foreground font-medium">{post.contentType}</span>
                      <span className="text-[10px] text-muted-foreground">{post.angle}</span>
                    </div>
                    <p className="text-xs font-semibold text-foreground mb-0.5">{post.topic}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{post.caption}</p>
                  </div>
                  <button
                    onClick={() => copy(post.caption, post.id)}
                    className="shrink-0 h-7 w-7 rounded-lg border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:border-primary/40 hover:bg-primary/5"
                  >
                    {copiedId === post.id ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              <Link href="/generate/bulk-plan" className="flex-1">
                <button className="w-full flex items-center justify-center gap-1.5 py-2 border border-border rounded-lg text-xs font-semibold text-foreground hover:bg-muted transition-colors">
                  <Calendar className="h-3.5 w-3.5" />
                  Full Bulk Planner
                </button>
              </Link>
              <Link href="/generate/social-posts" className="flex-1">
                <button className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors">
                  <Sparkles className="h-3.5 w-3.5" />
                  Generate Posts
                </button>
              </Link>
            </div>
            {plan && (
              <PptxExport
                variant="card"
                deckTitle={`${plan.brandName} - ${plan.duration} Content Plan`}
                brandName={plan.brandName}
                buttonLabel="Download as PowerPoint"
                slides={buildContentPlanSlides(plan.plan.map(p => ({
                  day: p.day,
                  platform: p.platform,
                  contentType: p.contentType,
                  topic: p.topic,
                  angle: p.angle,
                  caption: p.caption,
                })))}
                filename={`${plan.brandName.toLowerCase().replace(/\s+/g, "_")}_content_plan`}
                className="mt-2"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: activity, isLoading: activityLoading } = useGetDashboardActivity();
  const { data: brands, isLoading: brandsLoading } = useListBrands();
  const { user } = useAuth();
  const { activeBrandId } = useBrand();
  const name = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";
  const activeBrand = brands?.find(b => b.id === activeBrandId);

  return (
    <div className="px-4 py-5 sm:p-6 max-w-7xl mx-auto space-y-6 sm:space-y-8" data-testid="dashboard-page">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{greeting()}, {name}</h1>
        <p className="text-muted-foreground mt-1">What do you want to create today?</p>
      </div>

      {/* Quick Actions Hub */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link href="/quick-create">
          <div className="group flex flex-col gap-3 p-4 rounded-2xl bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition-all shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">Write a Post</p>
              <p className="text-[11px] text-primary-foreground/70 mt-0.5">Caption in 60 sec</p>
            </div>
          </div>
        </Link>
        <Link href="/generate/bulk-plan">
          <div className="group flex flex-col gap-3 p-4 rounded-2xl bg-card border border-border cursor-pointer hover:border-primary/40 hover:bg-muted/40 transition-all">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight text-foreground">Plan My Month</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">30 days of content</p>
            </div>
          </div>
        </Link>
        <Link href="/generate/creative-studio">
          <div className="group flex flex-col gap-3 p-4 rounded-2xl bg-card border border-border cursor-pointer hover:border-primary/40 hover:bg-muted/40 transition-all">
            <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Film className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight text-foreground">Create Visuals</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Carousels, quotes, video</p>
            </div>
          </div>
        </Link>
        <Link href="/calendar">
          <div className="group flex flex-col gap-3 p-4 rounded-2xl bg-card border border-border cursor-pointer hover:border-primary/40 hover:bg-muted/40 transition-all">
            <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center">
              <LayoutGrid className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight text-foreground">Content Calendar</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Your scheduled posts</p>
            </div>
          </div>
        </Link>
      </div>

      <SmartStart brandId={activeBrandId ?? undefined} websiteUrl={(activeBrand as any)?.websiteUrl ?? ""} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 sm:h-32 rounded-2xl" />)
        ) : (
          <>
            <StatCard label="Total Brands" value={stats?.totalBrands ?? 0} icon={Layers} sub="Brand profiles" />
            <StatCard label="Generated" value={stats?.totalContentGenerated ?? 0} icon={Sparkles} sub="All time" />
            <StatCard label="This Month" value={stats?.contentThisMonth ?? 0} icon={TrendingUp} sub="Content created" />
            <StatCard label="Most Active" value={stats?.mostActiveBrand ?? "-"} icon={Activity} sub="Top brand" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <h2 className="text-base font-semibold text-foreground">Quick Generate</h2>
            <Link href="/generate" data-testid="dashboard-all-formats-link">
              <span className="text-xs text-primary font-medium hover:underline flex items-center gap-1">All formats <ArrowRight className="h-3 w-3" /></span>
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            {contentTypes.map(({ label, href, color }) => (
              <Link key={label} href={href} data-testid={`quick-gen-${label}`}>
                <div className="flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-3 sm:py-3.5 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/50 transition-all cursor-pointer">
                  <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-lg ${color} flex items-center justify-center shrink-0`}>
                    <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-foreground truncate">{label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <h2 className="text-base font-semibold text-foreground">Recent Activity</h2>
          </div>
          {activityLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : activity && activity.length > 0 ? (
            <div className="space-y-3">
              {activity.slice(0, 7).map((item) => (
                <div key={item.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0" data-testid={`activity-item-${item.id}`}>
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{item.brandName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{item.contentType?.replace("-", " ")}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Activity className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No activity yet. Generate your first content!</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <h2 className="text-base font-semibold text-foreground">Your Brands</h2>
          <Link href="/brands" data-testid="dashboard-brands-link">
            <span className="text-xs text-primary font-medium hover:underline flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></span>
          </Link>
        </div>
        {brandsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        ) : brands && brands.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {brands.slice(0, 3).map((brand) => (
              <Link key={brand.id} href={`/brands/${brand.id}`} data-testid={`dashboard-brand-card-${brand.id}`}>
                <div className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/30 transition-all cursor-pointer">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm">
                    {brand.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate text-sm">{brand.name}</p>
                    <p className="text-xs text-muted-foreground">{brand.industry ?? "No industry set"}</p>
                    <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1 ${brand.dnaBuilt ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {brand.dnaBuilt ? "DNA Ready" : "DNA Pending"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <Layers className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">No brands yet. Create your first brand profile to get started.</p>
            <Link href="/brands/new" data-testid="dashboard-create-brand-btn">
              <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 mx-auto transition-colors">
                <Sparkles className="h-4 w-4" />
                Create Your First Brand
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
