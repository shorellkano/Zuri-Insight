import { useState, useCallback } from "react";
import { useGenerateAdCopy, getListContentQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { GeneratorForm, type GeneratorFormValues } from "@/components/generator-form";
import { ContentOutput, EmptyOutputState } from "@/components/content-output";
import { Megaphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBrand } from "@/context/brand-context";

type Output = { id: string; type: string; brandId: string; variations: { id: string; content: string; platform?: string; tone?: string }[] };

export default function GenerateAdCopy() {
  const [output, setOutput] = useState<Output | null>(null);
  const [lastData, setLastData] = useState<GeneratorFormValues | null>(null);
  const generate = useGenerateAdCopy();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeBrandId } = useBrand();

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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5" data-testid="generate-ad-copy-page">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Megaphone className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Ad Copy Generator</h1>
          <p className="text-muted-foreground text-sm">High-converting ads tailored to your brand and market.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6">
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-semibold text-foreground mb-5 text-sm uppercase tracking-wide text-muted-foreground">Configure</h2>
          <GeneratorForm type="ad-copy" onGenerate={onGenerate} isPending={generate.isPending} />
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 min-h-[500px]">
          <h2 className="font-semibold text-foreground mb-5 text-sm uppercase tracking-wide text-muted-foreground">Output</h2>
          {output ? (
            <ContentOutput variations={output.variations} type="ad-copy" brandId={output.brandId} onRegenerate={onRegenerate} isRegenerating={generate.isPending} />
          ) : (
            <EmptyOutputState type="ad-copy" />
          )}
        </div>
      </div>
    </div>
  );
}
