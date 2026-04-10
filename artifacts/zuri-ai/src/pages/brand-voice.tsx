import { useParams, Link } from "wouter";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pin, Trash2, Plus, FileText, Share2, Globe, ChevronDown, ChevronUp, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGetBrand } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const API = (path: string) => `/api${path}`;

type VoiceExample = {
  id: string; brandId: string; text: string; title: string | null;
  isPinned: boolean; contentType: string | null; platform: string | null;
  createdAt: string;
};

type Tab = "email" | "social" | "other";

const TABS: { id: Tab; label: string; icon: React.ElementType; description: string }[] = [
  { id: "email", label: "Email", icon: FileText, description: "Open your Sent folder. Find 10-25 emails you are proud of. Paste the subject line and body of each one here." },
  { id: "social", label: "Social Posts", icon: Share2, description: "Paste captions, threads, or posts you have written that sound most like you." },
  { id: "other", label: "Website / Other", icon: Globe, description: "Ad copy, website headlines, WhatsApp messages, customer responses - anything in your voice." },
];

const EMAIL_PLATFORMS = ["Gmail", "Kit", "Mailchimp", "ActiveCampaign", "Other"];
const SOCIAL_PLATFORMS = ["Instagram", "TikTok", "Facebook", "Twitter/X", "LinkedIn"];
const OTHER_FORMATS = ["Website copy", "Ad copy", "WhatsApp", "Customer response", "Other"];

function useBrandVoice(brandId: string) {
  return useQuery<VoiceExample[]>({
    queryKey: ["voice", brandId],
    queryFn: () => fetch(API(`/brands/${brandId}/voice`)).then(r => r.json()),
    enabled: !!brandId,
  });
}

function StatusBadge({ count }: { count: number }) {
  if (count === 0) return <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">Empty</span>;
  if (count < 10) return <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">Building - {count} example{count !== 1 ? "s" : ""}</span>;
  return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Ready</span>;
}

