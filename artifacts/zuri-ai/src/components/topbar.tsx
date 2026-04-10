import { Link } from "wouter";
import { ChevronDown, Plus, Zap } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useListBrands, useGetDashboardStats } from "@workspace/api-client-react";
import { useBrand } from "@/context/brand-context";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

export function Topbar() {
  const { activeBrandId, setActiveBrandId } = useBrand();
  const { data: brands } = useListBrands();
  const { data: stats } = useGetDashboardStats();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeBrand = brands?.find((b) => b.id === activeBrandId);
  const creditsUsed = stats?.totalContentGenerated ?? 0;
  const creditsLimit = 50;
  const pct = Math.min((creditsUsed / creditsLimit) * 100, 100);

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

      <Link href="/settings" className="flex items-center gap-2.5 group" data-testid="credits-display">
        <Zap className="h-3.5 w-3.5 text-amber-500" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">{creditsUsed} / {creditsLimit} credits</span>
          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </Link>
    </header>
  );
}
