import { Link, useLocation } from "wouter";
import { LayoutDashboard, Layers, Sparkles, BookOpen, Settings, ChevronRight, Menu, X, LogOut } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/brands", label: "Brands", icon: Layers },
  { href: "/generate", label: "Generate", icon: Sparkles },
  { href: "/content", label: "Content Library", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Sidebar({ className, onClose }: { className?: string; onClose?: () => void }) {
  const [location] = useLocation();
  const { user, signOut } = useAuth();

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
      <nav className="flex-1 px-3 py-4 space-y-1" data-testid="sidebar-nav">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = location === href || (href !== "/" && location.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              data-testid={`nav-link-${label.toLowerCase().replace(/\s/g, "-")}`}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" />
              <span className="flex-1">{label}</span>
              {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-70" />}
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
          <div className="flex items-center gap-2 px-1">
            <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-primary">
                {(user.user_metadata?.full_name || user.email || "U")[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">
                {user.user_metadata?.full_name || user.email}
              </p>
            </div>
            <button
              onClick={() => signOut()}
              data-testid="btn-sign-out"
              title="Sign out"
              className="p-1 rounded-md text-muted-foreground hover:text-destructive transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar className="hidden lg:flex w-64 shrink-0" />
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 z-10">
            <Sidebar className="flex w-full" onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
          <button onClick={() => setMobileOpen(true)} data-testid="mobile-menu-btn" className="p-1.5 rounded-md text-muted-foreground hover:text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <img src="/zuri-ai-logo.png" alt="Zuri AI" className="h-7 w-7 rounded-full" />
          <span className="font-bold text-foreground">Zuri <span className="text-primary">AI</span></span>
        </header>
        <main className="flex-1 overflow-y-auto" data-testid="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
