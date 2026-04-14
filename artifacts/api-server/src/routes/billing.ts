import { Router } from "express";
import crypto from "crypto";

const router = Router();

// ─── Paystack plan codes ──────────────────────────────────────────────────────
// Create these in dashboard.paystack.com → Subscriptions → Plans
// Then replace PLN_xxxx with the real codes
const PAYSTACK_PLAN_CODES: Record<string, string> = {
  solo_monthly_africa:   "PLN_1xkj0lqmf7ber7c",
  solo_annual_africa:    "PLN_sn2z5po8u5k6vfq",
  growth_monthly_africa: "PLN_ruk7ihis1gj9c5q",
  growth_annual_africa:  "PLN_5n7la7ekszv8ucj",
  studio_monthly_africa: "PLN_sn2z5po8u5k6vfq",
  studio_annual_africa:  "PLN_asfwfv5nsw7cy2x",
};

// Amounts in kobo (NGN x 100) — must match your Paystack plan amounts exactly
const PAYSTACK_AMOUNTS_KOBO: Record<string, number> = {
  solo_monthly_africa:   950000,
  solo_annual_africa:    9500400,
  growth_monthly_africa: 2400000,
  growth_annual_africa:  24000000,
  studio_monthly_africa: 5500000,
  studio_annual_africa:  54999600,
};

// ─── Stripe price IDs ─────────────────────────────────────────────────────────
// Create these in dashboard.stripe.com → Products
// Then replace price_xxxx with the real IDs
const STRIPE_PRICE_IDS: Record<string, string> = {
  solo_monthly_global: "price_xxxx",
  solo_annual_global: "price_xxxx",
  growth_monthly_global: "price_xxxx",
  growth_annual_global: "price_xxxx",
  studio_monthly_global: "price_xxxx",
  studio_annual_global: "price_xxxx",
};

// ─── Supabase admin helper ────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function supabaseAdmin(
  method: string,
  path: string,
  body?: object
): Promise<any> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  const resp = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (resp.status === 204) return {};
  return resp.json();
}

async function getProfile(userId: string): Promise<any> {
  const rows = await supabaseAdmin("GET", `/profiles?id=eq.${userId}&select=*`);
  return Array.isArray(rows) ? rows[0] : null;
}

async function updateProfile(userId: string, data: object): Promise<void> {
  await supabaseAdmin("PATCH", `/profiles?id=eq.${userId}`, data);
}

async function insertSubscriptionEvent(data: object): Promise<void> {
  await supabaseAdmin("POST", "/subscription_events", data);
}

// ─── POST /billing/create-checkout ────────────────────────────────────────────
router.post("/billing/create-checkout", async (req, res): Promise<void> => {
  const { planId, billingCycle, userId, isAfrica } = req.body;

  if (!planId || !billingCycle) {
    res.status(400).json({ error: "planId and billingCycle are required" });
    return;
  }

  const cycle = billingCycle === "annual" ? "annual" : "monthly";
  const region = isAfrica ? "africa" : "global";
  const key = `${planId}_${cycle}_${region}`;

  if (isAfrica) {
    const planCode = PAYSTACK_PLAN_CODES[key];
    if (!planCode || planCode === "PLN_xxxx") {
      res.status(400).json({
        error: "Paystack plans are not configured yet. Please contact support or check back soon.",
      });
      return;
    }

    const paystackKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackKey) {
      res.status(500).json({ error: "Payment provider not configured." });
      return;
    }

    try {
      const reference = `zuri_${userId || "guest"}_${Date.now()}`;
      const profile = userId ? await getProfile(userId) : null;
      const email = profile?.email || req.body.email || "unknown@zuriai.co";

      const amountKobo = PAYSTACK_AMOUNTS_KOBO[key] ?? 950000;
      const apiResp = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: amountKobo,
          plan: planCode,
          reference,
          metadata: { userId: userId || "", planId, billingCycle: cycle },
          callback_url: `${process.env.APP_URL || ""}/settings/billing?success=true`,
        }),
      });
      const data = await apiResp.json();
      if (!data.status) throw new Error(data.message || "Paystack init failed");
      res.json({ url: data.data.authorization_url, provider: "paystack", reference: data.data.reference });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Checkout failed" });
    }
    return;
  }

  // Stripe (global)
  const priceId = STRIPE_PRICE_IDS[key];
  if (!priceId || priceId === "price_xxxx") {
    res.status(400).json({
      error: "Stripe prices are not configured yet. Please contact support or check back soon.",
    });
    return;
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    res.status(500).json({ error: "Payment provider not configured." });
    return;
  }

  try {
    const profile = userId ? await getProfile(userId) : null;
    const email = profile?.email || req.body.email;
    const appUrl = process.env.APP_URL || "";

    const params = new URLSearchParams();
    params.append("mode", "subscription");
    if (email) params.append("customer_email", email);
    params.append("line_items[0][price]", priceId);
    params.append("line_items[0][quantity]", "1");
    params.append("success_url", `${appUrl}/settings/billing?success=true`);
    params.append("cancel_url", `${appUrl}/settings/billing?cancelled=true`);
    if (userId) params.append("metadata[userId]", userId);
    if (userId) params.append("subscription_data[metadata][userId]", userId);

    const sessionResp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const session = await sessionResp.json();
    if (session.error) throw new Error(session.error.message);
    res.json({ url: session.url, provider: "stripe" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Checkout failed" });
  }
});