function ExampleCard({ example, onPin, onDelete }: { example: VoiceExample; onPin: () => void; onDelete: () => void }) {
  const preview = example.text.substring(0, 180);
  const typeLabel = example.contentType ?? "General";
  return (
    <div className={cn("bg-card border rounded-xl p-4 space-y-3 group", example.isPinned ? "border-amber-300 bg-amber-50/30" : "border-border")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">{typeLabel}</span>
          {example.platform && <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs">{example.platform}</span>}
          {example.isPinned && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">Pinned</span>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onPin}
            title={example.isPinned ? "Unpin" : "Pin as priority example"}
            className={cn("p-1.5 rounded-lg transition-colors", example.isPinned ? "text-amber-600 bg-amber-100" : "text-muted-foreground hover:text-amber-600 hover:bg-amber-50 opacity-0 group-hover:opacity-100")}
          >
            <Pin className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            title="Delete example"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {example.title && <p className="text-xs font-semibold text-foreground">{example.title}</p>}
      <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{preview}{example.text.length > 180 ? "..." : ""}</p>
      <p className="text-xs text-muted-foreground">{example.text.length} chars</p>
    </div>
  );
}

export default function BrandVoice() {
  const { brandId } = useParams<{ brandId: string }>();
  const { data: brand } = useGetBrand(brandId);
  const { data: examples = [], isLoading } = useBrandVoice(brandId);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>("email");
  const [platform, setPlatform] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkFormat, setBulkFormat] = useState("email");

  const addExample = useMutation({
    mutationFn: (body: object) => fetch(API(`/brands/${brandId}/voice`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voice", brandId] });
      setContent(""); setTitle(""); setPlatform("");
      toast({ title: "Example added", description: "Your voice file is growing." });
    },
    onError: () => toast({ title: "Failed to add example", variant: "destructive" }),
  });

  const pinExample = useMutation({
    mutationFn: (id: string) => fetch(API(`/brands/${brandId}/voice/${id}/pin`), { method: "PATCH" }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["voice", brandId] }),
  });

  const deleteExample = useMutation({
    mutationFn: (id: string) => fetch(API(`/brands/${brandId}/voice/${id}`), { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voice", brandId] });
      toast({ title: "Example deleted" });
    },
  });

  const bulkImport = useMutation({
    mutationFn: (body: object) => fetch(API(`/brands/${brandId}/voice`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: (data: VoiceExample[]) => {
      queryClient.invalidateQueries({ queryKey: ["voice", brandId] });
      setBulkText("");
      toast({ title: `${Array.isArray(data) ? data.length : 1} example${Array.isArray(data) && data.length !== 1 ? "s" : ""} imported` });
    },
    onError: () => toast({ title: "Import failed", variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const tabConfig = TABS.find(t => t.id === activeTab)!;
    addExample.mutate({ text: content, title, platform, contentType: activeTab });
  }

  function handleBulkImport() {
    const chunks = bulkText.split(/^---$/m).map(c => c.trim()).filter(c => c.length > 10);
    if (chunks.length === 0) { toast({ title: "No valid examples found", description: "Use --- on its own line to separate examples.", variant: "destructive" }); return; }
    bulkImport.mutate({ bulkTexts: chunks, contentType: bulkFormat });
  }

  const currentTab = TABS.find(t => t.id === activeTab)!;
  const platforms = activeTab === "email" ? EMAIL_PLATFORMS : activeTab === "social" ? SOCIAL_PLATFORMS : OTHER_FORMATS;
  const platformLabel = activeTab === "other" ? "Format" : "Platform";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" data-testid="brand-voice-page">
      <div className="flex items-center gap-3">
        <Link href={`/brands/${brandId}`}>
          <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Voice File</h1>
            <StatusBadge count={examples.length} />
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">The more real examples you add, the more Zuri AI sounds like you.</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">{examples.length} of 25 recommended examples</span>
          <span className="text-xs text-muted-foreground">{Math.min(100, Math.round((examples.length / 25) * 100))}% complete</span>
        </div>
        <div className="h-2 rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-primary transition-all duration-500"
            style={{ width: `${Math.min(100, (examples.length / 25) * 100)}%` }}
          />
        </div>
      </div>

      {/* Add example form */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex border-b border-border">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn("flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors", activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.id === "email" && <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs">Most important</span>}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{currentTab.description}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{platformLabel}</label>
              <select value={platform} onChange={e => setPlatform(e.target.value)} className="w-full h-9 px-3 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Select {platformLabel.toLowerCase()}...</option>
                {platforms.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Title <span className="text-muted-foreground font-normal normal-case">(optional)</span></label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Launch email for product X" className="w-full h-9 px-3 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Paste the full content here..."
              rows={7}
              required
              minLength={5}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-background resize-y focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button type="submit" disabled={addExample.isPending || !content.trim()} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {addExample.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add This Example
          </button>
        </form>
      </div>

      {/* Bulk import */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <button
          onClick={() => setBulkOpen(o => !o)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Bulk Import</span>
            <span className="text-xs text-muted-foreground">- paste multiple examples at once</span>
          </div>
          {bulkOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {bulkOpen && (
          <div className="px-6 pb-6 space-y-4 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">Paste multiple examples separated by <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">---</code> on its own line. Each chunk becomes a separate example.</p>
            <select value={bulkFormat} onChange={e => setBulkFormat(e.target.value)} className="h-9 px-3 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="email">Email</option>
              <option value="social">Social Posts</option>
              <option value="other">Other</option>
            </select>
            <textarea
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder={`Subject: Our biggest sale ever...\nHi [name], I wanted to reach out personally...\n\n---\n\nAnother email or post here...`}
              rows={10}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-background resize-y focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            />
            <button
              onClick={handleBulkImport}
              disabled={bulkImport.isPending || !bulkText.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {bulkImport.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import All
            </button>
          </div>
        )}
      </div>

      {/* Examples grid */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Saved Examples ({examples.length})
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1, 2].map(i => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : examples.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center bg-muted/30 border border-dashed border-border rounded-2xl">
            <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No examples yet</p>
            <p className="text-xs text-muted-foreground">Start by adding emails or posts that sound most like you.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {examples.map(ex => (
              <ExampleCard
                key={ex.id}
                example={ex}
                onPin={() => pinExample.mutate(ex.id)}
                onDelete={() => deleteExample.mutate(ex.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
