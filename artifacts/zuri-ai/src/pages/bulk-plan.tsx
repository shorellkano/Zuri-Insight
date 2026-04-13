import { useState } from "react";
import { useBrand } from "@/context/brand-context";
import { useListBrands } from "@workspace/api-client-react";
import { usePlan } from "@/hooks/use-plan";
import { UpgradePrompt } from "@/components/shared/upgrade-prompt";
import { Loader2, CalendarDays, Check, Trash2, Copy, CheckCircle2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const API = (path: string) => `/api${path}`;

const PLATFORMS = ["instagram", "facebook", "tiktok", "linkedin", "youtube"];
const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-100 text-pink-700",
  facebook: "bg-blue-100 text-blue-700",
  tiktok: "bg-gray-100 text-gray-700",
  linkedin: "bg-sky-100 text-sky-700",
  youtube: "bg-red-100 text-red-700",
};

interface PlanItem {
  id: string;
  platform: string;
  postType: string;
  suggestedDate: string;
  suggestedTime: string;
  contentTheme: string;
  calendarEvent?: string | null;
  contentAngle: string;
  designBrief: string;
  captionDraft?: string | null;
  status: string;
}

interface Plan {
  id: string;
  planName: string;
  startDate: string;
  endDate: string;
  platforms: string[];
}

const mix_defaults = { promotional: 30, educational: 30, engagement: 25, brand_story: 15 };

