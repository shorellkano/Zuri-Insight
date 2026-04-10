import { useState } from "react";
import { Copy, Check, Clock, Hash, Zap, Mail, MessageCircle, Video, Megaphone } from "lucide-react";

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

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{children}</span>;
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <p className={`text-sm text-foreground leading-relaxed ${mono ? "font-mono bg-muted/50 px-2 py-1 rounded" : ""}`}>{value}</p>
    </div>
  );
}

// ─── Ad Copy ────────────────────────────────────────────────────────────────

function AdCopyCard({ data, i }: { data: any; i: number }) {
  const copyText = `HOOK: ${data.hook}\n\n${data.body}\n\n${data.cta}`;
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4" data-testid={`variation-card-${i}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Variation {i + 1}</span>
          {data.tone_label && <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">{data.tone_label}</span>}
          {data.char_count && <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs">{data.char_count} chars</span>}
        </div>
        <CopyButton text={copyText} />
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
            <div className="text-right">
              <Label>Angle</Label>
              <p className="text-xs text-muted-foreground mt-1">{data.emotional_angle}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Social Posts ────────────────────────────────────────────────────────────

function SocialPostCard({ data, i }: { data: any; i: number }) {
  const copyText = data.caption + (data.hashtags?.length ? "\n\n" + data.hashtags.map((h: string) => `#${h.replace(/^#/, "")}`).join(" ") : "");
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4" data-testid={`variation-card-${i}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Post {i + 1}</span>
          {data.post_format && <span className="px-2 py-0.5 bg-secondary/10 text-secondary rounded-full text-xs">{data.post_format}</span>}
          {data.char_count && <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs">{data.char_count} chars</span>}
        </div>
        <CopyButton text={copyText} />
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

// ─── Email ───────────────────────────────────────────────────────────────────

function EmailCard({ data }: { data: any }) {
  const body = data.email_body;
  const copyText = body ? [body.greeting, body.opening_hook, body.body_1, body.body_2, body.cta_context, body.cta_text, body.urgency_line, body.sign_off, body.ps_line].filter(Boolean).join("\n\n") : "";
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-5" data-testid="variation-card-0">
      {/* Subject Lines */}
      {data.subject_lines?.length > 0 && (
        <div className="space-y-2">
          <Label>Subject Lines</Label>
          <div className="space-y-2">
            {data.subject_lines.map((s: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{s.text}</p>
                  {s.preview_text && <p className="text-xs text-muted-foreground mt-0.5">{s.preview_text}</p>}
                  {s.style && <span className="inline-block mt-1 px-2 py-0.5 bg-background border border-border rounded text-xs text-muted-foreground">{s.style}</span>}
                </div>
                <CopyButton text={s.text} />
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Email Body */}
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

// ─── WhatsApp ────────────────────────────────────────────────────────────────

function WhatsAppCard({ data, i }: { data: any; i: number }) {
  const text = data.message_text ?? data.content ?? "";
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3" data-testid={`variation-card-${i}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-green-600" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Message {i + 1}</span>
          {data.send_delay && <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs">{data.send_delay}</span>}
          {data.word_count && <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs">{data.word_count}w</span>}
        </div>
        <CopyButton text={text} />
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

// ─── Video Script ────────────────────────────────────────────────────────────

function VideoScriptCard({ data, i }: { data: any; i: number }) {
  // Hook pack item: { text, style, why_it_works }
  if (data.text && data.style) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 space-y-2" data-testid={`variation-card-${i}`}>
        <div className="flex items-center justify-between">
          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">{data.style}</span>
          <CopyButton text={data.text} />
        </div>
        <p className="text-sm font-semibold text-foreground">{data.text}</p>
        {data.why_it_works && <p className="text-xs text-muted-foreground italic">{data.why_it_works}</p>}
      </div>
    );
  }

  // Full script
  const copyText = [
    data.hook && `HOOK: ${data.hook}`,
    data.scenes?.map((s: any) => `[${s.duration}] ${s.spoken_script}`).join("\n"),
    data.cta && `CTA: ${data.cta}`,
    data.delivery_notes && `DELIVERY: ${data.delivery_notes}`,
  ].filter(Boolean).join("\n\n");

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4" data-testid={`variation-card-${i}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-purple-600" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Script</span>
          {data.total_word_count && <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs">{data.total_word_count}w</span>}
        </div>
        <CopyButton text={copyText} />
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

// ─── Smart renderer ─────────────────────────────────────────────────────────

function VariationCard({ variation, index, type }: { variation: Variation; index: number; type: string }) {
  let parsed: any = null;
  try { parsed = JSON.parse(variation.content); } catch { /* plain text */ }

  if (parsed) {
    if (type === "ad-copy") return <AdCopyCard data={parsed} i={index} />;
    if (type === "social-posts") return <SocialPostCard data={parsed} i={index} />;
    if (type === "email") return <EmailCard data={parsed} />;
    if (type === "whatsapp") return <WhatsAppCard data={parsed} i={index} />;
    if (type === "video-scripts") return <VideoScriptCard data={parsed} i={index} />;
  }

  // Fallback: plain text
  return (
    <div className="bg-card border border-border rounded-xl p-5" data-testid={`variation-card-${index}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Variation {index + 1}</span>
          {variation.platform && <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs">{variation.platform}</span>}
          {variation.tone && <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">{variation.tone}</span>}
        </div>
        <CopyButton text={variation.content} />
      </div>
      <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{variation.content}</p>
    </div>
  );
}

export function ContentOutput({ variations, type }: ContentOutputProps) {
  if (!variations || variations.length === 0) return null;

  return (
    <div className="space-y-4" data-testid="content-output">
      <h3 className="font-semibold text-foreground">
        Generated Content ({variations.length} {variations.length === 1 ? "result" : "variations"})
      </h3>
      <div className="grid gap-4">
        {variations.map((v, i) => (
          <VariationCard key={v.id} variation={v} index={i} type={type} />
        ))}
      </div>
    </div>
  );
}
