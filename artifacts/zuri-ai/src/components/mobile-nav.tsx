import { Link, useLocation } from "wouter";
import { LayoutDashboard, Layers, Sparkles, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/brands", label: "Brands", icon: Layers },
  { href: "/generate", label: "Generate", icon: Sparkles },
  { href: "/content", label: "Content", icon: BookOpen },
];

export function MobileNav() {
  const [location] = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border flex lg:hidden" data-testid="mobile-nav">
      {items.map(({ href, label, icon: Icon }) => {
        const isActive = location === href || (href !== "/" && location.startsWith(href));
        return (
          <Link key={href} href={href} className="flex-1">
            <div className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
              isActive ? "text-primary" : "text-muted-foreground"
            )}>
              <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
              {label}
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
