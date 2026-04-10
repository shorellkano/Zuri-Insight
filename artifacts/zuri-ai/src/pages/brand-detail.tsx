import { useParams, Link } from "wouter";
import { useGetBrand, useGetBrandDna, useBuildBrandDna, useListBrandContent, getGetBrandDnaQueryKey, getListBrandsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandSubNav } from "@/components/brand-sub-nav";
import { Sparkles, Globe, CheckCircle2, Clock, Loader2 } from "lucide-react";

export default function BrandDetail() {
  const { brandId } = useParams<{ brandId: string }>();
  const queryClient = useQueryClient();

  const { data: brand, isLoading: brandLoading } = useGetBrand(brandId);
  const { data: dna, isLoading: dnaLoading } = useGetBrandDna(brandId, { query: { enabled: !!brandId } });
  const { data: content, isLoading: contentLoading } = useListBrandContent(brandId, { query: { enabled: !!brandId } });
  const buildDna = useBuildBrandDna();

  function handleBuildDna() {
    buildDna.mutate({ brandId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBrandDnaQueryKey(brandId) });
        queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() });
      }
    });
  }

  if (brandLoading) return (
    <div>
      <div className="h-12 border-b border-border" />
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );

  if (!brand) return (
    <div className="p-6 text-center">
      <p className="text-muted-foreground">Brand not found.</p>
    </div>
  );

  return (
    <div data-testid="brand-detail-page">
      <BrandSubNav brandId={brandId} />

      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">

        {/* Brand header card */}
        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-3xl shrink-0">
              {brand.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <h1 className="text-2xl font-bold text-foreground" data-testid="brand-detail-name">{brand.name}</h1>
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${brand.dnaBuilt ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {brand.dnaBuilt ? <><CheckCircle2 className="h-3 w-3" /> DNA Ready</> : <><Clock className="h-3 w-3" /> DNA Pending</>}
                </span>
                {brand.industry && <span className="px-2.5 py-1 bg-muted text-muted-foreground rounded-full text-xs font-medium">{brand.industry}</span>}
              </div>
              {brand.websiteUrl && (
                <a href={brand.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-primary hover:underline" data-testid="brand-website-link">
                  <Globe className="h-3.5 w-3.5" />
                  {brand.websiteUrl}
                </a>
              )}
              {brand.targetMarket && <p className="text-sm text-muted-foreground">{brand.targetMarket}</p>}
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {!brand.dnaBuilt && (
                <button onClick={handleBuildDna} disabled={buildDna.isPending} data-testid="btn-build-dna-detail" className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {buildDna.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Build DNA
                </button>
              )}
              <Link href={`/generate?brandId=${brand.id}`} data-testid="btn-generate-for-brand">
                <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Generate Content
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Quick navigation cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link href={`/brands/${brand.id}/dna`}>
            <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:bg-primary/2 transition-all cursor-pointer group">
              <div className="flex items-start justify-between mb-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-lg">🧬</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${brand.dnaBuilt ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {brand.dnaBuilt ? "Ready" : "Pending"}
                </span>
              </div>
              <h3 className="font-semibold text-foreground mb-1">Brand DNA</h3>
              <p className="text-xs text-muted-foreground">Voice scores, audience profile, cultural context and key messages.</p>
            </div>
          </Link>

          <Link href={`/brands/${brand.id}/voice`}>
            <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 transition-all cursor-pointer group">
              <div className="flex items-start justify-between mb-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-lg">🎙</span>
                </div>
              </div>
              <h3 className="font-semibold text-foreground mb-1">Voice File</h3>
              <p className="text-xs text-muted-foreground">Real examples of your writing that teach Zuri AI your voice.</p>
            </div>
          </Link>

          <Link href={`/brands/${brand.id}/lessons`}>
            <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 transition-all cursor-pointer group">
              <div className="flex items-start justify-between mb-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-lg">📚</span>
                </div>
              </div>
              <h3 className="font-semibold text-foreground mb-1">Lessons Bank</h3>
              <p className="text-xs text-muted-foreground">Rules Zuri AI has learned from your feedback on generated content.</p>
            </div>
          </Link>
        </div>

        {/* DNA summary (if built) */}
        {dna && !dnaLoading && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">DNA Snapshot</h2>
              <Link href={`/brands/${brand.id}/dna`}>
                <button className="text-xs text-primary hover:underline">View full DNA</button>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Tone", value: dna.toneOfVoice },
                { label: "Personality", value: dna.brandPersonality },
                { label: "Audience", value: dna.targetAudience },
              ].filter(f => f.value).map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                  <p className="text-xs text-foreground line-clamp-2">{value}</p>
                </div>
              ))}
            </div>
            {dna.coreValues?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {dna.coreValues.slice(0, 5).map(v => (
                  <span key={v} className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">{v}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {!dna && !dnaLoading && (
          <div className="flex flex-col items-center py-12 text-center bg-card border border-dashed border-border rounded-2xl">
            <Sparkles className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <h3 className="font-semibold text-foreground mb-2">Build your Brand DNA</h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-sm">Zuri AI reads your website and understands your brand voice, audience and cultural context - all in under 2 minutes.</p>
            <button onClick={handleBuildDna} disabled={buildDna.isPending} data-testid="btn-build-dna-empty" className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {buildDna.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {buildDna.isPending ? "Building DNA..." : "Build Brand DNA"}
            </button>
          </div>
        )}

        {/* Recent content */}
        {content && content.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Recent Content</h2>
              <Link href={`/generate?brandId=${brand.id}`}>
                <button className="text-xs text-primary hover:underline">Generate more</button>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {content.slice(0, 4).map((item) => (
                <div key={item.id} className="bg-card border border-border rounded-xl p-4" data-testid={`content-item-${item.id}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium capitalize">{item.type?.replace("-", " ")}</span>
                    {item.platform && <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs">{item.platform}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3">{item.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
