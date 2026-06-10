import { Router, type IRouter, type Request, type Response } from "express";
import { db, socialConnectionsTable, brandsTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { encryptToken, signOAuthState, verifyOAuthState } from "../lib/tokenCrypto";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth";

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
  return (process.env.APP_URL ?? "https://zuri-insight-seunalla22.replit.app").replace(/\/$/, "");
}

function getCallbackUrl() {
  return `${getAppUrl()}/api/oauth/instagram/callback`;
}

/**
 * Verify ownership and auto-claim unowned (legacy) brands.
 * - Returns true if brand.userId === userId (already owned by this user).
 * - If brand.userId is NULL (pre-auth brand), atomically claims it for userId and returns true.
 * - Returns false if brand is owned by a different user, or if brand doesn't exist.
 */
async function verifyAndClaimBrandOwnership(brandId: string, userId: string): Promise<boolean> {
  const [brand] = await db
    .select({ id: brandsTable.id, userId: brandsTable.userId })
    .from(brandsTable)
    .where(eq(brandsTable.id, brandId))
    .limit(1);

  if (!brand) return false;
  if (brand.userId === userId) return true;
  if (brand.userId !== null) return false;

  // Unowned brand — atomically claim it for this user (first authenticated user wins)
  const claimed = await db
    .update(brandsTable)
    .set({ userId })
    .where(and(eq(brandsTable.id, brandId), isNull(brandsTable.userId)))
    .returning({ id: brandsTable.id });

  return claimed.length > 0;
}


// ── GET /oauth/instagram/connect-url ─────────────────────────────────────────

router.get("/oauth/instagram/connect-url", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const authed = req as AuthedRequest;
  const { brandId } = req.query as { brandId?: string };

  if (!brandId) {
    res.status(400).json({ error: "brandId is required" });
    return;
  }

  const owned = await verifyAndClaimBrandOwnership(brandId, authed.userId).catch(() => false);
  if (!owned) {
    res.status(403).json({ error: "You do not have access to this brand." });
    return;
  }

  let appId: string;
  try {
    appId = getAppId();
  } catch {
    res.status(500).json({ error: "META_APP_ID is not configured. Please set it in Secrets." });
    return;
  }

  // State includes both brandId and userId so callback can verify user binding + has 1-hour expiry
  const signedState = signOAuthState(brandId, authed.userId);

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: getCallbackUrl(),
    scope: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement",
    state: signedState,
    response_type: "code",
  });

  res.json({ authUrl: `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}` });
});

// ── GET /oauth/instagram/callback ─────────────────────────────────────────────
// Public — Meta redirects here; no Bearer token possible. State contains userId + expiry.

