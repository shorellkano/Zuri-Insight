import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Instagram,
  Link2,
  Link2Off,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
  Settings2,
  ExternalLink,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Shield,
  Trash2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBrand } from "@/context/brand-context";
import { useListBrands } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

const API = (path: string) => `/api${path}`;

interface IGStatus {
  connected: boolean;
  username?: string;
  expiresAt?: string;
  connectedAt?: string;
  needsReauth?: boolean;
  expiringSoon?: boolean;
}

interface MetaConfigStatus {
  configured: boolean;
  source: "env" | "db" | null;
  isAdmin: boolean;
}

const META_STEPS = [
  {
    title: "Go to Meta for Developers",
    description: (
      <>
        Visit{" "}
        <a
          href="https://developers.facebook.com/apps"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline inline-flex items-center gap-0.5"
        >
          developers.facebook.com/apps <ExternalLink className="h-3 w-3" />
        </a>{" "}
        and click <strong>Create App</strong>.
      </>
    ),
  },
  {
    title: "Choose app type",
    description: (
      <>
        Select <strong>Business</strong> as the app type, then click <strong>Next</strong> and fill in a name and contact email.
      </>
    ),
  },
  {
    title: "Add Instagram product",
    description: (
      <>
        In your new app's dashboard, find <strong>Instagram Graph API</strong> in the product list and click <strong>Set Up</strong>.
      </>
    ),
  },
  {
    title: "Copy your credentials",
    description: (
      <>
        Go to <strong>App Settings → Basic</strong>. Copy the <strong>App ID</strong> and <strong>App Secret</strong> and paste them below.
      </>
    ),
  },
  {
    title: "Add the OAuth redirect URI",
    description: (
      <>
        Still in your app, go to <strong>Facebook Login → Settings</strong> and add this exact URL to <strong>Valid OAuth Redirect URIs</strong>:
        <code className="ml-1 px-1.5 py-0.5 rounded bg-muted text-xs font-mono break-all">
          {window.location.origin}/api/oauth/instagram/callback
        </code>
      </>
    ),
  },
];

