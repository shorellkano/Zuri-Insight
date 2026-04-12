const FIRECRAWL_BASE = "https://api.firecrawl.dev/v1";

function getFirecrawlKey(): string {
  const raw = (process.env.FIRECRAWL_API_KEY ?? "").trim();
  if (!raw) return "";
  // Firecrawl keys are always exactly: fc- + 32 hex chars (35 chars total)
  const match = raw.match(/fc-[a-f0-9]{32}/);
  if (match) return match[0];
  // Fallback: extract first 32-char hex block and prepend fc-
  const hexMatch = raw.match(/[a-f0-9]{32}/);
  if (hexMatch) return `fc-${hexMatch[0]}`;
  return raw;
}

async function firecrawlPost(path: string, body: Record<string, unknown>): Promise<any> {
  const apiKey = getFirecrawlKey();
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY not set");
  const res = await fetch(`${FIRECRAWL_BASE}${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Firecrawl ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function crawlWebsite(url: string): Promise<string> {
  if (!getFirecrawlKey()) return "";
  try {
    // Scrape homepage
    const homeData = await firecrawlPost("/scrape", {
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      excludeTags: ["nav", "footer", "header", "script", "style", "iframe"],
    });
    let content: string = homeData?.data?.markdown ?? homeData?.markdown ?? "";

    // If homepage is short, crawl a few more pages
    if (content.length < 500) {
      const crawlData = await firecrawlPost("/crawl", {
        url,
        limit: 4,
        scrapeOptions: {
          formats: ["markdown"],
          onlyMainContent: true,
          excludeTags: ["nav", "footer", "header", "script", "style", "iframe"],
        },
      });
      const pages: any[] = crawlData?.data ?? crawlData?.pages ?? [];
      if (pages.length > 0) {
        const extra = pages
          .map((p: any) => p.markdown ?? p.data?.markdown ?? "")
          .filter(Boolean)
          .join("\n\n");
        content = content ? `${content}\n\n${extra}` : extra;
      }
    }

    return content.slice(0, 10000);
  } catch (e) {
    console.error("Firecrawl crawlWebsite error:", e);
    return "";
  }
}

export async function crawlPage(url: string): Promise<string> {
  if (!getFirecrawlKey()) return "";
  try {
    const data = await firecrawlPost("/scrape", {
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    });
    const markdown = data?.data?.markdown ?? data?.markdown ?? "";
    return markdown.slice(0, 3000);
  } catch {
    return "";
  }
}
