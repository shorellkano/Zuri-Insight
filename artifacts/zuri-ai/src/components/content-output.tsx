import { useState } from "react";
import { Copy, Check, Clock, Zap, Mail, MessageCircle, Video, Megaphone, Heart, Pencil, RefreshCw, BookmarkCheck, Sparkles } from "lucide-react";

interface Variation {
  id: string;
  content: string;
  platform?: string;
  tone?: string;
}

interface ContentOutputProps {
  variations: Variation[];
  type: string;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

// ─── Copy Button ──────────────────────────────────────────────────────────────

function CopyButton({ text, size = "sm" }: { text: string; size?: "xs" | "sm" }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={copy} data-testid="btn-copy-content" className={`flex items-center gap-1.5 border border-border rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ${size === "xs" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs font-medium"}`}>
      {copied ? <><Check className="h-3 w-3 text-green-600" /> Copied!</> : <><Copy className="h-3 w-3" /> Copy</>}
    </button>
  );
}

// ─── Favourite + Feedback ─────────────────────────────────────────────────────

function FavouriteButton({ variationId }: { variationId: string }) {
  const [faved, setFaved] = useState(false);
  return (
    <button
      onClick={() => setFaved(f => !f)}
      data-testid="btn-favourite"
      title={faved ? "Remove from favourites" : "Save to favourites"}
      className={`p-1.5 rounded-lg transition-colors ${faved ? "text-red-500 bg-red-50 hover:bg-red-100" : "text-muted-foreground hover:text-red-500 hover:bg-red-50"}`}
    >
      <Heart className={`h-3.5 w-3.5 ${faved ? "fill-current" : ""}`} />
    </button>
  );
}