// ─── POST /billing/portal ──────────────────────────────────────────────────────
router.post("/billing/portal", async (req, res): Promise<void> => {
  const { userId } = req.body;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeKey || !userId) {
    res.status(400).json({ error: "Stripe not configured or userId missing." });
    return;
  }

  const profile = await getProfile(userId);
  if (!profile?.stripe_customer_id) {
    res.status(400).json({ error: "No Stripe customer found for this account." });
    return;
  }

  try {
    const params = new URLSearchParams();
    params.append("customer", profile.stripe_customer_id);
    params.append("return_url", `${process.env.APP_URL || ""}/settings/billing`);

    const portalResp = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const session = await portalResp.json();
    if (session.error) throw new Error(session.error.message);
    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /billing/history ──────────────────────────────────────────────────────
router.get("/billing/history", async (req, res): Promise<void> => {
  const userId = req.query.userId as string;
  if (!userId) {
    res.json({ events: [] });
    return;
  }
  const events = await supabaseAdmin(
    "GET",
    `/subscription_events?user_id=eq.${userId}&order=created_at.desc&limit=20`
  );
  res.json({ events: Array.isArray(events) ? events : [] });
});

// ─── POST /billing/webhooks/paystack ──────────────────────────────────────────
router.post("/billing/webhooks/paystack", async (req, res): Promise<void> => {
  const signature = req.headers["x-paystack-signature"] as string;
  const paystackKey = process.env.PAYSTACK_SECRET_KEY;

  if (paystackKey) {
    const raw = JSON.stringify(req.body);
    const hash = crypto.createHmac("sha512", paystackKey).update(raw).digest("hex");
    if (hash !== signature) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }
  }

  const event = req.body;

  if (event.event === "subscription.create" || event.event === "charge.success") {
    const data = event.data;
    const userId = data.metadata?.userId;
    const planCode = data.plan?.plan_code;

    const PLAN_FROM_CODE: Record<string, string> = Object.fromEntries(
      Object.entries(PAYSTACK_PLAN_CODES)
        .filter(([k]) => k.endsWith("_africa"))
        .map(([k, v]) => [v, k.split("_")[0]])
    );
    const planId = PLAN_FROM_CODE[planCode];

    if (userId && planId) {
      await updateProfile(userId, {
        plan: planId,
        subscription_id: data.subscription_code,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        billing_cycle: "monthly",
      });
      await insertSubscriptionEvent({
        user_id: userId,
        event_type: event.event,
        plan: planId,
        amount: (data.amount || 0) / 100,
        currency: "NGN",
        provider: "paystack",
        provider_ref: data.reference,
        metadata: data,
      });
    }
  }

  if (event.event === "subscription.disable") {
    const userId = event.data.metadata?.userId;
    if (userId) {
      await updateProfile(userId, { plan: "free", subscription_id: null });
    }
  }

  res.json({ received: true });
});

// ─── POST /billing/webhooks/stripe ────────────────────────────────────────────
router.post("/billing/webhooks/stripe", async (req, res): Promise<void> => {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  let event: any;

  if (webhookSecret && stripeKey) {
    try {
      const payload = JSON.stringify(req.body);
      const parts = sig.split(",");
      const timestamp = parts.find(p => p.startsWith("t="))?.split("=")[1];
      const signed = `${timestamp}.${payload}`;
      const expectedSig = crypto
        .createHmac("sha256", webhookSecret)
        .update(signed)
        .digest("hex");
      const receivedSig = parts.find(p => p.startsWith("v1="))?.split("=")[1];
      if (expectedSig !== receivedSig) {
        res.status(400).json({ error: "Invalid signature" });
        return;
      }
    } catch {
      res.status(400).json({ error: "Webhook error" });
      return;
    }
  }

  event = req.body;
  const PLAN_FROM_PRICE: Record<string, string> = Object.fromEntries(
    Object.entries(STRIPE_PRICE_IDS).map(([k, v]) => [v, k.split("_")[0]])
  );

  if (event.type === "checkout.session.completed") {
    const session = event.data?.object;
    const userId = session?.metadata?.userId;
    const priceId = session?.line_items?.data?.[0]?.price?.id;
    const planId = PLAN_FROM_PRICE[priceId] || "solo";

    if (userId) {
      await updateProfile(userId, {
        plan: planId,
        stripe_customer_id: session.customer,
        subscription_id: session.subscription,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
      await insertSubscriptionEvent({
        user_id: userId,
        event_type: "subscription.create",
        plan: planId,
        amount: (session.amount_total || 0) / 100,
        currency: (session.currency || "usd").toUpperCase(),
        provider: "stripe",
        provider_ref: session.id,
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data?.object;
    const userId = sub?.metadata?.userId;
    if (userId) {
      await updateProfile(userId, { plan: "free", subscription_id: null });
    }
  }

  res.json({ received: true });
});

export default router;
