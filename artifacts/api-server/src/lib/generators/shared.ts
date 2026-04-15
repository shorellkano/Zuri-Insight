import { eq, desc, and, or, isNull } from "drizzle-orm";
import { db, brandsTable, brandDnaTable, voiceExamplesTable, lessonsTable } from "@workspace/db";
import { getCulturalContext } from "../cultural/profiles.js";

export async function buildSystemPrompt(
  brandId: string,
  contentType: string,
  platform?: string
): Promise<string> {
  // 1. Load brand DNA and brand info
  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  const [dna] = await db.select().from(brandDnaTable).where(eq(brandDnaTable.brandId, brandId));

  // 2. Get cultural context
  const cultural = getCulturalContext(brand?.country ?? "NG");

  // 3. Load up to 12 voice examples (pinned first, then by quality score)
  const voiceExamples = await db
    .select()
    .from(voiceExamplesTable)
    .where(eq(voiceExamplesTable.brandId, brandId))
    .orderBy(desc(voiceExamplesTable.isPinned), desc(voiceExamplesTable.qualityScore))
    .limit(12);

  // 4. Load active lessons filtered to this contentType and platform
  const lessonConditions = [
    eq(lessonsTable.brandId, brandId),
    eq(lessonsTable.isActive, true),
  ];

  const lessons = await db
    .select()
    .from(lessonsTable)
    .where(and(...lessonConditions))
    .orderBy(desc(lessonsTable.createdAt));

  // Filter lessons relevant to this contentType/platform in JS (simpler than complex SQL OR)
  const relevantLessons = lessons.filter((l) => {
    const typeMatch = !l.contentType || l.contentType === contentType;
    const platformMatch = !l.platform || (platform && l.platform === platform);
    return typeMatch && (platformMatch || !platform);
  });

  // 5. Build the complete system prompt
  const sections: string[] = [];

  // Absolute rules - always first
  sections.push(`ABSOLUTE RULES - NEVER BREAK:
1. Never fabricate stats, testimonials, or story details.
2. Use only documented, real examples the user has provided.
3. Be concise - remove every word that does not earn its place.
4. NEVER use the em dash character \u2014 (—). This character is completely banned. Use a hyphen (-) or rewrite the sentence. Check every sentence before responding.`);

  // Brand identity
  if (brand) {
    sections.push(`BRAND IDENTITY:
Name: ${brand.name}
Industry: ${brand.industry ?? "Unknown"}
Country: ${brand.country ?? "Nigeria"} | City: ${brand.city ?? "Unknown"}
Language: ${brand.language ?? "English"}
Target Market: ${brand.targetMarket ?? cultural.name}`);
  }

  // Brand DNA - full profile if complete, graceful fallback if not yet built
  const dnaComplete = dna && dna.buildStatus === "complete";

  if (dnaComplete) {
    sections.push(`BRAND DNA:
Voice & Tone: ${dna.toneOfVoice}
Core Values: ${dna.coreValues?.join(", ") ?? ""}
Brand Personality: ${dna.brandPersonality}
Writing Style: ${dna.writingStyle}
Key Messages: ${dna.keyMessages?.join(" | ") ?? ""}
USPs: ${dna.uniqueSellingPoints?.join(", ") ?? ""}`);

    try {
      const culturalCtx = JSON.parse(dna.culturalContext ?? "{}");
      if (culturalCtx.trust_signals || culturalCtx.buying_triggers) {
        sections.push(`CULTURAL INTELLIGENCE (${cultural.name}):
Trust Signals: ${(culturalCtx.trust_signals ?? cultural.trust_signals).join(", ")}
Buying Triggers: ${(culturalCtx.buying_triggers ?? cultural.buying_triggers).join(", ")}
Key Platforms: ${cultural.platforms.join(", ")}
Payment References: ${cultural.payment_refs.join(", ")}
Festive Peaks: ${cultural.festive_peaks.join(", ")}
Avoid: ${cultural.taboos.join(", ")}`);
      }
    } catch {
      // ignore JSON parse error
    }
  } else {
    // No completed DNA yet - use the brand brief the user typed during setup
    // plus cultural context. This covers Day 1 users with no website or social handles.
    const fallbackParts: string[] = [];

    if (brand?.brandBrief?.trim()) {
      fallbackParts.push(`Business description: ${brand.brandBrief.trim()}`);
    }

    if (brand?.industry && brand.industry !== "Other") {
      fallbackParts.push(`Industry: ${brand.industry}`);
    }

    if (brand?.targetMarket) {
      fallbackParts.push(`Target market: ${brand.targetMarket}`);
    }

    if (fallbackParts.length > 0) {
      sections.push(`BRAND CONTEXT (early stage - no DNA built yet):
${fallbackParts.join("\n")}
Write content that feels authentic to a real ${brand?.industry ?? "business"} based in ${brand?.country ?? "Nigeria"}. Avoid generic filler. Be specific and grounded.`);
    }

    // Always include cultural intelligence when DNA is missing
    sections.push(`CULTURAL INTELLIGENCE (${cultural.name}):
${cultural.language_notes}
Trust Signals: ${cultural.trust_signals.join(", ")}
Buying Triggers: ${cultural.buying_triggers.join(", ")}
Key Platforms: ${cultural.platforms.join(", ")}
Festive Peaks: ${cultural.festive_peaks.join(", ")}
Avoid: ${cultural.taboos.join(", ")}`);
  }

  // Voice examples
  if (voiceExamples.length > 0) {
    const exampleLines = voiceExamples.map((e, i) => `Example ${i + 1}${e.isPinned ? " [PINNED]" : ""}: ${e.text}`);
    sections.push(`APPROVED VOICE EXAMPLES (match this tone and style):
${exampleLines.join("\n")}`);
  }

  // Lessons / corrections
  if (relevantLessons.length > 0) {
    const lessonLines = relevantLessons.map((l, i) => `${i + 1}. ${l.rule}`);
    sections.push(`LEARNED CORRECTIONS (apply these always):
${lessonLines.join("\n")}`);
  }

  return sections.join("\n\n---\n\n");
}
