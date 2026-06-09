import { eq, desc, and } from "drizzle-orm";
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

  // 5. Determine language style preference
  const languageStyle = (brand as any)?.languageStyle ?? "standard";
  const usesStandardEnglish = languageStyle === "standard";

  // 6. Build the complete system prompt
  const sections: string[] = [];

  // Absolute rules - always first
  sections.push(`ABSOLUTE RULES - NEVER BREAK:
1. Never fabricate stats, testimonials, or story details.
2. ONLY write about the specific services and products documented in the Brand DNA below. If it is not explicitly stated in the Brand DNA or Brand Identity, do NOT reference it. Never invent products, offerings, or capabilities.
3. Return ONLY the requested content in each field. Never include your reasoning, instructions, analysis, or thinking inside caption or content fields.
4. Be concise - remove every word that does not earn its place.
5. NEVER use the em dash character \u2014 (—). This character is completely banned. Use a hyphen (-) or rewrite the sentence.
6. ${usesStandardEnglish
    ? "LANGUAGE: Write in standard professional English only. Do NOT use Pidgin, slang, street language, or local dialect of any kind. The brand communicates in clean, polished English."
    : "LANGUAGE: You may incorporate culturally relevant local language, Pidgin, or market-specific phrases where they feel natural and authentic to the brand's voice."
  }`);

  // Brand identity
  if (brand) {
    sections.push(`BRAND IDENTITY:
Name: ${brand.name}
Industry: ${brand.industry ?? "Unknown"}
Country: ${brand.country ?? "Nigeria"} | City: ${brand.city ?? "Unknown"}
Language Style: ${usesStandardEnglish ? "Standard professional English" : "Local/Pidgin allowed"}
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
Write content that feels authentic to a real ${brand?.industry ?? "business"} based in ${brand?.country ?? "Nigeria"}. Avoid generic filler. Be specific and grounded. Only reference services and products explicitly listed above.`);
    }

    // Cultural intelligence without mandating language style (that is controlled by rule 6 above)
    sections.push(`CULTURAL INTELLIGENCE (${cultural.name}):
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
