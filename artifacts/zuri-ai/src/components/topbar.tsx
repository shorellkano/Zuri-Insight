import { Link } from "wouter";
import { ChevronDown, Plus, Zap, AlertTriangle, Menu, Trash2, Settings } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useListBrands, useDeleteBrand } from "@workspace/api-client-react";
import { useBrand } from "@/context/brand-context";
import { cn } from "@/lib/utils";
import { usePlan } from "@/hooks/use-plan";
import { useQueryClient } from "@tanstack/react-query";

export function Topbar({ onOpenSidebar }: { onOpenSidebar?: () => void }) {
  const { activeBrandId, setActiveBrandId } = useBrand();
  const { data: brands } = useListBrands();
  const { planId, plan, usage } = usePlan();
  const [open, setOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const deleteBrand = useDeleteBrand();

  const activeBrand = brands?.find((b) => b.id === activeBrandId);
  const isUnlimited = plan.limits.media_posts_monthly === -1;
  const pct = usage.mediaPostsPct;
  const isHigh = pct >= 80;
  const isMax = pct >= 100;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDeleteId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleDelete(brandId: string) {
    deleteBrand.mutate({ brandId }, {
      onSuccess: () => {
        setConfirmDeleteId(null);
        if (activeBrandId === brandId) {
          const remaining = brands?.filter((b) => b.id !== brandId);
          setActiveBrandId(remaining?.[0]?.id ?? null);
        }
        queryClient.invalidateQueries({ queryKey: ["brands"] });
      },
    });
  }

  return (
    <header className="h-14 shrink-0 border-b border-border bg-card flex items-center justify-between px-3 sm:px-4 gap-2 sm:gap-4" data-testid="topbar">
      <div className="flex items-center gap-2 min-w-0">
        <button
          className="lg:hidden p-1.5 rounded-md hover:bg-muted transition-colors shrink-0"
          onClick={onOpenSidebar}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button>

        <Link href="/dashboard" className="lg:hidden shrink-0">
          <img src="/zuri-logo-head.png" alt="Zuri AI" className="h-7 w-7 object-contain" />
        </Link>

        <div className="relative min-w-0" ref={ref}>
          {/* No brand selected → prominent CTA */}
          {!activeBrand ? (
            <Link href="/brands/new" data-testid="brand-switcher-btn">
              <div className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-semibold shadow-sm cursor-pointer whitespace-nowrap">
                <Plus className="h-4 w-4 shrink-0" />
                <span>Add your brand</span>
              </div>
            </Link>
          ) : (
            <button
              onClick={() => { setOpen((v) => !v); setConfirmDeleteId(null); }}
              data-testid="brand-switcher-btn"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors text-sm max-w-[180px] sm:max-w-none"
            >
              <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-[11px] font-bold text-primary-foreground shrink-0">
                {activeBrand.name[0].toUpperCase()}
              </div>
              <span className="font-semibold text-foreground max-w-[90px] sm:max-w-[140px] truncate">
                {activeBrand.name}
              </span>
              <ChevronDown className={cn("h-4 w-4 text-primary transition-transform shrink-0", open && "rotate-180")} />
            </button>
          )}

          {open && activeBrand && (
            <div className="absolute top-full left-0 mt-1.5 w-64 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden" data-testid="brand-switcher-dropdown">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Your brands</p>
              </div>
              <div className="py-1">
                {brands?.map((brand) => (
                  <div key={brand.id}>
                    {confirmDeleteId === brand.id ? (
                      /* Inline delete confirmation */
                      <div className="px-3 py-2.5 bg-red-50 border-b border-red-100">
                        <p className="text-xs text-red-700 font-medium mb-2">Delete <strong>{brand.name}</strong>? This cannot be undone.</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDelete(brand.id)}
                            disabled={deleteBrand.isPending}
                            className="flex-1 px-2.5 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                          >
                            {deleteBrand.isPending ? "Deleting…" : "Yes, delete"}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="flex-1 px-2.5 py-1.5 bg-white border border-border text-xs font-medium rounded-lg hover:bg-muted transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="group flex items-center gap-2 px-3 py-2.5 hover:bg-muted transition-colors">
                        <button
                          onClick={() => { setActiveBrandId(brand.id); setOpen(false); }}
                          data-testid={`brand-option-${brand.id}`}
                          className={cn(
                            "flex items-center gap-3 text-sm text-left flex-1 min-w-0",
                            brand.id === activeBrandId && "text-primary font-medium"
                          )}
                        >
                          <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-[12px] font-bold text-primary-foreground shrink-0">
                            {brand.name[0].toUpperCase()}
                          </div>
                          <span className="truncate flex-1">{brand.name}</span>
                          {brand.id === activeBrandId && (
                            <span className="text-primary font-bold text-sm shrink-0">✓</span>
                          )}
                        </button>
                        {/* Settings & Delete icons */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Link href={`/brands/${brand.id}/settings`} onClick={() => setOpen(false)}>
                            <span className="p-1 rounded hover:bg-muted-foreground/10 text-muted-foreground hover:text-foreground transition-colors block" title="Brand settings">
                              <Settings className="h-3.5 w-3.5" />
                            </span>
                          </Link>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(brand.id); }}
                            className="p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
                            title="Delete brand"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-border">
                <Link href="/brands/new" onClick={() => setOpen(false)}>
                  <div className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 transition-colors cursor-pointer" data-testid="brand-switcher-add-brand">
                    <div className="h-7 w-7 rounded-full border-2 border-dashed border-primary/40 flex items-center justify-center shrink-0">
                      <Plus className="h-3.5 w-3.5 text-primary" />
                    </div>
                    Add new brand
                  </div>
                </Link>
              </div>
            </div>
          )}
        </div>
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
            "flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer",
            isMax ? "bg-red-100 text-red-700" : isHigh ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground hover:text-foreground"
          )}>
            {isMax ? <AlertTriangle className="h-3 w-3 shrink-0" /> : <Zap className="h-3 w-3 shrink-0 text-amber-500" />}
            <span className="whitespace-nowrap">
              {isMax ? "Limit reached" : `${usage.mediaPostsUsed}/${usage.mediaPostsLimit}`}
            </span>
            {!isMax && (
              <div className="hidden sm:block w-12 h-1.5 bg-background/60 rounded-full overflow-hidden">
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
