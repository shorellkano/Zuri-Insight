const FIRECRAWL_BASE = "https://api.firecrawl.dev/v1";
const SCRAPE_TIMEOUT_MS = 10_000;
const CRAWL_TIMEOUT_MS  = 12_000;

function getFirecrawlKey(): string {
  const raw = (process.env.FIRECRAWL_API_KEY ?? "").trim();
  if (!raw) return "";
  const match = raw.match(/fc-[a-f0-9]{32}/);
  if (match) return match[0];
  const hexMatch = raw.match(/[a-f0-9]{32}/);
  if (hexMatch) return `fc-${hexMatch[0]}`;
  return raw;
}

async function firecrawlPost(
  path: string,
  body: Record<string, unknown>,
  timeoutMs = SCRAPE_TIMEOUT_MS,
): Promise<any> {
  const apiKey = getFirecrawlKey();
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY not set");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${FIRECRAWL_BASE}${path}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Firecrawl ${path} failed: ${res.status} ${text}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function crawlWebsite(url: string): Promise<string> {
  if (!getFirecrawlKey()) return "";
  try {
    const homeData = await firecrawlPost("/scrape", {
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      excludeTags: ["nav", "footer", "header", "script", "style", "iframe"],
    }, SCRAPE_TIMEOUT_MS);
    let content: string = homeData?.data?.markdown ?? homeData?.markdown ?? "";

    if (content.length < 500) {
      const crawlData = await firecrawlPost("/crawl", {
        url,
        limit: 4,
        scrapeOptions: {
          formats: ["markdown"],
          onlyMainContent: true,
          excludeTags: ["nav", "footer", "header", "script", "style", "iframe"],
        },
      }, CRAWL_TIMEOUT_MS);
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
  } catch (e: any) {
    if (e?.name === "AbortError") {
      console.warn("Firecrawl crawlWebsite timed out — continuing without website content");
    } else {
      console.error("Firecrawl crawlWebsite error:", e);
    }
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
    }, SCRAPE_TIMEOUT_MS);
    const markdown = data?.data?.markdown ?? data?.markdown ?? "";
    return markdown.slice(0, 3000);
  } catch {
    return "";
  }
}
