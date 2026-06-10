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

export function signOAuthState(brandId: string): string {
  const nonce = randomBytes(8).toString("hex");
  const payload = `${brandId}:${nonce}`;
  const sig = createHmac("sha256", getHmacKey()).update(payload).digest("hex").slice(0, 24);
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyOAuthState(state: string): string | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    const secondLastColon = decoded.lastIndexOf(":", lastColon - 1);
    if (secondLastColon === -1 || lastColon === -1) return null;
    const brandId = decoded.slice(0, secondLastColon);
    const nonce = decoded.slice(secondLastColon + 1, lastColon);
    const sig = decoded.slice(lastColon + 1);
    const payload = `${brandId}:${nonce}`;
    const expected = createHmac("sha256", getHmacKey()).update(payload).digest("hex").slice(0, 24);
    if (sig !== expected) return null;
    return brandId;
  } catch {
    return null;
  }
}
