import { useParams } from "wouter";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Loader2, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BrandSubNav } from "@/components/brand-sub-nav";
import { cn } from "@/lib/utils";

const API = (path: string) => `/api${path}`;

type Lesson = {
  id: string; brandId: string; rule: string; lessonType: string;
  contentType: string | null; platform: string | null;
  isActive: boolean; createdAt: string;
};

const LESSON_TYPES = [
  { type: "NEVER DO", color: "border-red-400", bg: "bg-red-50", badge: "bg-red-100 text-red-700" },
  { type: "ALWAYS DO", color: "border-green-500", bg: "bg-green-50/30", badge: "bg-green-100 text-green-700" },
  { type: "TONE RULES", color: "border-purple-500", bg: "bg-purple-50/20", badge: "bg-purple-100 text-purple-700" },
  { type: "FORMAT RULES", color: "border-blue-500", bg: "bg-blue-50/20", badge: "bg-blue-100 text-blue-700" },
  { type: "CONTENT RULES", color: "border-amber-500", bg: "bg-amber-50/20", badge: "bg-amber-100 text-amber-700" },
  { type: "CULTURAL RULES", color: "border-teal-500", bg: "bg-teal-50/20", badge: "bg-teal-100 text-teal-700" },
  { type: "WHAT WORKS", color: "border-emerald-500", bg: "bg-emerald-50/20", badge: "bg-emerald-100 text-emerald-700" },
];

const LESSON_TYPE_CONFIG = Object.fromEntries(LESSON_TYPES.map(l => [l.type, l]));

function useBrandLessons(brandId: string) {
  return useQuery<Lesson[]>({
    queryKey: ["lessons", brandId],
    queryFn: () => fetch(API(`/brands/${brandId}/lessons`)).then(r => r.json()),
    enabled: !!brandId,
  });
}

