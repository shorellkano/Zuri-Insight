import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Instagram, Link2, Link2Off, CheckCircle2, AlertCircle, Loader2, Info } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBrand } from "@/context/brand-context";
import { useListBrands } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const API = (path: string) => `/api${path}`;

interface IGStatus {
  connected: boolean;
  username?: string;
  expiresAt?: string;
  connectedAt?: string;
}

export default function SettingsSocial() {
  const { activeBrandId } = useBrand();
  const { data: brands } = useListBrands();
  const activeBrand = brands?.find((b) => b.id === activeBrandId);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [location] = useLocation();

  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const username = params.get("username");
    const error = params.get("error");
    if (connected === "instagram") {
      setBannerMsg({
        type: "success",
        text: username
          ? `Instagram connected as @${username}`
          : "Instagram connected successfully",
      });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (error) {
      const errorMessages: Record<string, string> = {
        no_facebook_pages: "No Facebook Pages found. Make sure you have a Facebook Page linked to your Instagram Business account.",
        no_instagram_business_account: "No Instagram Business Account found. Your Instagram account must be a Business or Creator account linked to a Facebook Page.",
        missing_brand: "Brand not found. Please try again.",
        Access_denied: "Access was denied. Please try again and grant all requested permissions.",
      };
      setBannerMsg({
        type: "error",
        text: errorMessages[error] ?? decodeURIComponent(error),
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const { data: igStatus, isLoading: statusLoading } = useQuery<IGStatus>({
    queryKey: ["ig-status", activeBrandId],
    queryFn: () =>
      fetch(API(`/oauth/instagram/status?brandId=${activeBrandId}`)).then((r) => r.json()),
    enabled: !!activeBrandId,
    staleTime: 30000,
  });

  const disconnectMutation = useMutation({
    mutationFn: () =>
      fetch(API(`/oauth/instagram/disconnect?brandId=${activeBrandId}`), { method: "DELETE" }).then(
        (r) => r.json(),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ig-status", activeBrandId] });
      toast({ title: "Instagram disconnected" });
    },
    onError: () => {
      toast({ title: "Failed to disconnect", variant: "destructive" });
    },
  });

  const handleConnect = () => {
    if (!activeBrandId) {
      toast({ title: "Select a brand first", variant: "destructive" });
      return;
    }
    window.location.href = API(`/oauth/instagram/connect?brandId=${activeBrandId}`);
  };

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
              <button
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending || !activeBrandId}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors disabled:opacity-50"
              >
                <Link2Off className="h-3.5 w-3.5" />
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={!activeBrandId}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Link2 className="h-4 w-4" />
              Connect
            </button>
          )}
        </div>

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

        {!igStatus?.connected && (
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
