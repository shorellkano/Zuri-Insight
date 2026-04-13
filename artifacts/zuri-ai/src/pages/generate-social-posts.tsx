import { useState, useEffect } from "react";
import { useGenerateSocialPosts, getListContentQueryKey, useListBrands } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { GeneratorForm, type GeneratorFormValues } from "@/components/generator-form";
import { ContentOutput, EmptyOutputState } from "@/components/content-output";
import { Share2, AtSign, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSearch } from "wouter";
import { useBrand } from "@/context/brand-context";

type Output = { id: string; type: string; brandId: string; variations: { id: string; content: string; platform?: string; tone?: string }[] };

export default function GenerateSocialPosts() {
  const [output, setOutput] = useState<Output | null>(null);
  const [lastData, setLastData] = useState<GeneratorFormValues | null>(null);
  const generate = useGenerateSocialPosts();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeBrandId } = useBrand();
  const { data: brands } = useListBrands();

  const search = useSearch();
  const params = new URLSearchParams(search);
  const inboundHandle = params.get("handle") ?? "";
  const inboundPlatform = params.get("platform") ?? "";

  const [autoTriggered, setAutoTriggered] = useState(false);

  function onGenerate(data: GeneratorFormValues) {
    setLastData(data);
    generate.mutate({ data }, {
      onSuccess: (res) => {
        setOutput(res);
        queryClient.invalidateQueries({ queryKey: getListContentQueryKey() });
      },
      onError: () => toast({ title: "Generation failed", description: "Please try again.", variant: "destructive" }),
    });
  }

  function onRegenerate() {
    if (lastData) onGenerate(lastData);
  }

  useEffect(() => {
    if (autoTriggered) return;
    if (!inboundPlatform || !activeBrandId) return;

    setAutoTriggered(true);

    const handleContext = inboundHandle
      ? `Generating posts for @${inboundHandle} on ${inboundPlatform}. `
      : "";

    onGenerate({
      brandId: activeBrandId,
      prompt: `${handleContext}No topic given - suggest a relevant, timely topic that fits this brand. Content pillar: promotion. Include relevant hashtags.`,
      platform: inboundPlatform,
      variations: 3,
    });
  }, [activeBrandId, inboundPlatform, autoTriggered]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5" data-testid="generate-social-posts-page">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
          <Share2 className="h-5 w-5 text-teal-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Social Posts Generator</h1>
          <p className="text-muted-foreground text-sm">Captions that actually get engagement on every platform.</p>
        </div>
      </div>

      {inboundHandle && inboundPlatform && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-primary/5 border border-primary/20">
          <AtSign className="h-4 w-4 text-primary shrink-0" />
          <p className="text-sm text-foreground">
            Creating posts for <span className="font-bold text-primary">@{inboundHandle}</span> on <span className="font-semibold">{inboundPlatform}</span>
            {generate.isPending && <span className="text-muted-foreground ml-1">- generating now...</span>}
          </p>
          {generate.isPending && <Sparkles className="h-4 w-4 text-primary animate-pulse ml-auto shrink-0" />}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6">
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-semibold text-foreground mb-5 text-sm uppercase tracking-wide text-muted-foreground">Configure</h2>
          <GeneratorForm type="social-posts" onGenerate={onGenerate} isPending={generate.isPending} />
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 min-h-[500px]">
          <h2 className="font-semibold text-foreground mb-5 text-sm uppercase tracking-wide text-muted-foreground">Output</h2>
          {output ? (
            <ContentOutput variations={output.variations} type="social-posts" brandId={output.brandId} onRegenerate={onRegenerate} isRegenerating={generate.isPending} />
          ) : (
            <EmptyOutputState type="social-posts" />
          )}
        </div>
      </div>
    </div>
  );
}
