import { useState, ReactNode } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface StudioPageShellProps {
  title: string;
  settings: ReactNode;
  preview: ReactNode;
}

export function StudioPageShell({ title, settings, preview }: StudioPageShellProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-30 h-11 bg-background/95 backdrop-blur-sm border-b border-border flex items-center gap-3 px-4 flex-shrink-0">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </button>
        <div className="w-px h-4 bg-border flex-shrink-0" />
        <div className="flex items-center gap-1.5 text-sm min-w-0 flex-1 overflow-hidden">
          <Link href="/generate/creative-studio" className="text-muted-foreground hover:text-foreground transition-colors truncate flex-shrink-0">
            Creative Studio
          </Link>
          <span className="text-muted-foreground flex-shrink-0">/</span>
          <span className="font-semibold text-foreground truncate">{title}</span>
        </div>
        <button
          onClick={() => setOpen(v => !v)}
          className="ml-auto flex items-center gap-1 text-xs border border-border rounded-lg px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
          title={open ? "Minimise settings" : "Show settings"}
        >
          {open
            ? <><ChevronLeft className="h-3.5 w-3.5" /><span className="hidden sm:inline">Minimise</span></>
            : <><ChevronRight className="h-3.5 w-3.5" /><span className="hidden sm:inline">Settings</span></>
          }
        </button>
      </header>

      <div className="flex flex-1">
        <div className={cn(
          "border-r border-border flex-shrink-0 overflow-y-auto transition-[width] duration-200 overflow-x-hidden",
          open ? "w-[320px] xl:w-[360px]" : "w-0"
        )}>
          <div className="p-4 xl:p-5 space-y-5 min-w-[320px] xl:min-w-[360px]">
            {settings}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 xl:p-6">
          {preview}
        </div>
      </div>
    </div>
  );
}
