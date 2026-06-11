import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, socialConnectionsTable, brandsTable, appConfigTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { encryptToken, decryptToken, signOAuthState, verifyOAuthState } from "../lib/tokenCrypto";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth";
import { resumePausedPosts } from "../lib/scheduler";

const router: IRouter = Router();

const FB_API = "https://graph.facebook.com/v19.0";

// ── Admin guard ───────────────────────────────────────────────────────────────
// Secure-by-default: OWNER_USER_ID **must** be set or the endpoint is disabled.
// Set OWNER_USER_ID to your Supabase user UUID to enable credential management.
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authed = req as AuthedRequest;
  const ownerId = process.env.OWNER_USER_ID?.trim();
  if (!ownerId) {
    res.status(503).json({
      error:
        "Meta credential management is not enabled. Set the OWNER_USER_ID environment variable to your Supabase user ID.",
    });
    return;
  }
  if (authed.userId !== ownerId) {
    res.status(403).json({ error: "Admin access required to configure Meta app credentials." });
    return;
  }
  next();
}

// ── Meta app credential helpers (env → DB fallback) ───────────────────────────

async function getAppId(): Promise<string> {
  if (process.env.META_APP_ID) return process.env.META_APP_ID;
  const [row] = await db
    .select({ value: appConfigTable.value })
    .from(appConfigTable)
    .where(eq(appConfigTable.key, "META_APP_ID"))
    .limit(1);
  if (row?.value) return row.value;
  throw new Error("META_APP_ID is not configured");
}

async function getAppSecret(): Promise<string> {
  if (process.env.META_APP_SECRET) return process.env.META_APP_SECRET;
  const [row] = await db
    .select({ value: appConfigTable.value })
    .from(appConfigTable)
    .where(eq(appConfigTable.key, "META_APP_SECRET"))
    .limit(1);
  if (row?.value) return decryptToken(row.value);
  throw new Error("META_APP_SECRET is not configured");
}

async function isMetaConfigured(): Promise<{ configured: boolean; source: "env" | "db" | null }> {
  if (process.env.META_APP_ID && process.env.META_APP_SECRET) {
    return { configured: true, source: "env" };
  }
  const rows = await db
    .select({ key: appConfigTable.key })
    .from(appConfigTable)
    .where(eq(appConfigTable.key, "META_APP_ID"));
  const hasDbId = rows.length > 0;
  const rows2 = await db
    .select({ key: appConfigTable.key })
    .from(appConfigTable)
    .where(eq(appConfigTable.key, "META_APP_SECRET"));
  const hasDbSecret = rows2.length > 0;
  if (hasDbId && hasDbSecret) return { configured: true, source: "db" };
  return { configured: false, source: null };
}

function getAppUrl() {
  return (process.env.APP_URL ?? "https://zuri-insight-seunalla22.replit.app").replace(/\/$/, "");
}

function getCallbackUrl() {
  return `${getAppUrl()}/api/oauth/instagram/callback`;
}

/**
 * Verify ownership and auto-claim unowned (legacy) brands.
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

  const claimed = await db
    .update(brandsTable)
    .set({ userId })
    .where(and(eq(brandsTable.id, brandId), isNull(brandsTable.userId)))
    .returning({ id: brandsTable.id });

  return claimed.length > 0;
}


// ── GET /oauth/meta-config/status ─────────────────────────────────────────────

router.get("/oauth/meta-config/status", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const authed = req as AuthedRequest;
    const ownerId = process.env.OWNER_USER_ID?.trim();
    const isAdmin = !!ownerId && authed.userId === ownerId;
    const result = await isMetaConfigured();
    res.json({ ...result, isAdmin });
  } catch {
    res.json({ configured: false, source: null, isAdmin: false });
  }
});

// ── POST /oauth/meta-config ────────────────────────────────────────────────────

router.post("/oauth/meta-config", requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { appId, appSecret } = req.body as { appId?: string; appSecret?: string };

  if (!appId?.trim() || !appSecret?.trim()) {
    res.status(400).json({ error: "Both appId and appSecret are required" });
    return;
  }

  const trimmedId = appId.trim();
  const trimmedSecret = appSecret.trim();

  const encryptedSecret = encryptToken(trimmedSecret);

  await db
    .insert(appConfigTable)
    .values({ key: "META_APP_ID", value: trimmedId })
    .onConflictDoUpdate({ target: appConfigTable.key, set: { value: trimmedId, updatedAt: new Date() } });

  await db
    .insert(appConfigTable)
    .values({ key: "META_APP_SECRET", value: encryptedSecret })
    .onConflictDoUpdate({ target: appConfigTable.key, set: { value: encryptedSecret, updatedAt: new Date() } });

  // Sync to in-memory env so credentials are usable immediately without restart.
  // getAppId() / getAppSecret() check process.env first, so setting these here
  // means the very next connect-url request will find them without a DB lookup.
  process.env.META_APP_ID = trimmedId;
  process.env.META_APP_SECRET = trimmedSecret;

  res.json({ success: true });
});

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
    appId = await getAppId();
  } catch {
    res.status(500).json({ error: "META_APP_ID is not configured. Please set it up in Social Accounts settings." });
    return;
  }

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
    const appId = await getAppId();
    const appSecret = await getAppSecret();
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

    if (brand.ownerId === null) {
      await db.update(brandsTable).set({ userId }).where(eq(brandsTable.id, brandId));
    }

    const resumedCount = await resumePausedPosts(brandId).catch(() => 0);
    const resumedParam = resumedCount > 0 ? `&resumed=${resumedCount}` : "";

    res.redirect(`${appUrl}/settings/social?connected=instagram&username=${encodeURIComponent(igUsername ?? "")}${resumedParam}`);
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

  const now = new Date();
  const isExpired = conn.tokenExpiresAt ? conn.tokenExpiresAt < now : false;
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const expiringSoon = !isExpired && conn.tokenExpiresAt != null && conn.tokenExpiresAt < sevenDaysFromNow;
  res.json({
    connected: !isExpired,
    username: conn.igUsername,
    expiresAt: conn.tokenExpiresAt,
    connectedAt: conn.createdAt,
    needsReauth: isExpired,
    expiringSoon,
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