function LessonCard({ lesson, onToggle, onDelete }: { lesson: Lesson; onToggle: () => void; onDelete: () => void }) {
  const cfg = LESSON_TYPE_CONFIG[lesson.lessonType] ?? LESSON_TYPE_CONFIG["ALWAYS DO"];
  return (
    <div className={cn("border-l-4 rounded-r-xl px-4 py-3.5 space-y-2 group", cfg.color, cfg.bg, !lesson.isActive && "opacity-50")}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-foreground leading-relaxed flex-1">{lesson.rule}</p>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onToggle} title={lesson.isActive ? "Pause this rule" : "Activate this rule"} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors">
            {lesson.isActive ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4" />}
          </button>
          <button onClick={onDelete} title="Delete lesson" className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("px-2 py-0.5 rounded text-xs font-semibold", cfg.badge)}>{lesson.lessonType}</span>
        {lesson.contentType && <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs">{lesson.contentType}</span>}
        {lesson.platform && <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs">{lesson.platform}</span>}
        {!lesson.isActive && <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs">Paused</span>}
        <span className="text-xs text-muted-foreground ml-auto">{new Date(lesson.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
      </div>
    </div>
  );
}

function LessonGroup({ type, lessons, onToggle, onDelete }: { type: string; lessons: Lesson[]; onToggle: (id: string) => void; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(true);
  const cfg = LESSON_TYPE_CONFIG[type] ?? LESSON_TYPE_CONFIG["ALWAYS DO"];
  if (lessons.length === 0) return null;
  return (
    <div className="space-y-2">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between py-1">
        <div className="flex items-center gap-2">
          <span className={cn("px-2.5 py-1 rounded text-xs font-bold", cfg.badge)}>{type}</span>
          <span className="text-xs text-muted-foreground">{lessons.length} rule{lessons.length !== 1 ? "s" : ""}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="space-y-2 pl-0">
          {lessons.map(l => (
            <LessonCard key={l.id} lesson={l} onToggle={() => onToggle(l.id)} onDelete={() => onDelete(l.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function AddLessonPanel({ brandId, onClose }: { brandId: string; onClose: () => void }) {
  const [feedback, setFeedback] = useState("");
  const [contentType, setContentType] = useState("");
  const [platform, setPlatform] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const create = useMutation({
    mutationFn: (body: object) =>
      fetch(API(`/brands/${brandId}/lessons`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons", brandId] });
      toast({ title: "Lesson added" });
      onClose();
    },
    onError: () => toast({ title: "Failed to add lesson", variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({ feedback, contentType: contentType || undefined, platform: platform || undefined });
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
      <h3 className="font-semibold text-foreground">Add a Lesson Manually</h3>
      <p className="text-sm text-muted-foreground">Zuri AI will parse your feedback into a structured rule.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lesson / Rule</label>
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="e.g. Never use British spelling - use American English. The brand voice should always sound like a smart friend not a corporate robot."
            rows={4}
            required
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Applies to</label>
            <select value={contentType} onChange={e => setContentType(e.target.value)} className="w-full h-9 px-3 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="">All content</option>
              <option value="ad-copy">Ad copy</option>
              <option value="email">Email</option>
              <option value="social-posts">Social posts</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="video-scripts">Video scripts</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Platform</label>
            <select value={platform} onChange={e => setPlatform(e.target.value)} className="w-full h-9 px-3 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="">All platforms</option>
              {["Instagram", "TikTok", "Facebook", "Twitter/X", "LinkedIn", "WhatsApp", "Gmail"].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3">
          <button type="submit" disabled={create.isPending || !feedback.trim()} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {create.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Zuri AI is learning...</> : <><Plus className="h-4 w-4" /> Save Lesson</>}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default function BrandLessons() {
  const { brandId } = useParams<{ brandId: string }>();
  const { data: lessons = [], isLoading } = useBrandLessons(brandId);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [addingLesson, setAddingLesson] = useState(false);

  const toggleLesson = useMutation({
    mutationFn: (id: string) => fetch(API(`/brands/${brandId}/lessons/${id}/toggle`), { method: "PATCH" }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lessons", brandId] }),
  });

  const deleteLesson = useMutation({
    mutationFn: (id: string) => fetch(API(`/brands/${brandId}/lessons/${id}`), { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons", brandId] });
      toast({ title: "Lesson deleted" });
    },
  });

  const activeCount = lessons.filter(l => l.isActive).length;
  const grouped = LESSON_TYPES.reduce<Record<string, Lesson[]>>((acc, { type }) => {
    acc[type] = lessons.filter(l => l.lessonType === type);
    return acc;
  }, {});

  return (
    <div data-testid="brand-lessons-page">
      <BrandSubNav brandId={brandId} />
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lessons Bank</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Everything Zuri AI has learned about your brand. Applied to every piece of content generated.</p>
        </div>
        <button
          onClick={() => setAddingLesson(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add lesson</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {lessons.length > 0 && (
        <div className="flex items-center gap-6 px-5 py-4 bg-card border border-border rounded-xl">
          <div>
            <p className="text-2xl font-bold text-foreground">{lessons.length}</p>
            <p className="text-xs text-muted-foreground">Total lessons</p>
          </div>
          <div className="w-px h-10 bg-border" />
          <div>
            <p className="text-2xl font-bold text-green-600">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Active rules</p>
          </div>
          <div className="w-px h-10 bg-border" />
          <div>
            <p className="text-2xl font-bold text-muted-foreground">{lessons.length - activeCount}</p>
            <p className="text-xs text-muted-foreground">Paused</p>
          </div>
        </div>
      )}

      {addingLesson && (
        <AddLessonPanel brandId={brandId} onClose={() => setAddingLesson(false)} />
      )}

      {isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : lessons.length === 0 && !addingLesson ? (
        <div className="flex flex-col items-center py-16 text-center bg-muted/30 border border-dashed border-border rounded-2xl">
          <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">No lessons yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">Generate some content and give Zuri AI feedback. Each piece of feedback becomes a permanent rule.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {LESSON_TYPES.map(({ type }) => (
            <LessonGroup
              key={type}
              type={type}
              lessons={grouped[type] ?? []}
              onToggle={id => toggleLesson.mutate(id)}
              onDelete={id => deleteLesson.mutate(id)}
            />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