router.get("/oauth/instagram/callback", async (req: Request, res: Response): Promise<void> => {
  const { code, state, error: fbError } = req.query as Record<string, string>;
  const appUrl = getAppUrl();

  if (fbError || !code) {
    res.redirect(`${appUrl}/settings/social?error=${encodeURIComponent(fbError ?? "access_denied")}`);
    return;
  }

  const statePayload = state ? verifyOAuthState(state) : null;
  if (!statePayload) {
    res.redirect(`${appUrl}/settings/social?error=invalid_state`);
    return;
  }

  const { brandId, userId } = statePayload;

  // Verify brand still exists and belongs to the same user who initiated the flow
  const [brand] = await db
    .select({ id: brandsTable.id, ownerId: brandsTable.userId })
    .from(brandsTable)
    .where(eq(brandsTable.id, brandId))
    .limit(1);

  if (!brand) {
    res.redirect(`${appUrl}/settings/social?error=brand_not_found`);
    return;
  }

  if (brand.ownerId !== null && brand.ownerId !== userId) {
    res.redirect(`${appUrl}/settings/social?error=brand_ownership_mismatch`);
    return;
  }

  try {
    const appId = getAppId();
    const appSecret = getAppSecret();
    const callbackUrl = getCallbackUrl();

    const tokenResp = await fetch(
      `${FB_API}/oauth/access_token?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(callbackUrl)}&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(code)}`,
    );
    const tokenData = await tokenResp.json() as any;
    if (tokenData.error) throw new Error(tokenData.error.message ?? "Token exchange failed");
    const shortToken: string = tokenData.access_token;

    const longTokenResp = await fetch(
      `${FB_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(shortToken)}`,
    );
    const longTokenData = await longTokenResp.json() as any;
    if (longTokenData.error) throw new Error(longTokenData.error.message ?? "Long-lived token exchange failed");
    const userToken: string = longTokenData.access_token;
    const expiresInSec: number = longTokenData.expires_in ?? 5184000;

    const pagesResp = await fetch(`${FB_API}/me/accounts?access_token=${encodeURIComponent(userToken)}`);
    const pagesData = await pagesResp.json() as any;
    if (pagesData.error) throw new Error(pagesData.error.message ?? "Failed to fetch pages");
    const pages: Array<{ id: string; access_token: string }> = pagesData.data ?? [];

    if (!pages.length) {
      res.redirect(`${appUrl}/settings/social?error=no_facebook_pages`);
      return;
    }

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

    const usernameResp = await fetch(
      `${FB_API}/${igUserId}?fields=username&access_token=${encodeURIComponent(pageToken)}`,
    );
    const usernameData = await usernameResp.json() as any;
    igUsername = usernameData.username ?? null;

    const encryptedToken = encryptToken(pageToken);
    const tokenExpiresAt = new Date(Date.now() + expiresInSec * 1000);

    const existing = await db
      .select({ id: socialConnectionsTable.id })
      .from(socialConnectionsTable)
      .where(and(eq(socialConnectionsTable.brandId, brandId), eq(socialConnectionsTable.platform, "instagram")))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(socialConnectionsTable)
        .set({ accessToken: encryptedToken, tokenExpiresAt, igUserId, igUsername, pageId, updatedAt: new Date() })
        .where(eq(socialConnectionsTable.id, existing[0].id));
    } else {
      await db.insert(socialConnectionsTable).values({
        brandId,
        platform: "instagram",
        accessToken: encryptedToken,
        tokenExpiresAt,
        igUserId,
        igUsername,
        pageId,
      });
    }

    // Ensure brand.userId is set (in case it was null before this flow)
    if (brand.ownerId === null) {
      await db.update(brandsTable).set({ userId }).where(eq(brandsTable.id, brandId));
    }

    res.redirect(`${appUrl}/settings/social?connected=instagram&username=${encodeURIComponent(igUsername ?? "")}`);
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    res.redirect(`${appUrl}/settings/social?error=${encodeURIComponent(msg)}`);
  }
});

// ── GET /oauth/instagram/status ───────────────────────────────────────────────

router.get("/oauth/instagram/status", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const authed = req as AuthedRequest;
  const { brandId } = req.query as { brandId?: string };

  if (!brandId) {
    res.status(400).json({ error: "brandId is required" });
    return;
  }

  const owned = await verifyAndClaimBrandOwnership(brandId, authed.userId).catch(() => false);
  if (!owned) {
    res.status(403).json({ error: "You do not have access to this brand." });
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
    .where(and(eq(socialConnectionsTable.brandId, brandId), eq(socialConnectionsTable.platform, "instagram")))
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
    needsReauth: isExpired,
  });
});

// ── DELETE /oauth/instagram/disconnect ────────────────────────────────────────

router.delete("/oauth/instagram/disconnect", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const authed = req as AuthedRequest;
  const { brandId } = req.query as { brandId?: string };

  if (!brandId) {
    res.status(400).json({ error: "brandId is required" });
    return;
  }

  const owned = await verifyAndClaimBrandOwnership(brandId, authed.userId).catch(() => false);
  if (!owned) {
    res.status(403).json({ error: "You do not have access to this brand." });
    return;
  }

  await db
    .delete(socialConnectionsTable)
    .where(and(eq(socialConnectionsTable.brandId, brandId), eq(socialConnectionsTable.platform, "instagram")));

  res.json({ success: true });
});

export default router;
