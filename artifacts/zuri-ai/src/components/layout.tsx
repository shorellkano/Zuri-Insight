import { Link, useLocation } from "wouter";
import { LayoutDashboard, Layers, Sparkles, BookOpen, Settings, ChevronRight, X, LogOut, CalendarDays, Zap, Camera, CreditCard } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { BrandProvider } from "@/context/brand-context";
import { Topbar } from "@/components/topbar";
import { MobileNav } from "@/components/mobile-nav";
import { useListBrands } from "@workspace/api-client-react";
import { QuickSetup } from "@/components/brands/QuickSetup";
import { usePlan } from "@/hooks/use-plan";

const navItems = [
  { href: "/quick-create", label: "Quick Create", icon: Zap, highlight: true },
  { href: "/post", label: "Post Content", icon: Camera },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/brands", label: "Brands", icon: Layers },
  { href: "/generate", label: "Generate", icon: Sparkles },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/content", label: "Content Library", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/pricing", label: "Pricing", icon: CreditCard },
];

const planColors: Record<string, string> = {
  free: "bg-gray-100 text-gray-600",
  solo: "bg-blue-100 text-blue-700",
  growth: "bg-teal-100 text-teal-700",
  studio: "bg-amber-100 text-amber-700",
  enterprise: "bg-purple-100 text-purple-700",
};

function Sidebar({ className, onClose }: { className?: string; onClose?: () => void }) {
  const [location] = useLocation();
  const { user, signOut } = useAuth();
  const { planId, plan } = usePlan();

  return (
    <aside className={cn("flex flex-col h-full bg-card border-r border-border", className)}>
      <div className="flex items-center justify-between px-5 py-5 border-b border-border">
        <Link href="/" className="flex items-center gap-2.5" onClick={onClose}>
          <img src="/zuri-ai-logo.png" alt="Zuri AI" className="h-9 w-9 rounded-full object-cover" data-testid="sidebar-logo" />
          <span className="text-xl font-bold tracking-tight text-foreground">Zuri <span className="text-primary">AI</span></span>
        </Link>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:text-foreground lg:hidden">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5" data-testid="sidebar-nav">
        {navItems.map(({ href, label, icon: Icon, highlight }) => {
          const isActive = location === href || (href !== "/" && location.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              data-testid={`nav-link-${label.toLowerCase().replace(/\s/g, "-")}`}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative",
                isActive
                  ? "bg-primary/8 text-primary before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-0.5 before:bg-primary before:rounded-r-full"
                  : highlight
                  ? "text-primary bg-primary/5 hover:bg-primary/10"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-border space-y-3">
        <Link href="/brands/new" onClick={onClose} data-testid="sidebar-new-brand-btn">
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
            <Sparkles className="h-4 w-4" />
            New Brand
          </button>
        </Link>

        {user && (
          <div className="flex items-center gap-2 px-1 pt-1">
            <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary">
                {(user.user_metadata?.full_name || user.email || "U")[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate leading-tight">
                {user.user_metadata?.full_name || user.email?.split("@")[0]}
              </p>
              <Link href="/settings/billing" onClick={onClose}>
                <span className={cn("inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-0.5 cursor-pointer hover:opacity-80", planColors[planId] ?? planColors.free)}>
                  {plan.name}
                </span>
              </Link>
            </div>
            <button
              onClick={() => signOut()}
              data-testid="btn-sign-out"
              title="Sign out"
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function SidebarSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 w-72 z-10">
        <Sidebar className="flex w-full h-full" onClose={onClose} />
      </div>
    </div>
  );
}

function QuickSetupGate({ children }: { children: React.ReactNode }) {
  const { data: brands, isLoading } = useListBrands();
  const [dismissed, setDismissed] = useState(false);
  const [location] = useLocation();

  const noBrands = !isLoading && Array.isArray(brands) && brands.length === 0;
  const isOnboarding = location === "/brands/new";
  const showSetup = noBrands && !dismissed && !isOnboarding;

  return (
    <>
      {children}
      {showSetup && <QuickSetup onClose={() => setDismissed(true)} />}
    </>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <BrandProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar className="hidden lg:flex flex-col w-60 shrink-0" />
        <SidebarSheet open={mobileOpen} onClose={() => setMobileOpen(false)} />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Topbar onOpenSidebar={() => setMobileOpen(true)} />
          <main className="flex-1 overflow-y-auto pb-16 lg:pb-0 bg-[#FAFAF9]" data-testid="main-content">
            <div className="max-w-screen-xl mx-auto">
              <QuickSetupGate>{children}</QuickSetupGate>
            </div>
          </main>
        </div>
      </div>
      <MobileNav />
    </BrandProvider>
  );
}
