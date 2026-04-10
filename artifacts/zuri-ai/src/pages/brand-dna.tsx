import { useParams, Link } from "wouter";
import { useGetBrand, useGetBrandDna, useBuildBrandDna, getGetBrandDnaQueryKey, getListBrandsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandSubNav } from "@/components/brand-sub-nav";
import { Sparkles, Globe, CheckCircle2, Clock, Loader2, RefreshCw, Dna, Target, Users, Lightbulb, MessageSquare } from "lucide-react";

function ScoreBar({ label, score, color, track }: { label: string; score: number; color: string; track: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="text-xs font-bold text-foreground">{score}%</span>
      </div>
      <div className={`h-2 rounded-full ${track}`}>
        <div className={`h-2 rounded-full ${color} transition-all duration-700`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function scoreFromText(text: string, highWords: string[], lowWords: string[]): number {
  const lower = text.toLowerCase();
  let score = 50;
  for (const w of highWords) if (lower.includes(w)) score = Math.min(score + 15, 92);
  for (const w of lowWords) if (lower.includes(w)) score = Math.max(score - 15, 12);
  return Math.round(score);
}

function Tag({ children, color = "bg-primary/10 text-primary" }: { children: React.ReactNode; color?: string }) {
  return <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${color}`}>{children}</span>;
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function BrandDna() {
  const { brandId } = useParams<{ brandId: string }>();
  const queryClient = useQueryClient();

  const { data: brand, isLoading: brandLoading } = useGetBrand(brandId);
  const { data: dna, isLoading: dnaLoading } = useGetBrandDna(brandId, { query: { enabled: !!brandId } });
  const buildDna = useBuildBrandDna();

  function handleRebuild() {
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
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
      </div>
    </div>
  );

  if (!brand) return (
    <div className="p-6 text-center"><p className="text-muted-foreground">Brand not found.</p></div>
  );

  const voiceText = dna ? `${dna.toneOfVoice} ${dna.brandPersonality} ${dna.writingStyle}` : "";
  const formality = scoreFromText(voiceText, ["formal", "professional", "corporate", "polished", "structured"], ["casual", "playful", "informal", "conversational", "chill"]);
  const energy = scoreFromText(voiceText, ["energetic", "dynamic", "vibrant", "bold", "exciting", "high-energy"], ["calm", "gentle", "quiet", "soft", "serene"]);
  const humor = scoreFromText(voiceText, ["humorous", "funny", "witty", "playful", "lighthearted", "cheeky"], ["serious", "sober", "earnest", "sincere"]);
  const boldness = scoreFromText(voiceText, ["bold", "daring", "confident", "assertive", "strong", "direct", "fearless"], ["subtle", "gentle", "soft", "reserved", "modest"]);

  const builtDate = dna?.builtAt ? new Date(dna.builtAt) : null;

  return (
    <div data-testid="brand-dna-page">
      <BrandSubNav brandId={brandId} />

      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">

        {/* Brand header */}
        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-3xl shrink-0">
              {brand.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{brand.name}</h1>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${brand.dnaBuilt ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {brand.dnaBuilt ? <><CheckCircle2 className="h-3 w-3" /> DNA Ready</> : <><Clock className="h-3 w-3" /> DNA Pending</>}
                </span>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                {brand.industry && <span>{brand.industry}</span>}
                {brand.targetMarket && <span className="text-muted-foreground/70">{brand.targetMarket}</span>}
              </div>
              {builtDate && (
                <p className="text-xs text-muted-foreground">Last built: {builtDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {brand.websiteUrl && (
                <a href={brand.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors">
                  <Globe className="h-4 w-4" />
                  Website
                </a>
              )}
              <button
                onClick={handleRebuild}
                disabled={buildDna.isPending}
                data-testid="btn-rebuild-dna"
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {buildDna.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {buildDna.isPending ? "Building..." : brand.dnaBuilt ? "Rebuild DNA" : "Build DNA"}
              </button>
            </div>
          </div>
        </div>

        {dnaLoading ? (
          <div className="space-y-5">
            {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        ) : !dna ? (
          <div className="flex flex-col items-center py-20 text-center bg-card border border-dashed border-border rounded-2xl">
            <Dna className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold text-foreground mb-2">No Brand DNA yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">Build your Brand DNA so Zuri AI can understand your brand and generate content that sounds like you.</p>
            <button
              onClick={handleRebuild}
              disabled={buildDna.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {buildDna.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {buildDna.isPending ? "Building DNA..." : "Build Brand DNA"}
            </button>
          </div>
        ) : (dna as any)?.buildStatus === "failed" ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 flex flex-col items-center text-center gap-4">
            <div className="h-14 w-14 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
            </div>
            <div>
              <h3 className="font-semibold text-red-900 mb-2">Brand DNA build failed</h3>
              <p className="text-sm text-red-700 max-w-md">
                {(dna as any)?.errorMessage ?? "Something went wrong while building the DNA. Please try again."}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              {brand.websiteUrl && (
                <p className="text-xs text-red-600 bg-red-100 px-3 py-1.5 rounded-lg">
                  Current URL: <strong>{brand.websiteUrl}</strong>
                </p>
              )}
              <button
                onClick={handleRebuild}
                disabled={buildDna.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
              >
                {buildDna.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {buildDna.isPending ? "Trying again..." : "Try again"}
              </button>
            </div>
            <p className="text-xs text-red-600 max-w-sm">
              If your website is behind a login or uses an app subdomain (e.g. app.yoursite.com), update your brand URL to your main marketing site first.
            </p>
          </div>
        ) : (
          <div className="space-y-5">

            {/* Voice Scores */}
            <SectionCard title="Voice Scores" icon={Dna}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <ScoreBar label="Formality" score={formality} color="bg-blue-500" track="bg-blue-100" />
                <ScoreBar label="Energy" score={energy} color="bg-orange-500" track="bg-orange-100" />
                <ScoreBar label="Humor" score={humor} color="bg-green-500" track="bg-green-100" />
                <ScoreBar label="Boldness" score={boldness} color="bg-purple-500" track="bg-purple-100" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {[
                  { label: "Tone of Voice", value: dna.toneOfVoice },
                  { label: "Brand Personality", value: dna.brandPersonality },
                  { label: "Writing Style", value: dna.writingStyle },
                ].map(({ label, value }) => value ? (
                  <div key={label} className="bg-muted/40 rounded-xl p-4">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{label}</p>
                    <p className="text-sm text-foreground leading-relaxed">{value}</p>
                  </div>
                ) : null)}
              </div>
            </SectionCard>

            {/* Connected Sources */}
            <SectionCard title="Connected Sources" icon={Globe}>
              <div className="flex flex-wrap gap-2">
                {brand.websiteUrl ? (
                  <span className="flex items-center gap-1.5 px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Website
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-3 py-2 bg-muted border border-border text-muted-foreground rounded-lg text-sm">
                    <Clock className="h-3.5 w-3.5" /> No website connected
                  </span>
                )}
                <span className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm font-medium">
                  <Globe className="h-3.5 w-3.5" /> Public read only
                </span>
              </div>
              <p className="text-xs text-muted-foreground">DNA was built by reading publicly available content from the sources above.</p>
            </SectionCard>

            {/* Audience Profile */}
            <SectionCard title="Audience Profile" icon={Users}>
              <p className="text-sm text-foreground leading-relaxed">{dna.targetAudience}</p>
              {dna.uniqueSellingPoints?.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Unique Selling Points</p>
                  <div className="flex flex-wrap gap-2">
                    {dna.uniqueSellingPoints.map((usp, i) => (
                      <Tag key={i} color="bg-teal-50 text-teal-700">{usp}</Tag>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>

            {/* Cultural Context */}
            <SectionCard title="Cultural Context" icon={Target}>
              <p className="text-sm text-foreground leading-relaxed">{dna.culturalContext}</p>
            </SectionCard>

            {/* Core Values */}
            {dna.coreValues?.length > 0 && (
              <SectionCard title="Core Values" icon={Lightbulb}>
                <div className="flex flex-wrap gap-2">
                  {dna.coreValues.map((val, i) => (
                    <Tag key={i}>{val}</Tag>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Key Messages */}
            {dna.keyMessages?.length > 0 && (
              <SectionCard title="Key Messages" icon={MessageSquare}>
                <ul className="space-y-3">
                  {dna.keyMessages.map((msg, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                      <p className="text-sm text-foreground leading-relaxed">{msg}</p>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {/* Brand Summary callout */}
            <div className="bg-primary/5 border-l-4 border-primary rounded-r-2xl p-5 space-y-2">
              <p className="text-[11px] font-bold text-primary uppercase tracking-wider">Brand Summary</p>
              <p className="text-sm text-foreground leading-relaxed">
                {dna.brandPersonality}
                {dna.toneOfVoice && ` Their tone is ${dna.toneOfVoice.toLowerCase()}.`}
              </p>
              <Link href={`/generate?brandId=${brandId}`}>
                <button className="flex items-center gap-2 mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
                  <Sparkles className="h-4 w-4" />
                  Generate content with this DNA
                </button>
              </Link>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
