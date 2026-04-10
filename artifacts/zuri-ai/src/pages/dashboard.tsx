import { Link } from "wouter";
import { Sparkles, Layers, BookOpen, TrendingUp, ArrowRight, Activity } from "lucide-react";
import { useGetDashboardStats, useGetDashboardActivity, useListBrands } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";

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

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: activity, isLoading: activityLoading } = useGetDashboardActivity();
  const { data: brands, isLoading: brandsLoading } = useListBrands();
  const { user } = useAuth();
  const name = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8" data-testid="dashboard-page">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{greeting()}, {name}</h1>
        <p className="text-muted-foreground mt-1">Here's what's happening with your brands today.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <StatCard label="Total Brands" value={stats?.totalBrands ?? 0} icon={Layers} sub="Managed brand profiles" />
            <StatCard label="Content Generated" value={stats?.totalContentGenerated ?? 0} icon={Sparkles} sub="All time" />
            <StatCard label="This Month" value={stats?.contentThisMonth ?? 0} icon={TrendingUp} sub="Content pieces created" />
            <StatCard label="Most Active" value={stats?.mostActiveBrand ?? "—"} icon={Activity} sub="Top brand by content" />
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
