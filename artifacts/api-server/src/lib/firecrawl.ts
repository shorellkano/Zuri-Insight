export async function crawlWebsite(url: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return "";
  try {
    const FirecrawlApp = (await import("@mendable/firecrawl-js")).default;
    const app = new FirecrawlApp({ apiKey });
    const result = await (app as any).crawlUrl(url, {
      limit: 6,
      scrapeOptions: {
        formats: ["markdown"],
        onlyMainContent: true,
        excludeTags: ["nav", "footer", "header", "script", "style", "iframe"],
      },
    });
    if (result.success && result.data?.length > 0) {
      return result.data
        .filter((p: any) => p.markdown)
        .map((p: any) => p.markdown)
        .join("\n\n")
        .slice(0, 8000);
    }
    return "";
  } catch (e) {
    console.error("Firecrawl crawlWebsite error:", e);
    return "";
  }
}

export async function crawlPage(url: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return "";
  try {
    const FirecrawlApp = (await import("@mendable/firecrawl-js")).default;
    const app = new FirecrawlApp({ apiKey });
    const result = await (app as any).scrapeUrl(url, {
      formats: ["markdown"],
      onlyMainContent: true,
    });
    return result.markdown?.slice(0, 3000) || "";
  } catch {
    return "";
  }
}
