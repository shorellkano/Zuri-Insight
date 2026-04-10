import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface Variation {
  id: string;
  content: string;
  platform?: string;
  tone?: string;
}

interface ContentOutputProps {
  variations: Variation[];
  type: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={copy} data-testid="btn-copy-content" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <><Check className="h-3.5 w-3.5 text-green-600" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
    </button>
  );
}

export function ContentOutput({ variations, type }: ContentOutputProps) {
  if (!variations || variations.length === 0) return null;

  return (
    <div className="space-y-4" data-testid="content-output">
      <h3 className="font-semibold text-foreground">Generated Content ({variations.length} variation{variations.length > 1 ? "s" : ""})</h3>
      <div className="grid gap-4">
        {variations.map((v, i) => (
          <div key={v.id} className="bg-card border border-border rounded-xl p-5" data-testid={`variation-card-${i}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Variation {i + 1}</span>
                {v.platform && <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs">{v.platform}</span>}
                {v.tone && <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">{v.tone}</span>}
              </div>
              <CopyButton text={v.content} />
            </div>
            <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{v.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
