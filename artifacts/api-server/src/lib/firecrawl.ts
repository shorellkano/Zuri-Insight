export async function crawlWebsite(url: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return "";
  try {
    const FirecrawlApp = (await import("@mendable/firecrawl-js")).default;
    const app = new FirecrawlApp({ apiKey });
    const client = (app as any).v1;

    // Scrape the homepage first for quick results
    const homeResult = await client.scrapeUrl(url, {
      formats: ["markdown"],
      onlyMainContent: true,
      excludeTags: ["nav", "footer", "header", "script", "style", "iframe"],
    });
    let content = homeResult?.markdown ?? homeResult?.data?.markdown ?? "";

    // If homepage is short, also try crawling a few more pages
    if (content.length < 500) {
      const crawlResult = await client.crawlUrl(url, {
        limit: 4,
        scrapeOptions: {
          formats: ["markdown"],
          onlyMainContent: true,
          excludeTags: ["nav", "footer", "header", "script", "style", "iframe"],
        },
      });
      if (crawlResult?.success && crawlResult?.data?.length > 0) {
        const extra = crawlResult.data
          .filter((p: any) => p.markdown)
          .map((p: any) => p.markdown)
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
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return "";
  try {
    const FirecrawlApp = (await import("@mendable/firecrawl-js")).default;
    const app = new FirecrawlApp({ apiKey });
    const client = (app as any).v1;
    const result = await client.scrapeUrl(url, {
      formats: ["markdown"],
      onlyMainContent: true,
    });
    const markdown = result?.markdown ?? result?.data?.markdown ?? "";
    return markdown.slice(0, 3000);
  } catch {
    return "";
  }
}