function FeedbackButton({ variationId }: { variationId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  function send() {
    if (!text.trim()) return;
    setSent(true);
    setOpen(false);
    setTimeout(() => setSent(false), 3000);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        data-testid="btn-feedback"
        title="Give feedback on this variation"
        className={`p-1.5 rounded-lg transition-colors ${sent ? "text-green-600 bg-green-50" : "text-muted-foreground hover:text-primary hover:bg-primary/5"}`}
      >
        {sent ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 w-64 bg-card border border-border rounded-xl shadow-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">Feedback on this variation</p>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="What could be better? Too formal? Wrong tone?"
            className="w-full text-xs border border-border rounded-lg px-2.5 py-2 resize-none bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary"
            rows={3}
          />
          <div className="flex gap-2">
            <button onClick={send} className="flex-1 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90">Send</button>
            <button onClick={() => setOpen(false)} className="px-3 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:bg-muted">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function VariationActions({ variationId, copyText }: { variationId: string; copyText: string }) {
  return (
    <div className="flex items-center gap-1">
      <CopyButton text={copyText} />
      <FavouriteButton variationId={variationId} />
      <FeedbackButton variationId={variationId} />
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{children}</span>;
}

// ─── Ad Copy ──────────────────────────────────────────────────────────────────

function AdCopyCard({ data, i, id }: { data: any; i: number; id: string }) {
  const copyText = `HOOK: ${data.hook}\n\n${data.body}\n\n${data.cta}`;
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4" data-testid={`variation-card-${i}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Megaphone className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Variation {i + 1}</span>
          {data.tone_label && <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">{data.tone_label}</span>}
          {data.char_count && <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs">{data.char_count} chars</span>}
        </div>
        <VariationActions variationId={id} copyText={copyText} />
      </div>
      <div className="space-y-3 divide-y divide-border">
        <div className="pb-3">
          <Label>Hook</Label>
          <p className="text-sm font-medium text-foreground mt-1 leading-snug">{data.hook}</p>
        </div>
        <div className="py-3">
          <Label>Body</Label>
          <p className="text-sm text-foreground mt-1 leading-relaxed whitespace-pre-line">{data.body}</p>
        </div>
        <div className="pt-3 flex items-start justify-between gap-4">
          <div>
            <Label>CTA</Label>
            <p className="text-sm font-semibold text-primary mt-1">{data.cta}</p>
          </div>
          {data.emotional_angle && (
            <div className="text-right shrink-0 max-w-[140px]">
              <Label>Angle</Label>
              <p className="text-xs text-muted-foreground mt-1">{data.emotional_angle}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Social Posts ─────────────────────────────────────────────────────────────

function SocialPostCard({ data, i, id }: { data: any; i: number; id: string }) {
  const copyText = data.caption + (data.hashtags?.length ? "\n\n" + data.hashtags.map((h: string) => `#${h.replace(/^#/, "")}`).join(" ") : "");
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4" data-testid={`variation-card-${i}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Post {i + 1}</span>
          {data.post_format && <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full text-xs">{data.post_format}</span>}
          {data.char_count && <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs">{data.char_count} chars</span>}
        </div>
        <VariationActions variationId={id} copyText={copyText} />
      </div>
      <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{data.caption}</p>
      {data.hashtags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.hashtags.map((h: string, idx: number) => (
            <span key={idx} className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs font-mono">#{h.replace(/^#/, "")}</span>
          ))}
        </div>
      )}
      {data.best_time && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Best time: {data.best_time}
        </div>
      )}
    </div>
  );
}

// ─── Email ────────────────────────────────────────────────────────────────────

function EmailCard({ data, id }: { data: any; id: string }) {
  const body = data.email_body;
  const copyText = body ? [body.greeting, body.opening_hook, body.body_1, body.body_2, body.cta_context, body.cta_text, body.urgency_line, body.sign_off, body.ps_line].filter(Boolean).join("\n\n") : "";
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-5" data-testid="variation-card-0">
      {data.subject_lines?.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Subject Lines</Label>
            <VariationActions variationId={id} copyText={data.subject_lines.map((s: any) => s.text).join("\n")} />
          </div>
          <div className="space-y-2">
            {data.subject_lines.map((s: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{s.text}</p>
                  {s.preview_text && <p className="text-xs text-muted-foreground mt-0.5">{s.preview_text}</p>}
                  {s.style && <span className="inline-block mt-1 px-2 py-0.5 bg-background border border-border rounded text-xs text-muted-foreground">{s.style}</span>}
                </div>
                <CopyButton text={s.text} size="xs" />
              </div>
            ))}
          </div>
        </div>
      )}
      {body && (
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <Label>Email Body</Label>
            <div className="flex items-center gap-2">
              {data.estimated_read_time && <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{data.estimated_read_time}</span>}
              <CopyButton text={copyText} />
            </div>
          </div>
          <div className="bg-muted/30 rounded-lg p-4 space-y-3 text-sm text-foreground">
            {body.greeting && <p className="font-medium">{body.greeting}</p>}
            {body.opening_hook && <p className="font-semibold text-primary">{body.opening_hook}</p>}
            {body.body_1 && <p className="leading-relaxed">{body.body_1}</p>}
            {body.body_2 && <p className="leading-relaxed">{body.body_2}</p>}
            {body.cta_context && <p className="text-muted-foreground">{body.cta_context}</p>}
            {body.cta_text && <p className="font-bold text-primary underline">{body.cta_text}</p>}
            {body.urgency_line && <p className="text-amber-600 font-medium">{body.urgency_line}</p>}
            {body.sign_off && <p>{body.sign_off}</p>}
            {body.ps_line && <p className="italic text-muted-foreground">{body.ps_line}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────

function WhatsAppCard({ data, i, id }: { data: any; i: number; id: string }) {
  const text = data.message_text ?? data.content ?? "";
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3" data-testid={`variation-card-${i}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-green-600" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Message {i + 1}</span>
          {data.send_delay && <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs">{data.send_delay}</span>}
          {data.word_count && <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs">{data.word_count}w</span>}
        </div>
        <VariationActions variationId={id} copyText={text} />
      </div>
      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{text}</p>
      </div>
      {data.action_type && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Zap className="h-3.5 w-3.5" />
          Action: {data.action_type}
        </div>
      )}
    </div>
  );
}

// ─── Video Script ─────────────────────────────────────────────────────────────

function VideoScriptCard({ data, i, id }: { data: any; i: number; id: string }) {
  if (data.text && data.style) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 space-y-2" data-testid={`variation-card-${i}`}>
        <div className="flex items-center justify-between">
          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">{data.style}</span>
          <VariationActions variationId={id} copyText={data.text} />
        </div>
        <p className="text-sm font-semibold text-foreground">{data.text}</p>
        {data.why_it_works && <p className="text-xs text-muted-foreground italic">{data.why_it_works}</p>}
      </div>
    );
  }

  const copyText = [
    data.hook && `HOOK: ${data.hook}`,
    data.scenes?.map((s: any) => `[${s.duration}] ${s.spoken_script}`).join("\n"),
    data.cta && `CTA: ${data.cta}`,
    data.delivery_notes && `DELIVERY: ${data.delivery_notes}`,
  ].filter(Boolean).join("\n\n");

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4" data-testid={`variation-card-${i}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-purple-600" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Script</span>
          {data.total_word_count && <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs">{data.total_word_count}w</span>}
        </div>
        <VariationActions variationId={id} copyText={copyText} />
      </div>
      {data.hook && (
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <Label>Hook</Label>
          <p className="text-sm font-semibold text-purple-900 mt-1">{data.hook}</p>
        </div>
      )}
      {data.scenes?.length > 0 && (
        <div className="space-y-2">
          <Label>Scenes</Label>
          {data.scenes.map((s: any, si: number) => (
            <div key={si} className="flex gap-3 p-3 bg-muted/40 rounded-lg">
              <span className="shrink-0 text-xs font-bold text-muted-foreground w-12">{s.duration}</span>
              <div className="space-y-1 min-w-0">
                <p className="text-sm text-foreground">{s.spoken_script}</p>
                {s.action_note && <p className="text-xs text-muted-foreground">{s.action_note}</p>}
                {s.visual_suggestion && <p className="text-xs text-purple-600 italic">[{s.visual_suggestion}]</p>}
              </div>
            </div>
          ))}
        </div>
      )}
      {data.cta && (
        <div>
          <Label>CTA</Label>
          <p className="text-sm font-bold text-foreground mt-1">{data.cta}</p>
        </div>
      )}
      {data.b_roll_suggestions?.length > 0 && (
        <div>
          <Label>B-Roll Ideas</Label>
          <ul className="mt-1 space-y-1">
            {data.b_roll_suggestions.map((s: string, si: number) => (
              <li key={si} className="text-xs text-muted-foreground flex items-start gap-1.5"><span className="text-purple-400 mt-0.5">-</span>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {data.delivery_notes && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <Label>Delivery Notes</Label>
          <p className="text-xs text-amber-800 mt-1">{data.delivery_notes}</p>
        </div>
      )}
    </div>
  );
}

// ─── Fallback ─────────────────────────────────────────────────────────────────

function PlainCard({ variation, index }: { variation: Variation; index: number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5" data-testid={`variation-card-${index}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Variation {index + 1}</span>
          {variation.platform && <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs">{variation.platform}</span>}
          {variation.tone && <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">{variation.tone}</span>}
        </div>
        <VariationActions variationId={variation.id} copyText={variation.content} />
      </div>
      <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{variation.content}</p>
    </div>
  );
}

// ─── Smart renderer ───────────────────────────────────────────────────────────

function VariationCard({ variation, index, type }: { variation: Variation; index: number; type: string }) {
  let parsed: any = null;
  try { parsed = JSON.parse(variation.content); } catch { /* plain text */ }

  if (parsed) {
    if (type === "ad-copy") return <AdCopyCard data={parsed} i={index} id={variation.id} />;
    if (type === "social-posts") return <SocialPostCard data={parsed} i={index} id={variation.id} />;
    if (type === "email") return <EmailCard data={parsed} id={variation.id} />;
    if (type === "whatsapp") return <WhatsAppCard data={parsed} i={index} id={variation.id} />;
    if (type === "video-scripts") return <VideoScriptCard data={parsed} i={index} id={variation.id} />;
  }

  return <PlainCard variation={variation} index={index} />;
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function BlurredExampleCard({ type }: { type: string }) {
  return (
    <div className="relative rounded-xl overflow-hidden border border-border bg-card">
      <div className="p-4 space-y-2 select-none pointer-events-none">
        <div className="flex gap-2 mb-3">
          <div className="h-5 w-20 rounded-full bg-primary/10" />
          <div className="h-5 w-14 rounded-full bg-muted" />
        </div>
        <div className="h-4 w-full bg-muted/60 rounded" />
        <div className="h-4 w-4/5 bg-muted/60 rounded" />
        <div className="h-4 w-full bg-muted/40 rounded" />
        <div className="h-4 w-3/4 bg-muted/40 rounded" />
        <div className="h-4 w-full bg-muted/30 rounded" />
        <div className="mt-3 h-8 w-1/2 bg-primary/10 rounded-lg" />
      </div>
      <div className="absolute inset-0 backdrop-blur-[3px] bg-background/40 flex items-center justify-center">
        <span className="text-xs text-muted-foreground bg-background/80 px-3 py-1.5 rounded-full border border-border">
          Preview
        </span>
      </div>
    </div>
  );
}

export function EmptyOutputState({ type }: { type: string }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-primary/60" />
        </div>
        <p className="text-sm font-medium text-foreground">Fill in the details and generate</p>
        <p className="text-xs text-muted-foreground">Your generated content will appear here, ready to copy or save.</p>
      </div>
      <div className="grid gap-3 opacity-80">
        {[0, 1, 2].map(i => <BlurredExampleCard key={i} type={type} />)}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ContentOutput({ variations, type, onRegenerate, isRegenerating }: ContentOutputProps) {
  const [savedAll, setSavedAll] = useState(false);

  if (!variations || variations.length === 0) return null;

  function handleSaveAll() {
    setSavedAll(true);
    setTimeout(() => setSavedAll(false), 3000);
  }

  return (
    <div className="space-y-4" data-testid="content-output">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-foreground text-sm">
          {variations.length} {variations.length === 1 ? "result" : "variations"} generated
        </h3>
        <span className="text-xs text-muted-foreground">Saved to library automatically</span>
      </div>

      <div className="grid gap-4">
        {variations.map((v, i) => (
          <VariationCard key={v.id} variation={v} index={i} type={type} />
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            data-testid="btn-regenerate"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRegenerating ? "animate-spin" : ""}`} />
            {isRegenerating ? "Regenerating..." : "Regenerate"}
          </button>
        )}
        <button
          onClick={handleSaveAll}
          data-testid="btn-save-all"
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${savedAll ? "bg-green-100 text-green-700 border border-green-200" : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"}`}
        >
          {savedAll ? <><Check className="h-4 w-4" /> All saved!</> : <><BookmarkCheck className="h-4 w-4" /> Save all to library</>}
        </button>
      </div>
    </div>
  );
}
