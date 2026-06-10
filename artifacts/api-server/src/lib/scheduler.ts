import { db, scheduledPostsTable, socialConnectionsTable } from "@workspace/db";
import { and, eq, lte } from "drizzle-orm";
import { publishToInstagram, InstagramPublishError } from "./instagramPublish";
import { decryptToken } from "./tokenCrypto";
import { uploadImageForInstagram } from "./objectStorage";
import { logger } from "./logger";

const POLL_INTERVAL_MS = 60_000;
const TOKEN_EXPIRED_CODE = "190";

let running = false;

async function processDuePosts() {
  const now = new Date();

  const duePosts = await db
    .select()
    .from(scheduledPostsTable)
    .where(
      and(
        eq(scheduledPostsTable.status, "scheduled"),
        lte(scheduledPostsTable.scheduledFor, now),
        eq(scheduledPostsTable.platform, "instagram"),
      ),
    )
    .limit(20);

  if (!duePosts.length) return;

  logger.info({ count: duePosts.length }, "Scheduler: processing due Instagram posts");

  for (const post of duePosts) {
    await processPost(post);
  }
}

async function processPost(post: typeof scheduledPostsTable.$inferSelect) {
  try {
    const [conn] = await db
      .select()
      .from(socialConnectionsTable)
      .where(
        and(
          eq(socialConnectionsTable.brandId, post.brandId),
          eq(socialConnectionsTable.platform, "instagram"),
        ),
      )
      .limit(1);

    if (!conn) {
      await markFailed(post.id, "Instagram account not connected. Go to Settings > Social to connect.");
      return;
    }

    if (conn.tokenExpiresAt && conn.tokenExpiresAt < new Date()) {
      await markFailed(post.id, "Instagram access token has expired. Please reconnect in Settings > Social.");
      return;
    }

    if (!conn.igUserId) {
      await markFailed(post.id, "Instagram user ID missing. Please reconnect in Settings > Social.");
      return;
    }

    const rawMedia = (post.mediaUrls as string[] | null)?.[0];
    if (!rawMedia) {
      await markFailed(post.id, "No image URL found for this post. Attach an image when scheduling.");
      return;
    }

    let imageUrl: string;
    if (rawMedia.startsWith("data:")) {
      try {
        imageUrl = await uploadImageForInstagram(rawMedia);
        logger.info({ postId: post.id }, "Scheduler: uploaded creative image to storage");
      } catch (uploadErr: any) {
        await markFailed(
          post.id,
          `Failed to upload creative image: ${uploadErr?.message ?? "Check object storage configuration."}`,
        );
        return;
      }
    } else {
      imageUrl = rawMedia;
    }

    let accessToken: string;
    try {
      accessToken = decryptToken(conn.accessToken);
    } catch {
      await markFailed(post.id, "Failed to decrypt Instagram access token. Please reconnect in Settings > Social.");
      return;
    }

    const { postId } = await publishToInstagram({
      igUserId: conn.igUserId,
      accessToken,
      imageUrl,
      caption: post.caption ?? "",
    });

    await db
      .update(scheduledPostsTable)
      .set({
        status: "published",
        platformPostId: postId,
        publishedAt: new Date(),
        errorMessage: null,
      })
      .where(eq(scheduledPostsTable.id, post.id));

    logger.info({ postId: post.id, igPostId: postId }, "Scheduler: Instagram post published");
  } catch (err: any) {
    const message =
      err instanceof InstagramPublishError
        ? `Instagram API error: ${err.message}`
        : `Unexpected error: ${err?.message ?? "Unknown error"}`;

    logger.error({ err, postId: post.id }, `Scheduler: failed to publish post — ${message}`);

    if (err instanceof InstagramPublishError && err.code === TOKEN_EXPIRED_CODE) {
      await db
        .update(socialConnectionsTable)
        .set({ tokenExpiresAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(socialConnectionsTable.brandId, post.brandId),
            eq(socialConnectionsTable.platform, "instagram"),
          ),
        );
      logger.warn({ postId: post.id }, "Scheduler: marked Instagram token as expired");
    }

    await markFailed(post.id, message);
  }
}

async function markFailed(postId: string, errorMessage: string) {
  await db
    .update(scheduledPostsTable)
    .set({ status: "failed", errorMessage })
    .where(eq(scheduledPostsTable.id, postId));
}

export function startScheduler() {
  if (running) return;
  running = true;

  logger.info("Scheduler: started (60s interval)");

  setInterval(() => {
    processDuePosts().catch((err) => {
      logger.error({ err }, "Scheduler: unhandled error in processDuePosts");
    });
  }, POLL_INTERVAL_MS);

  processDuePosts().catch((err) => {
    logger.error({ err }, "Scheduler: initial run failed");
  });
}
