import { useState } from "react";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = (path: string) => `/api${path}`;

const PLATFORMS = ["instagram", "facebook", "tiktok", "linkedin", "youtube", "snapchat"];
const POST_TYPES = ["feed_post", "reel", "story", "video", "carousel", "text_post"];
const TIMEZONES = ["Africa/Lagos", "Africa/Nairobi", "Africa/Accra", "Africa/Johannesburg", "UTC"];

interface SchedulePostSheetProps {
  brandId: string;
  defaultDate?: string;
  defaultCaption?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function SchedulePostSheet({ brandId, defaultDate, defaultCaption, onClose, onSaved }: SchedulePostSheetProps) {
  const { toast } = useToast();
  const [platform, setPlatform] = useState("instagram");
  const [postType, setPostType] = useState("feed_post");
  const [caption, setCaption] = useState(defaultCaption ?? "");
  const [date, setDate] = useState(defaultDate ?? new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState("09:00");
  const [timezone, setTimezone] = useState("Africa/Lagos");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!date || !time) return;
    setSaving(true);
    try {
      const scheduledFor = new Date(`${date}T${time}:00`).toISOString();
      const r = await fetch(API("/schedule/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, platform, postType, caption, scheduledFor, timezone }),
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
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saving ? "Scheduling..." : "Schedule Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
