import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import { useBrand } from "@/context/brand-context";
import { useListBrands } from "@workspace/api-client-react";
import { CulturalContextBadge, type CulturalContext } from "@/components/cultural-context-badge";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface GeneratorFormValues {
  brandId: string;
  prompt: string;
  platform?: string;
  tone?: string;
  language?: string;
  culturalContext?: string;
  variations?: number;
}

// ─── Ad Copy ──────────────────────────────────────────────────────────────────

const adCopySchema = z.object({
  product: z.string().min(5, "Describe your product or offer"),
  platform: z.string().min(1, "Select a platform"),
  goal: z.string().min(1, "Select a goal"),
  count: z.coerce.number().min(1).max(5),
});

type AdCopyFields = z.infer<typeof adCopySchema>;

function AdCopyForm({ onGenerate, isPending, culturalCtx }: { onGenerate: (v: GeneratorFormValues) => void; isPending: boolean; culturalCtx: CulturalContext }) {
  const { activeBrandId } = useBrand();
  const form = useForm<AdCopyFields>({ resolver: zodResolver(adCopySchema), defaultValues: { product: "", platform: "Instagram", goal: "conversion", count: 3 } });

  function submit(d: AdCopyFields) {
    onGenerate({
      brandId: activeBrandId!,
      prompt: `Product/Offer: ${d.product}`,
      platform: d.platform,
      tone: d.goal,
      language: culturalCtx.language,
      culturalContext: `${culturalCtx.country} - ${culturalCtx.language}`,
      variations: d.count,
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-5" data-testid="generator-form">
        <FormField control={form.control} name="platform" render={({ field }) => (
          <FormItem>
            <FormLabel>Platform</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger data-testid="select-platform"><SelectValue placeholder="Select platform" /></SelectTrigger></FormControl>
              <SelectContent>
                {["Facebook", "Instagram", "TikTok", "Google Ads", "LinkedIn"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="product" render={({ field }) => (
          <FormItem>
            <FormLabel>Product / Offer</FormLabel>
            <FormControl><Textarea placeholder="e.g. 50% off our new sneaker collection for Lagos youth" className="resize-none" rows={3} data-testid="input-prompt" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="goal" render={({ field }) => (
          <FormItem>
            <FormLabel>Campaign Goal</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger><SelectValue placeholder="Select goal" /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="awareness">Awareness - grow reach</SelectItem>
                <SelectItem value="conversion">Conversion - drive sales</SelectItem>
                <SelectItem value="engagement">Engagement - build community</SelectItem>
                <SelectItem value="traffic">Traffic - send to website</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="count" render={({ field }) => (
          <FormItem>
            <FormLabel>Variations: <span className="text-primary font-bold">{field.value}</span></FormLabel>
            <FormControl>
              <input type="range" min={1} max={5} step={1} className="w-full accent-primary h-2 cursor-pointer" data-testid="input-variations" {...field} />
            </FormControl>
            <div className="flex justify-between text-xs text-muted-foreground -mt-1"><span>1</span><span>5</span></div>
            <FormMessage />
          </FormItem>
        )} />
        <GenerateButton isPending={isPending} />
      </form>
    </Form>
  );
}

// ─── Social Posts ─────────────────────────────────────────────────────────────

const socialSchema = z.object({
  platform: z.string().min(1, "Select a platform"),
  topic: z.string().min(3, "Enter a topic"),
  pillar: z.string().min(1, "Select a content pillar"),
  hashtags: z.boolean(),
});
type SocialFields = z.infer<typeof socialSchema>;

function SocialForm({ onGenerate, isPending, culturalCtx }: { onGenerate: (v: GeneratorFormValues) => void; isPending: boolean; culturalCtx: CulturalContext }) {
  const { activeBrandId } = useBrand();
  const form = useForm<SocialFields>({ resolver: zodResolver(socialSchema), defaultValues: { platform: "Instagram", topic: "", pillar: "promotion", hashtags: true } });

  function submit(d: SocialFields) {
    onGenerate({
      brandId: activeBrandId!,
      prompt: `Topic: ${d.topic}. Content pillar: ${d.pillar}. ${d.hashtags ? "Include relevant hashtags." : "No hashtags."}`,
      platform: d.platform,
      language: culturalCtx.language,
      culturalContext: `${culturalCtx.country} - ${culturalCtx.language}`,
      variations: 3,
    });
  }

  const watched = form.watch("hashtags");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-5" data-testid="generator-form">
        <FormField control={form.control} name="platform" render={({ field }) => (
          <FormItem>
            <FormLabel>Platform</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger data-testid="select-platform"><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                {["Instagram", "TikTok", "Facebook", "Twitter/X", "LinkedIn"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="topic" render={({ field }) => (
          <FormItem>
            <FormLabel>Post Topic</FormLabel>
            <FormControl><Input placeholder="e.g. New product launch, customer milestone..." data-testid="input-prompt" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="pillar" render={({ field }) => (
          <FormItem>
            <FormLabel>Content Pillar</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="education">Education - teach something</SelectItem>
                <SelectItem value="entertainment">Entertainment - delight</SelectItem>
                <SelectItem value="inspiration">Inspiration - motivate</SelectItem>
                <SelectItem value="promotion">Promotion - sell</SelectItem>
                <SelectItem value="behind-the-scenes">Behind the scenes - show culture</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="hashtags" render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between py-1">
              <FormLabel className="mb-0">Include Hashtags</FormLabel>
              <button
                type="button"
                onClick={() => field.onChange(!field.value)}
                className={cn("relative w-10 h-5.5 rounded-full transition-colors", field.value ? "bg-primary" : "bg-muted-foreground/30")}
                style={{ height: "22px", width: "40px" }}
              >
                <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", field.value ? "translate-x-5" : "translate-x-0.5")} />
              </button>
            </div>
          </FormItem>
        )} />
        <GenerateButton isPending={isPending} />
      </form>
    </Form>
  );
}

// ─── Email ────────────────────────────────────────────────────────────────────

const emailSchema = z.object({
  emailType: z.string().min(1, "Select email type"),
  product: z.string().min(3, "Describe your product or offer"),
  goal: z.string().min(3, "What is the email goal?"),
  audience: z.string().min(2, "Who is this for?"),
});
type EmailFields = z.infer<typeof emailSchema>;

function EmailForm({ onGenerate, isPending, culturalCtx }: { onGenerate: (v: GeneratorFormValues) => void; isPending: boolean; culturalCtx: CulturalContext }) {
  const { activeBrandId } = useBrand();
  const form = useForm<EmailFields>({ resolver: zodResolver(emailSchema), defaultValues: { emailType: "promotional", product: "", goal: "", audience: "" } });

  function submit(d: EmailFields) {
    onGenerate({
      brandId: activeBrandId!,
      prompt: `Email type: ${d.emailType}. Product/offer: ${d.product}. Goal: ${d.goal}. Target audience: ${d.audience}.`,
      tone: d.emailType,
      language: culturalCtx.language,
      culturalContext: `${culturalCtx.country} - ${culturalCtx.language}`,
      variations: 1,
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-5" data-testid="generator-form">
        <FormField control={form.control} name="emailType" render={({ field }) => (
          <FormItem>
            <FormLabel>Email Type</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger data-testid="select-platform"><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="promotional">Promotional - drive a sale</SelectItem>
                <SelectItem value="newsletter">Newsletter - build relationship</SelectItem>
                <SelectItem value="welcome">Welcome - onboard new subscribers</SelectItem>
                <SelectItem value="re-engagement">Re-engagement - win back</SelectItem>
                <SelectItem value="product-launch">Product launch - announce new offer</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="product" render={({ field }) => (
          <FormItem>
            <FormLabel>Product / Offer</FormLabel>
            <FormControl><Textarea placeholder="e.g. Our new ₦5,000 skincare starter kit..." className="resize-none" rows={2} data-testid="input-prompt" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="goal" render={({ field }) => (
          <FormItem>
            <FormLabel>Email Goal</FormLabel>
            <FormControl><Input placeholder="e.g. Get 20% click-through rate on the CTA" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="audience" render={({ field }) => (
          <FormItem>
            <FormLabel>Audience Segment</FormLabel>
            <FormControl><Input placeholder="e.g. Lagos women aged 25-40 who haven't bought in 60 days" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <GenerateButton isPending={isPending} />
      </form>
    </Form>
  );
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────

const whatsappSchema = z.object({
  messageType: z.string().min(1, "Select message type"),
  product: z.string().min(3, "Describe your product or offer"),
  sequenceLength: z.coerce.number().min(1).max(5),
});
type WhatsappFields = z.infer<typeof whatsappSchema>;

function WhatsappForm({ onGenerate, isPending, culturalCtx }: { onGenerate: (v: GeneratorFormValues) => void; isPending: boolean; culturalCtx: CulturalContext }) {
  const { activeBrandId } = useBrand();
  const form = useForm<WhatsappFields>({ resolver: zodResolver(whatsappSchema), defaultValues: { messageType: "broadcast", product: "", sequenceLength: 3 } });

  function submit(d: WhatsappFields) {
    onGenerate({
      brandId: activeBrandId!,
      prompt: `Message type: ${d.messageType}. Product/offer: ${d.product}. Generate a sequence of ${d.sequenceLength} WhatsApp messages.`,
      tone: d.messageType,
      language: culturalCtx.language,
      culturalContext: `${culturalCtx.country} - ${culturalCtx.language}`,
      variations: d.sequenceLength,
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-5" data-testid="generator-form">
        <FormField control={form.control} name="messageType" render={({ field }) => (
          <FormItem>
            <FormLabel>Message Type</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger data-testid="select-platform"><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="broadcast">Broadcast - send to all contacts</SelectItem>
                <SelectItem value="follow-up">Follow-up - after purchase</SelectItem>
                <SelectItem value="cart-recovery">Cart recovery - bring them back</SelectItem>
                <SelectItem value="promotional">Promotional - limited offer</SelectItem>
                <SelectItem value="event-reminder">Event reminder - upcoming event</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="product" render={({ field }) => (
          <FormItem>
            <FormLabel>Product / Offer</FormLabel>
            <FormControl><Textarea placeholder="e.g. 24-hour flash sale on all footwear..." className="resize-none" rows={3} data-testid="input-prompt" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="sequenceLength" render={({ field }) => (
          <FormItem>
            <FormLabel>Sequence Length: <span className="text-primary font-bold">{field.value} message{field.value !== 1 ? "s" : ""}</span></FormLabel>
            <FormControl>
              <input type="range" min={1} max={5} step={1} className="w-full accent-primary h-2 cursor-pointer" data-testid="input-variations" {...field} />
            </FormControl>
            <div className="flex justify-between text-xs text-muted-foreground -mt-1"><span>1</span><span>5</span></div>
            <FormMessage />
          </FormItem>
        )} />
        <GenerateButton isPending={isPending} />
      </form>
    </Form>
  );
}

// ─── Video Scripts ────────────────────────────────────────────────────────────

const videoSchema = z.object({
  scriptType: z.string().min(1, "Select script type"),
  duration: z.string().min(1, "Select duration"),
  product: z.string().min(3, "Describe your product"),
  platform: z.string().min(1, "Select platform"),
});
type VideoFields = z.infer<typeof videoSchema>;

function VideoForm({ onGenerate, isPending, culturalCtx }: { onGenerate: (v: GeneratorFormValues) => void; isPending: boolean; culturalCtx: CulturalContext }) {
  const { activeBrandId } = useBrand();
  const form = useForm<VideoFields>({ resolver: zodResolver(videoSchema), defaultValues: { scriptType: "ad", duration: "30s", product: "", platform: "TikTok" } });

  function submit(d: VideoFields) {
    onGenerate({
      brandId: activeBrandId!,
      prompt: `Script type: ${d.scriptType}. Duration: ${d.duration}. Product/subject: ${d.product}.`,
      platform: d.platform,
      tone: d.scriptType,
      language: culturalCtx.language,
      culturalContext: `${culturalCtx.country} - ${culturalCtx.language}`,
      variations: 1,
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-5" data-testid="generator-form">
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="platform" render={({ field }) => (
            <FormItem>
              <FormLabel>Platform</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger data-testid="select-platform"><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {["TikTok", "Instagram Reels", "YouTube Shorts", "Facebook Reels"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="duration" render={({ field }) => (
            <FormItem>
              <FormLabel>Duration</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {["15s", "30s", "60s", "90s"].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="scriptType" render={({ field }) => (
          <FormItem>
            <FormLabel>Script Type</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="ad">Ad - direct response</SelectItem>
                <SelectItem value="explainer">Explainer - how it works</SelectItem>
                <SelectItem value="testimonial">Testimonial - social proof</SelectItem>
                <SelectItem value="behind-the-scenes">Behind the scenes - culture</SelectItem>
                <SelectItem value="tutorial">Tutorial - step by step</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="product" render={({ field }) => (
          <FormItem>
            <FormLabel>Product / Subject</FormLabel>
            <FormControl><Textarea placeholder="e.g. Our Ankara print laptop bags for Nigerian professionals..." className="resize-none" rows={3} data-testid="input-prompt" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <GenerateButton isPending={isPending} />
      </form>
    </Form>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function GenerateButton({ isPending }: { isPending: boolean }) {
  return (
    <button
      type="submit"
      disabled={isPending}
      data-testid="btn-generate"
      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm"
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {isPending ? "Generating..." : "Generate Content"}
    </button>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────

export type ContentType = "ad-copy" | "social-posts" | "email" | "whatsapp" | "video-scripts";

interface GeneratorFormProps {
  type: ContentType;
  onGenerate: (data: GeneratorFormValues) => void;
  isPending: boolean;
}

const DEFAULT_COUNTRY: CulturalContext = { country: "Nigeria", countryCode: "NG", language: "English" };

export function GeneratorForm({ type, onGenerate, isPending }: GeneratorFormProps) {
  const { activeBrandId } = useBrand();
  const { data: brands } = useListBrands();
  const activeBrand = brands?.find(b => b.id === activeBrandId);
  const [culturalCtx, setCulturalCtx] = useState<CulturalContext>({
    country: activeBrand?.country ?? "Nigeria",
    countryCode: "NG",
    language: activeBrand?.language ?? "English",
  });

  const formProps = { onGenerate, isPending, culturalCtx };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {activeBrand && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold border border-amber-200">
            <Sparkles className="h-3 w-3" />
            {activeBrand.name}
          </span>
        )}
        <CulturalContextBadge value={culturalCtx} onChange={setCulturalCtx} />
      </div>

      {type === "ad-copy" && <AdCopyForm {...formProps} />}
      {type === "social-posts" && <SocialForm {...formProps} />}
      {type === "email" && <EmailForm {...formProps} />}
      {type === "whatsapp" && <WhatsappForm {...formProps} />}
      {type === "video-scripts" && <VideoForm {...formProps} />}
    </div>
  );
}
