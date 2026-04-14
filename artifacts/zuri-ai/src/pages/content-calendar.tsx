import { useState, useMemo } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Instagram, Linkedin, Facebook, Youtube, Clock, CheckCircle2, AlertCircle, Circle, X } from "lucide-react";
import { usePlan } from "@/hooks/use-plan";
import { UpgradePrompt } from "@/components/shared/upgrade-prompt";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBrand } from "@/context/brand-context";
import { useListBrands } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { SchedulePostSheet } from "@/components/schedule-post-sheet";

const API = (path: string) => `/api${path}`;

const PLATFORMS = ["instagram", "facebook", "linkedin", "youtube", "tiktok"];

const PLATFORM_ICONS: Record<string, React.ComponentType<any>> = {
  instagram: Instagram,
  linkedin: Linkedin,
  facebook: Facebook,
  youtube: Youtube,
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-100 text-pink-700",
  facebook: "bg-blue-100 text-blue-700",
  linkedin: "bg-sky-100 text-sky-700",
  tiktok: "bg-black text-white",
  youtube: "bg-red-100 text-red-700",
  snapchat: "bg-yellow-100 text-yellow-700",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "text-amber-600",
  published: "text-green-600",
  failed: "text-red-600",
  draft: "text-gray-400",
  cancelled: "text-gray-400",
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

interface ScheduledPost {
  id: string;
  platform: string;
  postType: string;
  caption?: string;
  scheduledFor: string;
  status: string;
}

interface CalendarStats {
  scheduledThisWeek: number;
  publishedThisMonth: number;
  draftsPending: number;
}

export default function ContentCalendar() {
  const { hasFeature, loading: planLoading } = usePlan();
  const { activeBrandId } = useBrand();
  const { data: brands } = useListBrands();
  const activeBrand = brands?.find(b => b.id === activeBrandId);
  const qc = useQueryClient();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [activePlatforms, setActivePlatforms] = useState<Set<string>>(new Set());
  const [showScheduleSheet, setShowScheduleSheet] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<string | null>(null);

  const isGated = !planLoading && !hasFeature('content_calendar');

  const { data: posts = [] } = useQuery<ScheduledPost[]>({
    queryKey: ["scheduled-posts", activeBrandId],
    queryFn: () => fetch(API(`/brands/${activeBrandId}/scheduled-posts`)).then(r => r.json()),
    enabled: !!activeBrandId && !isGated,
    staleTime: 30000,
  });

  const { data: stats } = useQuery<CalendarStats>({
    queryKey: ["calendar-stats", activeBrandId],
    queryFn: () => fetch(API(`/brands/${activeBrandId}/calendar-stats`)).then(r => r.json()),
    enabled: !!activeBrandId && !isGated,
    staleTime: 30000,
  });

  const deleteMutation = useMutation({
    mutationFn: (postId: string) =>
      fetch(API(`/schedule/${postId}`), { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scheduled-posts"] }),
  });

  const filteredPosts = useMemo(() => {
    if (activePlatforms.size === 0) return posts;
    return posts.filter(p => activePlatforms.has(p.platform));
  }, [posts, activePlatforms]);

  if (isGated) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <UpgradePrompt
          feature="Content Calendar"
          requiredPlan="solo"
          description="View and manage all your scheduled posts in a calendar view. Available on Solo plan and above."
          variant="page"
        />
      </div>
    );
  }

  function postsForDay(day: number) {
    return filteredPosts.filter(p => {
      const d = new Date(p.scheduledFor);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1);
    setSelectedDay(null);
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1);
    setSelectedDay(null);
  }

  function togglePlatform(p: string) {
    setActivePlatforms(prev => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const selectedDayPosts = selectedDay ? postsForDay(selectedDay) : [];
  const selectedDateStr = selectedDay ? `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}` : null;

  if (!activeBrandId || !activeBrand) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">Content Calendar</h1>
        <div className="flex flex-col items-center justify-center py-20 text-center bg-muted/30 border border-dashed border-border rounded-2xl">
          <CalendarDays className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">No brand selected</p>
          <p className="text-xs text-muted-foreground">Select a brand to view your content calendar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Content Calendar</h1>
          <p className="text-muted-foreground mt-1 text-sm">Schedule and manage posts for {activeBrand.name}.</p>
        </div>
        <button
          onClick={() => { setScheduleDate(null); setShowScheduleSheet(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Schedule Post
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Scheduled this week", value: stats.scheduledThisWeek, color: "text-amber-600" },
            { label: "Published this month", value: stats.publishedThisMonth, color: "text-green-600" },
            { label: "Drafts pending", value: stats.draftsPending, color: "text-muted-foreground" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground mr-1">Platforms:</span>
        {PLATFORMS.map(p => (
          <button
            key={p}
            onClick={() => togglePlatform(p)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border transition-all capitalize",
              activePlatforms.has(p)
                ? "border-primary bg-primary/8 text-primary"
                : "border-border text-muted-foreground hover:border-foreground/30"
            )}
          >
            {p}
          </button>
        ))}
        {activePlatforms.size > 0 && (
          <button onClick={() => setActivePlatforms(new Set())} className="text-xs text-muted-foreground hover:text-foreground">
            Clear
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <button onClick={prevMonth} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-bold text-foreground">{MONTH_NAMES[month]} {year}</h2>
        <button onClick={nextMonth} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border">
          {DAY_NAMES.map(d => (
            <div key={d} className="text-center py-2 text-xs font-semibold text-muted-foreground">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: totalCells }).map((_, i) => {
            const day = i - firstDay + 1;
            const isValid = day >= 1 && day <= daysInMonth;
            const isToday = isValid && year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
            const isSelected = selectedDay === day && isValid;
            const dayPosts = isValid ? postsForDay(day) : [];
            const visible = dayPosts.slice(0, 3);
            const overflow = dayPosts.length - 3;

            return (
              <div
                key={i}
                onClick={() => isValid && setSelectedDay(isSelected ? null : day)}
                className={cn(
                  "border-b border-r border-border p-1.5 min-h-[90px] cursor-pointer transition-colors",
                  isValid ? "hover:bg-muted/50" : "bg-muted/20",
                  isSelected && "bg-primary/5",
                  i % 7 === 6 && "border-r-0",
                )}
              >
                {isValid && (
                  <>
                    <div className={cn(
                      "h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium mb-1",
                      isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                    )}>
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {visible.map(p => (
                        <div
                          key={p.id}
                          className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium truncate", PLATFORM_COLORS[p.platform] ?? "bg-muted text-muted-foreground")}
                        >
                          {p.platform}
                        </div>
                      ))}
                      {overflow > 0 && (
                        <div className="text-[10px] text-muted-foreground px-1">+{overflow} more</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />Scheduled</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" />Published</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />Failed</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-300" />Draft</span>
      </div>

      {selectedDay && (
        <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-background border-l border-border flex flex-col shadow-xl z-40">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <p className="font-semibold text-foreground">{MONTH_NAMES[month]} {selectedDay}, {year}</p>
              <p className="text-xs text-muted-foreground">{selectedDayPosts.length} post{selectedDayPosts.length !== 1 ? "s" : ""}</p>
            </div>
            <button onClick={() => setSelectedDay(null)} className="p-1.5 text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {selectedDayPosts.length === 0 ? (
              <div className="text-center py-10">
                <Circle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No posts scheduled for this day.</p>
              </div>
            ) : (
              selectedDayPosts.map(post => (
                <div key={post.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={cn("px-2 py-0.5 rounded text-xs font-medium capitalize", PLATFORM_COLORS[post.platform] ?? "bg-muted text-muted-foreground")}>
                      {post.platform}
                    </span>
                    <span className={cn("text-xs font-medium", STATUS_COLORS[post.status] ?? "text-muted-foreground")}>
                      {post.status}
                    </span>
                  </div>
                  {post.caption && (
                    <p className="text-sm text-foreground line-clamp-2">{post.caption}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(post.scheduledFor).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <button
                      onClick={() => deleteMutation.mutate(post.id)}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-border">
            <button
              onClick={() => { setScheduleDate(selectedDateStr); setShowScheduleSheet(true); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add post for this day
            </button>
          </div>
        </div>
      )}

      {showScheduleSheet && activeBrandId && (
        <SchedulePostSheet
          brandId={activeBrandId}
          defaultDate={scheduleDate ?? undefined}
          onClose={() => setShowScheduleSheet(false)}
          onSaved={() => {
            setShowScheduleSheet(false);
            qc.invalidateQueries({ queryKey: ["scheduled-posts"] });
            qc.invalidateQueries({ queryKey: ["calendar-stats"] });
          }}
        />
      )}
    </div>
  );
}
