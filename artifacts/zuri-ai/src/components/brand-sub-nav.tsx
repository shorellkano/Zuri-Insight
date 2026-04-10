import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface BrandSubNavProps {
  brandId: string;
}

const API = (path: string) => `/api${path}`;

const TABS = [
  { label: "Overview", path: "" },
  { label: "Brand DNA", path: "/dna" },
  { label: "Voice File", path: "/voice" },
  { label: "Lessons Bank", path: "/lessons" },
  { label: "Brand Calendar", path: "/brand-calendar" },
];

export function BrandSubNav({ brandId }: BrandSubNavProps) {
  const [location] = useLocation();

  const { data: voices = [] } = useQuery<{ id: string }[]>({
    queryKey: ["voice", brandId],
    queryFn: () => fetch(API(`/brands/${brandId}/voice`)).then(r => r.json()),
    enabled: !!brandId,
    staleTime: 60000,
  });

  const { data: lessons = [] } = useQuery<{ id: string }[]>({
    queryKey: ["lessons", brandId],
    queryFn: () => fetch(API(`/brands/${brandId}/lessons`)).then(r => r.json()),
    enabled: !!brandId,
    staleTime: 60000,
  });

  const voiceCount = voices.length;
  const lessonCount = lessons.length;

  function isActive(tabPath: string) {
    const full = `/brands/${brandId}${tabPath}`;
    if (tabPath === "") return location === full;
    return location.startsWith(full);
  }

  return (
    <div className="border-b border-border bg-background sticky top-0 z-10">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6">
        <div
          className="flex items-center gap-0 overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {TABS.map(({ label, path }) => {
            const active = isActive(path);
            return (
              <Link
                key={path}
                href={`/brands/${brandId}${path}`}
                className={cn(
                  "flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors shrink-0",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
                {label === "Voice File" && (
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      voiceCount >= 10 ? "bg-green-500" : "bg-amber-400"
                    )}
                    title={`${voiceCount} examples`}
                  />
                )}
                {label === "Lessons Bank" && lessonCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-[10px] font-bold leading-none">
                    {lessonCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
