import { useState } from "react";
import { X, Info, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

const API = (path: string) => `/api${path}`;

const PLATFORMS = ["instagram", "facebook", "tiktok", "linkedin", "youtube", "snapchat"];
const POST_TYPES = ["feed_post", "reel", "story", "video", "carousel", "text_post"];
const TIMEZONES = ["Africa/Lagos", "Africa/Nairobi", "Africa/Accra", "Africa/Johannesburg", "UTC"];

interface IGStatus {
  connected: boolean;
  username?: string;
}

interface SchedulePostSheetProps {
  brandId: string;
  defaultDate?: string;
  defaultCaption?: string;
  previewHtml?: string;
  previewDataUrl?: string;
  canvasH?: number;
  onClose: () => void;
  onSaved: () => void;
}

export function SchedulePostSheet({ brandId, defaultDate, defaultCaption, previewHtml, previewDataUrl, canvasH = 1080, onClose, onSaved }: SchedulePostSheetProps) {
  const { toast } = useToast();
  const [platform, setPlatform] = useState("instagram");
  const [postType, setPostType] = useState("feed_post");
  const [caption, setCaption] = useState(defaultCaption ?? "");
  const [date, setDate] = useState(defaultDate ?? new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState("09:00");
  const [timezone, setTimezone] = useState("Africa/Lagos");
  const [saving, setSaving] = useState(false);
  const thumbW = 160;
  const thumbH = Math.round(thumbW * (canvasH / 1080));
  const thumbScale = thumbW / 1080;

  const { data: igStatus } = useQuery<IGStatus>({
    queryKey: ["ig-status", brandId],
    queryFn: () =>
      fetch(API(`/oauth/instagram/status?brandId=${brandId}`)).then((r) => r.json()),
    enabled: platform === "instagram",
    staleTime: 30000,
  });

  async function save() {
    if (!date || !time) return;
    setSaving(true);
    try {
      let mediaUrls: string[] | undefined;

      if (platform === "instagram" && previewDataUrl) {
        const uploadResp = await fetch(API("/schedule/upload-preview-image"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl: previewDataUrl }),
        });
        if (uploadResp.ok) {
          const { url } = await uploadResp.json();
          if (url) mediaUrls = [url];
        }
      }

      const scheduledFor = new Date(`${date}T${time}:00`).toISOString();
      const r = await fetch(API("/schedule/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, platform, postType, caption, scheduledFor, timezone, mediaUrls }),
      });
      if (!r.ok) throw new Error("Failed to schedule");
      toast({ title: "Post scheduled" });
      onSaved();
    } catch {
      toast({ title: "Failed to schedule post", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const igConnected = platform === "instagram" && igStatus?.connected;
  const igNotConnected = platform === "instagram" && igStatus && !igStatus.connected;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full max-w-md bg-background border-l border-border flex flex-col shadow-xl z-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Schedule Post</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {previewHtml && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Creative</label>
              <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border border-border">
                <div
                  className="rounded overflow-hidden border border-border flex-shrink-0"
                  style={{ width: thumbW, height: thumbH, position: "relative" }}
                >
                  <div
                    style={{ position: "absolute", top: 0, left: 0, width: 1080, height: canvasH, transform: `scale(${thumbScale})`, transformOrigin: "top left", pointerEvents: "none" }}
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-xs font-medium text-foreground">Generated creative</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {previewDataUrl ? "Image ready to upload" : "1 image attached"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {igConnected ? (
            <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-lg">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-green-700 dark:text-green-400 leading-relaxed">
                <strong>Auto-publish enabled.</strong> This post will be published automatically to{" "}
                {igStatus?.username ? <strong>@{igStatus.username}</strong> : "your Instagram"} at the scheduled time.
                {!previewDataUrl && " Attach a creative image for best results."}
              </p>
            </div>
          ) : igNotConnected ? (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg">
              <Info className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                <strong>Instagram not connected.</strong>{" "}
                <a href="/settings/social" className="underline font-medium">Connect in Settings → Social</a>{" "}
                to enable auto-publishing. Post will be saved to your calendar.
              </p>
            </div>
          ) : platform !== "instagram" ? (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg">
              <Info className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                <strong>Saved to your calendar.</strong> Auto-publishing for {platform} is coming soon — you'll need to post manually at the scheduled time.
              </p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Platform</label>
            <select
              value={platform}
              onChange={e => setPlatform(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm capitalize focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Post type</label>
            <select
              value={postType}
              onChange={e => setPostType(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {POST_TYPES.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Caption</label>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Post caption..."
              rows={4}
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timezone</label>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border">
          <button
            onClick={save}
            disabled={saving || !date || !time}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Scheduling...</> : "Schedule Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
