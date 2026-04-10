import { Link } from "wouter";
import { Plus, Sparkles, Globe, CheckCircle2, Clock, Layers } from "lucide-react";
import { useListBrands } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

type Brand = {
  id: string; name: string; industry?: string | null; targetMarket?: string | null;
  websiteUrl?: string | null; dnaBuilt: boolean; contentCount?: number;
};

function BrandCard({ brand }: { brand: Brand }) {
  const initial = brand.name.charAt(0).toUpperCase();

  const statusColors = brand.dnaBuilt
    ? { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" }
    : { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-400" };

  return (
    <div
      className="bg-card border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-sm transition-all group flex flex-col"
      data-testid={`brand-card-${brand.id}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shrink-0">
          {initial}
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors.bg} ${statusColors.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${statusColors.dot}`} />
          {brand.dnaBuilt ? "DNA Ready" : "DNA Pending"}
        </span>
      </div>

      <h3 className="font-bold text-foreground text-base mb-0.5 truncate">{brand.name}</h3>
      {brand.industry && <p className="text-sm text-muted-foreground mb-0.5">{brand.industry}</p>}
      {brand.targetMarket && <p className="text-xs text-muted-foreground/60 line-clamp-1 mb-3">{brand.targetMarket}</p>}

      {brand.websiteUrl && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
          <Globe className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{brand.websiteUrl.replace(/^https?:\/\//, "")}</span>
        </div>
      )}

      {typeof brand.contentCount === "number" && brand.contentCount > 0 && (
        <p className="text-xs text-muted-foreground mb-3">{brand.contentCount} piece{brand.contentCount !== 1 ? "s" : ""} of content generated</p>
      )}

      <div className="mt-auto pt-4 border-t border-border flex gap-2">
        <Link href={`/brands/${brand.id}`} data-testid={`brand-view-${brand.id}`} className="flex-1">
          <button className="w-full px-3 py-2 text-xs font-semibold text-foreground border border-border rounded-lg hover:bg-muted transition-colors">
            View Details
          </button>
        </Link>
        <Link href={`/generate?brandId=${brand.id}`} data-testid={`brand-generate-${brand.id}`} className="flex-1">
          <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
            <Sparkles className="h-3.5 w-3.5" />
            Generate
          </button>
        </Link>
      </div>
    </div>
  );
}

export default function Brands() {
  const { data: brands, isLoading } = useListBrands();

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6" data-testid="brands-page">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Brands</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage your brand profiles and DNA intelligence.</p>
        </div>
        <Link href="/brands/new" data-testid="brands-new-btn">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shrink-0">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Brand</span>
            <span className="sm:hidden">New</span>
          </button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
        </div>
      ) : brands && brands.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {brands.map((brand) => (
            <BrandCard key={brand.id} brand={brand} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 sm:py-24 text-center px-4">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-5">
            <Layers className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No brands yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm text-sm">Create your first brand profile and let Zuri AI build its DNA intelligence from your website and social media.</p>
          <Link href="/brands/new" data-testid="brands-empty-create-btn">
            <button className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors">
              <Plus className="h-4 w-4" />
              Create Your First Brand
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
