import { type Request, type Response, type NextFunction } from "express";

const SUPABASE_URL = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export interface AuthedRequest extends Request {
  userId: string;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required. Pass Authorization: Bearer <token> header." });
    return;
  }
  const token = authHeader.slice(7).trim();

  if (!SUPABASE_URL) {
    res.status(500).json({ error: "SUPABASE_URL is not configured on the server." });
    return;
  }

  try {
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_SERVICE_KEY,
      },
    });

    if (!resp.ok) {
      res.status(401).json({ error: "Invalid or expired authentication token." });
      return;
    }

    const user = await resp.json() as { id?: string };
    if (!user?.id) {
      res.status(401).json({ error: "Could not identify user from token." });
      return;
    }

    (req as AuthedRequest).userId = user.id;
    next();
  } catch {
    res.status(401).json({ error: "Authentication verification failed." });
  }
}
