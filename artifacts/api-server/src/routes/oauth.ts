import { Router, type IRouter, type Request, type Response } from "express";
import { db, socialConnectionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

const FB_API = "https://graph.facebook.com/v19.0";

function getAppId() {
  const id = process.env.META_APP_ID;
  if (!id) throw new Error("META_APP_ID is not set");
  return id;
}

function getAppSecret() {
  const s = process.env.META_APP_SECRET;
  if (!s) throw new Error("META_APP_SECRET is not set");
  return s;
}

function getAppUrl() {
  return process.env.APP_URL ?? "https://zuri-insight-seunalla22.replit.app";
}

function getCallbackUrl() {
  return `${getAppUrl()}/api/oauth/instagram/callback`;
}

router.get("/oauth/instagram/connect", async (req: Request, res: Response): Promise<void> => {
  const { brandId } = req.query as { brandId?: string };
  if (!brandId) {
    res.status(400).json({ error: "brandId is required" });
    return;
  }

  let appId: string;
  try {
    appId = getAppId();
  } catch {
    res.status(500).json({ error: "META_APP_ID is not configured. Please set it in Secrets." });
    return;
  }

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: getCallbackUrl(),
    scope: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement",
    state: brandId,
    response_type: "code",
  });

  res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`);
});

router.get("/oauth/instagram/callback", async (req: Request, res: Response): Promise<void> => {
  const { code, state: brandId, error: fbError } = req.query as Record<string, string>;
  const appUrl = getAppUrl();

  if (fbError || !code) {
    res.redirect(`${appUrl}/settings/social?error=${encodeURIComponent(fbError ?? "Access denied")}`);
    return;
  }

  if (!brandId) {
    res.redirect(`${appUrl}/settings/social?error=missing_brand`);
    return;
  }

  try {
    const appId = getAppId();
    const appSecret = getAppSecret();
    const callbackUrl = getCallbackUrl();

    // 1. Exchange code for short-lived user token
    const tokenResp = await fetch(
      `${FB_API}/oauth/access_token?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(callbackUrl)}&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(code)}`,
    );
    const tokenData = await tokenResp.json() as any;
    if (tokenData.error) throw new Error(tokenData.error.message ?? "Token exchange failed");
    const shortToken: string = tokenData.access_token;

    // 2. Exchange for long-lived user token (60 days)
    const longTokenResp = await fetch(
      `${FB_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(shortToken)}`,
    );
    const longTokenData = await longTokenResp.json() as any;
    if (longTokenData.error) throw new Error(longTokenData.error.message ?? "Long-lived token exchange failed");
    const userToken: string = longTokenData.access_token;
    const expiresInSec: number = longTokenData.expires_in ?? 5184000;

    // 3. Get Facebook Pages (includes long-lived page access tokens)
    const pagesResp = await fetch(
      `${FB_API}/me/accounts?access_token=${encodeURIComponent(userToken)}`,
    );
    const pagesData = await pagesResp.json() as any;
    if (pagesData.error) throw new Error(pagesData.error.message ?? "Failed to fetch pages");
    const pages: Array<{ id: string; access_token: string; name: string }> = pagesData.data ?? [];

    if (!pages.length) {
      res.redirect(`${appUrl}/settings/social?error=no_facebook_pages`);
      return;
    }

    // 4. Find first page that has an Instagram Business Account
    let igUserId: string | null = null;
    let igUsername: string | null = null;
    let pageId: string | null = null;
    let pageToken: string | null = null;

    for (const page of pages) {
      const igResp = await fetch(
        `${FB_API}/${page.id}?fields=instagram_business_account&access_token=${encodeURIComponent(page.access_token)}`,
      );
      const igData = await igResp.json() as any;
      if (igData.instagram_business_account?.id) {
        igUserId = igData.instagram_business_account.id;
        pageId = page.id;
        pageToken = page.access_token;
        break;
      }
    }

    if (!igUserId || !pageToken || !pageId) {
      res.redirect(`${appUrl}/settings/social?error=no_instagram_business_account`);
      return;
    }

    // 5. Get Instagram username
    const usernameResp = await fetch(
      `${FB_API}/${igUserId}?fields=username&access_token=${encodeURIComponent(pageToken)}`,
    );
    const usernameData = await usernameResp.json() as any;
    igUsername = usernameData.username ?? null;

    // 6. Upsert connection in DB
    const existing = await db
      .select()
      .from(socialConnectionsTable)
      .where(
        and(
          eq(socialConnectionsTable.brandId, brandId),
          eq(socialConnectionsTable.platform, "instagram"),
        ),
      )
      .limit(1);

    const tokenExpiresAt = new Date(Date.now() + expiresInSec * 1000);

    if (existing.length > 0) {
      await db
        .update(socialConnectionsTable)
        .set({
          accessToken: pageToken,
          tokenExpiresAt,
          igUserId,
          igUsername,
          pageId,
          updatedAt: new Date(),
        })
        .where(eq(socialConnectionsTable.id, existing[0].id));
    } else {
      await db.insert(socialConnectionsTable).values({
        brandId,
        platform: "instagram",
        accessToken: pageToken,
        tokenExpiresAt,
        igUserId,
        igUsername,
        pageId,
      });
    }

    res.redirect(`${appUrl}/settings/social?connected=instagram&username=${encodeURIComponent(igUsername ?? "")}`);
  } catch (err: any) {
    req.log?.error({ err }, "Instagram OAuth callback error");
    const msg = err?.message ?? "Unknown error";
    res.redirect(`${appUrl}/settings/social?error=${encodeURIComponent(msg)}`);
  }
});

router.get("/oauth/instagram/status", async (req: Request, res: Response): Promise<void> => {
  const { brandId } = req.query as { brandId?: string };
  if (!brandId) {
    res.status(400).json({ error: "brandId is required" });
    return;
  }

  const [conn] = await db
    .select({
      id: socialConnectionsTable.id,
      igUsername: socialConnectionsTable.igUsername,
      tokenExpiresAt: socialConnectionsTable.tokenExpiresAt,
      createdAt: socialConnectionsTable.createdAt,
    })
    .from(socialConnectionsTable)
    .where(
      and(
        eq(socialConnectionsTable.brandId, brandId),
        eq(socialConnectionsTable.platform, "instagram"),
      ),
    )
    .limit(1);

  if (!conn) {
    res.json({ connected: false });
    return;
  }

  const isExpired = conn.tokenExpiresAt ? conn.tokenExpiresAt < new Date() : false;
  res.json({
    connected: !isExpired,
    username: conn.igUsername,
    expiresAt: conn.tokenExpiresAt,
    connectedAt: conn.createdAt,
  });
});

router.delete("/oauth/instagram/disconnect", async (req: Request, res: Response): Promise<void> => {
  const { brandId } = req.query as { brandId?: string };
  if (!brandId) {
    res.status(400).json({ error: "brandId is required" });
    return;
  }

  await db
    .delete(socialConnectionsTable)
    .where(
      and(
        eq(socialConnectionsTable.brandId, brandId),
        eq(socialConnectionsTable.platform, "instagram"),
      ),
    );

  res.json({ success: true });
});

export default router;
