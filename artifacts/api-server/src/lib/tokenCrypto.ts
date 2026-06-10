import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";

function getCryptoKey(): Buffer {
  const raw = process.env.SOCIAL_TOKEN_KEY ?? "";
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SOCIAL_TOKEN_KEY is not set — required for token encryption in production");
    }
    return Buffer.alloc(32, "zuri-dev-key-placeholder-000000");
  }
  const buf = Buffer.from(raw, "utf8");
  return buf.length >= 32 ? buf.subarray(0, 32) : Buffer.concat([buf, Buffer.alloc(32 - buf.length)]);
}

function getHmacKey(): string {
  return process.env.SOCIAL_TOKEN_KEY ?? "zuri-dev-hmac-key";
}

export function encryptToken(plaintext: string): string {
  const key = getCryptoKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${authTag.toString("hex")}`;
}

export function decryptToken(ciphertext: string): string {
  const key = getCryptoKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid ciphertext format");
  const [ivHex, encHex, tagHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function signOAuthState(brandId: string, userId: string): string {
  const nonce = randomBytes(8).toString("hex");
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = `${brandId}:${userId}:${nonce}:${issuedAt}`;
  const sig = createHmac("sha256", getHmacKey()).update(payload).digest("hex").slice(0, 24);
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyOAuthState(
  state: string,
  maxAgeSec = 3600,
): { brandId: string; userId: string } | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    // Format: <brandUUID>:<userUUID>:<nonce16>:<issuedAt>:<sig24>
    // UUIDs contain hyphens but never colons, so splitting by ":" gives exactly 5 parts.
    const parts = decoded.split(":");
    if (parts.length !== 5) return null;
    const [brandId, userId, nonce, issuedAtStr, sig] = parts;
    const payload = `${brandId}:${userId}:${nonce}:${issuedAtStr}`;
    const expected = createHmac("sha256", getHmacKey()).update(payload).digest("hex").slice(0, 24);
    if (sig !== expected) return null;
    const age = Math.floor(Date.now() / 1000) - parseInt(issuedAtStr, 10);
    if (age > maxAgeSec || age < 0) return null;
    return { brandId, userId };
  } catch {
    return null;
  }
}
