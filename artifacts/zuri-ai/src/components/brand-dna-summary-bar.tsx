import { useGetBrandDna } from "@workspace/api-client-react";
import { Dna } from "lucide-react";

interface BrandDNASummaryBarProps {
  brandId: string;
}

function scoreFromText(text: string, highWords: string[], lowWords: string[]): number {
  const lower = text.toLowerCase();
  let score = 50;
  for (const w of highWords) if (lower.includes(w)) score = Math.min(score + 15, 92);
  for (const w of lowWords) if (lower.includes(w)) score = Math.max(score - 15, 12);
  return Math.round(score);
}

interface ScoreBarProps {
  label: string;
  score: number;
  color: string;
  trackColor: string;
}

function ScoreBar({ label, score, color, trackColor }: ScoreBarProps) {
  return (
    <div className="space-y-1 min-w-0">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{label}</span>
        <span className="text-[11px] font-bold text-foreground">{score}</span>
      </div>
      <div className={`h-1.5 rounded-full ${trackColor}`}>
        <div
          className={`h-1.5 rounded-full ${color} transition-all duration-700`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export function BrandDNASummaryBar({ brandId }: BrandDNASummaryBarProps) {
  const { data: dna, isLoading } = useGetBrandDna(brandId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border border-border rounded-xl animate-pulse">
        <div className="h-4 w-4 rounded bg-muted" />
        <div className="flex-1 h-3 rounded bg-muted" />
      </div>
    );
  }

  if (!dna || dna.buildStatus !== "complete") {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
        <Dna className="h-4 w-4 text-amber-500 shrink-0" />
        <p className="text-xs text-amber-700">
          Brand DNA not built yet. Go to <span className="font-semibold">Brands</span> to build it for better results.
        </p>
      </div>
    );
  }

  const text = `${dna.toneOfVoice} ${dna.brandPersonality} ${dna.writingStyle}`;

  const formality = scoreFromText(text, ["formal", "professional", "corporate", "polished", "structured"], ["casual", "playful", "informal", "conversational", "chill", "fun"]);
  const energy = scoreFromText(text, ["energetic", "dynamic", "vibrant", "bold", "exciting", "high-energy", "fast"], ["calm", "slow", "gentle", "quiet", "soft", "serene"]);
  const humor = scoreFromText(text, ["humorous", "funny", "witty", "playful", "lighthearted", "cheeky", "comedic"], ["serious", "sober", "formal", "earnest", "sincere"]);
  const boldness = scoreFromText(text, ["bold", "daring", "confident", "assertive", "strong", "direct", "fearless", "brave"], ["subtle", "gentle", "soft", "reserved", "modest", "careful"]);

  return (
    <div className="px-4 py-3.5 bg-card border border-border rounded-xl">
      <div className="flex items-center gap-1.5 mb-3">
        <Dna className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Brand DNA Voice Profile</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreBar label="Formality" score={formality} color="bg-blue-500" trackColor="bg-blue-100" />
        <ScoreBar label="Energy" score={energy} color="bg-orange-500" trackColor="bg-orange-100" />
        <ScoreBar label="Humor" score={humor} color="bg-green-500" trackColor="bg-green-100" />
        <ScoreBar label="Boldness" score={boldness} color="bg-purple-500" trackColor="bg-purple-100" />
      </div>
    </div>
  );
}
