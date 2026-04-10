import { Link } from "wouter";
import { Plus, Sparkles, Globe, CheckCircle2, Clock, Layers } from "lucide-react";
import { useListBrands } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Brands() {
  const { data: brands, isLoading } = useListBrands();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" data-testid="brands-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Brands</h1>
          <p className="text-muted-foreground mt-1">Manage your brand profiles and DNA intelligence.</p>
        </div>
        <Link href="/brands/new" data-testid="brands-new-btn">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" />
            New Brand
          </button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
        </div>
      ) : brands && brands.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {brands.map((brand) => (
            <div key={brand.id} className="bg-card border border-border rounded-2xl p-6 hover:border-primary/40 transition-all group" data-testid={`brand-card-${brand.id}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                  {brand.name.charAt(0)}
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${brand.dnaBuilt ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {brand.dnaBuilt ? <><CheckCircle2 className="h-3 w-3" /> DNA Ready</> : <><Clock className="h-3 w-3" /> DNA Pending</>}
                </span>
              </div>
              <h3 className="font-semibold text-foreground text-lg mb-1">{brand.name}</h3>
              {brand.industry && <p className="text-sm text-muted-foreground mb-1">{brand.industry}</p>}
              {brand.targetMarket && <p className="text-xs text-muted-foreground/70 mb-3 line-clamp-1">{brand.targetMarket}</p>}
              {brand.websiteUrl && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
                  <Globe className="h-3.5 w-3.5" />
                  <span className="truncate">{brand.websiteUrl}</span>
                </div>
              )}
              <div className="flex gap-2 pt-3 border-t border-border">
                <Link href={`/brands/${brand.id}`} data-testid={`brand-view-${brand.id}`}>
                  <button className="flex-1 px-3 py-2 text-xs font-medium text-foreground border border-border rounded-lg hover:bg-muted transition-colors">
                    View Details
                  </button>
                </Link>
                <Link href={`/generate?brandId=${brand.id}`} data-testid={`brand-generate-${brand.id}`}>
                  <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                    <Sparkles className="h-3 w-3" />
                    Generate
                  </button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Layers className="h-14 w-14 text-muted-foreground/30 mb-5" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No brands yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">Create your first brand profile and let Zuri AI build its DNA intelligence profile from your website and social media.</p>
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
