import { useParams, Link } from "wouter";
import { useGetBrand, useGetBrandDna, useBuildBrandDna, useListBrandContent, getGetBrandDnaQueryKey, getListBrandsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Globe, CheckCircle2, Clock, Loader2, ArrowLeft } from "lucide-react";
import { useState } from "react";

export default function BrandDetail() {
  const { brandId } = useParams<{ brandId: string }>();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"dna" | "content">("dna");

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
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );

  if (!brand) return (
    <div className="p-6 text-center">
      <p className="text-muted-foreground">Brand not found.</p>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" data-testid="brand-detail-page">
      <div className="flex items-center gap-3">
        <Link href="/brands" data-testid="back-to-brands">
          <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="brand-detail-name">{brand.name}</h1>
          {brand.industry && <p className="text-muted-foreground text-sm">{brand.industry}</p>}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex flex-wrap gap-6">
          <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl shrink-0">
            {brand.name.charAt(0)}
          </div>
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex flex-wrap gap-3">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${brand.dnaBuilt ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                {brand.dnaBuilt ? <><CheckCircle2 className="h-3 w-3" /> DNA Ready</> : <><Clock className="h-3 w-3" /> DNA Pending</>}
              </span>
            </div>
            {brand.websiteUrl && (
              <a href={brand.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-primary hover:underline" data-testid="brand-website-link">
                <Globe className="h-3.5 w-3.5" />
                {brand.websiteUrl}
              </a>
            )}
            {brand.targetMarket && <p className="text-sm text-muted-foreground">{brand.targetMarket}</p>}
          </div>
          <div className="flex gap-2 shrink-0">
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

      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/brands/${brand.id}/voice`} data-testid="btn-voice-file">
          <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
            <span>🎙</span> Voice File
          </button>
        </Link>
        <Link href={`/brands/${brand.id}/lessons`} data-testid="btn-lessons">
          <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
            <span>📚</span> Lessons Bank
          </button>
        </Link>
      </div>

      <div className="flex border-b border-border gap-0">
        {(["dna", "content"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} data-testid={`tab-${t}`} className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t === "dna" ? "Brand DNA" : "Content Library"}
          </button>
        ))}
      </div>

      {tab === "dna" && (
        <div data-testid="dna-tab">
          {dnaLoading ? (
            <Skeleton className="h-64 rounded-2xl" />
          ) : dna ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                { label: "Tone of Voice", value: dna.toneOfVoice },
                { label: "Brand Personality", value: dna.brandPersonality },
                { label: "Target Audience", value: dna.targetAudience },
                { label: "Cultural Context", value: dna.culturalContext },
                { label: "Writing Style", value: dna.writingStyle },
              ].map(({ label, value }) => (
                <div key={label} className="bg-card border border-border rounded-xl p-5" data-testid={`dna-field-${label}`}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
                  <p className="text-sm text-foreground">{value}</p>
                </div>
              ))}
              <div className="bg-card border border-border rounded-xl p-5 md:col-span-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Core Values</p>
                <div className="flex flex-wrap gap-2">
                  {dna.coreValues?.map((val) => (
                    <span key={val} className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-medium">{val}</span>
                  ))}
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl p-5 md:col-span-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Key Messages</p>
                <ul className="space-y-2">
                  {dna.keyMessages?.map((msg, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      {msg}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-16 text-center bg-card border border-border rounded-2xl">
              <Sparkles className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="font-semibold text-foreground mb-2">No Brand DNA yet</h3>
              <p className="text-sm text-muted-foreground mb-6">Build your Brand DNA to unlock culturally-aware content generation.</p>
              <button onClick={handleBuildDna} disabled={buildDna.isPending} data-testid="btn-build-dna-empty" className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {buildDna.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {buildDna.isPending ? "Building..." : "Build Brand DNA"}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "content" && (
        <div data-testid="content-tab">
          {contentLoading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          ) : content && content.length > 0 ? (
            <div className="space-y-3">
              {content.map((item) => (
                <div key={item.id} className="bg-card border border-border rounded-xl p-5" data-testid={`content-item-${item.id}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2.5 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium capitalize">{item.type?.replace("-", " ")}</span>
                    {item.platform && <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs">{item.platform}</span>}
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-line line-clamp-4">{item.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-16 text-center bg-card border border-border rounded-2xl">
              <p className="text-muted-foreground">No content generated for this brand yet.</p>
              <Link href={`/generate?brandId=${brand.id}`} data-testid="content-empty-generate-link">
                <button className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
                  <Sparkles className="h-4 w-4" />
                  Generate Content
                </button>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
