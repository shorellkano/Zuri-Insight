import { useState } from "react";
import { useListContent, useDeleteContent, useListBrands, getListContentQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Trash2, Copy, Check, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CONTENT_TYPES = ["ad-copy", "social-posts", "email", "whatsapp", "video-scripts"];

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={copy} data-testid="btn-copy-content-library" className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

export default function ContentLibrary() {
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [brandFilter, setBrandFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const params = {
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(brandFilter ? { brandId: brandFilter } : {}),
  };

  const { data: content, isLoading } = useListContent(Object.keys(params).length > 0 ? params : undefined);
  const { data: brands } = useListBrands();
  const deleteContent = useDeleteContent();

  function handleDelete(contentId: string) {
    deleteContent.mutate({ contentId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListContentQueryKey() }),
    });
  }

  const filtered = content?.filter((item) =>
    !search || item.content.toLowerCase().includes(search.toLowerCase()) || item.brandName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" data-testid="content-library-page">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Content Library</h1>
        <p className="text-muted-foreground mt-1">All your generated content, organized and ready to use.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search content..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-content" />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-type-filter">
            <SelectValue placeholder="All content types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {CONTENT_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t.replace("-", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={brandFilter} onValueChange={(v) => setBrandFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-brand-filter">
            <SelectValue placeholder="All brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brands</SelectItem>
            {brands?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}</div>
      ) : filtered && filtered.length > 0 ? (
        <div className="space-y-4">
          {filtered.map((item) => (
            <div key={item.id} className="bg-card border border-border rounded-xl p-5" data-testid={`content-library-item-${item.id}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium capitalize">{item.type?.replace("-", " ")}</span>
                  <span className="px-2.5 py-0.5 bg-muted text-muted-foreground rounded-full text-xs font-medium">{item.brandName}</span>
                  {item.platform && <span className="px-2 py-0.5 bg-secondary/10 text-secondary rounded-full text-xs">{item.platform}</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <CopyBtn text={item.content} />
                  <button onClick={() => handleDelete(item.id)} data-testid={`btn-delete-content-${item.id}`} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {item.prompt && <p className="text-xs text-muted-foreground mb-2 italic">Prompt: {item.prompt}</p>}
              <p className="text-sm text-foreground whitespace-pre-line line-clamp-5">{item.content}</p>
              <p className="text-xs text-muted-foreground mt-3">{new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <BookOpen className="h-14 w-14 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No content yet</h3>
          <p className="text-muted-foreground">Generate your first piece of content using one of the generators.</p>
        </div>
      )}
    </div>
  );
}
