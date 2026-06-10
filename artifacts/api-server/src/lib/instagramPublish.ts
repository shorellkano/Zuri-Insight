const IG_API = "https://graph.facebook.com/v19.0";

export interface IGPublishResult {
  postId: string;
}

export class InstagramPublishError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "InstagramPublishError";
  }
}

async function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function pollContainerStatus(
  containerId: string,
  accessToken: string,
  maxAttempts = 10,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(2000);
    const r = await fetch(
      `${IG_API}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`,
    );
    const data = await r.json();
    if (data.error) {
      throw new InstagramPublishError(
        data.error.message ?? "Error checking container status",
        data.error.code?.toString(),
      );
    }
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR" || data.status_code === "EXPIRED") {
      throw new InstagramPublishError(`Container failed with status: ${data.status_code}`);
    }
  }
  throw new InstagramPublishError("Timed out waiting for media container to be ready");
}

export async function publishToInstagram({
  igUserId,
  accessToken,
  imageUrl,
  caption,
}: {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
}): Promise<IGPublishResult> {
  const createParams = new URLSearchParams({
    image_url: imageUrl,
    caption,
    access_token: accessToken,
  });

  const createResp = await fetch(`${IG_API}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: createParams.toString(),
  });

  const createData = await createResp.json();
  if (createData.error) {
    throw new InstagramPublishError(
      createData.error.message ?? "Failed to create media container",
      createData.error.code?.toString(),
    );
  }

  const containerId: string = createData.id;
  if (!containerId) {
    throw new InstagramPublishError("No container ID returned by Instagram API");
  }

  await pollContainerStatus(containerId, accessToken);

  const publishParams = new URLSearchParams({
    creation_id: containerId,
    access_token: accessToken,
  });

  const publishResp = await fetch(`${IG_API}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: publishParams.toString(),
  });

  const publishData = await publishResp.json();
  if (publishData.error) {
    throw new InstagramPublishError(
      publishData.error.message ?? "Failed to publish media container",
      publishData.error.code?.toString(),
    );
  }

  return { postId: publishData.id };
}