export default function SettingsSocial() {
  const { activeBrandId } = useBrand();
  const { data: brands } = useListBrands();
  const activeBrand = brands?.find((b) => b.id === activeBrandId);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [location] = useLocation();
  const { session } = useAuth();

  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [connecting, setConnecting] = useState(false);

  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  function authHeaders(): HeadersInit {
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const username = params.get("username");
    const resumed = params.get("resumed");
    const error = params.get("error");
    if (connected === "instagram") {
      const resumedText = resumed && parseInt(resumed) > 0
        ? ` ${parseInt(resumed) === 1 ? "1 paused post has been rescheduled." : `${resumed} paused posts have been rescheduled.`}`
        : "";
      setBannerMsg({
        type: "success",
        text: (username ? `Instagram connected as @${username}.` : "Instagram connected successfully.") + resumedText,
      });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (error) {
      const errorMessages: Record<string, string> = {
        no_facebook_pages:
          "No Facebook Pages found. Make sure you have a Facebook Page linked to your Instagram Business account.",
        no_instagram_business_account:
          "No Instagram Business Account found. Your Instagram account must be a Business or Creator account linked to a Facebook Page.",
        missing_brand: "Brand not found. Please try again.",
        access_denied: "Access was denied. Please try again and grant all requested permissions.",
        invalid_state: "Invalid session state. Please try connecting again.",
      };
      setBannerMsg({
        type: "error",
        text: errorMessages[error] ?? decodeURIComponent(error),
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const { data: metaConfig, isLoading: metaConfigLoading } = useQuery<MetaConfigStatus>({
    queryKey: ["meta-config-status"],
    queryFn: async () => {
      const r = await fetch(API("/oauth/meta-config/status"), { headers: authHeaders() });
      if (!r.ok) return { configured: false, source: null };
      return r.json();
    },
    enabled: !!session,
    staleTime: 30000,
  });

  const { data: igStatus, isLoading: statusLoading } = useQuery<IGStatus>({
    queryKey: ["ig-status", activeBrandId],
    queryFn: async () => {
      const r = await fetch(API(`/oauth/instagram/status?brandId=${activeBrandId}`), {
        headers: authHeaders(),
      });
      if (!r.ok) throw new Error("Failed to fetch status");
      return r.json();
    },
    enabled: !!activeBrandId && !!session,
    staleTime: 30000,
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(API(`/oauth/instagram/disconnect?brandId=${activeBrandId}`), {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to disconnect");
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ig-status", activeBrandId] });
      toast({ title: "Instagram disconnected" });
    },
    onError: (err: any) => {
      toast({ title: err?.message ?? "Failed to disconnect", variant: "destructive" });
    },
  });

  const handleConnect = async () => {
    if (!activeBrandId) {
      toast({ title: "Select a brand first", variant: "destructive" });
      return;
    }
    if (!session?.access_token) {
      toast({ title: "You must be signed in to connect Instagram", variant: "destructive" });
      return;
    }
    setConnecting(true);
    try {
      const r = await fetch(API(`/oauth/instagram/connect-url?brandId=${activeBrandId}`), {
        headers: authHeaders(),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        toast({ title: data?.error ?? "Failed to start Instagram connection", variant: "destructive" });
        return;
      }
      const { authUrl } = await r.json();
      window.location.href = authUrl;
    } catch {
      toast({ title: "Failed to start Instagram connection", variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!appId.trim() || !appSecret.trim()) {
      toast({ title: "Both App ID and App Secret are required", variant: "destructive" });
      return;
    }
    setSavingConfig(true);
    try {
      const r = await fetch(API("/oauth/meta-config"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ appId: appId.trim(), appSecret: appSecret.trim() }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        toast({ title: data?.error ?? "Failed to save credentials", variant: "destructive" });
        return;
      }
      toast({ title: "Meta app credentials saved successfully" });
      setAppId("");
      setAppSecret("");
      setShowSetupGuide(false);
      qc.invalidateQueries({ queryKey: ["meta-config-status"] });
    } catch {
      toast({ title: "Failed to save credentials", variant: "destructive" });
    } finally {
      setSavingConfig(false);
    }
  };

  const removeConfigMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(API("/oauth/meta-config"), {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to remove credentials");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Meta app credentials removed" });
      setConfirmRemove(false);
      setShowSetupGuide(false);
      qc.invalidateQueries({ queryKey: ["meta-config-status"] });
    },
    onError: (err: any) => {
      toast({ title: err?.message ?? "Failed to remove credentials", variant: "destructive" });
      setConfirmRemove(false);
    },
  });

  const metaNotConfigured = !metaConfigLoading && metaConfig && !metaConfig.configured;
  const isAdmin = metaConfig?.isAdmin ?? false;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Social Accounts</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Connect your social media accounts to enable auto-publishing.
        </p>
      </div>

      {bannerMsg && (
        <div
          className={cn(
            "flex items-start gap-3 p-4 rounded-xl border text-sm",
            bannerMsg.type === "success"
              ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800/40 dark:text-green-400"
              : "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800/40 dark:text-red-400",
          )}
        >
          {bannerMsg.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <p>{bannerMsg.text}</p>
        </div>
      )}

      {!activeBrandId && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Select an active brand from the top bar to connect social accounts.
          </p>
        </div>
      )}

      {metaNotConfigured && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl overflow-hidden">
          <div className="p-5 flex items-start gap-3">
            <Settings2 className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Meta app credentials required</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                {isAdmin
                  ? "Instagram OAuth requires a Meta Developer App. Set up yours in a few steps to unlock Instagram connection."
                  : "Instagram OAuth requires a Meta Developer App to be configured by your account admin."}
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowSetupGuide((v) => !v)}
                className="flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 transition-colors shrink-0"
              >
                {showSetupGuide ? "Hide" : "Set up"}
                {showSetupGuide ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>

          {isAdmin && showSetupGuide && (
            <div className="border-t border-amber-200 dark:border-amber-800/40 p-5 space-y-6 bg-card">
              <div className="space-y-4">
                <p className="text-sm font-semibold text-foreground">How to create a Meta Developer App</p>
                <ol className="space-y-4">
                  {META_STEPS.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-foreground">{step.title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  Your credentials are encrypted before being stored.
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-foreground">
                    App ID <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="e.g. 1234567890123456"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-foreground">
                    App Secret <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showSecret ? "text" : "password"}
                      value={appSecret}
                      onChange={(e) => setAppSecret(e.target.value)}
                      placeholder="Paste your App Secret here"
                      className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleSaveConfig}
                  disabled={savingConfig || !appId.trim() || !appSecret.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {savingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                  Save Credentials
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {metaConfig?.configured && metaConfig.source === "db" && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">Meta app credentials configured</p>
              <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">Your Meta Developer App credentials are saved and ready.</p>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => { setShowSetupGuide((v) => !v); setConfirmRemove(false); }}
                  className="text-xs font-medium text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-200 transition-colors flex items-center gap-1"
                >
                  Update
                  {showSetupGuide ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => { setConfirmRemove(true); setShowSetupGuide(false); }}
                  className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            )}
          </div>

          {isAdmin && confirmRemove && (
            <div className="border-t border-green-200 dark:border-green-800/40 p-4 bg-red-50 dark:bg-red-900/20 flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">Remove Meta app credentials?</p>
                <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                  This will delete both the App ID and App Secret. Instagram connections will stop working until new credentials are added.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => removeConfigMutation.mutate()}
                    disabled={removeConfigMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {removeConfigMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Yes, remove credentials
                  </button>
                  <button
                    onClick={() => setConfirmRemove(false)}
                    disabled={removeConfigMutation.isPending}
                    className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {metaConfig?.configured && metaConfig.source === "db" && isAdmin && showSetupGuide && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">Update Meta app credentials</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5 text-green-500 shrink-0" />
            Saving new credentials will overwrite the existing ones.
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-foreground">App ID <span className="text-destructive">*</span></label>
            <input
              type="text"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="e.g. 1234567890123456"
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-foreground">App Secret <span className="text-destructive">*</span></label>
            <div className="relative">
              <input
                type={showSecret ? "text" : "password"}
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                placeholder="Paste your App Secret here"
                className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button
            onClick={handleSaveConfig}
            disabled={savingConfig || !appId.trim() || !appSecret.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {savingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            Update Credentials
          </button>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400 flex items-center justify-center">
              <Instagram className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Instagram</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Auto-publish feed posts directly to your business account
              </p>
            </div>
          </div>

          {statusLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : igStatus?.connected ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Connected
              </span>
              {igStatus.expiringSoon && (
                <button
                  onClick={handleConnect}
                  disabled={!activeBrandId || connecting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/40 transition-colors disabled:opacity-50"
                >
                  {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                  Refresh token
                </button>
              )}
              <button
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending || !activeBrandId}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors disabled:opacity-50"
              >
                <Link2Off className="h-3.5 w-3.5" />
                Disconnect
              </button>
            </div>
          ) : igStatus?.needsReauth ? (
            <button
              onClick={handleConnect}
              disabled={!activeBrandId || connecting || metaNotConfigured === true}
              title={metaNotConfigured ? "Set up Meta app credentials first" : undefined}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Reconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={!activeBrandId || connecting || metaNotConfigured === true}
              title={metaNotConfigured ? "Set up Meta app credentials first" : undefined}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Connect
            </button>
          )}
        </div>

        {igStatus?.needsReauth && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Token expired</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  Scheduled posts have been paused. Reconnect to resume publishing.
                </p>
              </div>
            </div>
          </div>
        )}

        {igStatus?.expiringSoon && !igStatus?.needsReauth && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Token expiring soon</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  Your access token expires on {igStatus.expiresAt ? new Date(igStatus.expiresAt).toLocaleDateString() : "soon"}. Refresh it now to avoid interruptions.
                </p>
              </div>
            </div>
          </div>
        )}

        {igStatus?.connected && igStatus.username && (
          <div className="mt-4 pt-4 border-t border-border flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400 flex items-center justify-center text-white text-xs font-bold">
              {igStatus.username[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">@{igStatus.username}</p>
              {igStatus.expiresAt && (
                <p className="text-xs text-muted-foreground">
                  Token expires {new Date(igStatus.expiresAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        )}

        {!igStatus?.connected && !igStatus?.needsReauth && (
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Requirements</p>
            <ul className="space-y-1.5">
              {[
                "An Instagram Business or Creator account",
                "A Facebook Page linked to your Instagram account",
                "Admin access to the Facebook Page",
              ].map((req) => (
                <li key={req} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 mt-1.5 shrink-0" />
                  {req}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 opacity-50">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm">f</div>
          <div>
            <h2 className="font-semibold text-foreground">Facebook</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Coming soon</p>
          </div>
          <span className="ml-auto text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full font-medium">Soon</span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 opacity-50">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-sky-600 flex items-center justify-center text-white text-xs font-bold">in</div>
          <div>
            <h2 className="font-semibold text-foreground">LinkedIn</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Coming soon</p>
          </div>
          <span className="ml-auto text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full font-medium">Soon</span>
        </div>
      </div>
    </div>
  );
}
