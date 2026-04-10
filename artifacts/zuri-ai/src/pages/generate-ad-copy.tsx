import { useState } from "react";
import { useGenerateAdCopy, getListContentQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { GeneratorForm, type GeneratorFormValues } from "@/components/generator-form";
import { ContentOutput } from "@/components/content-output";
import { Megaphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PLATFORMS = ["Google Ads", "Facebook Ads", "Instagram Ads", "Twitter/X Ads", "LinkedIn Ads", "TikTok Ads", "General"];
const TONES = ["Bold & Urgent", "Warm & Conversational", "Professional", "Inspirational", "Humorous", "Direct"];

export default function GenerateAdCopy() {
  const [output, setOutput] = useState<{ id: string; type: string; brandId: string; variations: { id: string; content: string; platform?: string; tone?: string }[] } | null>(null);
  const generate = useGenerateAdCopy();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  function onSubmit(data: GeneratorFormValues) {
    generate.mutate({ data }, {
      onSuccess: (res) => {
        setOutput(res);
        queryClient.invalidateQueries({ queryKey: getListContentQueryKey() });
      },
      onError: () => toast({ title: "Generation failed", description: "Please try again.", variant: "destructive" }),
    });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" data-testid="generate-ad-copy-page">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Megaphone className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ad Copy Generator</h1>
          <p className="text-muted-foreground text-sm">Create high-converting ad copy tailored to your brand and market.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-card border border-border rounded-2xl p-7">
          <h2 className="font-semibold text-foreground mb-5">Configure</h2>
          <GeneratorForm onSubmit={onSubmit} isPending={generate.isPending} platformOptions={PLATFORMS} toneOptions={TONES} />
        </div>
        <div>
          {output ? (
            <ContentOutput variations={output.variations} type="ad-copy" />
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center bg-muted/30 border border-dashed border-border rounded-2xl">
              <Megaphone className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Generated ad copy will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