export default function BulkPlan() {
  const { hasFeature, loading: planLoading } = usePlan();
  const { activeBrandId } = useBrand();
  const { data: brands } = useListBrands();
  const activeBrand = brands?.find(b => b.id === activeBrandId);
  const { toast } = useToast();

  if (!planLoading && !hasFeature('bulk_planning')) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <UpgradePrompt
          feature="Bulk Content Planning"
          requiredPlan="solo"
          description="Plan a full week or month of content in one go. Available on Solo plan and above."
          variant="page"
        />
      </div>
    );
  }

  const [step, setStep] = useState<"setup" | "suggestion" | "generating" | "results">("setup");
  const [period, setPeriod] = useState<"week" | "month" | "custom">("week");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split("T")[0];
  });
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set(["instagram", "facebook"]));
  const [postsPerWeek, setPostsPerWeek] = useState(3);
  const [mix, setMix] = useState(mix_defaults);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [generatingIndex, setGeneratingIndex] = useState(-1);
  const [generatedItems, setGeneratedItems] = useState<Record<string, string>>({});
  const [failedItems, setFailedItems] = useState<Set<string>>(new Set());
  const [expandedCaption, setExpandedCaption] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function setPeriodPreset(p: "week" | "month") {
    setPeriod(p);
    const start = new Date();
    const end = new Date();
    if (p === "week") end.setDate(start.getDate() + 7);
    else end.setMonth(start.getMonth() + 1);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  }

  function togglePlatform(p: string) {
    setSelectedPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  }

  async function generateSuggestion() {
    if (!activeBrandId || selectedPlatforms.size === 0) return;
    setLoading(true);
    try {
      const r = await fetch(API(`/brands/${activeBrandId}/bulk-plan/suggest`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate, endDate,
          platforms: Array.from(selectedPlatforms),
          postsPerPlatformPerWeek: postsPerWeek,
          contentMix: mix,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to generate suggestion");
      setPlan(data.plan);
      setItems(data.items);
      setGeneratedItems({});
      setFailedItems(new Set());
      setStep("suggestion");
    } catch (err: any) {
      toast({ title: "Failed to generate plan", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function deleteItem(id: string) {
    setItems(items.filter(i => i.id !== id));
  }

  async function generateAll() {
    if (!activeBrandId || items.length === 0) return;
    setStep("generating");
    setGeneratingIndex(0);
    setGeneratedItems({});
    setFailedItems(new Set());

    const newCaptions: Record<string, string> = {};
    const newFailed = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      setGeneratingIndex(i);
      const item = items[i];
      try {
        const r = await fetch(API(`/bulk-plan-items/${item.id}/generate`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brandId: activeBrandId }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Generation failed");
        newCaptions[item.id] = data.captionDraft ?? "";
        setGeneratedItems(prev => ({ ...prev, [item.id]: data.captionDraft ?? "" }));
      } catch {
        newFailed.add(item.id);
        setFailedItems(prev => new Set([...prev, item.id]));
      }
    }

    setGeneratingIndex(-1);
    setItems(prev => prev.map(it => newCaptions[it.id] ? { ...it, captionDraft: newCaptions[it.id], status: "generated" } : it));
    setStep("results");
  }

  function copyCaption(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  const total = items.length;
  const calendarItems = items.filter(i => i.calendarEvent);
  const doneCount = Object.keys(generatedItems).length;

  if (!activeBrandId || !activeBrand) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">Plan a Week or Month</h1>
        <div className="flex flex-col items-center justify-center py-20 text-center bg-muted/30 border border-dashed border-border rounded-2xl">
          <CalendarDays className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Select a brand to start planning.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Plan a Week or Month</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Zuri builds your entire content calendar, covers all key dates, and generates every caption - you just approve.
        </p>
      </div>

      {step === "setup" && (
        <div className="space-y-8 max-w-2xl">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Time period</h3>
            <div className="grid grid-cols-3 gap-3">
              {(["week", "month", "custom"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => p !== "custom" ? setPeriodPreset(p) : setPeriod("custom")}
                  className={cn(
                    "py-3 rounded-xl border-2 text-sm font-medium capitalize transition-all",
                    period === p ? "border-primary bg-primary/8 text-primary" : "border-border text-muted-foreground hover:border-foreground/30"
                  )}
                >
                  {p === "week" ? "This Week" : p === "month" ? "This Month" : "Custom Range"}
                </button>
              ))}
            </div>
            {period === "custom" && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Start date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">End date</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Platforms</h3>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-medium capitalize transition-all",
                    selectedPlatforms.has(p) ? "border-primary bg-primary/8 text-primary" : "border-border text-muted-foreground hover:border-foreground/30"
                  )}
                >
                  {selectedPlatforms.has(p) && <Check className="h-3.5 w-3.5" />}
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Posting frequency</h3>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Posts per platform per week</span>
                <span className="text-sm font-semibold text-primary">{postsPerWeek}</span>
              </div>
              <input type="range" min={1} max={7} value={postsPerWeek} onChange={e => setPostsPerWeek(Number(e.target.value))}
                className="w-full accent-primary" />
              <div className="flex justify-between text-[10px] text-muted-foreground"><span>1</span><span>7</span></div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Content mix</h3>
            <div className="space-y-3">
              {[
                { key: "promotional", label: "Promotional" },
                { key: "educational", label: "Educational" },
                { key: "engagement", label: "Engagement" },
                { key: "brand_story", label: "Brand story" },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="text-sm font-semibold text-foreground">{mix[key as keyof typeof mix]}%</span>
                  </div>
                  <input
                    type="range" min={0} max={100}
                    value={mix[key as keyof typeof mix]}
                    onChange={e => setMix(m => ({ ...m, [key]: Number(e.target.value) }))}
                    className="w-full accent-primary"
                  />
                </div>
              ))}
              <div className="flex justify-end">
                <span className={cn("text-xs font-medium", Object.values(mix).reduce((a, b) => a + b, 0) === 100 ? "text-green-600" : "text-amber-600")}>
                  Total: {Object.values(mix).reduce((a, b) => a + b, 0)}%
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={generateSuggestion}
            disabled={loading || selectedPlatforms.size === 0 || !activeBrandId}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Generating plan...</> : "Generate Plan Suggestion"}
          </button>
        </div>
      )}

      {step === "suggestion" && items.length > 0 && (
        <div className="space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-900">Review your content plan before generating</p>
            <p className="text-xs text-amber-700 mt-0.5">Zuri always suggests before it produces. Delete any slots you don't want, then approve to generate all captions.</p>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            <span className="font-medium text-foreground">Total posts: <strong>{total}</strong></span>
            <span>Calendar events covered: <strong>{calendarItems.length}</strong></span>
            <span>Platforms: <strong>{plan?.platforms?.join(", ")}</strong></span>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto] gap-0 border-b border-border bg-muted/50">
              {["Date", "Platform", "Type", "Theme", "Angle", ""].map(h => (
                <div key={h} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</div>
              ))}
            </div>
            <div className="divide-y divide-border max-h-96 overflow-y-auto">
              {items.map(item => (
                <div
                  key={item.id}
                  className={cn(
                    "grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto] gap-0 items-center hover:bg-muted/30 transition-colors",
                    item.calendarEvent && "bg-amber-50/60"
                  )}
                >
                  <div className="px-4 py-3 text-xs font-mono text-foreground whitespace-nowrap">
                    {item.suggestedDate}
                    <span className="text-muted-foreground ml-1 text-[10px]">{item.suggestedTime}</span>
                  </div>
                  <div className="px-3 py-3">
                    <span className={cn("px-2 py-0.5 rounded text-xs font-medium capitalize", PLATFORM_COLORS[item.platform] ?? "bg-muted text-foreground")}>
                      {item.platform}
                    </span>
                  </div>
                  <div className="px-3 py-3 text-xs text-muted-foreground capitalize">{item.postType?.replace("_", " ")}</div>
                  <div className="px-3 py-3">
                    <p className="text-xs text-foreground truncate">{item.contentTheme}</p>
                    {item.calendarEvent && (
                      <span className="text-[10px] text-amber-600 font-medium">{item.calendarEvent}</span>
                    )}
                  </div>
                  <div className="px-3 py-3 text-xs text-muted-foreground line-clamp-2">{item.contentAngle}</div>
                  <div className="px-3 py-3">
                    <button onClick={() => deleteItem(item.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => { setStep("setup"); setPlan(null); setItems([]); }}
              className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
            >
              Start over
            </button>
            <button
              onClick={generateSuggestion}
              disabled={loading}
              className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Regenerate suggestion
            </button>
            <button
              onClick={generateAll}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              Approve plan and generate {total} captions
            </button>
          </div>
        </div>
      )}

      {step === "generating" && (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Generating captions...</p>
                <p className="text-xs text-muted-foreground">{doneCount} of {total} complete</p>
              </div>
            </div>

            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-500"
                style={{ width: `${total > 0 ? (doneCount / total) * 100 : 0}%` }}
              />
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {items.map((item, i) => {
                const isDone = !!generatedItems[item.id];
                const isFailed = failedItems.has(item.id);
                const isActive = i === generatingIndex;

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                      isDone ? "border-green-200 bg-green-50" :
                      isFailed ? "border-red-200 bg-red-50" :
                      isActive ? "border-primary/40 bg-primary/5" :
                      "border-border bg-muted/20"
                    )}
                  >
                    <div className="shrink-0">
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : isFailed ? (
                        <span className="text-red-500 text-xs font-bold">!</span>
                      ) : isActive ? (
                        <Loader2 className="h-4 w-4 text-primary animate-spin" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-border" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize mr-2",
                        PLATFORM_COLORS[item.platform] ?? "bg-muted text-foreground"
                      )}>
                        {item.platform}
                      </span>
                      <span className="text-xs text-foreground">{item.contentTheme}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{item.suggestedDate}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {step === "results" && (
        <div className="space-y-5">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-900">
                {Object.keys(generatedItems).length} captions generated
                {failedItems.size > 0 && `, ${failedItems.size} failed`}
              </p>
              <p className="text-xs text-green-700 mt-0.5">Copy any caption and paste it into your scheduling tool, or send it straight to your content calendar.</p>
            </div>
          </div>

          <div className="space-y-3">
            {items.map(item => {
              const caption = generatedItems[item.id] ?? item.captionDraft;
              const failed = failedItems.has(item.id);
              const isExpanded = expandedCaption === item.id;

              return (
                <div
                  key={item.id}
                  className={cn(
                    "bg-card border rounded-2xl overflow-hidden transition-all",
                    failed ? "border-red-200" : caption ? "border-border" : "border-dashed border-border opacity-50"
                  )}
                >
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedCaption(isExpanded ? null : item.id)}
                  >
                    <span className={cn("px-2 py-0.5 rounded text-xs font-semibold capitalize shrink-0", PLATFORM_COLORS[item.platform] ?? "bg-muted text-foreground")}>
                      {item.platform}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{item.contentTheme}</p>
                      <p className="text-[10px] text-muted-foreground">{item.suggestedDate} at {item.suggestedTime}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {failed ? (
                        <span className="text-xs text-red-500 font-medium">Failed</span>
                      ) : caption ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); copyCaption(item.id, caption); }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted hover:bg-muted/80 text-xs font-medium text-foreground transition-colors"
                        >
                          {copied === item.id ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                          {copied === item.id ? "Copied" : "Copy"}
                        </button>
                      ) : null}
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-border pt-3">
                      {failed ? (
                        <p className="text-xs text-red-500">Caption generation failed for this post. You can retry by regenerating the plan.</p>
                      ) : caption ? (
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{caption}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No caption generated.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 flex-wrap pt-2">
            <button
              onClick={() => { setStep("setup"); setPlan(null); setItems([]); setGeneratedItems({}); setFailedItems(new Set()); }}
              className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
            >
              Plan a new period
            </button>
            <button
              onClick={() => setStep("suggestion")}
              className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
            >
              Back to plan view
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
