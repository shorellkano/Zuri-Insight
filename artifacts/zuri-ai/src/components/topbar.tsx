import { Link } from "wouter";
import { ChevronDown, Plus, Zap, AlertTriangle } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useListBrands } from "@workspace/api-client-react";
import { useBrand } from "@/context/brand-context";
import { cn } from "@/lib/utils";
import { usePlan } from "@/hooks/use-plan";

export function Topbar() {
  const { activeBrandId, setActiveBrandId } = useBrand();
  const { data: brands } = useListBrands();
  const { planId, plan, usage } = usePlan();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeBrand = brands?.find((b) => b.id === activeBrandId);
  const isUnlimited = plan.limits.media_posts_monthly === -1;
  const pct = usage.mediaPostsPct;
  const isHigh = pct >= 80;
  const isMax = pct >= 100;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="h-14 shrink-0 border-b border-border bg-card flex items-center justify-between px-4 gap-4" data-testid="topbar">
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          data-testid="brand-switcher-btn"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-sm"
        >
          <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
            {activeBrand ? activeBrand.name[0] : "?"}
          </div>
          <span className="font-medium text-foreground max-w-[140px] truncate">
            {activeBrand ? activeBrand.name : "Select a brand"}
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden" data-testid="brand-switcher-dropdown">
            <div className="py-1">
              {brands?.map((brand) => (
                <button
                  key={brand.id}
                  onClick={() => { setActiveBrandId(brand.id); setOpen(false); }}
                  data-testid={`brand-option-${brand.id}`}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted transition-colors text-left",
                    brand.id === activeBrandId && "bg-primary/5 text-primary font-medium"
                  )}
                >
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                    {brand.name[0]}
                  </div>
                  <span className="truncate">{brand.name}</span>
                  {brand.id === activeBrandId && <span className="ml-auto text-[10px] text-primary">✓</span>}
                </button>
              ))}
              <div className="border-t border-border mt-1 pt-1">
                <Link href="/brands/new" onClick={() => setOpen(false)}>
                  <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer" data-testid="brand-switcher-add-brand">
                    <Plus className="h-3.5 w-3.5" />
                    Add brand
                  </div>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      <Link href="/settings/billing" data-testid="credits-display">
        {isUnlimited ? (
          <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer",
            "bg-amber-100 text-amber-800 hover:bg-amber-200"
          )}>
            <Zap className="h-3 w-3" />
            {plan.name}
          </div>
        ) : (
          <div className={cn(
            "flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer",
            isMax ? "bg-red-100 text-red-700" : isHigh ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground hover:text-foreground"
          )}>
            {isMax ? <AlertTriangle className="h-3 w-3 shrink-0" /> : <Zap className="h-3 w-3 shrink-0 text-amber-500" />}
            <span className="whitespace-nowrap">
              {isMax ? "Limit reached" : `${usage.mediaPostsUsed} / ${usage.mediaPostsLimit} posts`}
            </span>
            {!isMax && (
              <div className="w-12 h-1.5 bg-background/60 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", isHigh ? "bg-amber-500" : "bg-primary")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>
        )}
      </Link>
    </header>
  );
}
