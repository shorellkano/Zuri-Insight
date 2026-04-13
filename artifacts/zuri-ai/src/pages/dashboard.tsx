import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Sparkles, Layers, BookOpen, TrendingUp, ArrowRight, Activity, Globe, AtSign, ChevronRight, Loader2, Calendar, Copy, CheckCircle2, X } from "lucide-react";
import { useGetDashboardStats, useGetDashboardActivity, useListBrands } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { useBrand } from "@/context/brand-context";
import { useToast } from "@/hooks/use-toast";

const API = (p: string) => `/api${p}`;

function StatCard({ label, value, icon: Icon, sub }: { label: string; value: string | number; icon: React.ElementType; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6" data-testid={`stat-card-${label}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground font-medium">{label}</span>
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="h-4.5 w-4.5 text-primary" />
        </div>
      </div>
      <div className="text-3xl font-bold text-foreground mb-1">{value}</div>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
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
  const [mode, setMode] = useState<"website" | "social">("website");
  const [url, setUrl] = useState(websiteUrl ?? "");
  const [handle, setHandle] = useState("");
  const [platform, setPlatform] = useState("Instagram");
  const [duration, setDuration] = useState<"1week" | "1month" | "3months">("1week");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<QuickPlan | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  async function generatePlan() {
    if (!url.trim() && !brandId) return;
    setLoading(true);
    setPlan(null);
    try {
      const body: any = { duration };
      if (url.trim()) body.websiteUrl = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;
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
    <div className="bg-gradient-to-br from-primary/5 via-card to-card border border-primary/20 rounded-2xl overflow-hidden">
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <Sparkles className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-foreground text-base">Get content instantly</h2>
            <p className="text-xs text-muted-foreground">Drop your website or social handle - Zuri does the rest</p>
          </div>
        </div>

        <div className="flex gap-1 mb-5 bg-muted/50 p-1 rounded-xl w-fit">
          <button
            onClick={() => { setMode("website"); setPlan(null); }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${mode === "website" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Globe className="h-3.5 w-3.5" />
            From Website
          </button>
          <button
            onClick={() => { setMode("social"); setPlan(null); }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${mode === "social" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <AtSign className="h-3.5 w-3.5" />
            From Socials
          </button>
        </div>

        {mode === "website" ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Your website URL</p>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center border border-border bg-background rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-colors">
                  <span className="px-3 text-muted-foreground text-sm shrink-0">https://</span>
                  <input
                    value={url.replace(/^https?:\/\//, "")}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="yourbrand.com"
                    className="flex-1 py-2.5 pr-3 bg-transparent text-sm focus:outline-none"
                    onKeyDown={e => e.key === "Enter" && generatePlan()}
                  />
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Content plan duration</p>
              <div className="flex gap-2">
                {(["1week", "1month", "3months"] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${duration === d ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                  >
                    {d === "1week" ? "1 Week" : d === "1month" ? "1 Month" : "3 Months"}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={generatePlan}
              disabled={loading || (!url.trim() && !brandId)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Reading your brand...</> : <><Sparkles className="h-4 w-4" />Generate My Content Plan</>}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Your social handle</p>
              <div className="flex items-center border border-border bg-background rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-colors">
                <span className="px-3 py-2.5 bg-muted text-muted-foreground text-sm border-r border-border shrink-0">@</span>
                <input
                  value={handle}
                  onChange={e => setHandle(e.target.value)}
                  placeholder="yourbrand"
                  className="flex-1 px-3 py-2.5 bg-transparent text-sm focus:outline-none"
                  onKeyDown={e => e.key === "Enter" && goSocial()}
                />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Platform</p>
              <div className="flex gap-1.5 flex-wrap">
                {["Instagram", "TikTok", "Facebook", "Twitter/X", "LinkedIn"].map(p => (
                  <button
                    key={p}
                    onClick={() => setPlatform(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${platform === p ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={goSocial}
              disabled={!handle.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              Generate Posts for @{handle || "yourbrand"}
            </button>
          </div>
        )}
      </div>

      {plan && (
        <div className="border-t border-border">
          <div className="p-6 pb-4">
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
    <div className="p-6 max-w-7xl mx-auto space-y-8" data-testid="dashboard-page">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{greeting()}, {name}</h1>
        <p className="text-muted-foreground mt-1">What do you want to create today?</p>
      </div>

      <SmartStart brandId={activeBrandId ?? undefined} websiteUrl={(activeBrand as any)?.websiteUrl ?? ""} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <StatCard label="Total Brands" value={stats?.totalBrands ?? 0} icon={Layers} sub="Managed brand profiles" />
            <StatCard label="Content Generated" value={stats?.totalContentGenerated ?? 0} icon={Sparkles} sub="All time" />
            <StatCard label="This Month" value={stats?.contentThisMonth ?? 0} icon={TrendingUp} sub="Content pieces created" />
            <StatCard label="Most Active" value={stats?.mostActiveBrand ?? "-"} icon={Activity} sub="Top brand by content" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-foreground">Quick Generate</h2>
            <Link href="/generate" data-testid="dashboard-all-formats-link">
              <span className="text-xs text-primary font-medium hover:underline flex items-center gap-1">All formats <ArrowRight className="h-3 w-3" /></span>
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {contentTypes.map(({ label, href, color }) => (
              <Link key={label} href={href} data-testid={`quick-gen-${label}`}>
                <div className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/50 transition-all cursor-pointer">
                  <div className={`h-8 w-8 rounded-lg ${color} flex items-center justify-center text-xs font-bold shrink-0`}>
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
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

      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
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
