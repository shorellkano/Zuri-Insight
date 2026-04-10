import { Link } from "wouter";
import { Megaphone, Share2, Mail, MessageCircle, Video, ArrowRight } from "lucide-react";

const generators = [
  {
    href: "/generate/ad-copy",
    icon: Megaphone,
    label: "Ad Copy",
    desc: "High-converting ad copy for digital and print campaigns.",
    color: "text-primary bg-primary/10",
  },
  {
    href: "/generate/social-posts",
    icon: Share2,
    label: "Social Posts",
    desc: "Engaging posts for Instagram, Twitter, LinkedIn, TikTok, and Facebook.",
    color: "text-secondary bg-secondary/10",
  },
  {
    href: "/generate/email",
    icon: Mail,
    label: "Email Campaigns",
    desc: "Full email campaigns with subject lines, body copy, and CTAs.",
    color: "text-amber-700 bg-amber-100",
  },
  {
    href: "/generate/whatsapp",
    icon: MessageCircle,
    label: "WhatsApp Messages",
    desc: "Conversational messages for WhatsApp marketing and broadcasts.",
    color: "text-green-700 bg-green-100",
  },
  {
    href: "/generate/video-scripts",
    icon: Video,
    label: "Video Scripts",
    desc: "Hook, body, and CTA scripts for TikTok, Reels, and YouTube Shorts.",
    color: "text-purple-700 bg-purple-100",
  },
];

export default function GenerateHub() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" data-testid="generate-hub-page">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Generate Content</h1>
        <p className="text-muted-foreground mt-1">Choose a content format to get started with your Brand DNA.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {generators.map(({ href, icon: Icon, label, desc, color }) => (
          <Link key={href} href={href} data-testid={`generator-card-${label}`}>
            <div className="bg-card border border-border rounded-2xl p-7 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer group flex items-start gap-5">
              <div className={`h-14 w-14 rounded-2xl ${color} flex items-center justify-center shrink-0`}>
                <Icon className="h-7 w-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-foreground text-lg">{label}</h3>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
